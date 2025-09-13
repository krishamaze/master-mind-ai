export const ENVIRONMENTS = {
  development: 'http://localhost:8000',
  production: 'https://master-mind-ai.onrender.com'
};

export function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      { environment: 'production', apiToken: '' },
      ({ environment, apiToken }) => {
        resolve({
          apiBaseUrl: ENVIRONMENTS[environment] || ENVIRONMENTS.production,
          apiToken,
          environment
        });
      }
    );
  });
}

export function setSettings({ environment, apiToken }) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ environment, apiToken }, resolve);
  });
}
