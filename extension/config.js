export const ENVIRONMENTS = {
  development: 'http://localhost:8000',
  production: 'https://master-mind-ai.onrender.com'
};

export function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      { environment: 'production', apiToken: '', userId: '' },
      ({ environment, apiToken, userId }) => {
        resolve({
          apiBaseUrl: ENVIRONMENTS[environment] || ENVIRONMENTS.production,
          apiToken,
          environment,
          userId
        });
      }
    );
  });
}

export function setSettings({ environment, apiToken, userId }) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ environment, apiToken, userId }, resolve);
  });
}
