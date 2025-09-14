export default class TextReplacementManager {
  static getText(el) {
    if (!el) return '';
    if ('value' in el) return el.value;
    if (el.isContentEditable || el.contentEditable === 'true') {
      return el.innerText || el.textContent || '';
    }
    return '';
  }

  static setText(el, text) {
    if (!el) return;
    if ('value' in el) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.isContentEditable || el.contentEditable === 'true') {
      // For contenteditable elements like ChatGPT
      el.innerHTML = `<p>${text}</p>`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Set cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  static hasMinimumText(el, min = 10) {
    return this.getText(el).trim().length >= min;
  }
}
