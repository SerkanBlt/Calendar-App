/**
 * pickerPopover.js — Seçim paneli (popover) altyapısı.
 *
 * Tema ve arka plan seçicileri bunu kullanır. Bir butona bağlı açılır (anchor verilmezse ekranın
 * ortasında), ekran dışına taşmaz ve uzun listelerde kaydırılır.
 * Klavye: ok tuşları seçenekler arasında gezer, Enter/Space seçer, Esc kapatır; Tab ile panel
 * içindeki diğer kontrollere geçilir, odak panelden çıkınca panel kapanır. Dışarı tıklamak kapatır.
 * Aynı anda yalnızca bir panel açık olabilir.
 */
import { html } from '../core/dom.js';
import { icon } from './icons.js';

let closeCurrent = null;
let currentKey = null;

export const isPickerOpen = (key) => Boolean(closeCurrent) && (key == null || currentKey === key);
export const closePicker = () => closeCurrent?.();

/**
 * @param {object} options
 * @param {string} options.key Panel kimliği (aç/kapa için)
 * @param {string} options.title
 * @param {string} options.iconName
 * @param {'list'|'grid'} [options.layout]
 * @param {HTMLElement|(() => HTMLElement|null)} [options.anchor] Buton veya onu döndüren fonksiyon
 *        (kenar çubuğu yeniden çizildiğinde de doğru butonu bulmak için fonksiyon önerilir)
 * @param {{value: string}[] | (() => {value: string}[])} options.items Liste veya her çizimde çağrılan fonksiyon
 * @param {string} options.value Seçili değer
 * @param {(item: object, selected: boolean) => import('../core/dom.js').SafeHTML} options.renderItem
 * @param {(value: string) => void} options.onSelect
 * @param {boolean} [options.closeOnSelect=true] false ise seçimden sonra panel açık kalır
 * @param {(value: string) => import('../core/dom.js').SafeHTML} [options.footer] Liste altındaki ek kontroller
 * @param {(event: MouseEvent, refresh: Function) => void} [options.onFooterClick]
 * @param {(event: MouseEvent, refresh: Function) => void} [options.onItemAction] Seçenek içindeki
 *        [data-item-action] butonlarına tıklanınca (ör. silme); seçim yapılmaz
 *
 * refresh(newValue?) listeyi ve alt bölümü yeniden çizer; değer verilirse seçili öğe de güncellenir.
 */
export function openPicker({ key, title, iconName, layout = 'list', anchor, items, value, renderItem, onSelect, closeOnSelect = true, footer, onFooterClick, onItemAction }) {
  closeCurrent?.();
  const previousFocus = document.activeElement;
  const getAnchor = typeof anchor === 'function' ? anchor : () => anchor || null;
  const getItems = typeof items === 'function' ? items : () => items;
  let selected = value;

  const panel = document.createElement('div');
  panel.className = `picker glass picker--${layout}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', title);
  panel.innerHTML = html`
    <header class="picker-head">${icon(iconName)}<span>${title}</span></header>
    <ul class="picker-list" role="listbox" aria-label="${title}"></ul>
    ${footer ? html`<footer class="picker-footer"></footer>` : ''}`;
  const list = panel.querySelector('.picker-list');
  const footerEl = panel.querySelector('.picker-footer');

  function renderBody() {
    list.innerHTML = html`${getItems().map(
      (item) => html`<li role="option" tabindex="-1" class="picker-option ${item.value === selected ? 'is-active' : ''}" aria-selected="${String(item.value === selected)}" data-value="${item.value}">
        ${renderItem(item, item.value === selected)}
      </li>`,
    )}`;
    if (footerEl) footerEl.innerHTML = footer(selected);
  }
  const options = () => [...list.querySelectorAll('.picker-option')];

  renderBody();
  document.body.appendChild(panel);

  const place = () => {
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const margin = 12;
    const a = getAnchor();
    if (!a || !a.isConnected) {
      panel.style.left = `${Math.max(margin, (innerWidth - pw) / 2)}px`;
      panel.style.top = `${Math.max(margin, (innerHeight - ph) / 3)}px`;
      return;
    }
    const r = a.getBoundingClientRect();
    let top = r.top - ph - 8; // varsayılan: butonun üstünde (seçiciler kenar çubuğunun altında)
    if (top < margin) top = r.bottom + 8;
    const left = Math.min(Math.max(margin, r.left), innerWidth - pw - margin);
    top = Math.min(Math.max(margin, top), innerHeight - ph - margin);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };
  place();
  requestAnimationFrame(() => panel.classList.add('is-visible'));
  (options().find((o) => o.classList.contains('is-active')) || options()[0])?.focus();

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
    const next = option.dataset.value;
    if (closeOnSelect) {
      close();
      onSelect(next);
      return;
    }
    selected = next;
    onSelect(next);
    renderBody();
    list.querySelector(`[data-value="${CSS.escape(next)}"]`)?.focus();
  }

  /** Alt bölümü (ve listeyi) güncel değerle yeniden çizer; onFooterClick'e verilir. */
  function refresh(newValue) {
    if (newValue !== undefined && newValue !== null) selected = newValue;
    const focusedFit = document.activeElement?.dataset?.fit;
    renderBody();
    if (focusedFit) footerEl?.querySelector(`[data-fit="${CSS.escape(focusedFit)}"]`)?.focus();
    else if (!panel.contains(document.activeElement)) (list.querySelector('.is-active') || list.querySelector('.picker-option'))?.focus();
  }

  function onOutside(e) {
    const a = getAnchor();
    if (!panel.contains(e.target) && !(a && a.contains(e.target))) close();
  }

  list.addEventListener('click', (e) => {
    if (e.target.closest('[data-item-action]')) {
      onItemAction?.(e, refresh);
      return;
    }
    select(e.target.closest('.picker-option'));
  });
  footerEl?.addEventListener('click', (e) => onFooterClick?.(e, refresh));
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation(); // global kısayollar (N, T, 1-8) panel açıkken tetiklenmesin
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    const opts = options();
    const idx = opts.indexOf(document.activeElement);
    if (idx === -1) return; // alt bölümdeki butonlar kendi davranışını kullanır
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (step) {
      e.preventDefault();
      opts[(idx + step + opts.length) % opts.length].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(document.activeElement.closest('.picker-option'));
    }
  });
  // Odak panelin dışına çıkarsa (Tab ile) kapat
  panel.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !panel.contains(e.relatedTarget)) close();
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
