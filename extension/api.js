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

    fetchAssignments(baseUrl, userId) {
        const query = userId ? `?userid=${encodeURIComponent(userId)}` : '';
        return this.request(`/api/v1/assignments${query}`, { baseUrl });
    }

    // REVERTED: Keep original working endpoint
    fetchUserAppIds(baseUrl, userId) {
        if (!userId) {
            return Promise.resolve({ app_ids: [] });
        }
        const encodedUserId = encodeURIComponent(userId);
        return this.request(`/api/v1/users/${encodedUserId}/app-ids`, { baseUrl });
    }

    async createAssignment(baseUrl, { userId, appId } = {}) {
        const payload = {};

        if (typeof userId === 'string' && userId.trim()) {
            payload.user_id = userId.trim();
        }

        if (typeof appId === 'string' && appId.trim()) {
            payload.app_id = appId.trim();
        }

        return this.request('/api/v1/assignments/', {
            method: 'POST',
            body: JSON.stringify(payload),
            baseUrl
        });
    }

    async saveConversation(payload) {
        const { userId, appId } = await getSettings();
        const enrichedPayload = { ...payload };
        
        if (userId && !enrichedPayload.user_id) {
            enrichedPayload.user_id = userId;
        }
        if (appId && !enrichedPayload.app_id) {
            enrichedPayload.app_id = appId;
        }
        
        return this.request('/api/v1/conversations', { method: 'POST', body: JSON.stringify(enrichedPayload) });
    }

    enhancePrompt(payload) {
        const body = { ...payload };
        if (body.user_id && !body.user_id) {
            body.user_id = body.user_id;
            delete body.user_id;
        }
        return this.request('/api/v1/prompts/enhance/', { method: 'POST', body: JSON.stringify(body) });
    }

    async searchMemory(payload) {
        const { userId, appId } = await getSettings();
        const body = { ...payload };
        
        if (body.user_id && !body.user_id) {
            body.user_id = body.user_id;
            delete body.user_id;
        }
        
        if (userId) body.user_id = userId;
        if (appId) body.app_id = appId;
        
        return this.request('/api/v1/conversations/search', { method: 'POST', body: JSON.stringify(body) });
    }
}

export const apiClient = new APIClient();
