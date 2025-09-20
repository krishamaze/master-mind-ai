let currentRunId = null;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach(listener => {
    try {
      listener(currentRunId);
    } catch (error) {
      console.warn('Thread context listener failed', error);
    }
  });
}

export function getRunId() {
  return currentRunId;
}

export function setRunId(runId) {
  currentRunId = runId;
  notifyListeners();
  return currentRunId;
}

export function clearRunId() {
  if (currentRunId === null) {
    return;
  }
  currentRunId = null;
  notifyListeners();
}

export function onRunIdChange(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
