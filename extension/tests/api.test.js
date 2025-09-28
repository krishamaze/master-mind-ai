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

  test('sends trimmed identifiers in the payload', async () => {
    await apiClient.createAssignment('https://custom.example', {
      userId: ' user-123 ',
      appId: ' NewApp01 '
    });

    expect(mockGetSettings).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);

    const [requestUrl, options] = fetch.mock.calls[0];
    expect(requestUrl).toBe('https://custom.example/api/v1/assignments');

    const body = JSON.parse(options.body);
    expect(body).toEqual({ app_id: 'NewApp01', user_id: 'user-123' });
  });

  test('omits empty values from the payload', async () => {
    await apiClient.createAssignment('https://custom.example', {
      userId: '   ',
      appId: 'NewApp01'
    });

    const [, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toEqual({ app_id: 'NewApp01' });
  });

  test('falls back to the configured base URL when none is provided', async () => {
    mockGetSettings.mockResolvedValue({
      userId: 'user-abc',
      appId: '',
      apiBaseUrl: 'https://fallback.example'
    });

    await apiClient.createAssignment(undefined, { userId: 'user-abc', appId: 'HGFEDCBA' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, options] = fetch.mock.calls[0];
    expect(requestUrl).toBe('https://fallback.example/api/v1/assignments');

    const body = JSON.parse(options.body);
    expect(body).toEqual({ app_id: 'HGFEDCBA', user_id: 'user-abc' });
  });
});
