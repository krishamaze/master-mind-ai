(async () => {
  try {
    console.log('🚀 Loading Perplexity content script...');

    const modules = await Promise.all([
      import(chrome.runtime.getURL('shared/dom-observer.js')),
      import(chrome.runtime.getURL('shared/platform-config.js')),
      import(chrome.runtime.getURL('shared/universal-enhance.js'))
    ]);

    const [
      { default: DOMObserver },
      { getPlatformConfig },
      { UniversalEnhanceSystem }
    ] = modules;

    const { platform, selectors, placement } = getPlatformConfig('perplexity');
    const observer = new DOMObserver(selectors);
    const enhanceSystem = new UniversalEnhanceSystem(platform, selectors, placement);

    if (!(await enhanceSystem.initialize())) {
      throw new Error('Failed to initialize enhance system');
    }

    observer.subscribe('conversation-capture', () => {
      try {
        const nodes = document.querySelectorAll(selectors['conversation-capture']);
        const messages = Array.from(nodes, n => n.innerText.trim()).filter(Boolean);
        if (messages.length) {
          chrome.runtime.sendMessage({ type: 'conversation', platform, messages }, res => {
            if (chrome.runtime.lastError) {
              console.warn('Conversation capture failed:', chrome.runtime.lastError);
            } else if (!res?.success) {
              console.warn('Conversation capture response indicated failure:', res?.error);
            }
          });
        }
      } catch (error) {
        console.error('Conversation capture error:', error);
      }
    });

    observer.subscribe('input-detection', elements => {
      try {
        enhanceSystem.attachDebounced(elements);
      } catch (error) {
        console.error('Button attachment error:', error);
      }
    });

    observer.start();
    console.log('✅ Perplexity content script loaded successfully');

    window.addEventListener('beforeunload', () => {
      try {
        observer.cleanup();
      } catch (error) {
        console.warn('Cleanup warning:', error);
      }
    });
  } catch (error) {
    console.error('❌ Critical error loading Perplexity content script:', error);
  }
})();
