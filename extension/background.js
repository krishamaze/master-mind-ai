import { apiClient } from './api.js';
import { getSettings } from './config.js';

let healthStatus = { ok: false };

async function checkHealth() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await apiClient.healthCheck();
      healthStatus = { ok: true };
      console.log('✅ Master Mind AI backend is healthy');
      return;
    } catch (error) {
      healthStatus = { ok: false, error: error.message };
      console.error(`❌ Health check failed (attempt ${attempt + 1}):`, error.message);
      if (attempt < 2) {
        const wait = 2 ** attempt * 1000;
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
}

// Initialize health check
checkHealth();

// Event listeners
chrome.runtime.onStartup.addListener(() => checkHealth());
chrome.runtime.onInstalled.addListener(() => checkHealth());

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('📨 Received message:', msg.type);

  if (msg.type === 'health-check') {
    checkHealth().then(() => sendResponse(healthStatus));
    return true;
  }

  if (msg.type === 'health') {
    sendResponse(healthStatus);
    return true;
  }

  if (msg.type === 'conversation') {
    console.log('ℹ️ Conversation capture received but backend does not expose a conversations endpoint.');
    sendResponse({ success: true, data: { persisted: false } });
    return true;
  }

  if (msg.type === 'console-logs') {
    console.log('ℹ️ Console log forwarding disabled for FastAPI backend');
    sendResponse({ success: true, data: { forwarded: false } });
    return true;
  }

  if (msg.type === 'enhance') {
    console.log('🚀 Enhancing prompt:', msg.prompt?.slice(0, 50) + '...');
    handleEnhancement(msg.prompt, msg.app_id, msg.run_id, msg.user_id)
      .then(data => {
        console.log('✅ Prompt enhanced successfully');
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('❌ Failed to enhance prompt:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (msg.type === 'search') {
    console.log('🔍 Searching memory:', msg.query);
    apiClient
      .searchMemories({ query: msg.query })
      .then(data => {
        console.log('✅ Memory search completed');
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('❌ Memory search failed:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Handle unknown message types
  console.warn('❓ Unknown message type:', msg.type);
  sendResponse({ success: false, error: 'Unknown message type' });
  return true;
});

async function handleEnhancement(prompt, appId, runId, userIdOverride) {
  const payload = { prompt };
  const { userId, appId: storedAppId } = await getSettings();

  const effectiveUser = userIdOverride || userId;
  if (effectiveUser) {
    payload.user_id = effectiveUser;
  }

  const effectiveApp = appId || storedAppId;
  if (effectiveApp) {
    payload.app_id = effectiveApp;
  }

  if (runId) {
    payload.run_id = runId;
  }

  return apiClient.enhancePrompt(payload);
}

console.log('🚀 Master Mind AI background script loaded');
