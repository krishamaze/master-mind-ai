export const ENVIRONMENTS = {
  development: 'http://localhost:8000', // FastAPI local testing
  production: 'https://master-mind-ai.onrender.com', // Django production
  fastapi: 'http://localhost:8000', // FastAPI explicit
  django: 'https://master-mind-ai.onrender.com' // Django fallback
};

export function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      { environment: 'production', userId: '', appId: '', assignmentId: '', projectId: '' },
      ({ environment, userId, appId, assignmentId, projectId }) => {
        const normalizedAppId = appId || assignmentId || projectId || '';
        resolve({
          apiBaseUrl: ENVIRONMENTS[environment] || ENVIRONMENTS.production,
          environment,
          userId,
          appId: normalizedAppId
        });
      }
    );
  });
}

export function setSettings({ environment, userId, appId }) {
  return new Promise(resolve => {
    chrome.storage.sync.set(
      {
        environment,
        userId,
        appId,
        assignmentId: appId,
        projectId: appId
      },
      resolve
    );
  });
}
