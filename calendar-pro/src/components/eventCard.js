/**
 * eventCard.js — Etkinliklerin görsel temsilleri (çip, kart, liste satırı).
 * Saf fonksiyonlardır; SafeHTML döndürür, olay bağlama işini view'lar yapar.
 */
import { html } from '../core/dom.js';
import { formatDate, relativeDayLabel } from '../core/dateUtils.js';
import { isAllDay, isOverdue, STATUS_LABELS } from '../core/eventModel.js';
import { icon } from './icons.js';

export function timeLabel(ev) {
  if (isAllDay(ev)) return 'Tüm gün';
  if (ev.startDate !== ev.endDate) return `${ev.startTime} → ${formatDate(ev.endDate, { day: 'numeric', month: 'short' })} ${ev.endTime}`;
  return `${ev.startTime}–${ev.endTime}`;
}

export function dateRangeLabel(ev) {
  const short = { day: 'numeric', month: 'short' };
  if (ev.startDate === ev.endDate) return formatDate(ev.startDate, { weekday: 'short', ...short });
  return `${formatDate(ev.startDate, short)} – ${formatDate(ev.endDate, short)}`;
}

/** Ay görünümü ve tüm gün satırı için kompakt çip. */
export function eventChip(occ, { deletable = false } = {}) {
  return html`
    <div class="ev-chip ${isAllDay(occ) ? 'is-allday' : ''} ${occ.status === 'done' ? 'is-done' : ''}"
         data-occ-id="${occ.id}" style="--ev-color:${occ.color}" tabindex="0" role="button"
         title="${occ.title} · ${timeLabel(occ)}">
      ${isAllDay(occ) ? '' : html`<span class="ev-chip-time">${occ.startTime}</span>`}
      <span class="ev-chip-title">${occ.title}</span>
      ${occ.isRecurring ? html`<span class="ev-chip-icon">${icon('repeat')}</span>` : ''}
      ${deletable ? html`<button type="button" class="ev-chip-del" data-delete="${occ.id}" data-no-drag aria-label="Sil">${icon('x')}</button>` : ''}
    </div>`;
}

/** Kanban / dashboard için zengin kart. */
export function eventCard(ev, { showProgress = true, showDate = true } = {}) {
  const overdue = isOverdue(ev);
  return html`
    <article class="ev-card ${ev.status === 'done' ? 'is-done' : ''}" data-event-id="${ev.id}" style="--ev-color:${ev.color}" tabindex="0">
      <div class="ev-card-top">
        <span class="ev-card-dot"></span>
        <h3 class="ev-card-title">${ev.title}</h3>
        ${ev.critical ? html`<span class="badge badge--danger" title="Kritik görev">${icon('flag')}</span>` : ''}
      </div>
      ${ev.description ? html`<p class="ev-card-desc">${ev.description}</p>` : ''}
      <div class="ev-card-meta">
        ${showDate ? html`<span class="meta ${overdue ? 'is-overdue' : ''}">${overdue ? icon('alert') : icon('month')} ${dateRangeLabel(ev)}</span>` : ''}
        ${ev.category ? html`<span class="tag">${ev.category}</span>` : ''}
        ${ev.recurrence ? html`<span class="meta">${icon('repeat')}</span>` : ''}
      </div>
      ${showProgress && ev.progress > 0 ? html`<div class="progress" aria-label="İlerleme %${ev.progress}"><span style="width:${ev.progress}%"></span></div>` : ''}
    </article>`;
}

/** Dashboard ve timeline listeleri için satır. */
export function eventRow(occ, { showRelative = false } = {}) {
  return html`
    <li class="ev-row" data-occ-id="${occ.id}" style="--ev-color:${occ.color}" tabindex="0" role="button">
      <span class="ev-row-bar"></span>
      <div class="ev-row-main">
        <span class="ev-row-title">${occ.title}</span>
        <span class="ev-row-sub">${timeLabel(occ)}${occ.category ? ` · ${occ.category}` : ''}</span>
      </div>
      <div class="ev-row-side">
        ${showRelative ? html`<span class="pill">${relativeDayLabel(occ.startDate)}</span>` : ''}
        <span class="status status--${occ.status}">${STATUS_LABELS[occ.status]}</span>
      </div>
    </li>`;
}
