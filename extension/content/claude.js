/**
 * Content script for capturing conversations on claude.ai and
 * sending them to the Master Mind AI backend. The script is
 * self-contained and avoids external module imports so it can run
 * as a plain content script in any Chromium-based browser.
 */

// Configuration for backend communication and DOM selectors
const CONFIG = {
  API_URL: 'https://master-mind-ai.onrender.com/api/v1/conversations/',
  SELECTORS: {
    // Root container for the conversation
    container: 'main',
    // Individual message nodes within the conversation
    message: 'main [data-message-id]'
  },
  RETRY: {
    attempts: 3,
    baseDelay: 1000 // milliseconds
  }
};

// Tracks state for duplicate detection
const state = {
  lastHash: ''
};

/**
 * Simple debounce implementation to throttle rapid DOM updates.
 * @param {Function} fn - function to debounce
 * @param {number} wait - delay in milliseconds
 * @returns {Function}
 */
function debounce(fn, wait = 1000) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

/**
 * Extracts all visible messages from the page.
 * @returns {{ platform: string, messages: string[] }}
 */
function captureConversation() {
  const nodes = document.querySelectorAll(CONFIG.SELECTORS.message);
  const messages = Array.from(nodes, node => node.innerText.trim()).filter(Boolean);
  return { platform: 'claude', messages };
}

/**
 * Sends conversation data to the backend with basic retry logic.
 * @param {Object} payload - data to send
 * @param {number} attempt - current retry attempt
 * @returns {Promise<void>}
 */
async function sendToAPI(payload, attempt = 0) {
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    // Consume response to avoid memory leaks
    await res.json();
  } catch (error) {
    if (attempt + 1 < CONFIG.RETRY.attempts) {
      const wait = CONFIG.RETRY.baseDelay * 2 ** attempt;
      return new Promise(resolve =>
        setTimeout(() => resolve(sendToAPI(payload, attempt + 1)), wait)
      );
    }
    console.error('Failed to send conversation', error);
  }
}

/**
 * Computes a simple hash for the list of messages to prevent
 * duplicate submissions.
 * @param {string[]} messages
 * @returns {string}
 */
function hashMessages(messages) {
  return messages.join('|');
}

/**
 * Handles DOM mutations by capturing the conversation and dispatching
 * it to the backend when new messages appear.
 */
const handleUpdates = debounce(async () => {
  const { platform, messages } = captureConversation();
  if (!messages.length) return;

  const hash = hashMessages(messages);
  if (hash === state.lastHash) return;
  state.lastHash = hash;

  await sendToAPI({ platform, messages });
});

/**
 * Initializes a MutationObserver to watch the conversation container
 * for changes. Retries if the container isn't yet in the DOM.
 */
function initObserver() {
  const target = document.querySelector(CONFIG.SELECTORS.container);
  if (!target) {
    setTimeout(initObserver, 500);
    return;
  }

  const observer = new MutationObserver(handleUpdates);
  observer.observe(target, { childList: true, subtree: true });

  // Initial attempt to capture existing conversation
  handleUpdates();
}

// Kick off the observer as soon as the script loads
initObserver();

