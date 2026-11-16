/**
 * icsService.js — iCalendar (.ics, RFC 5545) dışa/içe aktarma. Saf fonksiyonlar: DOM ve IndexedDB kullanmaz.
 *
 * Dosya G/Ç'si (indirme, dosya seçme, veritabanına yazma) exportService.js içindedir.
 *
 * Dışa aktarma (buildICS)
 *  - Saatler "floating" (saat dilimsiz) yazılır: uygulama saatleri zaten yerel duvar saati olarak saklar; bu sayede
 *    tekrarlayan etkinlikler yaz/kış saati geçişinde kaymaz. Gmail/Outlook bunları takvimin saat dilimine göre yorumlar.
 *  - Tüm gün etkinliklerde DTEND, RFC gereği bitiş gününden bir sonraki gündür (exclusive).
 *  - Tekrar: RRULE (FREQ/INTERVAL/COUNT/UNTIL + BYDAY/BYMONTHDAY/BYMONTH/BYSETPOS desenleri; çeyreklik = FREQ=MONTHLY;INTERVAL=3N),
 *    EXDATE (silinen tarihler) ve RDATE (elle eklenen tarihler). DTSTART, kuralın ürettiği ilk tarihtir. Seriden ayrılmış tek örnekler
 *    aynı UID ile RECURRENCE-ID'li ayrı VEVENT olarak yazılır (bu durumda ana serinin EXDATE'inde yer almaz).
 *  - Hatırlatma: VALARM. Durum, ilerleme, renk, kritik, Gantt projesi ve bağımlılıklar yalnızca bu uygulamanın okuduğu
 *    X-CALENDAR-PRO-* / RELATED-TO alanlarıyla taşınır; diğer uygulamalar bunları yok sayar.
 *
 * İçe aktarma (parseICS + planImport)
 *  - Saat dilimleri yerel saate çevrilir: UTC ("Z"), IANA adları (Europe/Istanbul) ve Outlook'un Windows adları
 *    ("Turkey Standard Time"). Tanınmayan dilim yerel saat sayılır ve bildirilir.
 *  - Uygulamanın modelinde karşılığı olmayan tekrar kuralları (BYYEARDAY, "ayın her salısı", birden çok BYMONTHDAY vb.) yalnızca
 *    ilk örnek olarak eklenir ve bildirilir (bkz. convertRRule). Haftalık/günlük BYDAY listeleri, "ayın 2. salısı", "ayın son iş günü",
 *    BYMONTHDAY ve RDATE desteklenir.
 *  - Aynı UID tekrar içe aktarılırsa kayıt çoğalmaz, güncellenir (kimlik UID'den türetilir).
 */
import { addDaysISO, combineDateTime, diffDays, isValidISODate, pad, parseISODate, toISODate } from '../core/dateUtils.js';
import { eventEnd, normalizeEvent, REMINDER_OPTIONS, STATUSES } from '../core/eventModel.js';
import { firstRuleDate } from './recurrenceService.js';

const UID_DOMAIN = 'calendar-pro';
const OWN_UID = /^([A-Za-z0-9_-]{1,80})@calendar-pro$/;
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const REMINDERS = REMINDER_OPTIONS.map((o) => o.value).filter(Boolean); // 5, 15, 60
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Outlook'un Windows saat dilimi adları → IANA. Yalnızca yaygın olanlar; diğerleri "tanınmadı" sayılır. */
const WINDOWS_ZONES = Object.freeze({
  UTC: 'UTC',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'GTB Standard Time': 'Europe/Bucharest',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'Turkey Standard Time': 'Europe/Istanbul',
  'Russian Standard Time': 'Europe/Moscow',
  'Israel Standard Time': 'Asia/Jerusalem',
  'Egypt Standard Time': 'Africa/Cairo',
  'South Africa Standard Time': 'Africa/Johannesburg',
  'Arabic Standard Time': 'Asia/Baghdad',
  'Arab Standard Time': 'Asia/Riyadh',
  'India Standard Time': 'Asia/Calcutta',
  'China Standard Time': 'Asia/Shanghai',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
});

// ---------------------------------------------------------------------------
// Ortak yardımcılar
// ---------------------------------------------------------------------------

/** cyrb53 — kısa, deterministik, kriptografik olmayan özet (UID → kimlik). */
function hashString(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const localTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

// ---------------------------------------------------------------------------
// Dışa aktarma
// ---------------------------------------------------------------------------

const compactDate = (iso) => iso.replace(/-/g, '');
const localDateTime = (iso, time) => `${compactDate(iso)}T${time.replace(':', '')}00`;

/** ISO zaman damgasını UTC "YYYYMMDDTHHMMSSZ" biçimine çevirir; geçersizse yedeği kullanır. */
function utcStamp(value, fallback) {
  const d = new Date(value);
  return (Number.isNaN(d.getTime()) ? fallback : d).toISOString().replace(/[-:]|\.\d{3}/g, '');
}

const escapeText = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');

const encoder = new TextEncoder();

/** RFC 5545 satır katlama: satırlar en fazla 75 oktet; devam satırları boşlukla başlar. Çok baytlı karakterleri bölmez. */
function fold(line) {
  if (encoder.encode(line).length <= 75) return line;
  const out = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > 75) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n');
}

/** Tüm gün (time boş) ise VALUE=DATE, değilse floating tarih-saat. */
const dateProp = (name, iso, time) => (time ? `${name}:${localDateTime(iso, time)}` : `${name};VALUE=DATE:${compactDate(iso)}`);

const ICS_WORKDAYS = 'MO,TU,WE,TH,FR';
/** Haftanın günleri Pazartesi başlangıçlı sıralanır (RFC varsayılanı WKST=MO). */
const sortByMonday = (days) => [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

/**
 * RRULE satırı. Çeyreklik = her 3 ayda bir (FREQ=MONTHLY;INTERVAL=3N). Dışa aktarılan DTSTART, kuralın ürettiği İLK tarihtir (başlangıç tarihi
 * desene uymuyorsa ondan sonraki ilk uygun gün); böylece INTERVAL/BYDAY dönemleri tam olarak uygulamadakiyle örtüşür.
 * `firstDate`: bu ilk tarih (yıllık desenlerde BYMONTH'u türetmek için).
 */
function rruleLine(rec, allDay, firstDate) {
  const parts = [`FREQ=${rec.freq === 'quarterly' ? 'MONTHLY' : rec.freq.toUpperCase()}`];
  const interval = rec.freq === 'quarterly' ? rec.interval * 3 : rec.interval;
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if ((rec.freq === 'daily' || rec.freq === 'weekly') && rec.weekdays?.length) {
    parts.push(`BYDAY=${sortByMonday(rec.weekdays).map((d) => WEEKDAYS[d]).join(',')}`);
    if (rec.freq === 'weekly' && rec.interval > 1) parts.push('WKST=MO');
  } else if (rec.freq === 'monthly' || rec.freq === 'quarterly' || rec.freq === 'yearly') {
    // Yıllıkta BYMONTH açık yazılır; yoksa BYDAY/BYMONTHDAY tüm yıla yayılırdı
    if (rec.freq === 'yearly' && (rec.month || rec.nth || rec.monthDay)) parts.push(`BYMONTH=${rec.month || Number(firstDate.slice(5, 7))}`);
    if (rec.nth && rec.weekday !== undefined) {
      if (rec.weekday === 'work') parts.push(`BYDAY=${ICS_WORKDAYS}`, `BYSETPOS=${rec.nth}`);
      else parts.push(`BYDAY=${rec.nth}${WEEKDAYS[rec.weekday]}`);
    } else if (rec.monthDay) {
      parts.push(`BYMONTHDAY=${rec.monthDay === 31 ? -1 : rec.monthDay}`); // uygulamada 31, kısa aylarda ayın son günüdür
    }
  }
  // RFC: COUNT ve UNTIL birlikte kullanılamaz; ikisi de varsa COUNT yazılır.
  if (rec.count) parts.push(`COUNT=${rec.count}`);
  else if (rec.until) parts.push(`UNTIL=${compactDate(rec.until)}${allDay ? '' : 'T235959'}`); // UNTIL, DTSTART ile aynı türde olmalı
  return `RRULE:${parts.join(';')}`;
}

function eventLines(ev, ctx) {
  const allDay = !ev.startTime;
  const master = ev.seriesId && ev.originalDate ? ctx.byId.get(ev.seriesId) : null;
  const series = master?.recurrence ? master : null; // geçerli bir seriye bağlı ayrılmış örnek
  const out = [
    'BEGIN:VEVENT',
    `UID:${(series || ev).id}@${UID_DOMAIN}`,
    `DTSTAMP:${ctx.stamp}`,
    `CREATED:${utcStamp(ev.createdAt, ctx.now)}`,
    `LAST-MODIFIED:${utcStamp(ev.updatedAt, ctx.now)}`,
  ];
  // Tekrarlayan seride DTSTART, kuralın ürettiği ilk tarihtir (başlangıç tarihi desene uymayabilir: ör. Pazartesi başlayıp "Sal–Per")
  const firstDate = ev.recurrence ? firstRuleDate(ev.recurrence, ev.startDate) : ev.startDate;
  const shift = diffDays(ev.startDate, firstDate);
  const startDate = shift ? firstDate : ev.startDate;
  const endDate = shift ? addDaysISO(ev.endDate, shift) : ev.endDate;
  if (series) out.push(dateProp('RECURRENCE-ID', ev.originalDate, series.startTime));
  out.push(dateProp('DTSTART', startDate, ev.startTime));
  out.push(allDay ? dateProp('DTEND', addDaysISO(endDate, 1), '') : dateProp('DTEND', endDate, ev.endTime || ev.startTime));
  out.push(`SUMMARY:${escapeText(ev.title)}`);
  if (ev.description) out.push(`DESCRIPTION:${escapeText(ev.description)}`);
  if (ev.category) out.push(`CATEGORIES:${escapeText(ev.category)}`);

  if (ev.recurrence) {
    out.push(rruleLine(ev.recurrence, allDay, firstDate));
    const replaced = ctx.overridden.get(ev.id);
    const exdates = (ev.recurrence.exdates || []).filter((d) => !replaced?.has(d));
    if (exdates.length) {
      out.push(allDay ? `EXDATE;VALUE=DATE:${exdates.map(compactDate).join(',')}` : `EXDATE:${exdates.map((d) => localDateTime(d, ev.startTime)).join(',')}`);
    }
    const rdates = ev.recurrence.rdates || []; // elle eklenen tarihler
    if (rdates.length) {
      out.push(allDay ? `RDATE;VALUE=DATE:${rdates.map(compactDate).join(',')}` : `RDATE:${rdates.map((d) => localDateTime(d, ev.startTime)).join(',')}`);
    }
  }

  if (ev.reminder > 0) out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(ev.title)}`, `TRIGGER:-PT${ev.reminder}M`, 'END:VALARM');

  out.push(`X-CALENDAR-PRO-STATUS:${ev.status}`, `X-CALENDAR-PRO-PROGRESS:${ev.progress}`, `X-CALENDAR-PRO-COLOR:${ev.color}`);
  if (ev.critical) out.push('X-CALENDAR-PRO-CRITICAL:TRUE');
  if (ev.project) out.push(`X-CALENDAR-PRO-PROJECT:${escapeText(ev.project)}`);
  for (const dep of ev.dependencies || []) {
    const target = ctx.byId.get(dep);
    // Ayrılmış tek örneklerin UID'si serininkiyle aynı olduğu için onlara bağımlılık yazılmaz
    if (target && !ctx.isOverride(target)) out.push(`RELATED-TO;RELTYPE=DEPENDS-ON:${dep}@${UID_DOMAIN}`);
  }
  out.push('END:VEVENT');
  return out;
}

/**
 * Etkinlik kayıtlarını (ana kayıtlar; tekrarlar açılmaz) iCalendar metnine çevirir.
 * @param {object[]} events veritabanındaki ham etkinlikler
 * @param {{now?: Date, timeZone?: string}} [options]
 * @returns {string} CRLF satır sonlu .ics içeriği
 */
export function buildICS(events, { now = new Date(), timeZone = localTimeZone() } = {}) {
  const byId = new Map(events.map((e) => [e.id, e]));
  const isOverride = (e) => Boolean(e.seriesId && e.originalDate && byId.get(e.seriesId)?.recurrence);
  const overridden = new Map(); // anaId → tek örnekle değiştirilmiş tarihler (EXDATE'e yazılmaz)
  for (const e of events) {
    if (!isOverride(e)) continue;
    if (!overridden.has(e.seriesId)) overridden.set(e.seriesId, new Set());
    overridden.get(e.seriesId).add(e.originalDate);
  }
  const ctx = { byId, overridden, isOverride, now, stamp: utcStamp(now, now) };

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Calendar Pro//TR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Calendar Pro'];
  if (timeZone) lines.push(`X-WR-TIMEZONE:${timeZone}`);
  for (const ev of events) lines.push(...eventLines(ev, ctx));
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// ---------------------------------------------------------------------------
// İçe aktarma: satır/özellik ayrıştırma
// ---------------------------------------------------------------------------

/** `sep` karakterinde böler; çift tırnak içindekileri yok sayar. */
function splitOutsideQuotes(str, sep) {
  const parts = [];
  let inQuote = false;
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '"') inQuote = !inQuote;
    else if (str[i] === sep && !inQuote) {
      parts.push(str.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(str.slice(start));
  return parts;
}

/** "NAME;PARAM=değer:değer" satırını { name, params, value } olarak ayırır. */
function parseLine(line) {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuote = !inQuote;
    else if (line[i] === ':' && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 1) return null;
  const [name, ...rawParams] = splitOutsideQuotes(line.slice(0, colon), ';');
  const params = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.trim().toUpperCase(), params, value: line.slice(colon + 1) };
}

const addProp = (map, prop) => {
  const list = map.get(prop.name);
  if (list) list.push(prop);
  else map.set(prop.name, [prop]);
};
const first = (props, name) => props.get(name)?.[0];
const all = (props, name) => props.get(name) ?? [];

/** Metindeki VEVENT bileşenlerini { props, alarms } olarak toplar (VTIMEZONE, VTODO vb. yok sayılır). */
function collectEvents(text) {
  // Satır birleştirme: CRLF + tek boşluk/sekme devam satırıdır
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const stack = [];
  const events = [];
  let ev = null;
  let alarm = null;
  for (const line of lines) {
    const prop = line ? parseLine(line) : null;
    if (!prop) continue;
    if (prop.name === 'BEGIN') {
      const type = prop.value.trim().toUpperCase();
      stack.push(type);
      if (type === 'VEVENT') ev = { props: new Map(), alarms: [] };
      else if (type === 'VALARM' && ev) alarm = { props: new Map() };
    } else if (prop.name === 'END') {
      const type = prop.value.trim().toUpperCase();
      const idx = stack.lastIndexOf(type);
      if (idx !== -1) stack.length = idx;
      if (type === 'VALARM' && alarm && ev) ev.alarms.push(alarm);
      if (type === 'VALARM') alarm = null;
      if (type === 'VEVENT' && ev) {
        events.push(ev);
        ev = null;
      }
    } else {
      const top = stack[stack.length - 1];
      if (top === 'VEVENT' && ev) addProp(ev.props, prop);
      else if (top === 'VALARM' && alarm) addProp(alarm.props, prop);
    }
  }
  return events;
}

const unescapeText = (s) => String(s ?? '').replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));

// ---------------------------------------------------------------------------
// İçe aktarma: tarih/saat ve saat dilimi
// ---------------------------------------------------------------------------

const zoneCache = new Map(); // TZID → IANA adı | null
const formatterCache = new Map();

function zoneFormatter(zone) {
  let f = formatterCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    formatterCache.set(zone, f);
  }
  return f;
}

/** TZID'yi tarayıcının tanıdığı bir IANA adına çözer; çözemezse null. */
function resolveZone(tzid) {
  if (zoneCache.has(tzid)) return zoneCache.get(tzid);
  const candidates = [tzid, WINDOWS_ZONES[tzid], tzid.split('/').slice(-2).join('/')];
  let found = null;
  for (const name of candidates) {
    if (!name) continue;
    try {
      zoneFormatter(name);
      found = name;
      break;
    } catch {
      // bu aday geçersiz; sıradakini dene
    }
  }
  zoneCache.set(tzid, found);
  return found;
}

/** `zone` diliminin verilen UTC anındaki UTC'den farkı (dakika). */
function zoneOffsetMinutes(zone, ms) {
  const p = {};
  for (const part of zoneFormatter(zone).formatToParts(new Date(ms))) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - ms) / 60000);
}

/** `zone` diliminde duvar saati olarak verilen anı gerçek ana çevirir (yaz/kış saati için iki geçişli). */
function wallToInstant(y, mo, d, h, mi, zone) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const guess = wall - zoneOffsetMinutes(zone, wall) * 60000;
  return new Date(wall - zoneOffsetMinutes(zone, guess) * 60000);
}

const fromInstant = (d) => ({ date: toISODate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, dateOnly: false });

const DATE_TIME_RE = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i;

/**
 * DTSTART/DTEND/EXDATE/RECURRENCE-ID değerini yerel tarih/saate çevirir.
 * @returns {{date: string, time: string, dateOnly: boolean}|null}
 */
function parseDateTime({ value, params }, ctx) {
  const m = DATE_TIME_RE.exec(String(value).trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  const date = `${y}-${mo}-${d}`;
  if (!isValidISODate(date)) return null;
  if (h === undefined) return { date, time: '', dateOnly: true };
  if (+h > 23 || +mi > 59) return null;
  if (z) return fromInstant(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)));
  if (params.TZID) {
    const zone = resolveZone(params.TZID);
    if (zone) return fromInstant(wallToInstant(+y, +mo, +d, +h, +mi, zone));
    ctx.tzUnknown = true; // tanınmayan dilim: yerel saat varsay
  }
  return { date, time: `${h}:${mi}`, dateOnly: false };
}

/** ISO 8601 süresi → dakika (negatif olabilir). Geçersizse null. */
function parseDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(String(value).trim());
  if (!m) return null;
  const [, sign, w = 0, d = 0, h = 0, mi = 0, s = 0] = m;
  const minutes = (+w * 7 + +d) * 1440 + +h * 60 + +mi + Math.floor(+s / 60);
  return sign === '-' ? -minutes : minutes;
}

// ---------------------------------------------------------------------------
// İçe aktarma: tekrar, hatırlatma, etkinlik dönüştürme
// ---------------------------------------------------------------------------

const ICS_DAY_NUMBERS = Object.fromEntries(WEEKDAYS.map((code, i) => [code, i]));
const NTH_ALLOWED = [1, 2, 3, 4, 5, -1];

/** "MO,TU" / "2TU" / "-1FR" → [{ n, day }]; geçersiz öğe varsa null. */
function parseByDay(value) {
  const out = [];
  for (const token of value.split(',')) {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token.trim());
    if (!m) return null;
    out.push({ n: m[1] ? Number(m[1]) : 0, day: ICS_DAY_NUMBERS[m[2]] });
  }
  return out;
}

const sameNumbers = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * RRULE'u uygulamanın modeline çevirir (bkz. recurrenceService.js): FREQ/INTERVAL/COUNT/UNTIL ve
 *  - günlük/haftalık + BYDAY (günlerin listesi),
 *  - aylık/yıllık + BYMONTHDAY (tek gün ya da -1 = son gün), BYDAY=2TU / -1FR (ayın N. haftasının X günü),
 *    BYDAY=MO,TU,WE,TH,FR + BYSETPOS=N (ayın N. iş günü), yıllıkta BYMONTH (tek ay),
 *  - FREQ=YEARLY + BYMONTH=m,m+3,m+6,m+9 → çeyreklik.
 * Başlangıç tarihinden türetilebilen değerler (haftalıkta başlangıç günü, ayın başlangıç günü, başlangıç ayı) kurala yazılmaz.
 * Gerisi (BYYEARDAY, ayda her Salı, birden çok BYMONTHDAY …) desteklenmez.
 * @returns {object|null} desteklenmiyorsa null
 */
function convertRRule(value, startDate, ctx) {
  const rule = {};
  for (const part of String(value).split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) rule[part.slice(0, eq).trim().toUpperCase()] = part.slice(eq + 1).trim().toUpperCase();
  }
  let freq = rule.FREQ?.toLowerCase();
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(freq)) return null;
  if (['BYYEARDAY', 'BYWEEKNO', 'BYHOUR', 'BYMINUTE', 'BYSECOND'].some((k) => k in rule)) return null;
  if ('BYSETPOS' in rule && !(freq === 'monthly' || freq === 'yearly')) return null;

  let until = '';
  if (rule.UNTIL) {
    const parsed = parseDateTime({ value: rule.UNTIL, params: {} }, ctx);
    if (!parsed) return null;
    until = parsed.date;
  }
  const out = { freq, interval: Math.max(1, parseInt(rule.INTERVAL, 10) || 1), until, count: Math.max(0, parseInt(rule.COUNT, 10) || 0) };

  const start = parseISODate(startDate);
  const days = 'BYDAY' in rule ? parseByDay(rule.BYDAY) : null;
  if ('BYDAY' in rule && !days) return null;

  if (freq === 'daily' || freq === 'weekly') {
    if ('BYMONTHDAY' in rule || 'BYMONTH' in rule || days?.some((d) => d.n)) return null;
    if (days) {
      const weekdays = [...new Set(days.map((d) => d.day))].sort((a, b) => a - b);
      const startOnly = freq === 'weekly' && weekdays.length === 1 && weekdays[0] === start.getDay();
      if (!startOnly && weekdays.length < 7) out.weekdays = weekdays;
    }
    return out;
  }

  // aylık / yıllık
  if ('BYMONTH' in rule) {
    const months = rule.BYMONTH.split(',').map(Number);
    if (months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) return null;
    if (freq === 'monthly') return null;
    if (months.length === 1) {
      if (months[0] !== start.getMonth() + 1) out.month = months[0];
    } else if (out.interval === 1 && months.length === 4 && months[0] <= 3 && sameNumbers(months, [0, 3, 6, 9].map((b) => b + months[0]))) {
      out.freq = 'quarterly';
      out.quarterMonth = months[0];
    } else return null;
  }
  if ('BYMONTHDAY' in rule) {
    const values = rule.BYMONTHDAY.split(',').map(Number);
    const md = values[0];
    if (values.length !== 1 || days || 'BYSETPOS' in rule || !(md === -1 || (Number.isInteger(md) && md >= 1 && md <= 31))) return null;
    if (md !== start.getDate()) out.monthDay = md;
  } else if (days) {
    const pos = 'BYSETPOS' in rule ? Number(rule.BYSETPOS) : 0;
    if ('BYSETPOS' in rule) {
      if (!NTH_ALLOWED.includes(pos) || days.some((d) => d.n)) return null;
      if (days.length === 1) Object.assign(out, { nth: pos, weekday: days[0].day });
      else if (sameNumbers(days.map((d) => d.day), [1, 2, 3, 4, 5])) Object.assign(out, { nth: pos, weekday: 'work' });
      else return null;
    } else {
      if (days.length !== 1 || !NTH_ALLOWED.includes(days[0].n)) return null; // ayda her Salı gibi sıra numarasız kurallar desteklenmez
      Object.assign(out, { nth: days[0].n, weekday: days[0].day });
    }
  } else if ('BYSETPOS' in rule) return null;
  return out;
}

const nearestReminder = (minutes) => REMINDERS.reduce((best, v) => (Math.abs(v - minutes) < Math.abs(best - minutes) ? v : best));

/** İlk geçerli "başlamadan önce" alarmını 5/15/60 dakikadan en yakınına yuvarlar; yoksa 0. */
function reminderFromAlarms(alarms) {
  for (const alarm of alarms) {
    const trigger = first(alarm.props, 'TRIGGER');
    if (!trigger || trigger.params.VALUE === 'DATE-TIME' || trigger.params.RELATED === 'END') continue;
    const minutes = parseDuration(trigger.value);
    if (minutes === null || minutes > 0) continue; // başlangıçtan sonraki alarmlar desteklenmez
    return nearestReminder(-minutes);
  }
  return 0;
}

function collectDates(raw, ctx, name) {
  const dates = new Set();
  for (const prop of all(raw.props, name)) {
    if ((prop.params.VALUE || '').toUpperCase() === 'PERIOD') continue; // süre aralıklı RDATE desteklenmez
    for (const v of prop.value.split(',')) {
      const parsed = parseDateTime({ value: v, params: prop.params }, ctx);
      if (parsed) dates.add(parsed.date);
    }
  }
  return [...dates].sort();
}

const collectExdates = (raw, ctx) => collectDates(raw, ctx, 'EXDATE');

/** Tek bir VEVENT'i etkinlik alanlarına çevirir (kimlik hariç). Geçersizse null. */
function convertEvent(raw, ctx, stats, { override = false } = {}) {
  ctx.tzUnknown = false;
  const startProp = first(raw.props, 'DTSTART');
  const start = startProp && parseDateTime(startProp, ctx);
  if (!start) return null;

  let endDate = start.date;
  let endTime = '';
  const endProp = first(raw.props, 'DTEND');
  const durationProp = first(raw.props, 'DURATION');
  if (endProp) {
    const end = parseDateTime(endProp, ctx);
    if (end) {
      if (start.dateOnly) endDate = end.dateOnly ? addDaysISO(end.date, -1) : end.date; // tüm gün DTEND: bitişten sonraki gün
      else {
        endDate = end.date;
        endTime = end.time;
      }
    }
  } else if (durationProp) {
    const minutes = parseDuration(durationProp.value);
    if (minutes !== null) {
      if (start.dateOnly) endDate = addDaysISO(start.date, Math.max(1, Math.ceil(minutes / 1440)) - 1);
      else {
        const e = combineDateTime(start.date, start.time);
        e.setMinutes(e.getMinutes() + minutes);
        endDate = toISODate(e);
        endTime = `${pad(e.getHours())}:${pad(e.getMinutes())}`;
      }
    }
  }
  // Gece yarısında biten saatli etkinlik (22:00–00:00) bir önceki günün 23:59'unda biter
  if (!start.dateOnly && endTime === '00:00' && endDate > start.date) {
    endDate = addDaysISO(endDate, -1);
    endTime = '23:59';
  }
  if (endDate < start.date) endDate = start.date;

  const rec = {
    title: unescapeText(first(raw.props, 'SUMMARY')?.value),
    description: unescapeText(first(raw.props, 'DESCRIPTION')?.value),
    startDate: start.date,
    endDate,
    startTime: start.time,
    endTime: start.dateOnly ? '' : endTime,
    category: unescapeText((first(raw.props, 'CATEGORIES')?.value ?? '').split(/(?<!\\),/)[0]).trim(),
    reminder: reminderFromAlarms(raw.alarms),
    recurrence: null,
  };

  if (!override) {
    const rrule = first(raw.props, 'RRULE');
    const hasRdate = Boolean(first(raw.props, 'RDATE'));
    // RRULE yoksa ama RDATE varsa: yalnızca başlangıç tarihi + eklenen tarihler (1 tekrarlık günlük kural)
    const rule = rrule ? convertRRule(rrule.value, start.date, ctx) : hasRdate ? { freq: 'daily', interval: 1, until: '', count: 1 } : null;
    if (rule) {
      rec.recurrence = { ...rule, exdates: collectExdates(raw, ctx) };
      const rdates = collectDates(raw, ctx, 'RDATE');
      if (rdates.length) rec.recurrence.rdates = rdates;
    } else if (rrule) {
      stats.unsupportedRecurrence++; // yalnızca ilk örnek eklenir
      rec.recurrenceUnsupported = true;
    }
  }

  // Bu uygulamanın kendi dışa aktarımı: durum/ilerleme/renk/kritik geri yüklenir. Yabancı dosyalarda bu alanlar yoktur.
  const ownStatus = first(raw.props, 'X-CALENDAR-PRO-STATUS');
  if (ownStatus) {
    const status = ownStatus.value.trim().toLowerCase();
    const progress = Number(first(raw.props, 'X-CALENDAR-PRO-PROGRESS')?.value);
    const color = first(raw.props, 'X-CALENDAR-PRO-COLOR')?.value.trim();
    rec.status = STATUSES.includes(status) ? status : 'todo';
    rec.progress = Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : 0;
    if (color && COLOR_RE.test(color)) rec.color = color;
    rec.critical = first(raw.props, 'X-CALENDAR-PRO-CRITICAL')?.value.trim().toUpperCase() === 'TRUE';
    const project = unescapeText(first(raw.props, 'X-CALENDAR-PRO-PROJECT')?.value).trim();
    if (project) rec.project = project.slice(0, 80);
  }
  const dependsOn = all(raw.props, 'RELATED-TO')
    .filter((p) => (p.params.RELTYPE || '').toUpperCase() === 'DEPENDS-ON')
    .map((p) => p.value.trim());
  if (dependsOn.length) rec.dependsOn = dependsOn;

  if (ctx.tzUnknown) stats.unknownTimezone++;
  return rec;
}

const uidOf = (raw) => {
  const uid = first(raw.props, 'UID')?.value.trim();
  return uid || `noid|${first(raw.props, 'SUMMARY')?.value ?? ''}|${first(raw.props, 'DTSTART')?.value ?? ''}`;
};
const idFromUid = (uid) => OWN_UID.exec(uid)?.[1] ?? `ics-${hashString(uid)}`;
const isCancelled = (raw) => first(raw.props, 'STATUS')?.value.trim().toUpperCase() === 'CANCELLED';

/**
 * .ics metnini etkinlik kayıtlarına çevirir.
 * @param {string} text
 * @returns {{events: object[], stats: {total: number, skipped: number, unsupportedRecurrence: number, unknownTimezone: number}}}
 *   events: normalizeEvent'e verilebilecek ham kayıtlar. Yalnızca dosyada bulunan alanlar yer alır; durum/ilerleme/renk/
 *   kritik/bağımlılık alanları dosyada yoksa hiç eklenmez (planImport mevcut kaydın değerlerini korur).
 */
export function parseICS(text) {
  const raws = collectEvents(String(text));
  const stats = { total: raws.length, skipped: 0, unsupportedRecurrence: 0, unknownTimezone: 0 };
  const ctx = { tzUnknown: false };
  const items = raws.map((raw) => ({ raw, uid: uidOf(raw), recurrenceId: first(raw.props, 'RECURRENCE-ID'), cancelled: isCancelled(raw) }));

  const masters = new Map(); // UID → kayıt (RECURRENCE-ID'siz olanlar)
  for (const it of items) {
    if (it.recurrenceId) continue;
    if (it.cancelled) {
      stats.skipped++;
      continue;
    }
    const rec = convertEvent(it.raw, ctx, stats);
    if (!rec) {
      stats.skipped++;
      continue;
    }
    rec.id = idFromUid(it.uid);
    masters.set(it.uid, rec);
  }

  // Tek örnek değişiklikleri (RECURRENCE-ID): desteklenen bir seriye bağlanır, yoksa bağımsız etkinlik olur
  const singles = [];
  for (const it of items) {
    if (!it.recurrenceId) continue;
    const master = masters.get(it.uid);
    ctx.tzUnknown = false;
    const origin = parseDateTime(it.recurrenceId, ctx);
    const linked = Boolean(master?.recurrence && origin);
    if (it.cancelled) {
      if (linked) master.recurrence.exdates.push(origin.date);
      else stats.skipped++;
      continue;
    }
    const rec = convertEvent(it.raw, ctx, stats, { override: true });
    if (!rec) {
      stats.skipped++;
      continue;
    }
    if (linked) {
      rec.id = `${master.id}-r${origin.date}`;
      rec.seriesId = master.id;
      rec.originalDate = origin.date;
      master.recurrence.exdates.push(origin.date);
    } else {
      rec.id = `ics-${hashString(`${it.uid}|${origin?.date ?? ''}`)}`;
    }
    singles.push(rec);
  }

  const uidToId = new Map([...masters].map(([uid, rec]) => [uid, rec.id]));
  const events = [...masters.values(), ...singles];
  for (const rec of events) {
    if (!rec.dependsOn) continue;
    rec.dependencies = rec.dependsOn.map((uid) => uidToId.get(uid)).filter(Boolean);
    delete rec.dependsOn;
  }
  return { events, stats };
}

/**
 * Ayrıştırılmış kayıtları mevcut verilerle birleştirme planına çevirir (yazma yapmaz).
 *  - Aynı kimlikli kayıt güncellenir; dosyada olmayan uygulama alanları (durum, ilerleme, renk, kritik, bağımlılık) korunur.
 *  - Yabancı dosyadan gelen yeni ve geçmişte kalmış etkinlikler "Tamamlandı" olur; aksi halde hepsi "geciken" sayılırdı.
 *  - Seriden ayrılmış bir tek örnek zaten varsa (aynı seri + özgün tarih) kimliği korunur, çoğalmaz.
 * @param {object[]} parsed parseICS().events
 * @param {object[]} existing mevcut ham etkinlikler
 * @returns {{events: object[], added: string[], updated: number, previous: object[]}}
 *   events: kaydedilecek kayıtlar; added: yeni kimlikler; previous: üzerine yazılan eski kayıtlar (geri alma için)
 */
export function planImport(parsed, existing, now = new Date()) {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const singleIds = new Map(existing.filter((e) => e.seriesId && e.originalDate).map((e) => [`${e.seriesId}|${e.originalDate}`, e.id]));
  const events = [];
  const added = [];
  const previous = [];

  for (const p of parsed) {
    const { recurrenceUnsupported, ...rest } = p;
    const fields = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const id = (p.seriesId && singleIds.get(`${p.seriesId}|${p.originalDate}`)) || p.id;
    const prev = byId.get(id);
    const merged = { ...(prev || {}), ...fields, id };

    if (prev) {
      if (prev.recurrence && fields.recurrence) {
        // Yerelde silinmiş (exdates) ve eklenmiş (rdates) tarihleri kaybetmemek için birleştir
        merged.recurrence = { ...fields.recurrence, exdates: [...new Set([...(prev.recurrence.exdates || []), ...fields.recurrence.exdates])] };
        const rdates = [...new Set([...(prev.recurrence.rdates || []), ...(fields.recurrence.rdates || [])])].sort();
        if (rdates.length) merged.recurrence.rdates = rdates;
      } else if (prev.recurrence && recurrenceUnsupported) {
        merged.recurrence = prev.recurrence; // yerelde elle kurulmuş seriyi, desteklenmeyen kuralla silme
      }
      previous.push(prev);
    } else {
      added.push(id);
      if (fields.status === undefined && !merged.recurrence && eventEnd(normalizeEvent(merged)) < now) {
        merged.status = 'done';
        merged.progress = 100;
      }
    }
    events.push(merged);
  }
  return { events, added, updated: events.length - added.length, previous };
}
