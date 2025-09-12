import { debounce } from './utils.js';

const platform = 'chatgpt';

function getMessages() {
  const nodes = document.querySelectorAll('main .markdown');
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
