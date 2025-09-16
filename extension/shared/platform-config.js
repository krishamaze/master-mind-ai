const PLATFORM_CONFIG = {
  chatgpt: {
    matches: [/chat\.openai\.com/, /chatgpt\.com/],
    selectors: {
      'conversation-capture': 'main .markdown',
      'input-detection': 'div#prompt-textarea[contenteditable="true"], .ProseMirror[contenteditable="true"]',
      'message-updates': 'main .markdown'
    },
    placement: { strategy: 'inline', where: 'beforeend', inlineAlign: 'end' }
  },

  claude: {
    matches: [/claude\.ai/],
    selectors: {
      'conversation-capture': '[data-testid="conversation-message"]',
      'input-detection': 'textarea, [contenteditable="true"]',
      'message-updates': '[data-testid="conversation-message"]'
    },
    placement: { strategy: 'float', placement: 'right-start', gap: 8 }
  },

  gemini: {
    matches: [/gemini\.google\.com/],
    selectors: {
      'conversation-capture': '[data-message-id]',
      'input-detection': 'textarea',
      'message-updates': '[data-message-id]'
    },
    placement: { strategy: 'inline', where: 'beforeend', inlineAlign: 'end' }
  },

  perplexity: {
    matches: [/perplexity\.ai/],
    selectors: {
      'conversation-capture': '[data-testid="conversation-turn"], .conversation-item',
      'input-detection': 'textarea[placeholder*="Ask"], textarea[id="ask-input"], [contenteditable="true"]',
      'message-updates': '[data-testid="conversation-turn"], .conversation-item',
      'submit-button': 'button[aria-label="Submit"]'
    },
    placement: { strategy: 'inline', where: 'beforeend', inlineAlign: 'end' }
  }
};

export function detectPlatform(url = window.location.href) {
  return Object.keys(PLATFORM_CONFIG).find(key =>
    PLATFORM_CONFIG[key].matches.some(re => re.test(url))
  );
}

export function getPlatformConfig(platform = detectPlatform()) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) return { platform, selectors: {}, placement: null };

  return {
    platform,
    selectors: config.selectors || {},
    placement: config.placement || null
  };
}

export { PLATFORM_CONFIG };
export default { detectPlatform, getPlatformConfig, PLATFORM_CONFIG };
