// WhatsNew — in-game "Что нового" overlay.
//
// Behaviour (per design): on launch we show ONLY the updates that are newer than
// the version the player last acknowledged. We remember that in localStorage, so
// each new build surfaces exactly its own changes — never the whole history.
//
// First-ever launch (nothing stored): we show just the latest entry as a welcome,
// then mark it seen. Manual re-open via show({ force: true }) shows everything.
//
// The component is dependency-injected (storage / updates / version) so its core
// logic — getNewUpdates() — is unit-testable in plain Node without a DOM.

import { GAME_VERSION } from '../version.js';
import { UPDATES } from '../updates.js';

const STORAGE_KEY = 'starwars.lastSeenVersion';

// Maps the human tag in updates.js to a CSS chip modifier (styles/main.css).
const TAG_CLASS = {
  'Новое': 'new',
  'Полёт': 'flight',
  'Графика': 'gfx',
  'Звук': 'audio',
  'Баланс': 'balance',
  'Исправление': 'fix',
  'Лор': 'lore',
  'ИИ': 'ai',
  'HUD': 'hud',
  'AR': 'ar',
};

/** Compare two semver strings. Returns >0 if a>b, <0 if a<b, 0 if equal. */
export function compareSemver(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export class WhatsNew {
  constructor({ storage, updates = UPDATES, version = GAME_VERSION } = {}) {
    // Fall back to localStorage, but tolerate environments where it throws
    // (private mode, sandboxed iframe). We keep an in-memory shim then.
    this.storage = storage || safeLocalStorage();
    this.updates = updates;
    this.version = version;
  }

  /** Updates strictly newer than the last acknowledged version. */
  getNewUpdates() {
    const lastSeen = this._readLastSeen();
    if (lastSeen === null) {
      // First launch ever: the most recent note is genuinely new to this player.
      return this.updates.slice(0, 1);
    }
    return this.updates.filter((u) => compareSemver(u.version, lastSeen) > 0);
  }

  /**
   * Show the overlay.
   *  - default: only NEW updates; if none, does nothing.
   *  - { force: true }: show ALL updates (manual "patch notes" button).
   * Returns a Promise that resolves true if shown, false if skipped.
   */
  show({ root = document.body, force = false } = {}) {
    const list = force ? this.updates : this.getNewUpdates();
    if (list.length === 0) return Promise.resolve(false);

    return new Promise((resolve) => {
      const el = this._render(list, () => {
        this._markSeen();
        el.classList.add('is-leaving');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        resolve(true);
      });
      root.appendChild(el);
      // Next frame: flip to visible so the CSS transition actually plays.
      requestAnimationFrame(() => el.classList.add('is-visible'));
    });
  }

  _markSeen() {
    try {
      this.storage.setItem(STORAGE_KEY, this.version);
    } catch {
      /* storage unavailable — nothing we can do, fail quietly */
    }
  }

  _readLastSeen() {
    try {
      return this.storage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  // --- DOM construction (kept dumb and explicit on purpose) ---

  _render(updates, onClose) {
    const overlay = el('div', {
      class: 'whatsnew',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Что нового',
    });

    const panel = el('div', { class: 'whatsnew__panel' });

    panel.appendChild(
      el('header', { class: 'whatsnew__head' }, [
        el('div', { class: 'whatsnew__eyebrow' }, ['СВОДКА С ФРОНТА']),
        el('h2', { class: 'whatsnew__title' }, ['Что нового']),
      ])
    );

    const body = el('div', { class: 'whatsnew__body' });
    updates.forEach((u, i) => body.appendChild(this._renderUpdate(u, i)));
    panel.appendChild(body);

    const dismiss = el('button', { class: 'btn btn--primary', type: 'button' }, ['К БОЮ ГОТОВ']);
    dismiss.addEventListener('click', onClose);
    panel.appendChild(el('footer', { class: 'whatsnew__foot' }, [dismiss]));

    overlay.appendChild(panel);
    // Click on the dark backdrop (outside the panel) also closes.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) onClose();
    });
    return overlay;
  }

  _renderUpdate(u, index) {
    // --i drives the staggered entrance animation in CSS.
    const section = el('section', { class: 'whatsnew__update', style: `--i:${index}` });
    section.appendChild(
      el('div', { class: 'whatsnew__verline' }, [
        el('span', { class: 'whatsnew__ver' }, [`v${u.version}`]),
        el('span', { class: 'whatsnew__date' }, [formatDate(u.date)]),
        el('span', { class: 'whatsnew__name' }, [u.title || '']),
      ])
    );
    const ul = el('ul', { class: 'whatsnew__items' });
    for (const item of u.items) {
      const cls = TAG_CLASS[item.tag] || 'new';
      ul.appendChild(
        el('li', {}, [
          el('span', { class: `chip chip--${cls}` }, [item.tag]),
          el('span', { class: 'whatsnew__text' }, [item.text]),
        ])
      );
    }
    section.appendChild(ul);
    return section;
  }
}

// --- tiny helpers ---

/** Minimal hyperscript: el(tag, attrs, children[]) -> HTMLElement. */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/** '2026-06-19' -> '19.06.2026'. Falls back to the raw string if unparseable. */
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || '');
}

/** localStorage that degrades to an in-memory map if the real one is blocked. */
function safeLocalStorage() {
  try {
    const k = '__sw_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}
