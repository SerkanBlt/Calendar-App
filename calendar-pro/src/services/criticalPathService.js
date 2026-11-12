/**
 * criticalPathService.js — Kritik Yol Yöntemi (CPM) hesaplaması.
 *
 * Görevler bitiş→başlangıç (finish-to-start) bağımlılıklarıyla bir DAG oluşturur.
 * Süreler gün cinsindendir (endDate - startDate + 1).
 *  - İleri geçiş: ES = max(EF(önceller)), EF = ES + süre
 *  - Geri geçiş:  LF = min(LS(ardıllar)), LS = LF - süre
 *  - Bolluk (slack) = LS - ES; bolluğu 0 olan görevler kritik yoldadır.
 * Döngü varsa hasCycle=true döner ve kritik yol hesaplanmaz.
 */
import { diffDays } from '../core/dateUtils.js';

export function computeCriticalPath(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const preds = new Map(tasks.map((t) => [t.id, t.dependencies.filter((d) => byId.has(d))]));
  const succs = new Map(tasks.map((t) => [t.id, []]));
  preds.forEach((list, id) => list.forEach((p) => succs.get(p).push(id)));
  const duration = new Map(tasks.map((t) => [t.id, diffDays(t.startDate, t.endDate) + 1]));

  // Kahn algoritması ile topolojik sıralama
  const indegree = new Map(tasks.map((t) => [t.id, preds.get(t.id).length]));
  const queue = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    succs.get(id).forEach((s) => {
      indegree.set(s, indegree.get(s) - 1);
      if (indegree.get(s) === 0) queue.push(s);
    });
  }
  if (order.length !== tasks.length) {
    return { hasCycle: true, critical: new Set(), slack: new Map(), projectDuration: 0 };
  }

  const es = new Map();
  const ef = new Map();
  order.forEach((id) => {
    const start = Math.max(0, ...preds.get(id).map((p) => ef.get(p)));
    es.set(id, start);
    ef.set(id, start + duration.get(id));
  });
  const projectDuration = Math.max(0, ...ef.values());

  const lf = new Map();
  const ls = new Map();
  [...order].reverse().forEach((id) => {
    const finish = succs.get(id).length ? Math.min(...succs.get(id).map((s) => ls.get(s))) : projectDuration;
    lf.set(id, finish);
    ls.set(id, finish - duration.get(id));
  });

  const slack = new Map(order.map((id) => [id, ls.get(id) - es.get(id)]));
  // Yalnızca bağımlılık zincirine dahil görevleri kritik say (tek başına duran görevleri dışarıda bırak)
  const linked = (id) => preds.get(id).length > 0 || succs.get(id).length > 0;
  const critical = new Set(order.filter((id) => slack.get(id) === 0 && linked(id)));
  return { hasCycle: false, critical, slack, projectDuration };
}

/** `to` görevine `from` bağımlılığı eklemek döngü oluşturur mu? */
export function wouldCreateCycle(tasks, fromId, toId) {
  if (fromId === toId) return true;
  const next = tasks.map((t) => (t.id === toId ? { ...t, dependencies: [...t.dependencies, fromId] } : t));
  return computeCriticalPath(next).hasCycle;
}
