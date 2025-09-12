const baseUrlEl = document.getElementById('baseUrl');
const tokenEl = document.getElementById('token');
const statusEl = document.getElementById('status');

chrome.storage.sync.get(
  { apiBaseUrl: 'http://localhost:8000', apiToken: '' },
  ({ apiBaseUrl, apiToken }) => {
    baseUrlEl.value = apiBaseUrl;
    tokenEl.value = apiToken;
  }
);

document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set(
    { apiBaseUrl: baseUrlEl.value, apiToken: tokenEl.value },
    () => {
      statusEl.textContent = 'Saved';
      setTimeout(() => (statusEl.textContent = ''), 2000);
    }
  );
});
