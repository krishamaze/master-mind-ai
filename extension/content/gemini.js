(async () => {
  try {
    console.log('🚀 Loading Gemini content script...');
    
    const [
      { default: DOMObserver },
      { getPlatformConfig }
    ] = await Promise.all([
      import(chrome.runtime.getURL('shared/dom-observer.js')),
      import(chrome.runtime.getURL('shared/platform-config.js'))
    ]);

    const { platform, selectors } = getPlatformConfig('gemini');
    const observer = new DOMObserver(selectors);

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
        
        el.addEventListener('keydown', e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            const prompt = el.value || el.textContent || '';
            if (!prompt.trim()) return;
            
            chrome.runtime.sendMessage({ type: 'enhance', prompt }, res => {
              if (res?.success && res.data?.enhanced_prompt) {
                el.value = res.data.enhanced_prompt;
              }
            });
            e.preventDefault();
          }
        });
      });
    });

    observer.start();
    console.log('✅ Gemini content script loaded');

  } catch (error) {
    console.error('❌ Failed to load Gemini content script:', error);
  }
})();
