/**
 * Arayüz mantığı (DOM'suz): "Bugün: 15.Kas" etiketi, özel renk normalleştirme ve komut paleti satır üretimi.
 */
process.env.TZ = 'Europe/Istanbul';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildRows } from '../src/components/commandPalette.js';
import { clampFabBottom, FAB_SIZE } from '../src/components/fab.js';
import { dayMonthShort, shiftEnd } from '../src/core/dateUtils.js';
import { normalizeHexColor } from '../src/core/eventModel.js';

describe('shiftEnd (başlangıç–bitiş bağı: süre korunur)', () => {
  const prev = { startDate: '2026-11-16', startTime: '09:00', endDate: '2026-11-16', endTime: '10:30' }; // 1,5 saat

  test('başlangıç saati değişince bitiş aynı süre kalacak şekilde kayar', () => {
    assert.deepEqual(shiftEnd(prev, { startDate: '2026-11-16', startTime: '14:00' }), { endDate: '2026-11-16', endTime: '15:30' });
    assert.deepEqual(shiftEnd(prev, { startDate: '2026-11-16', startTime: '08:15' }), { endDate: '2026-11-16', endTime: '09:45' });
  });

  test('gece yarısını aşınca bitiş tarihi bir gün ilerler; geri dönünce geri gelir', () => {
    const late = shiftEnd(prev, { startDate: '2026-11-16', startTime: '23:00' });
    assert.deepEqual(late, { endDate: '2026-11-17', endTime: '00:30' });
    // gece yarısını aşan aralıktan geri dönüş: süre (1,5 sa) yine korunur, bitiş aynı güne düşer
    const back = shiftEnd({ startDate: '2026-11-16', startTime: '23:00', ...late }, { startDate: '2026-11-16', startTime: '21:00' });
    assert.deepEqual(back, { endDate: '2026-11-16', endTime: '22:30' });
  });

  test('başlangıç tarihi değişince çok günlü süre de korunur (ay/yıl sınırları dahil)', () => {
    const multi = { startDate: '2026-11-16', startTime: '09:00', endDate: '2026-11-18', endTime: '17:00' }; // 2 gün 8 saat
    assert.deepEqual(shiftEnd(multi, { startDate: '2026-11-30', startTime: '09:00' }), { endDate: '2026-12-02', endTime: '17:00' });
    assert.deepEqual(shiftEnd(multi, { startDate: '2026-12-30', startTime: '20:00' }), { endDate: '2027-01-02', endTime: '04:00' });
  });

  test('artık yıl ve 0 süre', () => {
    assert.deepEqual(shiftEnd({ ...prev, endTime: '09:00' }, { startDate: '2028-02-28', startTime: '23:59' }), { endDate: '2028-02-28', endTime: '23:59' });
    assert.deepEqual(shiftEnd(prev, { startDate: '2028-02-28', startTime: '23:00' }), { endDate: '2028-02-29', endTime: '00:30' });
  });

  test('bitiş başlangıçtan önceyse süre 0 sayılır (bitiş başlangıcı izler)', () => {
    const bad = { startDate: '2026-11-16', startTime: '10:00', endDate: '2026-11-16', endTime: '09:00' };
    assert.deepEqual(shiftEnd(bad, { startDate: '2026-11-16', startTime: '12:00' }), { endDate: '2026-11-16', endTime: '12:00' });
  });

  test('boş ya da geçersiz değerde null döner (bitişe dokunulmaz)', () => {
    assert.equal(shiftEnd(prev, { startDate: '2026-11-16', startTime: '' }), null);
    assert.equal(shiftEnd(prev, { startDate: '', startTime: '10:00' }), null);
    assert.equal(shiftEnd({ ...prev, endTime: '' }, { startDate: '2026-11-16', startTime: '10:00' }), null);
    assert.equal(shiftEnd(prev, { startDate: '20261-11-16', startTime: '10:00' }), null);
  });
});

describe('dayMonthShort', () => {
  test('gün.kısa-ay biçimi', () => {
    assert.equal(dayMonthShort(new Date(2026, 10, 15)), '15.Kas');
    assert.equal(dayMonthShort(new Date(2026, 0, 3)), '3.Oca'); // tek haneli gün sıfırla doldurulmaz
    assert.equal(dayMonthShort('2026-12-31'), '31.Ara'); // ISO metin de kabul edilir
  });
});

describe('normalizeHexColor', () => {
  test('geçerli biçimleri #rrggbb küçük harfe çevirir', () => {
    assert.equal(normalizeHexColor('#7C6CFF'), '#7c6cff');
    assert.equal(normalizeHexColor('#abc'), '#aabbcc');
    assert.equal(normalizeHexColor('#11223344'), '#112233'); // alfa atılır (<input type="color"> alfa desteklemez)
  });
  test('geçersiz değerler boş döner', () => {
    for (const bad of ['', null, undefined, 'red', '#12', '#abcd', '#12345', '#ggg', 'rgb(1,2,3)']) assert.equal(normalizeHexColor(bad), '');
  });
});

describe('buildRows (komut paleti)', () => {
  const groups = [
    { id: 'data', label: 'Veri', icon: 'layers' },
    { id: 'theme', label: 'Tema', icon: 'palette' },
    { id: 'empty', label: 'Boş grup' },
  ];
  const commands = [
    { id: 'new', title: 'Yeni Event' },
    { id: 'export', title: 'Export Data (JSON)', keywords: 'dışa aktar', group: 'data' },
    { id: 'import', title: 'Import Data (JSON)', group: 'data' },
    { id: 'dark', title: 'Tema: Koyu', keywords: 'theme', group: 'theme' },
    { id: 'settings', title: 'Ayarlar' },
    { id: 'orphan', title: 'Tanımsız grup', group: 'yok' }, // grubu tanımlı değil → grupsuz sayılır
  ];
  const kinds = (rows) => rows.map((r) => (r.kind === 'group' ? `[${r.group.id}${r.group.open ? '-' : '+'}]` : r.nested ? `  ${r.item.id}` : r.item.id));

  test('sorgu boşken: grupsuz komutlar önce, gruplar kapalı başlık olarak sonda', () => {
    const rows = buildRows({ commands, groups });
    assert.deepEqual(kinds(rows), ['new', 'settings', 'orphan', '[data+]', '[theme+]']);
    assert.equal(rows.find((r) => r.kind === 'group' && r.group.id === 'data').group.count, 2);
    assert.ok(!rows.some((r) => r.kind === 'group' && r.group.id === 'empty'), 'komutsuz grup gösterilmez');
  });

  test('açık grup, komutlarını girintili satırlar olarak başlığın altına ekler', () => {
    const rows = buildRows({ commands, groups, expanded: new Set(['data']) });
    assert.deepEqual(kinds(rows), ['new', 'settings', 'orphan', '[data-]', '  export', '  import', '[theme+]']);
  });

  test('sorgu varken: gruplar yok sayılır, eşleşenler düz listelenir', () => {
    const rows = buildRows({ commands, groups, expanded: new Set(), query: 'json' });
    assert.deepEqual(rows.map((r) => r.item.id).sort(), ['export', 'import']);
    assert.ok(rows.every((r) => r.kind === 'command' && !r.nested));
  });

  test('grup adı da aranabilir ("veri" → Veri grubundaki komutlar)', () => {
    const ids = buildRows({ commands, groups, query: 'veri' }).map((r) => r.item.id);
    assert.ok(ids.includes('export') && ids.includes('import'));
  });

  test('sorguda eşleşen etkinlikler komutlardan sonra gelir (en fazla 6)', () => {
    const events = Array.from({ length: 9 }, (_, i) => ({ id: `e${i}`, title: `Toplantı ${i}`, category: '' }));
    const rows = buildRows({ commands, groups, query: 'toplantı', events });
    assert.equal(rows.filter((r) => r.kind === 'event').length, 6);
    assert.ok(rows.every((r) => r.kind === 'event'), 'eşleşen komut yok');
  });

  test('grup tanımsızsa (groups verilmediyse) eski düz davranış korunur', () => {
    const rows = buildRows({ commands: commands.map(({ group, ...c }) => c) });
    assert.equal(rows.length, commands.length);
    assert.ok(rows.every((r) => r.kind === 'command'));
  });
});

describe('clampFabBottom (yüzen düğme konumu)', () => {
  test('alt kenara ve üstte başlığa yer bırakacak şekilde sıkıştırır', () => {
    assert.equal(clampFabBottom(0, 800), 16); // en az 16 px alt boşluk
    assert.equal(clampFabBottom(-50, 800), 16);
    assert.equal(clampFabBottom(300, 800), 300);
    assert.equal(clampFabBottom(5000, 800), 800 - FAB_SIZE - 72); // üstte 72 px boşluk kalır
  });
  test('küçük ekranda bile alt sınırın altına inmez; geçersiz değer varsayılana döner', () => {
    assert.equal(clampFabBottom(100, 120), 16);
    assert.equal(clampFabBottom(NaN, 800), 16);
    assert.equal(clampFabBottom(undefined, 800), 16);
    assert.equal(clampFabBottom('240', 800), 240);
    assert.equal(clampFabBottom(100.6, 800), 101);
  });
});
