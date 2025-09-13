/**
 * Content script for capturing conversations on claude.ai.
 * Chrome Extension compatible version - NO ES MODULES
 */

function debounce(fn, wait = 500) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(null, args), wait);
  };
}

const CONFIG = {
  IGNORE_TEXT: ['Copy', 'Edit', 'Retry'],
  DEDUPE_WINDOW: 10000
};

const buffer = [];
const seen = new Map();

function detectRole(el) {
  try {
    const id = `${el.className || ''} ${Object.values(el.dataset || {}).join(' ')}`.toLowerCase();
    if (/user|human/.test(id)) return 'user';
    if (/assistant|bot|ai|claude/.test(id)) return 'assistant';
    return null;
  } catch (error) {
    console.warn('Error detecting role:', error);
    return null;
  }
}

function pruneSeen() {
  try {
    const cutoff = Date.now() - CONFIG.DEDUPE_WINDOW;
    for (const [text, ts] of seen) {
      if (ts < cutoff) seen.delete(text);
    }
  } catch (error) {
    console.warn('Error pruning seen messages:', error);
  }
}

function collectMessages(node) {
  try {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
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
      buffer.push({ 
        role, 
        content: text, 
        timestamp: new Date().toISOString() 
      });
      
      console.log('Captured message:', role, text.slice(0, 50) + '...');
    }
  } catch (error) {
    console.error('Error collecting messages:', error);
  }
}

async function sendToAPI(payload) {
  try {
    if (!chrome?.runtime?.sendMessage) {
      console.error('Chrome runtime not available');
      return;
    }

    console.log('Sending to background script:', payload);
    
    const response = await chrome.runtime.sendMessage({
      type: 'conversation',
      platform: payload.platform,
      messages: payload.messages
    });
    
    if (response?.success) {
      console.log('Successfully sent conversation to Master Mind AI');
    } else {
      console.error('Background script error:', response?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Message passing failed:', error);
    if (error.message.includes('Extension context invalidated')) {
      setTimeout(() => sendToAPI(payload), 1000);
    }
  }
}

const flush = debounce(async () => {
  try {
    if (!buffer.length) return;
    const payload = { 
      platform: 'claude', 
      messages: buffer.splice(0) 
    };
    await sendToAPI(payload);
  } catch (error) {
    console.error('Error in flush:', error);
  }
}, 500);

function handleMutations(mutations) {
  try {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        collectMessages(node);
        if (node.shadowRoot) observe(node.shadowRoot);
      });
    }
    flush();
  } catch (error) {
    console.error('Error handling mutations:', error);
  }
}

function observe(root) {
  try {
    if (!root) return;
    
    const observer = new MutationObserver(handleMutations);
    observer.observe(root, { 
      childList: true, 
      subtree: true 
    });
    
    console.log('Observer attached to:', root.nodeName || 'shadow-root');
  } catch (error) {
    console.error('Error setting up observer:', error);
  }
}

function initializeCapture() {
  try {
    console.log('Claude conversation capture initialized');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        observe(document.body);
        collectMessages(document.body);
        flush();
      });
    } else {
      observe(document.body);
      collectMessages(document.body);
      flush();
    }
  } catch (error) {
    console.error('Error initializing capture:', error);
  }
}

// Initialize with delay to ensure extension context is ready
setTimeout(initializeCapture, 100);

