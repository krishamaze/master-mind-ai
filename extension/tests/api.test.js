import { jest } from '@jest/globals';

const originalConsoleError = console.error;

function createFetchResponse(body = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

describe('APIClient.createAssignment', () => {
  let apiClient;
  let mockGetSettings;

  beforeEach(async () => {
    jest.resetModules();
    console.error = jest.fn();
    mockGetSettings = jest.fn().mockResolvedValue({
      userId: 'user-123',
      appId: 'app-xyz',
      apiBaseUrl: 'https://default.example'
    });
    global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ id: 1 }, 201));

    await jest.unstable_mockModule('../config.js', () => ({
      getSettings: mockGetSettings
    }));

    ({ apiClient } = await import('../api.js'));
  });

  afterEach(() => {
    delete global.fetch;
    jest.resetModules();
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  test('injects the stored user id into the assignment payload', async () => {
    const payload = { app_id: 'ABCDEFGH', user_id: 'malicious-user' };

    await apiClient.createAssignment('https://custom.example', payload);

    expect(mockGetSettings).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);

    const [requestUrl, options] = fetch.mock.calls[0];
    expect(requestUrl).toBe('https://custom.example/api/v1/assignments/');

    expect(options.headers['X-User-Id']).toBe('user-123');
    expect(options.headers['X-App-Id']).toBe('app-xyz');

    const body = JSON.parse(options.body);
    expect(body).toEqual({ app_id: 'ABCDEFGH', user_id: 'user-123' });
    expect(payload.user_id).toBe('user-123');
    expect(payload.app_id).toBe('ABCDEFGH');
  });

  test('falls back to the configured base URL when none is provided', async () => {
    mockGetSettings.mockResolvedValue({
      userId: 'user-abc',
      appId: '',
      apiBaseUrl: 'https://fallback.example'
    });

    await apiClient.createAssignment(undefined, { app_id: 'HGFEDCBA' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, options] = fetch.mock.calls[0];
    expect(requestUrl).toBe('https://fallback.example/api/v1/assignments/');

    const body = JSON.parse(options.body);
    expect(body).toEqual({ app_id: 'HGFEDCBA', user_id: 'user-abc' });
  });
});
