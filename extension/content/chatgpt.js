import DOMObserver from '../shared/dom-observer.js';
import { getPlatformConfig } from '../shared/platform-config.js';
import FloatingEnhanceButton from '../shared/floating-enhance-button.js';
import TextReplacementManager from '../shared/text-replacement-manager.js';
import EnhancementUI from '../shared/enhancement-ui.js';

const { platform, selectors } = getPlatformConfig('chatgpt');

const observer = new DOMObserver(selectors);
const ui = new EnhancementUI();
const button = new FloatingEnhanceButton(() => handleEnhance());

observer.subscribe('conversation-capture', () => {
  const nodes = document.querySelectorAll(selectors['conversation-capture']);
  const messages = Array.from(nodes, n => n.innerText.trim()).filter(Boolean);
  if (messages.length) {
    chrome.runtime.sendMessage({ type: 'conversation', platform, messages }, res => {
      if (!res?.success) {
        console.error('Failed to save conversation', res?.error);
      }
    });
  }
});

observer.subscribe('input-detection', elements => {
  elements.forEach(el => {
    if (el.dataset.mmEnhanceBound) return;
    el.dataset.mmEnhanceBound = 'true';

    const updateButton = () => {
      if (document.activeElement === el && TextReplacementManager.hasMinimumText(el)) {
        button.attach(el);
      } else if (button.target === el) {
        button.detach();
      }
    };

    el.addEventListener('input', updateButton);
    el.addEventListener('focus', updateButton);
    el.addEventListener('blur', () => {
      if (button.target === el) button.detach();
    });
  });
});

function handleEnhance() {
  const el = button.target;
  if (!el) return;
  const prompt = TextReplacementManager.getText(el);
  if (!prompt.trim()) return;
  ui.showLoading();
  chrome.runtime.sendMessage({ type: 'enhance', prompt }, res => {
    const enhanced = res?.data?.enhanced_prompt;
    if (chrome.runtime.lastError || !res?.success || !enhanced) {
      ui.showError('Sorry, enhancement is unavailable. Please try again later.');
      return;
    }
    ui.showPreview(enhanced).then(use => {
      if (use) {
        TextReplacementManager.setText(el, enhanced);
      }
    });
  });
}

observer.start();
