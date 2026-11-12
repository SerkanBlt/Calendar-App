/**
 * month.js — Aylık görünüm (6 haftalık ızgara).
 *
 * - Boş güne tıkla → o gün için yeni etkinlik
 * - Etkinliğe tıkla → düzenle; × → sil
 * - Etkinliği başka güne sürükle → taşı
 * - "+N daha" → gün görünümü
 */
import { html } from '../core/dom.js';
import { addDaysISO, diffDays, formatDate, rangeDays, startOfMonth, startOfWeek, toISODate, todayISO, weekdayNames } from '../core/dateUtils.js';
import { compareByStart, isAllDay } from '../core/eventModel.js';
import { expandEvents } from '../services/recurrenceService.js';
import { toolbar } from '../components/toolbar.js';
import { eventChip } from '../components/eventCard.js';
import { enableDragDrop } from '../components/dragDrop.js';
import { deleteOccurrence } from '../core/actions.js';

const MAX_VISIBLE = 3;

export default {
  id: 'month',
  title: 'Ay',

  render(el, ctx) {
    const { cursor, events, settings } = ctx.state;
    const monthStart = startOfMonth(cursor);
    const month = monthStart.getMonth();
    const gridStart = toISODate(startOfWeek(monthStart, settings.weekStartsOn));
    const days = rangeDays(gridStart, 42);
    const occurrences = expandEvents(events, days[0], days[41]);
    const byId = new Map(occurrences.map((o) => [o.id, o]));
    const today = todayISO();

    // Tüm gün/çok günlü etkinlikler önce, sonra saate göre
    const forDay = (d) =>
      occurrences
        .filter((o) => o.startDate <= d && o.endDate >= d)
        .sort((a, b) => Number(isAllDay(b)) - Number(isAllDay(a)) || compareByStart(a, b));

    el.innerHTML = html`
      ${toolbar({ title: formatDate(monthStart, { month: 'long', year: 'numeric' }), subtitle: `${occurrences.length} etkinlik`, nav: true })}
      <div class="view-body month">
        <div class="month-grid glass">
          ${weekdayNames(settings.weekStartsOn).map((d) => html`<div class="month-dow">${d}</div>`)}
          ${days.map((d) => {
            const items = forDay(d);
            const outside = Number(d.slice(5, 7)) - 1 !== month;
            return html`
              <div class="month-cell ${outside ? 'is-outside' : ''} ${d === today ? 'is-today' : ''} ${d === cursor ? 'is-cursor' : ''}" data-date="${d}" data-drop-date="${d}">
                <button type="button" class="month-daynum" data-day="${d}" aria-label="${formatDate(d)} gün görünümü">${Number(d.slice(8))}</button>
                <div class="month-events">
                  ${items.slice(0, MAX_VISIBLE).map((o) => eventChip(o, { deletable: true }))}
                  ${items.length > MAX_VISIBLE ? html`<button type="button" class="month-more" data-day="${d}">+${items.length - MAX_VISIBLE} daha</button>` : ''}
                </div>
              </div>`;
          })}
        </div>
      </div>`;

    const grid = el.querySelector('.month-grid');

    grid.addEventListener('click', (e) => {
      const del = e.target.closest('[data-delete]');
      if (del) {
        e.stopPropagation();
        const occ = byId.get(del.dataset.delete);
        if (occ) deleteOccurrence(occ);
        return;
      }
      const dayBtn = e.target.closest('[data-day]');
      if (dayBtn) {
        ctx.go('day', dayBtn.dataset.day);
        return;
      }
      if (e.target.closest('.ev-chip')) return; // dragDrop onClick ile işlenir
      const cell = e.target.closest('.month-cell');
      if (cell) ctx.openEditor({ startDate: cell.dataset.date, endDate: cell.dataset.date });
    });

    return enableDragDrop(grid, {
      itemSelector: '.ev-chip',
      zoneSelector: '[data-drop-date]',
      onClick: (item) => {
        const occ = byId.get(item.dataset.occId);
        if (occ) ctx.openEditor(occ);
      },
      onDrop: (item, zone) => {
        const occ = byId.get(item.dataset.occId);
        if (!occ) return;
        const fromDay = item.closest('[data-drop-date]').dataset.dropDate;
        const shift = diffDays(fromDay, zone.dataset.dropDate);
        if (!shift) return;
        ctx.moveOccurrence(occ, { startDate: addDaysISO(occ.startDate, shift), endDate: addDaysISO(occ.endDate, shift) });
      },
    });
  },
};
