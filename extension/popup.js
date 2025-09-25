import { ENVIRONMENTS, getSettings, setSettings } from './config.js';
import { apiClient } from './api.js';

const popupRootEl = document.getElementById('popup-root');
const envEl = document.getElementById('environment');
const assignmentEl = document.getElementById('assignment-select');
const assignmentLoadingEl = document.getElementById('assignment-loading');
const userIdEl = document.getElementById('userId');
const statusEl = document.getElementById('status');
const connectionEl = document.getElementById('connection');
const submitBtn = document.getElementById('submit');
const newAssignmentContainer = document.getElementById('new-assignment-container');
const newAssignmentInput = document.getElementById('new-assignment-name');
const newAssignmentFeedback = document.getElementById('new-assignment-feedback');
const interactionGuardEl = document.getElementById('interaction-guard');
const globalErrorAnnouncer = document.getElementById('global-error-announcer');

const userIdSavedIcon = document.getElementById('userId-saved');
const userIdEditIcon = document.getElementById('userId-edit');
const appIdSavedIcon = document.getElementById('appId-saved');
const appIdEditIcon = document.getElementById('appId-edit');

const cleanupCallbacks = [];

const FormPhase = Object.freeze({
  INITIALIZING: 'initializing',
  IDLE: 'idle',
  LOADING: 'loading',
  SAVING: 'saving',
  ERROR: 'error'
});

function createFormStateMachine() {
  const state = {
    phase: FormPhase.INITIALIZING,
    context: {
      fields: {
        userId: { saved: false, editing: true, locked: false },
        appId: { saved: false, editing: false, locked: true }
      },
      pendingOps: new Set(),
      isBusy: false,
      busyReason: null,
      lastError: null
    }
  };

  const listeners = new Set();

  function snapshot() {
    const { fields, pendingOps, ...rest } = state.context;
    const clonedFields = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, { ...value }])
    );
    return {
      phase: state.phase,
      context: {
        ...rest,
        fields: clonedFields,
        pendingOps: Array.from(pendingOps)
      }
    };
  }

  function notify() {
    const nextState = snapshot();
    listeners.forEach(listener => {
      try {
        listener(nextState);
      } catch (error) {
        console.error('State listener failed', error);
      }
    });
  }

  function commit(mutator) {
    mutator(state);
    notify();
  }

  return {
    getState: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    setPhase(phase) {
      commit(current => {
        current.phase = phase;
      });
    },
    updateField(fieldName, updates) {
      commit(current => {
        const fields = { ...current.context.fields };
        const currentField = fields[fieldName] ?? {};
        fields[fieldName] = { ...currentField, ...updates };
        current.context = { ...current.context, fields };
      });
    },
    beginOperation(name) {
      commit(current => {
        const pendingOps = new Set(current.context.pendingOps);
        pendingOps.add(name);
        const phase = name.includes('load') ? FormPhase.LOADING : FormPhase.SAVING;
        current.phase = phase;
        current.context = {
          ...current.context,
          pendingOps,
          isBusy: true,
          busyReason: name,
          lastError: null
        };
      });
    },
    endOperation(name) {
      commit(current => {
        const pendingOps = new Set(current.context.pendingOps);
        pendingOps.delete(name);
        const isBusy = pendingOps.size > 0;
        current.context = {
          ...current.context,
          pendingOps,
          isBusy,
          busyReason: isBusy ? Array.from(pendingOps).at(-1) : null
        };
        if (!isBusy && current.phase !== FormPhase.ERROR) {
          current.phase = FormPhase.IDLE;
        }
      });
    },
    setError(message) {
      commit(current => {
        current.phase = FormPhase.ERROR;
        current.context = { ...current.context, lastError: message };
      });
    },
    clearError() {
      commit(current => {
        current.context = { ...current.context, lastError: null };
        if ((current.context.pendingOps?.size ?? 0) === 0) {
          current.phase = FormPhase.IDLE;
        }
      });
    }
  };
}

const stateMachine = createFormStateMachine();

const ADD_NEW_ASSIGNMENT_OPTION = '__add_new_assignment__';
const USER_ID_PROMPT_MESSAGE = 'Enter your User ID first, then save to load available App IDs.';
const APP_ID_PATTERN = /^[A-Za-z0-9]{8,}$/;

const fieldElements = {
  userId: userIdEl,
  appId: assignmentEl
};

const savedIcons = {
  userId: userIdSavedIcon,
  appId: appIdSavedIcon
};

const editIcons = {
  userId: userIdEditIcon,
  appId: appIdEditIcon
};

function registerCleanup(callback) {
  if (typeof callback === 'function') {
    cleanupCallbacks.push(callback);
  }
}

function runCleanup() {
  while (cleanupCallbacks.length) {
    const cleanup = cleanupCallbacks.pop();
    try {
      cleanup();
    } catch (error) {
      console.error('Cleanup failed', error);
    }
  }
}

function addManagedEventListener(target, type, listener, options) {
  if (!target || !target.addEventListener) {
    return () => {};
  }

  target.addEventListener(type, listener, options);
  const cleanup = () => {
    target.removeEventListener(type, listener, options);
  };

  registerCleanup(cleanup);
  return cleanup;
}

function getFieldState(fieldName) {
  return stateMachine.getState().context.fields[fieldName] ?? {
    saved: false,
    editing: false,
    locked: false
  };
}

function updateFieldState(fieldName, updates) {
  stateMachine.updateField(fieldName, updates);
}

function wait(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

const DEBOUNCE_CANCELLED_MESSAGE = 'DEBOUNCED_CANCELLED';

function createDebouncedAsync(fn, delay) {
  let timerId = null;
  let pendingReject = null;

  const debounced = (...args) =>
    new Promise((resolve, reject) => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }

      if (pendingReject) {
        pendingReject(new Error(DEBOUNCE_CANCELLED_MESSAGE));
        pendingReject = null;
      }

      pendingReject = reject;

      timerId = setTimeout(async () => {
        timerId = null;
        pendingReject = null;
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });

  debounced.cancel = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (pendingReject) {
      pendingReject(new Error(DEBOUNCE_CANCELLED_MESSAGE));
      pendingReject = null;
    }
  };

  return debounced;
}

async function retryAsync(fn, { retries = 2, delay = 300 } = {}) {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await wait(delay * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError;
}

async function withSettingsTransaction(work) {
  const snapshot = await getSettings();
  try {
    return await work(snapshot);
  } catch (error) {
    await retryAsync(() => setSettings(snapshot)).catch(rollbackError => {
      console.error('Rollback failed', rollbackError);
    });
    throw error;
  }
}

function applyStateToUI({ context }) {
  const isBusy = Boolean(context.isBusy);
  if (popupRootEl) {
    popupRootEl.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  }
  if (interactionGuardEl) {
    interactionGuardEl.hidden = !isBusy;
    interactionGuardEl.setAttribute('aria-hidden', isBusy ? 'false' : 'true');
  }
}

const unsubscribeState = stateMachine.subscribe(applyStateToUI);
registerCleanup(unsubscribeState);

let statusTimeoutId = null;
let lastLoadedUserId = '';
let isSubmitting = false;

registerCleanup(clearStatusTimer);

function clearStatusTimer() {
  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
    statusTimeoutId = null;
  }
}

function setStatus(message, isError = false, { persist = false } = {}) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#d93025' : '#198754';
  statusEl.hidden = !message;
  statusEl.dataset.statusType = isError ? 'error' : message ? 'success' : '';
  statusEl.setAttribute('role', isError ? 'alert' : 'status');
  statusEl.setAttribute('aria-live', isError ? 'assertive' : 'polite');

  if (globalErrorAnnouncer) {
    if (isError && message) {
      globalErrorAnnouncer.textContent = message;
    } else if (!message) {
      globalErrorAnnouncer.textContent = '';
    }
  }

  clearStatusTimer();

  if (message && !isError && !persist) {
    statusTimeoutId = setTimeout(() => {
      statusEl.textContent = '';
      statusEl.hidden = true;
      statusEl.dataset.statusType = '';
      statusTimeoutId = null;
    }, 2000);
  }
}

function announceGlobalError(message) {
  if (!message) {
    return;
  }
  setStatus(message, true, { persist: true });
  stateMachine.setError(message);
}

function lockField(fieldName, { saved = false } = {}) {
  const field = fieldElements[fieldName];

  if (!field) {
    return;
  }

  updateFieldState(fieldName, { saved, editing: false, locked: true });

  if (fieldName === 'userId') {
    field.readOnly = true;
  }
  field.disabled = true;

  const savedIcon = savedIcons[fieldName];
  const editIcon = editIcons[fieldName];

  if (savedIcon) {
    savedIcon.hidden = !saved;
  }
  if (editIcon) {
    editIcon.hidden = false;
  }

  updateSubmitButton();
}

function unlockField(fieldName) {
  const field = fieldElements[fieldName];

  if (!field) {
    return;
  }

  updateFieldState(fieldName, { saved: false, editing: true, locked: false });

  if (fieldName === 'userId') {
    field.readOnly = false;
  }
  field.disabled = false;

  const savedIcon = savedIcons[fieldName];
  const editIcon = editIcons[fieldName];

  if (savedIcon) {
    savedIcon.hidden = true;
  }
  if (editIcon) {
    editIcon.hidden = true;
  }

  if (fieldName === 'userId') {
    field.focus();
    field.select();
  } else if (fieldName === 'appId') {
    field.focus();
  }

  updateSubmitButton();
}

function resetAssignmentDropdown(message) {
  assignmentEl.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = message;
  assignmentEl.appendChild(option);
  assignmentEl.value = '';
}

function setAssignmentPlaceholder(message) {
  resetAssignmentDropdown(message);
}

function toggleAssignmentLoading(isLoading) {
  if (assignmentLoadingEl) {
    assignmentLoadingEl.hidden = !isLoading;
  }
  assignmentEl.classList.toggle('loading', isLoading);
  assignmentEl.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

function hideNewAssignmentInput() {
  if (newAssignmentContainer) {
    newAssignmentContainer.hidden = true;
  }
  if (newAssignmentInput) {
    newAssignmentInput.value = '';
  }
  setAssignmentNameFeedback('');
}

function resetAppField() {
  hideNewAssignmentInput();
  toggleAssignmentLoading(false);
  resetAssignmentDropdown('Save User ID first');
  assignmentEl.disabled = true;
  updateFieldState('appId', { saved: false, editing: false, locked: true });
  if (appIdSavedIcon) {
    appIdSavedIcon.hidden = true;
  }
  if (appIdEditIcon) {
    appIdEditIcon.hidden = true;
  }

  updateSubmitButton();
}

function validateAssignmentName(name) {
  const rawName = name ?? '';
  const trimmedName = rawName.trim();

  if (!trimmedName) {
    return { valid: false, message: 'Enter an app ID to continue.', normalizedName: '' };
  }

  if (/\s/.test(rawName)) {
    return { valid: false, message: 'App ID cannot contain spaces.', normalizedName: '' };
  }

  if (!/^[A-Za-z0-9]+$/.test(trimmedName)) {
    return { valid: false, message: 'App ID must be alphanumeric.', normalizedName: '' };
  }

  if (!APP_ID_PATTERN.test(trimmedName)) {
    return {
      valid: false,
      message: 'App ID must be at least 8 characters.',
      normalizedName: ''
    };
  }

  return { valid: true, message: '', normalizedName: trimmedName };
}

function setAssignmentNameFeedback(message = '') {
  if (!newAssignmentFeedback) {
    return;
  }

  if (message) {
    newAssignmentFeedback.textContent = message;
    newAssignmentFeedback.hidden = false;
    newAssignmentInput?.setAttribute('aria-invalid', 'true');
  } else {
    newAssignmentFeedback.textContent = '';
    newAssignmentFeedback.hidden = true;
    newAssignmentInput?.setAttribute('aria-invalid', 'false');
  }
}

function extractErrorMessage(error) {
  if (!error) {
    return '';
  }

  const baseMessage = typeof error === 'string' ? error : error.message;
  if (!baseMessage) {
    return '';
  }

  const trimmedMessage = baseMessage.trim();

  if (!trimmedMessage) {
    return '';
  }

  if (trimmedMessage.startsWith('{') || trimmedMessage.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmedMessage);
      if (typeof parsed === 'string') {
        return parsed;
      }
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
      if (parsed?.detail) {
        return parsed.detail;
      }
      if (parsed?.message) {
        return parsed.message;
      }
    } catch (parseError) {
      console.warn('Unable to parse error message JSON', parseError);
    }
  }

  return trimmedMessage;
}

function getFriendlyErrorMessage(error, fallback) {
  if (error instanceof TypeError || error?.message?.includes('Failed to fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  const extracted = extractErrorMessage(error);
  if (extracted) {
    return extracted;
  }

  return fallback;
}

function updateSubmitButton() {
  if (!submitBtn) {
    return;
  }

  const { context } = stateMachine.getState();
  const userFieldState = context.fields.userId;
  const appFieldState = context.fields.appId;

  if (isSubmitting || context.isBusy) {
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    submitBtn.classList.remove('saved');
    return;
  }

  const userIdValue = userIdEl.value.trim();
  const selectedAssignment = assignmentEl.value;
  const isAddingNewAssignment = selectedAssignment === ADD_NEW_ASSIGNMENT_OPTION;
  const { valid: newAssignmentValid } = validateAssignmentName(newAssignmentInput?.value ?? '');

  const allSaved = userFieldState.saved && appFieldState.saved;

  if (allSaved) {
    submitBtn.textContent = 'Saved ✅';
    submitBtn.disabled = true;
    submitBtn.classList.add('saved');
    return;
  }

  submitBtn.classList.remove('saved');

  const hasAppSelection = Boolean(selectedAssignment) && selectedAssignment !== ADD_NEW_ASSIGNMENT_OPTION;
  const needsUserIdSave = !userFieldState.saved;
  const needsAppIdSave =
    !appFieldState.saved &&
    (selectedAssignment === ADD_NEW_ASSIGNMENT_OPTION || hasAppSelection || (!assignmentEl.disabled && assignmentEl.options.length > 0));

  const hasWorkToDo = needsUserIdSave || needsAppIdSave;

  const userReady = !needsUserIdSave || Boolean(userIdValue);
  let appReady = true;
  if (needsAppIdSave) {
    appReady = isAddingNewAssignment ? newAssignmentValid : hasAppSelection;
  }

  submitBtn.textContent = hasWorkToDo ? 'Submit' : 'Complete Setup';
  submitBtn.disabled = !(hasWorkToDo && userReady && appReady);
}

function ensureAppFieldEditable() {
  assignmentEl.disabled = false;
  updateFieldState('appId', { editing: true, locked: false });
  if (appIdSavedIcon) {
    appIdSavedIcon.hidden = true;
  }
  if (appIdEditIcon) {
    appIdEditIcon.hidden = true;
  }
  updateSubmitButton();
}

const loadAppIds = (() => {
  const performLoad = async (selectedAppId = '', { userIdOverride, silent = false } = {}) => {
    const environment = envEl.value;
    const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
    const activeUserId = (userIdOverride ?? userIdEl.value ?? '').trim();

    hideNewAssignmentInput();
    updateFieldState('appId', { saved: false });

    if (!activeUserId) {
      resetAppField();
      if (!silent) {
        setStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
      }
      updateSubmitButton();
      return [];
    }

    const operationKey = 'load-app-ids';
    stateMachine.beginOperation(operationKey);
    toggleAssignmentLoading(true);
    assignmentEl.disabled = true;
    updateFieldState('appId', { editing: false, locked: true });
    updateSubmitButton();

    let loaded = false;

    try {
      const response = await retryAsync(() => apiClient.fetchUserAppIds(baseUrl, activeUserId));
      const rawAppIds = Array.isArray(response)
        ? response
        : Array.isArray(response?.app_ids)
          ? response.app_ids
          : [];

      const seen = new Set();
      const appIds = [];
      rawAppIds.forEach(item => {
        if (typeof item !== 'string') {
          return;
        }
        const trimmed = item.trim();
        if (!trimmed || seen.has(trimmed)) {
          return;
        }
        seen.add(trimmed);
        appIds.push(trimmed);
      });

      assignmentEl.innerHTML = '';

      if (appIds.length) {
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Choose app ID...';
        assignmentEl.appendChild(placeholderOption);
      } else {
        setAssignmentPlaceholder('No app IDs found. Create a new one to get started.');
      }

      appIds.forEach(appId => {
        const option = document.createElement('option');
        option.value = appId;
        option.textContent = appId;
        assignmentEl.appendChild(option);
      });

      const addOption = document.createElement('option');
      addOption.value = ADD_NEW_ASSIGNMENT_OPTION;
      addOption.textContent = 'Add New App ID';
      assignmentEl.appendChild(addOption);

      if (selectedAppId) {
        const normalized = String(selectedAppId);
        if (appIds.includes(normalized)) {
          assignmentEl.value = normalized;
        } else {
          assignmentEl.value = '';
          if (!silent) {
            const unavailableMessage = 'Saved app ID is unavailable. Please choose another app ID.';
            setStatus(unavailableMessage, true, { persist: true });
            stateMachine.setError(unavailableMessage);
          }
        }
      } else {
        assignmentEl.value = '';
      }

      loaded = true;
      lastLoadedUserId = activeUserId;

      if (!silent) {
        setStatus(`Loaded ${appIds.length} app ID${appIds.length === 1 ? '' : 's'}`);
      }

      ensureAppFieldEditable();
      stateMachine.clearError();
      return appIds;
    } catch (error) {
      console.error('Failed to load app IDs', error);
      setAssignmentPlaceholder('Choose app ID...');
      const message = getFriendlyErrorMessage(error, 'Unable to load app IDs. Please try again.');
      if (!silent) {
        setStatus(message, true, { persist: true });
      }
      stateMachine.setError(message);
      return [];
    } finally {
      toggleAssignmentLoading(false);
      assignmentEl.disabled = !loaded;
      if (!loaded) {
        updateFieldState('appId', { editing: false, locked: true });
      } else {
        updateFieldState('appId', { editing: true, locked: false });
      }
      updateSubmitButton();
      stateMachine.endOperation(operationKey);
    }
  };

  const debouncedLoader = createDebouncedAsync((selectedAppId, options) => performLoad(selectedAppId, options), 300);
  registerCleanup(() => debouncedLoader.cancel());

  return (selectedAppId = '', options = {}) => {
    const { debounce = false, ...rest } = options ?? {};
    if (debounce) {
      return debouncedLoader(selectedAppId, rest).catch(error => {
        if (error?.message === DEBOUNCE_CANCELLED_MESSAGE) {
          return [];
        }
        throw error;
      });
    }
    return performLoad(selectedAppId, rest);
  };
})();

async function saveUserId(userId, { appIdForSettings = '' } = {}) {
  const environment = envEl.value;
  const operationKey = 'save-user';

  stateMachine.beginOperation(operationKey);

  try {
    await retryAsync(() => setSettings({ environment, userId, appId: appIdForSettings }));
    lockField('userId', { saved: true });
    const shouldReload = lastLoadedUserId !== userId;
    lastLoadedUserId = userId;
    if (shouldReload) {
      await loadAppIds(appIdForSettings, { userIdOverride: userId, silent: true });
    }
    const successMessage = appIdForSettings ? 'Settings saved.' : 'User ID saved.';
    setStatus(successMessage);
    updateConnection();
    stateMachine.clearError();
  } catch (error) {
    console.error('Failed to save settings', error);
    const errorMessage = getFriendlyErrorMessage(error, 'Failed to save settings. Please try again.');
    setStatus(errorMessage, true, { persist: true });
    unlockField('userId');
    stateMachine.setError(errorMessage);
    throw error;
  } finally {
    stateMachine.endOperation(operationKey);
  }
}

async function saveAppSelection(appId) {
  const userId = userIdEl.value.trim();
  if (!userId) {
    setStatus(USER_ID_PROMPT_MESSAGE, true, { persist: true });
    return;
  }

  const environment = envEl.value;
  const operationKey = 'save-app';

  stateMachine.beginOperation(operationKey);

  try {
    assignmentEl.value = appId;
    await retryAsync(() => setSettings({ environment, userId, appId }));
    lockField('appId', { saved: true });
    setStatus('App ID saved.');
    stateMachine.clearError();
  } catch (error) {
    console.error('Failed to save app ID', error);
    const message = getFriendlyErrorMessage(error, 'Failed to save app ID. Please try again.');
    setStatus(message, true, { persist: true });
    stateMachine.setError(message);
    throw error;
  } finally {
    stateMachine.endOperation(operationKey);
  }
}

async function createNewApp(desiredAppId) {
  const userId = userIdEl.value.trim();
  if (!userId) {
    setStatus(USER_ID_PROMPT_MESSAGE, true, { persist: true });
    return '';
  }

  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const operationKey = 'create-app';

  stateMachine.beginOperation(operationKey);

  try {
    setAssignmentNameFeedback('');
    setStatus('Creating app ID...', false, { persist: true });

    const createdAssignment = await retryAsync(() => apiClient.createAssignment(baseUrl, {
      appid: desiredAppId
    }));

    const createdAssignmentId = createdAssignment?.id ? String(createdAssignment.id) : '';
    const createdAssignmentAppId = APP_ID_PATTERN.test(createdAssignment?.app_id ?? '')
      ? createdAssignment.app_id
      : desiredAppId;
    const createdAssignmentName = createdAssignment?.name ?? desiredAppId;

    hideNewAssignmentInput();

    const preferredSelection = createdAssignmentAppId || createdAssignmentId;
    await loadAppIds(preferredSelection, { userIdOverride: userId });

    const optionValues = Array.from(assignmentEl.options)
      .map(option => option.value)
      .filter(value => value && value !== ADD_NEW_ASSIGNMENT_OPTION);

    let appIdToSave =
      createdAssignmentAppId && optionValues.includes(createdAssignmentAppId)
        ? createdAssignmentAppId
        : '';

    if (!appIdToSave && preferredSelection && optionValues.includes(preferredSelection)) {
      appIdToSave = preferredSelection;
    }

    if (!appIdToSave) {
      const fallbackName = createdAssignmentName;
      if (fallbackName && optionValues.includes(fallbackName)) {
        appIdToSave = fallbackName;
      }
    }

    if (!appIdToSave) {
      setStatus(
        'App ID created but could not be auto-selected. Please choose it manually.',
        true,
        { persist: true }
      );
      ensureAppFieldEditable();
      return '';
    }

    assignmentEl.value = String(appIdToSave);
    setStatus('App ID created. Save to confirm.');
    stateMachine.clearError();
    return String(appIdToSave);
  } catch (error) {
    console.error('Failed to create app ID', error);
    const message = getFriendlyErrorMessage(error, 'Unable to create app ID. Please try again.');
    setStatus(message, true, { persist: true });
    stateMachine.setError(message);
    throw error;
  } finally {
    stateMachine.endOperation(operationKey);
  }
}

async function updateConnection() {
  connectionEl.textContent = 'Checking...';
  chrome.runtime.sendMessage({ type: 'health-check' }, res => {
    const ok = res?.ok;
    connectionEl.textContent = ok ? 'Connected' : 'Disconnected';
    connectionEl.style.color = ok ? '#198754' : '#d93025';
  });
}

async function init() {
  const { environment, userId, appId } = await getSettings();

  envEl.value = environment;
  userIdEl.value = userId;

  if (userId) {
    lockField('userId', { saved: true });
    const loadedAppIds = await loadAppIds(appId, { silent: true, userIdOverride: userId });

    if (appId) {
      const hasAppId = loadedAppIds.includes(appId);
      if (hasAppId) {
        assignmentEl.value = appId;
        lockField('appId', { saved: true });
      } else if (loadedAppIds.length) {
        ensureAppFieldEditable();
        setStatus('Saved app ID is unavailable. Please choose another app ID.', true, {
          persist: true
        });
      }
    }
  } else {
    unlockField('userId');
    resetAppField();
    setStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
  }

  updateConnection();
  updateSubmitButton();
}

addManagedEventListener(window, 'error', event => {
  const message = getFriendlyErrorMessage(
    event?.error ?? event?.message ?? 'Unexpected error',
    'An unexpected error occurred.'
  );
  announceGlobalError(message);
});

addManagedEventListener(window, 'unhandledrejection', event => {
  const message = getFriendlyErrorMessage(
    event?.reason ?? event,
    'An unexpected error occurred.'
  );
  announceGlobalError(message);
});

addManagedEventListener(window, 'unload', runCleanup);

init();

addManagedEventListener(envEl, 'change', () => {
  hideNewAssignmentInput();
  const activeUserId = userIdEl.value.trim();

  const previousAppState = getFieldState('appId');
  updateFieldState('appId', { saved: false });

  const userFieldState = getFieldState('userId');

  if (activeUserId && userFieldState.saved) {
    const initialSelection = previousAppState.saved ? assignmentEl.value : '';
    loadAppIds(initialSelection, {
      userIdOverride: activeUserId,
      silent: true,
      debounce: true
    });
  } else {
    resetAppField();
    setStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
  }

  updateSubmitButton();
});

addManagedEventListener(userIdEl, 'input', () => {
  updateFieldState('userId', { saved: false, editing: true, locked: false });
  if (userIdSavedIcon) {
    userIdSavedIcon.hidden = true;
  }
  if (userIdEditIcon) {
    userIdEditIcon.hidden = true;
  }
  resetAppField();
  lastLoadedUserId = '';
  updateSubmitButton();
});

addManagedEventListener(userIdEl, 'blur', async () => {
  const value = userIdEl.value.trim();
  if (!value) {
    resetAppField();
    updateSubmitButton();
    return;
  }

  const currentUserState = getFieldState('userId');
  lockField('userId', { saved: currentUserState.saved });

  if (value !== lastLoadedUserId) {
    const appState = getFieldState('appId');
    await loadAppIds(appState.saved ? assignmentEl.value : '', {
      userIdOverride: value,
      debounce: true
    });
  }
});

addManagedEventListener(assignmentEl, 'change', () => {
  const selectedValue = assignmentEl.value;
  const isAddingNewAssignment = selectedValue === ADD_NEW_ASSIGNMENT_OPTION;

  updateFieldState('appId', { saved: false });

  if (isAddingNewAssignment) {
    ensureAppFieldEditable();
    if (newAssignmentContainer) {
      newAssignmentContainer.hidden = false;
    }
    if (newAssignmentInput) {
      newAssignmentInput.focus();
    }
  } else {
    hideNewAssignmentInput();

    if (selectedValue) {
      lockField('appId', { saved: false });
    } else {
      ensureAppFieldEditable();
    }
  }

  if (statusEl?.dataset?.statusType === 'error' && statusEl.textContent) {
    setStatus('');
  }

  updateSubmitButton();
});

if (newAssignmentInput) {
  addManagedEventListener(newAssignmentInput, 'input', () => {
    if (assignmentEl.value === ADD_NEW_ASSIGNMENT_OPTION) {
      const { message } = validateAssignmentName(newAssignmentInput.value ?? '');
      setAssignmentNameFeedback(message);
    } else {
      setAssignmentNameFeedback('');
    }

    updateSubmitButton();
  });
}

userIdEditIcon?.setAttribute('role', 'button');
userIdEditIcon?.setAttribute('tabindex', '0');

function handleIconActivation(handler) {
  return event => {
    if (event.type === 'keydown') {
      const key = event.key;
      if (key !== 'Enter' && key !== ' ') {
        return;
      }
      event.preventDefault();
    }
    handler();
  };
}

if (userIdEditIcon) {
  const handleUserEdit = () => {
    const confirmed = window.confirm(
      'Editing your User ID will clear the current app selection until it is saved again. Continue?'
    );
    if (!confirmed) {
      return;
    }
    unlockField('userId');
    resetAppField();
    setStatus('');
  };

  addManagedEventListener(userIdEditIcon, 'click', handleIconActivation(handleUserEdit));
  addManagedEventListener(userIdEditIcon, 'keydown', handleIconActivation(handleUserEdit));
}

if (appIdEditIcon) {
  const handleAppEdit = () => {
    if (assignmentEl.options.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      'Editing the App ID will require selecting or creating a new app before saving. Continue?'
    );
    if (!confirmed) {
      return;
    }
    unlockField('appId');
    hideNewAssignmentInput();
    updateSubmitButton();
  };

  addManagedEventListener(appIdEditIcon, 'click', handleIconActivation(handleAppEdit));
  addManagedEventListener(appIdEditIcon, 'keydown', handleIconActivation(handleAppEdit));
}

addManagedEventListener(submitBtn, 'click', async () => {
  if (submitBtn.disabled || isSubmitting) {
    return;
  }

  const userId = userIdEl.value.trim();
  const selectedAssignment = assignmentEl.value;
  const isAddingNewAssignment = selectedAssignment === ADD_NEW_ASSIGNMENT_OPTION;
  const userFieldState = getFieldState('userId');
  const appFieldState = getFieldState('appId');

  if (!userId) {
    setStatus(USER_ID_PROMPT_MESSAGE, true, { persist: true });
    updateSubmitButton();
    return;
  }

  isSubmitting = true;
  updateSubmitButton();

  try {
    let savedAppId = appFieldState.saved ? assignmentEl.value : '';
    if (savedAppId === ADD_NEW_ASSIGNMENT_OPTION) {
      savedAppId = '';
    }

    await withSettingsTransaction(async () => {
      if (!userFieldState.saved) {
        await saveUserId(userId, { appIdForSettings: savedAppId });
      }

      if (!appFieldState.saved) {
        let appIdToPersist = savedAppId;

        if (isAddingNewAssignment) {
          const { valid, message, normalizedName } = validateAssignmentName(
            newAssignmentInput?.value ?? ''
          );

          if (!valid) {
            setAssignmentNameFeedback(message);
            setStatus(message, true, { persist: true });
            throw new Error(message);
          }

          const createdAppId = await createNewApp(normalizedName);
          if (!createdAppId) {
            return;
          }

          appIdToPersist = createdAppId;
        } else if (selectedAssignment) {
          appIdToPersist = selectedAssignment;
        }

        if (appIdToPersist) {
          assignmentEl.value = appIdToPersist;
          await saveAppSelection(appIdToPersist);
          if (isAddingNewAssignment) {
            setStatus('App ID created and saved.');
          }
        } else {
          ensureAppFieldEditable();
        }
      }
    });

    updateSubmitButton();
  } catch (error) {
    console.error('Submit failed', error);
    await init();
  } finally {
    isSubmitting = false;
    updateSubmitButton();
  }
});
