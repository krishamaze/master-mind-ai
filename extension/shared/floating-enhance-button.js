export default class FloatingEnhanceButton {
  constructor(onClick) {
    this.onClick = onClick;
    this.button = document.createElement('button');
    this.button.textContent = 'Enhance';
    Object.assign(this.button.style, {
      position: 'absolute',
      zIndex: '2147483647',
      display: 'none',
      padding: '4px 8px',
      fontSize: '12px',
      borderRadius: '4px',
      border: 'none',
      background: '#4b6fff',
      color: '#fff',
      cursor: 'pointer'
    });
    this.button.addEventListener('click', e => {
      e.stopPropagation();
      this.onClick?.();
    });
    document.body.appendChild(this.button);
    this.target = null;

    window.addEventListener('scroll', () => this.updatePosition(), true);
    window.addEventListener('resize', () => this.updatePosition());
  }

  attach(el) {
    this.target = el;
    this.button.style.display = 'block';
    this.updatePosition();
  }

  detach() {
    this.button.style.display = 'none';
    this.target = null;
  }

  updatePosition() {
    if (!this.target || this.button.style.display === 'none') return;
    const rect = this.target.getBoundingClientRect();
    const top = window.scrollY + rect.bottom - this.button.offsetHeight - 8;
    const left = window.scrollX + rect.right - this.button.offsetWidth - 8;
    this.button.style.top = `${top}px`;
    this.button.style.left = `${left}px`;
  }
}
