/**
 * main.js — Uygulama giriş noktası.
 *
 * Sorumluluklar:
 *  1. Kabuğu (sidebar + view alanı) oluşturmak
 *  2. Veritabanını açıp ayarları/etkinlikleri yüklemek (ilk açılışta örnek veri)
 *  3. Router'ı başlatmak ve store değişikliklerinde aktif view'ı çizmek
 *  4. Global kısayollar, komut paleti, bildirim servisi ve service worker kaydı
 */
import './styles/theme.css';
import './styles/main.css';
import './styles/dashboard.css';
import './styles/calendar.css';
import './styles/scheduler.css';
import './styles/gantt.css';
import './styles/kanban.css';

import { store } from './core/state.js';
import { router, ROUTES } from './core/router.js';
import { openDB } from './core/db.js';
import { eventRepo } from './core/eventRepo.js';
import { settingsRepo } from './core/settingsRepo.js';
import { buildSeedEvents } from './core/seed.js';
import { applyTheme, BASE_THEMES, CUSTOM_THEMES } from './core/theme.js';
import { openThemePicker } from './components/themePicker.js';
import { html } from './core/dom.js';
import { isTypingTarget } from './core/utils.js';
import { addDaysISO, addMonths, toISODate, todayISO } from './core/dateUtils.js';
import { exportData, importData, moveOccurrence, setTheme, toggleNotifications } from './core/actions.js';
import { notificationService } from './services/notificationService.js';
import { mountSidebar, NAV_ITEMS } from './components/sidebar.js';
import { createCommandPalette } from './components/commandPalette.js';
import { openEventEditor } from './components/eventEditor.js';
import { isModalOpen } from './components/modal.js';
import { toast } from './components/toast.js';

import dashboard from './views/dashboard.js';
import month from './views/month.js';
import week from './views/week.js';
import day from './views/day.js';
import scheduler from './views/scheduler.js';
import timeline from './views/timeline.js';
import gantt from './views/gantt.js';
import kanban from './views/kanban.js';

const VIEWS = { dashboard, month, week, day, scheduler, timeline, gantt, kanban };

// ---------------------------------------------------------------------------
// Kabuk
// ---------------------------------------------------------------------------
const appEl = document.getElementById('app');
appEl.innerHTML = html`
  <aside class="sidebar glass" id="sidebar" aria-label="Kenar çubuğu"></aside>
  <div class="sidebar-scrim" data-scrim></div>
  <main class="main" id="main"><div class="view" id="view"></div></main>`;
const sidebarEl = document.getElementById('sidebar');
const viewEl = document.getElementById('view');

const setMobileSidebar = (open) => appEl.classList.toggle('sidebar-open', open);
appEl.querySelector('[data-scrim]').addEventListener('click', () => setMobileSidebar(false));

// ---------------------------------------------------------------------------
// View'lara verilen bağlam (ctx) — view'lar yalnızca bu API üzerinden etkileşir
// ---------------------------------------------------------------------------
function shiftCursor(dir) {
  const { view, cursor, settings } = store.get();
  let next = cursor;
  if (view === 'month') next = toISODate(addMonths(cursor, dir));
  else if (view === 'week') next = addDaysISO(cursor, 7 * dir);
  else if (view === 'day') next = addDaysISO(cursor, dir);
  else if (view === 'scheduler') next = addDaysISO(cursor, (settings.schedulerDays || 7) * dir);
  else return;
  router.go({ date: next });
}

const ctx = {
  get state() {
    return store.get();
  },
  go: (view, date) => router.go({ view, date }),
  today: () => router.go({ date: todayISO() }),
  shift: shiftCursor,
  openEditor: (input) => openEventEditor(input),
  moveOccurrence,
  updateEvent: (id, patch) => eventRepo.update(id, patch).catch((err) => toast(err.message, { type: 'error' })),
  setSetting: (key, value) => settingsRepo.set(key, value),
};

// ---------------------------------------------------------------------------
// View çizimi
// ---------------------------------------------------------------------------
let cleanupView = null;
let renderQueued = false;

function renderView() {
  renderQueued = false;
  const { view } = store.get();
  const module = VIEWS[view] || dashboard;
  cleanupView?.();
  cleanupView = null;
  viewEl.dataset.view = view;
  try {
    const cleanup = module.render(viewEl, ctx);
    if (typeof cleanup === 'function') cleanupView = cleanup;
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = html`<div class="empty-state glass"><p>Görünüm yüklenemedi: ${err.message}</p></div>`;
  }
  document.title = `${module.title} · Calendar Pro`;
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(renderView);
}

store.subscribe((s, prev) => {
  if (s.settings.theme !== prev.settings.theme) applyTheme(s.settings.theme);
  if (!s.ready) return;
  if (s.view !== prev.view) viewEl.scrollTop = 0;
  if (s.ready !== prev.ready || s.view !== prev.view || s.cursor !== prev.cursor || s.events !== prev.events || s.settings !== prev.settings) {
    scheduleRender();
  }
});

// Kabuk eylemleri (toolbar butonları) — delegasyon
viewEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || !viewEl.contains(btn)) return;
  const action = btn.dataset.action;
  if (action === 'menu') setMobileSidebar(true);
  else if (action === 'prev') shiftCursor(-1);
  else if (action === 'next') shiftCursor(1);
  else if (action === 'today') ctx.today();
  else if (action === 'new') ctx.openEditor({ startDate: store.get().cursor });
});

// ---------------------------------------------------------------------------
// Komut paleti
// ---------------------------------------------------------------------------
const palette = createCommandPalette({
  getCommands: () => [
    { id: 'new', title: 'Yeni Event', keywords: 'yeni etkinlik oluştur ekle new', icon: 'plus', hint: 'N', run: () => ctx.openEditor({ startDate: store.get().cursor }) },
    { id: 'today', title: 'Bugüne Git', keywords: 'today bugün', icon: 'target', hint: 'T', run: ctx.today },
    ...NAV_ITEMS.map((item, i) => ({ id: `go-${item.id}`, title: `${item.label} Aç`, keywords: `görünüm view ${item.id}`, icon: item.icon, hint: String(i + 1), run: () => ctx.go(item.id) })),
    { id: 'export', title: 'Export Data (JSON)', keywords: 'dışa aktar yedek indir export', icon: 'download', run: exportData },
    { id: 'import', title: 'Import Data (JSON)', keywords: 'içe aktar yükle import', icon: 'upload', run: importData },
    ...BASE_THEMES.map((t) => ({ id: `theme-${t.value}`, title: `Tema: ${t.label}`, keywords: `theme ${t.value}`, icon: t.icon, run: () => setTheme(t.value) })),
    ...CUSTOM_THEMES.map((t) => ({ id: `theme-${t.value}`, title: `Tema: ${t.label}`, keywords: `özel custom theme ${t.value} ${t.description}`, icon: 'palette', run: () => setTheme(t.value) })),
    {
      id: 'theme-picker',
      title: 'Özel Temalar…',
      keywords: 'tema theme renk palet custom',
      icon: 'palette',
      run: () => openThemePicker({ value: store.get().settings.theme, onSelect: setTheme }),
    },
    {
      id: 'notify',
      title: store.get().settings.notificationsEnabled ? 'Hatırlatmaları Kapat' : 'Hatırlatmaları Aç',
      keywords: 'bildirim notification reminder',
      icon: 'bell',
      run: () => toggleNotifications(),
    },
  ],
  getEvents: () => store.get().events,
  onSelectEvent: (ev) => {
    router.go({ date: ev.startDate });
    ctx.openEditor(ev);
  },
});

// ---------------------------------------------------------------------------
// Klavye kısayolları
// ---------------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (!isModalOpen()) palette.toggle();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || isModalOpen() || palette.isOpen()) return;
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    ctx.openEditor({ startDate: store.get().cursor });
  } else if (e.key === 't' || e.key === 'T') ctx.today();
  else if (e.key === 'ArrowLeft') shiftCursor(-1);
  else if (e.key === 'ArrowRight') shiftCursor(1);
  else if (/^[1-8]$/.test(e.key)) ctx.go(ROUTES[Number(e.key) - 1]);
  else if (e.key === 'Escape') setMobileSidebar(false);
});

// ---------------------------------------------------------------------------
// Service worker (yalnızca production build'de; geliştirmede HMR ile çakışmaması için)
// ---------------------------------------------------------------------------
function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch((err) => {
    console.warn('Service worker kaydedilemedi:', err);
  });
}

// ---------------------------------------------------------------------------
// Başlatma
// ---------------------------------------------------------------------------
async function boot() {
  try {
    await openDB();
    const settings = await settingsRepo.load();
    applyTheme(settings.theme);
    await eventRepo.loadAll();
    if (!settings.seeded) {
      if (!store.get().events.length) await eventRepo.mergeMany(buildSeedEvents());
      await settingsRepo.set('seeded', true);
    }
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = html`<div class="empty-state glass"><h2>Veritabanı açılamadı</h2><p>${err.message}</p></div>`;
    return;
  }

  mountSidebar(sidebarEl, {
    go: ctx.go,
    openEditor: ctx.openEditor,
    openPalette: () => palette.open(),
    closeMobile: () => setMobileSidebar(false),
  });
  router.start();
  store.set({ ready: true });
  notificationService.start();
  registerServiceWorker();
}

boot();
