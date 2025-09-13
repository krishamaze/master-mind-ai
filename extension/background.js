import { apiClient } from './api.js';

let healthStatus = { ok: false };

async function checkHealth() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await apiClient.healthCheck();
      healthStatus = { ok: true };
      return;
    } catch (error) {
      healthStatus = { ok: false, error: error.message };
      const wait = 2 ** attempt * 1000;
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

checkHealth();
chrome.runtime.onStartup.addListener(checkHealth);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'health-check') {
    checkHealth().then(() => sendResponse(healthStatus));
    return true;
  }
  if (msg.type === 'health') {
    sendResponse(healthStatus);
    return true;
  }

  if (msg.type === 'conversation') {
    apiClient
      .saveConversation({ platform: msg.platform, messages: msg.messages })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (msg.type === 'enhance') {
    apiClient
      .enhancePrompt({ prompt: msg.prompt })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (msg.type === 'search') {
    apiClient
      .searchMemory({ query: msg.query })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
