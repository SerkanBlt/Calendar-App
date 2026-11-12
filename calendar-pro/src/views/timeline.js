/**
 * timeline.js — Kronolojik etkinlik akışı (aya ve güne göre gruplu).
 * Filtreler: Tümü / Yaklaşan / Geçmiş + metin araması. Varsayılan aralık: -30 / +90 gün.
 */
import { html } from '../core/dom.js';
import { addDaysISO, formatDate, relativeDayLabel, todayISO } from '../core/dateUtils.js';
import { compareByStart } from '../core/eventModel.js';
import { normalizeText } from '../core/utils.js';
import { expandEvents } from '../services/recurrenceService.js';
import { toolbar } from '../components/toolbar.js';
import { timeLabel } from '../components/eventCard.js';
import { icon } from '../components/icons.js';
import { STATUS_LABELS } from '../core/eventModel.js';

const FILTERS = [
  { id: 'upcoming', label: 'Yaklaşan' },
  { id: 'all', label: 'Tümü' },
  { id: 'past', label: 'Geçmiş' },
];

// Görünüm yeniden çizildiğinde filtre durumu korunur (modül kapsamlı, view'a özel).
const viewState = { filter: 'upcoming', query: '' };

export default {
  id: 'timeline',
  title: 'Timeline',

  render(el, ctx) {
    const { events } = ctx.state;
    const today = todayISO();
    const all = expandEvents(events, addDaysISO(today, -30), addDaysISO(today, 90)).sort(compareByStart);
    const byId = new Map(all.map((o) => [o.id, o]));

    el.innerHTML = html`
      ${toolbar({ title: 'Timeline', subtitle: 'Son 30 gün ve önümüzdeki 90 gün' })}
      <div class="view-body timeline">
        <div class="timeline-controls">
          <div class="segmented" role="radiogroup" aria-label="Filtre">
            ${FILTERS.map((f) => html`<button type="button" role="radio" data-filter="${f.id}">${f.label}</button>`)}
          </div>
          <label class="search-input">${icon('search')}<input type="search" placeholder="Etkinliklerde ara…" value="${viewState.query}" aria-label="Etkinliklerde ara" /></label>
        </div>
        <div class="timeline-stream"></div>
      </div>`;

    const stream = el.querySelector('.timeline-stream');
    const searchInput = el.querySelector('.search-input input');

    function paint() {
      el.querySelectorAll('[data-filter]').forEach((b) => {
        const on = b.dataset.filter === viewState.filter;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      const q = normalizeText(viewState.query.trim());
      const items = all.filter((o) => {
        if (viewState.filter === 'upcoming' && o.endDate < today) return false;
        if (viewState.filter === 'past' && o.endDate >= today) return false;
        return !q || normalizeText(`${o.title} ${o.description} ${o.category}`).includes(q);
      });
      if (viewState.filter === 'past') items.reverse();

      if (!items.length) {
        stream.innerHTML = html`<div class="empty-state glass">${icon('timeline')}<p>Gösterilecek etkinlik yok.</p></div>`;
        return;
      }

      const groups = new Map();
      items.forEach((o) => {
        const month = o.startDate.slice(0, 7);
        if (!groups.has(month)) groups.set(month, new Map());
        const days = groups.get(month);
        if (!days.has(o.startDate)) days.set(o.startDate, []);
        days.get(o.startDate).push(o);
      });

      stream.innerHTML = html`${[...groups].map(
        ([month, days]) => html`
          <section class="tl-month">
            <h2 class="tl-month-title">${formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h2>
            ${[...days].map(
              ([day, list]) => html`
                <div class="tl-day ${day === today ? 'is-today' : ''} ${day < today ? 'is-past' : ''}">
                  <div class="tl-date">
                    <span class="tl-dnum">${Number(day.slice(8))}</span>
                    <span class="tl-dow">${formatDate(day, { weekday: 'short' })}</span>
                    <span class="tl-rel">${relativeDayLabel(day)}</span>
                  </div>
                  <div class="tl-items">
                    ${list.map(
                      (o) => html`
                        <button type="button" class="tl-item glass" data-occ-id="${o.id}" style="--ev-color:${o.color}">
                          <span class="tl-dot"></span>
                          <span class="tl-time">${timeLabel(o)}</span>
                          <span class="tl-title">${o.title}</span>
                          ${o.category ? html`<span class="tag">${o.category}</span>` : ''}
                          <span class="status status--${o.status}">${STATUS_LABELS[o.status]}</span>
                        </button>`,
                    )}
                  </div>
                </div>`,
            )}
          </section>`,
      )}`;
    }

    el.querySelector('.timeline-controls').addEventListener('click', (e) => {
      const f = e.target.closest('[data-filter]');
      if (f) {
        viewState.filter = f.dataset.filter;
        paint();
      }
    });
    searchInput.addEventListener('input', () => {
      viewState.query = searchInput.value;
      paint();
    });
    stream.addEventListener('click', (e) => {
      const item = e.target.closest('[data-occ-id]');
      if (item) ctx.openEditor(byId.get(item.dataset.occId));
    });

    paint();
  },
};
