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
 *  - Etkinlik tam sayfa açılır; başlıkta etkinliğin adı görünür (uzunsa üç nokta) ve dokunulunca metin kutusuna dönüşür.
 *  - "Tüm gün" açılınca bitiş tarihi başlangıçla aynı olur.
 *  - Açıklama Markdown ile yazılır; canlı önizleme: aktif satır ham markup, diğer satırlar işlenmiş (bkz. markdownEditor.js).
 *    Köşesindeki düğme tam ekran düzenleme açar.
 *  - Renk: modern palet (12 ton × 3 yoğunluk) + özel renk (renk seçici veya hex kodu); bkz. colorPicker.js.
 */
import { html } from '../core/dom.js';
import { eventRepo, attachmentRepo } from '../core/eventRepo.js';
import { store } from '../core/state.js';
import { formatDate, todayISO } from '../core/dateUtils.js';
import { EVENT_COLORS, normalizeHexColor, REMINDER_OPTIONS, STATUSES, STATUS_LABELS } from '../core/eventModel.js';
import { createColorPicker } from './colorPicker.js';
import { createMarkdownEditor } from './markdownEditor.js';
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
  // Renk: modern palet (12 ton × 3 yoğunluk) veya özel renk; seçici mevcut renkten başlar (bkz. colorPicker.js)
  const currentColor = normalizeHexColor(ev.color) || EVENT_COLORS[0];
  let colorValue = currentColor;
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

    <div class="field">
      <div class="field-head">
        <label data-description-label>Açıklama <span class="muted">· Markdown</span></label>
        <button type="button" class="icon-btn icon-btn-sm" data-expand-description aria-label="Açıklamayı tam ekranda düzenle" title="Tam ekran">${icon('expand')}</button>
      </div>
      <div data-description-host></div>
    </div>

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

    <fieldset class="field-group">
      <legend>Renk</legend>
      <div data-color-host></div>
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

  // Açıklama: canlı önizlemeli Markdown editörü (aktif satır ham markup, diğerleri işlenmiş; bkz. markdownEditor.js).
  // Tam metin `description` adlı gizli bir textarea'da tutulur ve formun parçasıdır.
  const description = createMarkdownEditor({
    name: 'description',
    value: ev.description,
    placeholder: 'Notlar, bağlantılar… Markdown ile biçimlendirebilirsiniz',
  });
  form.querySelector('[data-description-host]').replaceWith(description.el);
  form.querySelector('[data-description-label]').addEventListener('click', () => description.focus());

  // Başlık alanı modal başlığındadır: etkinliğin adı görünür (uzunsa üç nokta), dokununca metin kutusuna dönüşür.
  // Form dışında durduğu için `form` özniteliğiyle forma bağlanır (form.elements.title, Enter ile kaydetme çalışır).
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.name = 'title';
  titleInput.className = 'modal-title-input';
  titleInput.value = ev.title;
  titleInput.title = ev.title; // uzun ad üç noktayla kısaldığında tamamı ipucu olarak görünür
  titleInput.maxLength = 200;
  titleInput.required = true;
  titleInput.autocomplete = 'off';
  titleInput.placeholder = isEdit ? 'Etkinlik adı' : 'Yeni etkinlik';
  titleInput.setAttribute('form', 'event-form');
  titleInput.setAttribute('aria-label', 'Etkinlik adı');

  // Etkinlik tam sayfa açılır; düzenlemede hiçbir alan odaklanmaz (ad dokunulana kadar düz metin gibi görünür), yenisinde ad odaklanır
  const modal = openModal({
    title: isEdit ? 'Etkinliği düzenle' : 'Yeni etkinlik',
    titleNode: titleInput,
    body: form,
    footer,
    size: 'lg',
    className: 'modal--page',
    initialFocus: isEdit ? 'dialog' : 'first',
  });
  const f = form.elements;

  // --- Dinamik alan davranışları ---
  const syncAllDay = () => form.classList.toggle('is-allday', f.allDay.checked);
  const syncRecurrence = () => form.classList.toggle('has-recurrence', Boolean(f.freq.value));
  syncAllDay();
  syncRecurrence();
  f.allDay.addEventListener('change', () => {
    syncAllDay();
    // Tüm gün seçilince başlangıç ve bitiş tarihi aynı olur (çok günlü yapmak için bitiş sonradan değiştirilebilir)
    if (f.allDay.checked) f.endDate.value = f.startDate.value;
  });
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

  // --- Renk seçici ---
  const picker = createColorPicker({ value: currentColor, onChange: (c) => (colorValue = c) });
  form.querySelector('[data-color-host]').replaceWith(picker.el);

  // --- Açıklama: tam ekran düzenleme ---
  // Ayrı bir modal olarak açılır (üstteki modal Esc ile kapanır, editör açık kalır); yazılanlar anında forma yansır.
  form.querySelector('[data-expand-description]').addEventListener('click', () => {
    const full = createMarkdownEditor({ value: description.getValue(), placeholder: f.description.placeholder, fullscreen: true });
    full.textarea.addEventListener('input', () => description.setValue(full.getValue()));
    const doneBar = document.createElement('div');
    doneBar.className = 'modal-actions';
    doneBar.innerHTML = html`<button type="button" class="btn btn-primary" data-done>${icon('collapse')} Bitti</button>`;
    const fullModal = openModal({ title: 'Açıklama', body: full.el, footer: doneBar, size: 'lg', className: 'modal--fullscreen' });
    doneBar.querySelector('[data-done]').addEventListener('click', () => fullModal.close());
    full.focus();
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
      color: colorValue,
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
  f.title.addEventListener('input', () => {
    f.title.classList.remove('is-invalid');
    f.title.title = f.title.value;
  });
  // Başlık girdisi formun DOM'u dışında olduğu için Ctrl+Enter'ı burada da dinle
  f.title.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(e);
  });
  footer.querySelector('[data-cancel]').addEventListener('click', () => modal.close());
  footer.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const done = occurrence ? await deleteOccurrence(occurrence, scope) : await deleteEventWithUndo(ev.id);
    if (done) modal.close();
  });

  return modal;
}
