/**
 * commandPalette.js — Ctrl+K komut paleti.
 *
 * Komutları ve etkinlik başlıklarını bulanık (fuzzy) arama ile filtreler.
 * Klavye: ↑/↓ gezin, Enter çalıştır, Esc kapat.
 */
import { html } from '../core/dom.js';
import { normalizeText } from '../core/utils.js';
import { formatDate } from '../core/dateUtils.js';
import { icon } from './icons.js';

/** Basit fuzzy skor: alt dize eşleşmesi en yüksek, ardışık harf eşleşmesi bonuslu. 0 = eşleşme yok. */
export function fuzzyScore(query, text) {
  const q = normalizeText(query).trim();
  if (!q) return 1;
  const t = normalizeText(text);
  const idx = t.indexOf(q);
  if (idx !== -1) return 1000 - idx * 2 - (t.length - q.length) * 0.1;
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 5 - (found - ti);
    ti = found + 1;
  }
  return Math.max(1, score);
}

/**
 * @param {{getCommands: () => object[], getEvents: () => object[], onSelectEvent: Function}} deps
 *   Komut: { id, title, keywords?, icon?, hint?, run: Function }
 */
export function createCommandPalette({ getCommands, getEvents, onSelectEvent }) {
  let backdrop = null;
  let input = null;
  let listEl = null;
  let results = [];
  let active = 0;
  let previousFocus = null;

  function compute(query) {
    const commands = getCommands()
      .map((c) => ({ kind: 'command', item: c, score: fuzzyScore(query, `${c.title} ${c.keywords || ''}`) }))
      .filter((r) => r.score > 0);
    const events = query.trim()
      ? getEvents()
          .map((e) => ({ kind: 'event', item: e, score: fuzzyScore(query, `${e.title} ${e.category}`) * 0.9 }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
      : [];
    if (query.trim()) commands.sort((a, b) => b.score - a.score);
    return [...commands, ...events];
  }

  function renderList() {
    if (!results.length) {
      listEl.innerHTML = html`<li class="palette-empty">Sonuç bulunamadı</li>`;
      return;
    }
    let lastKind = null;
    listEl.innerHTML = html`${results.map((r, i) => {
      const header = r.kind !== lastKind ? html`<li class="palette-group" role="presentation">${r.kind === 'command' ? 'Komutlar' : 'Etkinlikler'}</li>` : '';
      lastKind = r.kind;
      const selected = i === active;
      if (r.kind === 'command') {
        return html`${header}<li class="palette-item ${selected ? 'is-active' : ''}" role="option" aria-selected="${selected}" data-index="${i}" id="pal-${i}">
          <span class="palette-icon">${icon(r.item.icon || 'command')}</span>
          <span class="palette-title">${r.item.title}</span>
          ${r.item.hint ? html`<kbd>${r.item.hint}</kbd>` : ''}
        </li>`;
      }
      return html`${header}<li class="palette-item ${selected ? 'is-active' : ''}" role="option" aria-selected="${selected}" data-index="${i}" id="pal-${i}">
        <span class="palette-icon"><span class="dot" style="--ev-color:${r.item.color}"></span></span>
        <span class="palette-title">${r.item.title}</span>
        <span class="palette-meta">${formatDate(r.item.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </li>`;
    })}`;
    input.setAttribute('aria-activedescendant', `pal-${active}`);
    listEl.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function update() {
    results = compute(input.value);
    active = 0;
    renderList();
  }

  function execute(index) {
    const r = results[index];
    if (!r) return;
    close();
    if (r.kind === 'command') r.item.run();
    else onSelectEvent(r.item);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  function open() {
    if (backdrop) return;
    previousFocus = document.activeElement;
    backdrop = document.createElement('div');
    backdrop.className = 'palette-backdrop';
    backdrop.innerHTML = html`
      <div class="palette glass" role="dialog" aria-modal="true" aria-label="Komut paleti">
        <div class="palette-search">
          ${icon('search')}
          <input type="text" placeholder="Komut veya etkinlik ara…" aria-label="Ara" autocomplete="off" spellcheck="false"
                 role="combobox" aria-expanded="true" aria-controls="palette-list" />
          <kbd>Esc</kbd>
        </div>
        <ul class="palette-list" id="palette-list" role="listbox"></ul>
        <footer class="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> gezin</span>
          <span><kbd>↵</kbd> seç</span>
          <span><kbd>Ctrl</kbd><kbd>K</kbd> aç/kapat</span>
        </footer>
      </div>`;
    input = backdrop.querySelector('input');
    listEl = backdrop.querySelector('.palette-list');
    input.addEventListener('input', update);
    input.addEventListener('keydown', onKeyDown);
    listEl.addEventListener('pointermove', (e) => {
      const li = e.target.closest('[data-index]');
      if (li && Number(li.dataset.index) !== active) {
        active = Number(li.dataset.index);
        renderList();
      }
    });
    listEl.addEventListener('click', (e) => {
      const li = e.target.closest('[data-index]');
      if (li) execute(Number(li.dataset.index));
    });
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) close();
    });
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop?.classList.add('is-visible'));
    update();
    input.focus();
  }

  function close() {
    if (!backdrop) return;
    const el = backdrop;
    backdrop = null;
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 150);
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }

  return {
    open,
    close,
    toggle: () => (backdrop ? close() : open()),
    isOpen: () => Boolean(backdrop),
  };
}
