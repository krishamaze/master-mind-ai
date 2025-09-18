import { getSettings } from './config.js';

class APIClient {
  async request(path, { method = 'GET', body, baseUrl } = {}) {
    const { apiBaseUrl } = await getSettings();
    const url = `${baseUrl ?? apiBaseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };

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
        console.error(`❌ Request failed (attempt ${attempt + 1}):`, err.message);
        if (attempt === 2) {
          console.error('❌ All retry attempts failed');
          throw err;
        }

        const wait = 2 ** attempt * 1000;
        console.log(`⏳ Retrying in ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  healthCheck() {
    return this.request('/api/v1/health/');
  }

  fetchProjects(baseUrl) {
    return this.request('/api/v1/projects/', { baseUrl });
  }

  saveConversation(payload) {
    return this.request('/api/v1/conversations/', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async enhancePrompt(payload) {
    const enhancedPayload = { prompt: payload.prompt };
    if (payload.user_id) {
      enhancedPayload.user_id = payload.user_id;
    } else {
      const { userId } = await getSettings();
      if (userId) {
        enhancedPayload.user_id = userId;
      }
    }

    return this.request('/api/v1/prompts/enhance/', {
      method: 'POST',
      body: JSON.stringify(enhancedPayload)
    });
  }

  async searchMemory(payload) {
    const { userId } = await getSettings();
    const body = { ...payload };
    if (userId) {
      body.user_id = userId;
    }
    return this.request('/api/v1/conversations/search/', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}

export const apiClient = new APIClient();
