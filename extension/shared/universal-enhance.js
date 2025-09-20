/**
 * Universal Enhancement System for Master Mind AI
 */
import { getSettings } from '../config.js';
import { getRunId } from './thread-context.js';

export class UniversalEnhanceSystem {
  constructor(platform, selectors, placement = null) {
    this.platform = platform;
    this.selectors = selectors;
    this.placement = placement; // stored for compatibility, FloatingEnhanceButton manages positioning
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

    console.log(`🔧 Universal enhance system initialized for ${this.platform}`);
    return true;
  }

  async handleEnhance() {
    console.log('🚀 Universal enhancement started');
    const el = this.button?.target;
    if (!el) {
      return;
    }

    const prompt = this.textManager?.getText(el) ?? '';
    if (!prompt.trim()) {
      return;
    }

    this.ui?.showLoading();

    let appId = '';
    try {
      const { projectId } = await getSettings();
      appId = projectId || '';
    } catch (error) {
      console.warn('Unable to load project settings for enhancement', error);
    }

    const runId = getRunId();
    const message = { type: 'enhance', prompt };
    if (appId) {
      message.app_id = appId;
    }
    if (runId) {
      message.run_id = runId;
    }

    return new Promise(resolve => {
      chrome.runtime.sendMessage(message, res => {
        this.ui?.hide();

        if (chrome.runtime.lastError) {
          console.error('Enhancement request failed', chrome.runtime.lastError);
          this.ui?.showError('Enhancement failed. Please try again.');
          return resolve();
        }

        const enhanced =
          res?.data?.enhanced_prompt ??
          res?.data?.enhancedprompt ??
          res?.enhanced_prompt ??
          res?.enhancedprompt;
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

    const validElements = elements.filter(
      el => el && el.nodeType === (typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1)
    );

    if (!validElements.length) return;

    validElements.forEach(el => {
      if (!el.dataset || el.dataset.mmEnhanceBound) return;

      el.dataset.mmEnhanceBound = 'true';

      try {
        this.button.attach(el);
        console.log(`✅ Button attached to ${this.platform}`);
      } catch (error) {
        console.error(`❌ Failed to attach button on ${this.platform}:`, error);
      }
    });
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
