function ensureSpinnerStyles() {
  if (document.getElementById('mm-spinner-styles')) return;
  const style = document.createElement('style');
  style.id = 'mm-spinner-styles';
  style.textContent = `@keyframes mm-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;
  document.head.appendChild(style);
}

export default class EnhancementUI {
  constructor() {
    ensureSpinnerStyles();
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
      zIndex: '2147483647',
      fontFamily: 'sans-serif'
    });
    document.body.appendChild(this.container);
  }

  _buildBox() {
    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#fff',
      padding: '16px',
      borderRadius: '8px',
      maxWidth: '400px',
      width: '90%',
      boxSizing: 'border-box',
      color: '#000'
    });
    return box;
  }

  showLoading() {
    this.container.innerHTML = '';
    const box = this._buildBox();
    
    const spinner = document.createElement('div');
    Object.assign(spinner.style, {
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #555',
      borderRadius: '50%',
      width: '24px',
      height: '24px',
      animation: 'mm-spin 1s linear infinite',
      margin: '0 auto 8px auto'
    });
    box.appendChild(spinner);

    const text = document.createElement('div');
    text.textContent = 'Enhancing...';
    text.style.textAlign = 'center';
    box.appendChild(text);

    this.container.appendChild(box);
    this.container.style.display = 'flex';
  }

  showError(message) {
    this.container.innerHTML = '';
    const box = this._buildBox();
    
    const text = document.createElement('div');
    text.textContent = message;
    text.style.marginBottom = '12px';
    box.appendChild(text);

    const close = document.createElement('button');
    close.textContent = 'Close';
    close.addEventListener('click', () => this.hide());
    box.appendChild(close);

    this.container.appendChild(box);
    this.container.style.display = 'flex';
  }

  hide() {
    this.container.style.display = 'none';
  }
}
