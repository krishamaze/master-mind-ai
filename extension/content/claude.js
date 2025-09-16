(async () => {
  try {
    console.log('🚀 Loading Claude content script...');
    
    const [
      { default: DOMObserver },
      { getPlatformConfig },
      { UniversalEnhanceSystem }
    ] = await Promise.all([
      import(chrome.runtime.getURL('shared/dom-observer.js')),
      import(chrome.runtime.getURL('shared/platform-config.js')),
      import(chrome.runtime.getURL('shared/universal-enhance.js'))
    ]);

    const { platform, selectors, placement } = getPlatformConfig('claude');
    const observer = new DOMObserver(selectors);
    const enhanceSystem = new UniversalEnhanceSystem(platform, selectors, placement);
    await enhanceSystem.initialize();

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
      enhanceSystem.attachDebounced(elements);
    });

    observer.start();
    console.log('✅ Claude content script loaded');

  } catch (error) {
    console.error('❌ Failed to load Claude content script:', error);
  }
})();
