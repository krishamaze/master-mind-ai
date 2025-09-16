export default class TextReplacementManager {
  static getText(element) {
    if (!element) return '';

    if (element.tagName === 'TEXTAREA') {
      return element.value || '';
    } else if (element.contentEditable === 'true') {
      const paragraph = element.querySelector('p[dir="ltr"]');
      if (paragraph) {
        let text = '';
        paragraph.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent || '';
          } else if (node.tagName === 'SPAN' && node.getAttribute('data-lexical-text')) {
            text += node.textContent || '';
          } else if (node.tagName === 'BR') {
            text += '\n';
          }
        });
        return text;
      }
      return element.textContent || '';
    }
    return element.textContent || element.value || '';
  }

  static setText(element, text) {
    if (!element) return;

    if (element.tagName === 'TEXTAREA') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element.contentEditable === 'true') {
      element.focus();
      document.execCommand('selectAll', false, '');

      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            document.execCommand('paste');
          })
          .catch(() => {
            element.textContent = text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          });
      } else {
        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
}
