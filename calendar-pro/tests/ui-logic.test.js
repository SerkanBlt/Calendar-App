/**
 * Arayüz mantığı (DOM'suz): "Bugün: 15.Kas" etiketi, özel renk normalleştirme ve komut paleti satır üretimi.
 */
process.env.TZ = 'Europe/Istanbul';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildRows } from '../src/components/commandPalette.js';
import { dayMonthShort } from '../src/core/dateUtils.js';
import { normalizeHexColor } from '../src/core/eventModel.js';

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
