/**
 * recurrenceEditor.js — Etkinlik formundaki "Tekrar" bölümü.
 *
 * createRecurrenceEditor({ recurrence, getStartDate, settings, detached }) → { el, getRule, refresh, onStartChange }
 *
 *  - Sıklık: Tekrar yok · Günlük · Haftalık · Aylık · Çeyreklik · Yıllık, "her N …" aralığı.
 *  - Desen (sıklığa göre):
 *      günlük     → hangi günler (Her gün / İş günleri / belirli günler)
 *      haftalık   → haftanın belirli günleri (çoklu seçim; seçilmezse başlangıç günü)
 *      aylık      → ayın N. günü (ya da son günü) VEYA ayın N. haftasının X günü (ilk/ikinci/…/son; X: hafta içi günler ya da "iş günü")
 *      çeyreklik  → çeyreğin 1./2./3. ayı + aylık deseni
 *      yıllık     → ay + aylık deseni
 *    Seçilmeyen ("otomatik") alanlar başlangıç tarihini izler: başlangıç değişirse haftanın günü / ayın günü / ay da değişir ve kuralda saklanmaz.
 *  - Bitiş: yok · tarihte · N tekrar.
 *  - Canlı özet ve "Tüm tarihler" listesi: kuralın ürettiği tarihler (sonsuz serilerde 24'er 24'er) tek tek DEĞİŞTİRİLEBİLİR (başka güne alınır),
 *    SİLİNEBİLİR (geri alınabilir) ve yeni tarih EKLENEBİLİR. Bunlar kuralın exdates / rdates alanlarına yazılır (bkz. recurrenceService.js).
 *    Bir tarihin saatini/içeriğini değiştirmek için o tarihin etkinliğinde "Yalnızca bu" kapsamı kullanılır.
 */
import { html } from '../core/dom.js';
import { formatDate, isValidISODate, parseISODate, todayISO } from '../core/dateUtils.js';
import { normalizeWorkDays, orderedWeekdays } from '../core/workDays.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import {
  describeRecurrence,
  FREQUENCIES,
  listRuleDates,
  MONTH_NAMES,
  normalizeRecurrence,
  NTH_LABELS,
  ruleDatesInRange,
  UNIT_LABELS,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
} from '../services/recurrenceService.js';

const PAGE = 24; // sonsuz serilerde listenin sayfa boyutu
const NTH_OPTIONS = [1, 2, 3, 4, -1];
const dateLabel = (iso) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function createRecurrenceEditor({ recurrence, getStartDate, settings = {}, detached = {} }) {
  const init = recurrence || null;
  const st = {
    freq: init?.freq || '',
    interval: init?.interval || 1,
    endMode: init?.count ? 'count' : init?.until ? 'until' : 'never',
    until: init?.until || '',
    count: init?.count || 10,
    weekdays: init?.weekdays ? [...init.weekdays] : null, // null = otomatik (günlük: her gün · haftalık: başlangıç günü)
    mode: init?.nth ? 'weekday' : 'day',
    monthDay: init?.monthDay ?? null, // null = başlangıç tarihinin günü
    nth: init?.nth ?? 0, // 0 = henüz seçilmedi (haftanın günü kipine geçilirken başlangıç tarihinden türetilir)
    weekday: init?.weekday ?? null,
    quarterMonth: init?.quarterMonth ?? null,
    month: init?.month ?? null,
    exdates: [...(init?.exdates ?? [])],
    rdates: [...(init?.rdates ?? [])],
    limit: PAGE,
    editing: '', // "Değiştir" satırındaki tarih
  };

  const el = document.createElement('fieldset');
  el.className = 'field-group rec series-only';

  const startISO = () => (isValidISODate(getStartDate()) ? getStartDate() : todayISO());
  const startD = () => parseISODate(startISO());
  const effMonthDay = () => st.monthDay ?? startD().getDate();
  const effQuarterMonth = () => st.quarterMonth ?? (startD().getMonth() % 3) + 1;
  const effMonth = () => st.month ?? startD().getMonth() + 1;
  const effWeekdays = () => st.weekdays ?? (st.freq === 'weekly' ? [startD().getDay()] : [0, 1, 2, 3, 4, 5, 6]);
  const workDays = () => normalizeWorkDays(settings.workDays);
  const sameSet = (a, b) => a.length === b.length && a.every((v) => b.includes(v));

  /** Haftanın günü kipine ilk geçişte başlangıç tarihinden makul bir "N. X günü" türetir. */
  function seedWeekdayPattern() {
    const d = startD();
    if (!st.nth) {
      const last = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      st.nth = last ? -1 : Math.min(Math.ceil(d.getDate() / 7), 4);
    }
    if (st.weekday === null) st.weekday = d.getDay();
  }

  function getRule() {
    if (!st.freq) return null;
    const rule = {
      freq: st.freq,
      interval: Number(st.interval) || 1,
      until: st.endMode === 'until' ? st.until : '',
      count: st.endMode === 'count' ? Number(st.count) || 0 : 0,
      exdates: st.exdates,
      rdates: st.rdates,
    };
    if (st.freq === 'daily') rule.weekdays = st.weekdays ?? [];
    else if (st.freq === 'weekly') {
      if (st.weekdays) rule.weekdays = st.weekdays;
    } else {
      if (st.mode === 'weekday' && st.nth) {
        rule.nth = st.nth;
        rule.weekday = st.weekday ?? startD().getDay();
      } else if (st.monthDay !== null) {
        rule.monthDay = st.monthDay;
      }
      if (st.freq === 'quarterly' && st.quarterMonth) rule.quarterMonth = st.quarterMonth;
      if (st.freq === 'yearly' && st.month) rule.month = st.month;
    }
    return normalizeRecurrence(rule);
  }

  // --- İskelet ---
  el.innerHTML = html`
    <legend>Tekrar</legend>
    <div class="rec-top">
      <label class="field"><span>Sıklık</span>
        <select name="freq">
          <option value="">Tekrar yok</option>
          ${Object.entries(FREQUENCIES).map(([k, v]) => html`<option value="${k}" ${st.freq === k ? 'selected' : ''}>${v}</option>`)}
        </select>
      </label>
      <label class="field rec-field"><span data-interval-label>Aralık</span><input type="number" name="interval" min="1" max="365" value="${st.interval}" /></label>
    </div>
    <div class="rec-pattern rec-field" data-pattern></div>
    <div class="rec-end rec-field" data-end>
      <label class="field"><span>Bitiş</span>
        <select name="endMode">
          <option value="never" ${st.endMode === 'never' ? 'selected' : ''}>Bitiş yok</option>
          <option value="until" ${st.endMode === 'until' ? 'selected' : ''}>Tarihte bitsin</option>
          <option value="count" ${st.endMode === 'count' ? 'selected' : ''}>Belirli sayıda</option>
        </select>
      </label>
      <label class="field rec-until"><span>Son tarih</span><input type="date" name="until" value="${st.until}" /></label>
      <label class="field rec-count"><span>Tekrar sayısı</span><input type="number" name="count" min="1" max="5000" value="${st.count}" /></label>
    </div>
    <p class="rec-summary rec-field" data-summary aria-live="polite"></p>
    <details class="rec-dates rec-field" data-dates>
      <summary>${icon('month')} Tüm tarihler <span class="muted" data-dates-count></span></summary>
      <div class="rec-dates-body">
        <p class="rec-note muted" data-dates-note></p>
        <ul class="rec-date-list" data-date-list></ul>
        <button type="button" class="btn btn-ghost btn-sm" data-more hidden>Daha fazla göster</button>
        <div class="rec-add">
          <label class="field"><span>Tarih ekle</span><input type="date" data-add-date /></label>
          <button type="button" class="btn btn-ghost btn-sm" data-add>${icon('plus')} Ekle</button>
        </div>
      </div>
    </details>`;

  const $ = (sel) => el.querySelector(sel);
  const freqSel = $('[name="freq"]');
  const intervalInput = $('[name="interval"]');
  const endModeSel = $('[name="endMode"]');
  const untilInput = $('[name="until"]');
  const countInput = $('[name="count"]');
  const patternHost = $('[data-pattern]');
  const dateList = $('[data-date-list]');

  // --- Desen alanları (sıklığa göre) ---
  const opt = (value, label, selected) => html`<option value="${value}" ${selected ? 'selected' : ''}>${label}</option>`;

  function patternHtml() {
    if (st.freq === 'daily' || st.freq === 'weekly') {
      const on = new Set(effWeekdays());
      const chips = orderedWeekdays(settings.weekStartsOn ?? 1).map(
        (d) => html`<button type="button" class="workday-chip ${on.has(d) ? 'is-on' : ''}" aria-pressed="${String(on.has(d))}" data-wd="${d}" title="${WEEKDAY_LONG[d]}">${WEEKDAY_SHORT[d]}</button>`,
      );
      return html`
        <div class="field">
          <span>${st.freq === 'daily' ? 'Hangi günler' : 'Haftanın günleri'}</span>
          <div class="workday-chips" role="group" aria-label="Haftanın günleri">${chips}</div>
          ${st.freq === 'daily'
            ? html`<div class="segmented segmented--sm rec-presets" role="group" aria-label="Hazır seçimler">
                <button type="button" data-preset="all">Her gün</button>
                <button type="button" data-preset="work">İş günleri</button>
              </div>`
            : ''}
        </div>`;
    }
    // aylık / çeyreklik / yıllık
    const monthDay = st.monthDay === -1 ? '-1' : String(effMonthDay());
    return html`
      ${st.freq === 'quarterly'
        ? html`<label class="field"><span>Çeyreğin hangi ayı</span>
            <select data-f="quarterMonth">
              ${[1, 2, 3].map((q) => opt(q, `${q}. ay (${[0, 3, 6, 9].map((b) => MONTH_NAMES[b + q - 1]).join(' · ')})`, effQuarterMonth() === q))}
            </select></label>`
        : ''}
      ${st.freq === 'yearly'
        ? html`<label class="field"><span>Ay</span>
            <select data-f="month">${MONTH_NAMES.map((name, i) => opt(i + 1, name, effMonth() === i + 1))}</select></label>`
        : ''}
      <div class="rec-month" role="radiogroup" aria-label="Ay içindeki gün">
        <label class="rec-radio" data-row="day">
          <input type="radio" name="recMode" value="day" ${st.mode === 'day' ? 'checked' : ''} />
          <span>Ayın</span>
          <select data-f="monthDay" aria-label="Ayın günü">
            ${Array.from({ length: 31 }, (_, i) => opt(i + 1, `${i + 1}.`, monthDay === String(i + 1)))}
            ${opt(-1, 'Son', monthDay === '-1')}
          </select>
          <span>günü</span>
        </label>
        <label class="rec-radio" data-row="weekday">
          <input type="radio" name="recMode" value="weekday" ${st.mode === 'weekday' ? 'checked' : ''} />
          <span>Ayın</span>
          <select data-f="nth" aria-label="Hafta sırası">${NTH_OPTIONS.map((n) => opt(n, NTH_LABELS[n], (st.nth || 1) === n))}</select>
          <select data-f="weekday" aria-label="Haftanın günü">
            ${WEEKDAY_LONG.map((name, d) => opt(d, name, (st.weekday ?? startD().getDay()) === d))}
            ${opt('work', 'iş günü (Pzt–Cum)', st.weekday === 'work')}
          </select>
        </label>
      </div>
      <p class="rec-note muted">O ayda o gün yoksa (ör. 31) ayın son günü kullanılır.</p>`;
  }

  function renderPattern() {
    patternHost.innerHTML = st.freq ? patternHtml() : '';
    $('[data-interval-label]').textContent = st.freq ? `Aralık (${UNIT_LABELS[st.freq]})` : 'Aralık';
    syncPattern();
  }

  /** Yerinde güncellenen parçalar: gün düğmeleri, hazır seçim vurgusu, ay kipi satırlarının soluklaştırılması. */
  function syncPattern() {
    if (st.freq === 'daily' || st.freq === 'weekly') {
      const on = new Set(effWeekdays());
      patternHost.querySelectorAll('[data-wd]').forEach((b) => {
        const isOn = on.has(Number(b.dataset.wd));
        b.classList.toggle('is-on', isOn);
        b.setAttribute('aria-pressed', String(isOn));
      });
      const days = [...on];
      patternHost.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('is-active', sameSet(days, b.dataset.preset === 'all' ? [0, 1, 2, 3, 4, 5, 6] : workDays())));
    } else if (st.freq) {
      patternHost.querySelectorAll('[data-row]').forEach((row) => row.classList.toggle('is-dim', row.dataset.row !== st.mode));
    }
  }

  // --- Özet ve tarih listesi ---
  function refresh() {
    el.classList.toggle('is-on', Boolean(st.freq));
    $('[data-end]').dataset.mode = st.endMode;
    if (!st.freq) return;
    const rule = getRule();
    $('[data-summary]').textContent = describeRecurrence(rule);
    renderList(rule);
  }

  function renderList(rule) {
    const start = startISO();
    const gen = listRuleDates(rule, start, st.limit + 1);
    const hasMore = gen.length > st.limit;
    const shown = gen.slice(0, st.limit);
    const lastShown = shown[shown.length - 1] || '';
    const excluded = new Set(st.exdates);
    const rows = new Map(shown.map((d) => [d, { date: d, kind: 'rule' }]));
    for (const d of st.rdates) if (!rows.has(d) && (!hasMore || d <= lastShown)) rows.set(d, { date: d, kind: 'added' });
    const list = [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
    for (const row of list) row.deleted = excluded.has(row.date);

    const live = list.filter((r) => !r.deleted).length;
    $('[data-dates-count]').textContent = `(${live}${hasMore ? '+' : ''})`;
    $('[data-dates-note]').textContent = list.length
      ? 'Bir tarihi değiştirebilir (başka güne alır), silebilir ya da yeni tarih ekleyebilirsiniz. Bir tarihin saatini veya içeriğini değiştirmek için o tarihteki etkinliği açıp "Yalnızca bu"yu seçin.'
      : 'Bu ayarlarla hiç tarih oluşmuyor: başlangıç/bitiş tarihini ve deseni kontrol edin. Yine de aşağıdan tarih ekleyebilirsiniz.';
    $('[data-more]').hidden = !hasMore;
    $('[data-more]').textContent = `Daha fazla göster (+${PAGE})`;

    dateList.innerHTML = list
      .map((row) => {
        const other = detached[row.date];
        const badge = row.deleted ? (other ? html`<span class="rec-badge">Ayrı düzenlendi</span>` : html`<span class="rec-badge rec-badge--del">Silindi</span>`) : row.kind === 'added' ? html`<span class="rec-badge rec-badge--add">Eklendi</span>` : '';
        const body =
          st.editing === row.date
            ? html`<input type="date" class="rec-edit-input" data-edit-input data-handles-escape value="${row.date}" aria-label="Yeni tarih" />
                <span class="rec-actions"><button type="button" class="btn btn-primary btn-sm" data-act="ok">Tamam</button><button type="button" class="btn btn-ghost btn-sm" data-act="cancel">Vazgeç</button></span>`
            : html`<span class="rec-date-label">${dateLabel(row.date)}</span>${badge}
                <span class="rec-actions">${row.deleted
                  ? other
                    ? ''
                    : html`<button type="button" class="btn btn-ghost btn-sm" data-act="undo">Geri al</button>`
                  : html`<button type="button" class="btn btn-ghost btn-sm" data-act="edit">Değiştir</button><button type="button" class="btn btn-danger-ghost btn-sm" data-act="del">Sil</button>`}</span>`;
        return html`<li class="rec-date ${row.deleted ? 'is-deleted' : ''} ${row.kind === 'added' ? 'is-added' : ''}" data-date="${row.date}">${body}</li>`;
      })
      .map(String)
      .join('');
    dateList.querySelector('[data-edit-input]')?.focus();
  }

  // --- Tarih işlemleri: (kural ∪ rdates) \ exdates ---
  const ruleHas = (iso) => ruleDatesInRange({ ...getRule(), exdates: [], rdates: [] }, startISO(), iso, iso).length > 0;
  const effective = (iso) => !st.exdates.includes(iso) && (st.rdates.includes(iso) || ruleHas(iso));

  /** `iso` tarihini seriye ekler (silinmişse geri getirir). false: zaten vardı. */
  function addDate(iso) {
    if (effective(iso)) return false;
    if (st.exdates.includes(iso)) st.exdates = st.exdates.filter((d) => d !== iso);
    if (!effective(iso)) st.rdates = [...st.rdates, iso].sort();
    return true;
  }

  /** `iso` tarihini seriden çıkarır: kuralın tarihiyse exdates'e yazar, eklenen tarihse rdates'ten siler. */
  function removeDate(iso) {
    st.rdates = st.rdates.filter((d) => d !== iso);
    if (ruleHas(iso) && !st.exdates.includes(iso)) st.exdates = [...st.exdates, iso].sort();
  }

  // --- Olaylar ---
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t === freqSel) {
      st.freq = t.value;
      st.weekdays = null; // günlük ↔ haftalık geçişinde eski gün seçimi anlamını yitirir
      st.limit = PAGE;
      renderPattern();
      refresh();
    } else if (t === endModeSel) {
      st.endMode = t.value;
      refresh();
    } else if (t.name === 'recMode') {
      st.mode = t.value;
      if (st.mode === 'weekday') seedWeekdayPattern();
      syncPattern();
      refresh();
    } else if (t.dataset?.f) {
      const key = t.dataset.f;
      if (key === 'monthDay') {
        st.monthDay = Number(t.value);
        st.mode = 'day';
      } else if (key === 'nth') {
        st.nth = Number(t.value);
        st.mode = 'weekday';
        seedWeekdayPattern();
      } else if (key === 'weekday') {
        st.weekday = t.value === 'work' ? 'work' : Number(t.value);
        st.mode = 'weekday';
        seedWeekdayPattern();
      } else if (key === 'quarterMonth') st.quarterMonth = Number(t.value);
      else if (key === 'month') st.month = Number(t.value);
      const radio = patternHost.querySelector(`[name="recMode"][value="${st.mode}"]`);
      if (radio) radio.checked = true;
      syncPattern();
      refresh();
    }
  });

  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t === intervalInput) st.interval = Math.min(365, Math.max(1, Number(t.value) || 1));
    else if (t === untilInput) st.until = t.value;
    else if (t === countInput) st.count = Math.min(5000, Math.max(1, Number(t.value) || 1));
    else return;
    refresh();
  });

  el.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-wd]');
    if (chip) {
      const day = Number(chip.dataset.wd);
      const on = new Set(effWeekdays());
      if (on.has(day)) {
        if (on.size === 1) return; // en az bir gün seçili kalmalı
        on.delete(day);
      } else on.add(day);
      const list = [...on].sort((a, b) => a - b);
      st.weekdays = st.freq === 'daily' && list.length === 7 ? null : list;
      syncPattern();
      refresh();
      return;
    }
    const preset = e.target.closest('[data-preset]');
    if (preset) {
      st.weekdays = preset.dataset.preset === 'all' ? null : workDays();
      syncPattern();
      refresh();
      return;
    }
    if (e.target.closest('[data-more]')) {
      st.limit += PAGE;
      refresh();
      return;
    }
    if (e.target.closest('[data-add]')) {
      const input = $('[data-add-date]');
      if (!isValidISODate(input.value)) {
        input.focus();
        return;
      }
      if (!addDate(input.value)) toast('Bu tarih zaten listede', { type: 'info' });
      input.value = '';
      refresh();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const row = act.closest('[data-date]');
    const date = row.dataset.date;
    switch (act.dataset.act) {
      case 'del':
        removeDate(date);
        break;
      case 'undo':
        st.exdates = st.exdates.filter((d) => d !== date);
        break;
      case 'edit':
        st.editing = date;
        break;
      case 'cancel':
        st.editing = '';
        break;
      case 'ok': {
        const next = row.querySelector('[data-edit-input]').value;
        if (!isValidISODate(next)) return;
        st.editing = '';
        if (next !== date) {
          removeDate(date);
          if (!addDate(next)) toast('Bu tarih zaten listede; eski tarih silindi', { type: 'info' });
        }
        break;
      }
      default:
        return;
    }
    refresh();
  });

  el.addEventListener('keydown', (e) => {
    // "Tarih ekle" kutusunda Enter formu göndermez, tarihi ekler
    if (e.key === 'Enter' && e.target.matches?.('[data-add-date]')) {
      e.preventDefault();
      e.stopPropagation();
      $('[data-add]').click();
      return;
    }
    // Tarih satırı düzenlenirken Enter onaylar (formu göndermez), Esc yalnızca satırı kapatır
    if (!e.target.matches?.('[data-edit-input]')) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.target.closest('[data-date]').querySelector('[data-act="ok"]').click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      st.editing = '';
      refresh();
    }
  });

  renderPattern();
  refresh();

  return {
    el,
    getRule,
    refresh,
    /** Başlangıç tarihi değişti: otomatik (başlangıcı izleyen) alanlar ve liste yenilenir. */
    onStartChange() {
      if (!st.freq) return;
      renderPattern();
      refresh();
    },
  };
}
