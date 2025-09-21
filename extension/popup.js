import { ENVIRONMENTS, getSettings, setSettings } from './config.js';
import { apiClient } from './api.js';

const envEl = document.getElementById('environment');
const projectEl = document.getElementById('project-select');
const projectLoadingEl = document.getElementById('project-loading');
const userIdEl = document.getElementById('userId');
const statusEl = document.getElementById('status');
const connectionEl = document.getElementById('connection');
const saveButton = document.getElementById('save');
const newProjectContainer = document.getElementById('new-project-container');
const newProjectInput = document.getElementById('new-project-name');

const ADD_NEW_PROJECT_OPTION = '__add_new_project__';
const USER_ID_PROMPT_MESSAGE = 'Enter User ID first to load projects';

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

function setProjectPlaceholder(message) {
  projectEl.innerHTML = `<option value="">${message}</option>`;
  projectEl.value = '';
}

function toggleProjectLoading(isLoading) {
  if (projectLoadingEl) {
    projectLoadingEl.hidden = !isLoading;
  }
  projectEl.classList.toggle('loading', isLoading);
}

function hideNewProjectInput() {
  if (newProjectContainer) {
    newProjectContainer.hidden = true;
  }
  if (newProjectInput) {
    newProjectInput.value = '';
  }
}

function updateSaveButtonState() {
  const userId = userIdEl.value.trim();
  const selectedProject = projectEl.value;
  const isAddingNewProject = selectedProject === ADD_NEW_PROJECT_OPTION;
  const newProjectName = newProjectInput?.value.trim() ?? '';

  if (!userId) {
    saveButton.disabled = true;
    saveButton.textContent = 'Save';
    return;
  }

  if (projectEl.disabled) {
    saveButton.disabled = false;
    saveButton.textContent = 'Save User ID';
    return;
  }

  if (isAddingNewProject) {
    saveButton.disabled = !newProjectName;
    saveButton.textContent = 'Create Project';
    return;
  }

  saveButton.disabled = !selectedProject;
  saveButton.textContent = 'Save';
}

async function loadProjects(selectedProjectId = '') {
  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const userId = userIdEl.value.trim();

  hideNewProjectInput();
  projectEl.disabled = true;
  if (!userId) {
    toggleProjectLoading(false);
    setProjectPlaceholder('Save user ID to load projects');
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
    updateSaveButtonState();
    return;
  }

  toggleProjectLoading(true);
  setProjectPlaceholder('Loading projects...');
  updateSaveButtonState();

  let loaded = false;

  try {
    const response = await apiClient.fetchProjects(baseUrl, userId);
    const projects = Array.isArray(response) ? response : response?.results || [];

    setProjectPlaceholder('Select project...');

    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = String(project.id);
      option.textContent = project.name;
      projectEl.appendChild(option);
    });

    const addOption = document.createElement('option');
    addOption.value = ADD_NEW_PROJECT_OPTION;
    addOption.textContent = 'Add New Project';
    projectEl.appendChild(addOption);

    if (selectedProjectId) {
      const matched = projects.find(project => String(project.id) === String(selectedProjectId));
      if (matched) {
        projectEl.value = String(matched.id);
      } else {
        projectEl.value = '';
        showStatus('Saved project is unavailable. Please choose another project.', true);
      }
    } else {
      projectEl.value = '';
    }

    showStatus(`Loaded ${projects.length} project${projects.length === 1 ? '' : 's'}`);
    loaded = true;
    projectEl.disabled = false;
  } catch (error) {
    console.error('Failed to load projects', error);
    setProjectPlaceholder('Select project...');
    showStatus('Failed to load projects', true);
  } finally {
    toggleProjectLoading(false);
    projectEl.disabled = !loaded;
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
  const { environment, userId, projectId } = await getSettings();
  envEl.value = environment;
  userIdEl.value = userId;
  userIdSaved = Boolean(userId);

  if (userId) {
    await loadProjects(projectId);
  } else {
    setProjectPlaceholder('Save user ID to load projects');
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
  }

  updateConnection();
  updateSaveButtonState();
}

init();

envEl.addEventListener('change', () => {
  hideNewProjectInput();

  if (userIdSaved) {
    const selectedProjectId =
      projectEl.value && projectEl.value !== ADD_NEW_PROJECT_OPTION ? projectEl.value : '';
    loadProjects(selectedProjectId);
  } else {
    setProjectPlaceholder('Save user ID to load projects');
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
    updateSaveButtonState();
  }
});

projectEl.addEventListener('change', () => {
  const isAddingNewProject = projectEl.value === ADD_NEW_PROJECT_OPTION;

  if (isAddingNewProject) {
    if (newProjectContainer) {
      newProjectContainer.hidden = false;
    }
    if (newProjectInput) {
      newProjectInput.focus();
    }
  } else {
    if (statusEl.style.color === 'red' && statusEl.textContent) {
      showStatus('');
    }
    hideNewProjectInput();
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
  const selectedProject = projectEl.value;
  const isAddingNewProject = selectedProject === ADD_NEW_PROJECT_OPTION;

  saveButton.disabled = true;

  try {
    if (projectEl.disabled) {
      await setSettings({ environment, userId, projectId: '' });
      userIdSaved = true;
      showStatus('User ID saved. Loading projects...', false, { persist: true });
      await loadProjects();
      updateConnection();
      return;
    }

    if (isAddingNewProject) {
      const newProjectName = newProjectInput?.value.trim() ?? '';

      if (!newProjectName) {
        showStatus('Enter a project name to continue.', true);
        return;
      }

      showStatus('Creating project...', false, { persist: true });
      const createdProject = await apiClient.createProject(baseUrl, {
        name: newProjectName,
        user_id: userId
      });

      const createdProjectId = createdProject?.id ? String(createdProject.id) : '';
      hideNewProjectInput();

      await loadProjects(createdProjectId);

      if (createdProjectId) {
        await setSettings({ environment, userId, projectId: createdProjectId });
      } else {
        await setSettings({ environment, userId, projectId: '' });
      }

      userIdSaved = true;

      showStatus('Project created and saved.', false);
      updateConnection();
      return;
    }

    if (!selectedProject) {
      showStatus('Select a project to save.', true);
      return;
    }

    await setSettings({ environment, userId, projectId: selectedProject });
    userIdSaved = true;
    showStatus('Saved');
    updateConnection();
  } catch (error) {
    console.error('Failed to save settings', error);
    showStatus('Failed to save settings', true);
  } finally {
    updateSaveButtonState();
  }
});

userIdEl.addEventListener('input', () => {
  userIdSaved = false;
  hideNewProjectInput();
  setProjectPlaceholder('Save user ID to load projects');
  toggleProjectLoading(false);
  projectEl.disabled = true;
  if (statusEl.textContent !== USER_ID_PROMPT_MESSAGE) {
    showStatus(USER_ID_PROMPT_MESSAGE, false, { persist: true });
  }
  updateSaveButtonState();
});

newProjectInput?.addEventListener('input', () => {
  updateSaveButtonState();
});
