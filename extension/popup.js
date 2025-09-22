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
      const option = document.createElement('option');
      option.value = String(assignment.id);
      option.textContent = assignment.name;
      assignmentEl.appendChild(option);
    });

    const addOption = document.createElement('option');
    addOption.value = ADD_NEW_ASSIGNMENT_OPTION;
    addOption.textContent = 'Add New Assignment';
    assignmentEl.appendChild(addOption);

    if (selectedAssignmentId) {
      const matched = assignments.find(
        assignment => String(assignment.id) === String(selectedAssignmentId)
      );
      if (matched) {
        assignmentEl.value = String(matched.id);
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
      const createdAssignment = await apiClient.createAssignment(baseUrl, {
        name: normalizedName,
        user_id: userId
      });

      const createdAssignmentId = createdAssignment?.id ? String(createdAssignment.id) : '';
      const createdAssignmentName = createdAssignment?.name ?? normalizedName;
      hideNewAssignmentInput();

      const assignments = await loadAssignments(createdAssignmentId);

      let assignmentIdToSave = createdAssignmentId;
      if (!assignmentIdToSave && assignments.length) {
        const matched = assignments.find(assignment => assignment?.name === createdAssignmentName);
        if (matched?.id) {
          assignmentIdToSave = String(matched.id);
          assignmentEl.value = assignmentIdToSave;
        }
      }

      if (assignmentIdToSave) {
        await setSettings({ environment, userId, assignmentId: assignmentIdToSave });
        assignmentEl.value = assignmentIdToSave;
        showStatus('Assignment created and saved.', false);
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
