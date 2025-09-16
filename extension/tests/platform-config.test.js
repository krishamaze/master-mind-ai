import { detectPlatform, getPlatformConfig } from '../shared/platform-config.js';

describe('platform config V1.0', () => {
  test('detects all platform URLs including www variants', () => {
    expect(detectPlatform('https://perplexity.ai/search')).toBe('perplexity');
    expect(detectPlatform('https://www.perplexity.ai/search')).toBe('perplexity');
  });

  test('all platforms use unified inline placement', () => {
    ['chatgpt', 'claude', 'gemini', 'perplexity'].forEach(platform => {
      const { placement } = getPlatformConfig(platform);
      expect(placement.strategy).toBe('inline');
    });
  });

  test('enhanced input detection selectors', () => {
    const { selectors } = getPlatformConfig('perplexity');
    expect(selectors['input-detection']).toContain('textarea');
    expect(selectors['input-detection']).toContain('[contenteditable]');
    expect(selectors['input-detection']).toContain('input[type="text"]');
  });
});
