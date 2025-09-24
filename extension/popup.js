import { ENVIRONMENTS, getSettings, setSettings } from './config.js';
import { apiClient } from './api.js';

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

const userIdSavedIcon = document.getElementById('userId-saved');
const userIdEditIcon = document.getElementById('userId-edit');
const appIdSavedIcon = document.getElementById('appId-saved');
const appIdEditIcon = document.getElementById('appId-edit');

const ADD_NEW_ASSIGNMENT_OPTION = '__add_new_assignment__';
const USER_ID_PROMPT_MESSAGE = 'Enter your User ID first, then save to load available App IDs.';
const APP_ID_PATTERN = /^[A-Za-z0-9]{8,}$/;

const fieldStates = {
  userId: { saved: false, editing: true },
  appId: { saved: false, editing: false }
};

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

function lockField(fieldName, { saved = false } = {}) {
  const state = fieldStates[fieldName];
  const field = fieldElements[fieldName];

  if (!state || !field) {
    return;
  }

  state.saved = saved;
  state.editing = false;

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
  const state = fieldStates[fieldName];
  const field = fieldElements[fieldName];

  if (!state || !field) {
    return;
  }

  state.saved = false;
  state.editing = true;

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
  fieldStates.appId.saved = false;
  fieldStates.appId.editing = false;
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
  } else {
    newAssignmentFeedback.textContent = '';
    newAssignmentFeedback.hidden = true;
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

  const allSaved = fieldStates.userId.saved && fieldStates.appId.saved;

  if (allSaved) {
    submitBtn.textContent = 'Saved ✅';
    submitBtn.disabled = true;
    submitBtn.classList.add('saved');
    return;
  }

  submitBtn.classList.remove('saved');

  const hasAppSelection = Boolean(selectedAssignment) && selectedAssignment !== ADD_NEW_ASSIGNMENT_OPTION;
  const needsUserIdSave = !fieldStates.userId.saved;
  const needsAppIdSave =
    !fieldStates.appId.saved &&
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
  fieldStates.appId.editing = true;
  if (appIdSavedIcon) {
    appIdSavedIcon.hidden = true;
  }
  if (appIdEditIcon) {
    appIdEditIcon.hidden = true;
  }
  updateSubmitButton();
}

async function loadAppIds(selectedAppId = '', { userIdOverride, silent = false } = {}) {
  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const activeUserId = (userIdOverride ?? userIdEl.value ?? '').trim();

  hideNewAssignmentInput();
  fieldStates.appId.saved = false;

  if (!activeUserId) {
    resetAppField();
    if (!silent) {
      setStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
    }
    updateSubmitButton();
    return [];
  }

  toggleAssignmentLoading(true);
  assignmentEl.disabled = true;
  fieldStates.appId.editing = false;
  updateSubmitButton();

  let loaded = false;

  try {
    const response = await apiClient.fetchUserAppIds(baseUrl, activeUserId);
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
    return appIds;
  } catch (error) {
    console.error('Failed to load app IDs', error);
    setAssignmentPlaceholder('Choose app ID...');
    const message = getFriendlyErrorMessage(error, 'Unable to load app IDs. Please try again.');
    if (!silent) {
      setStatus(message, true, { persist: true });
    }
    return [];
  } finally {
    toggleAssignmentLoading(false);
    assignmentEl.disabled = !loaded;
    if (!loaded) {
      fieldStates.appId.editing = false;
    }
    updateSubmitButton();
  }
}

async function saveUserId(userId, { appIdForSettings = '' } = {}) {
  const environment = envEl.value;

  try {
    await setSettings({ environment, userId, appId: appIdForSettings });
    lockField('userId', { saved: true });
    const shouldReload = lastLoadedUserId !== userId;
    lastLoadedUserId = userId;
    if (shouldReload) {
      await loadAppIds(appIdForSettings, { userIdOverride: userId, silent: true });
    }
    const successMessage = appIdForSettings ? 'Settings saved.' : 'User ID saved.';
    setStatus(successMessage);
    updateConnection();
  } catch (error) {
    console.error('Failed to save settings', error);
    const errorMessage = getFriendlyErrorMessage(error, 'Failed to save settings. Please try again.');
    setStatus(errorMessage, true, { persist: true });
    unlockField('userId');
    throw error;
  }
}

async function saveAppSelection(appId) {
  const userId = userIdEl.value.trim();
  if (!userId) {
    setStatus(USER_ID_PROMPT_MESSAGE, true, { persist: true });
    return;
  }

  const environment = envEl.value;

  try {
    assignmentEl.value = appId;
    await setSettings({ environment, userId, appId });
    lockField('appId', { saved: true });
    setStatus('App ID saved.');
  } catch (error) {
    console.error('Failed to save app ID', error);
    const message = getFriendlyErrorMessage(error, 'Failed to save app ID. Please try again.');
    setStatus(message, true, { persist: true });
    throw error;
  }
}

async function createNewApp(desiredAppId) {
  const userId = userIdEl.value.trim();
  if (!userId) {
    setStatus(USER_ID_PROMPT_MESSAGE, true, { persist: true });
    return;
  }

  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;

  try {
    setAssignmentNameFeedback('');
    setStatus('Creating app ID...', false, { persist: true });

    const createdAssignment = await apiClient.createAssignment(baseUrl, {
      appid: desiredAppId
    });

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
      return;
    }

    assignmentEl.value = String(appIdToSave);
    await saveAppSelection(String(appIdToSave));
    setStatus('App ID created and saved.');
  } catch (error) {
    console.error('Failed to create app ID', error);
    const message = getFriendlyErrorMessage(error, 'Unable to create app ID. Please try again.');
    setStatus(message, true, { persist: true });
    throw error;
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

init();

envEl.addEventListener('change', () => {
  hideNewAssignmentInput();
  const activeUserId = userIdEl.value.trim();

  fieldStates.appId.saved = false;

  if (activeUserId && fieldStates.userId.saved) {
    loadAppIds(fieldStates.appId.saved ? assignmentEl.value : '', {
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
  fieldStates.userId.saved = false;
  fieldStates.userId.editing = true;
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

userIdEl.addEventListener('blur', async () => {
  const value = userIdEl.value.trim();
  if (!value) {
    resetAppField();
    updateSubmitButton();
    return;
  }

  lockField('userId', { saved: fieldStates.userId.saved });

  if (value !== lastLoadedUserId) {
    await loadAppIds(fieldStates.appId.saved ? assignmentEl.value : '', {
      userIdOverride: value
    });
  }
});

assignmentEl.addEventListener('change', () => {
  const selectedValue = assignmentEl.value;
  const isAddingNewAssignment = selectedValue === ADD_NEW_ASSIGNMENT_OPTION;

  fieldStates.appId.saved = false;

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

userIdEditIcon?.addEventListener('click', () => {
  unlockField('userId');
  resetAppField();
  setStatus('');
});

appIdEditIcon?.addEventListener('click', () => {
  if (assignmentEl.options.length === 0) {
    return;
  }
  unlockField('appId');
  hideNewAssignmentInput();
  updateSubmitButton();
});

submitBtn.addEventListener('click', async () => {
  if (submitBtn.disabled || isSubmitting) {
    return;
  }

  const userId = userIdEl.value.trim();
  const selectedAssignment = assignmentEl.value;
  const isAddingNewAssignment = selectedAssignment === ADD_NEW_ASSIGNMENT_OPTION;

  if (!userId) {
    setStatus(USER_ID_PROMPT_MESSAGE, true, { persist: true });
    updateSubmitButton();
    return;
  }

  isSubmitting = true;
  updateSubmitButton();

  try {
    let savedAppId = fieldStates.appId.saved ? assignmentEl.value : '';
    if (savedAppId === ADD_NEW_ASSIGNMENT_OPTION) {
      savedAppId = '';
    }

    if (!fieldStates.userId.saved) {
      await saveUserId(userId, { appIdForSettings: savedAppId });
    }

    if (!fieldStates.appId.saved) {
      if (isAddingNewAssignment) {
        const { valid, message, normalizedName } = validateAssignmentName(
          newAssignmentInput?.value ?? ''
        );

        if (!valid) {
          setAssignmentNameFeedback(message);
          setStatus(message, true, { persist: true });
          throw new Error(message);
        }

        await createNewApp(normalizedName);
      } else if (selectedAssignment) {
        assignmentEl.value = selectedAssignment;
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
