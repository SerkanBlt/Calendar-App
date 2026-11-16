/**
 * Arayüz mantığı (DOM'suz): "Bugün: 15.Kas" etiketi, özel renk normalleştirme ve komut paleti satır üretimi.
 */
process.env.TZ = 'Europe/Istanbul';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildRows } from '../src/components/commandPalette.js';
import { clampFabBottom, FAB_SIZE } from '../src/components/fab.js';
import { dayMonthShort, isoWeek, isoWeekInfo, shiftEnd } from '../src/core/dateUtils.js';
import { dueForAutoClose, normalizeEvent, normalizeHexColor, statusPatch } from '../src/core/eventModel.js';

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

describe('ISO 8601 hafta numarası (Yıl görünümü)', () => {
  test('yılın ilk Perşembesini içeren hafta 1. haftadır', () => {
    assert.equal(isoWeek('2026-01-01'), 1); // Perşembe
    assert.equal(isoWeek('2026-01-04'), 1); // Pazar: haftanın son günü
    assert.equal(isoWeek('2026-01-05'), 2);
    assert.equal(isoWeek('2021-01-04'), 1); // 1 Oca 2021 Cuma → önceki yılın 53. haftası, 4 Oca 1. hafta
  });

  test('yıl sınırında komşu yılın haftasına ait olabilir', () => {
    assert.deepEqual(isoWeekInfo('2025-12-29'), { week: 1, year: 2026 });
    assert.deepEqual(isoWeekInfo('2024-12-30'), { week: 1, year: 2025 });
    assert.deepEqual(isoWeekInfo('2021-01-01'), { week: 53, year: 2020 });
    assert.deepEqual(isoWeekInfo('2027-01-03'), { week: 53, year: 2026 });
    assert.deepEqual(isoWeekInfo('2026-12-31'), { week: 53, year: 2026 });
  });

  test('53 haftalı yıllar (2020, 2026) ve 52 haftalı yıllar', () => {
    assert.equal(isoWeek('2020-12-31'), 53);
    assert.equal(isoWeek('2026-12-28'), 53);
    assert.equal(isoWeek('2025-12-28'), 52);
    assert.equal(isoWeek('2023-12-31'), 52);
  });

  test('her gün için numara 1–53 arasındadır ve haftalar Pazartesi başlar', () => {
    for (let d = new Date(2019, 0, 1); d < new Date(2031, 0, 1); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const w = isoWeek(iso);
      assert.ok(w >= 1 && w <= 53, iso);
      if (d.getDay() === 1 && w !== 1) {
        const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
        const prevIso = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
        assert.equal(isoWeek(prevIso), w - 1, `${iso} Pazartesi: bir önceki Pazar bir önceki hafta`);
      }
    }
  });
});

describe('otomatik kapat (dueForAutoClose)', () => {
  const ev = (over) => normalizeEvent({ id: 'e', title: 'T', startDate: '2026-11-15', endDate: '2026-11-15', startTime: '09:00', endTime: '10:00', autoClose: true, ...over });
  const now = new Date(2026, 10, 16, 12, 0, 0);

  test('seçenek açık + bitiş zamanı geçmiş + tamamlanmamış → kapanır', () => {
    assert.deepEqual(dueForAutoClose([ev({})], now).map((e) => e.id), ['e']);
    assert.equal(dueForAutoClose([ev({ status: 'doing' })], now).length, 1);
  });

  test('seçenek kapalıysa, zaten tamamlanmışsa ya da zamanı gelmediyse kapanmaz', () => {
    assert.equal(dueForAutoClose([ev({ autoClose: false })], now).length, 0);
    assert.equal(dueForAutoClose([ev({ status: 'done', progress: 100 })], now).length, 0);
    assert.equal(dueForAutoClose([ev({ startDate: '2026-11-16', endDate: '2026-11-16', startTime: '13:00', endTime: '14:00' })], now).length, 0);
  });

  test('bitiş saati geçince kapanır (saatli etkinlik): sınır dakikası', () => {
    const e = ev({ startDate: '2026-11-16', endDate: '2026-11-16', startTime: '10:00', endTime: '12:00' });
    assert.equal(dueForAutoClose([e], new Date(2026, 10, 16, 11, 59, 59)).length, 0);
    assert.equal(dueForAutoClose([e], new Date(2026, 10, 16, 12, 0, 1)).length, 1);
  });

  test('tüm gün etkinliği bitiş gününün sonunda kapanır', () => {
    const e = ev({ startTime: '', endTime: '', startDate: '2026-11-16', endDate: '2026-11-16' });
    assert.equal(dueForAutoClose([e], new Date(2026, 10, 16, 23, 0, 0)).length, 0);
    assert.equal(dueForAutoClose([e], new Date(2026, 10, 17, 0, 0, 1)).length, 1);
  });

  test('tekrarlayan seriler otomatik kapanmaz; alan kaydedilir/normalleşir', () => {
    assert.equal(dueForAutoClose([ev({ recurrence: { freq: 'daily', interval: 1 } })], now).length, 0);
    assert.equal(normalizeEvent({ title: 'x', startDate: '2026-11-16', endDate: '2026-11-16' }).autoClose, false);
    assert.equal(ev({ autoClose: 1 }).autoClose, true);
  });
});

describe('statusPatch (sağ tık menüsüyle durum değişimi)', () => {
  test('Tamamlandı ilerlemeyi %100 yapar', () => {
    assert.deepEqual(statusPatch({ progress: 30 }, 'done'), { status: 'done', progress: 100 });
  });

  test('tamamlanmış etkinlik yeniden açılınca ilerleme tutarlı kalır', () => {
    assert.deepEqual(statusPatch({ progress: 100 }, 'doing'), { status: 'doing', progress: 50 });
    assert.deepEqual(statusPatch({ progress: 100 }, 'todo'), { status: 'todo', progress: 0 });
  });

  test('yarım ilerleme durum değişiminde korunur', () => {
    assert.deepEqual(statusPatch({ progress: 40 }, 'todo'), { status: 'todo' });
    assert.deepEqual(statusPatch({ progress: 40 }, 'doing'), { status: 'doing' });
  });
});
