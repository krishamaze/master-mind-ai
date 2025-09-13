export default class TextReplacementManager {
  static getText(el) {
    if (!el) return '';
    if ('value' in el) return el.value;
    if (el.isContentEditable) return el.textContent || '';
    return '';
  }

  static setText(el, text) {
    if (!el) return;
    if ('value' in el) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.isContentEditable) {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  static hasMinimumText(el, min = 10) {
    return this.getText(el).trim().length >= min;
  }
}
