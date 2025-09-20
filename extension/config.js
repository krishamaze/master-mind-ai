export const ENVIRONMENTS = {
  development: 'http://localhost:8000',
  production: 'https://master-mind-ai.onrender.com'
};

export function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      { environment: 'production', userId: '', projectId: '' },
      ({ environment, userId, projectId }) => {
        resolve({
          apiBaseUrl: ENVIRONMENTS[environment] || ENVIRONMENTS.production,
          environment,
          userId,
          projectId
        });
      }
    );
  });
}

export function setSettings({ environment, userId, projectId }) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ environment, userId, projectId }, resolve);
  });
}
