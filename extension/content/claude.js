import { debounce } from './utils.js';

const platform = 'claude';

function getMessages() {
  const nodes = document.querySelectorAll('main [data-message-id]');
  return Array.from(nodes, n => n.innerText.trim()).filter(Boolean);
}

const sendUpdates = debounce(() => {
  const messages = getMessages();
  if (messages.length) {
    chrome.runtime.sendMessage({ type: 'conversation', platform, messages });
  }
});

const observer = new MutationObserver(sendUpdates);
observer.observe(document.body, { childList: true, subtree: true });

sendUpdates();
