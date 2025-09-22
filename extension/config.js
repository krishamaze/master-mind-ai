export const ENVIRONMENTS = {
  development: 'http://localhost:8000',
  production: 'https://master-mind-ai.onrender.com'
};

export function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      { environment: 'production', userId: '', assignmentId: '', projectId: '' },
      ({ environment, userId, assignmentId, projectId }) => {
        const normalizedAssignmentId = assignmentId || projectId || '';
        resolve({
          apiBaseUrl: ENVIRONMENTS[environment] || ENVIRONMENTS.production,
          environment,
          userId,
          assignmentId: normalizedAssignmentId
        });
      }
    );
  });
}

export function setSettings({ environment, userId, assignmentId }) {
  return new Promise(resolve => {
    chrome.storage.sync.set(
      {
        environment,
        userId,
        assignmentId,
        projectId: assignmentId
      },
      resolve
    );
  });
}
