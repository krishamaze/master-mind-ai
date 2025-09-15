(async () => {
  try {
    console.log('🚀 Loading ChatGPT content script...');
    
    const [
      { default: DOMObserver },
      { getPlatformConfig },
      { default: FloatingEnhanceButton },
      { default: TextReplacementManager },
      { default: EnhancementUI }
    ] = await Promise.all([
      import(chrome.runtime.getURL('shared/dom-observer.js')),
      import(chrome.runtime.getURL('shared/platform-config.js')),
      import(chrome.runtime.getURL('shared/floating-enhance-button.js')),
      import(chrome.runtime.getURL('shared/text-replacement-manager.js')),
      import(chrome.runtime.getURL('shared/enhancement-ui.js'))
    ]);

    console.log('✅ All modules loaded successfully');

    const { platform, selectors } = getPlatformConfig('chatgpt');
    const observer = new DOMObserver(selectors);
    const ui = new EnhancementUI();
    const button = new FloatingEnhanceButton(() => handleEnhance());

    console.log('🔍 Platform config:', platform, selectors);

    function handleEnhance() {
      return new Promise(resolve => {
        console.log('🚀 Enhancement process started');
        const el = button.target;
        if (!el) return resolve();

        const prompt = TextReplacementManager.getText(el);
        if (!prompt.trim()) return resolve();

        ui.showLoading();

        chrome.runtime.sendMessage({ type: 'enhance', prompt }, res => {
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
