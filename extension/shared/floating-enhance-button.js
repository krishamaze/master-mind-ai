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
    this.button.addEventListener('click', this.handleClick.bind(this), { capture: true });
    this.button.addEventListener('mousedown', this.handleClick.bind(this), { capture: true });
    this.button.addEventListener('touchstart', this.handleClick.bind(this), { capture: true });

    document.body.appendChild(this.button);
    this.target = null;

    window.addEventListener('scroll', () => this.updatePosition(), true);
    window.addEventListener('resize', () => this.updatePosition());
    
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
}
