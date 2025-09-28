import { getSettings } from './config.js';

class APIClient {
  async request(path, { method = 'GET', body, baseUrl } = {}) {
    const { apiBaseUrl, userId, appId } = await getSettings();
    const url = `${baseUrl ?? apiBaseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };

    if (userId) {
      headers['X-User-Id'] = userId;
    }

    if (appId) {
      headers['X-App-Id'] = appId;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`🌐 API Request: ${method} ${url} (attempt ${attempt + 1})`);
        const res = await fetch(url, { method, headers, body });

        if (res.status === 429) {
          const wait = 2 ** attempt * 1000;
          console.log(`⏳ Rate limited, waiting ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          console.error(`❌ API Error ${res.status}:`, text);
          throw new Error(text || res.statusText);
        }

        const result = res.status === 204 ? null : await res.json();
        console.log(`✅ API Success: ${method} ${path}`);
        return result;
      } catch (err) {
        console.error(`Request failed (attempt ${attempt + 1}):`, err.message);
        if (attempt === 2) {
          console.error('All retry attempts failed');
          throw err;
        }
        const wait = 2 ** attempt * 1000;
        console.log(`Retrying in ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  healthCheck() {
    return this.request('/api/v1/health');
  }

  fetchUserAppIds(baseUrl, userId) {
    if (!userId) {
      return Promise.resolve({ app_ids: [] });
    }
    const encodedUserId = encodeURIComponent(userId);
    return this.request(`/api/v1/users/${encodedUserId}/app-ids`, { baseUrl });
  }

  async createAssignment(baseUrl, identifiers = {}) {
    const payload = {};
    const { userId, appId, user_id: snakeUserId, app_id: snakeAppId } = identifiers;

    const normalizedUserId =
      typeof userId === 'string' && userId.trim()
        ? userId.trim()
        : typeof snakeUserId === 'string' && snakeUserId.trim()
          ? snakeUserId.trim()
          : '';
    const normalizedAppId =
      typeof appId === 'string' && appId.trim()
        ? appId.trim()
        : typeof snakeAppId === 'string' && snakeAppId.trim()
          ? snakeAppId.trim()
          : '';

    if (normalizedUserId) {
      payload.user_id = normalizedUserId;
    }

    if (normalizedAppId) {
      payload.app_id = normalizedAppId;
    }

    return this.request('/api/v1/assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
      baseUrl
    });
  }

  enhancePrompt(payload) {
    const body = { ...payload };
    return this.request('/api/v1/prompts/enhance', { method: 'POST', body: JSON.stringify(body) });
  }

  async searchMemories(payload) {
    const { userId, appId } = await getSettings();
    const body = { ...payload };

    if (userId && !body.user_id) {
      body.user_id = userId;
    }
    if (appId && !body.app_id) {
      body.app_id = appId;
    }

    return this.request('/api/v1/memories/search', { method: 'POST', body: JSON.stringify(body) });
  }
}

export const apiClient = new APIClient();
