/**
 * Tekrar motoru: günlük (iş günleri) / haftalık (belirli günler) / aylık (ayın N. günü, N. haftasının X günü, ilk-son iş günü) / çeyreklik / yıllık,
 * eklenen (rdates) ve silinen (exdates) tarihler, eski kurallarla uyum, hızlı atlama doğruluğu ve seri kaydırma.
 *
 * Takvim notu: 16 Kas 2026 Pazartesi; Kas 2026 ayı 1 Kas Pazar ile başlar; Ara 2026: 1 Ara Salı; Oca 2027: 1 Oca Cuma; Şub 2027: 1 Şub Pazartesi (28 gün).
 */
process.env.TZ = 'Europe/Istanbul';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  describeRecurrence,
  expandEvents,
  firstRuleDate,
  listRuleDates,
  normalizeRecurrence,
  ruleDatesInRange,
  shiftRule,
} from '../src/services/recurrenceService.js';

const rule = (r) => normalizeRecurrence({ interval: 1, ...r });
const dates = (r, start, limit = 6) => listRuleDates(rule(r), start, limit);
const inRange = (r, start, from, to) => ruleDatesInRange(rule(r), start, from, to);
const WORK = [1, 2, 3, 4, 5];

describe('eski kurallar aynen çalışır (desen alanı yok)', () => {
  test('günlük / haftalık / aylık / yıllık, aralık, count, until', () => {
    assert.deepEqual(inRange({ freq: 'daily', interval: 2 }, '2026-11-16', '2026-11-16', '2026-11-24'), ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-22', '2026-11-24']);
    assert.deepEqual(inRange({ freq: 'weekly' }, '2026-11-16', '2026-11-16', '2026-12-07'), ['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']);
    assert.deepEqual(dates({ freq: 'daily', count: 3 }, '2026-11-16', 10), ['2026-11-16', '2026-11-17', '2026-11-18']);
    assert.deepEqual(dates({ freq: 'weekly', until: '2026-12-01' }, '2026-11-16', 10), ['2026-11-16', '2026-11-23', '2026-11-30']);
  });

  test('aylık: ayın 31\'i kısa aylarda son güne kayar; yıllık: 29 Şubat → 28 Şubat', () => {
    assert.deepEqual(dates({ freq: 'monthly' }, '2026-01-31', 4), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    assert.deepEqual(dates({ freq: 'yearly' }, '2028-02-29', 5), ['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
  });

  test('çeyreklik (desensiz): her 3 ayda aynı gün', () => {
    assert.deepEqual(dates({ freq: 'quarterly' }, '2026-11-16', 3), ['2026-11-16', '2027-02-16', '2027-05-16']);
  });
});

describe('günlük: iş günleri / belirli günler', () => {
  test('yalnızca iş günleri (Pzt–Cum)', () => {
    assert.deepEqual(inRange({ freq: 'daily', weekdays: WORK }, '2026-11-16', '2026-11-16', '2026-11-30'), [
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-30',
    ]);
  });

  test('iki günde bir + yalnızca iş günleri: aralık kafesi korunur, hafta sonuna denk gelenler atlanır', () => {
    assert.deepEqual(inRange({ freq: 'daily', interval: 2, weekdays: WORK }, '2026-11-16', '2026-11-16', '2026-11-30'), ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-24', '2026-11-26', '2026-11-30']);
  });

  test('count yalnızca uyan tarihleri sayar', () => {
    assert.deepEqual(dates({ freq: 'daily', weekdays: WORK, count: 3 }, '2026-11-20', 10), ['2026-11-20', '2026-11-23', '2026-11-24']);
  });

  test('yedi günün hepsi = kısıt yok (kaydedilmez)', () => {
    assert.equal(rule({ freq: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] }).weekdays, undefined);
  });
});

describe('haftalık: belirli günler', () => {
  test('Salı + Perşembe; başlangıç Pazartesi olsa da başlangıç örnek sayılmaz', () => {
    assert.deepEqual(dates({ freq: 'weekly', weekdays: [4, 2] }, '2026-11-16', 6), ['2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26', '2026-12-01', '2026-12-03']);
    assert.equal(firstRuleDate(rule({ freq: 'weekly', weekdays: [2, 4] }), '2026-11-16'), '2026-11-17');
  });

  test('iki haftada bir Pzt/Çar/Cum; başlangıç haftasında başlangıçtan önceki günler atlanır', () => {
    assert.deepEqual(dates({ freq: 'weekly', interval: 2, weekdays: [1, 3, 5] }, '2026-11-18', 5), ['2026-11-18', '2026-11-20', '2026-11-30', '2026-12-02', '2026-12-04']);
  });

  test('hafta Pazartesi başlar: Cmt + Paz aynı hafta içinde sıralı', () => {
    assert.deepEqual(dates({ freq: 'weekly', weekdays: [0, 6] }, '2026-11-16', 4), ['2026-11-21', '2026-11-22', '2026-11-28', '2026-11-29']);
  });
});

describe('aylık desenler', () => {
  test('ayın ilk Salısı; başlangıçtan önceki gün atlanır', () => {
    assert.deepEqual(dates({ freq: 'monthly', nth: 1, weekday: 2 }, '2026-11-16', 4), ['2026-12-01', '2027-01-05', '2027-02-02', '2027-03-02']);
  });

  test('ayın son Cuması', () => {
    assert.deepEqual(dates({ freq: 'monthly', nth: -1, weekday: 5 }, '2026-11-01', 4), ['2026-11-27', '2026-12-25', '2027-01-29', '2027-02-26']);
  });

  test('ayın ilk ve son iş günü', () => {
    assert.deepEqual(dates({ freq: 'monthly', nth: 1, weekday: 'work' }, '2026-11-01', 4), ['2026-11-02', '2026-12-01', '2027-01-01', '2027-02-01']);
    assert.deepEqual(dates({ freq: 'monthly', nth: -1, weekday: 'work' }, '2026-11-01', 4), ['2026-11-30', '2026-12-31', '2027-01-29', '2027-02-26']);
    assert.deepEqual(dates({ freq: 'monthly', nth: 3, weekday: 'work' }, '2026-11-01', 2), ['2026-11-04', '2026-12-03']);
  });

  test('ayın N. günü; son gün; 31 kısa aylarda son güne kayar', () => {
    assert.deepEqual(dates({ freq: 'monthly', monthDay: 15 }, '2026-11-20', 3), ['2026-12-15', '2027-01-15', '2027-02-15']);
    assert.deepEqual(dates({ freq: 'monthly', monthDay: -1 }, '2026-11-01', 4), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
    assert.deepEqual(dates({ freq: 'monthly', monthDay: 31 }, '2026-11-01', 4), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
  });

  test('5. hafta olmayan aylar atlanır', () => {
    assert.deepEqual(dates({ freq: 'monthly', nth: 5, weekday: 1 }, '2026-11-01', 2), ['2026-11-30', '2027-03-29']);
  });

  test('N aylık aralık', () => {
    assert.deepEqual(dates({ freq: 'monthly', interval: 3, nth: 1, weekday: 1 }, '2026-11-01', 3), ['2026-11-02', '2027-02-01', '2027-05-03']);
  });
});

describe('çeyreklik desenler', () => {
  test('çeyreğin 1. ayının ilk Pazartesisi', () => {
    assert.deepEqual(dates({ freq: 'quarterly', quarterMonth: 1, nth: 1, weekday: 1 }, '2026-11-16', 3), ['2027-01-04', '2027-04-05', '2027-07-05']);
  });

  test('çeyreğin 3. ayının 1. günü', () => {
    assert.deepEqual(dates({ freq: 'quarterly', quarterMonth: 3, monthDay: 1 }, '2026-11-16', 3), ['2026-12-01', '2027-03-01', '2027-06-01']);
  });

  test('iki çeyrekte bir, 2. ay, ayın 10\'u', () => {
    assert.deepEqual(dates({ freq: 'quarterly', interval: 2, quarterMonth: 2, monthDay: 10 }, '2026-11-16', 2), ['2027-05-10', '2027-11-10']);
  });

  test('çeyreğin son ayının son iş günü', () => {
    assert.deepEqual(dates({ freq: 'quarterly', quarterMonth: 3, nth: -1, weekday: 'work' }, '2026-11-16', 3), ['2026-12-31', '2027-03-31', '2027-06-30']);
  });
});

describe('yıllık desenler', () => {
  test('Mart ayının ilk Pazartesisi', () => {
    assert.deepEqual(dates({ freq: 'yearly', month: 3, nth: 1, weekday: 1 }, '2026-11-16', 2), ['2027-03-01', '2028-03-06']);
  });

  test('ay + ayın N. günü', () => {
    assert.deepEqual(dates({ freq: 'yearly', month: 1, monthDay: 1 }, '2026-11-16', 2), ['2027-01-01', '2028-01-01']);
  });
});

describe('eklenen (rdates) ve silinen (exdates) tarihler', () => {
  const base = { freq: 'weekly', exdates: ['2026-11-23'], rdates: ['2026-11-25'] };

  test('(kural ∪ rdates) \\ exdates', () => {
    assert.deepEqual(inRange(base, '2026-11-16', '2026-11-16', '2026-12-01'), ['2026-11-16', '2026-11-25', '2026-11-30']);
  });

  test('exdates eklenen tarihi de siler; rdates until/count dışındadır', () => {
    assert.deepEqual(inRange({ ...base, exdates: ['2026-11-25'], until: '2026-11-17', rdates: ['2026-11-25', '2027-03-03'] }, '2026-11-16', '2026-11-01', '2027-12-31'), ['2026-11-16', '2027-03-03']);
    assert.deepEqual(inRange({ freq: 'daily', count: 2, rdates: ['2030-01-01'] }, '2026-11-16', '2026-01-01', '2031-01-01'), ['2026-11-16', '2026-11-17', '2030-01-01']);
  });

  test('bir tarihi başka güne almak = exdates + rdates', () => {
    const moved = { freq: 'weekly', exdates: ['2026-11-23'], rdates: ['2026-11-24'] };
    assert.deepEqual(inRange(moved, '2026-11-16', '2026-11-16', '2026-11-30'), ['2026-11-16', '2026-11-24', '2026-11-30']);
  });
});

describe('hızlı atlama, kaba tarama ile aynı sonucu verir', () => {
  const rules = [
    { freq: 'daily', interval: 3, weekdays: WORK },
    { freq: 'weekly', interval: 2, weekdays: [1, 3, 5] },
    { freq: 'weekly', interval: 3 },
    { freq: 'monthly', interval: 3, nth: 2, weekday: 2 },
    { freq: 'monthly', monthDay: 31 },
    { freq: 'quarterly', quarterMonth: 2, monthDay: -1 },
    { freq: 'quarterly', interval: 2, quarterMonth: 3, nth: 1, weekday: 'work' },
    { freq: 'yearly', interval: 2, month: 2, monthDay: 29 },
    { freq: 'yearly' },
  ];
  test('2030\'da bir pencere', () => {
    for (const r of rules) {
      const all = listRuleDates(rule(r), '2026-11-18', 4000);
      const want = all.filter((d) => d >= '2030-03-01' && d <= '2030-06-30');
      assert.deepEqual(inRange(r, '2026-11-18', '2030-03-01', '2030-06-30'), want, JSON.stringify(r));
    }
  });
});

describe('expandEvents', () => {
  const ev = (over) => ({ id: 'e1', title: 'Toplantı', startDate: '2026-11-16', endDate: '2026-11-16', startTime: '10:00', endTime: '11:00', ...over });

  test('haftalık Sal/Per: örnek kimlikleri ve tarihler', () => {
    const out = expandEvents([ev({ recurrence: rule({ freq: 'weekly', weekdays: [2, 4] }) })], '2026-11-16', '2026-11-22');
    assert.deepEqual(out.map((o) => o.id), ['e1@2026-11-17', 'e1@2026-11-19']);
    assert.ok(out.every((o) => o.isRecurring && o.masterId === 'e1'));
  });

  test('çok günlü örnek, aralıktan önce başlayıp aralığa taşıyorsa görünür', () => {
    const out = expandEvents([ev({ endDate: '2026-11-18', recurrence: rule({ freq: 'weekly', weekdays: [1] }) })], '2026-11-17', '2026-11-17');
    assert.deepEqual(out.map((o) => [o.startDate, o.endDate]), [['2026-11-16', '2026-11-18']]);
  });

  test('eklenen tarih örnek üretir, silinen üretmez', () => {
    const out = expandEvents([ev({ recurrence: rule({ freq: 'weekly', exdates: ['2026-11-16'], rdates: ['2026-11-18'] }) })], '2026-11-16', '2026-11-24');
    assert.deepEqual(out.map((o) => o.startDate), ['2026-11-18', '2026-11-23']);
  });

  test('tekrarsız etkinlik aynen döner', () => {
    const out = expandEvents([ev({ recurrence: null })], '2026-11-01', '2026-11-30');
    assert.equal(out.length, 1);
    assert.equal(out[0].isRecurring, false);
  });
});

describe('normalizeRecurrence', () => {
  test('eski kural değişmez (yeni alan eklenmez)', () => {
    assert.deepEqual(normalizeRecurrence({ freq: 'weekly', interval: 2, until: '', count: 8, exdates: ['2026-11-16'] }), { freq: 'weekly', interval: 2, until: '', count: 8, exdates: ['2026-11-16'] });
  });

  test('sıklığa uymayan desen alanları atılır', () => {
    assert.deepEqual(rule({ freq: 'weekly', monthDay: 5, nth: 1, weekday: 2, weekdays: [3] }), { freq: 'weekly', interval: 1, until: '', count: 0, exdates: [], weekdays: [3] });
    assert.deepEqual(rule({ freq: 'monthly', weekdays: [1], quarterMonth: 2, month: 3, monthDay: 5 }), { freq: 'monthly', interval: 1, until: '', count: 0, exdates: [], monthDay: 5 });
    assert.equal(rule({ freq: 'monthly', quarterMonth: 2 }).quarterMonth, undefined);
    assert.equal(rule({ freq: 'quarterly', quarterMonth: 2 }).quarterMonth, 2);
    assert.equal(rule({ freq: 'yearly', month: 3 }).month, 3);
  });

  test('geçersiz değerler atılır; nth+weekday monthDay\'e baskındır', () => {
    assert.equal(rule({ freq: 'monthly', monthDay: 40 }).monthDay, undefined);
    assert.equal(rule({ freq: 'monthly', nth: 9, weekday: 2, monthDay: 7 }).monthDay, 7);
    const both = rule({ freq: 'monthly', nth: 2, weekday: 0, monthDay: 7 });
    assert.deepEqual([both.nth, both.weekday, both.monthDay], [2, 0, undefined]);
    assert.equal(rule({ freq: 'monthly', nth: 1, weekday: 'work' }).weekday, 'work');
    assert.equal(normalizeRecurrence({ freq: 'hourly' }), null);
    assert.equal(rule({ freq: 'daily', count: 99999 }).count, 5000);
  });

  test('rdates sıralı ve tekil; boşsa hiç yazılmaz', () => {
    assert.deepEqual(rule({ freq: 'daily', rdates: ['2026-12-01', '2026-11-20', '2026-12-01', 'x'] }).rdates, ['2026-11-20', '2026-12-01']);
    assert.equal('rdates' in rule({ freq: 'daily', rdates: [] }), false);
  });
});

describe('describeRecurrence', () => {
  test('örnekler', () => {
    assert.equal(describeRecurrence(null), 'Tekrar yok');
    assert.equal(describeRecurrence(rule({ freq: 'daily' })), 'Her gün');
    assert.equal(describeRecurrence(rule({ freq: 'daily', weekdays: WORK })), 'Her gün · yalnızca iş günleri (Pzt–Cum)');
    assert.equal(describeRecurrence(rule({ freq: 'daily', interval: 2, count: 5 })), 'Her 2 günde bir · 5 kez');
    assert.equal(describeRecurrence(rule({ freq: 'weekly', interval: 2, weekdays: [3, 1] })), 'Her 2 haftada bir · Pzt, Çar');
    assert.equal(describeRecurrence(rule({ freq: 'monthly', nth: 1, weekday: 2 })), 'Her ay · ayın ilk Salı günü');
    assert.equal(describeRecurrence(rule({ freq: 'monthly', nth: -1, weekday: 'work' })), 'Her ay · ayın son iş günü');
    assert.equal(describeRecurrence(rule({ freq: 'monthly', monthDay: -1 })), 'Her ay · ayın son günü');
    assert.equal(describeRecurrence(rule({ freq: 'monthly', interval: 3, monthDay: 15 })), 'Her 3 ayda bir · ayın 15. günü');
    assert.equal(describeRecurrence(rule({ freq: 'quarterly', quarterMonth: 1, monthDay: 1 })), 'Her çeyrek · çeyreğin 1. ayı · ayın 1. günü');
    assert.equal(describeRecurrence(rule({ freq: 'yearly', month: 3, nth: 1, weekday: 1 })), 'Her yıl · Mart · ayın ilk Pazartesi günü');
    assert.equal(describeRecurrence(rule({ freq: 'daily', until: '2026-12-31' })), 'Her gün · 31 Aralık 2026 tarihine kadar');
  });
});

describe('shiftRule (tüm seriyi sürükleyerek kaydırma)', () => {
  test('haftanın günleri döner; hariç ve eklenen tarihler kayar', () => {
    const out = shiftRule(rule({ freq: 'weekly', weekdays: [2, 4], exdates: ['2026-11-24'], rdates: ['2026-11-30'] }), '2026-11-17', '2026-11-18');
    assert.deepEqual(out.weekdays, [3, 5]);
    assert.deepEqual(out.exdates, ['2026-11-25']);
    assert.deepEqual(out.rdates, ['2026-12-01']);
  });

  test('haftalık: hafta sonuna taşıma Cmt/Paz\'a döner', () => {
    assert.deepEqual(shiftRule(rule({ freq: 'weekly', weekdays: [4, 5] }), '2026-11-19', '2026-11-21').weekdays, [0, 6]);
  });

  test('ayın N. haftasının X günü yeni tarihe uyar; "son" yalnızca gerçekten sonsa korunur', () => {
    const first = shiftRule(rule({ freq: 'monthly', nth: 1, weekday: 2 }), '2026-12-01', '2026-12-02');
    assert.deepEqual([first.nth, first.weekday], [1, 3]);
    const last = shiftRule(rule({ freq: 'monthly', nth: -1, weekday: 5 }), '2026-11-27', '2026-11-26');
    assert.deepEqual([last.nth, last.weekday], [-1, 4]);
    const notLast = shiftRule(rule({ freq: 'monthly', nth: -1, weekday: 5 }), '2026-11-27', '2026-11-20');
    assert.deepEqual([notLast.nth, notLast.weekday], [3, 5]);
    assert.equal(shiftRule(rule({ freq: 'monthly', nth: 1, weekday: 'work' }), '2026-12-01', '2026-12-03').weekday, 'work');
  });

  test('ayın günü, çeyrek ayı ve yıllık ay taşınan örneğe uyar; ayın son günü korunur', () => {
    assert.equal(shiftRule(rule({ freq: 'monthly', monthDay: 15 }), '2026-12-15', '2026-12-17').monthDay, 17);
    assert.equal(shiftRule(rule({ freq: 'monthly', monthDay: -1 }), '2026-11-30', '2026-11-29').monthDay, -1);
    assert.equal(shiftRule(rule({ freq: 'quarterly', quarterMonth: 1, monthDay: 1 }), '2027-01-01', '2027-02-03').quarterMonth, 2);
    assert.equal(shiftRule(rule({ freq: 'yearly', month: 3, monthDay: 1 }), '2027-03-01', '2027-04-01').month, 4);
  });

  test('kayma yoksa kural aynen döner', () => {
    const r = rule({ freq: 'weekly', weekdays: [2] });
    assert.equal(shiftRule(r, '2026-11-17', '2026-11-17'), r);
  });
});
