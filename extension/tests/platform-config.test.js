import { detectPlatform, getPlatformConfig } from '../shared/platform-config.js';

describe('platform config', () => {
  test('detects platform from url', () => {
    expect(detectPlatform('https://chat.openai.com')).toBe('chatgpt');
    expect(detectPlatform('https://claude.ai/chat')).toBe('claude');
    expect(detectPlatform('https://gemini.google.com/app')).toBe('gemini');
    expect(detectPlatform('https://perplexity.ai/search')).toBe('perplexity');
  });

  test('returns selectors for platform', () => {
    const { selectors, placement } = getPlatformConfig('gemini');
    expect(selectors['conversation-capture']).toBe('[data-message-id]');
    expect(placement).toEqual({ strategy: 'inline', where: 'beforeend', inlineAlign: 'end' });
  });

  test('provides defaults for unknown platform', () => {
    const config = getPlatformConfig('unknown');
    expect(config).toEqual({ platform: 'unknown', selectors: {}, placement: null });
  });
});
