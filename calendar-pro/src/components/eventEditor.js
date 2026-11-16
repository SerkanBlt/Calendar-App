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
 *    İlk açılışta (tam ekranda da) tüm satırlar önizlemededir; bir satıra dokununca o satır ham hale geçer.
 *    Köşesindeki düğme tam ekran düzenleme açar.
 *  - Renk: modern palet (12 ton × 3 yoğunluk) + özel renk (renk seçici veya hex kodu); bkz. colorPicker.js.
 */
import { html } from '../core/dom.js';
import { eventRepo, attachmentRepo } from '../core/eventRepo.js';
import { store } from '../core/state.js';
import { formatDate, shiftEnd, todayISO } from '../core/dateUtils.js';
import { EVENT_COLORS, normalizeHexColor, REMINDER_OPTIONS, STATUSES, STATUS_LABELS } from '../core/eventModel.js';
import { createColorPicker } from './colorPicker.js';
import { createMarkdownEditor } from './markdownEditor.js';
import { createRecurrenceEditor } from './recurrenceEditor.js';
import { projectNames } from '../services/ganttProjects.js';
import { deleteEventWithUndo, deleteOccurrence } from '../core/actions.js';
import { choiceDialog, openModal } from './modal.js';
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
  const projects = projectNames(events); // mevcut Gantt projeleri: yazarak ya da listeden seçerek verilir
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

    <div class="field-grid field-grid--when">
      <label class="field"><span>Başlangıç</span><input type="date" name="startDate" value="${initialRange.start}" required /></label>
      <label class="field time-field"><span>Saat</span><input type="time" name="startTime" value="${ev.startTime || '09:00'}" step="300" /></label>
      <label class="field"><span>Bitiş</span><input type="date" name="endDate" value="${initialRange.end}" required /></label>
      <label class="field time-field"><span>Saat</span><input type="time" name="endTime" value="${ev.endTime || '10:00'}" step="300" /></label>
      <div class="time-link-cell"><button type="button" class="time-link" data-time-link aria-pressed="true"></button></div>
    </div>

    <div class="field">
      <div class="field-head">
        <label data-description-label>Açıklama</label>
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

    <div data-rec-host></div>

    ${depCandidates.length
      ? html`<details class="field deps series-only" ${ev.dependencies.length ? 'open' : ''}>
          <summary>${icon('link')} Bağımlılıklar <span class="muted">(Gantt — önce bitmesi gerekenler)</span></summary>
          <div class="dep-list">
            ${depCandidates.map((d) => html`<label class="dep-item"><input type="checkbox" name="dependencies" value="${d.id}" ${ev.dependencies.includes(d.id) ? 'checked' : ''} /><span class="dot" style="--ev-color:${d.color}"></span>${d.title}${d.project ? html` <span class="muted">· ${d.project}</span>` : ''}</label>`)}
          </div>
        </details>`
      : ''}

    <label class="field series-only">
      <span>${icon('gantt')} Gantt projesi <span class="muted">(Gantt'ta bu projenin altında gruplanır)</span></span>
      <input name="project" list="project-options" value="${ev.project || ''}" placeholder="ör. Web sitesi yenileme — yazın ya da listeden seçin" maxlength="80" autocomplete="off" />
      <datalist id="project-options">${projects.map((p) => html`<option value="${p}"></option>`)}</datalist>
    </label>

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

  // Tekrar: sıklık + desen (iş günleri, belirli günler, ayın N. günü/haftası, çeyrek …) + "Tüm tarihler" listesi (değiştir/sil/ekle); bkz. recurrenceEditor.js
  const recurrence = createRecurrenceEditor({
    recurrence: ev.recurrence,
    getStartDate: () => form.elements.startDate?.value,
    settings,
    // "Yalnızca bu" ile ayrı düzenlenmiş örnekler: orijinal tarih → kayıt (listede "Ayrı düzenlendi" etiketi için)
    detached: isEdit ? Object.fromEntries(events.filter((e) => e.seriesId === ev.id && e.originalDate).map((e) => [e.originalDate, e])) : {},
  });
  form.querySelector('[data-rec-host]').replaceWith(recurrence.el);

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
    onClose: () => description.destroy(), // CodeMirror belge düzeyinde dinleyici bırakır: pencere kapanınca temizlenir
    canClose: () => confirmLeave(), // kaydedilmemiş değişiklik varsa ✕ / Esc / perde / İptal ile çıkarken sorar
  });
  const f = form.elements;

  // --- Dinamik alan davranışları ---
  const syncAllDay = () => form.classList.toggle('is-allday', f.allDay.checked);
  syncAllDay();
  f.allDay.addEventListener('change', () => {
    syncAllDay();
    // Tüm gün seçilince başlangıç ve bitiş tarihi aynı olur (çok günlü yapmak için bitiş sonradan değiştirilebilir)
    if (f.allDay.checked) f.endDate.value = f.startDate.value;
    commitRange();
  });
  f.progress.addEventListener('input', () => (f.progressOut.value = `${f.progress.value}%`));

  // --- Başlangıç–bitiş bağı ---
  // Bağ AÇIKKEN başlangıç tarihi/saati değişince bitiş, aradaki süre korunacak biçimde birlikte kayar (gece yarısını aşarsa bitiş tarihi ilerler).
  // Bağ KAPALIYKEN iki uç birbirinden bağımsızdır (yalnızca bitiş başlangıçtan önceye düşemez). Bağ her açılışta AÇIKTIR; kalıcı bir ayar değildir
  // ve "değişiklik yapıldı" sayılmaz (collect/snapshot'a girmez). Süre, son bilinen aralıktan (lastRange) hesaplanır: bitişi elle değiştirmek süreyi günceller.
  const timeLink = form.querySelector('[data-time-link]');
  let linked = true;
  const readRange = () => ({ startDate: f.startDate.value, startTime: f.startTime.value, endDate: f.endDate.value, endTime: f.endTime.value });
  let lastRange = readRange();
  // Süre kaydı yalnızca dört alan da doluyken yenilenir: kullanıcı saati silip yeniden yazarken (geçici boş değer) önceki süre kaybolmaz
  const commitRange = () => {
    const r = readRange();
    if (r.startDate && r.startTime && r.endDate && r.endTime) lastRange = r;
  };
  const syncTimeLink = () => {
    timeLink.setAttribute('aria-pressed', String(linked));
    const label = linked ? 'Başlangıç ve bitiş arasındaki süre korunuyor. Bağı kopartmak için dokunun.' : 'Başlangıç ve bitiş birbirinden bağımsız. Süreyi korumak için bağı yeniden kurun.';
    timeLink.setAttribute('aria-label', label);
    timeLink.title = linked ? 'Süre korunuyor — bağı kopar' : 'Bağ kopuk — süreyi koru';
    timeLink.innerHTML = icon(linked ? 'link' : 'unlink');
  };
  syncTimeLink();
  timeLink.addEventListener('click', () => {
    linked = !linked;
    commitRange(); // yeniden bağlanırken o anki fark korunacak süre olur
    syncTimeLink();
  });
  const onStartChange = () => {
    const shifted = linked && !f.allDay.checked ? shiftEnd(lastRange, readRange()) : null;
    if (shifted) {
      f.endDate.value = shifted.endDate;
      f.endTime.value = shifted.endTime;
    } else if (f.endDate.value < f.startDate.value) {
      f.endDate.value = f.startDate.value; // bağsızken (ya da tüm gün): bitiş başlangıçtan önceye düşmesin
    }
    commitRange();
  };
  for (const name of ['startDate', 'startTime']) for (const type of ['input', 'change']) f[name].addEventListener(type, onStartChange);
  for (const type of ['input', 'change']) f.startDate.addEventListener(type, () => recurrence.onStartChange()); // başlangıcı izleyen desen alanları (haftanın günü, ayın günü…) ve tarih listesi yenilenir
  for (const name of ['endDate', 'endTime']) for (const type of ['input', 'change']) f[name].addEventListener(type, commitRange);
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
    // Tam ekran da önizlemede açılır (odak yok: hiçbir satır ham değil); düzenlemek için bir satıra dokunulur
    const fullModal = openModal({ title: 'Açıklama', body: full.el, footer: doneBar, size: 'lg', className: 'modal--fullscreen', initialFocus: 'dialog', onClose: () => full.destroy() });
    doneBar.querySelector('[data-done]').addEventListener('click', () => fullModal.close());
  });

  // --- Tekrarlayan örnek: kapsam seçimi ---
  // "Yalnızca bu" modunda tarih alanları örneğin tarihini, "Tüm seri" modunda serinin başlangıcını gösterir;
  // tekrar kuralı, bağımlılıklar ve ekler yalnızca seri düzeyinde düzenlenebilir.
  function syncScope(next) {
    if (next && next !== scope) {
      const wasDirty = isDirty(); // kapsamı değiştirmek tarihleri yeniden yazar; kullanıcı başka bir şey düzenlemediyse bu bir "değişiklik" sayılmaz
      const range = dateRanges[next];
      f.startDate.value = range.start;
      f.endDate.value = range.end;
      commitRange(); // tarihler programla yazıldı (olay tetiklenmez): bağın süre kaydı yenilensin
      recurrence.onStartChange();
      scope = next;
      if (!wasDirty) baseline = snapshot();
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
  let baseline; // açılıştaki form durumu (bkz. aşağıdaki "Kaydedilmemiş değişiklik denetimi")
  const snapshot = () => JSON.stringify({ ...collect(), scope, pending: pendingFiles.map((file) => `${file.name}:${file.size}`) });
  const isDirty = () => baseline !== undefined && snapshot() !== baseline;

  /** Çıkmadan önce: değişiklik yoksa true; varsa Kaydet / Kaydetme / Vazgeç sorar. Yalnızca "Kaydetme" çıkışa izin verir; "Kaydet" kaydeder (başarılıysa kendisi kapatır). */
  async function confirmLeave() {
    if (!isDirty()) return true;
    const choice = await choiceDialog({
      title: 'Değişiklikler kaydedilsin mi?',
      message: 'Bu etkinlikte kaydedilmemiş değişiklikler var. Kaydetmeden çıkarsanız kaybolacak.',
      choices: [
        { value: 'save', label: 'Kaydet', variant: 'btn-primary' },
        { value: 'discard', label: 'Kaydetme', variant: 'btn-danger-ghost' },
      ],
    });
    if (choice === 'discard') return true;
    if (choice === 'save') await submit(); // doğrulama hatasında (ör. boş ad) pencere açık kalır, ilgili alan odaklanır
    return false;
  }

  function collect() {
    const isAllDay = f.allDay.checked;
    const deps = f.dependencies ? [...form.querySelectorAll('input[name="dependencies"]:checked')].map((n) => n.value) : ev.dependencies;
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
      project: f.project.value,
      critical: f.critical.checked,
      reminder: Number(f.reminder.value),
      recurrence: recurrence.getRule(), // silinmiş/eklenmiş/ayrılmış örnek tarihleri (exdates/rdates) kural içinde korunur
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
  footer.querySelector('[data-cancel]').addEventListener('click', () => modal.requestClose());
  footer.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const done = occurrence ? await deleteOccurrence(occurrence, scope) : await deleteEventWithUndo(ev.id);
    if (done) modal.close();
  });

  // --- Kaydedilmemiş değişiklik denetimi ---
  // Form durumunun anlık görüntüsü açılışta alınır; çıkarken (✕, Esc, perde, İptal) bugünkü durumla karşılaştırılır. Değişiklik yapılıp geri alınırsa
  // (başlangıç hâline dönülürse) sorulmaz. Kayıt ve silme `modal.close()` ile doğrudan kapatır, sorulmaz.
  baseline = snapshot();

  return modal;
}
