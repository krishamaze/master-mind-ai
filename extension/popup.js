import { ENVIRONMENTS, getSettings, setSettings } from './config.js';
import { apiClient } from './api.js';

const envEl = document.getElementById('environment');
const projectEl = document.getElementById('project-select');
const userIdEl = document.getElementById('userId');
const statusEl = document.getElementById('status');
const connectionEl = document.getElementById('connection');
const saveButton = document.getElementById('save');

let statusTimeoutId;

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'red' : 'green';

  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
    statusTimeoutId = null;
  }

  if (message && !isError) {
    statusTimeoutId = setTimeout(() => {
      statusEl.textContent = '';
      statusTimeoutId = null;
    }, 2000);
  }
}

function updateSaveButtonState() {
  const userId = userIdEl.value.trim();
  saveButton.disabled = projectEl.disabled || !projectEl.value || !userId;
}

async function loadProjects(selectedProjectId = '') {
  const environment = envEl.value;
  const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
  const userId = userIdEl.value.trim();

  projectEl.disabled = true;
  if (!userId) {
    projectEl.innerHTML = '<option value="">Enter user ID to load projects</option>';
    updateSaveButtonState();
    return;
  }

  projectEl.innerHTML = '<option value="">Loading projects...</option>';
  updateSaveButtonState();

  try {
    const response = await apiClient.fetchProjects(baseUrl, userId);
    const projects = Array.isArray(response) ? response : response?.results || [];

    projectEl.innerHTML = '<option value="">Select project...</option>';

    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = String(project.id);
      option.textContent = project.name;
      projectEl.appendChild(option);
    });

    if (selectedProjectId) {
      const matched = projects.find(project => String(project.id) === String(selectedProjectId));
      if (matched) {
        projectEl.value = String(matched.id);
      } else {
        projectEl.value = '';
        showStatus('Saved project is unavailable. Please choose another project.', true);
      }
    }

    if (!projects.length) {
      showStatus('No projects available.', true);
    }
  } catch (error) {
    console.error('Failed to load projects', error);
    projectEl.innerHTML = '<option value="">Select project...</option>';
    projectEl.value = '';
    showStatus('Failed to load projects', true);
  } finally {
    projectEl.disabled = false;
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
  await loadProjects(projectId);
  updateConnection();
  updateSaveButtonState();
}

init();

envEl.addEventListener('change', () => {
  loadProjects(projectEl.value);
});

projectEl.addEventListener('change', () => {
  if (statusEl.style.color === 'red' && statusEl.textContent) {
    showStatus('');
  }
  updateSaveButtonState();
});

saveButton.addEventListener('click', () => {
  if (!projectEl.value || !userIdEl.value.trim()) {
    updateSaveButtonState();
    return;
  }

  setSettings({ environment: envEl.value, userId: userIdEl.value, projectId: projectEl.value })
    .then(() => {
      showStatus('Saved');
      updateConnection();
    })
    .catch(error => {
      console.error('Failed to save settings', error);
      showStatus('Failed to save settings', true);
    });
});

userIdEl.addEventListener('blur', () => {
  loadProjects(projectEl.value);
});

userIdEl.addEventListener('input', () => {
  updateSaveButtonState();
});
