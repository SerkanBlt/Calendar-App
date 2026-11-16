/**
 * holidayDialog.js — Tatil günü ekleme / düzenleme penceresi (Yıl görünümünden açılır).
 *
 * openHolidayDialog({ date, ctx }):
 *  - O tarih zaten bir tatilse düzenleme modu (ad, tarih, "Her yıl tekrarla", Sil); değilse yeni tatil (isteğe bağlı bitiş tarihiyle birkaç günlük).
 *  - "Her yıl aynı tarihte tekrarla" AÇIKSA tatil her yıl aynı ay-günde çalışma dışı (off) görünür; KAPALIYSA yalnızca o tarihin yılı için geçerlidir
 *    (değişken tatiller: ör. dini bayramlar). Kurallar ve birleştirme: core/holidays.js.
 *  - Grup: Resmî / Dini / Özel (ya da kullanıcının eklediği gruplar); tatil günü grubunun renginde görünür. Yeni tatil Özel grubuyla başlar.
 *  - Pencerede o günün etkinlikleri ve "Gün görünümü" kısayolu da vardır (Yıl görünümünde bir güne dokunmak yalnızca tatil penceresini açtığı için).
 */
import { html } from '../core/dom.js';
import { formatDate, isValidISODate } from '../core/dateUtils.js';
import { DEFAULT_GROUP_ID, addHolidays, holidayGroupOf, holidayOn, normalizeHolidayGroups, normalizeHolidays, removeHoliday, updateHoliday } from '../core/holidays.js';
import { expandEvents } from '../services/recurrenceService.js';
import { compareByStart } from '../core/eventModel.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { icon } from './icons.js';

const longDate = (iso) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function openHolidayDialog({ date, ctx }) {
  const { settings, events } = ctx.state;
  const holidays = normalizeHolidays(settings.holidays);
  const groups = normalizeHolidayGroups(settings.holidayGroups);
  const info = holidayOn(holidays, date, groups);
  const entry = info?.entries[0] ?? null; // düzenlenen kayıt (bir tarih için en çok bir kayıt tutulur)
  const currentGroup = entry ? holidayGroupOf(groups, entry.group).id : DEFAULT_GROUP_ID;
  const isEdit = Boolean(entry);
  const dayEvents = expandEvents(events, date, date).sort(compareByStart);

  const form = document.createElement('form');
  form.className = 'holiday-form';
  form.noValidate = true;
  form.id = 'holiday-form';
  form.innerHTML = html`
    <label class="field"><span>Ad</span><input name="name" value="${entry?.name ?? ''}" placeholder="ör. Cumhuriyet Bayramı" maxlength="80" autocomplete="off" /></label>
    <div class="field-grid">
      <label class="field"><span>${isEdit ? 'Tarih' : 'Başlangıç'}</span><input type="date" name="date" value="${date}" required /></label>
      ${isEdit ? '' : html`<label class="field"><span>Bitiş <span class="muted">(isteğe bağlı)</span></span><input type="date" name="endDate" value="${date}" min="${date}" /></label>`}
    </div>
    <div class="field" role="radiogroup" aria-label="Tatil grubu">
      <span>Grup</span>
      <div class="holiday-group-pick">
        ${groups.map((g) => html`<label class="group-chip" style="--hol:${g.color}"><input type="radio" name="group" value="${g.id}" ${g.id === currentGroup ? 'checked' : ''} /><span><i></i>${g.name}</span></label>`)}
      </div>
    </div>
    <label class="switch"><input type="checkbox" name="yearly" ${entry?.yearly ? 'checked' : ''} /><span></span>Her yıl aynı tarihte tekrarla</label>
    <p class="holiday-hint" data-hint aria-live="polite"></p>
    ${dayEvents.length
      ? html`<div class="holiday-events"><span class="muted">${longDate(date)} — ${dayEvents.length} etkinlik</span>
          <ul>${dayEvents.slice(0, 4).map((o) => html`<li><span class="dot" style="--ev-color:${o.color}"></span>${o.startTime ? `${o.startTime} ` : ''}${o.title}</li>`)}${dayEvents.length > 4 ? html`<li class="muted">+${dayEvents.length - 4} daha</li>` : ''}</ul></div>`
      : ''}`;

  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  footer.innerHTML = html`
    <button type="button" class="btn btn-ghost btn-sm" data-day>${icon('day')} Gün görünümü</button>
    <span class="spacer"></span>
    ${isEdit ? html`<button type="button" class="btn btn-danger-ghost" data-remove>${icon('trash')} Sil</button>` : ''}
    <button type="button" class="btn btn-ghost" data-cancel>İptal</button>
    <button type="submit" class="btn btn-primary" form="holiday-form">${isEdit ? 'Kaydet' : 'Tatil ekle'}</button>`;

  const modal = openModal({ title: isEdit ? 'Tatil günü' : 'Tatil günü ekle', body: form, footer, size: 'sm', initialFocus: 'first' });
  const f = form.elements;

  const syncHint = () => {
    const d = isValidISODate(f.date.value) ? f.date.value : date;
    const yearly = f.yearly.checked;
    $hint.textContent = yearly
      ? `Her yıl ${formatDate(d, { day: 'numeric', month: 'long' })} günü çalışma dışı (off) görünür.`
      : `Yalnızca ${d.slice(0, 4)} yılı için geçerli: değişken tatiller (ör. dini bayramlar) için. Her yıl aynı tarihteyse yukarıyı işaretleyin.`;
    if (f.endDate) f.endDate.min = d;
  };
  const $hint = form.querySelector('[data-hint]');
  syncHint();
  f.yearly.addEventListener('change', syncHint);
  f.date.addEventListener('input', () => {
    if (f.endDate && f.endDate.value < f.date.value) f.endDate.value = f.date.value;
    syncHint();
  });

  function submit(e) {
    e?.preventDefault();
    if (!isValidISODate(f.date.value)) {
      f.date.focus();
      return;
    }
    const patch = { date: f.date.value, name: f.name.value, yearly: f.yearly.checked, group: f.group.value || DEFAULT_GROUP_ID };
    const result = isEdit ? updateHoliday(holidays, entry.id, patch) : addHolidays(holidays, { ...patch, endDate: f.endDate?.value });
    ctx.setSetting('holidays', result.list);
    const added = result.added ?? 0;
    toast(
      isEdit ? 'Tatil güncellendi' : added > 1 ? `${added} tatil günü eklendi` : added === 1 ? 'Tatil günü eklendi' : 'Bu gün zaten tatil: ad güncellendi',
      { type: 'success' },
    );
    modal.close();
  }

  form.addEventListener('submit', submit);
  footer.querySelector('[data-cancel]').addEventListener('click', () => modal.requestClose());
  footer.querySelector('[data-day]').addEventListener('click', () => {
    modal.close();
    ctx.go('day', isValidISODate(f.date.value) ? f.date.value : date);
  });
  footer.querySelector('[data-remove]')?.addEventListener('click', () => {
    const before = holidays;
    ctx.setSetting('holidays', removeHoliday(holidays, entry.id));
    toast('Tatil kaldırıldı', { type: 'warning', duration: 6000, action: { label: 'Geri al', onClick: () => ctx.setSetting('holidays', before) } });
    modal.close();
  });
  return modal;
}
