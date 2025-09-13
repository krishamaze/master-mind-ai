import { getSettings, setSettings } from './config.js';

const envEl = document.getElementById('environment');
const tokenEl = document.getElementById('token');
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
  const { environment, apiToken } = await getSettings();
  envEl.value = environment;
  tokenEl.value = apiToken;
  updateConnection();
}

init();

document.getElementById('save').addEventListener('click', () => {
  setSettings({ environment: envEl.value, apiToken: tokenEl.value }).then(() => {
    statusEl.textContent = 'Saved';
    setTimeout(() => (statusEl.textContent = ''), 2000);
    updateConnection();
  });
});
