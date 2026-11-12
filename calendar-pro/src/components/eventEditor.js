/**
 * eventEditor.js — Etkinlik oluşturma/düzenleme formu (modal içinde).
 *
 * openEventEditor(input):
 *  - input bir etkinlik/örnek ise (id içerir) düzenleme modu.
 *  - Tekrarlayan bir örnek açıldığında üstte kapsam seçici çıkar:
 *      "Yalnızca bu etkinlik" → örnek seriden ayrılıp bağımsız kayıt olarak kaydedilir
 *      "Tüm seri"             → ana etkinlik düzenlenir
 *  - Seriden ayrılmış bir kayıt açıldığında "Seriye geri döndür" seçeneği sunulur.
 *  - aksi halde input ön doldurma alanları kabul edilir: { startDate, endDate, startTime, endTime, status }
 */
import { html } from '../core/dom.js';
import { eventRepo, attachmentRepo } from '../core/eventRepo.js';
import { store } from '../core/state.js';
import { formatDate, todayISO } from '../core/dateUtils.js';
import { EVENT_COLORS, REMINDER_OPTIONS, STATUSES, STATUS_LABELS } from '../core/eventModel.js';
import { FREQUENCIES } from '../services/recurrenceService.js';
import { deleteEventWithUndo, deleteOccurrence } from '../core/actions.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { icon } from './icons.js';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function openEventEditor(input = {}) {
  const { events, settings } = store.get();
  const masterId = input.masterId || input.id;
  const existing = masterId ? eventRepo.getById(masterId) : null;
  const isEdit = Boolean(existing);
  const start = input.startDate || store.get().cursor || todayISO();
  const ev = existing || {
    title: '',
    description: '',
    startDate: start,
    endDate: input.endDate || start,
    startTime: input.startTime ?? '09:00',
    endTime: input.endTime ?? '10:00',
    color: EVENT_COLORS[0],
    status: input.status || 'todo',
    progress: 0,
    category: '',
    critical: false,
    recurrence: null,
    reminder: settings.defaultReminder,
    dependencies: [],
  };
  const allDay = !ev.startTime;
  const categories = [...new Set(events.map((e) => e.category).filter(Boolean))];
  const depCandidates = events.filter((e) => e.id !== ev.id && !e.recurrence);
  const pendingFiles = []; // yeni etkinlikte kayıttan sonra yüklenecek ekler

  // Tekrarlayan bir örnek mi açıldı? (dashboard/timeline gibi yerlerden ana kayıt da gelebilir)
  const occurrence = existing?.recurrence && input.isRecurring ? input : null;
  let scope = occurrence ? 'single' : 'series';
  const parentSeries = existing?.seriesId ? eventRepo.getById(existing.seriesId) : null;
  const dateRanges = {
    single: occurrence ? { start: occurrence.startDate, end: occurrence.endDate } : null,
    series: { start: ev.startDate, end: ev.endDate },
  };
  const initialRange = dateRanges[scope];

  const form = document.createElement('form');
  form.className = 'event-form';
  form.noValidate = true;
  form.innerHTML = html`
    ${occurrence
      ? html`<div class="notice scope-picker">
          ${icon('repeat')}<span>Tekrarlayan etkinlik</span>
          <div class="segmented segmented--sm" role="radiogroup" aria-label="Değişiklik kapsamı">
            <button type="button" role="radio" data-scope="single">Yalnızca bu (${formatDate(occurrence.startDate, { day: 'numeric', month: 'short' })})</button>
            <button type="button" role="radio" data-scope="series">Tüm seri</button>
          </div>
        </div>`
      : existing?.recurrence
        ? html`<div class="notice">${icon('repeat')} Tekrarlayan seri — değişiklikler tüm seriye uygulanır.</div>`
        : ''}
    ${parentSeries?.recurrence
      ? html`<div class="notice">${icon('link')}<span>"${parentSeries.title}" serisinin ${formatDate(existing.originalDate, { day: 'numeric', month: 'long' })} tarihli, ayrı düzenlenmiş örneği.</span>
          <button type="button" class="link" data-reattach>Seriye geri döndür</button></div>`
      : ''}
    <label class="field field--title">
      <span class="sr-only">Başlık</span>
      <input name="title" type="text" placeholder="Etkinlik başlığı" value="${ev.title}" maxlength="200" required autofocus />
    </label>

    <div class="field-row">
      <label class="switch"><input type="checkbox" name="allDay" ${allDay ? 'checked' : ''} /><span></span>Tüm gün</label>
      <label class="switch"><input type="checkbox" name="critical" ${ev.critical ? 'checked' : ''} /><span></span>Kritik görev</label>
    </div>

    <div class="field-grid">
      <label class="field"><span>Başlangıç</span><input type="date" name="startDate" value="${initialRange.start}" required /></label>
      <label class="field time-field"><span>Saat</span><input type="time" name="startTime" value="${ev.startTime || '09:00'}" step="300" /></label>
      <label class="field"><span>Bitiş</span><input type="date" name="endDate" value="${initialRange.end}" required /></label>
      <label class="field time-field"><span>Saat</span><input type="time" name="endTime" value="${ev.endTime || '10:00'}" step="300" /></label>
    </div>

    <label class="field"><span>Açıklama</span><textarea name="description" rows="3" placeholder="Notlar, bağlantılar…">${ev.description}</textarea></label>

    <div class="field-grid field-grid--3">
      <label class="field"><span>Durum</span>
        <select name="status">${STATUSES.map((s) => html`<option value="${s}" ${ev.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`)}</select>
      </label>
      <label class="field"><span>Kategori</span>
        <input name="category" list="category-options" value="${ev.category}" placeholder="ör. Proje" maxlength="60" />
        <datalist id="category-options">${categories.map((c) => html`<option value="${c}"></option>`)}</datalist>
      </label>
      <label class="field"><span>Hatırlatma</span>
        <select name="reminder">${REMINDER_OPTIONS.map((o) => html`<option value="${o.value}" ${ev.reminder === o.value ? 'selected' : ''}>${o.label}</option>`)}</select>
      </label>
    </div>

    <label class="field"><span>İlerleme <output name="progressOut">${ev.progress}%</output></span>
      <input type="range" name="progress" min="0" max="100" step="5" value="${ev.progress}" />
    </label>

    <fieldset class="field">
      <legend>Renk</legend>
      <div class="swatches">
        ${EVENT_COLORS.map((c) => html`<label class="swatch" style="--sw:${c}"><input type="radio" name="color" value="${c}" ${ev.color === c ? 'checked' : ''} aria-label="${c}" /><span></span></label>`)}
      </div>
    </fieldset>

    <div class="field-grid field-grid--3 series-only">
      <label class="field"><span>Tekrar</span>
        <select name="freq">
          <option value="">Tekrar yok</option>
          ${Object.entries(FREQUENCIES).map(([k, v]) => html`<option value="${k}" ${ev.recurrence?.freq === k ? 'selected' : ''}>${v}</option>`)}
        </select>
      </label>
      <label class="field rec-field"><span>Aralık</span><input type="number" name="interval" min="1" max="365" value="${ev.recurrence?.interval || 1}" /></label>
      <label class="field rec-field"><span>Bitiş tarihi</span><input type="date" name="until" value="${ev.recurrence?.until || ''}" /></label>
    </div>

    ${depCandidates.length
      ? html`<details class="field deps series-only" ${ev.dependencies.length ? 'open' : ''}>
          <summary>${icon('link')} Bağımlılıklar <span class="muted">(Gantt — önce bitmesi gerekenler)</span></summary>
          <div class="dep-list">
            ${depCandidates.map((d) => html`<label class="dep-item"><input type="checkbox" name="dependencies" value="${d.id}" ${ev.dependencies.includes(d.id) ? 'checked' : ''} /><span class="dot" style="--ev-color:${d.color}"></span>${d.title}</label>`)}
          </div>
        </details>`
      : ''}

    <div class="field attachments series-only">
      <span>${icon('paperclip')} Ekler</span>
      <ul class="attachment-list"></ul>
      <label class="btn btn-ghost btn-sm file-btn">${icon('plus')} Dosya ekle<input type="file" name="files" multiple hidden /></label>
    </div>`;

  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  footer.innerHTML = html`
    ${isEdit ? html`<button type="button" class="btn btn-danger-ghost" data-delete>${icon('trash')} Sil</button>` : ''}
    <span class="spacer"></span>
    <span class="hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
    <button type="button" class="btn btn-ghost" data-cancel>İptal</button>
    <button type="submit" class="btn btn-primary" form="event-form">${isEdit ? 'Kaydet' : 'Oluştur'}</button>`;
  form.id = 'event-form';

  const modal = openModal({ title: isEdit ? 'Etkinliği düzenle' : 'Yeni etkinlik', body: form, footer, size: 'lg' });
  const f = form.elements;

  // --- Dinamik alan davranışları ---
  const syncAllDay = () => form.classList.toggle('is-allday', f.allDay.checked);
  const syncRecurrence = () => form.classList.toggle('has-recurrence', Boolean(f.freq.value));
  syncAllDay();
  syncRecurrence();
  f.allDay.addEventListener('change', syncAllDay);
  f.freq.addEventListener('change', syncRecurrence);
  f.progress.addEventListener('input', () => (f.progressOut.value = `${f.progress.value}%`));
  f.startDate.addEventListener('change', () => {
    if (f.endDate.value < f.startDate.value) f.endDate.value = f.startDate.value;
  });
  f.status.addEventListener('change', () => {
    if (f.status.value === 'done') {
      f.progress.value = 100;
      f.progressOut.value = '100%';
    }
  });

  // --- Tekrarlayan örnek: kapsam seçimi ---
  // "Yalnızca bu" modunda tarih alanları örneğin tarihini, "Tüm seri" modunda serinin başlangıcını gösterir;
  // tekrar kuralı, bağımlılıklar ve ekler yalnızca seri düzeyinde düzenlenebilir.
  function syncScope(next) {
    if (next && next !== scope) {
      const range = dateRanges[next];
      f.startDate.value = range.start;
      f.endDate.value = range.end;
      scope = next;
    }
    form.classList.toggle('scope-single', scope === 'single');
    form.querySelectorAll('[data-scope]').forEach((b) => {
      const on = b.dataset.scope === scope;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
  }
  syncScope();
  form.querySelector('.scope-picker')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scope]');
    if (btn) syncScope(btn.dataset.scope);
  });
  form.querySelector('[data-reattach]')?.addEventListener('click', async () => {
    await eventRepo.reattach(ev.id);
    toast('Etkinlik seriye geri döndürüldü', { type: 'success' });
    modal.close();
  });

  // --- Ekler ---
  const list = form.querySelector('.attachment-list');
  async function renderAttachments() {
    const stored = isEdit ? await attachmentRepo.listByEvent(ev.id) : [];
    const items = [...stored.map((a) => ({ ...a, stored: true })), ...pendingFiles.map((file, i) => ({ id: `p${i}`, name: file.name, size: file.size, blob: file, stored: false }))];
    list.innerHTML = items.length
      ? html`${items.map((a) => html`<li><button type="button" class="link" data-open="${a.id}">${a.name}</button><span class="muted">${formatBytes(a.size)}</span><button type="button" class="icon-btn icon-btn-sm" data-remove="${a.id}" aria-label="Eki kaldır">${icon('x')}</button></li>`)}`
      : html`<li class="muted">Ek yok</li>`;
    list.onclick = async (e) => {
      const openId = e.target.closest('[data-open]')?.dataset.open;
      const removeId = e.target.closest('[data-remove]')?.dataset.remove;
      const item = items.find((a) => a.id === (openId || removeId));
      if (!item) return;
      if (openId) {
        const url = URL.createObjectURL(item.blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else if (item.stored) {
        await attachmentRepo.remove(item.id);
        renderAttachments();
      } else {
        pendingFiles.splice(Number(item.id.slice(1)), 1);
        renderAttachments();
      }
    };
  }
  renderAttachments();
  f.files.addEventListener('change', async () => {
    for (const file of f.files.files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast(`${file.name} 10 MB sınırını aşıyor`, { type: 'error' });
        continue;
      }
      if (isEdit) await attachmentRepo.add(ev.id, file);
      else pendingFiles.push(file);
    }
    f.files.value = '';
    renderAttachments();
  });

  // --- Kaydet / sil ---
  function collect() {
    const isAllDay = f.allDay.checked;
    const deps = f.dependencies ? [...form.querySelectorAll('input[name="dependencies"]:checked')].map((n) => n.value) : ev.dependencies;
    // Seri düzenlenirken daha önce silinmiş/ayrılmış örnek tarihleri korunur
    const exdates = ev.recurrence?.exdates || [];
    return {
      ...(isEdit ? { id: ev.id } : {}),
      title: f.title.value,
      description: f.description.value,
      startDate: f.startDate.value,
      endDate: f.endDate.value || f.startDate.value,
      startTime: isAllDay ? '' : f.startTime.value,
      endTime: isAllDay ? '' : f.endTime.value,
      color: form.querySelector('input[name="color"]:checked')?.value || ev.color,
      status: f.status.value,
      progress: Number(f.progress.value),
      category: f.category.value,
      critical: f.critical.checked,
      reminder: Number(f.reminder.value),
      recurrence: f.freq.value ? { freq: f.freq.value, interval: Number(f.interval.value) || 1, until: f.until.value, exdates } : null,
      dependencies: deps,
    };
  }

  async function submit(e) {
    e?.preventDefault();
    if (!f.title.value.trim()) {
      f.title.focus();
      f.title.classList.add('is-invalid');
      return;
    }
    if (!f.startDate.value) {
      f.startDate.focus();
      return;
    }
    try {
      if (occurrence && scope === 'single') {
        const { id: _id, recurrence: _r, dependencies: _d, ...changes } = collect();
        await eventRepo.detachOccurrence(occurrence, changes);
        toast('Yalnızca bu etkinlik güncellendi', { type: 'success' });
        modal.close();
        return;
      }
      const saved = await eventRepo.save(collect());
      for (const file of pendingFiles) await attachmentRepo.add(saved.id, file);
      toast(isEdit ? (occurrence ? 'Serinin tamamı güncellendi' : 'Etkinlik güncellendi') : 'Etkinlik oluşturuldu', { type: 'success' });
      modal.close();
    } catch (err) {
      toast(`Kaydedilemedi: ${err.message}`, { type: 'error' });
    }
  }

  form.addEventListener('submit', submit);
  form.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(e);
  });
  f.title.addEventListener('input', () => f.title.classList.remove('is-invalid'));
  footer.querySelector('[data-cancel]').addEventListener('click', () => modal.close());
  footer.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const done = occurrence ? await deleteOccurrence(occurrence, scope) : await deleteEventWithUndo(ev.id);
    if (done) modal.close();
  });

  return modal;
}
