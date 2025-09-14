import { getSettings, setSettings } from './config.js';

const envEl = document.getElementById('environment');
const tokenEl = document.getElementById('token');
const userIdEl = document.getElementById('userId');
const statusEl = document.getElementById('status');
const connectionEl = document.getElementById('connection');

async function updateConnection() {
  connectionEl.textContent = 'Checking...';
  chrome.runtime.sendMessage({ type: 'health-check' }, res => {
    const ok = res?.ok;
    connectionEl.textContent = ok ? 'Connected' : 'Disconnected';
    connectionEl.style.color = ok ? 'green' : 'red';
  });
}

async function init() {
  const { environment, apiToken, userId } = await getSettings();
  envEl.value = environment;
  tokenEl.value = apiToken;
  userIdEl.value = userId;
  updateConnection();
}

init();

document.getElementById('save').addEventListener('click', () => {
  setSettings({ environment: envEl.value, apiToken: tokenEl.value, userId: userIdEl.value }).then(() => {
    statusEl.textContent = 'Saved';
    setTimeout(() => (statusEl.textContent = ''), 2000);
    updateConnection();
  });
});
