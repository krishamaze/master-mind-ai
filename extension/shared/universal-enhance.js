/**
 * Universal Enhancement System for Master Mind AI
 * Ensures a consistent floating enhance button experience across platforms.
 */
export class UniversalEnhanceSystem {
  constructor(platform, selectors) {
    this.platform = platform;
    this.selectors = selectors;
    this.button = null;
    this.ui = null;
    this.textManager = null;
    this.initialized = false;
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

    console.log(`🔧 Universal enhance system initialized for ${this.platform}`);
    return true;
  }

  handleEnhance() {
    return new Promise(resolve => {
      console.log('🚀 Universal enhancement started');
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
        console.log('✅ Universal enhancement completed');
        resolve();
      });
    });
  }

  attachToElements(elements = []) {
    if (!this.button || !Array.isArray(elements) || !elements.length) {
      return;
    }

    console.log(`📝 Attaching enhance button to ${elements.length} elements`);
    elements.forEach(el => {
      if (!el || el.dataset.mmEnhanceBound) {
        return;
      }

      el.dataset.mmEnhanceBound = 'true';
      this.button.attach(el);
      console.log('🎯 Button attached universally');
    });
  }
}

export default UniversalEnhanceSystem;
