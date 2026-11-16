/**
 * year.js — Yıl görünümü: 12 aylık özet + tatil günleri tanımlama.
 *
 * - 12 ay küçük ay kartları olarak gösterilir; çalışma dışı günler (çalışma günü olmayan hafta günleri) soluk, tatil günleri kırmızı, etkinlik olan günler noktalı.
 * - Bir güne tıklayınca tatil penceresi açılır: o gün tatil olarak işaretlenir (ad, isteğe bağlı bitiş tarihi) ya da var olan tatil düzenlenir/silinir.
 *   "Her yıl aynı tarihte tekrarla" açıksa tatil her yıl aynı ay-günde çalışma dışı (off) görünür; kapalıysa yalnızca o yıl için geçerlidir.
 * - Altta o yılın tatil listesi (tarih, ad, "Her yıl" / "Yalnızca <yıl>") ve düzenle/sil eylemleri bulunur. Silme "Geri al" ile geri alınır.
 * - Ay başlığına tıklamak Ay görünümüne götürür. Geri/İleri bir yıl kaydırır.
 * Tatiller `settings.holidays` içinde saklanır ve Ay/Hafta/Gün/Scheduler/Gantt/mini takvimde çalışma dışı gün olarak görünür (bkz. core/holidays.js).
 */
import { html } from '../core/dom.js';
import { addDaysISO, diffDays, formatDate, startOfWeek, toISODate, todayISO, weekdayNames } from '../core/dateUtils.js';
import { holidaysInYear, normalizeHolidays, removeHoliday } from '../core/holidays.js';
import { normalizeWorkDays } from '../core/workDays.js';
import { expandEvents } from '../services/recurrenceService.js';
import { toolbar } from '../components/toolbar.js';
import { icon } from '../components/icons.js';
import { openHolidayDialog } from '../components/holidayDialog.js';
import { toast } from '../components/toast.js';

export default {
  id: 'year',
  title: 'Yıl',

  render(el, ctx) {
    const { cursor, events, settings } = ctx.state;
    const year = Number(cursor.slice(0, 4));
    const first = `${year}-01-01`;
    const last = `${year}-12-31`;
    const today = todayISO();
    const holidays = normalizeHolidays(settings.holidays);
    const inYear = holidaysInYear(holidays, year);
    const work = new Set(normalizeWorkDays(settings.workDays));
    const occurrences = expandEvents(events, first, last);

    // Gün başına etkinlik sayısı (çok günlü etkinlikler her güne yazılır)
    const busy = new Map();
    for (const o of occurrences) {
      const to = o.endDate > last ? last : o.endDate;
      for (let d = o.startDate < first ? first : o.startDate; d <= to; d = addDaysISO(d, 1)) busy.set(d, (busy.get(d) || 0) + 1);
    }

    const dows = weekdayNames(settings.weekStartsOn, 'narrow');
    const monthCard = (m) => {
      const monthFirst = new Date(year, m, 1);
      const lead = diffDays(toISODate(startOfWeek(monthFirst, settings.weekStartsOn)), toISODate(monthFirst));
      const total = new Date(year, m + 1, 0).getDate();
      const cells = [
        ...Array.from({ length: lead }, () => html`<span class="year-day is-blank" aria-hidden="true"></span>`),
        ...Array.from({ length: total }, (_, i) => {
          const d = toISODate(new Date(year, m, i + 1));
          const hol = inYear.get(d);
          const off = !work.has(new Date(year, m, i + 1).getDay());
          const n = busy.get(d) || 0;
          const label = `${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${hol ? `, tatil: ${hol.name}${hol.yearly ? ' (her yıl)' : ''}` : ''}${n ? `, ${n} etkinlik` : ''}`;
          const cls = ['year-day', off && 'is-off', hol && 'is-holiday', hol?.yearly && 'is-yearly', d === today && 'is-today', n && 'has-events'].filter(Boolean).join(' ');
          return html`<button type="button" class="${cls}" data-date="${d}" aria-label="${label}" title="${label}">${i + 1}</button>`;
        }),
      ];
      return html`
        <section class="year-month glass" aria-label="${formatDate(monthFirst, { month: 'long', year: 'numeric' })}">
          <button type="button" class="year-month-title" data-month="${toISODate(monthFirst)}" title="Ay görünümünde aç">${formatDate(monthFirst, { month: 'long' })}</button>
          <div class="year-weekdays" aria-hidden="true">${dows.map((n) => html`<span class="year-dow">${n}</span>`)}</div>
          <div class="year-days">${cells}</div>
        </section>`;
    };

    // Tatil listesi: o yılın tatilleri tarih sırasıyla
    const rows = [...inYear.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((info) => info.entries.map((entry) => ({ date: info.date, entry })));

    el.innerHTML = html`
      ${toolbar({
        title: String(year),
        subtitle: `${occurrences.length} etkinlik · ${inYear.size} tatil günü`,
        nav: true,
        beforeNew: html`<button type="button" class="btn btn-ghost btn-sm" data-add-holiday title="Tatil günü ekle">${icon('flag')}<span class="hide-sm">Tatil ekle</span></button>`,
      })}
      <div class="view-body year">
        <div class="year-grid">${Array.from({ length: 12 }, (_, m) => monthCard(m))}</div>
        <div class="year-legend" aria-hidden="true">
          <span><i class="year-key is-holiday"></i>Tatil günü</span>
          <span><i class="year-key is-off"></i>Çalışma dışı gün</span>
          <span><i class="year-key has-events"></i>Etkinlik var</span>
        </div>
        <section class="panel glass year-holidays">
          <header class="panel-head">
            <h2>${icon('flag')} Tatil günleri · ${year} <span class="count">${inYear.size}</span></h2>
            <button type="button" class="btn btn-ghost btn-sm" data-add-holiday>${icon('plus')} Tatil ekle</button>
          </header>
          ${rows.length
            ? html`<ul class="holiday-list">
                ${rows.map(
                  ({ date, entry }) => html`<li class="holiday-row" data-id="${entry.id}" data-date="${date}">
                    <span class="holiday-date">${formatDate(date, { day: 'numeric', month: 'short', weekday: 'short' })}</span>
                    <span class="holiday-name">${entry.name || 'Tatil'}</span>
                    <span class="holiday-badge ${entry.yearly ? 'is-yearly' : ''}">${entry.yearly ? html`${icon('repeat')} Her yıl` : `Yalnızca ${year}`}</span>
                    <span class="holiday-actions">
                      <button type="button" class="btn btn-ghost btn-sm" data-edit>Düzenle</button>
                      <button type="button" class="btn btn-danger-ghost btn-sm" data-del>Sil</button>
                    </span>
                  </li>`,
                )}
              </ul>`
            : html`<div class="empty-mini">Bu yıl için tatil günü yok. Takvimde bir güne dokunarak ya da <b>Tatil ekle</b> ile tanımlayın; "Her yıl aynı tarihte tekrarla" işaretlenirse her yıl çalışma dışı (off) görünür.</div>`}
        </section>
      </div>`;

    el.addEventListener('click', onClick);

    function onClick(e) {
      const t = e.target;
      const month = t.closest('[data-month]');
      if (month) return ctx.go('month', month.dataset.month);
      if (t.closest('[data-add-holiday]')) return openHolidayDialog({ date: today.startsWith(String(year)) ? today : first, ctx });
      const day = t.closest('.year-day[data-date]');
      if (day) return openHolidayDialog({ date: day.dataset.date, ctx });
      const row = t.closest('.holiday-row');
      if (!row) return undefined;
      if (t.closest('[data-edit]')) return openHolidayDialog({ date: row.dataset.date, ctx });
      if (t.closest('[data-del]')) {
        const before = holidays;
        ctx.setSetting('holidays', removeHoliday(holidays, row.dataset.id));
        toast('Tatil kaldırıldı', { type: 'warning', duration: 6000, action: { label: 'Geri al', onClick: () => ctx.setSetting('holidays', before) } });
      }
      return undefined;
    }

    return () => el.removeEventListener('click', onClick);
  },
};
