/**
 * markdownEditor.js — Markdown destekli metin editörü: biçimlendirme araç çubuğu + Yaz / Önizle sekmeleri.
 *
 * Etkinlik açıklaması (ve tam ekran düzenleyicisi) bunu kullanır. Markdown dönüşümleri core/markdown.js'tedir
 * (güvenli, test edilir); bu bileşen yalnızca arayüzü kurar.
 *  - Araç çubuğu: kalın, italik, üstü çizili, kod, bağlantı, başlık, madde/numaralı/görev listesi, alıntı. Ctrl/⌘+B ve +I kısayolları.
 *  - Önizle: yazılan Markdown, açıklamanın nasıl görüneceğini gösterir.
 *  - textarea formun parçası olarak kalır (`name` verilirse form.elements üzerinden okunur); araç düğmeleri odağı metin alanından almaz.
 */
import { html } from '../core/dom.js';
import { applyFormat, renderMarkdown } from '../core/markdown.js';
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

/**
 * @param {{id?: string, name?: string, value?: string, placeholder?: string, rows?: number, fullscreen?: boolean}} [options]
 * @returns {{el: HTMLElement, textarea: HTMLTextAreaElement, setMode: (mode: 'write'|'preview') => void, refreshPreview: () => void}}
 */
export function createMarkdownEditor({ id = '', name = '', value = '', placeholder = '', rows = 4, fullscreen = false } = {}) {
  const root = document.createElement('div');
  root.className = `md-editor${fullscreen ? ' md-editor--full' : ''}`;
  root.innerHTML = html`
    <div class="md-bar">
      <div class="segmented segmented--sm md-tabs" role="tablist" aria-label="Açıklama görünümü">
        <button type="button" role="tab" data-md-tab="write" aria-selected="true" class="is-active">Yaz</button>
        <button type="button" role="tab" data-md-tab="preview" aria-selected="false">Önizle</button>
      </div>
      <div class="md-tools" role="toolbar" aria-label="Biçimlendirme">
        ${TOOLS.map((t) => html`<button type="button" class="icon-btn icon-btn-sm" data-md-tool="${t.kind}" title="${t.title}" aria-label="${t.title}">${icon(t.icon)}</button>`)}
      </div>
    </div>
    <textarea class="md-input" rows="${rows}" ${id ? html`id="${id}"` : ''} ${name ? html`name="${name}"` : ''} placeholder="${placeholder}"></textarea>
    <div class="md-preview md" hidden></div>`;

  const ta = root.querySelector('.md-input');
  const preview = root.querySelector('.md-preview');
  const tools = root.querySelector('.md-tools');
  ta.value = value;
  let mode = 'write';

  function paintPreview() {
    preview.innerHTML = ta.value.trim() ? String(renderMarkdown(ta.value)) : '<p class="md-empty">Önizlenecek bir şey yok.</p>';
  }

  function setMode(next) {
    mode = next;
    const write = next === 'write';
    ta.hidden = !write;
    tools.hidden = !write;
    preview.hidden = write;
    root.querySelectorAll('[data-md-tab]').forEach((b) => {
      const on = b.dataset.mdTab === next;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    if (write) ta.focus({ preventScroll: true });
    else paintPreview();
  }

  function format(kind) {
    const r = applyFormat(ta.value, ta.selectionStart, ta.selectionEnd, kind);
    ta.value = r.value;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(r.start, r.end);
    ta.dispatchEvent(new Event('input', { bubbles: true })); // form/tam ekran senkronu dinleyebilsin
  }

  root.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-md-tool]')) e.preventDefault(); // seçim ve odak metin alanında kalsın
  });
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-md-tab]');
    if (tab) {
      setMode(tab.dataset.mdTab);
      return;
    }
    const tool = e.target.closest('[data-md-tool]');
    if (tool) format(tool.dataset.mdTool);
  });
  ta.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'b' || key === 'i') {
      e.preventDefault();
      format(key === 'b' ? 'bold' : 'italic');
    }
  });

  return { el: root, textarea: ta, setMode, refreshPreview: () => mode === 'preview' && paintPreview() };
}
