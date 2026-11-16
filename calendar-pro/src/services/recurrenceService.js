/**
 * recurrenceService.js — Tekrarlayan etkinlik kuralları. Saf fonksiyonlar (DOM/IndexedDB yok).
 *
 * Kural modeli (yalnızca ilk beş alan zorunludur; diğerleri isteğe bağlıdır ve yalnızca anlamlıysa saklanır):
 *   freq        'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 *   interval    her N gün/hafta/ay/çeyrek/yıl (1–365)
 *   until       'YYYY-MM-DD' | ''   bu tarihe (dahil) kadar
 *   count       0 = sınırsız; N = kuralın ürettiği ilk N tarih (eklenen tarihler sayılmaz)
 *   exdates     serinin üretmeyeceği tarihler (silinen, ayrı kayda dönüşen ya da başka güne alınan örnekler)
 *   rdates      elle EKLENEN tarihler (kuralın üretmediği; until/count'a bağlı değildir)
 *   weekdays    günlük: yalnızca bu günler (ör. iş günleri [1,2,3,4,5]; yoksa her gün) · haftalık: bu günlerde (yoksa başlangıç günü); 0 = Pazar … 6 = Cumartesi
 *   monthDay    aylık/çeyreklik/yıllık: ayın N. günü (1–31; kısa aylarda ayın son gününe kayar) ya da -1 = ayın son günü
 *   nth+weekday aylık/çeyreklik/yıllık: ayın N. haftasının X günü (nth: 1–5 ya da -1 = son; weekday: 0–6 ya da 'work' = iş günü Pzt–Cum)
 *   quarterMonth çeyreklik: çeyreğin kaçıncı ayı (1–3; yoksa başlangıç tarihinin çeyrek içindeki sırası)
 *   month       yıllık: ay (1–12; yoksa başlangıç ayı)
 * Desen alanları yoksa kural, başlangıç tarihiyle aynı gün/ay üzerinden tekrarlar (eski davranış).
 *
 * Tarihler: seri, başlangıç tarihinden (dahil) itibaren kuralın ürettiği tarihlerden oluşur; başlangıç tarihi kurala uymuyorsa (ör. başlangıç
 * Pazartesi, kural "Sal–Per") kendisi bir örnek DEĞİLDİR. Sonuç = (kuralın tarihleri ∪ rdates) \ exdates.
 * Bir tarihi başka güne almak = eski tarihi exdates'e, yenisini rdates'e yazmaktır.
 *
 * Veritabanında yalnızca "ana" (master) etkinlik saklanır; görünümler bir tarih aralığı için `expandEvents` ile sanal tekrarlar (occurrence) üretir.
 * Occurrence alanları: ana etkinliğin tüm alanları + { id, masterId, isRecurring, startDate, endDate, date }; tekrarlar için id = `${masterId}@${startDate}`.
 */
import { addDays, addDaysISO, diffDays, formatDate, isValidISODate, parseISODate, toISODate } from '../core/dateUtils.js';

export const FREQUENCIES = Object.freeze({
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  quarterly: 'Çeyreklik',
  yearly: 'Yıllık',
});

/** "Her N …" cümlesindeki birim (ek ile): Her 2 günde bir, 3 haftada bir … */
const UNIT_EVERY = { daily: 'günde', weekly: 'haftada', monthly: 'ayda', quarterly: 'çeyrekte', yearly: 'yılda' };
const UNIT_PLAIN = { daily: 'gün', weekly: 'hafta', monthly: 'ay', quarterly: 'çeyrek', yearly: 'yıl' };
export const UNIT_LABELS = UNIT_PLAIN;

export const WEEKDAY_SHORT = Object.freeze(['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']);
export const WEEKDAY_LONG = Object.freeze(['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']);
export const MONTH_NAMES = Object.freeze(['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']);
export const NTH_LABELS = Object.freeze({ 1: 'ilk', 2: 'ikinci', 3: 'üçüncü', 4: 'dördüncü', 5: 'beşinci', '-1': 'son' });
export const WORK_WEEKDAYS = Object.freeze([1, 2, 3, 4, 5]);

const NTH_VALUES = [1, 2, 3, 4, 5, -1];
const MAX_PERIODS = 20000; // tek bir üretimde taranacak en çok dönem (sonsuz döngüye karşı)
const MAX_COUNT = 5000;
const MAX_EXTRA_DATES = 1000;

const sortedUnique = (list) => [...new Set(list)].sort();

function intList(value, min, max) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= min && n <= max))].sort((a, b) => a - b);
}

/** Gelen değeri geçerli bir kurala dönüştürür; geçersizse null (tekrar yok). Anlamsız/boş desen alanları atılır. */
export function normalizeRecurrence(rule) {
  if (!rule || typeof rule !== 'object' || !FREQUENCIES[rule.freq]) return null;
  const freq = rule.freq;
  const out = {
    freq,
    interval: Math.min(365, Math.max(1, parseInt(rule.interval, 10) || 1)),
    until: isValidISODate(rule.until) ? rule.until : '',
    count: Math.min(MAX_COUNT, Math.max(0, parseInt(rule.count, 10) || 0)),
    exdates: Array.isArray(rule.exdates) ? sortedUnique(rule.exdates.filter(isValidISODate)) : [],
  };

  if (freq === 'daily' || freq === 'weekly') {
    const weekdays = intList(rule.weekdays, 0, 6);
    // Günlükte yedi günün hepsi = kısıt yok
    if (weekdays.length && !(freq === 'daily' && weekdays.length === 7)) out.weekdays = weekdays;
  } else {
    const nth = Number(rule.nth);
    const weekday = rule.weekday === 'work' ? 'work' : Number.isInteger(Number(rule.weekday)) && rule.weekday !== '' && rule.weekday !== null ? Number(rule.weekday) : NaN;
    if (NTH_VALUES.includes(nth) && (weekday === 'work' || (weekday >= 0 && weekday <= 6))) {
      out.nth = nth;
      out.weekday = weekday;
    } else {
      const monthDay = Number(rule.monthDay);
      if (monthDay === -1 || (Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= 31)) out.monthDay = monthDay;
    }
    if (freq === 'quarterly') {
      const q = Number(rule.quarterMonth);
      if ([1, 2, 3].includes(q)) out.quarterMonth = q;
    }
    if (freq === 'yearly') {
      const m = Number(rule.month);
      if (Number.isInteger(m) && m >= 1 && m <= 12) out.month = m;
    }
  }

  if (Array.isArray(rule.rdates)) {
    const rdates = sortedUnique(rule.rdates.filter(isValidISODate)).slice(0, MAX_EXTRA_DATES);
    if (rdates.length) out.rdates = rdates;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Açıklama (insan okunur)
// ---------------------------------------------------------------------------

const sameDays = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Haftanın günleri: Pazartesi başlangıçlı sıralı kısa adlar ("Pzt, Çar, Cum"); iş günleri ve hafta sonu özel adlandırılır. */
export function describeWeekdays(weekdays) {
  const days = [...weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (sameDays([...weekdays].sort((a, b) => a - b), WORK_WEEKDAYS)) return 'iş günleri (Pzt–Cum)';
  return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

/** Ay içindeki gün deseni: "ayın 15. günü", "ayın son günü", "ayın ilk Salı günü", "ayın son iş günü". */
export function describeMonthPattern(rule) {
  if (rule.nth && rule.weekday !== undefined) {
    const nth = NTH_LABELS[rule.nth];
    return rule.weekday === 'work' ? `ayın ${nth} iş günü` : `ayın ${nth} ${WEEKDAY_LONG[rule.weekday]} günü`;
  }
  if (rule.monthDay === -1) return 'ayın son günü';
  if (rule.monthDay) return `ayın ${rule.monthDay}. günü`;
  return '';
}

/** İnsan okunur açıklama: "Her 2 haftada bir · Pzt, Çar · 31 Aralık 2026 tarihine kadar" */
export function describeRecurrence(rule) {
  if (!rule) return 'Tekrar yok';
  const n = rule.interval || 1;
  const parts = [n === 1 ? `Her ${UNIT_PLAIN[rule.freq]}` : `Her ${n} ${UNIT_EVERY[rule.freq]} bir`];
  if (rule.freq === 'daily' && rule.weekdays?.length) parts.push(`yalnızca ${describeWeekdays(rule.weekdays)}`);
  else if (rule.freq === 'weekly' && rule.weekdays?.length) parts.push(describeWeekdays(rule.weekdays));
  else if (rule.freq !== 'daily' && rule.freq !== 'weekly') {
    if (rule.freq === 'quarterly' && rule.quarterMonth) parts.push(`çeyreğin ${rule.quarterMonth}. ayı`);
    if (rule.freq === 'yearly' && rule.month) parts.push(MONTH_NAMES[rule.month - 1]);
    const pattern = describeMonthPattern(rule);
    if (pattern) parts.push(pattern);
  }
  if (rule.until) parts.push(`${formatDate(rule.until)} tarihine kadar`);
  if (rule.count) parts.push(`${rule.count} kez`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Tarih üretimi
// ---------------------------------------------------------------------------

const daysInMonth = (year, month0) => new Date(year, month0 + 1, 0).getDate();
const isoOf = (year, month0, day) => toISODate(new Date(year, month0, day));

/** Ayın N. (ya da -1: son) `weekday` günü (0–6) ya da iş günü ('work'); yoksa null. */
function nthWeekdayOfMonth(year, month0, nth, weekday) {
  const total = daysInMonth(year, month0);
  if (weekday === 'work') {
    const days = [];
    for (let d = 1; d <= total; d++) {
      const wd = new Date(year, month0, d).getDay();
      if (wd >= 1 && wd <= 5) days.push(d);
    }
    const day = nth > 0 ? days[nth - 1] : days[days.length + nth];
    return day ? isoOf(year, month0, day) : null;
  }
  let day;
  if (nth > 0) {
    day = 1 + ((weekday - new Date(year, month0, 1).getDay() + 7) % 7) + (nth - 1) * 7;
  } else {
    day = total - ((new Date(year, month0, total).getDay() - weekday + 7) % 7);
  }
  return day >= 1 && day <= total ? isoOf(year, month0, day) : null;
}

/** Bir ayın kural deseninden doğan tarihi ([] ya da [tarih]). `month0` taşabilir (12 → ertesi yıl Ocak). */
function monthDates(year, month0, rule, start) {
  const first = new Date(year, month0, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  if (rule.nth && rule.weekday !== undefined) {
    const d = nthWeekdayOfMonth(y, m, rule.nth, rule.weekday);
    return d ? [d] : [];
  }
  const total = daysInMonth(y, m);
  const day = rule.monthDay === -1 ? total : Math.min(rule.monthDay || start.getDate(), total); // kısa aylarda ayın son gününe kayar
  return [isoOf(y, m, day)];
}

/** `i`. dönemin (gün/hafta/ay/çeyrek/yıl) kural tarihleri, artan sırada. Başlangıçtan önceki tarihler de dönebilir; çağıran eler. */
function periodDates(rule, start, i) {
  const step = i * rule.interval;
  switch (rule.freq) {
    case 'daily': {
      const d = addDays(start, step);
      if (rule.weekdays?.length && !rule.weekdays.includes(d.getDay())) return [];
      return [toISODate(d)];
    }
    case 'weekly': {
      const days = rule.weekdays?.length ? rule.weekdays : [start.getDay()];
      const monday = addDays(start, -((start.getDay() + 6) % 7) + step * 7); // hafta Pazartesi başlar
      return [1, 2, 3, 4, 5, 6, 0].filter((wd) => days.includes(wd)).map((wd) => toISODate(addDays(monday, (wd + 6) % 7)));
    }
    case 'monthly':
      return monthDates(start.getFullYear(), start.getMonth() + step, rule, start);
    case 'quarterly': {
      const quarterMonth = rule.quarterMonth || (start.getMonth() % 3) + 1;
      return monthDates(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3 + (quarterMonth - 1) + step * 3, rule, start);
    }
    case 'yearly':
      return monthDates(start.getFullYear() + step, rule.month ? rule.month - 1 : start.getMonth(), rule, start);
    default:
      return [];
  }
}

const monthsBetween = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();

/** `fromISO` tarihine yakın bir döneme hızlıca atlamak için başlangıç indeksi (count varsa baştan sayılması gerekir: 0). */
function firstPeriod(rule, start, fromISO) {
  if (rule.count) return 0;
  const from = parseISODate(fromISO);
  if (from <= start) return 0;
  const n = rule.interval;
  let periods = 0;
  switch (rule.freq) {
    case 'daily':
      periods = diffDays(start, from) / n;
      break;
    case 'weekly':
      periods = diffDays(start, from) / (7 * n);
      break;
    case 'monthly':
      periods = monthsBetween(start, from) / n;
      break;
    case 'quarterly':
      periods = monthsBetween(start, from) / (3 * n);
      break;
    case 'yearly':
      periods = (from.getFullYear() - start.getFullYear()) / n;
      break;
    default:
      break;
  }
  return Math.max(0, Math.floor(periods) - 1);
}

/** Kuralın ürettiği tarihler (exdates/rdates uygulanmadan), artan; until ve count'a uyar. `fromISO` yalnızca atlama ipucudur (öncesi de dönebilir). */
function* generate(rule, startISO, fromISO = startISO) {
  const start = parseISODate(startISO);
  const first = firstPeriod(rule, start, fromISO);
  let produced = 0;
  for (let p = 0; p < MAX_PERIODS; p++) {
    for (const date of periodDates(rule, start, first + p)) {
      if (date < startISO) continue;
      if (rule.until && date > rule.until) return;
      if (rule.count) {
        if (produced >= rule.count) return;
        produced++;
      }
      yield date;
    }
  }
}

/**
 * Kuralın ürettiği ilk `limit` tarih (exdates/rdates uygulanmadan): etkinlik formundaki "Tüm tarihler" listesi ve ICS için.
 * @returns {string[]}
 */
export function listRuleDates(rule, startISO, limit = 400) {
  const out = [];
  if (!rule) return out;
  for (const date of generate(rule, startISO)) {
    out.push(date);
    if (out.length >= limit) break;
  }
  return out;
}

/** Kuralın ürettiği ilk tarih (başlangıç tarihi kurala uymuyorsa ondan sonraki ilk uygun gün); üretilemezse başlangıç tarihi. */
export function firstRuleDate(rule, startISO) {
  return listRuleDates(rule, startISO, 1)[0] || startISO;
}

/** [fromISO, toISO] aralığındaki efektif tarihler: (kural ∪ rdates) \ exdates, artan ve tekil. */
export function ruleDatesInRange(rule, startISO, fromISO, toISO) {
  const excluded = new Set(rule.exdates || []);
  const out = new Set();
  for (const date of generate(rule, startISO, fromISO)) {
    if (date > toISO) break;
    if (date >= fromISO && !excluded.has(date)) out.add(date);
  }
  for (const date of rule.rdates || []) if (date >= fromISO && date <= toISO && !excluded.has(date)) out.add(date);
  return [...out].sort();
}

/**
 * Etkinlikleri [rangeStart, rangeEnd] (dahil) aralığındaki görünür örneklere açar.
 * @param {object[]} events Ana etkinlikler
 * @param {string} rangeStart YYYY-MM-DD
 * @param {string} rangeEnd YYYY-MM-DD
 */
export function expandEvents(events, rangeStart, rangeEnd) {
  const out = [];
  for (const ev of events) {
    if (!ev.recurrence) {
      if (ev.startDate <= rangeEnd && ev.endDate >= rangeStart) {
        out.push({ ...ev, masterId: ev.id, isRecurring: false });
      }
      continue;
    }
    const span = diffDays(ev.startDate, ev.endDate);
    // Çok günlü örneklerde, aralıktan önce başlayıp aralığa taşan örnekler de gelsin
    const windowStart = span > 0 ? addDaysISO(rangeStart, -span) : rangeStart;
    for (const occStart of ruleDatesInRange(ev.recurrence, ev.startDate, windowStart, rangeEnd)) {
      const occEnd = addDaysISO(occStart, span);
      if (occEnd < rangeStart) continue;
      out.push({
        ...ev,
        id: `${ev.id}@${occStart}`,
        masterId: ev.id,
        isRecurring: true,
        startDate: occStart,
        endDate: occEnd,
        date: occStart,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tüm seriyi başka güne kaydırma (görünümlerde bir örneği sürükleyip "Tüm seri" seçildiğinde)
// ---------------------------------------------------------------------------

/**
 * Serideki bir örnek `fromISO`'dan `toISO`'ya taşındığında kuralı, taşınan örnek yeni tarihe denk gelecek biçimde uyarlar:
 * hariç/eklenen tarihler aynı gün sayısı kadar kayar, haftanın günleri döner, ayın günü/haftası/ayı yeni tarihten alınır.
 * (Başlangıç tarihini çağıran kaydırır.)
 */
export function shiftRule(rule, fromISO, toISO) {
  const delta = diffDays(fromISO, toISO);
  if (!delta) return rule;
  const to = parseISODate(toISO);
  const out = {
    ...rule,
    exdates: (rule.exdates || []).map((d) => addDaysISO(d, delta)),
  };
  if (rule.rdates?.length) out.rdates = rule.rdates.map((d) => addDaysISO(d, delta));
  if (rule.weekdays?.length) out.weekdays = [...new Set(rule.weekdays.map((d) => (((d + delta) % 7) + 7) % 7))].sort((a, b) => a - b);
  if (rule.nth && rule.weekday !== undefined) {
    if (rule.weekday !== 'work') {
      out.weekday = to.getDay();
      const lastOfMonth = to.getDate() + 7 > daysInMonth(to.getFullYear(), to.getMonth());
      out.nth = rule.nth === -1 && lastOfMonth ? -1 : Math.ceil(to.getDate() / 7);
    }
  } else if (rule.monthDay && rule.monthDay !== -1) {
    out.monthDay = to.getDate();
  }
  if (rule.quarterMonth) out.quarterMonth = (to.getMonth() % 3) + 1;
  if (rule.month) out.month = to.getMonth() + 1;
  return out;
}
