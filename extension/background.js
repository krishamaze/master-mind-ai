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
    handleConversationCapture(msg.platform, msg.messages);

    console.log('💾 Saving conversation:', msg.platform, msg.messages?.length, 'messages');
    apiClient
      .saveConversation({
        platform: msg.platform,
        messages: msg.messages,
        timestamp: new Date().toISOString()
      })
      .then(data => {
        console.log('✅ Conversation saved successfully');
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('❌ Failed to save conversation:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (msg.type === 'enhance') {
    console.log('🚀 Enhancing prompt:', msg.prompt?.slice(0, 50) + '...');
    handleEnhancement(msg.prompt)
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
      .searchMemory({ query: msg.query })
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

async function handleConversationCapture(platform, messages) {
  try {
    if (!Array.isArray(messages) || !messages.length) {
      return;
    }

    const storageData = await getStorageData([
      'apiKey',
      'accessToken',
      'userId',
      'memoryEnabled',
      'apiToken'
    ]);
    const { apiKey, accessToken, userId, memoryEnabled, apiToken } = storageData;

    if (!memoryEnabled) {
      return;
    }

    const authToken = accessToken || apiKey || apiToken;
    if (!authToken) {
      return;
    }

    const authHeader = accessToken
      ? `Bearer ${accessToken}`
      : `Token ${apiKey || apiToken}`;

    await fetch('https://api.mem0.ai/v1/memories/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify({
        messages: messages.map(msg => ({ role: 'user', content: msg })),
        user_id: userId || 'chrome-extension-user',
        infer: true,
        metadata: { provider: platform },
        source: 'OPENMEMORY_CHROME_EXTENSION'
      })
    }).catch(error => console.log('Memory storage failed:', error));
  } catch (error) {
    console.log('Conversation capture failed:', error);
  }
}

async function handleEnhancement(prompt) {
  const payload = { prompt };
  const { userId } = await getSettings();
  if (userId) {
    payload.user_id = userId;
  }
  return apiClient.enhancePrompt(payload);
}

function getStorageData(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, data => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(data);
    });
  });
}

console.log('🚀 Master Mind AI background script loaded');
