// combobox.js - input + dropdown gợi ý + cho phép free text + thêm mới
class Combobox {
  /**
   * @param {HTMLElement} root - phần tử .combobox bao input + nút ▾ + ul
   * @param {{defaults: string[], getCustom: () => string[], onAddCustom: (val:string)=>void}} opts
   */
  constructor(root, opts) {
    this.root = root;
    this.input = root.querySelector('input');
    this.toggle = root.querySelector('.combo-toggle');
    this.list = root.querySelector('.combo-list');
    this.opts = opts;
    this.focusIdx = -1;
    this._bind();
  }

  _bind() {
    this.input.addEventListener('focus', () => this.open());
    this.input.addEventListener('input', () => this.render());
    this.input.addEventListener('keydown', (e) => this._onKey(e));
    this.toggle.addEventListener('click', () => {
      if (this.list.hidden) { this.input.focus(); this.open(); }
      else this.close();
    });
    document.addEventListener('click', (e) => {
      if (!this.root.contains(e.target)) this.close();
    });
  }

  open() {
    this.render();
    this.list.hidden = false;
  }
  close() { this.list.hidden = true; this.focusIdx = -1; }

  setValue(v) { this.input.value = v; }

  _items() {
    const q = this.input.value.trim().toLowerCase();
    const defaults = this.opts.defaults || [];
    const custom = (this.opts.getCustom ? this.opts.getCustom() : []) || [];
    const filt = (arr) => q ? arr.filter(x => x.toLowerCase().includes(q)) : arr;
    return { defaults: filt(defaults), custom: filt(custom), q };
  }

  render() {
    const { defaults, custom, q } = this._items();
    const html = [];
    if (custom.length) {
      html.push(`<li class="section">Đã lưu</li>`);
      custom.forEach(n => html.push(`<li class="opt" data-val="${escapeAttr(n)}">${escapeHtml(n)}<span class="pin">★</span><button type="button" class="combo-del" data-del="${escapeAttr(n)}" title="Xoá">✕</button></li>`));
    }
    if (defaults.length) {
      html.push(`<li class="section">Gợi ý</li>`);
      defaults.forEach(n => html.push(`<li class="opt" data-val="${escapeAttr(n)}">${escapeHtml(n)}</li>`));
    }
    if (!defaults.length && !custom.length && q) {
      html.push(`<li class="add-new" data-add="1">+ Thêm “${escapeHtml(q)}” làm mục mới</li>`);
    } else if (q && !defaults.includes(q) && !custom.includes(q)) {
      html.push(`<li class="add-new" data-add="1">+ Lưu “${escapeHtml(q)}” vào gợi ý</li>`);
    }
    this.list.innerHTML = html.join('');
    this.focusIdx = -1;

    this.list.querySelectorAll('li.opt').forEach(li => {
      li.addEventListener('mousedown', (e) => {
        if (e.target.closest('.combo-del')) return; // delete button has its own handler
        e.preventDefault();
        this.input.value = li.dataset.val;
        this.close();
      });
    });
    this.list.querySelectorAll('.combo-del').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const v = btn.dataset.del;
        if (this.opts.onDeleteCustom) this.opts.onDeleteCustom(v);
        this.render();
      });
    });
    const addEl = this.list.querySelector('li.add-new');
    if (addEl) {
      addEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const v = this.input.value.trim();
        if (v && this.opts.onAddCustom) this.opts.onAddCustom(v);
        this.close();
      });
    }
  }

  _onKey(e) {
    const items = [...this.list.querySelectorAll('li.opt, li.add-new')];
    if (e.key === 'ArrowDown') {
      e.preventDefault(); this.open();
      this.focusIdx = Math.min(this.focusIdx + 1, items.length - 1);
      this._highlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusIdx = Math.max(this.focusIdx - 1, 0);
      this._highlight(items);
    } else if (e.key === 'Enter' && this.focusIdx >= 0 && !this.list.hidden) {
      e.preventDefault();
      items[this.focusIdx].dispatchEvent(new MouseEvent('mousedown'));
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  _highlight(items) {
    items.forEach((it, i) => it.classList.toggle('focus', i === this.focusIdx));
    if (items[this.focusIdx]) items[this.focusIdx].scrollIntoView({ block: 'nearest' });
  }
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
