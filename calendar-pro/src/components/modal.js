/**
 * modal.js — Erişilebilir modal pencere ve onay diyaloğu.
 *
 * - Esc ile en üstteki modal kapanır, arka plana tıklama kapatır.
 * - Tab ile odak modal içinde döner (focus trap); kapanınca önceki odağa geri döner.
 */
import { html } from '../core/dom.js';
import { icon } from './icons.js';

const openStack = [];
let uid = 0;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const isModalOpen = () => openStack.length > 0;

/**
 * @param {{title: string, body: Node|string, footer?: Node, size?: 'sm'|'md'|'lg', onClose?: Function}} options
 * @returns {{el: HTMLElement, body: HTMLElement, footer: HTMLElement, close: Function}}
 */
export function openModal({ title, body, footer, size = 'md', onClose }) {
  const id = `modal-title-${++uid}`;
  const previousFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = html`
    <div class="modal modal--${size} glass" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <header class="modal-header">
        <h2 id="${id}" class="modal-title">${title}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Kapat">${icon('x')}</button>
      </header>
      <div class="modal-body"></div>
      <footer class="modal-footer"></footer>
    </div>`;

  const modal = backdrop.querySelector('.modal');
  const bodyEl = backdrop.querySelector('.modal-body');
  const footerEl = backdrop.querySelector('.modal-footer');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  if (footer) footerEl.appendChild(footer);
  else footerEl.remove();

  let closed = false;
  const entry = { close };

  function close(result) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    openStack.splice(openStack.indexOf(entry), 1);
    backdrop.classList.remove('is-visible');
    setTimeout(() => backdrop.remove(), 180);
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    onClose?.(result);
  }

  function onKey(e) {
    if (openStack[openStack.length - 1] !== entry) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const items = [...modal.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector('[data-close]').addEventListener('click', () => close());
  document.addEventListener('keydown', onKey, true);

  openStack.push(entry);
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-visible'));
  const autofocus = modal.querySelector('[autofocus]') || modal.querySelector(FOCUSABLE);
  autofocus?.focus({ preventScroll: true });

  return { el: modal, body: bodyEl, footer: footerEl, close };
}

/**
 * Çok seçenekli diyalog. Seçilen seçeneğin `value` değerini, vazgeçilirse null döner.
 * @param {{title: string, message?: string, choices: {value: string, label: string, variant?: string}[]}} options
 */
export function choiceDialog({ title, message = '', choices }) {
  return new Promise((resolve) => {
    let result = null;
    const body = document.createElement('p');
    body.className = 'confirm-message';
    body.textContent = message;
    const footer = document.createElement('div');
    footer.className = 'modal-actions modal-actions--stack';
    footer.innerHTML = html`
      ${choices.map((c, i) => html`<button type="button" class="btn ${c.variant || 'btn-ghost'}" data-choice="${i}">${c.label}</button>`)}
      <button type="button" class="btn btn-ghost" data-cancel>Vazgeç</button>`;
    const modal = openModal({ title, body: message ? body : null, footer, size: 'sm', onClose: () => resolve(result) });
    footer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-choice]');
      if (btn) result = choices[Number(btn.dataset.choice)].value;
      if (btn || e.target.closest('[data-cancel]')) modal.close();
    });
    footer.querySelector('[data-choice]')?.focus();
  });
}

/** Onay diyaloğu. Kullanıcı onaylarsa true döner. */
export function confirmDialog({ title = 'Emin misiniz?', message = '', confirmText = 'Onayla', cancelText = 'Vazgeç', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const body = document.createElement('p');
    body.className = 'confirm-message';
    body.textContent = message;
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    footer.innerHTML = html`
      <button type="button" class="btn btn-ghost" data-cancel>${cancelText}</button>
      <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok autofocus>${confirmText}</button>`;
    const modal = openModal({ title, body, footer, size: 'sm', onClose: () => resolve(result) });
    footer.querySelector('[data-cancel]').addEventListener('click', () => modal.close());
    footer.querySelector('[data-ok]').addEventListener('click', () => {
      result = true;
      modal.close();
    });
    footer.querySelector('[data-ok]').focus();
  });
}
