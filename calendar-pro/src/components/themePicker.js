/**
 * themePicker.js — Özel tema seçim paneli (popover).
 *
 * Bir butona bağlı açılır (anchor verilmezse ekranın ortasında). Her tema renk şeridi, adı ve
 * açıklamasıyla listelenir. Klavye: ↑/↓ gezin, Enter seç, Esc kapat. Dışarı tıklamak kapatır.
 */
import { html } from '../core/dom.js';
import { CUSTOM_THEMES } from '../core/theme.js';
import { icon } from './icons.js';

let current = null; // açık panelin kapatma fonksiyonu

export const isThemePickerOpen = () => Boolean(current);

/**
 * @param {{anchor?: HTMLElement, value: string, onSelect: (value: string) => void}} options
 */
export function openThemePicker({ anchor, value, onSelect }) {
  current?.();
  const previousFocus = document.activeElement;

  const panel = document.createElement('div');
  panel.className = 'theme-picker glass';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Özel tema seç');
  panel.innerHTML = html`
    <header class="theme-picker-head">${icon('palette')}<span>Özel temalar</span></header>
    <ul class="theme-picker-list" role="listbox" aria-label="Özel temalar">
      ${CUSTOM_THEMES.map(
        (t) => html`<li role="option" tabindex="-1" class="theme-option ${t.value === value ? 'is-active' : ''}" aria-selected="${t.value === value}" data-value="${t.value}">
          <span class="theme-swatches" aria-hidden="true">${t.swatches.map((c) => html`<span style="background:${c}"></span>`)}</span>
          <span class="theme-option-text"><b>${t.label}</b><small>${t.description}</small></span>
          <span class="theme-option-check">${t.value === value ? icon('check') : ''}</span>
        </li>`,
      )}
    </ul>`;
  document.body.appendChild(panel);

  // --- Konumlandırma: butonun yanında/üstünde, ekran dışına taşmadan ---
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
    let left = r.left;
    let top = r.top - ph - 8; // varsayılan: butonun üstünde (kenar çubuğunun altında yer alıyor)
    if (top < margin) top = r.bottom + 8;
    left = Math.min(Math.max(margin, left), innerWidth - pw - margin);
    top = Math.min(Math.max(margin, top), innerHeight - ph - margin);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };
  place();
  requestAnimationFrame(() => panel.classList.add('is-visible'));

  const options = [...panel.querySelectorAll('.theme-option')];
  (options.find((o) => o.classList.contains('is-active')) || options[0])?.focus();

  function close() {
    if (current !== close) return;
    current = null;
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

  panel.addEventListener('click', (e) => select(e.target.closest('.theme-option')));
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation(); // global kısayollar (N, T, 1-8) panel açıkken tetiklenmesin
    const idx = options.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (idx + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(document.activeElement.closest('.theme-option'));
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      close();
    }
  });
  // Açan tıklamanın kendisi paneli hemen kapatmasın diye bir sonraki karede dinlemeye başla
  setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
  window.addEventListener('resize', place);

  current = close;
  return close;
}

export const closeThemePicker = () => current?.();
