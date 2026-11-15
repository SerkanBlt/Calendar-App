/**
 * markdownEditor.js — Canlı önizlemeli Markdown editörü ("live preview": Obsidian tarzı).
 *
 * Yaz/Önizle sekmesi yoktur: imlecin bulunduğu (aktif) satır ham Markdown olarak (işaretleriyle) görünür ve düzenlenir,
 * diğer tüm satırlar işlenmiş (önizleme) halde kalır. Bir satıra dokununca/tıklayınca o satır ham hale geçer.
 *
 * Nasıl çalışır: metin satırlara bölünür; her satır bir "satır kutusu"dur (işlenmiş görünüm + gizli bir <textarea>). Aktif satırın
 * textarea'sı görünür, diğerlerinin işlenmiş görünümü (core/markdown.js → renderLineRows) gösterilir. Satırlar arası geçiş, bölme ve birleştirme
 * bu bileşende yapılır:
 *   Enter satırı böler (liste/alıntı işareti sürer, boş öğede liste biter) · satır başında Backspace / satır sonunda Delete birleştirir ·
 *   ↑ ↓ ← → satırlar arasında gezer · çok satırlı yapıştırma satırlara bölünür · görev kutusuna tıklamak [ ] / [x] değiştirir.
 * Sınırlama: doğal seçim tek satırla sınırlıdır; Ctrl/⌘+A tüm metni seçer (kopyala, kes, sil ve üzerine yazma çalışır) ama satırlar arası
 * fare/parmakla seçim yoktur.
 * Yükseklik: kutunun sağ alt köşesindeki tutamak (.md-grip) sürüklenerek (fare/dokunma) ya da ↑ ↓ ile büyütülüp küçültülür; çift tıklama otomatik yüksekliğe döner.
 * Tam metin her değişiklikte gizli bir <textarea>'ya (`textarea`, isteğe bağlı `name`) yazılır ve oradan `input` olayı yayılır; böylece form
 * onu sıradan bir alan gibi okur.
 *
 * Araç çubuğu: kalın, italik, üstü çizili, kod, bağlantı, başlık, madde/numaralı/görev listesi, alıntı (Ctrl/⌘+B ve +I). Aktif satıra uygulanır.
 * Markdown dönüşümleri ve güvenlik (XSS) garantisi core/markdown.js'tedir.
 */
import { html } from '../core/dom.js';
import { applyFormat, lineContentStart, listContinuation, renderLineRows } from '../core/markdown.js';
import { icon } from './icons.js';

const TOOLS = [
  { kind: 'bold', icon: 'bold', title: 'Kalın (Ctrl+B)' },
  { kind: 'italic', icon: 'italic', title: 'İtalik (Ctrl+I)' },
  { kind: 'strike', icon: 'strike', title: 'Üstü çizili' },
  { kind: 'code', icon: 'code', title: 'Kod' },
  { kind: 'link', icon: 'link', title: 'Bağlantı' },
  { kind: 'h', icon: 'heading', title: 'Başlık' },
  { kind: 'ul', icon: 'list', title: 'Madde işaretli liste' },
  { kind: 'ol', icon: 'listOrdered', title: 'Numaralı liste' },
  { kind: 'task', icon: 'checkSquare', title: 'Görev listesi' },
  { kind: 'quote', icon: 'quote', title: 'Alıntı' },
];

const TASK_BOX = /^(\s*(?:[-*+]|\d{1,9}[.)])\s+\[)([ xX])(\]\s)/;
const normalizeNewlines = (t) => String(t ?? '').replace(/\r\n?/g, '\n');
const autosize = (ta) => {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight}px`;
};

/**
 * @param {{name?: string, value?: string, placeholder?: string, fullscreen?: boolean}} [options]
 * @returns {{el: HTMLElement, textarea: HTMLTextAreaElement, getValue: () => string, setValue: (v: string) => void, focus: () => void}}
 */
export function createMarkdownEditor({ name = '', value = '', placeholder = '', fullscreen = false } = {}) {
  const root = document.createElement('div');
  root.className = `md-editor md-live${fullscreen ? ' md-editor--full' : ''}`;
  root.innerHTML = html`
    <div class="md-bar">
      <div class="md-tools" role="toolbar" aria-label="Biçimlendirme">
        ${TOOLS.map((t) => html`<button type="button" class="icon-btn icon-btn-sm" data-md-tool="${t.kind}" title="${t.title}" aria-label="${t.title}">${icon(t.icon)}</button>`)}
      </div>
    </div>
    <div class="md-box">
      <div class="md-surface" role="group" aria-label="Açıklama"></div>
      ${fullscreen ? '' : html`<div class="md-grip" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="Açıklama alanının yüksekliğini ayarla" title="Sürükleyerek büyüt / küçült (çift tıklama: otomatik yükseklik)"></div>`}
    </div>
    <textarea class="md-value" hidden tabindex="-1" aria-hidden="true" ${name ? html`name="${name}"` : ''} placeholder="${placeholder}"></textarea>`;
  const surface = root.querySelector('.md-surface');
  const store = root.querySelector('.md-value');
  const grip = root.querySelector('.md-grip');

  /** @type {{el: HTMLElement, view: HTMLElement, edit: HTMLTextAreaElement, shown: string|null}[]} */
  let rows = [];
  let active = -1;
  let allSelected = false;

  const rowOfEdit = (t) => rows.findIndex((r) => r.edit === t);
  const rowOfView = (v) => rows.findIndex((r) => r.view === v);
  const texts = () => rows.map((r) => r.edit.value);

  function makeRow(text) {
    const el = document.createElement('div');
    el.className = 'md-row';
    const view = document.createElement('div');
    view.className = 'md-view md';
    const edit = document.createElement('textarea');
    edit.className = 'md-edit';
    edit.rows = 1;
    edit.hidden = true;
    edit.value = text;
    edit.autocomplete = 'off';
    edit.setAttribute('aria-label', 'Açıklama satırı');
    el.append(view, edit);
    return { el, view, edit, shown: null };
  }

  function setRows(list) {
    rows = list.map(makeRow);
    surface.replaceChildren(...rows.map((r) => r.el));
    rows[0].view.tabIndex = 0; // klavyeyle (Tab) editöre girilebilsin
    active = -1;
  }

  /** İşlenmiş görünümleri günceller (aktif satır hariç: onun ham metni textarea'dadır). */
  function refresh() {
    const list = renderLineRows(texts());
    const empty = rows.length === 1 && !rows[0].edit.value;
    rows.forEach((r, i) => {
      const item = list[i];
      r.el.dataset.kind = item.kind;
      r.el.dataset.edge = item.edge ?? '';
      r.el.dataset.task = item.task ? 'true' : '';
      r.el.dataset.done = item.done ? 'true' : '';
      r.el.style.setProperty('--depth', String(item.depth));
      const markup = empty ? String(html`<span class="md-placeholder">${placeholder}</span>`) : item.html;
      if (i !== active && r.shown !== markup) {
        r.view.innerHTML = markup;
        r.shown = markup;
      }
      r.edit.placeholder = empty ? placeholder : '';
    });
    root.classList.toggle('is-empty', empty);
  }

  /** Tam metni gizli alana yazar (form buradan okur) ve görünümleri günceller. */
  function commit() {
    const v = texts().join('\n');
    if (store.value !== v) {
      store.value = v;
      store.dispatchEvent(new Event('input', { bubbles: true }));
    }
    refresh();
  }

  function hideEditor(r) {
    r.edit.hidden = true;
    r.view.hidden = false;
    r.el.classList.remove('is-active');
  }

  /** i. satırı aktif yapar (ham markup görünür, odak oraya gelir). caret: 'start' | 'end' | konum. */
  function activate(i, caret = 'end') {
    if (!rows.length) return;
    const index = Math.max(0, Math.min(i, rows.length - 1));
    const prev = active;
    const row = rows[index];
    row.edit.hidden = false;
    row.el.classList.add('is-active');
    active = index;
    autosize(row.edit);
    // Sıra önemli: önce yeni kutu odaklanır, sonra işlenmiş görünüm gizlenir. Odaklı bir öğe (Tab ile gelinen görünüm) önce
    // gizlenirse tarayıcı odağı bırakıp focusout tetikler ve editör kapanır; eski satır da yeni odak kurulmadan gizlenmez (mobilde klavye kesilmez).
    row.edit.focus({ preventScroll: true });
    row.view.hidden = true;
    const len = row.edit.value.length;
    const pos = caret === 'end' ? len : caret === 'start' ? 0 : Math.max(0, Math.min(caret, len));
    row.edit.setSelectionRange(pos, pos);
    if (prev >= 0 && prev !== index && rows[prev]) hideEditor(rows[prev]);
    refresh();
    row.el.scrollIntoView?.({ block: 'nearest' });
  }

  function deactivateAll() {
    rows.forEach(hideEditor);
    active = -1;
    refresh();
  }

  function insertRowAfter(i, text) {
    const row = makeRow(text);
    rows[i].el.after(row.el);
    rows.splice(i + 1, 0, row);
    return row;
  }

  function removeRow(i) {
    rows[i].el.remove();
    rows.splice(i, 1);
    if (active > i) active -= 1;
  }

  /** Enter: satırı imleçten böler; liste/alıntı işareti sürer, boş öğede liste biter. */
  function splitAt(i) {
    const ta = rows[i].edit;
    const v = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const cont = listContinuation(v);
    if (cont.clear && s === v.length && e === v.length) {
      ta.value = ''; // boş liste öğesinde Enter: işaret silinir, liste biter
      autosize(ta);
      ta.setSelectionRange(0, 0);
      commit();
      return;
    }
    const prefix = s >= lineContentStart(v) ? cont.prefix : '';
    const after = v.slice(e);
    ta.value = v.slice(0, s);
    insertRowAfter(i, prefix + after);
    activate(i + 1, prefix.length);
    commit();
  }

  /** Satır başında Backspace: satırı öncekiyle birleştirir. */
  function mergeUp(i) {
    const prev = rows[i - 1];
    const joinAt = prev.edit.value.length;
    prev.edit.value += rows[i].edit.value;
    activate(i - 1, joinAt);
    removeRow(i);
    commit();
  }

  /** Satır sonunda Delete: sonraki satırı bu satıra katar. */
  function mergeDown(i) {
    const ta = rows[i].edit;
    const at = ta.value.length;
    ta.value += rows[i + 1].edit.value;
    removeRow(i + 1);
    autosize(ta);
    ta.setSelectionRange(at, at);
    commit();
  }

  /** i. satırın yerine (satır sonları içerebilen) metni koyar; imleç `caretIndex` konumuna gelir. */
  function replaceRowWithText(i, full, caretIndex) {
    const parts = full.split('\n');
    const upTo = full.slice(0, caretIndex).split('\n');
    rows[i].edit.value = parts[0];
    let anchor = i;
    parts.slice(1).forEach((p) => {
      insertRowAfter(anchor, p);
      anchor += 1;
    });
    activate(i + upTo.length - 1, upTo[upTo.length - 1].length);
    commit();
  }

  // ---- Ctrl/⌘+A: tüm metni seç (satırlar ayrı alanlar olduğu için sahte seçim durumu) ----
  function setAllSelected(on) {
    allSelected = on;
    surface.classList.toggle('is-all-selected', on);
  }
  function replaceAll(text) {
    setAllSelected(false);
    setRows(normalizeNewlines(text).split('\n'));
    activate(rows.length - 1, 'end');
    commit();
  }

  function format(kind) {
    if (allSelected) setAllSelected(false);
    if (active < 0) activate(rows.length - 1, 'end');
    const ta = rows[active].edit;
    const r = applyFormat(ta.value, ta.selectionStart, ta.selectionEnd, kind);
    ta.value = r.value;
    autosize(ta);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(r.start, r.end);
    commit();
  }

  function toggleTask(i) {
    const ta = rows[i].edit;
    if (!TASK_BOX.test(ta.value)) return;
    ta.value = ta.value.replace(TASK_BOX, (_, a, mark, c) => `${a}${mark === ' ' ? 'x' : ' '}${c}`);
    commit();
  }

  /** Tıklanan noktanın işlenmiş satırdaki yerini ham metindeki konuma yaklaşık olarak çevirir. */
  function caretFromClick(i, view, e) {
    const raw = rows[i].edit.value;
    const start = lineContentStart(raw);
    const body = view.querySelector('.md-li-body') || view;
    let node = null;
    let offset = 0;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(e.clientX, e.clientY);
      node = p?.offsetNode ?? null;
      offset = p?.offset ?? 0;
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(e.clientX, e.clientY);
      node = r?.startContainer ?? null;
      offset = r?.startOffset ?? 0;
    }
    if (!node || !body.contains(node)) return 'end';
    const range = document.createRange();
    range.selectNodeContents(body);
    range.setEnd(node, offset);
    const total = body.textContent.length;
    return total ? start + Math.round((raw.length - start) * (range.toString().length / total)) : start;
  }

  // ---------------------------------------------------------------------------
  // Olaylar (satır kutuları dinamik olduğu için üst öğede, delegasyonla)
  // ---------------------------------------------------------------------------

  // Araç düğmelerine basmak metin alanından odağı/seçimi almasın
  root.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-md-tool]')) e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    const tool = e.target.closest('[data-md-tool]');
    if (tool) format(tool.dataset.mdTool);
  });

  surface.addEventListener('mousedown', (e) => {
    if (e.target.closest('a')) return; // bağlantılar açılabilsin
    if (e.target.closest('.md-view') || e.target === surface) e.preventDefault(); // odak click'te verilir
  });
  surface.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const check = e.target.closest('.md-check');
    if (check) {
      e.preventDefault();
      toggleTask(rowOfView(check.closest('.md-view')));
      return;
    }
    if (allSelected) setAllSelected(false);
    const view = e.target.closest('.md-view');
    if (view) activate(rowOfView(view), caretFromClick(rowOfView(view), view, e));
    else if (e.target === surface) activate(rows.length - 1, 'end');
  });

  surface.addEventListener('focusin', (e) => {
    const v = rowOfView(e.target);
    if (v >= 0) activate(v, 'end'); // Tab ile ilk satıra gelindi
  });
  surface.addEventListener('focusout', (e) => {
    if (!surface.contains(e.relatedTarget)) {
      setAllSelected(false);
      deactivateAll(); // odak editörden çıktı: tüm satırlar işlenmiş görünüme döner
    }
  });

  surface.addEventListener('beforeinput', (e) => {
    const i = rowOfEdit(e.target);
    if (i < 0) return;
    if (allSelected) {
      e.preventDefault();
      replaceAll(e.inputType.startsWith('insert') && e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph' ? e.data ?? '' : '');
      return;
    }
    if (e.isComposing) return;
    const ta = e.target;
    const caretOnly = ta.selectionStart === ta.selectionEnd;
    if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
      e.preventDefault();
      splitAt(i);
    } else if (e.inputType === 'deleteContentBackward' && caretOnly && ta.selectionStart === 0 && i > 0) {
      e.preventDefault();
      mergeUp(i);
    } else if (e.inputType === 'deleteContentForward' && caretOnly && ta.selectionStart === ta.value.length && i < rows.length - 1) {
      e.preventDefault();
      mergeDown(i);
    }
  });

  surface.addEventListener('input', (e) => {
    const i = rowOfEdit(e.target);
    if (i < 0) return;
    const ta = e.target;
    if (ta.value.includes('\n') || ta.value.includes('\r')) {
      replaceRowWithText(i, normalizeNewlines(ta.value), ta.selectionStart); // ör. satır sonlu metin doğrudan atandı
      return;
    }
    autosize(ta);
    commit();
  });

  surface.addEventListener('paste', (e) => {
    const i = rowOfEdit(e.target);
    if (i < 0) return;
    const text = normalizeNewlines(e.clipboardData?.getData('text/plain'));
    if (allSelected) {
      e.preventDefault();
      replaceAll(text);
    } else if (text.includes('\n')) {
      e.preventDefault();
      const ta = e.target;
      const before = ta.value.slice(0, ta.selectionStart);
      replaceRowWithText(i, before + text + ta.value.slice(ta.selectionEnd), (before + text).length);
    }
  });
  surface.addEventListener('copy', (e) => {
    if (!allSelected) return;
    e.clipboardData.setData('text/plain', store.value);
    e.preventDefault();
  });
  surface.addEventListener('cut', (e) => {
    if (!allSelected) return;
    e.clipboardData.setData('text/plain', store.value);
    e.preventDefault();
    replaceAll('');
  });

  surface.addEventListener('keydown', (e) => {
    const i = rowOfEdit(e.target);
    if (i < 0) return;
    const ta = e.target;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'a' && rows.length > 1) {
      e.preventDefault();
      setAllSelected(true);
      return;
    }
    if (allSelected) {
      if (mod && ['c', 'x', 'v'].includes(key)) return; // kopyala / kes / yapıştır kendi olaylarında
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
        e.preventDefault();
        replaceAll('');
      } else if (e.key.length === 1 && !mod && !e.altKey) {
        e.preventDefault();
        replaceAll(e.key);
      } else if (!['Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) setAllSelected(false);
      return;
    }
    if (mod && !e.shiftKey && !e.altKey && (key === 'b' || key === 'i')) {
      e.preventDefault();
      format(key === 'b' ? 'bold' : 'italic');
      return;
    }
    if (mod || e.shiftKey || e.altKey) return; // seçim genişletme vb. yerel kalsın

    const start = ta.selectionStart;
    const collapsed = start === ta.selectionEnd;
    const singleLine = ta.scrollHeight <= (parseFloat(getComputedStyle(ta).lineHeight) || 21) * 1.5;
    if (e.key === 'ArrowLeft' && collapsed && start === 0 && i > 0) {
      e.preventDefault();
      activate(i - 1, 'end');
    } else if (e.key === 'ArrowRight' && collapsed && start === ta.value.length && i < rows.length - 1) {
      e.preventDefault();
      activate(i + 1, 'start');
    } else if (e.key === 'ArrowUp' && i > 0 && singleLine) {
      e.preventDefault();
      activate(i - 1, Math.min(start, rows[i - 1].edit.value.length));
    } else if (e.key === 'ArrowDown' && i < rows.length - 1 && singleLine) {
      e.preventDefault();
      activate(i + 1, Math.min(start, rows[i + 1].edit.value.length));
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !singleLine) {
      // Birden çok görsel satıra sarılmış satır: önce yerel gezinme; imleç yerinde kaldıysa (kenardayız) komşu satıra geç
      setTimeout(() => {
        if (active !== i || ta.selectionStart !== start || ta.selectionEnd !== start) return;
        if (e.key === 'ArrowUp' && i > 0) activate(i - 1, Math.min(start, rows[i - 1].edit.value.length));
        else if (e.key === 'ArrowDown' && i < rows.length - 1) activate(i + 1, Math.min(start, rows[i + 1].edit.value.length));
      }, 0);
    }
  });

  // ---- Yükseklik tutamağı (eski büyütülebilir metin kutusundaki köşe tutamağının karşılığı) ----
  // Varsayılan: içeriğe göre otomatik yükseklik. Tutamakla sürüklenince yükseklik sabitlenir (içerik kutu içinde kayar). Fare, dokunma ve klavye
  // (↑ ↓, Home/çift tıklama = otomatik) ile çalışır. Tam ekran düzenleyicide yoktur (zaten ekranı kaplar).
  if (grip) {
    const MIN_H = 96;
    const STEP = 32;
    const maxH = () => Math.max(240, Math.round(window.innerHeight * 0.85));
    const setHeight = (h) => {
      if (h == null) {
        surface.style.height = '';
        surface.classList.remove('is-sized');
        return;
      }
      surface.style.height = `${Math.max(MIN_H, Math.min(maxH(), Math.round(h)))}px`;
      surface.classList.add('is-sized');
    };
    let drag = null;
    grip.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, y: e.clientY, h: surface.offsetHeight };
      grip.classList.add('is-dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      setHeight(drag.h + (e.clientY - drag.y));
      grip.scrollIntoView?.({ block: 'nearest' }); // büyürken tutamak görünür kalsın (kaydırılan pencerede)
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      grip.classList.remove('is-dragging');
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => setHeight(null));
    grip.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setHeight(surface.offsetHeight + (e.key === 'ArrowDown' ? STEP : -STEP));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setHeight(null);
      }
    });
  }

  // ---- Başlangıç ----
  const initial = normalizeNewlines(value);
  setRows(initial.split('\n'));
  store.value = initial;
  refresh();

  return {
    el: root,
    textarea: store,
    getValue: () => store.value,
    setValue(v) {
      const text = normalizeNewlines(v);
      setAllSelected(false);
      setRows(text.split('\n'));
      store.value = text;
      store.dispatchEvent(new Event('input', { bubbles: true }));
      refresh();
    },
    focus: () => activate(rows.length - 1, 'end'),
  };
}
