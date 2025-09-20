(async () => {
  try {
    console.log('🚀 Loading ChatGPT content script...');
    
    const [
      { default: DOMObserver },
      { getPlatformConfig },
      { default: FloatingEnhanceButton },
      { default: TextReplacementManager },
      { default: EnhancementUI },
      { getRunId },
      { getSettings }
    ] = await Promise.all([
      import(chrome.runtime.getURL('shared/dom-observer.js')),
      import(chrome.runtime.getURL('shared/platform-config.js')),
      import(chrome.runtime.getURL('shared/floating-enhance-button.js')),
      import(chrome.runtime.getURL('shared/text-replacement-manager.js')),
      import(chrome.runtime.getURL('shared/enhancement-ui.js')),
      import(chrome.runtime.getURL('shared/thread-context.js')),
      import(chrome.runtime.getURL('config.js'))
    ]);

    console.log('✅ All modules loaded successfully');

    const { platform, selectors } = getPlatformConfig('chatgpt');
    const observer = new DOMObserver(selectors);
    const ui = new EnhancementUI();
    const button = new FloatingEnhanceButton(() => handleEnhance());

    console.log('🔍 Platform config:', platform, selectors);

    async function handleEnhance() {
      console.log('🚀 Enhancement process started');
      const el = button.target;
      if (!el) return;

      const prompt = TextReplacementManager.getText(el);
      if (!prompt.trim()) return;

      ui.showLoading();

      const message = { type: 'enhance', prompt };

      try {
        const { projectId } = await getSettings();
        if (projectId) {
          message.app_id = projectId;
        }
      } catch (error) {
        console.warn('Failed to load project settings for ChatGPT enhancement', error);
      }

      const runId = getRunId();
      if (runId) {
        message.run_id = runId;
      }

      return new Promise(resolve => {
        chrome.runtime.sendMessage(message, res => {
          ui.hide();
          const enhanced = res?.data?.enhanced_prompt;
          if (!enhanced) {
            ui.showError('Enhancement failed. Please try again.');
            return resolve();
          }
          TextReplacementManager.setText(el, enhanced);
          console.log('✅ Text replaced');
          resolve();
        });
      });
    }

    observer.subscribe('input-detection', elements => {
      console.log('📝 Found input elements:', elements.length);
      elements.forEach(el => {
        if (!el.dataset.mmEnhanceBound) {
          el.dataset.mmEnhanceBound = 'true';
          button.attach(el);
          console.log('🎯 Button attached');
        }
      });
    });

    observer.start();
    console.log('👀 Observer started');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
})();
