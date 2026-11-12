/**
 * sidebar.js — Kenar çubuğu: marka, gezinme, mini takvim, tema ve veri eylemleri.
 * Store'a abone olur; yalnızca ilgili alanlar değiştiğinde kendini günceller.
 */
import { html } from '../core/dom.js';
import { store } from '../core/state.js';
import { addMonths, formatDate, startOfMonth, startOfWeek, toISODate, todayISO, rangeDays, weekdayNames } from '../core/dateUtils.js';
import { BASE_THEMES, isCustomTheme, themeLabel } from '../core/theme.js';
import { exportData, importData, setBackground, setTheme, toggleNotifications } from '../core/actions.js';
import { icon } from './icons.js';
import { openThemePicker } from './themePicker.js';
import { openBackgroundPicker } from './backgroundPicker.js';
import { backgroundLabel } from '../core/backgrounds.js';

export const NAV_ITEMS = Object.freeze([
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'month', label: 'Ay', icon: 'month' },
  { id: 'week', label: 'Hafta', icon: 'week' },
  { id: 'day', label: 'Gün', icon: 'day' },
  { id: 'scheduler', label: 'Scheduler', icon: 'scheduler' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'gantt', label: 'Gantt', icon: 'gantt' },
  { id: 'kanban', label: 'Kanban', icon: 'kanban' },
]);

const DATE_VIEWS = new Set(['month', 'week', 'day', 'scheduler']);

/**
 * @param {HTMLElement} el
 * @param {{go: Function, openEditor: Function, openPalette: Function, closeMobile: Function}} ctx
 */
export function mountSidebar(el, ctx) {
  let miniMonth = startOfMonth(store.get().cursor);

  function miniCalendar(state) {
    const { cursor, events, settings } = state;
    const first = startOfWeek(miniMonth, settings.weekStartsOn);
    const days = rangeDays(toISODate(first), 42);
    const today = todayISO();
    const busy = new Set();
    events.forEach((e) => {
      if (!e.recurrence) busy.add(e.startDate);
    });
    return html`
      <div class="mini-cal">
        <div class="mini-cal-head">
          <span>${formatDate(miniMonth, { month: 'long', year: 'numeric' })}</span>
          <div>
            <button type="button" class="icon-btn icon-btn-sm" data-mini="-1" aria-label="Önceki ay">${icon('chevronLeft')}</button>
            <button type="button" class="icon-btn icon-btn-sm" data-mini="1" aria-label="Sonraki ay">${icon('chevronRight')}</button>
          </div>
        </div>
        <div class="mini-cal-grid">
          ${weekdayNames(settings.weekStartsOn, 'narrow').map((d) => html`<span class="mini-dow">${d}</span>`)}
          ${days.map((d) => {
            const outside = Number(d.slice(5, 7)) !== miniMonth.getMonth() + 1;
            const cls = ['mini-day', outside && 'is-outside', d === today && 'is-today', d === cursor && 'is-selected', busy.has(d) && 'has-events'].filter(Boolean).join(' ');
            return html`<button type="button" class="${cls}" data-date="${d}" aria-label="${formatDate(d)}">${Number(d.slice(8))}</button>`;
          })}
        </div>
      </div>`;
  }

  function render() {
    const state = store.get();
    const { view, settings } = state;
    el.innerHTML = html`
      <div class="sidebar-inner">
        <div class="brand">
          <span class="brand-logo">${icon('month')}</span>
          <span class="brand-name">Calendar <b>Pro</b></span>
          <button type="button" class="icon-btn only-mobile" data-close-sidebar aria-label="Menüyü kapat">${icon('x')}</button>
        </div>

        <button type="button" class="btn btn-primary btn-block" data-new>${icon('plus')} Yeni etkinlik</button>
        <button type="button" class="search-btn" data-palette>${icon('search')}<span>Ara veya komut…</span><kbd>Ctrl K</kbd></button>

        <nav class="nav" aria-label="Görünümler">
          ${NAV_ITEMS.map(
            (item, i) => html`<a href="#/${item.id}?date=${state.cursor}" class="nav-item ${view === item.id ? 'is-active' : ''}" data-nav="${item.id}" ${view === item.id ? 'aria-current="page"' : ''}>
              ${icon(item.icon)}<span>${item.label}</span><kbd>${i + 1}</kbd>
            </a>`,
          )}
        </nav>

        ${miniCalendar(state)}

        <div class="sidebar-footer">
          <div class="segmented segmented--grid" role="radiogroup" aria-label="Tema">
            <button type="button" role="radio" aria-checked="${isCustomTheme(settings.theme)}" aria-haspopup="dialog"
                    class="${isCustomTheme(settings.theme) ? 'is-active' : ''}" data-theme-custom
                    title="${isCustomTheme(settings.theme) ? `Özel: ${themeLabel(settings.theme)}` : 'Özel temalar'}">${icon('palette')}<span>Özel</span>${icon('chevronDown', 'caret')}</button>
            ${BASE_THEMES.map(
              (t) => html`<button type="button" role="radio" aria-checked="${settings.theme === t.value}" class="${settings.theme === t.value ? 'is-active' : ''}" data-theme-set="${t.value}" title="${t.label}">${icon(t.icon)}<span>${t.label}</span></button>`,
            )}
          </div>
          <button type="button" class="bg-btn" data-bg-picker aria-haspopup="dialog" title="Arka planı değiştir">
            ${icon('image')}<span>Arka plan</span><b>${backgroundLabel(settings.background)}</b>${icon('chevronDown', 'caret')}
          </button>
          <div class="footer-actions">
            <button type="button" class="chip-btn ${settings.notificationsEnabled ? 'is-on' : ''}" data-notify title="Hatırlatmalar">${icon('bell')}<span>${settings.notificationsEnabled ? 'Açık' : 'Kapalı'}</span></button>
            <button type="button" class="chip-btn" data-export title="JSON dışa aktar">${icon('download')}<span>Export</span></button>
            <button type="button" class="chip-btn" data-import title="JSON içe aktar">${icon('upload')}<span>Import</span></button>
          </div>
        </div>
      </div>`;
  }

  el.addEventListener('click', (e) => {
    const t = e.target;
    const nav = t.closest('[data-nav]');
    if (nav) {
      e.preventDefault();
      ctx.go(nav.dataset.nav);
      ctx.closeMobile();
      return;
    }
    const day = t.closest('.mini-day');
    if (day) {
      const view = store.get().view;
      ctx.go(DATE_VIEWS.has(view) ? view : 'day', day.dataset.date);
      ctx.closeMobile();
      return;
    }
    const mini = t.closest('[data-mini]');
    if (mini) {
      miniMonth = addMonths(miniMonth, Number(mini.dataset.mini));
      render();
      return;
    }
    if (t.closest('[data-new]')) ctx.openEditor({ startDate: store.get().cursor });
    else if (t.closest('[data-palette]')) ctx.openPalette();
    else if (t.closest('[data-close-sidebar]')) ctx.closeMobile();
    else if (t.closest('[data-theme-custom]')) {
      openThemePicker({ anchor: t.closest('[data-theme-custom]'), value: store.get().settings.theme, onSelect: setTheme });
    } else if (t.closest('[data-bg-picker]')) {
      openBackgroundPicker({ anchor: t.closest('[data-bg-picker]'), value: store.get().settings.background, onSelect: setBackground });
    } else if (t.closest('[data-theme-set]')) setTheme(t.closest('[data-theme-set]').dataset.themeSet);
    else if (t.closest('[data-notify]')) toggleNotifications();
    else if (t.closest('[data-export]')) exportData();
    else if (t.closest('[data-import]')) importData();
  });

  store.subscribe((s, prev) => {
    if (s.cursor !== prev.cursor) miniMonth = startOfMonth(s.cursor);
    if (s.view !== prev.view || s.cursor !== prev.cursor || s.settings !== prev.settings || s.events !== prev.events) render();
  });
  render();
}
