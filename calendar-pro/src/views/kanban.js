/**
 * kanban.js — Todo / Doing / Done panosu.
 * Kartlar kolonlar arasında sürüklenerek durum değiştirir; "Done"a taşınan görevin ilerlemesi %100 olur.
 * Düzen seçilebilir (settings.kanbanLayout): kolonlar yan yana (varsayılan) veya alt alta. Paneller başlıklarından daraltılıp genişletilebilir (settings.kanbanCollapsed).
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

    const layout = ctx.state.settings.kanbanLayout === 'rows' ? 'rows' : 'columns';
    const extra = html`
      <div class="segmented segmented--sm segmented--icons" role="radiogroup" aria-label="Kolon düzeni">
        <button type="button" role="radio" data-layout="columns" aria-checked="${String(layout === 'columns')}" class="${layout === 'columns' ? 'is-active' : ''}" title="Kolonlar yan yana" aria-label="Kolonlar yan yana">${icon('kanban')}</button>
        <button type="button" role="radio" data-layout="rows" aria-checked="${String(layout === 'rows')}" class="${layout === 'rows' ? 'is-active' : ''}" title="Kolonlar alt alta" aria-label="Kolonlar alt alta">${icon('timeline')}</button>
      </div>
      <label class="search-input search-input--sm">${icon('search')}<input type="search" placeholder="Filtrele…" value="${viewState.query}" aria-label="Görevleri filtrele" /></label>`;

    el.innerHTML = html`
      ${toolbar({ title: 'Kanban', subtitle: `${events.length} görev`, extra })}
      <div class="view-body kanban kanban--${layout}"></div>`;

    el.querySelector('.toolbar').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-layout]');
      if (btn && btn.dataset.layout !== layout) ctx.setSetting('kanbanLayout', btn.dataset.layout);
    });

    const board = el.querySelector('.kanban');
    // Daraltılmış paneller (ayarlarda saklanır). Dışarıdan (içe aktarma) gelen değer güvenilmez: yalnızca bilinen durumlar ve yalnızca `true` kabul edilir.
    const rawCollapsed = ctx.state.settings.kanbanCollapsed;
    const collapsed = Object.fromEntries(STATUSES.map((st) => [st, Boolean(rawCollapsed && rawCollapsed[st] === true)]));

    function paint() {
      const q = normalizeText(viewState.query.trim());
      const visible = events.filter((e) => !q || normalizeText(`${e.title} ${e.category} ${e.description} ${e.project ?? ''}`).includes(q));
      board.innerHTML = html`${STATUSES.map((status) => {
        const items = visible.filter((e) => e.status === status).sort(compareByStart);
        const isCollapsed = collapsed[status];
        return html`
          <section class="kanban-col glass kanban-col--${status} ${isCollapsed ? 'is-collapsed' : ''}" data-status="${status}" aria-label="${STATUS_LABELS[status]}">
            <header class="kanban-head" data-head="${status}">
              <button type="button" class="icon-btn icon-btn-sm kanban-toggle" data-toggle="${status}" aria-expanded="${String(!isCollapsed)}" aria-controls="kanban-list-${status}"
                      aria-label="${STATUS_LABELS[status]} panelini ${isCollapsed ? 'genişlet' : 'daralt'}" title="${isCollapsed ? 'Genişlet' : 'Daralt'}">${icon('chevronDown')}</button>
              <span class="status-dot status-dot--${status}"></span>
              <h2>${STATUS_LABELS[status]}</h2>
              <span class="count">${items.length}</span>
              <button type="button" class="icon-btn icon-btn-sm" data-add="${status}" aria-label="${STATUS_LABELS[status]} kolonuna ekle">${icon('plus')}</button>
            </header>
            <div class="kanban-list" id="kanban-list-${status}" ${isCollapsed ? 'hidden' : ''}>
              ${items.length ? items.map((e) => eventCard(e)) : html`<div class="kanban-empty">Kartı buraya sürükleyin</div>`}
            </div>
          </section>`;
      })}`;
    }

    board.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) {
        ctx.openEditor({ startDate: cursor, status: add.dataset.add, startTime: '', endTime: '' });
        return;
      }
      // Panel başlığına (düğme dahil) tıklamak paneli daraltır/genişletir
      const head = e.target.closest('[data-head]');
      if (head) {
        const status = head.dataset.head;
        ctx.setSetting('kanbanCollapsed', { ...collapsed, [status]: !collapsed[status] });
      }
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
