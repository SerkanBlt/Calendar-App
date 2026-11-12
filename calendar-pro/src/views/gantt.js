/**
 * gantt.js — Gantt şeması.
 *
 * - Görev çubukları, ilerleme yüzdesi (çubuk içindeki tutamaçla sürüklenerek değiştirilebilir)
 * - Sürükle-bırak ile taşıma, sol/sağ kenardan boyutlandırma (gün hizalı)
 * - Bağımlılık çizgileri: çubuğun sağındaki noktadan başka bir çubuğa sürükleyerek bağlantı oluşturma,
 *   çizgiye tıklayarak kaldırma. Döngü oluşturan bağlantılar reddedilir.
 * - Kritik görevler (kullanıcı işaretli) ve CPM ile hesaplanan kritik yol vurgusu
 * - Bağımlılık ihlalleri (ardıl, öncül bitmeden başlıyorsa) kesikli kırmızı çizgiyle gösterilir
 *
 * Tekrarlayan etkinlikler ve bağımlılığı olmayan tek günlük saatli toplantılar Gantt'a dahil edilmez.
 */
import { html } from '../core/dom.js';
import { addDaysISO, diffDays, formatDate, isWeekend, rangeDays, todayISO } from '../core/dateUtils.js';
import { compareByStart, isTimed } from '../core/eventModel.js';
import { clamp } from '../core/utils.js';
import { computeCriticalPath, wouldCreateCycle } from '../services/criticalPathService.js';
import { toolbar } from '../components/toolbar.js';
import { icon } from '../components/icons.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';

const ROW_H = 44;
const BAR_PAD = 9;
const ZOOMS = [
  { w: 24, label: 'S' },
  { w: 36, label: 'M' },
  { w: 56, label: 'L' },
];
const scrollMemory = { left: null, top: 0 };

function monthSpans(days) {
  const spans = [];
  days.forEach((d) => {
    const key = d.slice(0, 7);
    const last = spans[spans.length - 1];
    if (last && last.key === key) last.count++;
    else spans.push({ key, count: 1 });
  });
  return spans;
}

/** Bitişten başlangıca dirsekli SVG yolu. */
function linkPath(x1, y1, x2, y2) {
  const gap = 10;
  if (x2 - gap >= x1 + gap) {
    const mx = Math.max(x1 + gap, x2 - gap);
    return `M${x1},${y1} H${mx} V${y2} H${x2}`;
  }
  const midY = y1 + (y2 > y1 ? ROW_H / 2 : -ROW_H / 2);
  return `M${x1},${y1} H${x1 + gap} V${midY} H${x2 - gap} V${y2} H${x2}`;
}

export default {
  id: 'gantt',
  title: 'Gantt',

  render(el, ctx) {
    const { events, settings } = ctx.state;
    const dayW = ZOOMS.some((z) => z.w === settings.ganttDayWidth) ? settings.ganttDayWidth : 36;
    const showCp = settings.ganttShowCriticalPath;
    // Görevler: tekrarlamayan, tüm gün / çok günlü etkinlikler + bağımlılık zincirindeki her kayıt.
    // Tek günlük saatli toplantılar şemayı kalabalıklaştırmasın diye dışarıda bırakılır.
    const linked = new Set(events.flatMap((e) => e.dependencies));
    const tasks = events
      .filter((e) => !e.recurrence && (!isTimed(e) || e.dependencies.length || linked.has(e.id)))
      .sort(compareByStart);
    const today = todayISO();

    const extra = html`
      <div class="segmented segmented--sm" role="radiogroup" aria-label="Yakınlaştırma">
        ${ZOOMS.map((z) => html`<button type="button" role="radio" aria-checked="${z.w === dayW}" class="${z.w === dayW ? 'is-active' : ''}" data-zoom="${z.w}">${z.label}</button>`)}
      </div>
      <button type="button" class="chip-btn ${showCp ? 'is-on' : ''}" data-cp>${icon('flag')}<span>Kritik yol</span></button>
      <button type="button" class="btn btn-ghost btn-sm" data-scroll-today>${icon('target')}<span class="hide-sm">Bugün</span></button>`;

    if (!tasks.length) {
      el.innerHTML = html`
        ${toolbar({ title: 'Gantt', subtitle: 'Proje zaman çizelgesi', extra })}
        <div class="view-body"><div class="empty-state glass">${icon('gantt')}<p>Henüz görev yok.</p><button type="button" class="btn btn-primary" data-action="new">${icon('plus')} Görev oluştur</button></div></div>`;
      return undefined;
    }

    const cpm = computeCriticalPath(tasks);
    const minStart = tasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), today);
    const maxEnd = tasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), today);
    const start = addDaysISO(minStart, -3);
    const count = Math.max(35, diffDays(start, maxEnd) + 15);
    const days = rangeDays(start, count);
    const chartW = count * dayW;
    const chartH = tasks.length * ROW_H;
    const xOf = (iso) => diffDays(start, iso) * dayW;
    const rowOf = new Map(tasks.map((t, i) => [t.id, i]));
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const cpSet = showCp ? cpm.critical : new Set();

    const summary = cpm.hasCycle
      ? html`<span class="pill pill--danger">${icon('alert')} Bağımlılık döngüsü</span>`
      : cpm.critical.size
        ? html`<span class="pill">Kritik yol: ${cpm.critical.size} görev · ${cpm.projectDuration} gün</span>`
        : '';

    const links = [];
    tasks.forEach((t) =>
      t.dependencies.forEach((depId) => {
        const pred = byId.get(depId);
        if (!pred) return;
        const x1 = xOf(pred.endDate) + dayW;
        const y1 = rowOf.get(pred.id) * ROW_H + ROW_H / 2;
        const x2 = xOf(t.startDate);
        const y2 = rowOf.get(t.id) * ROW_H + ROW_H / 2;
        const violated = t.startDate <= pred.endDate;
        const critical = cpSet.has(t.id) && cpSet.has(pred.id);
        links.push(html`<path class="gantt-link ${violated ? 'is-violated' : ''} ${critical ? 'is-critical' : ''}" d="${linkPath(x1, y1, x2, y2)}" data-from="${pred.id}" data-to="${t.id}" marker-end="url(#${critical ? 'arrow-crit' : violated ? 'arrow-bad' : 'arrow'})"><title>${pred.title} → ${t.title} (kaldırmak için tıklayın)</title></path>`);
      }),
    );

    el.innerHTML = html`
      ${toolbar({ title: 'Gantt', subtitle: html`${tasks.length} görev ${summary}`, extra })}
      <div class="view-body gantt-body">
        <div class="gantt glass" style="--row-h:${ROW_H}px;--day-w:${dayW}px">
          <div class="gantt-scroll">
            <div class="gantt-inner" style="grid-template-columns: var(--side-w) ${chartW}px">
              <div class="gantt-corner"><span>Görev</span><span>%</span></div>
              <div class="gantt-header">
                <div class="gantt-months">${monthSpans(days).map((m) => html`<div style="width:${m.count * dayW}px">${formatDate(`${m.key}-01`, { month: 'long', year: 'numeric' })}</div>`)}</div>
                <div class="gantt-days">${days.map((d) => html`<div class="${d === today ? 'is-today' : ''} ${isWeekend(d) ? 'is-weekend' : ''}" style="width:${dayW}px">${dayW >= 36 ? html`<small>${formatDate(d, { weekday: 'narrow' })}</small>` : ''}${Number(d.slice(8))}</div>`)}</div>
              </div>
              <div class="gantt-side">
                ${tasks.map(
                  (t) => html`<button type="button" class="gantt-side-row ${cpSet.has(t.id) ? 'is-cp' : ''}" data-task="${t.id}" style="--ev-color:${t.color}">
                    <span class="dot"></span>
                    <span class="gantt-task-name">${t.title}${t.critical ? html` <span class="crit-flag" title="Kritik görev">${icon('flag')}</span>` : ''}</span>
                    <span class="gantt-task-pct">${t.progress}%</span>
                  </button>`,
                )}
              </div>
              <div class="gantt-chart" style="height:${chartH}px">
                <div class="gantt-bg">
                  ${days.map((d, i) => (isWeekend(d) ? html`<div class="gantt-weekend" style="left:${i * dayW}px;width:${dayW}px"></div>` : ''))}
                  ${tasks.map((_, i) => html`<div class="gantt-rowline" style="top:${(i + 1) * ROW_H}px"></div>`)}
                  <div class="gantt-today" style="left:${xOf(today) + dayW / 2}px"></div>
                </div>
                <svg class="gantt-links" width="${chartW}" height="${chartH}" aria-hidden="true">
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrow-head"/></marker>
                    <marker id="arrow-crit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrow-head arrow-head--crit"/></marker>
                    <marker id="arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrow-head arrow-head--bad"/></marker>
                  </defs>
                  ${links}
                  <path class="gantt-link-temp" d="" />
                </svg>
                ${tasks.map((t, i) => {
                  const left = xOf(t.startDate);
                  const width = (diffDays(t.startDate, t.endDate) + 1) * dayW;
                  const slack = cpm.slack.get(t.id);
                  return html`
                    <div class="gantt-bar ${t.critical ? 'is-critical' : ''} ${cpSet.has(t.id) ? 'is-cp' : ''} ${t.status === 'done' ? 'is-done' : ''}"
                         data-task="${t.id}" tabindex="0" role="button"
                         style="left:${left}px;width:${width}px;top:${i * ROW_H + BAR_PAD}px;--ev-color:${t.color}"
                         title="${t.title} · ${formatDate(t.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(t.endDate, { day: 'numeric', month: 'short' })} · %${t.progress}${slack != null && !cpm.hasCycle ? ` · bolluk ${slack} gün` : ''}">
                      <div class="gantt-progress" style="width:${t.progress}%"></div>
                      <span class="gantt-label">${t.title}</span>
                      <span class="gantt-handle gantt-handle--left" data-edge="left"></span>
                      <span class="gantt-handle gantt-handle--right" data-edge="right"></span>
                      <span class="gantt-knob" data-knob style="left:${t.progress}%" title="İlerlemeyi sürükleyin"></span>
                      <span class="gantt-link-dot" data-link title="Bağımlılık oluşturmak için başka bir göreve sürükleyin"></span>
                    </div>`;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const scroller = el.querySelector('.gantt-scroll');
    const chart = el.querySelector('.gantt-chart');
    const tempLink = el.querySelector('.gantt-link-temp');
    const scrollToToday = (smooth) => scroller.scrollTo({ left: Math.max(0, xOf(today) - 3 * dayW), behavior: smooth ? 'smooth' : 'auto' });

    if (scrollMemory.left == null) scrollToToday(false);
    else {
      scroller.scrollLeft = scrollMemory.left;
      scroller.scrollTop = scrollMemory.top;
    }
    scroller.addEventListener(
      'scroll',
      () => {
        scrollMemory.left = scroller.scrollLeft;
        scrollMemory.top = scroller.scrollTop;
      },
      { passive: true },
    );

    // --- Toolbar ---
    el.querySelector('.toolbar').addEventListener('click', (e) => {
      const zoom = e.target.closest('[data-zoom]');
      if (zoom) {
        scrollMemory.left = null;
        ctx.setSetting('ganttDayWidth', Number(zoom.dataset.zoom));
      } else if (e.target.closest('[data-cp]')) ctx.setSetting('ganttShowCriticalPath', !showCp);
      else if (e.target.closest('[data-scroll-today]')) scrollToToday(true);
    });

    el.querySelector('.gantt-side').addEventListener('click', (e) => {
      const row = e.target.closest('[data-task]');
      if (row) ctx.openEditor(byId.get(row.dataset.task));
    });

    // --- Bağımlılık kaldırma ---
    el.querySelector('.gantt-links').addEventListener('click', async (e) => {
      const path = e.target.closest('.gantt-link');
      if (!path) return;
      const from = byId.get(path.dataset.from);
      const to = byId.get(path.dataset.to);
      const ok = await confirmDialog({ title: 'Bağımlılık kaldırılsın mı?', message: `"${from.title}" → "${to.title}"`, confirmText: 'Kaldır', danger: true });
      if (ok) ctx.updateEvent(to.id, { dependencies: to.dependencies.filter((d) => d !== from.id) });
    });

    // --- Çubuk etkileşimleri ---
    const chartPoint = (ev) => {
      const r = chart.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    chart.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const bar = e.target.closest('.gantt-bar');
      if (!bar) return;
      const task = byId.get(bar.dataset.task);
      e.preventDefault();
      const mode = e.target.closest('[data-link]') ? 'link' : e.target.closest('[data-knob]') ? 'progress' : e.target.dataset.edge || 'move';
      const originX = e.clientX;
      const origLeft = xOf(task.startDate);
      const origWidth = (diffDays(task.startDate, task.endDate) + 1) * dayW;
      const progressEl = bar.querySelector('.gantt-progress');
      const knob = bar.querySelector('.gantt-knob');
      let moved = false;
      let deltaDays = 0;
      let progress = task.progress;
      let linkTarget = null;
      bar.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const dx = ev.clientX - originX;
        if (!moved && Math.abs(dx) < 3 && mode !== 'link') return;
        if (!moved) {
          moved = true;
          chart.classList.add('is-interacting');
          bar.classList.add('is-dragging');
        }
        if (mode === 'link') {
          const from = { x: origLeft + origWidth, y: Number.parseFloat(bar.style.top) + (ROW_H - 2 * BAR_PAD) / 2 };
          const p = chartPoint(ev);
          tempLink.setAttribute('d', `M${from.x},${from.y} L${p.x},${p.y}`);
          const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.gantt-bar');
          if (linkTarget && linkTarget !== under) linkTarget.classList.remove('is-link-target');
          linkTarget = under && under !== bar ? under : null;
          linkTarget?.classList.add('is-link-target');
          return;
        }
        if (mode === 'progress') {
          progress = clamp(Math.round((((ev.clientX - bar.getBoundingClientRect().left) / origWidth) * 100) / 5) * 5, 0, 100);
          progressEl.style.width = `${progress}%`;
          knob.style.left = `${progress}%`;
          bar.querySelector('.gantt-label').dataset.pct = `${progress}%`;
          return;
        }
        deltaDays = Math.round(dx / dayW);
        if (mode === 'move') bar.style.left = `${origLeft + deltaDays * dayW}px`;
        else if (mode === 'right') {
          deltaDays = Math.max(deltaDays, -(origWidth / dayW - 1));
          bar.style.width = `${origWidth + deltaDays * dayW}px`;
        } else if (mode === 'left') {
          deltaDays = Math.min(deltaDays, origWidth / dayW - 1);
          bar.style.left = `${origLeft + deltaDays * dayW}px`;
          bar.style.width = `${origWidth - deltaDays * dayW}px`;
        }
      };

      const onUp = () => {
        bar.removeEventListener('pointermove', onMove);
        bar.removeEventListener('pointerup', onUp);
        bar.removeEventListener('pointercancel', onUp);
        chart.classList.remove('is-interacting');
        bar.classList.remove('is-dragging');
        tempLink.setAttribute('d', '');
        linkTarget?.classList.remove('is-link-target');

        if (mode === 'link') {
          if (!linkTarget) return;
          const target = byId.get(linkTarget.dataset.task);
          if (target.dependencies.includes(task.id)) return toast('Bu bağımlılık zaten var');
          if (wouldCreateCycle(tasks, task.id, target.id)) return toast('Bu bağlantı bir döngü oluşturur', { type: 'error' });
          ctx.updateEvent(target.id, { dependencies: [...target.dependencies, task.id] });
          return toast(`"${task.title}" → "${target.title}" bağlandı`, { type: 'success' });
        }
        if (!moved) return ctx.openEditor(task);
        if (mode === 'progress') {
          return ctx.updateEvent(task.id, { progress, status: progress === 100 ? 'done' : progress > 0 && task.status === 'todo' ? 'doing' : task.status });
        }
        if (!deltaDays) return undefined;
        if (mode === 'move') return ctx.updateEvent(task.id, { startDate: addDaysISO(task.startDate, deltaDays), endDate: addDaysISO(task.endDate, deltaDays) });
        if (mode === 'right') return ctx.updateEvent(task.id, { endDate: addDaysISO(task.endDate, deltaDays) });
        return ctx.updateEvent(task.id, { startDate: addDaysISO(task.startDate, deltaDays) });
      };

      bar.addEventListener('pointermove', onMove);
      bar.addEventListener('pointerup', onUp);
      bar.addEventListener('pointercancel', onUp);
    });

    chart.addEventListener('keydown', (e) => {
      const bar = e.target.closest('.gantt-bar');
      if (bar && e.key === 'Enter') ctx.openEditor(byId.get(bar.dataset.task));
    });

    return undefined;
  },
};
