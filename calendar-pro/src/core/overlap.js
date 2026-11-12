/**
 * overlap.js — Çakışan zaman aralıklarının yan yana yerleşimi.
 *
 * Algoritma (Google Calendar benzeri):
 *  1. Öğeler başlangıca göre sıralanır.
 *  2. Birbirine geçişli olarak çakışan öğeler bir "küme" oluşturur.
 *  3. Küme içinde her öğe, boşalan ilk sütuna yerleştirilir (greedy).
 *  4. Kümedeki tüm öğelerin genişliği = 1 / küme sütun sayısı.
 */

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} getStart dakika
 * @param {(item: T) => number} getEnd dakika
 * @param {(item: T) => string} getId
 * @returns {Map<string, {col: number, cols: number}>}
 */
export function layoutOverlaps(items, getStart, getEnd, getId = (i) => i.id) {
  const sorted = [...items].sort((a, b) => getStart(a) - getStart(b) || getEnd(b) - getEnd(a));
  const result = new Map();
  let cluster = [];
  let columns = []; // her sütunun son bitiş zamanı
  let clusterEnd = -Infinity;

  const flush = () => {
    cluster.forEach((it) => (result.get(getId(it)).cols = columns.length));
    cluster = [];
    columns = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    const start = getStart(item);
    const end = getEnd(item);
    if (cluster.length && start >= clusterEnd) flush();
    let col = columns.findIndex((colEnd) => colEnd <= start);
    if (col === -1) {
      col = columns.length;
      columns.push(end);
    } else {
      columns[col] = end;
    }
    result.set(getId(item), { col, cols: 1 });
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return result;
}

/** Çakışan öğe çiftlerini döner. */
export function findConflicts(items, getStart, getEnd) {
  const sorted = [...items].sort((a, b) => getStart(a) - getStart(b));
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && getStart(sorted[j]) < getEnd(sorted[i]); j++) {
      pairs.push([sorted[i], sorted[j]]);
    }
  }
  return pairs;
}
