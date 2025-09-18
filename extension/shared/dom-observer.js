// Centralized DOM Mutation Observer with subscriber support
// Observes DOM changes and notifies registered callbacks for specific event types.

import { clearRunId as clearGlobalRunId, setRunId as setGlobalRunId } from './thread-context.js';

export class DOMObserver {
  constructor(selectors = {}) {
    this.selectors = selectors; // { eventType: cssSelector }
    this.callbacks = {}; // { eventType: [fn, ...] }
    this.observer = null;
    this.debouncers = {}; // { eventType: debouncedFn }
    this.inputHandlers = new Map(); // Map<Element, handler>
    this.currentRunId = null;
    this.conversationContainer = null;
    this.conversationHasMessages = false;
  }

  subscribe(type, callback) {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
  }

  start(root = document.body) {
    if (this.observer) return;

    this.observer = new MutationObserver(() => {
      Object.keys(this.selectors).forEach(type => this._schedule(type));
    });

    this.observer.observe(root, { childList: true, subtree: true });

    // Initial trigger to capture existing DOM state
    Object.keys(this.selectors).forEach(type => this._schedule(type));
  }

  _schedule(type) {
    if (!this.debouncers[type]) {
      this.debouncers[type] = this._debounce(() => this._notify(type), 300);
    }
    this.debouncers[type]();
  }

  _notify(type) {
    const selector = this.selectors[type];
    if (!selector) return;
    const elements = Array.from(document.querySelectorAll(selector));
    if (!elements.length) {
      if (type === 'conversation-capture') {
        this._handleConversationCleared();
      }
      return;
    }

    if (type === 'conversation-capture') {
      this._rememberConversationContainer(elements);
      this.conversationHasMessages = true;
    }

    if (type === 'input-detection') {
      this._attachInputListeners(elements);
    }
    const subs = this.callbacks[type] || [];
    subs.forEach(cb => cb(elements));
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  cleanup() {
    this.stop();
    this.callbacks = {};
    this.debouncers = {};
    this._detachInputListeners();
    this.clearCurrentRunId();
    this.conversationContainer = null;
    this.conversationHasMessages = false;
  }

  _debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  _attachInputListeners(elements = []) {
    elements.forEach(el => {
      if (!el || this.inputHandlers.has(el) || typeof el.addEventListener !== 'function') {
        return;
      }

      const handler = () => this._onUserInput();
      el.addEventListener('input', handler);
      this.inputHandlers.set(el, handler);
    });
  }

  _detachInputListeners() {
    this.inputHandlers.forEach((handler, el) => {
      if (el && typeof el.removeEventListener === 'function') {
        el.removeEventListener('input', handler);
      }
    });
    this.inputHandlers.clear();
  }

  _onUserInput() {
    this._checkThreadState();
  }

  _checkThreadState() {
    if (this._isConversationEmpty()) {
      if (!this.getCurrentRunId()) {
        this.generateNewRunId();
      }
    }
  }

  _isConversationEmpty() {
    const container = this._getConversationContainer();
    const captureSelector = this.selectors['conversation-capture'];

    if (container) {
      const relevantChildren = captureSelector
        ? Array.from(container.querySelectorAll(captureSelector))
        : Array.from(container.children);
      const meaningfulNodes = relevantChildren.filter(node => this._nodeHasMeaningfulContent(node));
      if (meaningfulNodes.length === 0) {
        return true;
      }
      return false;
    }

    if (!captureSelector) {
      return false;
    }

    const messageNodes = Array.from(document.querySelectorAll(captureSelector)).filter(node =>
      this._nodeHasMeaningfulContent(node)
    );
    return messageNodes.length === 0;
  }

  _getConversationContainer() {
    const containerSelector = this.selectors['conversation-container'];
    if (containerSelector) {
      const container = document.querySelector(containerSelector);
      if (container) {
        this.conversationContainer = container;
        return container;
      }
    }

    if (this.conversationContainer && this.conversationContainer.isConnected) {
      return this.conversationContainer;
    }

    const captureSelector = this.selectors['conversation-capture'];
    if (!captureSelector) {
      return this.conversationContainer;
    }

    const firstMessage = document.querySelector(captureSelector);
    if (firstMessage) {
      const container = firstMessage.parentElement;
      if (container) {
        this.conversationContainer = container;
        return container;
      }
    }

    return this.conversationContainer;
  }

  _rememberConversationContainer(elements = []) {
    if (this.conversationContainer && this.conversationContainer.isConnected) {
      return;
    }

    if (!Array.isArray(elements) || !elements.length) {
      return;
    }

    const directParent = elements[0]?.parentElement;
    if (directParent) {
      this.conversationContainer = directParent;
      return;
    }

    this._getConversationContainer();
  }

  _nodeHasMeaningfulContent(node) {
    if (!node) return false;
    if (typeof node.innerText === 'string' && node.innerText.trim()) return true;
    if (typeof node.textContent === 'string' && node.textContent.trim()) return true;
    return false;
  }

  _handleConversationCleared() {
    if (!this.conversationHasMessages) {
      return;
    }

    this.conversationHasMessages = false;
    this.clearCurrentRunId();
  }

  getCurrentRunId() {
    return this.currentRunId;
  }

  clearCurrentRunId() {
    if (this.currentRunId === null) {
      return;
    }
    this.currentRunId = null;
    clearGlobalRunId();
  }

  generateNewRunId() {
    const newRunId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.setCurrentRunId(newRunId);
    return newRunId;
  }

  setCurrentRunId(runId) {
    this.currentRunId = runId;
    setGlobalRunId(runId);
    return this.currentRunId;
  }
}

export default DOMObserver;
