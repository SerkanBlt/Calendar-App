/**
 * week.js — Haftalık görünüm: 7 günlük saat ızgarası, sürükle-bırak (30 dk hizalama).
 * Çalışma dışı günler soluk gösterilir; Ayarlar'da veya başlıktaki düğmeyle gizlenebilir.
 */
import { html } from '../core/dom.js';
import { formatDate, rangeDays, startOfWeek, toISODate } from '../core/dateUtils.js';
import { expandEvents } from '../services/recurrenceService.js';
import { offDaySet, visibleDays } from '../core/workDays.js';
import { toolbar } from '../components/toolbar.js';
import { offDaysToggle } from '../components/offDaysToggle.js';
import { renderTimeGrid } from '../components/timeGrid.js';

export default {
  id: 'week',
  title: 'Hafta',

  render(el, ctx) {
    const { cursor, events, settings } = ctx.state;
    const week = rangeDays(toISODate(startOfWeek(cursor, settings.weekStartsOn)), 7);
    const days = visibleDays(week, settings);
    const off = offDaySet(week, settings.workDays);
    const occurrences = expandEvents(events, days[0], days[days.length - 1]);
    const last = days[days.length - 1];
    const title = `${formatDate(days[0], { day: 'numeric', month: 'short' })} – ${formatDate(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const hiddenCount = week.length - days.length;

    el.innerHTML = html`
      ${toolbar({
        title,
        subtitle: `${occurrences.length} etkinlik bu hafta${hiddenCount ? ` · ${hiddenCount} çalışma dışı gün gizli` : ''}`,
        nav: true,
        beforeNew: offDaysToggle(settings),
      })}
      <div class="view-body week"><div class="grid-host glass"></div></div>`;

    return renderTimeGrid(el.querySelector('.grid-host'), {
      days,
      occurrences,
      offDays: off,
      hourHeight: 44,
      snap: 30,
      scrollKey: 'week',
      onOpen: (occ) => ctx.openEditor(occ),
      onCreate: (range) => ctx.openEditor(range),
      onChange: (occ, changes) => ctx.moveOccurrence(occ, changes),
    });
  },
};
