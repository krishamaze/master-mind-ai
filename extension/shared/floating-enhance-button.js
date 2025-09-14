export default class FloatingEnhanceButton {
  constructor(onClick) {
    this.onClick = onClick;
    this.button = document.createElement('button');
    this.button.textContent = 'Enhance';
    this.button.id = 'mm-enhance-btn'; // Add ID for debugging
    
    Object.assign(this.button.style, {
      position: 'absolute',
      zIndex: '2147483647',
      display: 'none',
      padding: '6px 12px',
      fontSize: '12px',
      borderRadius: '4px',
      border: 'none',
      background: '#4b6fff',
      color: '#fff',
      cursor: 'pointer',
      fontWeight: 'bold',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    });

    // Multiple event listeners to ensure click works
    this.boundClick = this.handleClick.bind(this);
    this.button.addEventListener('click', this.boundClick, { capture: true });
    this.button.addEventListener('mousedown', this.boundClick, { capture: true });
    this.button.addEventListener('touchstart', this.boundClick, { capture: true });

    document.body.appendChild(this.button);
    this.target = null;

    this.boundScroll = () => this.updatePosition();
    this.boundResize = () => this.updatePosition();
    window.addEventListener('scroll', this.boundScroll, true);
    window.addEventListener('resize', this.boundResize);
    
    console.log('🔧 FloatingEnhanceButton created with ID:', this.button.id);
  }

  handleClick(e) {
    console.log('🖱️ Button clicked!', e.type);
    e.stopPropagation();
    e.preventDefault();
    
    if (this.onClick) {
      this.onClick();
    } else {
      console.error('❌ No onClick handler provided');
    }
  }

  attach(el) {
    this.target = el;
    this.button.style.display = 'block';
    this.updatePosition();
    console.log('📌 Button attached to element');
  }

  detach() {
    this.button.style.display = 'none';
    this.target = null;
    console.log('📌 Button detached');
  }

  updatePosition() {
    if (!this.target || this.button.style.display === 'none') return;
    
    const rect = this.target.getBoundingClientRect();
    const top = window.scrollY + rect.bottom - this.button.offsetHeight - 8;
    const left = window.scrollX + rect.right - this.button.offsetWidth - 8;
    
    this.button.style.top = `${top}px`;
    this.button.style.left = `${left}px`;
  }

  destroy() {
    window.removeEventListener('scroll', this.boundScroll, true);
    window.removeEventListener('resize', this.boundResize);
    this.button.removeEventListener('click', this.boundClick, { capture: true });
    this.button.removeEventListener('mousedown', this.boundClick, { capture: true });
    this.button.removeEventListener('touchstart', this.boundClick, { capture: true });
    this.button.remove();
    this.target = null;
    console.log('🗑️ FloatingEnhanceButton destroyed');
  }
}
