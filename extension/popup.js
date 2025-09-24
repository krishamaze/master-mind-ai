import { ENVIRONMENTS, getSettings, setSettings } from './config.js';
import { apiClient } from './api.js';

const envEl = document.getElementById('environment');
const assignmentEl = document.getElementById('assignment-select');
const assignmentLoadingEl = document.getElementById('assignment-loading');
const userIdEl = document.getElementById('userId');
const statusEl = document.getElementById('status');
const connectionEl = document.getElementById('connection');
const saveButton = document.getElementById('save');
const newAssignmentContainer = document.getElementById('new-assignment-container');
const newAssignmentInput = document.getElementById('new-assignment-name');
const newAssignmentFeedback = document.getElementById('new-assignment-feedback');

const ADD_NEW_ASSIGNMENT_OPTION = '__add_new_assignment__';
const USER_ID_PROMPT_MESSAGE = 'Enter your User ID first, then save to load available App IDs.';
const APP_ID_PATTERN = /^[A-Za-z0-9]{8,}$/;

function isValidAppId(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return APP_ID_PATTERN.test(value);
}

function getAssignmentOptionValue(assignment) {
  if (!assignment) {
    return '';
  }

  const appId = typeof assignment.app_id === 'string' ? assignment.app_id : '';
  if (isValidAppId(appId)) {
    return appId;
  }

  if (assignment.id !== undefined && assignment.id !== null) {
    return String(assignment.id);
  }

  return '';
}

let statusTimeoutId;
let userIdSaved = false;

function resetAssignmentDropdown(message) {
  assignmentEl.innerHTML = '';
  if (message) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = message;
    assignmentEl.appendChild(option);
  }
  assignmentEl.value = '';
}

function showStatus(message, isError = false, { persist = false } = {}) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'red' : 'green';

  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
    statusTimeoutId = null;
  }

  if (message && !isError && !persist) {
    statusTimeoutId = setTimeout(() => {
      statusEl.textContent = '';
      statusTimeoutId = null;
    }, 2000);
  }
}

function setAssignmentPlaceholder(message) {
  resetAssignmentDropdown(message);
}

function toggleAssignmentLoading(isLoading) {
  if (assignmentLoadingEl) {
    assignmentLoadingEl.textContent = 'Loading app IDs...';
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

  if (!/^[A-Za-z0-9]{8,}$/.test(trimmedName)) {
    return {
      valid: false,
      message: 'App ID must be at least 8 characters.',
      normalizedName: ''
    };
  }

  return { valid: true, message: '', normalizedName: trimmedName };
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

function updateSaveButtonState() {
  const userId = userIdEl.value.trim();
  const selectedAssignment = assignmentEl.value;
  const isAddingNewAssignment = selectedAssignment === ADD_NEW_ASSIGNMENT_OPTION;
  const newAssignmentName = newAssignmentInput?.value ?? '';

  if (!userId) {
    saveButton.disabled = true;
    saveButton.textContent = 'Save User ID';
    return;
  }

  if (assignmentEl.disabled) {
    saveButton.disabled = false;
    saveButton.textContent = 'Save User ID';
    return;
  }

  if (isAddingNewAssignment) {
    const { valid, message } = validateAssignmentName(newAssignmentName);
    setAssignmentNameFeedback(message);
    saveButton.disabled = !valid;
    saveButton.textContent = 'Create App ID';
    return;
  }

  if (userIdSaved && !selectedAssignment) {
    setAssignmentNameFeedback('');
    saveButton.disabled = true;
    saveButton.textContent = '✅ User ID Saved';
    return;
  }

  setAssignmentNameFeedback('');
  saveButton.disabled = !selectedAssignment;
  saveButton.textContent = 'Save';
}

async function loadAppIds(selectedAppId = '', { userIdOverride, silent = false } = {}) {
  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const activeUserId = (userIdOverride ?? userIdEl.value ?? '').trim();

  hideNewAssignmentInput();
  assignmentEl.disabled = true;
  resetAssignmentDropdown('Loading app IDs...');

  if (!activeUserId) {
    toggleAssignmentLoading(false);
    setAssignmentPlaceholder('Save user ID to load app IDs');
    if (!silent) {
      showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
    }
    updateSaveButtonState();
    return [];
  }

  toggleAssignmentLoading(true);
  updateSaveButtonState();

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
          showStatus('Saved app ID is unavailable. Please choose another app ID.', true);
        }
      }
    } else {
      assignmentEl.value = '';
    }

    if (!silent) {
      showStatus(`Loaded ${appIds.length} app ID${appIds.length === 1 ? '' : 's'}`);
    }
    loaded = true;
    assignmentEl.disabled = false;
    return appIds;
  } catch (error) {
    console.error('Failed to load app IDs', error);
    setAssignmentPlaceholder('Choose app ID...');
    const message = getFriendlyErrorMessage(error, 'Unable to load app IDs. Please try again.');
    if (!silent) {
      showStatus(message, true, { persist: true });
    }
    return [];
  } finally {
    toggleAssignmentLoading(false);
    assignmentEl.disabled = !loaded;
    updateSaveButtonState();
  }
}

async function updateConnection() {
  connectionEl.textContent = 'Checking...';
  chrome.runtime.sendMessage({ type: 'health-check' }, res => {
    const ok = res?.ok;
    connectionEl.textContent = ok ? 'Connected' : 'Disconnected';
    connectionEl.style.color = ok ? 'green' : 'red';
  });
}

async function init() {
  const { environment, userId, appId } = await getSettings();
  envEl.value = environment;
  userIdEl.value = userId;
  userIdSaved = Boolean(userId);

  if (userId) {
    await loadAppIds(appId, { silent: true });
  } else {
    setAssignmentPlaceholder('Save user ID to load app IDs');
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
  }

  updateConnection();
  updateSaveButtonState();
}

init();

envEl.addEventListener('change', () => {
  hideNewAssignmentInput();

  const selectedAppId =
    assignmentEl.value && assignmentEl.value !== ADD_NEW_ASSIGNMENT_OPTION ? assignmentEl.value : '';
  const activeUserId = userIdEl.value.trim();

  if (activeUserId && userIdSaved) {
    loadAppIds(selectedAppId, { userIdOverride: activeUserId, silent: true });
  } else {
    setAssignmentPlaceholder('Save user ID to load app IDs');
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
    updateSaveButtonState();
  }
});

assignmentEl.addEventListener('change', () => {
  const isAddingNewAssignment = assignmentEl.value === ADD_NEW_ASSIGNMENT_OPTION;

  if (isAddingNewAssignment) {
    if (newAssignmentContainer) {
      newAssignmentContainer.hidden = false;
    }
    if (newAssignmentInput) {
      newAssignmentInput.focus();
    }
  } else {
    if (statusEl.style.color === 'red' && statusEl.textContent) {
      showStatus('');
    }
    hideNewAssignmentInput();
  }

  updateSaveButtonState();
});

saveButton.addEventListener('click', async () => {
  const userId = userIdEl.value.trim();

  if (!userId) {
    updateSaveButtonState();
    return;
  }

  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const selectedAppId = assignmentEl.value;
  const isAddingNewAssignment = selectedAppId === ADD_NEW_ASSIGNMENT_OPTION;

  saveButton.disabled = true;

  try {
    if (assignmentEl.disabled) {
      await setSettings({ environment, userId, appId: '' });
      userIdSaved = true;
      showStatus('User ID saved. Loading app IDs...', false, { persist: true });
      await loadAppIds('', { userIdOverride: userId });
      updateConnection();
      return;
    }

    if (isAddingNewAssignment) {
      const rawAssignmentName = newAssignmentInput?.value ?? '';
      const { valid, message, normalizedName } = validateAssignmentName(rawAssignmentName);
      if (!valid) {
        setAssignmentNameFeedback(message);
        showStatus(message, true, { persist: true });
        return;
      }
      setAssignmentNameFeedback('');
      showStatus('Creating app ID...', false, { persist: true });

      const desiredAppId = normalizedName;
      const createdAssignment = await apiClient.createAssignment(baseUrl, {
        appid: desiredAppId
      });

      const createdAssignmentId = createdAssignment?.id ? String(createdAssignment.id) : '';
      const createdAssignmentAppId = isValidAppId(createdAssignment?.app_id)
        ? createdAssignment.app_id
        : desiredAppId;
      const createdAssignmentName = createdAssignment?.name ?? desiredAppId;
      hideNewAssignmentInput();

      const preferredSelection = createdAssignmentAppId || createdAssignmentId;
      await loadAppIds(preferredSelection, { userIdOverride: userId });

      const optionValues = Array.from(assignmentEl.options)
        .map(option => option.value)
        .filter(value => value && value !== ADD_NEW_ASSIGNMENT_OPTION);

      let appIdToSave = createdAssignmentAppId && optionValues.includes(createdAssignmentAppId)
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

      if (appIdToSave) {
        const normalizedAppId = String(appIdToSave);
        await setSettings({ environment, userId, appId: normalizedAppId });
        assignmentEl.value = normalizedAppId;
        showStatus('App ID created and saved.');
      } else {
        await setSettings({ environment, userId, appId: '' });
        showStatus('App ID created but could not be auto-selected. Please choose it manually.', true, {
          persist: true
        });
        return;
      }

      userIdSaved = true;

      updateConnection();
      return;
    }

    if (!selectedAppId) {
      showStatus('Select an app ID to save.', true);
      return;
    }

    await setSettings({ environment, userId, appId: selectedAppId });
    userIdSaved = true;
    showStatus('Saved');
    updateConnection();
  } catch (error) {
    console.error('Failed to save settings', error);
    const errorMessage = isAddingNewAssignment
      ? getFriendlyErrorMessage(error, 'Unable to create app ID. Please try again.')
      : getFriendlyErrorMessage(error, 'Failed to save settings. Please try again.');
    showStatus(errorMessage, true, { persist: true });
  } finally {
    updateSaveButtonState();
  }
});

userIdEl.addEventListener('input', () => {
  userIdSaved = false;
  hideNewAssignmentInput();
  setAssignmentPlaceholder('Save user ID to load app IDs');
  toggleAssignmentLoading(false);
  assignmentEl.disabled = true;
  updateSaveButtonState();
});

newAssignmentInput?.addEventListener('input', () => {
  updateSaveButtonState();
});
