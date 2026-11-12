/**
 * kanban.js — Todo / Doing / Done panosu.
 * Kartlar kolonlar arasında sürüklenerek durum değiştirir; "Done"a taşınan görevin ilerlemesi %100 olur.
 */
import { html } from '../core/dom.js';
import { compareByStart, STATUSES, STATUS_LABELS } from '../core/eventModel.js';
import { normalizeText } from '../core/utils.js';
import { toolbar } from '../components/toolbar.js';
import { eventCard } from '../components/eventCard.js';
import { enableDragDrop } from '../components/dragDrop.js';
import { icon } from '../components/icons.js';

const viewState = { query: '' };

export default {
  id: 'kanban',
  title: 'Kanban',

  render(el, ctx) {
    const { events, cursor } = ctx.state;
    const byId = new Map(events.map((e) => [e.id, e]));

    const extra = html`<label class="search-input search-input--sm">${icon('search')}<input type="search" placeholder="Filtrele…" value="${viewState.query}" aria-label="Görevleri filtrele" /></label>`;

    el.innerHTML = html`
      ${toolbar({ title: 'Kanban', subtitle: `${events.length} görev`, extra })}
      <div class="view-body kanban"></div>`;

    const board = el.querySelector('.kanban');

    function paint() {
      const q = normalizeText(viewState.query.trim());
      const visible = events.filter((e) => !q || normalizeText(`${e.title} ${e.category} ${e.description}`).includes(q));
      board.innerHTML = html`${STATUSES.map((status) => {
        const items = visible.filter((e) => e.status === status).sort(compareByStart);
        return html`
          <section class="kanban-col glass kanban-col--${status}" data-status="${status}" aria-label="${STATUS_LABELS[status]}">
            <header class="kanban-head">
              <span class="status-dot status-dot--${status}"></span>
              <h2>${STATUS_LABELS[status]}</h2>
              <span class="count">${items.length}</span>
              <button type="button" class="icon-btn icon-btn-sm" data-add="${status}" aria-label="${STATUS_LABELS[status]} kolonuna ekle">${icon('plus')}</button>
            </header>
            <div class="kanban-list">
              ${items.length ? items.map((e) => eventCard(e)) : html`<div class="kanban-empty">Kartı buraya sürükleyin</div>`}
            </div>
          </section>`;
      })}`;
    }

    board.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) ctx.openEditor({ startDate: cursor, status: add.dataset.add, startTime: '', endTime: '' });
    });

    el.querySelector('.toolbar input').addEventListener('input', (e) => {
      viewState.query = e.target.value;
      paint();
    });

    paint();

    return enableDragDrop(board, {
      itemSelector: '.ev-card',
      zoneSelector: '.kanban-col',
      onClick: (card) => ctx.openEditor(byId.get(card.dataset.eventId)),
      onDrop: (card, col) => {
        const ev = byId.get(card.dataset.eventId);
        const status = col.dataset.status;
        if (!ev || ev.status === status) return;
        const patch = { status };
        if (status === 'done') patch.progress = 100;
        else if (ev.status === 'done' && ev.progress === 100) patch.progress = status === 'doing' ? 50 : 0;
        ctx.updateEvent(ev.id, patch);
      },
    });
  },
};
