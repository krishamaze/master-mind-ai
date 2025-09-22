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
const USER_ID_PROMPT_MESSAGE = 'Enter User ID first to load assignments';
const APP_ID_PATTERN = /^[A-Za-z0-9]{8}$/;
const APP_ID_LENGTH = 8;

function isValidAppId(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return APP_ID_PATTERN.test(value);
}

function generateAppId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues
      ? globalThis.crypto
      : null;

  if (cryptoObj) {
    const randomValues = cryptoObj.getRandomValues(new Uint32Array(APP_ID_LENGTH));
    return Array.from(randomValues, value => characters[value % charactersLength]).join('');
  }

  let fallbackId = '';
  for (let i = 0; i < APP_ID_LENGTH; i += 1) {
    const randomIndex = Math.floor(Math.random() * charactersLength);
    fallbackId += characters[randomIndex];
  }
  return fallbackId;
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
  assignmentEl.innerHTML = `<option value="">${message}</option>`;
  assignmentEl.value = '';
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
    return { valid: false, message: 'Enter an assignment name to continue.', normalizedName: '' };
  }

  if (/\s/.test(rawName)) {
    return { valid: false, message: 'Assignment name cannot contain spaces.', normalizedName: '' };
  }

  if (!/^[A-Za-z0-9]+$/.test(trimmedName)) {
    return { valid: false, message: 'Assignment name must be alphanumeric.', normalizedName: '' };
  }

  if (trimmedName.length < 8) {
    return {
      valid: false,
      message: 'Assignment name must be at least 8 characters.',
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
    saveButton.textContent = 'Save';
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
    saveButton.textContent = 'Create Assignment';
    return;
  }

  setAssignmentNameFeedback('');
  saveButton.disabled = !selectedAssignment;
  saveButton.textContent = 'Save';
}

async function loadAssignments(selectedAssignmentId = '') {
  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const userId = userIdEl.value.trim();

  hideNewAssignmentInput();
  assignmentEl.disabled = true;
  if (!userId) {
    toggleAssignmentLoading(false);
    setAssignmentPlaceholder('Save user ID to load assignments');
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
    updateSaveButtonState();
    return [];
  }

  toggleAssignmentLoading(true);
  setAssignmentPlaceholder('Loading assignments...');
  updateSaveButtonState();

  let loaded = false;
  let assignments = [];

  try {
    const response = await apiClient.fetchAssignments(baseUrl, userId);
    assignments = Array.isArray(response) ? response : response?.results || [];

    setAssignmentPlaceholder('Choose assignment...');

    assignments.forEach(assignment => {
      if (!assignment) {
        return;
      }

      const option = document.createElement('option');
      const optionValue = getAssignmentOptionValue(assignment);
      if (optionValue) {
        option.value = optionValue;
      } else if (assignment.id !== undefined && assignment.id !== null) {
        option.value = String(assignment.id);
      } else {
        option.value = '';
      }

      if (assignment.id !== undefined && assignment.id !== null) {
        option.dataset.assignmentId = String(assignment.id);
      }
      if (typeof assignment.app_id === 'string') {
        option.dataset.appId = assignment.app_id;
      }

      option.textContent = assignment.name;
      assignmentEl.appendChild(option);
    });

    const addOption = document.createElement('option');
    addOption.value = ADD_NEW_ASSIGNMENT_OPTION;
    addOption.textContent = 'Add New Assignment';
    assignmentEl.appendChild(addOption);

    if (selectedAssignmentId) {
      const normalizedSelectedId = String(selectedAssignmentId);
      const matched = assignments.find(assignment => {
        if (!assignment) {
          return false;
        }

        const value = getAssignmentOptionValue(assignment);
        if (value && value === normalizedSelectedId) {
          return true;
        }

        const rawId = assignment.id;
        if (rawId !== undefined && rawId !== null) {
          return String(rawId) === normalizedSelectedId;
        }

        return false;
      });

      if (matched) {
        const matchedValue = getAssignmentOptionValue(matched);
        if (matchedValue) {
          assignmentEl.value = matchedValue;
        } else if (matched.id !== undefined && matched.id !== null) {
          assignmentEl.value = String(matched.id);
        } else {
          assignmentEl.value = '';
        }
      } else {
        assignmentEl.value = '';
        showStatus('Saved assignment is unavailable. Please choose another assignment.', true);
      }
    } else {
      assignmentEl.value = '';
    }

    showStatus(`Loaded ${assignments.length} assignment${assignments.length === 1 ? '' : 's'}`);
    loaded = true;
    assignmentEl.disabled = false;
    return assignments;
  } catch (error) {
    console.error('Failed to load assignments', error);
    setAssignmentPlaceholder('Choose assignment...');
    const message = getFriendlyErrorMessage(error, 'Unable to load assignments. Please try again.');
    showStatus(message, true, { persist: true });
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
  const { environment, userId, assignmentId } = await getSettings();
  envEl.value = environment;
  userIdEl.value = userId;
  userIdSaved = Boolean(userId);

  if (userId) {
    await loadAssignments(assignmentId);
  } else {
    setAssignmentPlaceholder('Save user ID to load assignments');
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
  }

  updateConnection();
  updateSaveButtonState();
}

init();

envEl.addEventListener('change', () => {
  hideNewAssignmentInput();

  if (userIdSaved) {
    const selectedAssignmentId =
      assignmentEl.value && assignmentEl.value !== ADD_NEW_ASSIGNMENT_OPTION ? assignmentEl.value : '';
    loadAssignments(selectedAssignmentId);
  } else {
    setAssignmentPlaceholder('Save user ID to load assignments');
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
  const selectedAssignment = assignmentEl.value;
  const isAddingNewAssignment = selectedAssignment === ADD_NEW_ASSIGNMENT_OPTION;

  saveButton.disabled = true;

  try {
    if (assignmentEl.disabled) {
      await setSettings({ environment, userId, assignmentId: '' });
      userIdSaved = true;
      showStatus('User ID saved. Loading assignments...', false, { persist: true });
      await loadAssignments();
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
      showStatus('Creating assignment...', false, { persist: true });

      const generatedAppId = generateAppId();
      const createdAssignment = await apiClient.createAssignment(baseUrl, {
        name: normalizedName,
        app_id: generatedAppId
      });

      const createdAssignmentId = createdAssignment?.id ? String(createdAssignment.id) : '';
      const createdAssignmentAppId = isValidAppId(createdAssignment?.app_id)
        ? createdAssignment.app_id
        : generatedAppId;
      const createdAssignmentName = createdAssignment?.name ?? normalizedName;
      hideNewAssignmentInput();

      const preferredSelection = createdAssignmentAppId || createdAssignmentId;
      const assignments = await loadAssignments(preferredSelection);

      let assignmentIdToSave = createdAssignmentAppId;
      if (!assignmentIdToSave && assignments.length) {
        const matched = assignments.find(assignment => {
          if (!assignment) {
            return false;
          }

          if (assignment?.name === createdAssignmentName) {
            return true;
          }

          const optionValue = getAssignmentOptionValue(assignment);
          if (optionValue && optionValue === preferredSelection) {
            return true;
          }

          const rawId = assignment?.id;
          if (rawId !== undefined && rawId !== null) {
            return String(rawId) === createdAssignmentId;
          }

          return false;
        });

        if (matched) {
          const matchedValue = getAssignmentOptionValue(matched);
          assignmentIdToSave = matchedValue || (matched.id !== undefined && matched.id !== null ? String(matched.id) : '');
          assignmentEl.value = assignmentIdToSave;
        }
      }

      if (assignmentIdToSave) {
        const normalizedAssignmentIdToSave = String(assignmentIdToSave);
        await setSettings({ environment, userId, assignmentId: normalizedAssignmentIdToSave });
        assignmentEl.value = normalizedAssignmentIdToSave;
        const successMessage = isValidAppId(normalizedAssignmentIdToSave)
          ? 'Assignment created and saved.'
          : 'Assignment created and saved with a legacy identifier.';
        showStatus(successMessage, !isValidAppId(normalizedAssignmentIdToSave), { persist: !isValidAppId(normalizedAssignmentIdToSave) });
      } else {
        await setSettings({ environment, userId, assignmentId: '' });
        showStatus('Assignment created but could not be auto-selected. Please choose it manually.', true, {
          persist: true
        });
        return;
      }

      userIdSaved = true;

      updateConnection();
      return;
    }

    if (!selectedAssignment) {
      showStatus('Select an assignment to save.', true);
      return;
    }

    await setSettings({ environment, userId, assignmentId: selectedAssignment });
    userIdSaved = true;
    showStatus('Saved');
    updateConnection();
  } catch (error) {
    console.error('Failed to save settings', error);
    const errorMessage = isAddingNewAssignment
      ? getFriendlyErrorMessage(error, 'Unable to create assignment. Please try again.')
      : getFriendlyErrorMessage(error, 'Failed to save settings. Please try again.');
    showStatus(errorMessage, true, { persist: true });
  } finally {
    updateSaveButtonState();
  }
});

userIdEl.addEventListener('input', () => {
  userIdSaved = false;
  hideNewAssignmentInput();
  setAssignmentPlaceholder('Save user ID to load assignments');
  toggleAssignmentLoading(false);
  assignmentEl.disabled = true;
  if (statusEl.textContent !== USER_ID_PROMPT_MESSAGE) {
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
  }
  updateSaveButtonState();
});

newAssignmentInput?.addEventListener('input', () => {
  updateSaveButtonState();
});
