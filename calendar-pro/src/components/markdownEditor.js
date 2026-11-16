/**
 * markdownEditor.js — Canlı önizlemeli Markdown editörü (Obsidian tarzı), CodeMirror 6 üzerinde.
 *
 * Tek parça bir metin düzenleyicidir (tek `contenteditable`): satırlar arası seçim ve seçim tutamakları, imleç/klavye, IME, kopyala-yapıştır ve
 * geri al/yinele tarayıcının ve CodeMirror'ın yerel haliyle çalışır. Canlı önizleme yalnızca görünümdür (bkz. markdownLive.js): imlecin/seçimin değdiği
 * satırlar ham Markdown (işaretleriyle), diğer satırlar işlenmiş görünür. Düzenleyici odaksızken (ör. ilk açılış) hiçbir satır ham değildir.
 *
 * Enter: liste/alıntı işareti yeni satıra sürer (numara artar), boş öğede Enter listeyi bitirir. Araç çubuğu: kalın, italik, üstü çizili, kod, bağlantı, başlık,
 * madde/numaralı/görev listesi, alıntı (Ctrl/⌘+B ve +I). Çubuk NOT PANELİNİN İÇİNDE, üstte (dock=top) durur: CodeMirror paneli olarak kutunun kenarlığıyla bir bütündür
 * ve içerik kutu içinde kayarken sabit kalır. Seçime/satırlara uygulanır; seçim YOKKEN de anlamlı çalışır: imleç bir kelimedeyse kelime sarılır/açılır, boşluktaysa
 * `**|**` gibi boş bir çift bırakılır (core/markdown.js → formatAtCaret).
 * Yükseklik: sağ alt köşedeki tutamak (.md-grip) sürüklenerek (fare/dokunma) ya da ↑ ↓ ile ayarlanır; çift tıklama otomatik yüksekliğe döner.
 * Tam metin her değişiklikte gizli bir <textarea>'ya (`textarea`, isteğe bağlı `name`) yazılır ve oradan `input` olayı yayılır; böylece form onu sıradan
 * bir alan gibi okur. Metin HTML olarak yorumlanmaz; XSS yüzeyi yoktur.
 */
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder, showPanel } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { html } from '../core/dom.js';
import { formatAtCaret, lineContentStart, listContinuation } from '../core/markdown.js';
import { icon } from './icons.js';
import { liveExtension, markdownLanguage } from './markdownLive.js';

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

// Esc (modal kapanabilsin) ve Ctrl/⌘+Enter (form kaydedilsin) uygulamanındır; CodeMirror'ın varsayılanları bunları yutmasın
const BASE_KEYS = defaultKeymap.filter((k) => k.key !== 'Escape' && k.key !== 'Mod-Enter');

const normalizeNewlines = (t) => String(t ?? '').replace(/\r\n?/g, '\n');

/**
 * @param {{name?: string, value?: string, placeholder?: string, fullscreen?: boolean}} [options]
 * @returns {{el: HTMLElement, textarea: HTMLTextAreaElement, view: EditorView, getValue: () => string, setValue: (v: string) => void, focus: () => void, destroy: () => void}}
 */
export function createMarkdownEditor({ name = '', value = '', placeholder = '', fullscreen = false } = {}) {
  const root = document.createElement('div');
  root.className = `md-editor md-live${fullscreen ? ' md-editor--full' : ''}`;
  // Araç çubuğu kutunun dışında değil İÇİNDE, üstte durur: CodeMirror paneli (dock=top) olarak eklenir (aşağıda `showPanel`)
  const bar = document.createElement('div');
  bar.className = 'md-bar';
  bar.innerHTML = html`
    <div class="md-tools" role="toolbar" aria-label="Biçimlendirme">
      ${TOOLS.map((t) => html`<button type="button" class="icon-btn icon-btn-sm" data-md-tool="${t.kind}" title="${t.title}" aria-label="${t.title}">${icon(t.icon)}</button>`)}
    </div>`;
  root.innerHTML = html`
    <div class="md-box">
      <div class="md-surface" role="group" aria-label="Açıklama"></div>
      ${fullscreen ? '' : html`<div class="md-grip" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="Açıklama alanının yüksekliğini ayarla" title="Sürükleyerek büyüt / küçült (çift tıklama: otomatik yükseklik)"></div>`}
    </div>
    <textarea class="md-value" hidden tabindex="-1" aria-hidden="true" ${name ? html`name="${name}"` : ''} placeholder="${placeholder}"></textarea>`;
  const surface = root.querySelector('.md-surface');
  const store = root.querySelector('.md-value');
  const grip = root.querySelector('.md-grip');

  const initial = normalizeNewlines(value);
  store.value = initial;
  root.classList.toggle('is-empty', !initial);

  /** Belge değiştikçe tam metni gizli alana yazar (form buradan okur) ve `input` olayını yayar. */
  const sync = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    const text = update.state.doc.toString();
    root.classList.toggle('is-empty', !text);
    if (store.value !== text) {
      store.value = text;
      store.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  /** Enter: liste/alıntı işareti sürer, boş öğede liste biter. Seçim varken varsayılan davranış (seçimi siler, satır sonu ekler). */
  function enter(v) {
    const { state } = v;
    const sel = state.selection.main;
    if (!sel.empty) return false;
    const line = state.doc.lineAt(sel.head);
    const col = sel.head - line.from;
    const cont = listContinuation(line.text);
    if (cont.clear && col === line.text.length) {
      v.dispatch({ changes: { from: line.from, to: line.to, insert: '' }, selection: { anchor: line.from }, userEvent: 'delete' }); // boş öğe: işaret silinir, liste biter
      return true;
    }
    const prefix = col >= lineContentStart(line.text) ? cont.prefix : '';
    v.dispatch({ changes: { from: sel.head, insert: `\n${prefix}` }, selection: { anchor: sel.head + 1 + prefix.length }, scrollIntoView: true, userEvent: 'input' });
    return true;
  }

  /** Metni `next` ile değiştirir; yalnızca farklı kısmı yazar (geri al ve imleç korunur). */
  function replaceDoc(next, anchor, head) {
    const prev = view.state.doc.toString();
    const max = Math.min(prev.length, next.length);
    let a = 0;
    while (a < max && prev[a] === next[a]) a += 1;
    let b = 0;
    while (b < max - a && prev[prev.length - 1 - b] === next[next.length - 1 - b]) b += 1;
    view.dispatch({
      changes: { from: a, to: prev.length - b, insert: next.slice(a, next.length - b) },
      selection: { anchor, head },
      scrollIntoView: true,
      userEvent: 'input',
    });
  }

  let everFocused = false;
  function format(kind) {
    // Editör hiç odaklanmadıysa (ilk açılış) imleç henüz anlamlı bir yerde değildir: biçim metnin sonuna uygulanır; sonrasında son seçim kullanılır
    if (!view.hasFocus && !everFocused) view.dispatch({ selection: { anchor: view.state.doc.length } });
    const sel = view.state.selection.main;
    const r = formatAtCaret(view.state.doc.toString(), sel.from, sel.to, kind);
    replaceDoc(r.value, r.start, r.end);
    view.focus();
  }

  const view = new EditorView({
    parent: surface,
    state: EditorState.create({
      doc: initial,
      extensions: [
        history(),
        keymap.of([
          { key: 'Enter', run: enter },
          { key: 'Mod-b', run: () => (format('bold'), true), preventDefault: true },
          { key: 'Mod-i', run: () => (format('italic'), true), preventDefault: true },
          ...historyKeymap,
          ...BASE_KEYS,
        ]),
        EditorView.lineWrapping,
        showPanel.of(() => ({ dom: bar, top: true })), // araç çubuğu: notun içinde, üstte
        markdownLanguage,
        liveExtension(),
        cmPlaceholder(placeholder),
        EditorView.contentAttributes.of({ 'aria-label': 'Açıklama', spellcheck: 'true', autocapitalize: 'sentences' }),
        sync,
      ],
    }),
  });

  // Araç düğmelerine basmak düzenleyiciden odağı/seçimi almasın
  root.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-md-tool]')) e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    const tool = e.target.closest('[data-md-tool]');
    if (tool) format(tool.dataset.mdTool);
  });
  // Kutunun içeriğin dışındaki boş alanı (altı, kenar boşlukları): odaklan, imleç metnin sonuna
  view.dom.addEventListener('focusin', () => {
    everFocused = true;
  });
  surface.addEventListener('mousedown', (e) => {
    if (view.contentDOM.contains(e.target) || e.target.closest('.cm-panels')) return; // araç çubuğu paneline basmak imleci sona taşımasın
    e.preventDefault();
    view.focus();
    view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
  });

  // ---- Yükseklik tutamağı (eski büyütülebilir metin kutusundaki köşe tutamağının karşılığı) ----
  // Varsayılan: içeriğe göre otomatik yükseklik. Tutamakla sürüklenince yükseklik sabitlenir (içerik kutu içinde kayar). Fare, dokunma ve klavye
  // (↑ ↓, Home/çift tıklama = otomatik) ile çalışır. Tam ekran düzenleyicide yoktur (zaten ekranı kaplar).
  if (grip) {
    const MIN_H = 140; // araç çubuğu (≈38 px) + en az birkaç satır
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

  return {
    el: root,
    textarea: store,
    view,
    getValue: () => view.state.doc.toString(),
    setValue(v) {
      const text = normalizeNewlines(v);
      if (view.state.doc.toString() === text) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: Math.min(view.state.selection.main.head, text.length) },
        annotations: Transaction.addToHistory.of(false), // dışarıdan (ör. tam ekran düzenleyiciden) gelen eşitleme geri al yığınını doldurmasın
      });
    },
    focus() {
      view.focus();
      view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
    },
    destroy: () => view.destroy(),
  };
}
