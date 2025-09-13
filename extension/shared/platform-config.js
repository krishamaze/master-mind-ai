// Platform-specific DOM selectors and detection logic
// Extend PLATFORM_CONFIG to support additional platforms.

const PLATFORM_CONFIG = {
  chatgpt: {
    matches: [/chat\.openai\.com/],
    selectors: {
      'conversation-capture': 'main .markdown',
      'input-detection': 'textarea#prompt-textarea',
      'message-updates': 'main .markdown'
    }
  },
  claude: {
    matches: [/claude\.ai/],
    selectors: {
      'conversation-capture': '[data-testid="conversation-message"]',
      'input-detection': 'textarea, [contenteditable="true"]',
      'message-updates': '[data-testid="conversation-message"]'
    }
  },
  gemini: {
    matches: [/gemini\.google\.com/],
    selectors: {
      'conversation-capture': '[data-message-id]',
      'input-detection': 'textarea',
      'message-updates': '[data-message-id]'
    }
  }
};

export function detectPlatform(url = window.location.href) {
  return Object.keys(PLATFORM_CONFIG).find(key =>
    PLATFORM_CONFIG[key].matches.some(re => re.test(url))
  );
}

export function getPlatformConfig(platform = detectPlatform()) {
  return { platform, selectors: PLATFORM_CONFIG[platform]?.selectors || {} };
}

export { PLATFORM_CONFIG };

export default { detectPlatform, getPlatformConfig, PLATFORM_CONFIG };
