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
const globalErrorAnnouncer = document.getElementById('global-error-announcer');

const userIdSavedIcon = document.getElementById('userId-saved');
const userIdEditIcon = document.getElementById('userId-edit');
const appIdSavedIcon = document.getElementById('appId-saved');
const appIdEditIcon = document.getElementById('appId-edit');

const ADD_NEW_ASSIGNMENT_OPTION = '__add_new_assignment__';
const APP_ID_PATTERN = /^[A-Za-z0-9]{8,}$/;
const USER_ID_PATTERN = /^[A-Za-z0-9._-]{4,}$/;

const state = {
  userIdLocked: false,
  appIdSaved: false,
  setupComplete: false
};

let isSubmitting = false;
let statusTimeoutId = null;

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
  statusEl.hidden = !message;
  statusEl.dataset.statusType = isError ? 'error' : message ? 'success' : '';
  statusEl.setAttribute('role', isError ? 'alert' : 'status');
  statusEl.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  statusEl.style.color = isError ? '#d93025' : '#198754';

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
  if (message) {
    setStatus(message, true, { persist: true });
  } else if (statusEl?.dataset?.statusType === 'error') {
    setStatus('');
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
  if (!newAssignmentFeedback || !newAssignmentInput) {
    return;
  }

  if (message) {
    newAssignmentFeedback.textContent = message;
    newAssignmentFeedback.hidden = false;
    newAssignmentInput.setAttribute('aria-invalid', 'true');
  } else {
    newAssignmentFeedback.textContent = '';
    newAssignmentFeedback.hidden = true;
    newAssignmentInput.setAttribute('aria-invalid', 'false');
  }
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

function hideNewAssignmentInput() {
  if (newAssignmentContainer) {
    newAssignmentContainer.hidden = true;
  }
  if (newAssignmentInput) {
    newAssignmentInput.value = '';
  }
  setAssignmentNameFeedback('');
}

function showNewAssignmentInput() {
  if (!newAssignmentContainer || !newAssignmentInput) {
    return;
  }
  newAssignmentContainer.hidden = false;
  newAssignmentInput.focus();
  handleNewAssignmentInput();
}

function updateUserIdIcons() {
  if (userIdSavedIcon) {
    const showCheckmark = !state.userIdLocked;
    userIdSavedIcon.hidden = !showCheckmark;
    userIdSavedIcon.setAttribute('aria-hidden', showCheckmark ? 'false' : 'true');
    userIdSavedIcon.setAttribute('aria-label', 'Save user ID');
  }
  if (userIdEditIcon) {
    userIdEditIcon.hidden = !state.userIdLocked;
    userIdEditIcon.setAttribute('aria-hidden', state.userIdLocked ? 'false' : 'true');
  }
}

function updateAppIdIcons() {
  if (appIdSavedIcon) {
    appIdSavedIcon.hidden = !state.appIdSaved;
    appIdSavedIcon.setAttribute('aria-hidden', state.appIdSaved ? 'false' : 'true');
  }
  if (appIdEditIcon) {
    appIdEditIcon.hidden = !state.appIdSaved;
    appIdEditIcon.setAttribute('aria-hidden', state.appIdSaved ? 'false' : 'true');
  }
}

function clearAppSelections() {
  hideNewAssignmentInput();
  resetAssignmentDropdown(state.userIdLocked ? 'Choose app ID...' : 'Save User ID first');
  assignmentEl.disabled = !state.userIdLocked;
  state.appIdSaved = false;
  updateAppIdIcons();
}

function toggleAssignmentLoading(isLoading) {
  if (assignmentLoadingEl) {
    assignmentLoadingEl.hidden = !isLoading;
  }
  if (assignmentEl) {
    assignmentEl.classList.toggle('loading', isLoading);
    assignmentEl.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }
}

function populateAssignmentOptions(appIds = [], preferredAppId = '') {
  resetAssignmentDropdown(appIds.length ? 'Choose app ID...' : 'No app IDs found. Add a new one.');

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

  assignmentEl.disabled = false;

  if (preferredAppId && appIds.includes(preferredAppId)) {
    assignmentEl.value = preferredAppId;
  }
}

function ensureOptionExists(appId) {
  if (!assignmentEl) {
    return;
  }
  const options = Array.from(assignmentEl.options ?? []);
  const existing = options.find(option => option.value === appId);
  if (existing) {
    return;
  }
  const option = document.createElement('option');
  option.value = appId;
  option.textContent = appId;
  const addOption = options.find(option => option.value === ADD_NEW_ASSIGNMENT_OPTION);
  if (addOption) {
    assignmentEl.insertBefore(option, addOption);
  } else {
    assignmentEl.appendChild(option);
  }
}

function lockUserId(normalizedUserId) {
  state.userIdLocked = true;
  state.setupComplete = false;
  userIdEl.value = normalizedUserId;
  userIdEl.readOnly = true;
  userIdEl.setAttribute('aria-readonly', 'true');
  updateUserIdIcons();
  clearAppSelections();
  loadAppIds(normalizedUserId);
}

function unlockUserId() {
  const confirmed = window.confirm('Editing your User ID will clear the selected App ID. Continue?');
  if (!confirmed) {
    return;
  }
  state.userIdLocked = false;
  state.setupComplete = false;
  state.appIdSaved = false;
  userIdEl.readOnly = false;
  userIdEl.setAttribute('aria-readonly', 'false');
  userIdEl.focus();
  userIdEl.select();
  updateUserIdIcons();
  clearAppSelections();
  setError('');
  setStatus('User ID unlocked. Save to load App IDs.', false, { persist: true });
  updateSubmitButton();
}

function lockAppSelection(appId) {
  assignmentEl.value = appId;
  assignmentEl.disabled = true;
  state.appIdSaved = true;
  updateAppIdIcons();
  hideNewAssignmentInput();
}

function unlockAppSelection() {
  assignmentEl.disabled = false;
  state.appIdSaved = false;
  state.setupComplete = false;
  updateAppIdIcons();
  updateSubmitButton();
  setStatus('Select an App ID to continue.', false, { persist: true });
}

function getAppSelectionState() {
  if (!state.userIdLocked) {
    return { ready: false, appId: '', isNew: false };
  }

  const selectedValue = assignmentEl.value;
  if (!selectedValue) {
    return { ready: false, appId: '', isNew: false };
  }

  if (selectedValue === ADD_NEW_ASSIGNMENT_OPTION) {
    const { valid, normalizedName } = validateAssignmentName(newAssignmentInput?.value ?? '');
    return { ready: valid, appId: normalizedName, isNew: true };
  }

  return { ready: true, appId: selectedValue, isNew: false };
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

  if (state.setupComplete) {
    submitBtn.textContent = 'Setup Complete';
    submitBtn.disabled = true;
    submitBtn.classList.add('saved');
    hideNewAssignmentInput();
    return;
  }

  submitBtn.textContent = 'Submit';
  submitBtn.classList.remove('saved');

  const selection = getAppSelectionState();
  const ready = state.userIdLocked && selection.ready;
  submitBtn.disabled = !ready;
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

async function loadAppIds(userId, preferredAppId = '') {
  if (!userId) {
    clearAppSelections();
    return;
  }

  toggleAssignmentLoading(true);
  assignmentEl.disabled = true;

  try {
    const environment = envEl.value;
    const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
    const response = await apiClient.fetchUserAppIds(baseUrl, userId);
    const rawAppIds = Array.isArray(response)
      ? response
      : Array.isArray(response?.app_ids)
        ? response.app_ids
        : [];

    const seen = new Set();
    const appIds = rawAppIds
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(item => item.length >= 8 && !seen.has(item) && (seen.add(item) || true));

    populateAssignmentOptions(appIds, preferredAppId);
    setError('');
    setStatus(appIds.length ? 'App IDs loaded. Select one to continue.' : 'No App IDs found. Create a new one to continue.');
  } catch (error) {
    console.error('Failed to load app IDs', error);
    const message = getFriendlyErrorMessage(error, 'Unable to load App IDs. Please try again.');
    setError(message);
    clearAppSelections();
  } finally {
    toggleAssignmentLoading(false);
  }

  updateSubmitButton();
}

async function handleSubmit() {
  if (!submitBtn || submitBtn.disabled || isSubmitting) {
    return;
  }

  const { valid, message, normalized: normalizedUserId } = validateUserId(userIdEl.value);
  if (!valid) {
    setError(message);
    updateSubmitButton();
    return;
  }

  const selection = getAppSelectionState();
  if (!selection.ready) {
    updateSubmitButton();
    return;
  }

  isSubmitting = true;
  setError('');
  updateSubmitButton();

  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  let appIdToSave = selection.appId;

  try {
    if (selection.isNew) {
      const { normalizedName, message: validationMessage, valid } = validateAssignmentName(newAssignmentInput?.value ?? '');
      if (!valid) {
        setAssignmentNameFeedback(validationMessage);
        throw new Error(validationMessage);
      }

      appIdToSave = normalizedName;
      await apiClient.createAssignment(baseUrl, { user_id: normalizedUserId, app_id: appIdToSave });
      ensureOptionExists(appIdToSave);
      setStatus('App ID created.');
    }

    await setSettings({ environment, userId: normalizedUserId, appId: appIdToSave });

    lockAppSelection(appIdToSave);
    hideNewAssignmentInput();
    state.setupComplete = true;
    setStatus('Setup complete.', false, { persist: true });
  } catch (error) {
    console.error('Failed to save configuration', error);
    const message = getFriendlyErrorMessage(error, 'Unable to save configuration. Please try again.');
    setError(message);
  } finally {
    isSubmitting = false;
    updateSubmitButton();
  }
}

function handleAssignmentChange() {
  setError('');
  state.appIdSaved = false;
  state.setupComplete = false;
  updateAppIdIcons();

  if (assignmentEl.value === ADD_NEW_ASSIGNMENT_OPTION) {
    showNewAssignmentInput();
  } else {
    hideNewAssignmentInput();
  }

  updateSubmitButton();
}

function handleNewAssignmentInput() {
  if (!newAssignmentInput || assignmentEl.value !== ADD_NEW_ASSIGNMENT_OPTION) {
    setAssignmentNameFeedback('');
    updateSubmitButton();
    return;
  }

  const { valid, message } = validateAssignmentName(newAssignmentInput.value ?? '');
  setAssignmentNameFeedback(valid ? '' : message);
  updateSubmitButton();
}

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

function updateConnection() {
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
  popupRootEl?.setAttribute('aria-busy', 'true');

  const { environment, userId, appId } = await getSettings();
  envEl.value = environment;

  if (userId) {
    state.userIdLocked = true;
    userIdEl.value = userId;
    userIdEl.readOnly = true;
    userIdEl.setAttribute('aria-readonly', 'true');
    updateUserIdIcons();
    await loadAppIds(userId, appId);

    const options = Array.from(assignmentEl?.options ?? []);
    if (appId && options.some(option => option.value === appId)) {
      lockAppSelection(appId);
      state.setupComplete = true;
      setStatus('Setup complete.', false, { persist: true });
    } else {
      assignmentEl.disabled = false;
      state.setupComplete = false;
      updateAppIdIcons();
      if (appId) {
        setError('Saved App ID not found. Please choose another.');
      }
    }
  } else {
    state.userIdLocked = false;
    userIdEl.value = '';
    userIdEl.readOnly = false;
    userIdEl.setAttribute('aria-readonly', 'false');
    updateUserIdIcons();
    clearAppSelections();
    setStatus('Enter your User ID to load available App IDs.', false, { persist: true });
  }

  popupRootEl?.setAttribute('aria-busy', 'false');
  updateSubmitButton();
  updateConnection();
}

init();

envEl.addEventListener('change', () => {
  setError('');
  state.setupComplete = false;
  if (state.userIdLocked) {
    clearAppSelections();
    loadAppIds(userIdEl.value.trim(), assignmentEl.value);
  }
  updateSubmitButton();
});

userIdEl.addEventListener('input', () => {
  if (state.userIdLocked) {
    return;
  }
  setError('');
  setStatus('');
  clearAppSelections();
  updateSubmitButton();
});

userIdEl.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !state.userIdLocked) {
    event.preventDefault();
    const { valid, message, normalized } = validateUserId(userIdEl.value);
    if (!valid) {
      setError(message);
      return;
    }
    setError('');
    setStatus('');
    lockUserId(normalized);
    updateSubmitButton();
  }
});

if (userIdSavedIcon) {
  userIdSavedIcon.setAttribute('role', 'button');
  userIdSavedIcon.setAttribute('tabindex', '0');
  userIdSavedIcon.addEventListener('click', handleIconActivation(() => {
    if (state.userIdLocked) {
      return;
    }
    const { valid, message, normalized } = validateUserId(userIdEl.value);
    if (!valid) {
      setError(message);
      return;
    }
    setError('');
    setStatus('');
    lockUserId(normalized);
    updateSubmitButton();
  }));
  userIdSavedIcon.addEventListener('keydown', handleIconActivation(() => {
    if (state.userIdLocked) {
      return;
    }
    const { valid, message, normalized } = validateUserId(userIdEl.value);
    if (!valid) {
      setError(message);
      return;
    }
    setError('');
    setStatus('');
    lockUserId(normalized);
    updateSubmitButton();
  }));
}

if (userIdEditIcon) {
  userIdEditIcon.setAttribute('role', 'button');
  userIdEditIcon.setAttribute('tabindex', '0');
  userIdEditIcon.addEventListener('click', handleIconActivation(unlockUserId));
  userIdEditIcon.addEventListener('keydown', handleIconActivation(unlockUserId));
}

assignmentEl.addEventListener('change', handleAssignmentChange);
newAssignmentInput?.addEventListener('input', handleNewAssignmentInput);

if (appIdEditIcon) {
  appIdEditIcon.setAttribute('role', 'button');
  appIdEditIcon.setAttribute('tabindex', '0');
  appIdEditIcon.addEventListener('click', handleIconActivation(unlockAppSelection));
  appIdEditIcon.addEventListener('keydown', handleIconActivation(unlockAppSelection));
}

submitBtn.addEventListener('click', event => {
  event.preventDefault();
  handleSubmit();
});
