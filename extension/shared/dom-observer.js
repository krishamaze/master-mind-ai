// Centralized DOM Mutation Observer with subscriber support
// Observes DOM changes and notifies registered callbacks for specific event types.

export class DOMObserver {
  constructor(selectors = {}) {
    this.selectors = selectors; // { eventType: cssSelector }
    this.callbacks = {}; // { eventType: [fn, ...] }
    this.observer = null;
    this.debouncers = {}; // { eventType: debouncedFn }
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
    if (!elements.length) return;
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
  }

  _debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
}

export default DOMObserver;
