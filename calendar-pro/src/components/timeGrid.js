/**
 * timeGrid.js — Saat bazlı takvim ızgarası (Week, Day ve Scheduler görünümlerinin ortak motoru).
 *
 * Özellikler:
 *  - 24 saatlik dikey ızgara, N gün sütunu
 *  - Tüm gün / çok günlü etkinlikler için üst satır (sürükle-bırak ile gün değiştirme)
 *  - Saatli etkinliklerde sürükle-bırak (gün + saat), alttan boyutlandırma, `snap` dakikalık hizalama
 *  - Boş alana tıkla/sürükle → yeni etkinlik aralığı
 *  - Çakışan etkinliklerin yan yana yerleşimi
 *  - Şu anki zaman çizgisi; kaydırma konumunun yeniden çizimler arasında korunması
 */
import { html } from '../core/dom.js';
import { addDaysISO, diffDays, formatDate, minutesToTime, nowMinutes, pad, timeToMinutes, todayISO } from '../core/dateUtils.js';
import { isTimed } from '../core/eventModel.js';
import { layoutOverlaps } from '../core/overlap.js';
import { clamp } from '../core/utils.js';
import { eventChip } from './eventCard.js';
import { enableDragDrop } from './dragDrop.js';

const scrollMemory = new Map();
const MIN_DURATION = 15;

const startMin = (o) => timeToMinutes(o.startTime);
const endMin = (o) => {
  const end = timeToMinutes(o.endTime);
  return Math.max(end === 1439 ? 1440 : end, startMin(o) + MIN_DURATION);
};

function eventBlock(o, layout, hourHeight, resizable) {
  const s = startMin(o);
  const e = endMin(o);
  const top = (s / 60) * hourHeight;
  const height = Math.max(((e - s) / 60) * hourHeight, 18);
  const width = 100 / layout.cols;
  const left = layout.col * width;
  return html`
    <div class="tg-event ${height < 40 ? 'is-short' : ''} ${o.status === 'done' ? 'is-done' : ''} ${o.critical ? 'is-critical' : ''}"
         data-occ-id="${o.id}" tabindex="0" role="button"
         style="top:${top}px;height:${height}px;left:calc(${left}% + 2px);width:calc(${width}% - 4px);--ev-color:${o.color}">
      <div class="tg-event-title">${o.title}</div>
      <div class="tg-event-time">${o.startTime} – ${o.endTime}</div>
      ${resizable ? html`<div class="tg-resize" data-resize aria-hidden="true"></div>` : ''}
    </div>`;
}

/**
 * @param {HTMLElement} el
 * @param {{days: string[], occurrences: object[], hourHeight?: number, snap?: number, resizable?: boolean,
 *          scrollKey?: string, onOpen?: Function, onCreate?: Function, onChange?: Function}} opts
 *   onChange(occ, changes) — taşıma/boyutlandırma sonucu { startDate, endDate, startTime?, endTime? }
 * @returns {Function} temizleme fonksiyonu
 */
export function renderTimeGrid(el, opts) {
  const { days, occurrences, hourHeight = 48, snap = 15, resizable = true, scrollKey = 'grid', onOpen, onCreate, onChange } = opts;
  const today = todayISO();
  const timed = occurrences.filter(isTimed);
  const allDay = occurrences.filter((o) => !isTimed(o));
  const byId = new Map(occurrences.map((o) => [o.id, o]));

  el.innerHTML = html`
    <div class="tg" style="--hour-h:${hourHeight}px;--tg-days:${days.length}">
      <div class="tg-head">
        <div class="tg-gutter"></div>
        ${days.map(
          (d) => html`<div class="tg-dayhead ${d === today ? 'is-today' : ''}" data-date="${d}">
            <span class="tg-dow">${formatDate(d, { weekday: 'short' })}</span>
            <span class="tg-dnum">${Number(d.slice(8))}</span>
          </div>`,
        )}
      </div>
      <div class="tg-allday">
        <div class="tg-gutter tg-allday-label">Tüm gün</div>
        ${days.map(
          (d) => html`<div class="tg-allday-cell" data-drop-date="${d}">
            ${allDay.filter((o) => o.startDate <= d && o.endDate >= d).map((o) => eventChip(o))}
          </div>`,
        )}
      </div>
      <div class="tg-scroll">
        <div class="tg-body" style="height:${24 * hourHeight}px">
          <div class="tg-hours">
            ${Array.from({ length: 24 }, (_, h) => html`<div class="tg-hour-label" style="top:${h * hourHeight}px">${h === 0 ? '' : `${pad(h)}:00`}</div>`)}
          </div>
          ${days.map((d) => {
            const items = timed.filter((o) => o.startDate === d);
            const layout = layoutOverlaps(items, startMin, endMin);
            return html`<div class="tg-col ${d === today ? 'is-today' : ''}" data-date="${d}">
              ${items.map((o) => eventBlock(o, layout.get(o.id), hourHeight, resizable))}
            </div>`;
          })}
        </div>
      </div>
    </div>`;

  const root = el.querySelector('.tg');
  const scroller = el.querySelector('.tg-scroll');
  const body = el.querySelector('.tg-body');
  const cols = [...el.querySelectorAll('.tg-col')];
  const snapTo = (m) => Math.round(m / snap) * snap;
  const minutesAt = (col, clientY) => ((clientY - col.getBoundingClientRect().top) / hourHeight) * 60;
  const colAt = (clientX) =>
    cols.find((c) => {
      const r = c.getBoundingClientRect();
      return clientX >= r.left && clientX < r.right;
    }) || null;

  // --- Kaydırma konumu ---
  const defaultScroll = days.includes(today) ? Math.max(0, ((nowMinutes() - 120) / 60) * hourHeight) : 7.5 * hourHeight;
  scroller.scrollTop = scrollMemory.get(scrollKey) ?? defaultScroll;
  const onScroll = () => scrollMemory.set(scrollKey, scroller.scrollTop);
  scroller.addEventListener('scroll', onScroll, { passive: true });

  // --- Şu anki zaman çizgisi ---
  let nowTimer = null;
  const todayCol = cols.find((c) => c.dataset.date === today);
  if (todayCol) {
    const line = document.createElement('div');
    line.className = 'tg-now';
    todayCol.appendChild(line);
    const paint = () => (line.style.top = `${(nowMinutes() / 60) * hourHeight}px`);
    paint();
    nowTimer = setInterval(paint, 60_000);
  }

  // --- Saatli etkinlik: sürükle / boyutlandır ---
  function setLabel(evEl, s, e) {
    const t = evEl.querySelector('.tg-event-time');
    if (t) t.textContent = `${minutesToTime(s)} – ${minutesToTime(e)}`;
  }

  function startEventDrag(e, evEl, isResize) {
    const occ = byId.get(evEl.dataset.occId);
    if (!occ) return;
    e.preventDefault();
    const origin = { x: e.clientX, y: e.clientY, s: startMin(occ), e: endMin(occ) };
    const dur = origin.e - origin.s;
    let moved = false;
    let targetCol = evEl.parentElement;
    let ns = origin.s;
    let ne = origin.e;
    evEl.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 4) return;
      if (!moved) {
        moved = true;
        evEl.classList.add('is-dragging');
        root.classList.add('is-interacting');
      }
      const delta = snapTo(((ev.clientY - origin.y) / hourHeight) * 60);
      if (isResize) {
        ne = clamp(origin.e + delta, origin.s + snap, 1440);
        evEl.style.height = `${((ne - origin.s) / 60) * hourHeight}px`;
        setLabel(evEl, origin.s, ne);
      } else {
        ns = clamp(origin.s + delta, 0, 1440 - dur);
        ne = ns + dur;
        const c = colAt(ev.clientX);
        if (c && c !== targetCol) {
          targetCol = c;
          c.appendChild(evEl);
        }
        evEl.style.top = `${(ns / 60) * hourHeight}px`;
        evEl.style.left = '2px';
        evEl.style.width = 'calc(100% - 4px)';
        setLabel(evEl, ns, ne);
      }
    };
    const finish = () => {
      evEl.removeEventListener('pointermove', onMove);
      evEl.removeEventListener('pointerup', finish);
      evEl.removeEventListener('pointercancel', finish);
      root.classList.remove('is-interacting');
      if (!moved) {
        onOpen?.(occ);
        return;
      }
      const date = targetCol.dataset.date;
      onChange?.(occ, { startDate: date, endDate: date, startTime: minutesToTime(ns), endTime: minutesToTime(Math.min(ne, 1439)) });
    };
    evEl.addEventListener('pointermove', onMove);
    evEl.addEventListener('pointerup', finish);
    evEl.addEventListener('pointercancel', finish);
  }

  // --- Boş alanda yeni etkinlik aralığı seçimi ---
  function startCreate(e, col) {
    const anchor = clamp(Math.floor(minutesAt(col, e.clientY) / snap) * snap, 0, 1440 - snap);
    const ghost = document.createElement('div');
    ghost.className = 'tg-ghost';
    let s = anchor;
    let en = Math.min(anchor + 60, 1440);
    let moved = false;
    const paint = () => {
      ghost.style.top = `${(s / 60) * hourHeight}px`;
      ghost.style.height = `${((en - s) / 60) * hourHeight}px`;
      ghost.textContent = `${minutesToTime(s)} – ${minutesToTime(Math.min(en, 1439))}`;
    };
    col.appendChild(ghost);
    paint();
    col.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const m = minutesAt(col, ev.clientY);
      if (!moved && Math.abs(m - anchor) < snap / 2) return;
      moved = true;
      if (m >= anchor) {
        s = anchor;
        en = clamp(Math.ceil(m / snap) * snap, anchor + snap, 1440);
      } else {
        s = clamp(Math.floor(m / snap) * snap, 0, anchor);
        en = anchor + snap;
      }
      paint();
    };
    const end = (cancelled) => {
      col.removeEventListener('pointermove', onMove);
      col.removeEventListener('pointerup', onUp);
      col.removeEventListener('pointercancel', onCancel);
      ghost.remove();
      if (cancelled) return;
      onCreate?.({ startDate: col.dataset.date, endDate: col.dataset.date, startTime: minutesToTime(s), endTime: minutesToTime(Math.min(en, 1439)) });
    };
    const onUp = () => end(false);
    const onCancel = () => end(true);
    col.addEventListener('pointermove', onMove);
    col.addEventListener('pointerup', onUp);
    col.addEventListener('pointercancel', onCancel);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const evEl = e.target.closest('.tg-event');
    if (evEl) {
      startEventDrag(e, evEl, Boolean(e.target.closest('[data-resize]')) && resizable);
      return;
    }
    const col = e.target.closest('.tg-col');
    if (col && onCreate) startCreate(e, col);
  }

  function onKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const evEl = e.target.closest('.tg-event');
    if (evEl && byId.has(evEl.dataset.occId)) {
      e.preventDefault();
      onOpen?.(byId.get(evEl.dataset.occId));
    }
  }

  body.addEventListener('pointerdown', onPointerDown);
  body.addEventListener('keydown', onKeyDown);

  // --- Tüm gün satırı: gün değiştirme ---
  const cleanupDnd = enableDragDrop(el.querySelector('.tg-allday'), {
    itemSelector: '.ev-chip',
    zoneSelector: '[data-drop-date]',
    onClick: (item) => onOpen?.(byId.get(item.dataset.occId)),
    onDrop: (item, zone) => {
      const occ = byId.get(item.dataset.occId);
      const target = zone.dataset.dropDate;
      if (!occ || !target) return;
      // Tıklanan günden bırakılan güne olan farkı uygula (çok günlü etkinlikler için)
      const fromCell = item.closest('[data-drop-date]')?.dataset.dropDate || occ.startDate;
      const shift = diffDays(fromCell, target);
      if (!shift) return;
      onChange?.(occ, { startDate: addDaysISO(occ.startDate, shift), endDate: addDaysISO(occ.endDate, shift) });
    },
  });

  return () => {
    clearInterval(nowTimer);
    scroller.removeEventListener('scroll', onScroll);
    body.removeEventListener('pointerdown', onPointerDown);
    body.removeEventListener('keydown', onKeyDown);
    cleanupDnd();
  };
}
