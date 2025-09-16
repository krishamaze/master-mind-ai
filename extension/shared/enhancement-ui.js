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

    this.modal = null;
    this.isVisible = false;
    this.modalMemories = [];
    this.modalPage = 0;
    this.modalPageSize = 3;
  }

  hideAll() {
    this.hide();
    this.hideMemoryModal();
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
    this.hideMemoryModal();
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
    this.hideMemoryModal();
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

  hideMemoryModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.isVisible = false;
  }

  showMemoryModal(memories = [], isLoading = false) {
    this.hideAll();

    this.modalMemories = Array.isArray(memories) ? memories : [];
    this.modalPage = 0;

    const iconUrl =
      typeof chrome !== 'undefined' && chrome?.runtime?.getURL
        ? chrome.runtime.getURL('icons/mem0-claude-icon.png')
        : '';

    this.modal = document.createElement('div');
    this.modal.className = 'mm-memory-modal';
    this.modal.innerHTML = `
      <div class="mm-modal-overlay">
        <div class="mm-modal-container" style="
          background: #1C1C1E;
          border-radius: 12px;
          width: 447px;
          max-height: 400px;
          color: white;
          font-family: Inter, sans-serif;
          position: fixed;
          z-index: 10000;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          top: 20%;
          left: calc(50% - 223px);
        ">
          <div class="mm-modal-header" style="
            padding: 10px 16px;
            background: #232325;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
          ">
            <div style="display: flex; align-items: center;">
              ${iconUrl
                ? `<img src="${iconUrl}" style="width: 26px; height: 26px; border-radius: 50%; margin-right: 8px;">`
                : ''}
              <span style="font-weight: 600;">Master Mind AI</span>
            </div>
            <button class="mm-close-btn" style="
              background: none;
              border: none;
              color: #A1A1AA;
              cursor: pointer;
              font-size: 16px;
            ">×</button>
          </div>
          <div class="mm-modal-body" style="padding: 16px; overflow-y: auto;">
            ${isLoading ? this.getLoadingHTML() : this.getMemoriesHTML()}
          </div>
        </div>
      </div>
    `;

    this.bindModalEvents();
    document.body.appendChild(this.modal);
    this.addDragFunctionality();
    if (!isLoading) {
      this.bindPagination();
    }
    this.isVisible = true;
  }

  getLoadingHTML() {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0;">
        <div style="width: 28px; height: 28px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; animation: mm-spin 1s linear infinite;"></div>
        <p style="margin-top: 12px; color: #d4d4d8; font-size: 14px;">Loading memories...</p>
      </div>
    `;
  }

  getMemoriesHTML() {
    if (!this.modalMemories.length) {
      return `
        <div style="text-align: center; padding: 32px 0; color: #a1a1aa;">
          <p style="margin-bottom: 12px; font-size: 14px;">No memories found yet.</p>
          <p style="font-size: 12px; color: #71717a;">Enhance prompts to build your memory vault.</p>
        </div>
      `;
    }

    const totalPages = Math.ceil(this.modalMemories.length / this.modalPageSize) || 1;
    const safePage = Math.min(this.modalPage, totalPages - 1);
    if (safePage !== this.modalPage) {
      this.modalPage = safePage;
    }
    const start = this.modalPage * this.modalPageSize;
    const end = start + this.modalPageSize;
    const items = this.modalMemories.slice(start, end);

    const itemsMarkup = items
      .map(memory => {
        const title = memory.title || memory.topic || 'Memory';
        const content = memory.content || memory.text || memory.summary || '';
        const timestamp = memory.created_at || memory.timestamp || '';
        let formattedTimestamp = '';
        if (timestamp) {
          const date = new Date(timestamp);
          if (!Number.isNaN(date.getTime())) {
            formattedTimestamp = date.toLocaleString();
          }
        }
        return `
          <div class="mm-memory-item" style="background: #2f2f31; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #f4f4f5;">${title}</div>
            <div style="font-size: 13px; line-height: 1.4; color: #d4d4d8; white-space: pre-wrap;">${content}</div>
            ${formattedTimestamp ? `<div style="margin-top: 8px; font-size: 11px; color: #71717a;">${formattedTimestamp}</div>` : ''}
          </div>
        `;
      })
      .join('');

    const pagination = `
      <div class="mm-modal-pagination" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
        <button class="mm-pagination-prev" ${this.modalPage === 0 ? 'disabled' : ''} style="background: none; border: 1px solid #3f3f46; border-radius: 6px; color: #e4e4e7; padding: 6px 10px; cursor: pointer; opacity: ${
          this.modalPage === 0 ? '0.4' : '1'
        }">Previous</button>
        <span style="font-size: 12px; color: #a1a1aa;">Page ${this.modalPage + 1} of ${totalPages}</span>
        <button class="mm-pagination-next" ${this.modalPage >= totalPages - 1 ? 'disabled' : ''} style="background: none; border: 1px solid #3f3f46; border-radius: 6px; color: #e4e4e7; padding: 6px 10px; cursor: pointer; opacity: ${
          this.modalPage >= totalPages - 1 ? '0.4' : '1'
        }">Next</button>
      </div>
    `;

    return `
      <div>
        <div>${itemsMarkup}</div>
        ${totalPages > 1 ? pagination : ''}
      </div>
    `;
  }

  bindModalEvents() {
    const closeBtn = this.modal.querySelector('.mm-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideMemoryModal());
    }

    const overlay = this.modal.querySelector('.mm-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', event => {
        if (event.target === overlay) {
          this.hideMemoryModal();
        }
      });
    }
  }

  bindPagination() {
    const body = this.modal?.querySelector('.mm-modal-body');
    if (!body) return;

    const prev = body.querySelector('.mm-pagination-prev');
    const next = body.querySelector('.mm-pagination-next');

    if (prev) {
      prev.addEventListener('click', event => {
        event.preventDefault();
        if (this.modalPage > 0) {
          this.modalPage -= 1;
          this.updateMemoriesView();
        }
      });
    }

    if (next) {
      next.addEventListener('click', event => {
        event.preventDefault();
        const totalPages = Math.ceil(this.modalMemories.length / this.modalPageSize) || 1;
        if (this.modalPage < totalPages - 1) {
          this.modalPage += 1;
          this.updateMemoriesView();
        }
      });
    }
  }

  updateMemoriesView() {
    const body = this.modal?.querySelector('.mm-modal-body');
    if (!body) return;

    body.innerHTML = this.getMemoriesHTML();
    this.bindPagination();
  }

  addDragFunctionality() {
    const header = this.modal?.querySelector('.mm-modal-header');
    const container = this.modal?.querySelector('.mm-modal-container');
    if (!header || !container) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    header.addEventListener('mousedown', e => {
      isDragging = true;
      startX = e.clientX - container.offsetLeft;
      startY = e.clientY - container.offsetTop;

      const handleMouseMove = moveEvent => {
        if (!isDragging) return;
        container.style.left = `${moveEvent.clientX - startX}px`;
        container.style.top = `${moveEvent.clientY - startY}px`;
      };

      const handleMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }
}
