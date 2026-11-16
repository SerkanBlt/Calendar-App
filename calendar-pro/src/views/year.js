/**
 * year.js — Yıl görünümü: 12 aylık özet + tatil günleri tanımlama.
 *
 * - 12 ay küçük ay kartları olarak gösterilir; çalışma dışı günler (çalışma günü olmayan hafta günleri) soluk, tatil günleri grubunun renginde, etkinlik olan günler noktalı.
 * - Bir güne tıklayınca tatil penceresi açılır: o gün tatil olarak işaretlenir (ad, isteğe bağlı bitiş tarihi) ya da var olan tatil düzenlenir/silinir.
 *   "Her yıl aynı tarihte tekrarla" açıksa tatil her yıl aynı ay-günde çalışma dışı (off) görünür; kapalıysa yalnızca o yıl için geçerlidir.
 * - Altta o yılın tatil listesi (tarih, ad, "Her yıl" / "Yalnızca <yıl>") ve düzenle/sil eylemleri bulunur. Silme "Geri al" ile geri alınır.
 * - Her ay kartında satır başlarında ISO 8601 hafta numaraları vardır (1. hafta = yılın ilk Perşembesini içeren hafta); numaraya tıklamak o haftayı açar.
 * - Tatil grupları: her tatil bir gruba aittir (hazır: Resmî mavi, Dini yeşil, Özel mor); "Tatil grupları" panelinde grup rengi değiştirilir, yeni grup eklenir,
 *   eklenen gruplar yeniden adlandırılır/silinir (silinen grubun tatilleri Özel'e taşınır; "Geri al" ile geri alınır). Gruplar `settings.holidayGroups` içindedir.
 * - Ay başlığına tıklamak Ay görünümüne götürür. Geri/İleri bir yıl kaydırır.
 * Tatiller `settings.holidays` içinde saklanır ve Ay/Hafta/Gün/Scheduler/Gantt/mini takvimde çalışma dışı gün olarak görünür (bkz. core/holidays.js).
 */
import { html } from '../core/dom.js';
import { addDaysISO, diffDays, formatDate, isoWeek, startOfWeek, toISODate, todayISO, weekdayNames } from '../core/dateUtils.js';
import {
  DEFAULT_GROUP_ID, MAX_GROUPS, addHolidayGroup, holidayGroupOf, holidaysInYear, normalizeHolidayGroups, normalizeHolidays, reassignHolidayGroup, removeHoliday,
  removeHolidayGroup, updateHolidayGroup,
} from '../core/holidays.js';
import { normalizeWorkDays } from '../core/workDays.js';
import { expandEvents } from '../services/recurrenceService.js';
import { toolbar } from '../components/toolbar.js';
import { icon } from '../components/icons.js';
import { openHolidayDialog } from '../components/holidayDialog.js';
import { toast } from '../components/toast.js';

export default {
  id: 'year',
  title: 'Yıl',

  render(el, ctx) {
    const { cursor, events, settings } = ctx.state;
    const year = Number(cursor.slice(0, 4));
    const first = `${year}-01-01`;
    const last = `${year}-12-31`;
    const today = todayISO();
    const holidays = normalizeHolidays(settings.holidays);
    const groups = normalizeHolidayGroups(settings.holidayGroups);
    const inYear = holidaysInYear(holidays, year, groups);
    const work = new Set(normalizeWorkDays(settings.workDays));
    const occurrences = expandEvents(events, first, last);

    // Gün başına etkinlik sayısı (çok günlü etkinlikler her güne yazılır)
    const busy = new Map();
    for (const o of occurrences) {
      const to = o.endDate > last ? last : o.endDate;
      for (let d = o.startDate < first ? first : o.startDate; d <= to; d = addDaysISO(d, 1)) busy.set(d, (busy.get(d) || 0) + 1);
    }

    const dows = weekdayNames(settings.weekStartsOn, 'narrow');
    const monthCard = (m) => {
      const monthFirst = new Date(year, m, 1);
      const lead = diffDays(toISODate(startOfWeek(monthFirst, settings.weekStartsOn)), toISODate(monthFirst));
      const total = new Date(year, m + 1, 0).getDate();
      const dayCells = [
        ...Array.from({ length: lead }, () => html`<span class="year-day is-blank" aria-hidden="true"></span>`),
        ...Array.from({ length: total }, (_, i) => {
          const d = toISODate(new Date(year, m, i + 1));
          const hol = inYear.get(d);
          const off = !work.has(new Date(year, m, i + 1).getDay());
          const n = busy.get(d) || 0;
          const label = `${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${hol ? `, tatil (${hol.groupName}): ${hol.name}${hol.yearly ? ' (her yıl)' : ''}` : ''}${n ? `, ${n} etkinlik` : ''}`;
          const cls = ['year-day', off && 'is-off', hol && 'is-holiday', hol?.yearly && 'is-yearly', d === today && 'is-today', n && 'has-events'].filter(Boolean).join(' ');
          return html`<button type="button" class="${cls}" data-date="${d}" aria-label="${label}" title="${label}" ${hol ? html`style="--hol:${hol.color}"` : ''}>${i + 1}</button>`;
        }),
      ];
      // Her satırın başına ISO 8601 hafta numarası: satırın ortadaki günü (Pazartesi başlangıçlı haftada Perşembe) hangi ISO haftasındaysa o numara.
      // Satır, haftanın başladığı gün ayarına (settings.weekStartsOn) göredir; numara her zaman ISO'dur.
      const rowCount = Math.ceil((lead + total) / 7);
      const cells = Array.from({ length: rowCount }, (_, r) => {
        const anchor = toISODate(new Date(year, m, r * 7 - lead + 1 + 3)); // satırın 4. günü
        const week = isoWeek(anchor);
        return html`<button type="button" class="year-wk" data-week="${anchor}" aria-label="${week}. hafta (ISO)" title="${week}. hafta (ISO 8601) — Hafta görünümünde aç">${week}</button>${dayCells.slice(r * 7, r * 7 + 7)}`;
      });
      return html`
        <section class="year-month glass" aria-label="${formatDate(monthFirst, { month: 'long', year: 'numeric' })}">
          <button type="button" class="year-month-title" data-month="${toISODate(monthFirst)}" title="Ay görünümünde aç">${formatDate(monthFirst, { month: 'long' })}</button>
          <div class="year-weekdays" aria-hidden="true"><span class="year-dow year-wk-head" title="ISO 8601 hafta numarası">H</span>${dows.map((n) => html`<span class="year-dow">${n}</span>`)}</div>
          <div class="year-days">${cells}</div>
        </section>`;
    };

    // Tatil listesi: o yılın tatilleri tarih sırasıyla
    const rows = [...inYear.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((info) => info.entries.map((entry) => ({ date: info.date, entry, group: holidayGroupOf(groups, entry.group) })));
    const groupCount = new Map(groups.map((g) => [g.id, 0]));
    for (const h of holidays) groupCount.set(holidayGroupOf(groups, h.group).id, (groupCount.get(holidayGroupOf(groups, h.group).id) || 0) + 1);

    el.innerHTML = html`
      ${toolbar({
        title: String(year),
        subtitle: `${occurrences.length} etkinlik · ${inYear.size} tatil günü`,
        nav: true,
        beforeNew: html`<button type="button" class="btn btn-ghost btn-sm" data-add-holiday title="Tatil günü ekle">${icon('flag')}<span class="hide-sm">Tatil ekle</span></button>`,
      })}
      <div class="view-body year">
        <div class="year-grid">${Array.from({ length: 12 }, (_, m) => monthCard(m))}</div>
        <div class="year-legend" aria-hidden="true">
          ${groups.map((g) => html`<span><i class="year-key is-holiday" style="--hol:${g.color}"></i>${g.name}</span>`)}
          <span><i class="year-key is-off"></i>Çalışma dışı gün</span>
          <span><i class="year-key has-events"></i>Etkinlik var</span>
          <span><b class="year-key-wk">H</b>ISO 8601 hafta numarası</span>
        </div>
        <section class="panel glass year-holidays">
          <header class="panel-head">
            <h2>${icon('flag')} Tatil günleri · ${year} <span class="count">${inYear.size}</span></h2>
            <button type="button" class="btn btn-ghost btn-sm" data-add-holiday>${icon('plus')} Tatil ekle</button>
          </header>
          ${rows.length
            ? html`<ul class="holiday-list">
                ${rows.map(
                  ({ date, entry, group }) => html`<li class="holiday-row" data-id="${entry.id}" data-date="${date}" style="--hol:${group.color}">
                    <span class="holiday-date">${formatDate(date, { day: 'numeric', month: 'short', weekday: 'short' })}</span>
                    <span class="holiday-name">${entry.name || 'Tatil'}</span>
                    <span class="holiday-group"><i></i>${group.name}</span>
                    <span class="holiday-badge ${entry.yearly ? 'is-yearly' : ''}">${entry.yearly ? html`${icon('repeat')} Her yıl` : `Yalnızca ${year}`}</span>
                    <span class="holiday-actions">
                      <button type="button" class="btn btn-ghost btn-sm" data-edit>Düzenle</button>
                      <button type="button" class="btn btn-danger-ghost btn-sm" data-del>Sil</button>
                    </span>
                  </li>`,
                )}
              </ul>`
            : html`<div class="empty-mini">Bu yıl için tatil günü yok. Takvimde bir güne dokunarak ya da <b>Tatil ekle</b> ile tanımlayın; "Her yıl aynı tarihte tekrarla" işaretlenirse her yıl çalışma dışı (off) görünür.</div>`}
        </section>
        <section class="panel glass year-groups">
          <header class="panel-head"><h2>${icon('flag')} Tatil grupları <span class="count">${groups.length}</span></h2></header>
          <ul class="group-list">
            ${groups.map(
              (g) => html`<li class="group-row" data-group="${g.id}" style="--hol:${g.color}">
                <input type="color" class="group-color" data-group-color value="${g.color}" aria-label="${g.name} grubunun rengi" title="Rengi değiştir" />
                ${g.preset
                  ? html`<span class="group-name">${g.name}</span><span class="group-badge">Hazır</span>`
                  : html`<input type="text" class="group-name-input" data-group-name value="${g.name}" maxlength="40" aria-label="Grup adı" autocomplete="off" />`}
                <span class="group-count" title="Bu gruptaki tatil kayıtları (tüm yıllar)">${groupCount.get(g.id) || 0} tatil</span>
                ${g.preset ? '' : html`<button type="button" class="btn btn-danger-ghost btn-sm" data-group-del title="Grubu sil: tatilleri Özel'e taşınır">Sil</button>`}
              </li>`,
            )}
          </ul>
          <form class="group-add" data-group-add novalidate>
            <input type="color" class="group-color" name="color" value="#f59e0b" aria-label="Yeni grup rengi" title="Yeni grubun rengi" />
            <input type="text" name="name" maxlength="40" placeholder="Yeni grup adı (ör. Okul tatilleri)" aria-label="Yeni grup adı" autocomplete="off" />
            <button type="submit" class="btn btn-ghost btn-sm">${icon('plus')} Grup ekle</button>
          </form>
        </section>
      </div>`;

    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('submit', onSubmit);

    function onClick(e) {
      const t = e.target;
      const month = t.closest('[data-month]');
      if (month) return ctx.go('month', month.dataset.month);
      const week = t.closest('[data-week]');
      if (week) return ctx.go('week', week.dataset.week);
      if (t.closest('[data-add-holiday]')) return openHolidayDialog({ date: today.startsWith(String(year)) ? today : first, ctx });
      const day = t.closest('.year-day[data-date]');
      if (day) return openHolidayDialog({ date: day.dataset.date, ctx });
      const groupDel = t.closest('[data-group-del]');
      if (groupDel) {
        const id = groupDel.closest('.group-row').dataset.group;
        const group = groups.find((g) => g.id === id);
        const beforeGroups = groups;
        const beforeHolidays = holidays;
        const moved = holidays.filter((h) => holidayGroupOf(groups, h.group).id === id).length;
        ctx.setSetting('holidays', reassignHolidayGroup(holidays, id, DEFAULT_GROUP_ID)); // önce tatiller taşınır, sonra grup silinir
        ctx.setSetting('holidayGroups', removeHolidayGroup(groups, id));
        toast(`"${group?.name ?? 'Grup'}" grubu silindi${moved ? `: ${moved} tatil Özel'e taşındı` : ''}`, {
          type: 'warning',
          duration: 7000,
          action: { label: 'Geri al', onClick: () => { ctx.setSetting('holidayGroups', beforeGroups); ctx.setSetting('holidays', beforeHolidays); } },
        });
        return undefined;
      }
      const row = t.closest('.holiday-row');
      if (!row) return undefined;
      if (t.closest('[data-edit]')) return openHolidayDialog({ date: row.dataset.date, ctx });
      if (t.closest('[data-del]')) {
        const before = holidays;
        ctx.setSetting('holidays', removeHoliday(holidays, row.dataset.id));
        toast('Tatil kaldırıldı', { type: 'warning', duration: 6000, action: { label: 'Geri al', onClick: () => ctx.setSetting('holidays', before) } });
      }
      return undefined;
    }

    // Grup rengi / adı değişimi (renk seçici kapanınca, ad alanından çıkınca ya da Enter ile)
    function onChange(e) {
      const row = e.target.closest('.group-row');
      if (!row) return;
      const id = row.dataset.group;
      if (e.target.matches('[data-group-color]')) ctx.setSetting('holidayGroups', updateHolidayGroup(groups, id, { color: e.target.value }));
      else if (e.target.matches('[data-group-name]')) ctx.setSetting('holidayGroups', updateHolidayGroup(groups, id, { name: e.target.value }));
    }

    function onSubmit(e) {
      const form = e.target.closest('[data-group-add]');
      if (!form) return;
      e.preventDefault();
      const name = form.elements.name.value.trim();
      if (groups.length >= MAX_GROUPS) return toast(`En fazla ${MAX_GROUPS} grup olabilir`, { type: 'warning' });
      if (!name) {
        form.elements.name.focus();
        return toast('Grup için bir ad yazın', { type: 'warning' });
      }
      if (groups.some((g) => g.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) {
        form.elements.name.focus();
        return toast('Bu adda bir grup zaten var', { type: 'warning' });
      }
      const { list, id } = addHolidayGroup(groups, { name, color: form.elements.color.value });
      if (!id) return undefined;
      ctx.setSetting('holidayGroups', list);
      return toast(`"${name}" grubu eklendi: tatil eklerken seçebilirsiniz`, { type: 'success' });
    }

    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('change', onChange);
      el.removeEventListener('submit', onSubmit);
    };
  },
};
