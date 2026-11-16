/**
 * ganttProjects.js — Proje bazlı Gantt: proje listesi, seçim ve satır yerleşimi. Saf fonksiyonlar (DOM yok).
 *
 * Bir etkinliğin "Gantt projesi" (`event.project`) serbest metindir; aynı adı taşıyan görevler aynı projedir. Gantt'ta:
 *  - Hiç proje yoksa görünüm eskisi gibi düz bir listedir.
 *  - Projeler varsa üstte bir proje seçici çıkar: "Tüm projeler" (proje başlıklarıyla gruplu), tek bir proje ya da "Projesiz".
 *  - "Tüm projeler"de her proje bir başlık satırı (özet çubuğu: ilk başlangıç → son bitiş, ağırlıklı ilerleme) ve altında görevleri olan,
 *    daraltılıp genişletilebilen bir gruptur. Projesiz görevler en sonda "Projesiz" grubunda toplanır.
 *  - Kritik yol (CPM) her proje için ayrı hesaplanır: farklı projeler arasındaki bağımlılıklar çizilir ama kritik yolu belirlemez.
 *  - Görev başka projeye taşınabilir (görev satırını proje başlığına/satırına sürükle ya da sağ tık → Proje): taşıma yalnızca `event.project` alanını değiştirir
 *    (bkz. `projectValue`, `crossProjectLinks`; eylem core/actions.js → moveToProject).
 */
import { diffDays } from '../core/dateUtils.js';

/** "Projesiz" seçimi için ayrılmış değer (gerçek bir proje adıyla çakışmaz). */
export const NO_PROJECT = '__none__';
export const NO_PROJECT_LABEL = 'Projesiz';
export const ALL_PROJECTS_LABEL = 'Tüm projeler';

const byName = (a, b) => a.localeCompare(b, 'tr');

export const MAX_PROJECT_LENGTH = 80; // eventModel.normalizeEvent ile aynı

/** Taşıma hedefini (proje anahtarı ya da yazılan ad) olay alanına çevirir: NO_PROJECT / boş → '' (projesiz); ad kırpılır ve 80 karaktere indirilir. */
export const projectValue = (key) => (key === NO_PROJECT ? '' : String(key ?? '').trim().slice(0, MAX_PROJECT_LENGTH));

/** Bir görevin proje anahtarı: proje adı ya da NO_PROJECT. */
export const projectKeyOf = (task) => task.project || NO_PROJECT;

/**
 * `id` görevi `project` projesine (alan değeri; '' = projesiz) taşınırsa, o görevin başka projedeki görevlerle kalan bağımlılık bağlantısı sayısı
 * (öncülleri ve ardılları). Farklı projeler arası bağımlılıklar çizilir ama kritik yolu belirlemez; taşıma sonrası kullanıcıya bildirilir.
 */
export function crossProjectLinks(tasks, id, project) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return 0;
  const next = projectValue(project);
  const other = (t) => (t.project || '') !== next;
  const preds = task.dependencies.map((d) => tasks.find((t) => t.id === d)).filter((p) => p && other(p));
  const succs = tasks.filter((t) => t.id !== id && t.dependencies.includes(id) && other(t));
  return preds.length + succs.length;
}

/** Görevlerdeki proje adları (tekil, Türkçe sıralı). */
export const projectNames = (tasks) => [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort(byName);

/** Proje seçicinin seçenekleri: '' (tümü), proje adları ve — projeler varsa ve projesiz görev de varsa — NO_PROJECT. Proje yoksa boş dizi. */
export function projectOptions(tasks) {
  const names = projectNames(tasks);
  if (!names.length) return [];
  return ['', ...names, ...(tasks.some((t) => !t.project) ? [NO_PROJECT] : [])];
}

/** Kayıtlı seçim artık geçerli değilse (proje silindi/yeniden adlandırıldı) "Tüm projeler"e düşer. */
export const resolveProject = (options, wanted) => (options.includes(wanted) ? wanted : '');

export const projectLabel = (key) => (key === '' ? ALL_PROJECTS_LABEL : key === NO_PROJECT ? NO_PROJECT_LABEL : key);

/** Görevlerin süreye göre ağırlıklı ortalama ilerlemesi (%, yuvarlanmış). */
export function weightedProgress(tasks) {
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    const days = diffDays(t.startDate, t.endDate) + 1;
    total += days;
    done += days * (Number(t.progress) || 0);
  }
  return total ? Math.round(done / total) : 0;
}

function summarize(tasks) {
  return {
    start: tasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), tasks[0].startDate),
    end: tasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), tasks[0].endDate),
    progress: weightedProgress(tasks),
  };
}

/**
 * Gantt satırlarını kurar.
 * @param {object[]} allTasks Gantt'a girebilen tüm görevler (başlangıca göre sıralı)
 * @param {{project?: string, collapsed?: string[]}} options project: '' | proje adı | NO_PROJECT; collapsed: daraltılmış proje adları (NO_PROJECT dahil)
 * @returns {{
 *   grouped: boolean,
 *   rows: Array<{kind:'group', key:string, name:string, tasks:object[], collapsed:boolean, start:string, end:string, progress:number} | {kind:'task', task:object}>,
 *   tasks: object[],   // satırlarda görünen görevler (satır sırasıyla)
 *   groups: Array<{key:string, name:string, tasks:object[]}>,  // daraltılmış olanlar dahil, kritik yol hesabı ve zaman aralığı için
 * }}
 */
export function buildRows(allTasks, { project = '', collapsed = [] } = {}) {
  const options = projectOptions(allTasks);
  const active = resolveProject(options, project);
  const grouped = options.length > 0 && active === '';

  if (!grouped) {
    const tasks = active === NO_PROJECT ? allTasks.filter((t) => !t.project) : active ? allTasks.filter((t) => t.project === active) : allTasks;
    return { grouped: false, rows: tasks.map((task) => ({ kind: 'task', task })), tasks, groups: [{ key: active, name: projectLabel(active), tasks }] };
  }

  const closed = new Set(collapsed);
  const groups = options
    .filter((key) => key !== '')
    .map((key) => ({ key, name: projectLabel(key), tasks: allTasks.filter((t) => (key === NO_PROJECT ? !t.project : t.project === key)) }))
    .filter((g) => g.tasks.length);
  const rows = [];
  const tasks = [];
  for (const g of groups) {
    const isClosed = closed.has(g.key);
    rows.push({ kind: 'group', key: g.key, name: g.name, tasks: g.tasks, collapsed: isClosed, ...summarize(g.tasks) });
    if (!isClosed) {
      for (const task of g.tasks) {
        rows.push({ kind: 'task', task });
        tasks.push(task);
      }
    }
  }
  return { grouped: true, rows, tasks, groups };
}

/**
 * Kritik yolu proje başına hesaplar ve birleştirir. `compute`: computeCriticalPath. Bir proje döngü içeriyorsa hasCycle=true (o proje için kritik yol yok).
 * @returns {{critical:Set<string>, slack:Map<string,number>, hasCycle:boolean, durations:Map<string,number>}} durations: proje anahtarı → proje süresi (gün)
 */
export function combineCriticalPaths(groups, compute) {
  const critical = new Set();
  const slack = new Map();
  const durations = new Map();
  let hasCycle = false;
  for (const g of groups) {
    const cpm = compute(g.tasks);
    if (cpm.hasCycle) hasCycle = true;
    cpm.critical.forEach((id) => critical.add(id));
    cpm.slack.forEach((v, id) => slack.set(id, v));
    durations.set(g.key, cpm.projectDuration);
  }
  return { critical, slack, hasCycle, durations };
}
