/**
 * Universal Enhancement System for Master Mind AI
 * Enhanced with placement-aware positioning
 */
export class UniversalEnhanceSystem {
  constructor(platform, selectors, placement = null) {
    this.platform = platform;
    this.selectors = selectors;
    this.placement = placement;
    this.button = null;
    this.ui = null;
    this.textManager = null;
    this.initialized = false;
    this.attachDebounced = this.debounce(this.attachToElements.bind(this), 100);
  }

  async initialize() {
    if (this.initialized) {
      return true;
    }

    const [
      { default: FloatingEnhanceButton },
      { default: TextReplacementManager },
      { default: EnhancementUI }
    ] = await Promise.all([
      import(chrome.runtime.getURL('shared/floating-enhance-button.js')),
      import(chrome.runtime.getURL('shared/text-replacement-manager.js')),
      import(chrome.runtime.getURL('shared/enhancement-ui.js'))
    ]);

    this.ui = new EnhancementUI();
    this.button = new FloatingEnhanceButton(() => this.handleEnhance());
    this.textManager = TextReplacementManager;
    this.initialized = true;

    console.log(`\uD83D\uDD27 Universal enhance system initialized for ${this.platform}`);
    return true;
  }

  handleEnhance() {
    return new Promise(resolve => {
      console.log('\uD83D\uDE80 Universal enhancement started');
      const el = this.button?.target;
      if (!el) {
        return resolve();
      }

      const prompt = this.textManager?.getText(el) ?? '';
      if (!prompt.trim()) {
        return resolve();
      }

      this.ui?.showLoading();

      chrome.runtime.sendMessage({ type: 'enhance', prompt }, res => {
        this.ui?.hide();

        if (chrome.runtime.lastError) {
          console.error('Enhancement request failed', chrome.runtime.lastError);
          this.ui?.showError('Enhancement failed. Please try again.');
          return resolve();
        }

        const enhanced = res?.data?.enhanced_prompt;
        if (!enhanced) {
          this.ui?.showError('Enhancement failed. Please try again.');
          return resolve();
        }

        this.textManager?.setText(el, enhanced);
        console.log('\u2705 Universal enhancement completed');
        resolve();
      });
    });
  }

  attachToElements(elements = []) {
    if (!this.button || !Array.isArray(elements) || !elements.length) {
      return;
    }

    const elementNodeType = typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1;
    const validElements = elements.filter(
      el => el && el.nodeType === elementNodeType
    );

    if (!validElements.length) {
      return;
    }

    console.log(`\uD83D\uDCDD Attaching enhance button to ${validElements.length} elements on ${this.platform}`);
    validElements.forEach(el => {
      if (!el.dataset || el.dataset.mmEnhanceBound) {
        return;
      }

      el.dataset.mmEnhanceBound = 'true';

      if (this.placement) {
        this.applyPlacement(el);
      }

      this.button.attach(el);
      console.log(`\uD83C\uDFAF Button attached to ${this.platform} with placement:`, this.placement?.strategy || 'default');
    });
  }

  applyPlacement(element) {
    if (!this.placement || !this.button) return;

    const buttonEl = this.button.element || this.button.button || null;
    if (!buttonEl) return;

    switch (this.placement.strategy) {
      case 'float':
        buttonEl.style.setProperty('position', 'absolute');
        if (this.placement.gap) {
          buttonEl.style.setProperty('margin', `${this.placement.gap}px`);
        }
        break;

      case 'inline':
        if (this.placement.inlineAlign === 'end') {
          buttonEl.style.setProperty('margin-left', 'auto');
        }
        break;
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

export default UniversalEnhanceSystem;
