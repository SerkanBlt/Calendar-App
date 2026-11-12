/**
 * week.js — Haftalık görünüm: 7 günlük saat ızgarası, sürükle-bırak (30 dk hizalama).
 */
import { html } from '../core/dom.js';
import { formatDate, rangeDays, startOfWeek, toISODate } from '../core/dateUtils.js';
import { expandEvents } from '../services/recurrenceService.js';
import { toolbar } from '../components/toolbar.js';
import { renderTimeGrid } from '../components/timeGrid.js';

export default {
  id: 'week',
  title: 'Hafta',

  render(el, ctx) {
    const { cursor, events, settings } = ctx.state;
    const days = rangeDays(toISODate(startOfWeek(cursor, settings.weekStartsOn)), 7);
    const occurrences = expandEvents(events, days[0], days[6]);
    const title = `${formatDate(days[0], { day: 'numeric', month: 'short' })} – ${formatDate(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;

    el.innerHTML = html`
      ${toolbar({ title, subtitle: `${occurrences.length} etkinlik bu hafta`, nav: true })}
      <div class="view-body week"><div class="grid-host glass"></div></div>`;

    return renderTimeGrid(el.querySelector('.grid-host'), {
      days,
      occurrences,
      hourHeight: 44,
      snap: 30,
      scrollKey: 'week',
      onOpen: (occ) => ctx.openEditor(occ),
      onCreate: (range) => ctx.openEditor(range),
      onChange: (occ, changes) => ctx.moveOccurrence(occ, changes),
    });
  },
};
