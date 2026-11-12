/**
 * searchPanel.js — Etkinlik arama paneli.
 *
 * Kenar çubuğundaki "Ara" düğmesi, `/` kısayolu veya Ctrl+K → "Etkinlik Ara" ile açılır.
 *  - Başlık, açıklama ve kategoride arar; birden fazla kelime yazılırsa hepsi eşleşmelidir.
 *    Büyük/küçük harf fark etmez (Türkçe kurallarıyla: I/ı, İ/i). Eşleşen kısımlar vurgulanır.
 *  - Filtreler: Zaman (Yaklaşan / Tümü / Geçmiş) ve Durum (Tümü / Yapılacak / Devam / Tamamlandı).
 *  - Tekrarlayan etkinlikler tek satır olarak, bir sonraki (yoksa son) tekrarının tarihiyle gösterilir.
 *  - Arama kutusu boşken yaklaşan etkinlikler listelenir.
 *  - Klavye: ↑/↓ gezin, Enter aç, Esc (her yerde) kapat; sağ üstteki × da kapatır.
 * Bir sonuç seçilince takvim o güne gider ve etkinlik düzenleyicide açılır.
 */
import { html } from '../core/dom.js';
import { store } from '../core/state.js';
import { addDaysISO, formatDate, relativeDayLabel, todayISO } from '../core/dateUtils.js';
import { compareByStart, STATUS_LABELS, STATUSES } from '../core/eventModel.js';
import { normalizeText } from '../core/utils.js';
import { expandEvents } from '../services/recurrenceService.js';
import { dateRangeLabel, timeLabel } from './eventCard.js';
import { icon } from './icons.js';

const MAX_RESULTS = 100;
const RANGES = [
  { id: 'upcoming', label: 'Yaklaşan' },
  { id: 'all', label: 'Tümü' },
  { id: 'past', label: 'Geçmiş' },
];

let api = null; // açık panelin { close }
const filters = { range: 'upcoming', status: 'all' }; // panel yeniden açılınca korunur

export const isSearchOpen = () => Boolean(api);
export const closeSearch = () => api?.close();

/** Her etkinlik için listede gösterilecek temsilci örnek (tekrarlayanlarda sıradaki tekrar). */
function representatives(events, today) {
  const horizonPast = addDaysISO(today, -730);
  const horizonFuture = addDaysISO(today, 730);
  return events.map((ev) => {
    if (!ev.recurrence) return { ...ev, masterId: ev.id, isRecurring: false };
    const occs = expandEvents([ev], horizonPast, horizonFuture);
    const next = occs.find((o) => o.endDate >= today);
    return next || occs[occs.length - 1] || { ...ev, masterId: ev.id, isRecurring: false };
  });
}

/** "Bugün", "3 gün sonra" …; başlamış ve süren çok günlü etkinliklerde "Sürüyor (12–16 Kas)". */
function whenLabel(o) {
  const today = todayISO();
  if (o.startDate < today && o.endDate >= today) return `Sürüyor (${dateRangeLabel(o)})`;
  return relativeDayLabel(o.startDate);
}

/** Metindeki arama kelimelerini <mark> ile vurgular (güvenli: parçalar escape edilir). */
function highlight(text, tokens) {
  const value = String(text ?? '');
  if (!tokens.length || !value) return html`${value}`;
  const lower = normalizeText(value);
  const marks = new Array(value.length).fill(false);
  tokens.forEach((t) => {
    let i = lower.indexOf(t);
    while (i !== -1) {
      for (let k = i; k < i + t.length && k < marks.length; k++) marks[k] = true;
      i = lower.indexOf(t, i + t.length);
    }
  });
  const parts = [];
  let start = 0;
  for (let i = 1; i <= value.length; i++) {
    if (i === value.length || marks[i] !== marks[start]) {
      const chunk = value.slice(start, i);
      parts.push(marks[start] ? html`<mark>${chunk}</mark>` : html`${chunk}`);
      start = i;
    }
  }
  return html`${parts}`;
}

function search(query) {
  const { events } = store.get();
  const today = todayISO();
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  let items = representatives(events, today).filter((o) => {
    if (filters.status !== 'all' && o.status !== filters.status) return false;
    if (filters.range === 'upcoming' && o.endDate < today) return false;
    if (filters.range === 'past' && o.endDate >= today) return false;
    if (!tokens.length) return true;
    const haystack = normalizeText(`${o.title} ${o.description} ${o.category}`);
    return tokens.every((t) => haystack.includes(t));
  });
  const upcoming = items.filter((o) => o.endDate >= today).sort(compareByStart);
  const past = items.filter((o) => o.endDate < today).sort((a, b) => compareByStart(b, a));
  items = [...upcoming, ...past];
  return { items: items.slice(0, MAX_RESULTS), total: items.length, tokens };
}

/**
 * @param {{onOpenEvent: (occ: object) => void}} deps
 */
export function openSearch({ onOpenEvent }) {
  if (api) {
    api.focus();
    return;
  }
  const previousFocus = document.activeElement;
  let results = [];
  let active = 0;

  const backdrop = document.createElement('div');
  backdrop.className = 'palette-backdrop';
  backdrop.innerHTML = html`
    <div class="palette search-panel glass" role="dialog" aria-modal="true" aria-label="Etkinlik ara">
      <div class="palette-search">
        ${icon('search')}
        <input type="search" placeholder="Etkinlik ara — başlık, açıklama, kategori…" aria-label="Etkinlik ara" autocomplete="off" spellcheck="false"
               role="combobox" aria-expanded="true" aria-controls="search-results" />
        <button type="button" class="icon-btn icon-btn-sm palette-close" data-close aria-label="Kapat (Esc)" title="Kapat (Esc)">${icon('x')}</button>
      </div>
      <div class="search-filters"></div>
      <ul class="palette-list search-results" id="search-results" role="listbox" aria-label="Arama sonuçları"></ul>
      <footer class="palette-footer"><span class="search-count"></span><span><kbd>↑</kbd><kbd>↓</kbd> gezin</span><span><kbd>↵</kbd> aç</span><span><kbd>Esc</kbd> kapat</span></footer>
    </div>`;
  const input = backdrop.querySelector('input');
  const filtersEl = backdrop.querySelector('.search-filters');
  const listEl = backdrop.querySelector('.search-results');
  const countEl = backdrop.querySelector('.search-count');

  function renderFilters() {
    filtersEl.innerHTML = html`
      <div class="segmented segmented--sm" role="radiogroup" aria-label="Zaman">
        ${RANGES.map((r) => html`<button type="button" role="radio" data-range="${r.id}" aria-checked="${String(filters.range === r.id)}" class="${filters.range === r.id ? 'is-active' : ''}">${r.label}</button>`)}
      </div>
      <div class="segmented segmented--sm" role="radiogroup" aria-label="Durum">
        <button type="button" role="radio" data-status="all" aria-checked="${String(filters.status === 'all')}" class="${filters.status === 'all' ? 'is-active' : ''}">Tüm durumlar</button>
        ${STATUSES.map((s) => html`<button type="button" role="radio" data-status="${s}" aria-checked="${String(filters.status === s)}" class="${filters.status === s ? 'is-active' : ''}">${STATUS_LABELS[s]}</button>`)}
      </div>`;
  }

  function renderResults() {
    const { items, total, tokens } = search(input.value);
    results = items;
    active = Math.min(active, Math.max(0, results.length - 1));
    countEl.textContent = total > results.length ? `${results.length} / ${total} sonuç` : `${total} sonuç`;
    if (!results.length) {
      listEl.innerHTML = html`<li class="palette-empty">${input.value.trim() ? 'Eşleşen etkinlik yok' : 'Bu filtrede etkinlik yok'}</li>`;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    listEl.innerHTML = html`${results.map(
      (o, i) => html`
        <li class="search-item ${i === active ? 'is-active' : ''}" role="option" id="search-opt-${i}" aria-selected="${String(i === active)}" data-index="${i}" style="--ev-color:${o.color}">
          <span class="search-date">
            <b>${formatDate(o.startDate, { day: 'numeric' })}</b>
            <small>${formatDate(o.startDate, { month: 'short', year: '2-digit' })}</small>
          </span>
          <span class="search-main">
            <span class="search-title">${highlight(o.title, tokens)}</span>
            <span class="search-sub">
              ${whenLabel(o)} · ${timeLabel(o)}
              ${o.category ? html` · ${highlight(o.category, tokens)}` : ''}
              ${o.isRecurring ? html` · ${icon('repeat')} tekrarlıyor` : ''}
            </span>
            ${o.description && tokens.some((t) => normalizeText(o.description).includes(t)) ? html`<span class="search-desc">${highlight(o.description.slice(0, 140), tokens)}</span>` : ''}
          </span>
          <span class="status status--${o.status}">${STATUS_LABELS[o.status]}</span>
        </li>`,
    )}`;
    input.setAttribute('aria-activedescendant', `search-opt-${active}`);
  }

  function setActive(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    listEl.querySelectorAll('.search-item').forEach((li, idx) => {
      li.classList.toggle('is-active', idx === active);
      li.setAttribute('aria-selected', String(idx === active));
    });
    input.setAttribute('aria-activedescendant', `search-opt-${active}`);
    listEl.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    const occ = results[i];
    if (!occ) return;
    close();
    onOpenEvent(occ);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(active);
    }
  }

  /** Panel açıkken Esc her yerde çalışır. */
  function onDocumentKeyDown(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }

  function close() {
    if (!api) return;
    api = null;
    document.removeEventListener('keydown', onDocumentKeyDown, true);
    backdrop.classList.remove('is-visible');
    setTimeout(() => backdrop.remove(), 150);
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }

  input.addEventListener('input', () => {
    active = 0;
    renderResults();
  });
  input.addEventListener('keydown', onKeyDown);
  filtersEl.addEventListener('click', (e) => {
    const range = e.target.closest('[data-range]');
    const status = e.target.closest('[data-status]');
    if (range) filters.range = range.dataset.range;
    else if (status) filters.status = status.dataset.status;
    else return;
    active = 0;
    renderFilters();
    renderResults();
    input.focus();
  });
  listEl.addEventListener('pointermove', (e) => {
    const li = e.target.closest('[data-index]');
    if (li && Number(li.dataset.index) !== active) setActive(Number(li.dataset.index));
  });
  listEl.addEventListener('click', (e) => {
    const li = e.target.closest('[data-index]');
    if (li) choose(Number(li.dataset.index));
  });
  backdrop.querySelector('[data-close]').addEventListener('click', close);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onDocumentKeyDown, true);

  renderFilters();
  renderResults();
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-visible'));
  input.focus();

  api = { close, focus: () => input.focus() };
}
