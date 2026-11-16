/**
 * contextMenu.js — Sağ tık (bağlam) menüsü: etkinliği açmadan durumunu değiştirme.
 *
 * Fareyle (ince işaretçi) bir etkinliğe sağ tıklanınca — Ay/Hafta/Gün/Scheduler çipleri ve blokları, Timeline ve Dashboard satırları, Kanban/Dashboard kartları,
 * Gantt çubukları ve görev satırları — küçük bir menü açılır: Durum (Yapılacak · Devam Ediyor · Tamamlandı; geçerli olan işaretli), Aç, Sil.
 *  - Durum değişince ilerleme tutarlı kalır: Tamamlandı → %100; tamamlanmış bir etkinlik yeniden açılırsa %100 kalmaz (Devam Ediyor → %50, Yapılacak → %0).
 *  - Tekrarlayan serinin bir ÖRNEĞİNDE "Yalnızca bu etkinlik / Tüm seri" sorulur; Kanban/Gantt gibi seri kaydını gösteren yerlerde seri düzeyinde değişir.
 *  - Dokunmatik cihazlarda devreye girmez (basılı tutma sürüklemeye ayrılmıştır).
 * Menü klavyeyle de kullanılır: ↑ ↓ Home End gezinir, Enter/Boşluk seçer, Esc (pencereyi kapatmadan) ve Tab kapatır.
 */
import { html } from '../core/dom.js';
import { eventRepo } from '../core/eventRepo.js';
import { STATUS_LABELS, STATUSES } from '../core/eventModel.js';
import { expandEvents } from '../services/recurrenceService.js';
import { changeEventStatus, deleteEventWithUndo, deleteOccurrence } from '../core/actions.js';
import { openEventEditor } from './eventEditor.js';
import { icon } from './icons.js';

let menu = null;

export function closeContextMenu() {
  if (!menu) return;
  const { el, previous, escape } = menu;
  menu = null;
  el.remove();
  if (escape) document.removeEventListener('keydown', escape, true);
  document.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('blur', closeContextMenu);
  window.removeEventListener('resize', closeContextMenu);
  window.removeEventListener('scroll', onScroll, true);
  if (previous instanceof HTMLElement && document.contains(previous)) previous.focus({ preventScroll: true });
}

function onOutside(e) {
  if (menu && !menu.el.contains(e.target)) closeContextMenu();
}
function onScroll(e) {
  if (menu && !menu.el.contains(e.target)) closeContextMenu();
}

/**
 * Genel bağlam menüsü açar.
 * @param {{x: number, y: number, title?: string, subtitle?: string, items: Array<{type?: 'separator'|'label', label?: string, checked?: boolean, danger?: boolean, dot?: string, icon?: string, onSelect?: Function}>}} options
 */
export function openContextMenu({ x, y, title = '', subtitle = '', items }) {
  closeContextMenu();
  const previous = document.activeElement;
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  el.setAttribute('role', 'menu');
  el.innerHTML = html`
    ${title ? html`<div class="ctx-head"><b class="ctx-title"></b>${subtitle ? html`<span class="ctx-sub"></span>` : ''}</div>` : ''}
    ${items.map((it, i) =>
      it.type === 'separator'
        ? html`<div class="ctx-sep" role="separator"></div>`
        : it.type === 'label'
          ? html`<div class="ctx-label" role="presentation"></div>`
          : html`<button type="button" class="ctx-item ${it.danger ? 'is-danger' : ''} ${it.checked ? 'is-checked' : ''}" role="${it.checked !== undefined ? 'menuitemradio' : 'menuitem'}" ${it.checked !== undefined ? html`aria-checked="${String(it.checked)}"` : ''} data-i="${i}">
              <span class="ctx-lead">${it.dot ? html`<i class="ctx-dot" style="--c:${it.dot}"></i>` : it.icon ? icon(it.icon) : ''}</span>
              <span class="ctx-text"></span>
              <span class="ctx-check">${it.checked ? icon('check') : ''}</span>
            </button>`,
    )}`;
  // Metinler textContent ile yazılır (başlıklar kullanıcı verisidir)
  if (title) el.querySelector('.ctx-title').textContent = title;
  if (subtitle) el.querySelector('.ctx-sub').textContent = subtitle;
  el.querySelectorAll('.ctx-label').forEach((n, k) => (n.textContent = items.filter((it) => it.type === 'label')[k].label));
  el.querySelectorAll('.ctx-item').forEach((n) => (n.querySelector('.ctx-text').textContent = items[Number(n.dataset.i)].label));

  document.body.appendChild(el);
  const rect = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
  menu = { el, previous };

  const buttons = () => [...el.querySelectorAll('.ctx-item')];
  const run = (btn) => {
    const it = items[Number(btn.dataset.i)];
    closeContextMenu();
    it.onSelect?.();
  };
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.ctx-item');
    if (btn) run(btn);
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('keydown', (e) => {
    const list = buttons();
    const at = list.indexOf(document.activeElement);
    const go = (i) => list[(i + list.length) % list.length]?.focus();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeContextMenu();
    } else if (e.key === 'ArrowDown') (e.preventDefault(), go(at + 1));
    else if (e.key === 'ArrowUp') (e.preventDefault(), go(at < 0 ? -1 : at - 1));
    else if (e.key === 'Home') (e.preventDefault(), go(0));
    else if (e.key === 'End') (e.preventDefault(), go(-1));
    else if (e.key === 'Tab') (e.preventDefault(), closeContextMenu());
  });
  // Esc, açık pencerenin (modal) capture dinleyicisinden ÖNCE bu menüde yakalanır (menü kapanınca dinleyici kaldırılır)
  const escape = (e) => {
    if (menu?.el === el && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeContextMenu();
    }
  };
  document.addEventListener('keydown', escape, true);
  menu.escape = escape;

  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('blur', closeContextMenu);
  window.addEventListener('resize', closeContextMenu);
  window.addEventListener('scroll', onScroll, true);
  (buttons().find((b) => b.classList.contains('is-checked')) || buttons()[0])?.focus();
}

/** Tıklanan öğeden etkinliği (ve tekrarlayan serinin örneğini) çözer. @returns {{master: object, occ: object|null}|null} */
function resolve(target) {
  const occEl = target.closest('[data-occ-id]');
  if (occEl) {
    const id = occEl.dataset.occId;
    const [masterId, date] = id.split('@');
    const master = eventRepo.getById(masterId);
    if (!master) return null;
    if (!date) return { master, occ: { ...master, masterId: master.id, isRecurring: false } };
    const occ = expandEvents([master], date, date).find((o) => o.id === id);
    return occ ? { master, occ } : null;
  }
  const el = target.closest('[data-event-id]') || target.closest('[data-task]');
  if (!el) return null;
  const master = eventRepo.getById(el.dataset.eventId || el.dataset.task);
  return master ? { master, occ: null } : null;
}

function onContextMenu(e) {
  if (e.target.closest('input, textarea, select, [contenteditable="true"], .cm-editor, .ctx-menu')) return; // yazı alanlarında yerel menü kalsın
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const found = resolve(e.target);
  if (!found) return;
  e.preventDefault();
  const { master, occ } = found;
  const current = master.status;
  openContextMenu({
    x: e.clientX,
    y: e.clientY,
    title: master.title,
    subtitle: occ?.isRecurring ? 'Tekrarlayan etkinlik' : '',
    items: [
      { type: 'label', label: 'Durum' },
      ...STATUSES.map((status) => ({
        label: STATUS_LABELS[status],
        checked: status === (occ?.status ?? current),
        dot: { todo: 'var(--text-muted)', doing: 'var(--info)', done: 'var(--success)' }[status],
        onSelect: () => changeEventStatus(occ || master, status, { series: !occ }),
      })),
      { type: 'separator' },
      { label: 'Aç', icon: 'expand', onSelect: () => openEventEditor(occ || master) },
      { label: 'Sil', icon: 'trash', danger: true, onSelect: () => (occ ? deleteOccurrence(occ) : deleteEventWithUndo(master.id)) },
    ],
  });
}

let installed = false;
/** Uygulama başında bir kez çağrılır. */
export function installEventContextMenu() {
  if (installed) return;
  installed = true;
  document.addEventListener('contextmenu', onContextMenu);
}

