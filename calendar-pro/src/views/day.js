/**
 * day.js — Günlük görünüm: saat bazlı ızgara + ajanda paneli ve çakışma yönetimi.
 *
 * Çakışan etkinlikler ızgarada yan yana yerleşir; yan panelde çakışma listesi gösterilir
 * ve tek tıkla bir etkinliği bir sonraki boş zamana kaydırma imkânı sunulur.
 */
import { html } from '../core/dom.js';
import { formatDate, minutesToTime, relativeDayLabel, timeToMinutes } from '../core/dateUtils.js';
import { compareByStart, isTimed } from '../core/eventModel.js';
import { findConflicts } from '../core/overlap.js';
import { expandEvents } from '../services/recurrenceService.js';
import { toolbar } from '../components/toolbar.js';
import { renderTimeGrid } from '../components/timeGrid.js';
import { eventRow } from '../components/eventCard.js';
import { icon } from '../components/icons.js';

const s = (o) => timeToMinutes(o.startTime);
const e = (o) => Math.max(timeToMinutes(o.endTime), s(o) + 15);

/** `occ` için gün içindeki diğer etkinliklerle çakışmayan ilk boşluğu bulur. */
function nextFreeSlot(occ, others) {
  const dur = e(occ) - s(occ);
  const busy = others.filter((o) => o.id !== occ.id).sort((a, b) => s(a) - s(b));
  let candidate = s(occ);
  for (const o of busy) {
    if (candidate + dur <= s(o)) continue;
    if (candidate < e(o)) candidate = e(o);
  }
  return candidate + dur <= 1440 ? candidate : null;
}

export default {
  id: 'day',
  title: 'Gün',

  render(el, ctx) {
    const { cursor, events } = ctx.state;
    const occurrences = expandEvents(events, cursor, cursor).sort(compareByStart);
    const timed = occurrences.filter(isTimed);
    const conflicts = findConflicts(timed, s, e);
    const byId = new Map(occurrences.map((o) => [o.id, o]));

    el.innerHTML = html`
      ${toolbar({ title: formatDate(cursor, { weekday: 'long', day: 'numeric', month: 'long' }), subtitle: `${relativeDayLabel(cursor)} · ${occurrences.length} etkinlik`, nav: true })}
      <div class="view-body day-layout">
        <div class="grid-host glass"></div>
        <aside class="day-side">
          <section class="panel glass">
            <header class="panel-head"><h2>${icon('timeline')} Ajanda</h2></header>
            ${occurrences.length ? html`<ul class="ev-list">${occurrences.map((o) => eventRow(o))}</ul>` : html`<div class="empty-mini">Bu gün boş. Izgarada sürükleyerek etkinlik oluşturun.</div>`}
          </section>
          <section class="panel glass ${conflicts.length ? 'has-conflicts' : ''}">
            <header class="panel-head"><h2>${icon('alert')} Çakışmalar <span class="count">${conflicts.length}</span></h2></header>
            ${conflicts.length
              ? html`<ul class="conflict-list">
                  ${conflicts.map(
                    ([a, b]) => html`<li>
                      <div><b>${a.title}</b> <span class="muted">${a.startTime}–${a.endTime}</span></div>
                      <div><b>${b.title}</b> <span class="muted">${b.startTime}–${b.endTime}</span></div>
                      <button type="button" class="btn btn-ghost btn-sm" data-resolve="${b.id}">"${b.title}" etkinliğini boş zamana kaydır</button>
                    </li>`,
                  )}
                </ul>`
              : html`<div class="empty-mini">${icon('check')} Çakışma yok.</div>`}
          </section>
        </aside>
      </div>`;

    el.querySelector('.day-side').addEventListener('click', (ev) => {
      const resolve = ev.target.closest('[data-resolve]');
      if (resolve) {
        const occ = byId.get(resolve.dataset.resolve);
        const slot = nextFreeSlot(occ, timed);
        if (slot == null) return;
        const dur = e(occ) - s(occ);
        ctx.moveOccurrence(occ, { startTime: minutesToTime(slot), endTime: minutesToTime(slot + dur) });
        return;
      }
      const row = ev.target.closest('[data-occ-id]');
      if (row) ctx.openEditor(byId.get(row.dataset.occId));
    });

    return renderTimeGrid(el.querySelector('.grid-host'), {
      days: [cursor],
      occurrences,
      hourHeight: 60,
      snap: 15,
      scrollKey: 'day',
      onOpen: (occ) => ctx.openEditor(occ),
      onCreate: (range) => ctx.openEditor(range),
      onChange: (occ, changes) => ctx.moveOccurrence(occ, changes),
    });
  },
};
