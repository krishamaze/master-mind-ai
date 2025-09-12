const API = {
  store: '/api/v1/conversations/',
  search: '/api/v1/conversations/search/'
};

async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      { apiBaseUrl: 'http://localhost:8000', apiToken: '' },
      resolve
    );
  });
}

async function apiCall(path, payload) {
  const { apiBaseUrl, apiToken } = await getSettings();
  const url = `${apiBaseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.status === 429) {
        const wait = (attempt + 1) * 1000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`API ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      const wait = (attempt + 1) * 1000;
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'conversation') {
    apiCall(API.store, {
      platform: msg.platform,
      messages: msg.messages
    })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (msg.type === 'search') {
    apiCall(API.search, { query: msg.query })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
