/**
 * timeGrid.js — Saat bazlı takvim ızgarası (Week, Day ve Scheduler görünümlerinin ortak motoru).
 *
 * Özellikler:
 *  - 24 saatlik dikey ızgara, N gün sütunu
 *  - Tüm gün / çok günlü etkinlikler için üst satır
 *  - Saatli etkinliklerde sürükle-bırak (gün + saat), alttan boyutlandırma, `snap` dakikalık hizalama
 *  - Saatli etkinliği "Tüm gün" satırına bırakmak onu tüm gün yapar; tüm gün etkinliğini saat
 *    ızgarasına bırakmak bırakılan saatte 1 saatlik etkinliğe çevirir
 *  - Sürüklerken ızgaranın üst/alt kenarına yaklaşınca otomatik kaydırma
 *  - Dokunmatikte: dokun → aç, basılı tut → sürükle, kaydır → sayfa kayar
 *  - Boş alana tıkla/sürükle → yeni etkinlik aralığı
 *  - Çakışan etkinliklerin yan yana yerleşimi
 *  - Şu anki zaman çizgisi; kaydırma konumunun yeniden çizimler arasında korunması
 *
 * Not: Sürüklenen öğe DOM'da başka sütuna taşınmaz (taşımak tarayıcının imleç takibini koparıyordu);
 * yatay konum transform ile gösterilir ve tüm olaylar window üzerinden dinlenir.
 */
import { html } from '../core/dom.js';
import { addDaysISO, diffDays, formatDate, minutesToTime, nowMinutes, pad, timeToMinutes, todayISO } from '../core/dateUtils.js';
import { isTimed } from '../core/eventModel.js';
import { layoutOverlaps } from '../core/overlap.js';
import { clamp } from '../core/utils.js';
import { eventChip } from './eventCard.js';
import { enableDragDrop } from './dragDrop.js';
import { createAutoScroller } from './autoScroll.js';
import { isTouch, lockTouchScroll, waitForHold } from './touchHold.js';

const scrollMemory = new Map();
const MIN_DURATION = 15;
const DRAG_THRESHOLD = 4;

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
 *          scrollKey?: string, offDays?: Set<string>, onOpen?: Function, onCreate?: Function, onChange?: Function}} opts
 *   offDays: çalışma dışı günler (soluk gösterilir)
 *   onChange(occ, changes) — taşıma/boyutlandırma sonucu { startDate, endDate, startTime?, endTime? }
 * @returns {Function} temizleme fonksiyonu
 */
export function renderTimeGrid(el, opts) {
  const { days, occurrences, hourHeight = 48, snap = 15, resizable = true, scrollKey = 'grid', offDays = new Set(), onOpen, onCreate, onChange } = opts;
  const today = todayISO();
  const timed = occurrences.filter(isTimed);
  const allDay = occurrences.filter((o) => !isTimed(o));
  const byId = new Map(occurrences.map((o) => [o.id, o]));
  const dayClass = (d) => [d === today && 'is-today', offDays.has(d) && 'is-off'].filter(Boolean).join(' ');

  el.innerHTML = html`
    <div class="tg" style="--hour-h:${hourHeight}px;--tg-days:${days.length}">
      <div class="tg-head">
        <div class="tg-gutter"></div>
        ${days.map(
          (d) => html`<div class="tg-dayhead ${dayClass(d)}" data-date="${d}">
            <span class="tg-dow">${formatDate(d, { weekday: 'short' })}</span>
            <span class="tg-dnum">${Number(d.slice(8))}</span>
          </div>`,
        )}
      </div>
      <div class="tg-allday">
        <div class="tg-gutter tg-allday-label">Tüm gün</div>
        ${days.map(
          (d) => html`<div class="tg-allday-cell ${offDays.has(d) ? 'is-off' : ''}" data-drop-date="${d}">
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
            return html`<div class="tg-col ${dayClass(d)}" data-date="${d}">
              ${items.map((o) => eventBlock(o, layout.get(o.id), hourHeight, resizable))}
            </div>`;
          })}
        </div>
      </div>
    </div>`;

  const root = el.querySelector('.tg');
  const scrollEl = el.querySelector('.tg-scroll');
  const body = el.querySelector('.tg-body');
  const cols = [...el.querySelectorAll('.tg-col')];
  const snapTo = (m) => Math.round(m / snap) * snap;
  const minutesAt = (col, clientY) => ((clientY - col.getBoundingClientRect().top) / hourHeight) * 60;
  const colAt = (clientX) =>
    cols.find((c) => {
      const r = c.getBoundingClientRect();
      return clientX >= r.left && clientX < r.right;
    }) || null;
  const cleanups = [];

  // --- Kaydırma konumu ---
  const defaultScroll = days.includes(today) ? Math.max(0, ((nowMinutes() - 120) / 60) * hourHeight) : 7.5 * hourHeight;
  scrollEl.scrollTop = scrollMemory.get(scrollKey) ?? defaultScroll;
  const onScroll = () => scrollMemory.set(scrollKey, scrollEl.scrollTop);
  scrollEl.addEventListener('scroll', onScroll, { passive: true });

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

  /** window üzerinde belirli bir pointer için move/up/cancel dinler; temizleme fonksiyonu döner. */
  function trackPointer(pointerId, { move, up, cancel }) {
    const onMove = (ev) => ev.pointerId === pointerId && move(ev);
    const onUp = (ev) => ev.pointerId === pointerId && (stop(), up(ev));
    const onCancel = (ev) => ev.pointerId === pointerId && (stop(), cancel(ev));
    function stop() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    cleanups.push(stop);
    return stop;
  }

  function setLabel(evEl, s, e) {
    const t = evEl.querySelector('.tg-event-time');
    if (t) t.textContent = `${minutesToTime(s)} – ${minutesToTime(e)}`;
  }

  // --- Saatli etkinlik: sürükle / boyutlandır ---
  function startEventDrag(e, evEl, isResize, { unlock = null, armed = false } = {}) {
    const occ = byId.get(evEl.dataset.occId);
    if (!occ) return;
    const origCol = evEl.parentElement;
    const originalStyle = evEl.getAttribute('style');
    const s0 = startMin(occ);
    const e0 = endMin(occ);
    const dur = e0 - s0;
    const grab = minutesAt(origCol, e.clientY) - s0; // imlecin etkinlik başlangıcına uzaklığı (dk)
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    let targetCol = origCol;
    let ns = s0;
    let ne = e0;
    let allDayCell = null;

    const setAllDayCell = (cell) => {
      if (cell === allDayCell) return;
      allDayCell?.classList.remove('is-drop-target');
      cell?.classList.add('is-drop-target');
      allDayCell = cell;
      evEl.classList.toggle('is-to-allday', Boolean(cell));
    };

    function update(x, y) {
      if (isResize) {
        ne = clamp(snapTo(minutesAt(origCol, y)), s0 + snap, 1440);
        evEl.style.height = `${((ne - s0) / 60) * hourHeight}px`;
        setLabel(evEl, s0, ne);
        return;
      }
      const cell = document.elementFromPoint(x, y)?.closest('.tg-allday-cell');
      setAllDayCell(cell && root.contains(cell) ? cell : null);
      if (allDayCell) return;
      targetCol = colAt(x) || targetCol;
      ns = clamp(snapTo(minutesAt(targetCol, y) - grab), 0, 1440 - dur);
      ne = ns + dur;
      const shiftX = targetCol.getBoundingClientRect().left - origCol.getBoundingClientRect().left;
      evEl.style.top = `${(ns / 60) * hourHeight}px`;
      evEl.style.left = '2px';
      evEl.style.width = 'calc(100% - 4px)';
      evEl.style.transform = `translateX(${shiftX}px)`;
      setLabel(evEl, ns, ne);
    }

    const autoScroll = createAutoScroller({ container: scrollEl, axes: 'y', onScroll: (x, y) => moved && update(x, y) });

    function begin() {
      moved = true;
      evEl.classList.add('is-dragging');
      evEl.style.pointerEvents = 'none'; // altındaki hedefi (sütun / tüm gün hücresi) bulabilmek için
      root.classList.add('is-interacting');
    }
    if (armed) begin(); // dokunmatikte basılı tutunca sürükleme hemen başlar

    function finish() {
      autoScroll.stop();
      unlock?.();
      root.classList.remove('is-interacting');
      evEl.classList.remove('is-dragging', 'is-to-allday');
      evEl.style.pointerEvents = '';
    }

    trackPointer(e.pointerId, {
      move(ev) {
        if (!moved) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
          begin();
        }
        update(ev.clientX, ev.clientY);
        autoScroll.update(ev.clientX, ev.clientY);
      },
      up() {
        const target = allDayCell;
        setAllDayCell(null);
        finish();
        if (!moved || (ns === s0 && ne === e0 && targetCol === origCol && !target)) {
          evEl.setAttribute('style', originalStyle);
          if (!moved) onOpen?.(occ);
          return;
        }
        if (target) {
          const date = target.dataset.dropDate;
          onChange?.(occ, { startDate: date, endDate: date, startTime: '', endTime: '' });
          return;
        }
        const date = targetCol.dataset.date;
        onChange?.(occ, { startDate: date, endDate: date, startTime: minutesToTime(ns), endTime: minutesToTime(Math.min(ne, 1439)) });
      },
      cancel() {
        setAllDayCell(null);
        finish();
        evEl.setAttribute('style', originalStyle); // görsel değişiklikleri geri al
      },
    });
  }

  // --- Boş alanda yeni etkinlik aralığı seçimi ---
  function startCreate(e, col, { unlock = null } = {}) {
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

    function update(y) {
      const m = minutesAt(col, y);
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
    }
    const autoScroll = createAutoScroller({ container: scrollEl, axes: 'y', onScroll: (_x, y) => update(y) });
    const end = (cancelled) => {
      autoScroll.stop();
      unlock?.();
      ghost.remove();
      if (cancelled) return;
      onCreate?.({ startDate: col.dataset.date, endDate: col.dataset.date, startTime: minutesToTime(s), endTime: minutesToTime(Math.min(en, 1439)) });
    };
    trackPointer(e.pointerId, {
      move(ev) {
        update(ev.clientY);
        autoScroll.update(ev.clientX, ev.clientY);
      },
      up: () => end(false),
      cancel: () => end(true),
    });
  }

  async function onPointerDown(e) {
    if (e.button !== 0) return;
    const evEl = e.target.closest('.tg-event');
    const col = e.target.closest('.tg-col');
    if (!evEl && !(col && onCreate)) return;
    const isResize = Boolean(evEl && e.target.closest('[data-resize]')) && resizable;

    if (isTouch(e)) {
      // Dokunmatik: kaydırmaya izin ver; sürükleme yalnızca basılı tutunca başlar
      const result = await waitForHold(e);
      if (result === 'move') return;
      if (result === 'tap') {
        if (evEl) onOpen?.(byId.get(evEl.dataset.occId));
        else onCreate?.(createRangeAt(col, e.clientY));
        return;
      }
      const unlock = lockTouchScroll();
      if (evEl) startEventDrag(e, evEl, isResize, { unlock, armed: true });
      else startCreate(e, col, { unlock });
      return;
    }

    e.preventDefault(); // fareyle sürüklerken metin seçimini engelle
    if (evEl) startEventDrag(e, evEl, isResize);
    else startCreate(e, col);
  }

  /** Dokunarak tek tıkla oluşturma: dokunulan yerden başlayan 1 saatlik aralık. */
  function createRangeAt(col, clientY) {
    const s = clamp(Math.floor(minutesAt(col, clientY) / snap) * snap, 0, 1440 - snap);
    return { startDate: col.dataset.date, endDate: col.dataset.date, startTime: minutesToTime(s), endTime: minutesToTime(Math.min(s + 60, 1439)) };
  }

  function onKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const evEl = e.target.closest('.tg-event');
    if (evEl && byId.has(evEl.dataset.occId)) {
      e.preventDefault();
      onOpen?.(byId.get(evEl.dataset.occId));
    }
  }

  // Dokunmatikte uzun basınca açılan sistem menüsünü engelle (basılı tutmak sürüklemeyi başlatır)
  const onContextMenu = (e) => {
    if (e.target.closest('.tg-event, .tg-col')) e.preventDefault();
  };

  body.addEventListener('pointerdown', onPointerDown);
  body.addEventListener('keydown', onKeyDown);
  body.addEventListener('contextmenu', onContextMenu);

  // --- Tüm gün etkinlikleri: başka güne taşı veya saat ızgarasına bırak (saatli yap) ---
  const cleanupDnd = enableDragDrop(root, {
    itemSelector: '.tg-allday .ev-chip',
    zoneSelector: '.tg-allday-cell, .tg-col',
    onClick: (item) => onOpen?.(byId.get(item.dataset.occId)),
    onDrop: (item, zone, point) => {
      const occ = byId.get(item.dataset.occId);
      if (!occ) return;
      // Tek günlük tüm gün etkinliği saat ızgarasına bırakılırsa saatli olur.
      // Çok günlü etkinlikler süresini kaybetmesin diye yalnızca gün kaydırılır.
      if (zone.classList.contains('tg-col') && occ.startDate === occ.endDate) {
        const s = clamp(snapTo(minutesAt(zone, point.y)), 0, 1440 - 60);
        onChange?.(occ, { startDate: zone.dataset.date, endDate: zone.dataset.date, startTime: minutesToTime(s), endTime: minutesToTime(Math.min(s + 60, 1439)) });
        return;
      }
      // Tutulan günden bırakılan güne olan farkı uygula (çok günlü etkinlikler için)
      const fromCell = item.closest('[data-drop-date]')?.dataset.dropDate || occ.startDate;
      const shift = diffDays(fromCell, zone.dataset.dropDate || zone.dataset.date);
      if (!shift) return;
      onChange?.(occ, { startDate: addDaysISO(occ.startDate, shift), endDate: addDaysISO(occ.endDate, shift) });
    },
  });

  return () => {
    clearInterval(nowTimer);
    scrollEl.removeEventListener('scroll', onScroll);
    body.removeEventListener('pointerdown', onPointerDown);
    body.removeEventListener('keydown', onKeyDown);
    body.removeEventListener('contextmenu', onContextMenu);
    cleanups.forEach((fn) => fn());
    cleanupDnd();
  };
}
