/**
 * dashboard.js — Genel bakış: istatistik kartları, bugünün ajandası, yaklaşanlar, gecikenler.
 */
import { html } from '../core/dom.js';
import { addDaysISO, formatDate, startOfWeek, toISODate, todayISO } from '../core/dateUtils.js';
import { compareByStart, eventStart, isOverdue, STATUS_LABELS, STATUSES } from '../core/eventModel.js';
import { expandEvents } from '../services/recurrenceService.js';
import { toolbar } from '../components/toolbar.js';
import { eventRow } from '../components/eventCard.js';
import { icon } from '../components/icons.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function statCard({ label, value, hint, iconName, tone, go }) {
  return html`
    <button type="button" class="stat-card glass tone-${tone}" data-go="${go}">
      <span class="stat-icon">${icon(iconName)}</span>
      <span class="stat-value">${value}</span>
      <span class="stat-label">${label}</span>
      <span class="stat-hint">${hint}</span>
    </button>`;
}

export default {
  id: 'dashboard',
  title: 'Dashboard',

  render(el, ctx) {
    const { events, settings } = ctx.state;
    const now = new Date();
    const today = todayISO();
    const weekStart = toISODate(startOfWeek(today, settings.weekStartsOn));
    const weekEnd = addDaysISO(weekStart, 6);

    const todayItems = expandEvents(events, today, today).sort(compareByStart);
    const weekItems = expandEvents(events, weekStart, weekEnd);
    const upcoming = expandEvents(events, today, addDaysISO(today, 14))
      .filter((o) => eventStart(o) >= now)
      .sort(compareByStart)
      .slice(0, 8);
    const overdue = events.filter((e) => isOverdue(e, now)).sort(compareByStart);
    const done = events.filter((e) => e.status === 'done').length;
    const completion = events.length ? Math.round((done / events.length) * 100) : 0;

    const byStatus = STATUSES.map((s) => ({ status: s, count: events.filter((e) => e.status === s).length }));
    const categories = Object.entries(
      events.reduce((acc, e) => {
        const key = e.category || 'Kategorisiz';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxCat = Math.max(1, ...categories.map(([, n]) => n));

    el.innerHTML = html`
      ${toolbar({ title: `${greeting()} 👋`, subtitle: formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) })}
      <div class="view-body dashboard">
        <section class="stats-grid">
          ${statCard({ label: 'Toplam etkinlik', value: events.length, hint: `%${completion} tamamlandı`, iconName: 'layers', tone: 'accent', go: 'timeline' })}
          ${statCard({ label: 'Bugün', value: todayItems.length, hint: todayItems[0] ? `Sıradaki: ${todayItems.find((o) => eventStart(o) >= now)?.title ?? '—'}` : 'Boş gün', iconName: 'day', tone: 'teal', go: 'day' })}
          ${statCard({ label: 'Bu hafta', value: weekItems.length, hint: `${formatDate(weekStart, { day: 'numeric', month: 'short' })} – ${formatDate(weekEnd, { day: 'numeric', month: 'short' })}`, iconName: 'week', tone: 'blue', go: 'week' })}
          ${statCard({ label: 'Geciken görev', value: overdue.length, hint: overdue.length ? 'İlgilenmeniz gerekiyor' : 'Her şey yolunda', iconName: 'alert', tone: overdue.length ? 'danger' : 'success', go: 'kanban' })}
        </section>

        <section class="dash-grid">
          <article class="panel glass">
            <header class="panel-head"><h2>${icon('day')} Bugünün ajandası</h2><button type="button" class="link" data-go="day">Gün görünümü →</button></header>
            ${todayItems.length ? html`<ul class="ev-list">${todayItems.map((o) => eventRow(o))}</ul>` : html`<div class="empty-mini">Bugün için etkinlik yok. <button type="button" class="link" data-new-today>Ekle</button></div>`}
          </article>

          <article class="panel glass">
            <header class="panel-head"><h2>${icon('scheduler')} Yaklaşan etkinlikler</h2><button type="button" class="link" data-go="timeline">Tümü →</button></header>
            ${upcoming.length ? html`<ul class="ev-list">${upcoming.map((o) => eventRow(o, { showRelative: true }))}</ul>` : html`<div class="empty-mini">Önümüzdeki 14 günde etkinlik yok.</div>`}
          </article>

          <article class="panel glass">
            <header class="panel-head"><h2>${icon('alert')} Geciken görevler</h2><button type="button" class="link" data-go="kanban">Kanban →</button></header>
            ${overdue.length ? html`<ul class="ev-list">${overdue.slice(0, 6).map((o) => eventRow({ ...o, masterId: o.id }, { showRelative: true }))}</ul>` : html`<div class="empty-mini">${icon('check')} Geciken görev yok.</div>`}
          </article>

          <article class="panel glass">
            <header class="panel-head"><h2>${icon('kanban')} Durum dağılımı</h2></header>
            <div class="status-bar" role="img" aria-label="Durum dağılımı">
              ${byStatus.map(({ status, count }) => (count ? html`<span class="seg seg--${status}" style="flex:${count}" title="${STATUS_LABELS[status]}: ${count}"></span>` : ''))}
            </div>
            <ul class="legend">
              ${byStatus.map(({ status, count }) => html`<li><span class="status-dot status-dot--${status}"></span>${STATUS_LABELS[status]}<b>${count}</b></li>`)}
            </ul>
            <h3 class="panel-sub">Kategoriler</h3>
            <ul class="bars">
              ${categories.map(([name, n]) => html`<li><span class="bar-label">${name}</span><span class="bar-track"><span style="width:${(n / maxCat) * 100}%"></span></span><b>${n}</b></li>`)}
            </ul>
          </article>
        </section>
      </div>`;

    const lookup = new Map([...todayItems, ...upcoming].map((o) => [o.id, o]));
    overdue.forEach((o) => lookup.set(o.id, o));

    el.querySelector('.dashboard').addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) return ctx.go(go.dataset.go, today);
      if (e.target.closest('[data-new-today]')) return ctx.openEditor({ startDate: today });
      const row = e.target.closest('[data-occ-id]');
      if (row && lookup.has(row.dataset.occId)) ctx.openEditor(lookup.get(row.dataset.occId));
    });
    el.querySelector('.dashboard').addEventListener('keydown', (e) => {
      const row = e.target.closest('[data-occ-id]');
      if (row && e.key === 'Enter' && lookup.has(row.dataset.occId)) ctx.openEditor(lookup.get(row.dataset.occId));
    });
  },
};
