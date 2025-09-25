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

const ADD_NEW_ASSIGNMENT_OPTION = '__add_new_assignment__';
const USER_ID_PROMPT_MESSAGE = 'Enter your User ID first, then save to load available App IDs.';
const APP_ID_PATTERN = /^[A-Za-z0-9]{8,}$/;
const USER_ID_PATTERN = /^[A-Za-z0-9._-]{4,}$/;

const formState = {
  busy: false,
  busyReason: '',
  error: '',
  fields: {
    userId: { saved: false, editing: true },
    appId: { saved: false, editing: false }
  }
};

const busyOperations = new Set();
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

let statusTimeoutId = null;
let lastLoadedUserId = '';
let isSubmitting = false;
let loadRequestToken = 0;
let scheduledLoadTimer = null;

function wait(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function runWithRetry(fn, { retries = 2, baseDelay = 200 } = {}) {
  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await wait(baseDelay * (attempt + 1));
      attempt += 1;
    }
  }
  throw lastError;
}

function updateBusyState() {
  const isBusy = busyOperations.size > 0;
  const activeReason = isBusy ? Array.from(busyOperations).at(-1) ?? '' : '';

  if (formState.busy === isBusy && formState.busyReason === activeReason) {
    return;
  }

  formState.busy = isBusy;
  formState.busyReason = activeReason;

  popupRootEl?.setAttribute('aria-busy', isBusy ? 'true' : 'false');

  if (interactionGuardEl) {
    const shouldHide = !isBusy;
    if (interactionGuardEl.hidden !== shouldHide) {
      interactionGuardEl.hidden = shouldHide;
    }
    interactionGuardEl.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
  }
}

function beginBusy(key) {
  busyOperations.add(key);
  updateBusyState();
}

function endBusy(key) {
  busyOperations.delete(key);
  updateBusyState();
}

function clearStatusTimer() {
  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
    statusTimeoutId = null;
  }
}

function setStatus(message, isError = false, { persist = false } = {}) {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.style.color = isError ? '#d93025' : '#198754';
  statusEl.hidden = !message;
  statusEl.dataset.statusType = isError ? 'error' : message ? 'success' : '';
  statusEl.setAttribute('role', isError ? 'alert' : 'status');
  statusEl.setAttribute('aria-live', isError ? 'assertive' : 'polite');

  if (globalErrorAnnouncer) {
    globalErrorAnnouncer.textContent = isError ? message : '';
  }

  clearStatusTimer();

  if (message && !isError && !persist) {
    statusTimeoutId = setTimeout(() => {
      if (statusEl.dataset.statusType !== 'error') {
        statusEl.textContent = '';
        statusEl.hidden = true;
        statusEl.dataset.statusType = '';
      }
      statusTimeoutId = null;
    }, 2000);
  }
}

function setError(message) {
  formState.error = message;
  if (message) {
    setStatus(message, true, { persist: true });
  } else if (statusEl?.dataset?.statusType === 'error') {
    setStatus('');
  }
}

function setFieldState(fieldName, updates) {
  if (!formState.fields[fieldName]) {
    return;
  }
  formState.fields[fieldName] = {
    ...formState.fields[fieldName],
    ...updates
  };
}

function lockField(fieldName, { saved = false } = {}) {
  const field = fieldElements[fieldName];
  if (!field) {
    return;
  }

  setFieldState(fieldName, { saved, editing: false });

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

  setFieldState(fieldName, { saved: false, editing: true });

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
  if (!assignmentEl) {
    return;
  }
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
  assignmentEl?.classList.toggle('loading', isLoading);
  assignmentEl?.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

function hideNewAssignmentInput() {
  if (newAssignmentContainer) {
    newAssignmentContainer.hidden = true;
  }
  if (newAssignmentInput) {
    newAssignmentInput.value = '';
    newAssignmentInput.setAttribute('aria-invalid', 'false');
  }
  setAssignmentNameFeedback('');
}

function resetAppField() {
  hideNewAssignmentInput();
  toggleAssignmentLoading(false);
  setFieldState('appId', { saved: false, editing: false });
  resetAssignmentDropdown('Save User ID first');
  if (assignmentEl) {
    assignmentEl.disabled = true;
  }
  if (appIdSavedIcon) {
    appIdSavedIcon.hidden = true;
  }
  if (appIdEditIcon) {
    appIdEditIcon.hidden = true;
  }
  updateSubmitButton();
}

function ensureAppFieldEditable() {
  if (!assignmentEl) {
    return;
  }
  assignmentEl.disabled = false;
  setFieldState('appId', { editing: true });
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

function validateUserId(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return { valid: false, message: 'User ID is required.' };
  }
  if (!USER_ID_PATTERN.test(trimmed)) {
    return {
      valid: false,
      message: 'User ID must be 4+ characters using letters, numbers, dots, underscores, or hyphens.'
    };
  }
  return { valid: true, message: '', normalized: trimmed };
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

  if (isSubmitting) {
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    submitBtn.classList.remove('saved');
    return;
  }

  const userIdValue = userIdEl.value.trim();
  const selectedAssignment = assignmentEl.value;
  const isAddingNewAssignment = selectedAssignment === ADD_NEW_ASSIGNMENT_OPTION;
  const { valid: newAssignmentValid } = validateAssignmentName(newAssignmentInput?.value ?? '');

  const allSaved = formState.fields.userId.saved && formState.fields.appId.saved;

  if (allSaved) {
    submitBtn.textContent = 'Saved ✅';
    submitBtn.disabled = true;
    submitBtn.classList.add('saved');
    return;
  }

  submitBtn.classList.remove('saved');

  const hasAppSelection = Boolean(selectedAssignment) && selectedAssignment !== ADD_NEW_ASSIGNMENT_OPTION;
  const needsUserIdSave = !formState.fields.userId.saved;
  const needsAppIdSave =
    !formState.fields.appId.saved &&
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

async function loadAppIds(selectedAppId = '', { userIdOverride, silent = false } = {}) {
  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const activeUserId = (userIdOverride ?? userIdEl.value ?? '').trim();
  const requestToken = ++loadRequestToken;
  const busyKey = `load-apps-${requestToken}`;

  hideNewAssignmentInput();
  setFieldState('appId', { saved: false });

  if (!activeUserId) {
    resetAppField();
    if (!silent) {
      setStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
    }
    updateSubmitButton();
    return [];
  }

  beginBusy(busyKey);
  toggleAssignmentLoading(true);
  assignmentEl.disabled = true;
  setFieldState('appId', { editing: false });
  updateSubmitButton();

  let loaded = false;

  try {
    const response = await runWithRetry(() => apiClient.fetchUserAppIds(baseUrl, activeUserId));
    if (requestToken !== loadRequestToken) {
      return [];
    }

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
          setStatus('Saved app ID is unavailable. Please choose another app ID.', true, {
            persist: true
          });
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
    setError('');
    return appIds;
  } catch (error) {
    console.error('Failed to load app IDs', error);
    setAssignmentPlaceholder('Choose app ID...');
    const message = getFriendlyErrorMessage(error, 'Unable to load app IDs. Please try again.');
    if (!silent) {
      setError(message);
    }
    return [];
  } finally {
    toggleAssignmentLoading(false);
    assignmentEl.disabled = !loaded;
    if (!loaded) {
      setFieldState('appId', { editing: false });
    } else {
      setFieldState('appId', { editing: true });
    }
    updateSubmitButton();
    endBusy(busyKey);
  }
}

function scheduleAppIdLoad(selectedAppId = '', options = {}) {
  if (scheduledLoadTimer) {
    clearTimeout(scheduledLoadTimer);
  }
  scheduledLoadTimer = setTimeout(() => {
    loadAppIds(selectedAppId, options);
    scheduledLoadTimer = null;
  }, 250);
}

async function saveUserId(userId, { appIdForSettings = '' } = {}) {
  const environment = envEl.value;
  const busyKey = 'save-user';

  beginBusy(busyKey);

  try {
    await runWithRetry(() => setSettings({ environment, userId, appId: appIdForSettings }));
    lockField('userId', { saved: true });
    const shouldReload = lastLoadedUserId !== userId;
    lastLoadedUserId = userId;
    if (shouldReload) {
      await loadAppIds(appIdForSettings, { userIdOverride: userId, silent: true });
    }
    const successMessage = appIdForSettings ? 'Settings saved.' : 'User ID saved.';
    setStatus(successMessage);
    setError('');
    updateConnection();
  } catch (error) {
    console.error('Failed to save settings', error);
    const errorMessage = getFriendlyErrorMessage(error, 'Failed to save settings. Please try again.');
    unlockField('userId');
    setError(errorMessage);
    throw error;
  } finally {
    endBusy(busyKey);
  }
}

async function saveAppSelection(appId) {
  const { valid, message, normalized } = validateUserId(userIdEl.value);
  if (!valid) {
    setError(message);
    return;
  }

  const environment = envEl.value;
  const busyKey = 'save-app';

  beginBusy(busyKey);

  try {
    assignmentEl.value = appId;
    await runWithRetry(() => setSettings({ environment, userId: normalized, appId }));
    lockField('appId', { saved: true });
    setStatus('App ID saved.');
    setError('');
  } catch (error) {
    console.error('Failed to save app ID', error);
    const message = getFriendlyErrorMessage(error, 'Failed to save app ID. Please try again.');
    setError(message);
    throw error;
  } finally {
    endBusy(busyKey);
  }
}

async function createNewApp(desiredAppId) {
  const { valid, message, normalized } = validateUserId(userIdEl.value);
  if (!valid) {
    setError(message);
    return '';
  }

  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const busyKey = 'create-app';

  beginBusy(busyKey);

  try {
    setAssignmentNameFeedback('');
    setStatus('Creating app ID...', false, { persist: true });

    const createdAssignment = await runWithRetry(() =>
      apiClient.createAssignment(baseUrl, {
        app_id: desiredAppId,
        user_id: normalized
      })
    );

    const createdAssignmentId = createdAssignment?.id ? String(createdAssignment.id) : '';
    const createdAssignmentAppId = APP_ID_PATTERN.test(createdAssignment?.app_id ?? '')
      ? createdAssignment.app_id
      : desiredAppId;
    const createdAssignmentName = createdAssignment?.name ?? desiredAppId;

    hideNewAssignmentInput();

    const preferredSelection = createdAssignmentAppId || createdAssignmentId;
    await loadAppIds(preferredSelection, { userIdOverride: normalized });

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
      setError('App ID created but could not be auto-selected. Please choose it manually.');
      ensureAppFieldEditable();
      return '';
    }

    assignmentEl.value = String(appIdToSave);
    setStatus('App ID created. Save to confirm.');
    setError('');
    return String(appIdToSave);
  } catch (error) {
    console.error('Failed to create app ID', error);
    const message = getFriendlyErrorMessage(error, 'Unable to create app ID. Please try again.');
    setError(message);
    throw error;
  } finally {
    endBusy(busyKey);
  }
}

async function updateConnection() {
  if (!connectionEl) {
    return;
  }
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
        setError('Saved app ID is unavailable. Please choose another app ID.');
      }
    }
  } else {
    unlockField('userId');
    resetAppField();
    setStatus('Enter your User ID to load saved app IDs.', false, { persist: true });
  }

  updateConnection();
  updateSubmitButton();
}

init();

envEl.addEventListener('change', () => {
  hideNewAssignmentInput();
  const activeUserId = userIdEl.value.trim();

  setFieldState('appId', { saved: false });

  if (activeUserId && formState.fields.userId.saved) {
    scheduleAppIdLoad(formState.fields.appId.saved ? assignmentEl.value : '', {
      userIdOverride: activeUserId,
      silent: true
    });
  } else {
    resetAppField();
    setStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
  }

  updateSubmitButton();
});

userIdEl.addEventListener('input', () => {
  setFieldState('userId', { saved: false, editing: true });
  if (userIdSavedIcon) {
    userIdSavedIcon.hidden = true;
  }
  if (userIdEditIcon) {
    userIdEditIcon.hidden = true;
  }
  resetAppField();
  lastLoadedUserId = '';
  setError('');
  updateSubmitButton();
});

userIdEl.addEventListener('blur', async () => {
  const value = userIdEl.value.trim();
  if (!value) {
    resetAppField();
    updateSubmitButton();
    return;
  }

  const { valid, message, normalized } = validateUserId(value);
  if (!valid) {
    setError(message);
    ensureAppFieldEditable();
    return;
  }

  lockField('userId', { saved: formState.fields.userId.saved });

  if (normalized !== lastLoadedUserId) {
    await loadAppIds(formState.fields.appId.saved ? assignmentEl.value : '', {
      userIdOverride: normalized
    });
  }
});

assignmentEl.addEventListener('change', () => {
  const selectedValue = assignmentEl.value;
  const isAddingNewAssignment = selectedValue === ADD_NEW_ASSIGNMENT_OPTION;

  setFieldState('appId', { saved: false });

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

newAssignmentInput?.addEventListener('input', () => {
  if (assignmentEl.value === ADD_NEW_ASSIGNMENT_OPTION) {
    const { message } = validateAssignmentName(newAssignmentInput.value ?? '');
    setAssignmentNameFeedback(message);
  } else {
    setAssignmentNameFeedback('');
  }

  updateSubmitButton();
});

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
    setError('');
  };

  userIdEditIcon.setAttribute('role', 'button');
  userIdEditIcon.setAttribute('tabindex', '0');
  userIdEditIcon.addEventListener('click', handleIconActivation(handleUserEdit));
  userIdEditIcon.addEventListener('keydown', handleIconActivation(handleUserEdit));
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

  appIdEditIcon.setAttribute('role', 'button');
  appIdEditIcon.setAttribute('tabindex', '0');
  appIdEditIcon.addEventListener('click', handleIconActivation(handleAppEdit));
  appIdEditIcon.addEventListener('keydown', handleIconActivation(handleAppEdit));
}

submitBtn.addEventListener('click', async () => {
  if (submitBtn.disabled || isSubmitting) {
    return;
  }

  const userIdValue = userIdEl.value.trim();
  const selectedAssignment = assignmentEl.value;
  const isAddingNewAssignment = selectedAssignment === ADD_NEW_ASSIGNMENT_OPTION;

  const { valid: userValid, message: userMessage, normalized: normalizedUserId } = validateUserId(userIdValue);
  if (!userValid) {
    setError(userMessage);
    updateSubmitButton();
    return;
  }

  isSubmitting = true;
  updateSubmitButton();

  try {
    let savedAppId = formState.fields.appId.saved ? assignmentEl.value : '';
    if (savedAppId === ADD_NEW_ASSIGNMENT_OPTION) {
      savedAppId = '';
    }

    if (!formState.fields.userId.saved) {
      await saveUserId(normalizedUserId, { appIdForSettings: savedAppId });
    }

    if (!formState.fields.appId.saved) {
      if (isAddingNewAssignment) {
        const { valid, message, normalizedName } = validateAssignmentName(newAssignmentInput?.value ?? '');

        if (!valid) {
          setAssignmentNameFeedback(message);
          setError(message);
          throw new Error(message);
        }

        const createdAppId = await createNewApp(normalizedName);
        if (!createdAppId) {
          ensureAppFieldEditable();
          return;
        }

        await saveAppSelection(createdAppId);
        setStatus('App ID created and saved.');
      } else if (selectedAssignment) {
        await saveAppSelection(selectedAssignment);
      }
    }

    updateSubmitButton();
  } catch (error) {
    console.error('Submit failed', error);
  } finally {
    isSubmitting = false;
    updateSubmitButton();
  }
});
