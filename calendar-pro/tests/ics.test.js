/**
 * ICS dışa/içe aktarma testleri — Node'un yerleşik test koşucusu (ek bağımlılık yok): `npm test`
 */
process.env.TZ = 'Europe/Istanbul'; // yerel saat dilimi sabit olsun (UTC+3, yaz saati yok)

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizeEvent } from '../src/core/eventModel.js';
import { buildICS, parseICS, planImport } from '../src/services/icsService.js';

const NOW = new Date(2026, 10, 15, 12, 0); // 15 Kas 2026 12:00 yerel
const ev = (input) => normalizeEvent(input);
const toLines = (ics) => ics.split('\r\n');

/** Dışa aktar → ayrıştır → boş veritabanına planla. */
function roundTrip(events) {
  const { events: parsed } = parseICS(buildICS(events, { now: NOW, timeZone: 'Europe/Istanbul' }));
  return planImport(parsed, [], NOW).events;
}

describe('buildICS', () => {
  test('geçerli takvim iskeleti, CRLF ve katlama (≤ 75 oktet)', () => {
    const longTitle = 'Çok uzun bir başlık şğüıöç '.repeat(12);
    const ics = buildICS([ev({ id: 'a1', title: longTitle, startDate: '2026-11-20', startTime: '09:00', endTime: '10:00' })], { now: NOW, timeZone: 'Europe/Istanbul' });
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.ok(!/[^\r]\n/.test(ics), 'çıplak LF olmamalı');
    for (const line of toLines(ics)) assert.ok(Buffer.byteLength(line) <= 75, `satır çok uzun: ${line.length}`);
    // Katlama geri alındığında başlık bozulmamalı (çok baytlı karakterler bölünmemeli)
    const [parsed] = parseICS(ics).events;
    assert.equal(parsed.title, longTitle.trim().slice(0, 200));
  });

  test('tüm gün etkinlik: VALUE=DATE ve DTEND bitiş gününden bir sonraki gün', () => {
    const ics = buildICS([ev({ id: 'a1', title: 'Konferans', startDate: '2026-11-20', endDate: '2026-11-21' })], { now: NOW });
    assert.match(ics, /DTSTART;VALUE=DATE:20261120\r\n/);
    assert.match(ics, /DTEND;VALUE=DATE:20261122\r\n/);
  });

  test('saatli etkinlik floating yazılır; metin kaçışları uygulanır', () => {
    const ics = buildICS([ev({ id: 'a1', title: 'A; B, C', description: 'satır1\nsatır2 \\ son', startDate: '2026-11-20', startTime: '09:30', endTime: '10:15' })], { now: NOW });
    assert.match(ics, /DTSTART:20261120T093000\r\n/);
    assert.match(ics, /DTEND:20261120T101500\r\n/);
    assert.match(ics, /SUMMARY:A\\; B\\, C\r\n/);
    assert.match(ics, /DESCRIPTION:satır1\\nsatır2 \\\\ son\r\n/);
  });

  test('tekrar: RRULE, EXDATE ve VALARM', () => {
    const ics = buildICS(
      [ev({ id: 'a1', title: 'Stand-up', startDate: '2026-11-02', startTime: '09:30', endTime: '09:45', reminder: 15, recurrence: { freq: 'weekly', interval: 2, until: '2026-12-31', exdates: ['2026-11-16'] } })],
      { now: NOW },
    );
    assert.match(ics, /RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T235959\r\n/);
    assert.match(ics, /EXDATE:20261116T093000\r\n/);
    assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Stand-up\r\nTRIGGER:-PT15M\r\nEND:VALARM/);
  });

  test('tüm gün seride UNTIL ve EXDATE tarih türünde yazılır', () => {
    const ics = buildICS([ev({ id: 'a1', title: 'Doğum günü', startDate: '2026-11-02', recurrence: { freq: 'yearly', until: '2030-11-02', exdates: ['2027-11-02'] } })], { now: NOW });
    assert.match(ics, /RRULE:FREQ=YEARLY;UNTIL=20301102\r\n/);
    assert.match(ics, /EXDATE;VALUE=DATE:20271102\r\n/);
  });

  test('ayrılmış tek örnek aynı UID + RECURRENCE-ID ile yazılır ve ana serinin EXDATE\'inde tekrarlanmaz', () => {
    const master = ev({ id: 'm1', title: 'Spor', startDate: '2026-11-02', startTime: '18:00', endTime: '19:00', recurrence: { freq: 'weekly', exdates: ['2026-11-09', '2026-11-16'] } });
    const single = ev({ id: 's1', title: 'Spor (kayık)', startDate: '2026-11-09', endDate: '2026-11-09', startTime: '20:00', endTime: '21:00', seriesId: 'm1', originalDate: '2026-11-09' });
    const ics = buildICS([master, single], { now: NOW });
    assert.equal((ics.match(/UID:m1@calendar-pro/g) || []).length, 2);
    assert.match(ics, /RECURRENCE-ID:20261109T180000\r\n/);
    assert.match(ics, /EXDATE:20261116T180000\r\n/); // yalnızca gerçekten silinmiş olan
    assert.ok(!/EXDATE:[^\r]*20261109/.test(ics));
  });
});

describe('gidiş-dönüş (dışa aktar → içe aktar)', () => {
  test('tüm alanlar korunur', () => {
    const a = ev({ id: 'a-1', title: 'Tasarım; incelemesi, v2', description: 'Not 1\nNot 2', category: 'Toplantı', startDate: '2026-11-20', startTime: '11:00', endTime: '12:30', color: '#ff8a4c', status: 'doing', progress: 45, critical: true, reminder: 60 });
    const b = ev({ id: 'b-2', title: 'Lansman', startDate: '2026-12-01', endDate: '2026-12-03', status: 'todo', dependencies: ['a-1'] });
    const c = ev({ id: 'c-3', title: 'Haftalık', startDate: '2026-11-02', startTime: '10:00', endTime: '10:30', recurrence: { freq: 'weekly', interval: 2, count: 8, exdates: ['2026-11-16'] } });
    const out = roundTrip([a, b, c]);
    const byId = new Map(out.map((e) => [e.id, e]));

    const ra = byId.get('a-1');
    assert.equal(ra.title, a.title);
    assert.equal(ra.description, a.description);
    assert.equal(ra.category, 'Toplantı');
    assert.deepEqual([ra.startDate, ra.endDate, ra.startTime, ra.endTime], ['2026-11-20', '2026-11-20', '11:00', '12:30']);
    assert.deepEqual([ra.color, ra.status, ra.progress, ra.critical, ra.reminder], ['#ff8a4c', 'doing', 45, true, 60]);

    const rb = byId.get('b-2');
    assert.deepEqual([rb.startDate, rb.endDate, rb.startTime], ['2026-12-01', '2026-12-03', '']);
    assert.deepEqual(rb.dependencies, ['a-1']);

    const rc = byId.get('c-3');
    assert.deepEqual(rc.recurrence, { freq: 'weekly', interval: 2, until: '', count: 8, exdates: ['2026-11-16'] });
  });

  test('ayrılmış tek örnek seriye yeniden bağlanır', () => {
    const master = ev({ id: 'm1', title: 'Spor', startDate: '2026-11-02', startTime: '18:00', endTime: '19:00', recurrence: { freq: 'weekly', exdates: ['2026-11-09'] } });
    const single = ev({ id: 's1', title: 'Spor (kayık)', startDate: '2026-11-09', endDate: '2026-11-09', startTime: '20:00', endTime: '21:00', seriesId: 'm1', originalDate: '2026-11-09' });
    const out = roundTrip([master, single]);
    const rm = out.find((e) => e.id === 'm1');
    const rs = out.find((e) => e.seriesId === 'm1');
    assert.deepEqual(rm.recurrence.exdates, ['2026-11-09']);
    assert.equal(rs.originalDate, '2026-11-09');
    assert.equal(rs.startTime, '20:00');
    assert.equal(rs.recurrence, null);
  });

  test('aynı veritabanına yeniden içe aktarma çoğaltmaz, tek örnek kimliği korunur', () => {
    const master = ev({ id: 'm1', title: 'Spor', startDate: '2026-11-02', startTime: '18:00', endTime: '19:00', recurrence: { freq: 'weekly', exdates: ['2026-11-09'] } });
    const single = ev({ id: 's1', title: 'Spor (kayık)', startDate: '2026-11-09', endDate: '2026-11-09', startTime: '20:00', endTime: '21:00', seriesId: 'm1', originalDate: '2026-11-09' });
    const existing = [master, single];
    const { events } = parseICS(buildICS(existing, { now: NOW }));
    const plan = planImport(events, existing, NOW);
    assert.equal(plan.added.length, 0);
    assert.equal(plan.updated, 2);
    assert.deepEqual(plan.events.map((e) => e.id).sort(), ['m1', 's1']);
  });
});

/** Google/Outlook tarzı yabancı dosya. */
const FOREIGN = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Istanbul',
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0300',
  'END:STANDARD',
  'END:VTIMEZONE',
  // IANA dilimi: New York kışı (UTC-5) 09:00 → İstanbul 17:00
  'BEGIN:VEVENT',
  'UID:ny-1@google.com',
  'DTSTART;TZID=America/New_York:20261116T090000',
  'DTEND;TZID=America/New_York:20261116T100000',
  'SUMMARY:New York toplantısı',
  'END:VEVENT',
  // New York yazı (UTC-4) 09:00 → İstanbul 16:00
  'BEGIN:VEVENT',
  'UID:ny-2@google.com',
  'DTSTART;TZID=America/New_York:20270715T090000',
  'DTEND;TZID=America/New_York:20270715T100000',
  'SUMMARY:Yaz toplantısı',
  'END:VEVENT',
  // UTC
  'BEGIN:VEVENT',
  'UID:utc-1@google.com',
  'DTSTART:20261116T140000Z',
  'DTEND:20261116T150000Z',
  'SUMMARY:UTC etkinliği',
  'DESCRIPTION:Katlanmış açıklama, ilk satır\\n',
  ' ikinci satır',
  'END:VEVENT',
  // Outlook'un Windows saat dilimi adı
  'BEGIN:VEVENT',
  'UID:win-1@outlook.com',
  'DTSTART;TZID=Turkey Standard Time:20261117T143000',
  'DURATION:PT45M',
  'SUMMARY:Windows dilimi',
  'BEGIN:VALARM',
  'TRIGGER:-PT10M',
  'ACTION:DISPLAY',
  'DESCRIPTION:Reminder',
  'END:VALARM',
  'END:VEVENT',
  // Tanınmayan dilim → yerel saat varsayılır
  'BEGIN:VEVENT',
  'UID:odd-1@x',
  'DTSTART;TZID=Mars Standard Time:20261118T100000',
  'DTEND;TZID=Mars Standard Time:20261118T110000',
  'SUMMARY:Garip dilim',
  'END:VEVENT',
  // Tüm gün, çok günlü
  'BEGIN:VEVENT',
  'UID:allday-1@google.com',
  'DTSTART;VALUE=DATE:20261120',
  'DTEND;VALUE=DATE:20261123',
  'SUMMARY:Tatil',
  'END:VEVENT',
  // Gece yarısında biten
  'BEGIN:VEVENT',
  'UID:late-1@google.com',
  'DTSTART:20261119T190000Z',
  'DTEND:20261119T210000Z',
  'SUMMARY:Gece yarısı biter',
  'END:VEVENT',
  // İptal edilmiş
  'BEGIN:VEVENT',
  'UID:cancel-1@google.com',
  'DTSTART:20261121T100000Z',
  'STATUS:CANCELLED',
  'SUMMARY:İptal',
  'END:VEVENT',
  // Desteklenen seri: haftalık + başlangıç günü (Pazartesi 2 Kas 2026)
  'BEGIN:VEVENT',
  'UID:series-1@google.com',
  'DTSTART;TZID=Europe/Istanbul:20261102T093000',
  'DTEND;TZID=Europe/Istanbul:20261102T100000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T205959Z',
  'EXDATE;TZID=Europe/Istanbul:20261116T093000',
  'SUMMARY:Haftalık sync',
  'END:VEVENT',
  // Seriden değişen tek örnek
  'BEGIN:VEVENT',
  'UID:series-1@google.com',
  'RECURRENCE-ID;TZID=Europe/Istanbul:20261109T093000',
  'DTSTART;TZID=Europe/Istanbul:20261109T140000',
  'DTEND;TZID=Europe/Istanbul:20261109T143000',
  'SUMMARY:Haftalık sync (taşındı)',
  'END:VEVENT',
  // Desteklenmeyen: haftanın birden çok günü
  'BEGIN:VEVENT',
  'UID:multi-1@google.com',
  'DTSTART:20261102T080000Z',
  'DTEND:20261102T083000Z',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
  'SUMMARY:Pzt-Çar-Cum',
  'END:VEVENT',
  // Desteklenmeyen: ayın 2. salısı
  'BEGIN:VEVENT',
  'UID:nth-1@google.com',
  'DTSTART;VALUE=DATE:20261110',
  'RRULE:FREQ=MONTHLY;BYDAY=2TU',
  'SUMMARY:Ayın 2. salısı',
  'END:VEVENT',
  // Geçersiz: DTSTART yok
  'BEGIN:VEVENT',
  'UID:bad-1@x',
  'SUMMARY:Tarihsiz',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parseICS (yabancı dosya)', () => {
  const { events, stats } = parseICS(FOREIGN);
  const by = (title) => events.find((e) => e.title === title);

  test('saat dilimleri yerel saate (UTC+3) çevrilir', () => {
    assert.deepEqual([by('New York toplantısı').startDate, by('New York toplantısı').startTime, by('New York toplantısı').endTime], ['2026-11-16', '17:00', '18:00']);
    assert.equal(by('Yaz toplantısı').startTime, '16:00'); // yaz saati (UTC-4) doğru uygulanır
    assert.equal(by('UTC etkinliği').startTime, '17:00');
    assert.equal(by('Windows dilimi').startTime, '14:30');
    assert.equal(by('Windows dilimi').endTime, '15:15'); // DURATION:PT45M
    assert.equal(by('Garip dilim').startTime, '10:00'); // yerel saat varsayıldı
    assert.equal(stats.unknownTimezone, 1);
  });

  test('metin kaçışı ve satır birleştirme', () => {
    assert.equal(by('UTC etkinliği').description, 'Katlanmış açıklama, ilk satır\nikinci satır');
  });

  test('tüm gün DTEND dışlayıcıdır; gece yarısında biten bir önceki gün 23:59 olur', () => {
    const t = by('Tatil');
    assert.deepEqual([t.startDate, t.endDate, t.startTime, t.endTime], ['2026-11-20', '2026-11-22', '', '']);
    const late = by('Gece yarısı biter'); // 22:00–00:00 yerel
    assert.deepEqual([late.startDate, late.endDate, late.startTime, late.endTime], ['2026-11-19', '2026-11-19', '22:00', '23:59']);
  });

  test('alarm en yakın hatırlatmaya yuvarlanır (10 dk → 5)', () => {
    assert.equal(by('Windows dilimi').reminder, 5);
  });

  test('iptal edilen ve geçersiz kayıtlar atlanır', () => {
    assert.equal(by('İptal'), undefined);
    assert.equal(by('Tarihsiz'), undefined);
    assert.equal(stats.skipped, 2);
    assert.equal(stats.total, 13);
  });

  test('desteklenen seri: kural, exdates ve tek örnek bağlantısı', () => {
    const s = by('Haftalık sync');
    assert.equal(s.recurrence.freq, 'weekly');
    assert.equal(s.recurrence.until, '2026-12-31');
    assert.deepEqual(s.recurrence.exdates.sort(), ['2026-11-09', '2026-11-16']);
    const single = by('Haftalık sync (taşındı)');
    assert.equal(single.seriesId, s.id);
    assert.equal(single.originalDate, '2026-11-09');
    assert.equal(single.startTime, '14:00');
    assert.equal(single.recurrence, null);
  });

  test('desteklenmeyen tekrar kuralları ilk örnek olarak eklenir ve sayılır', () => {
    assert.equal(by('Pzt-Çar-Cum').recurrence, null);
    assert.equal(by('Ayın 2. salısı').recurrence, null);
    assert.equal(stats.unsupportedRecurrence, 2);
  });

  test('aynı UID aynı kimliği üretir (yeniden içe aktarma çoğaltmaz)', () => {
    const again = parseICS(FOREIGN).events;
    assert.deepEqual(again.map((e) => e.id).sort(), events.map((e) => e.id).sort());
    assert.ok(events.every((e) => /^ics-[0-9a-z]+$/.test(e.id) || e.seriesId));
  });

  test('boş veya anlamsız metin hata vermeden boş döner', () => {
    assert.deepEqual(parseICS('').events, []);
    assert.deepEqual(parseICS('merhaba dünya').events, []);
    assert.deepEqual(parseICS('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nEND:VCALENDAR').events, []);
  });
});

describe('planImport', () => {
  const { events } = parseICS(FOREIGN);

  test('yabancı dosyadan gelen geçmiş etkinlikler tamamlandı, gelecektekiler yapılacak olur', () => {
    const { events: planned } = planImport(events, [], NOW); // NOW = 15 Kas 2026
    const get = (t) => planned.find((e) => e.title === t);
    assert.equal(get('New York toplantısı').status, undefined); // 16 Kas: gelecek → varsayılan (todo) normalizeEvent'te
    const past = parseICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:p1', 'DTSTART:20260101T100000Z', 'DTEND:20260101T110000Z', 'SUMMARY:Geçmiş', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')).events;
    const [done] = planImport(past, [], NOW).events;
    assert.deepEqual([done.status, done.progress], ['done', 100]);
  });

  test('mevcut kaydın durum/ilerleme/renk alanları korunur', () => {
    const { events: parsed } = parseICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:p1', 'DTSTART:20260101T100000Z', 'DTEND:20260101T110000Z', 'SUMMARY:Yeni başlık', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
    const local = ev({ id: parsed[0].id, title: 'Eski başlık', startDate: '2026-01-01', startTime: '13:00', endTime: '14:00', status: 'doing', progress: 30, color: '#22c3a6' });
    const plan = planImport(parsed, [local], NOW);
    const [merged] = plan.events;
    assert.equal(merged.title, 'Yeni başlık');
    assert.deepEqual([merged.status, merged.progress, merged.color], ['doing', 30, '#22c3a6']);
    assert.equal(plan.updated, 1);
    assert.deepEqual(plan.previous.map((e) => e.id), [local.id]);
  });

  test('desteklenmeyen kural, yerelde elle kurulmuş seriyi silmez ve exdates birleşir', () => {
    const { events: parsed } = parseICS(FOREIGN);
    const multi = parsed.find((e) => e.title === 'Pzt-Çar-Cum');
    const local = ev({ id: multi.id, title: 'Pzt-Çar-Cum', startDate: '2026-11-02', startTime: '11:00', endTime: '11:30', recurrence: { freq: 'daily' } });
    const [merged] = planImport([multi], [local], NOW).events;
    assert.equal(merged.recurrence.freq, 'daily');

    const series = parsed.find((e) => e.title === 'Haftalık sync');
    const localSeries = ev({ id: series.id, title: 'Haftalık sync', startDate: '2026-11-02', startTime: '09:30', endTime: '10:00', recurrence: { freq: 'weekly', exdates: ['2026-11-23'] } });
    const [m2] = planImport([series], [localSeries], NOW).events;
    assert.deepEqual([...m2.recurrence.exdates].sort(), ['2026-11-09', '2026-11-16', '2026-11-23']);
  });
});
