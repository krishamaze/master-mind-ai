import { getSettings } from './config.js';

class APIClient {
  async request(path, { method = 'GET', body } = {}) {
    const { apiBaseUrl, apiToken } = await getSettings();
    const url = `${apiBaseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { method, headers, body });
        if (res.status === 429) {
          const wait = 2 ** attempt * 1000;
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }
        return res.status === 204 ? null : await res.json();
      } catch (err) {
        if (attempt === 2) throw err;
        const wait = 2 ** attempt * 1000;
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  healthCheck() {
    return this.request('/api/v1/health/');
  }

  saveConversation(payload) {
    return this.request('/api/v1/conversations/', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  enhancePrompt(payload) {
    return this.request('/api/v1/prompts/enhance/', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  searchMemory(payload) {
    return this.request('/api/v1/conversations/search/', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

export const apiClient = new APIClient();
