/**
 * Tatil günleri: her yıl tekrarlı (aynı ay-gün) ve değişken (yalnızca o yıl) tatiller, çalışma dışı (off) gün entegrasyonu ve ekleme kuralları.
 */
process.env.TZ = 'Europe/Istanbul';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addHolidays, holidayDaySet, holidayInfoFor, holidayOn, holidaysInYear, normalizeHolidays, removeHoliday, updateHoliday } from '../src/core/holidays.js';
import { offDaySet, visibleDays } from '../src/core/workDays.js';

const yearly = (date, name = '') => ({ date, name, yearly: true });
const once = (date, name = '') => ({ date, name, yearly: false });

describe('normalizeHolidays', () => {
  test('geçersiz kayıtlar atılır, kimlik üretilir, tarihe göre sıralanır', () => {
    const list = normalizeHolidays([once('2026-12-01', 'B'), { date: 'x' }, null, yearly('2026-01-01', ' Yılbaşı '), 'metin']);
    assert.deepEqual(list.map((h) => [h.date, h.name, h.yearly]), [['2026-01-01', 'Yılbaşı', true], ['2026-12-01', 'B', false]]);
    assert.ok(list.every((h) => typeof h.id === 'string' && h.id));
    assert.deepEqual(normalizeHolidays('x'), []);
    assert.deepEqual(normalizeHolidays(undefined), []);
  });

  test('aynı ay-gün için iki yıllık kayıt ve aynı tarihli iki tek seferlik kayıt tekilleşir; adı en çok 80 karakter', () => {
    assert.equal(normalizeHolidays([yearly('2025-10-29'), yearly('2026-10-29')]).length, 1);
    assert.equal(normalizeHolidays([once('2026-10-29'), once('2026-10-29')]).length, 1);
    assert.equal(normalizeHolidays([once('2026-10-29'), yearly('2026-10-29')]).length, 2); // farklı tür: birleştirme addHolidays'tedir
    assert.equal(normalizeHolidays([once('2026-10-29', 'a'.repeat(200))])[0].name.length, 80);
  });
});

describe('holidaysInYear: her yıl tekrarlı ve yalnızca o yıl', () => {
  const list = [yearly('2026-10-29', 'Cumhuriyet Bayramı'), once('2026-03-20', 'Ramazan Bayramı'), once('2027-03-09', 'Ramazan Bayramı 2027')];

  test('her yıl tekrarlı tatil her yıl aynı ay-günde gelir (geçmiş ve gelecek yıllar dahil)', () => {
    for (const year of [2024, 2026, 2030, 2100]) assert.equal(holidaysInYear(list, year).has(`${year}-10-29`), true, String(year));
  });

  test('değişken tatil yalnızca kendi yılında geçerlidir', () => {
    assert.equal(holidaysInYear(list, 2026).has('2026-03-20'), true);
    assert.equal(holidaysInYear(list, 2027).has('2027-03-20'), false);
    assert.equal(holidaysInYear(list, 2025).has('2025-03-20'), false);
    assert.equal(holidaysInYear(list, 2027).has('2027-03-09'), true);
    assert.equal(holidaysInYear(list, 2026).has('2026-03-09'), false);
  });

  test('ad ve tür bilgisi', () => {
    const y26 = holidaysInYear(list, 2026);
    assert.deepEqual([y26.get('2026-10-29').name, y26.get('2026-10-29').yearly], ['Cumhuriyet Bayramı', true]);
    assert.deepEqual([y26.get('2026-03-20').name, y26.get('2026-03-20').yearly], ['Ramazan Bayramı', false]);
    assert.equal(holidaysInYear([once('2026-05-01')], 2026).get('2026-05-01').name, 'Tatil'); // adsız
  });

  test('29 Şubat tekrarlı tatili yalnızca artık yıllarda vardır', () => {
    const leap = [yearly('2024-02-29', 'Artık gün')];
    assert.equal(holidaysInYear(leap, 2028).has('2028-02-29'), true);
    assert.equal(holidaysInYear(leap, 2027).size, 0);
    assert.equal(holidaysInYear(leap, 2100).size, 0); // 2100 artık yıl değil
    assert.equal(holidaysInYear(leap, 2000).has('2000-02-29'), true);
  });

  test('aynı güne düşen kayıtların adları birleşir', () => {
    const both = holidaysInYear([yearly('2026-05-01', 'İşçi Bayramı'), once('2026-05-01', 'Köprü')], 2026).get('2026-05-01');
    assert.equal(both.name, 'İşçi Bayramı · Köprü');
    assert.equal(both.entries.length, 2);
  });
});

describe('holidayDaySet / holidayInfoFor / holidayOn', () => {
  const list = [yearly('2026-01-01', 'Yılbaşı'), once('2026-12-31', 'Yılbaşı arifesi')];

  test('yıl sınırını aşan aralıklar doğru çalışır', () => {
    const days = ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'];
    assert.deepEqual([...holidayDaySet(list, days)], ['2026-12-31', '2027-01-01']); // 2027'de arife yok, Yılbaşı var
    assert.deepEqual([...holidayInfoFor(list, days).keys()], ['2026-12-31', '2027-01-01']);
  });

  test('tatil yoksa boş küme', () => {
    assert.equal(holidayDaySet([], ['2026-01-01']).size, 0);
    assert.equal(holidayDaySet(list, []).size, 0);
  });

  test('holidayOn', () => {
    assert.equal(holidayOn(list, '2031-01-01').name, 'Yılbaşı');
    assert.equal(holidayOn(list, '2031-12-31'), null);
    assert.equal(holidayOn(list, '2026-12-31').name, 'Yılbaşı arifesi');
  });
});

describe('çalışma dışı (off) gün entegrasyonu', () => {
  const week = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']; // Pzt … Paz
  const holidays = [yearly('2025-10-29', 'Cumhuriyet Bayramı')];

  test('tatil günü, çalışma günü olsa da off sayılır; hafta sonu zaten off', () => {
    assert.deepEqual([...offDaySet(week, [1, 2, 3, 4, 5])].sort(), ['2026-10-31', '2026-11-01']);
    assert.deepEqual([...offDaySet(week, [1, 2, 3, 4, 5], holidays)].sort(), ['2026-10-29', '2026-10-31', '2026-11-01']);
  });

  test('her yıl tekrarlı tatil başka yılın haftasında da off olur', () => {
    const w2031 = ['2031-10-27', '2031-10-28', '2031-10-29', '2031-10-30'];
    assert.deepEqual([...offDaySet(w2031, [1, 2, 3, 4, 5], holidays)], ['2031-10-29']);
  });

  test('değişken tatil başka yılda off yapmaz', () => {
    const list = [once('2026-10-29', 'Köprü')];
    assert.equal(offDaySet(['2026-10-29'], [1, 2, 3, 4, 5], list).has('2026-10-29'), true);
    assert.equal(offDaySet(['2027-10-29'], [0, 1, 2, 3, 4, 5, 6], list).has('2027-10-29'), false);
  });

  test('"Çalışma dışı günleri gizle" tatil günlerini de çıkarır; tüm günler off ise hepsi kalır', () => {
    const settings = { showOffDays: false, workDays: [1, 2, 3, 4, 5], holidays };
    assert.deepEqual(visibleDays(week, settings), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-30']);
    assert.equal(visibleDays(week, { ...settings, showOffDays: true }).length, 7);
    assert.deepEqual(visibleDays(['2026-10-29'], settings), ['2026-10-29']); // hepsi off: tümü
  });
});

describe('addHolidays / updateHoliday / removeHoliday', () => {
  test('tek gün, tek seferlik ve tekrarlı', () => {
    const a = addHolidays([], { date: '2026-04-23', name: 'Ulusal Egemenlik', yearly: true });
    assert.deepEqual([a.added, a.updated, a.list.length], [1, 0, 1]);
    assert.equal(holidaysInYear(a.list, 2040).has('2040-04-23'), true);
    const b = addHolidays(a.list, { date: '2026-03-20', name: 'Bayram', yearly: false });
    assert.equal(b.list.length, 2);
    assert.equal(holidaysInYear(b.list, 2027).has('2027-03-20'), false);
  });

  test('aralık: ardışık günler için ayrı kayıtlar (yıl sınırını aşabilir)', () => {
    const { list, added } = addHolidays([], { date: '2026-12-30', endDate: '2027-01-02', name: 'Yıl sonu', yearly: false });
    assert.equal(added, 4);
    assert.deepEqual(list.map((h) => h.date), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    const rec = addHolidays([], { date: '2026-12-31', endDate: '2027-01-01', name: 'Yılbaşı', yearly: true });
    assert.deepEqual(rec.list.map((h) => h.date), ['2026-12-31', '2027-01-01']);
    assert.equal(holidaysInYear(rec.list, 2035).size, 2);
  });

  test('aralık en çok 60 gün; bitiş başlangıçtan önceyse tek gün', () => {
    assert.equal(addHolidays([], { date: '2026-01-01', endDate: '2026-12-31' }).added, 60);
    assert.equal(addHolidays([], { date: '2026-05-10', endDate: '2026-05-01' }).added, 1);
    assert.equal(addHolidays([], { date: 'x' }).added, 0);
  });

  test('tekrarlı kayıt eklenince aynı ay-günün tek seferlik kayıtları birleşir', () => {
    const base = [once('2026-10-29', 'Eski'), once('2027-10-29', 'Eski 2'), once('2026-10-30', 'Başka')];
    const { list } = addHolidays(base, { date: '2026-10-29', name: 'Cumhuriyet', yearly: true });
    assert.deepEqual(list.map((h) => `${h.date}${h.yearly ? '*' : ''}`), ['2026-10-29*', '2026-10-30']);
  });

  test('her yıl tekrarlı bir tatilin kapsadığı güne tek seferlik kayıt eklenmez, yalnızca ad güncellenir', () => {
    const base = [yearly('2025-10-29', 'Cumhuriyet')];
    const r = addHolidays(base, { date: '2026-10-29', name: 'Cumhuriyet Bayramı', yearly: false });
    assert.deepEqual([r.added, r.updated, r.list.length, r.list[0].name], [0, 1, 1, 'Cumhuriyet Bayramı']);
    assert.equal(r.list[0].yearly, true);
  });

  test('aynı tarihli kayıt tekrar eklenirse çoğalmaz', () => {
    const base = addHolidays([], { date: '2026-05-19', name: 'Gençlik', yearly: true }).list;
    const again = addHolidays(base, { date: '2031-05-19', name: '', yearly: true });
    assert.deepEqual([again.added, again.list.length, again.list[0].name], [0, 1, 'Gençlik']); // boş ad eskisini silmez
  });

  test('updateHoliday: tarih/ad/tekrar değişir; removeHoliday siler', () => {
    const list = addHolidays([], { date: '2026-03-20', name: 'Bayram', yearly: false }).list;
    const id = list[0].id;
    const moved = updateHoliday(list, id, { date: '2026-03-21', name: 'Bayram (2. gün)', yearly: false }).list;
    assert.deepEqual(moved.map((h) => [h.date, h.name]), [['2026-03-21', 'Bayram (2. gün)']]);
    const toYearly = updateHoliday(moved, moved[0].id, { date: '2026-03-21', name: 'Nevruz', yearly: true }).list;
    assert.deepEqual([toYearly.length, toYearly[0].yearly], [1, true]);
    assert.deepEqual(removeHoliday(toYearly, toYearly[0].id), []);
  });
});
