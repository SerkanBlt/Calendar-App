/**
 * Proje bazlı Gantt: proje seçenekleri, gruplu/düz satırlar, daraltma, özet ve proje başına kritik yol.
 */
process.env.TZ = 'Europe/Istanbul';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizeEvent } from '../src/core/eventModel.js';
import { computeCriticalPath } from '../src/services/criticalPathService.js';
import { buildRows, combineCriticalPaths, NO_PROJECT, projectLabel, projectOptions, resolveProject, weightedProgress } from '../src/services/ganttProjects.js';

const t = (id, project, start, end, extra = {}) => normalizeEvent({ id, title: id, project, startDate: start, endDate: end, ...extra });

// Web: a1 → a2 → a3 (zincir) · Mobil: b1 → b2 · Projesiz: x1, x2
const A1 = t('a1', 'Web sitesi', '2026-11-02', '2026-11-04', { progress: 100 });
const A2 = t('a2', 'Web sitesi', '2026-11-05', '2026-11-06', { dependencies: ['a1'] });
const A3 = t('a3', 'Web sitesi', '2026-11-09', '2026-11-13', { dependencies: ['a2'], progress: 50 });
const B1 = t('b1', 'Çalışma planı', '2026-11-03', '2026-11-05');
const B2 = t('b2', 'Çalışma planı', '2026-11-06', '2026-11-10', { dependencies: ['b1', 'a1'] }); // a1: başka projeden bağımlılık
const X1 = t('x1', '', '2026-11-01', '2026-11-02');
const X2 = t('x2', '', '2026-11-12', '2026-11-12');
const ALL = [X1, A1, B1, A2, B2, A3, X2];

describe('model: project alanı', () => {
  test('kırpılır, en çok 80 karakter; yoksa boş', () => {
    assert.equal(normalizeEvent({ title: 'x', project: '  Web sitesi  ' }).project, 'Web sitesi');
    assert.equal(normalizeEvent({ title: 'x' }).project, '');
    assert.equal(normalizeEvent({ title: 'x', project: 'a'.repeat(200) }).project.length, 80);
  });
});

describe('projectOptions / resolveProject', () => {
  test('proje yoksa seçici yoktur', () => {
    assert.deepEqual(projectOptions([X1, X2]), []);
  });

  test('tümü + Türkçe sıralı proje adları + (projesiz görev varsa) Projesiz', () => {
    assert.deepEqual(projectOptions(ALL), ['', 'Çalışma planı', 'Web sitesi', NO_PROJECT]);
    assert.deepEqual(projectOptions([A1, A2, B1]), ['', 'Çalışma planı', 'Web sitesi']); // projesiz görev yoksa seçenek de yok
  });

  test('geçersiz kayıtlı seçim "Tüm projeler"e düşer', () => {
    const options = projectOptions(ALL);
    assert.equal(resolveProject(options, 'Web sitesi'), 'Web sitesi');
    assert.equal(resolveProject(options, NO_PROJECT), NO_PROJECT);
    assert.equal(resolveProject(options, 'Silinmiş proje'), '');
    assert.equal(resolveProject([], 'Web sitesi'), '');
    assert.equal(projectLabel(''), 'Tüm projeler');
    assert.equal(projectLabel(NO_PROJECT), 'Projesiz');
    assert.equal(projectLabel('Web sitesi'), 'Web sitesi');
  });
});

describe('buildRows', () => {
  test('proje yoksa düz liste (eski davranış)', () => {
    const v = buildRows([X1, X2]);
    assert.equal(v.grouped, false);
    assert.deepEqual(v.rows.map((r) => r.kind), ['task', 'task']);
    assert.deepEqual(v.tasks.map((x) => x.id), ['x1', 'x2']);
    assert.equal(v.groups.length, 1);
  });

  test('Tüm projeler: başlık satırı + görevler; Projesiz en sonda', () => {
    const v = buildRows(ALL);
    assert.equal(v.grouped, true);
    assert.deepEqual(
      v.rows.map((r) => (r.kind === 'group' ? `[${r.name}]` : r.task.id)),
      ['[Çalışma planı]', 'b1', 'b2', '[Web sitesi]', 'a1', 'a2', 'a3', '[Projesiz]', 'x1', 'x2'],
    );
    assert.deepEqual(v.tasks.map((x) => x.id), ['b1', 'b2', 'a1', 'a2', 'a3', 'x1', 'x2']);
  });

  test('başlık özeti: ilk başlangıç, son bitiş, süreye göre ağırlıklı ilerleme', () => {
    const web = buildRows(ALL).rows.find((r) => r.kind === 'group' && r.name === 'Web sitesi');
    assert.deepEqual([web.start, web.end, web.tasks.length], ['2026-11-02', '2026-11-13', 3]);
    // a1: 3 gün %100, a2: 2 gün %0, a3: 5 gün %50 → (300 + 0 + 250) / 10 = 55
    assert.equal(web.progress, 55);
    assert.equal(weightedProgress([A1, A2, A3]), 55);
    assert.equal(weightedProgress([]), 0);
  });

  test('daraltılmış grubun görevleri satırlardan çıkar, ama gruplarda kalır', () => {
    const v = buildRows(ALL, { collapsed: ['Web sitesi'] });
    assert.deepEqual(v.rows.map((r) => (r.kind === 'group' ? `[${r.name}${r.collapsed ? ' ▸' : ''}]` : r.task.id)), ['[Çalışma planı]', 'b1', 'b2', '[Web sitesi ▸]', '[Projesiz]', 'x1', 'x2']);
    assert.deepEqual(v.tasks.map((x) => x.id), ['b1', 'b2', 'x1', 'x2']);
    assert.equal(v.groups.find((g) => g.key === 'Web sitesi').tasks.length, 3); // kritik yol ve zaman aralığı için
    assert.deepEqual(buildRows(ALL, { collapsed: [NO_PROJECT] }).tasks.map((x) => x.id), ['b1', 'b2', 'a1', 'a2', 'a3']);
  });

  test('tek proje ve Projesiz: yalnızca o görevler, başlık satırı yok', () => {
    const one = buildRows(ALL, { project: 'Web sitesi' });
    assert.equal(one.grouped, false);
    assert.deepEqual(one.rows.map((r) => r.task.id), ['a1', 'a2', 'a3']);
    assert.deepEqual(one.groups.map((g) => g.key), ['Web sitesi']);
    assert.deepEqual(buildRows(ALL, { project: NO_PROJECT }).tasks.map((x) => x.id), ['x1', 'x2']);
  });

  test('bilinmeyen proje seçimi tümü gibi davranır; daraltma listesi tek projede yok sayılır', () => {
    assert.equal(buildRows(ALL, { project: 'yok' }).grouped, true);
    assert.equal(buildRows(ALL, { project: 'Web sitesi', collapsed: ['Web sitesi'] }).tasks.length, 3);
  });
});

describe('combineCriticalPaths', () => {
  test('proje başına hesaplanır; başka projedeki öncül kritik yolu belirlemez', () => {
    const { groups } = buildRows(ALL);
    const cpm = combineCriticalPaths(groups, computeCriticalPath);
    assert.equal(cpm.hasCycle, false);
    // Web: a1(3g) → a2(2g) → a3(5g) hepsi zincirde → üçü de kritik; Çalışma planı: b1 → b2 → ikisi de kritik (a1'e bağımlılık grup dışı sayılır)
    assert.deepEqual([...cpm.critical].sort(), ['a1', 'a2', 'a3', 'b1', 'b2']);
    assert.equal(cpm.durations.get('Web sitesi'), 10);
    assert.equal(cpm.durations.get('Çalışma planı'), 8); // b1 3 gün + b2 5 gün
    assert.ok(!cpm.critical.has('x1'), 'zincirde olmayan görev kritik sayılmaz');
  });

  test('tek proje görünümü eski hesapla aynıdır', () => {
    const { groups, tasks } = buildRows(ALL, { project: 'Web sitesi' });
    const cpm = combineCriticalPaths(groups, computeCriticalPath);
    const direct = computeCriticalPath(tasks);
    assert.deepEqual([...cpm.critical].sort(), [...direct.critical].sort());
    assert.equal(cpm.durations.get('Web sitesi'), direct.projectDuration);
  });

  test('bir projedeki döngü hasCycle olarak bildirilir', () => {
    const c1 = t('c1', 'Döngü', '2026-11-02', '2026-11-03', { dependencies: ['c2'] });
    const c2 = t('c2', 'Döngü', '2026-11-04', '2026-11-05', { dependencies: ['c1'] });
    const cpm = combineCriticalPaths(buildRows([A1, c1, c2]).groups, computeCriticalPath);
    assert.equal(cpm.hasCycle, true);
  });
});
