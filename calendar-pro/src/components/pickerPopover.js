/**
 * pickerPopover.js — Seçim paneli (popover) altyapısı.
 *
 * Tema ve arka plan seçicileri bunu kullanır. Bir butona bağlı açılır (anchor verilmezse ekranın
 * ortasında), ekran dışına taşmaz ve uzun listelerde kaydırılır.
 * Klavye: ok tuşları gezin, Enter/Space seç, Esc/Tab kapat. Dışarı tıklamak kapatır.
 * Aynı anda yalnızca bir panel açık olabilir.
 */
import { html } from '../core/dom.js';
import { icon } from './icons.js';

let closeCurrent = null;
let currentKey = null;

export const isPickerOpen = (key) => Boolean(closeCurrent) && (key == null || currentKey === key);
export const closePicker = () => closeCurrent?.();

/**
 * @param {{key: string, title: string, iconName: string, layout?: 'list'|'grid', anchor?: HTMLElement,
 *          items: {value: string}[], value: string, renderItem: (item: object, selected: boolean) => import('../core/dom.js').SafeHTML,
 *          onSelect: (value: string) => void}} options
 */
export function openPicker({ key, title, iconName, layout = 'list', anchor, items, value, renderItem, onSelect }) {
  closeCurrent?.();
  const previousFocus = document.activeElement;

  const panel = document.createElement('div');
  panel.className = `picker glass picker--${layout}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', title);
  panel.innerHTML = html`
    <header class="picker-head">${icon(iconName)}<span>${title}</span></header>
    <ul class="picker-list" role="listbox" aria-label="${title}">
      ${items.map(
        (item) => html`<li role="option" tabindex="-1" class="picker-option ${item.value === value ? 'is-active' : ''}" aria-selected="${item.value === value}" data-value="${item.value}">
          ${renderItem(item, item.value === value)}
        </li>`,
      )}
    </ul>`;
  document.body.appendChild(panel);

  const place = () => {
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const margin = 12;
    if (!anchor || !anchor.isConnected) {
      panel.style.left = `${Math.max(margin, (innerWidth - pw) / 2)}px`;
      panel.style.top = `${Math.max(margin, (innerHeight - ph) / 3)}px`;
      return;
    }
    const r = anchor.getBoundingClientRect();
    let top = r.top - ph - 8; // varsayılan: butonun üstünde (seçiciler kenar çubuğunun altında)
    if (top < margin) top = r.bottom + 8;
    const left = Math.min(Math.max(margin, r.left), innerWidth - pw - margin);
    top = Math.min(Math.max(margin, top), innerHeight - ph - margin);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };
  place();
  requestAnimationFrame(() => panel.classList.add('is-visible'));

  const options = [...panel.querySelectorAll('.picker-option')];
  (options.find((o) => o.classList.contains('is-active')) || options[0])?.focus();

  function close() {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    currentKey = null;
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', place);
    panel.classList.remove('is-visible');
    setTimeout(() => panel.remove(), 150);
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }

  function select(option) {
    if (!option) return;
    close();
    onSelect(option.dataset.value);
  }

  function onOutside(e) {
    if (!panel.contains(e.target) && !(anchor && anchor.contains(e.target))) close();
  }

  panel.addEventListener('click', (e) => select(e.target.closest('.picker-option')));
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation(); // global kısayollar (N, T, 1-8) panel açıkken tetiklenmesin
    const idx = options.indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (step) {
      e.preventDefault();
      options[(idx + step + options.length) % options.length].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(document.activeElement.closest('.picker-option'));
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      close();
    }
  });
  // Açan tıklama paneli hemen kapatmasın diye bir sonraki turda dinlemeye başla
  setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
  window.addEventListener('resize', place);

  closeCurrent = close;
  currentKey = key;
  return close;
}

/** Bir butondan aç/kapa: aynı panel açıksa kapatır, değilse açar. */
export function togglePicker(options) {
  if (isPickerOpen(options.key)) closePicker();
  else openPicker(options);
}
