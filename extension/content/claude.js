import { debounce } from './utils.js';

/**
 * Content script for capturing conversations on claude.ai.
 * Observes DOM mutations, extracts user/assistant messages and
 * sends them to the Master Mind AI backend.
 */

const CONFIG = {
  API_URL: 'https://master-mind-ai.onrender.com/api/v1/conversations/',
  RETRY: { attempts: 3, baseDelay: 1000 },
  IGNORE_TEXT: ['Copy', 'Edit', 'Retry'],
  DEDUPE_WINDOW: 10000 // milliseconds
};

// Buffer for pending messages and map for deduplication
const buffer = [];
const seen = new Map();

/**
 * Determine whether the element represents a user or assistant message
 * by inspecting its class names and data attributes.
 * @param {Element} el
 * @returns {'user'|'assistant'|null}
 */
function detectRole(el) {
  const id = `${el.className} ${Object.values(el.dataset).join(' ')}`.toLowerCase();
  if (/user|human/.test(id)) return 'user';
  if (/assistant|bot|ai|claude/.test(id)) return 'assistant';
  return null;
}

/**
 * Remove stale entries from the dedupe map so it doesn't grow endlessly.
 */
function pruneSeen() {
  const cutoff = Date.now() - CONFIG.DEDUPE_WINDOW;
  for (const [text, ts] of seen) {
    if (ts < cutoff) seen.delete(text);
  }
}

/**
 * Extract messages from a newly added node and queue them for sending.
 * @param {Node} node
 */
function collectMessages(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  pruneSeen();

  const elements = [node, ...node.querySelectorAll('*')];
  for (const el of elements) {
    const text = el.innerText?.trim();
    if (!text || CONFIG.IGNORE_TEXT.includes(text)) continue;

    const role = detectRole(el);
    if (!role) continue;

    const last = seen.get(text);
    if (last && Date.now() - last < CONFIG.DEDUPE_WINDOW) continue;

    seen.set(text, Date.now());
    buffer.push({ role, content: text, timestamp: new Date().toISOString() });
  }
}

/**
 * Debounced sender that posts buffered messages to the backend.
 */
const flush = debounce(async () => {
  if (!buffer.length) return;
  const payload = { platform: 'claude', messages: buffer.splice(0) };
  await sendToAPI(payload);
}, 500);

/**
 * Handle DOM mutations by processing newly added nodes. Also attaches
 * observers to any encountered shadow roots.
 * @param {MutationRecord[]} mutations
 */
function handleMutations(mutations) {
  for (const m of mutations) {
    m.addedNodes.forEach(node => {
      collectMessages(node);
      if (node.shadowRoot) observe(node.shadowRoot);
    });
  }
  flush();
}

/**
 * Observe a root node (document or shadow root) for future mutations.
 * @param {Node} root
 */
function observe(root) {
  const observer = new MutationObserver(handleMutations);
  observer.observe(root, { childList: true, subtree: true });
}

/**
 * Send a payload to the backend with retry and exponential backoff.
 * @param {Object} payload
 * @param {number} attempt
 */
async function sendToAPI(payload, attempt = 0) {
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json().catch(() => {});
  } catch (err) {
    if (attempt + 1 < CONFIG.RETRY.attempts) {
      const wait = CONFIG.RETRY.baseDelay * 2 ** attempt;
      return new Promise(resolve =>
        setTimeout(() => resolve(sendToAPI(payload, attempt + 1)), wait)
      );
    }
    console.error('Failed to send conversation', err);
  }
}

// Begin observing the document and send any existing content
observe(document.body);
collectMessages(document.body);
flush();

