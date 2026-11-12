/**
 * scheduler.js — Google/Outlook Calendar benzeri planlayıcı.
 *
 * 24 saat, 15 dakikalık snap, sürükle-bırak, boyutlandırma, çakışma yerleşimi ve tüm gün satırı.
 * Ek kontroller: gün sayısı (1/3/5/7) ve yakınlaştırma (saat yüksekliği). Tercihler ayarlarda saklanır.
 */
import { html } from '../core/dom.js';
import { formatDate, rangeDays, startOfWeek, toISODate } from '../core/dateUtils.js';
import { expandEvents } from '../services/recurrenceService.js';
import { toolbar } from '../components/toolbar.js';
import { renderTimeGrid } from '../components/timeGrid.js';
import { icon } from '../components/icons.js';
import { clamp } from '../core/utils.js';

const DAY_OPTIONS = [1, 3, 5, 7];
const ZOOM_MIN = 32;
const ZOOM_MAX = 120;

/** Gün sayısına göre görünen ilk gün: 7 → hafta başı, 5 → iş haftası (Pzt), diğer → imleç. */
export function schedulerRange(cursor, count, weekStartsOn) {
  let start = cursor;
  if (count === 7) start = toISODate(startOfWeek(cursor, weekStartsOn));
  else if (count === 5) start = toISODate(startOfWeek(cursor, 1));
  return rangeDays(start, count);
}

export default {
  id: 'scheduler',
  title: 'Scheduler',

  render(el, ctx) {
    const { cursor, events, settings } = ctx.state;
    const count = DAY_OPTIONS.includes(settings.schedulerDays) ? settings.schedulerDays : 7;
    const hourHeight = clamp(settings.schedulerHourHeight, ZOOM_MIN, ZOOM_MAX);
    const days = schedulerRange(cursor, count, settings.weekStartsOn);
    const occurrences = expandEvents(events, days[0], days[days.length - 1]);
    const title =
      count === 1
        ? formatDate(days[0], { weekday: 'long', day: 'numeric', month: 'long' })
        : `${formatDate(days[0], { day: 'numeric', month: 'short' })} – ${formatDate(days[days.length - 1], { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const extra = html`
      <div class="segmented segmented--sm" role="radiogroup" aria-label="Gün sayısı">
        ${DAY_OPTIONS.map((n) => html`<button type="button" role="radio" aria-checked="${String(n === count)}" class="${n === count ? 'is-active' : ''}" data-days="${n}">${n === 5 ? 'İş haftası' : `${n} gün`}</button>`)}
      </div>
      <div class="btn-group">
        <button type="button" class="icon-btn" data-zoom="-8" aria-label="Uzaklaştır" ${hourHeight <= ZOOM_MIN ? 'disabled' : ''}>${icon('minus')}</button>
        <button type="button" class="icon-btn" data-zoom="8" aria-label="Yakınlaştır" ${hourHeight >= ZOOM_MAX ? 'disabled' : ''}>${icon('plus')}</button>
      </div>`;

    el.innerHTML = html`
      ${toolbar({ title, subtitle: `15 dk snap · ${occurrences.length} etkinlik`, nav: true, extra })}
      <div class="view-body scheduler"><div class="grid-host glass"></div></div>`;

    el.querySelector('.toolbar').addEventListener('click', (e) => {
      const daysBtn = e.target.closest('[data-days]');
      if (daysBtn) ctx.setSetting('schedulerDays', Number(daysBtn.dataset.days));
      const zoom = e.target.closest('[data-zoom]');
      if (zoom) ctx.setSetting('schedulerHourHeight', clamp(hourHeight + Number(zoom.dataset.zoom), ZOOM_MIN, ZOOM_MAX));
    });

    return renderTimeGrid(el.querySelector('.grid-host'), {
      days,
      occurrences,
      hourHeight,
      snap: 15,
      scrollKey: `scheduler-${hourHeight}`,
      onOpen: (occ) => ctx.openEditor(occ),
      onCreate: (range) => ctx.openEditor(range),
      onChange: (occ, changes) => ctx.moveOccurrence(occ, changes),
    });
  },
};
