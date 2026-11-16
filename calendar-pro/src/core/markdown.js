/**
 * markdown.js — Etkinlik açıklamaları için küçük, bağımlılıksız ve güvenli Markdown alt kümesi (DOM yok).
 *
 * Desteklenenler
 *   Blok : # başlıklar (1–6), - * + / 1. listeler (iç içe), - [ ] / - [x] görev listeleri, > alıntı, ``` kod bloğu, --- çizgi, paragraflar
 *          (satır sonu <br> olur: açıklamalar not niteliğindedir)
 *   Satır: **kalın**, *italik* / _italik_, ~~üstü çizili~~, `kod`, [metin](bağlantı), çıplak http(s) adresleri, \* ile kaçış
 *
 * Güvenlik
 *   Girdi ÖNCE tümüyle HTML'e kaçırılır (escapeHtml: & < > " '), sonra yalnızca bu dosyanın ürettiği etiketler eklenir;
 *   ham HTML hiçbir zaman çalışmaz. Bağlantılar yalnızca http(s) ve mailto olabilir (javascript: / data: reddedilir) ve
 *   rel="noopener noreferrer" target="_blank" ile açılır. Çıktı `raw()` ile işaretlenir (bkz. core/dom.js).
 *
 * Ayrıca: stripMarkdown (kart/arama özetleri için düz metin), applyFormat (editör araç çubuğu; saf metin dönüşümü) ve
 * editörün satır yardımcıları: lineContentStart, listContinuation (canlı önizleme CodeMirror üzerindedir: components/markdownEditor.js, markdownLive.js).
 */
import { escapeHtml, raw } from './dom.js';

const SAFE_URL = /^(?:https?:\/\/|mailto:)[^\s<>"']+$/i;
const unEntity = (s) => s.replace(/&amp;/g, '&');

// ---------------------------------------------------------------------------
// Satır içi
// ---------------------------------------------------------------------------

function emphasis(s) {
  return s
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?![_\w])/g, '$1<em>$2</em>');
}

const anchor = (href, label) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;

/** Bir satırın (paragraf/başlık/liste öğesi) satır içi biçimlerini işler. */
function inline(text) {
  const stash = [];
  const keep = (htmlPiece) => {
    stash.push(htmlPiece);
    return `\u0000${stash.length - 1}\u0000`; // yer tutucu: sonraki düzenlemelerin içeriğe dokunmasını engeller
  };
  let s = escapeHtml(text);
  s = s.replace(/`([^`\n]+)`/g, (_, code) => keep(`<code>${code}</code>`));
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!~])/g, (_, ch) => keep(ch));
  // [metin](adres) — adres izinli değilse metin olduğu gibi kalır
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*?&quot;)?\)/g, (match, label, url) => (SAFE_URL.test(unEntity(url)) ? keep(anchor(url, emphasis(label))) : match));
  // çıplak adresler: sondaki noktalama ve kaçırılmış tırnaklar adrese dahil edilmez
  s = s.replace(/(^|[\s(]|&quot;|&#39;)(https?:\/\/[^\s<]+)/g, (match, pre, found) => {
    const trail = /(?:[.,;:!?)\]]|&quot;|&#39;|&gt;)+$/.exec(found)?.[0] ?? '';
    const url = found.slice(0, found.length - trail.length);
    return SAFE_URL.test(unEntity(url)) ? `${pre}${keep(anchor(url, url))}${trail}` : match;
  });
  s = emphasis(s);
  for (let i = 0; i < 4 && s.includes('\u0000'); i++) s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[Number(n)] ?? '');
  return s;
}

// ---------------------------------------------------------------------------
// Bloklar
// ---------------------------------------------------------------------------

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*[\w+-]*\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}>/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;

const isBlockStart = (line) => FENCE.test(line) || HEADING.test(line) || HR.test(line) || QUOTE.test(line) || LIST_ITEM.test(line);
const indentOf = (ws) => ws.replace(/\t/g, '    ').length;

function itemHtml(text) {
  const task = /^\[([ xX])\]\s+([\s\S]*)$/.exec(text);
  const body = (t) => t.split('\n').map(inline).join('<br>');
  if (task) {
    const done = task[1] !== ' ';
    return `<label class="md-task${done ? ' md-task-done' : ''}"><input type="checkbox" disabled${done ? ' checked' : ''}> <span>${body(task[2])}</span></label>`;
  }
  return body(text);
}

function renderItems(items) {
  let out = '';
  const stack = [];
  const close = () => {
    const top = stack.pop();
    out += `</li></${top.ordered ? 'ol' : 'ul'}>`;
  };
  for (const item of items) {
    while (stack.length && item.indent < stack[stack.length - 1].indent) close();
    let top = stack[stack.length - 1];
    if (top && item.indent === top.indent) {
      if (top.ordered !== item.ordered) {
        close(); // aynı seviyede liste türü değişti → yeni liste
        top = null;
      } else out += '</li>';
    }
    if (!top || item.indent > top.indent) {
      stack.push({ indent: item.indent, ordered: item.ordered });
      out += item.ordered ? '<ol>' : '<ul>';
    }
    out += `<li>${itemHtml(item.text)}`;
  }
  while (stack.length) close();
  return out;
}

function readList(lines, start) {
  const items = [];
  let i = start;
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i]);
    if (m && !HR.test(lines[i])) {
      items.push({ indent: indentOf(m[1]), ordered: /\d/.test(m[2]), text: m[3] });
      i++;
    } else if (items.length && /^\s{2,}\S/.test(lines[i])) {
      items[items.length - 1].text += `\n${lines[i].trim()}`; // girintili devam satırı
      i++;
    } else break;
  }
  return { html: renderItems(items), next: i };
}

function blocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      const body = [];
      i++;
      while (i < lines.length && !closing.test(lines[i])) body.push(lines[i++]);
      i++; // kapanış çiti
      out.push(`<pre class="md-code"><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push(`<h${heading[1].length} class="md-h">${inline(heading[2])}</h${heading[1].length}>`);
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted = [];
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(/^ {0,3}> ?/, ''));
      out.push(`<blockquote>${blocks(quoted)}</blockquote>`);
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const list = readList(lines, i);
      out.push(list.html);
      i = list.next;
      continue;
    }
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++]);
    out.push(`<p>${para.map((l) => inline(l.trim())).join('<br>')}</p>`);
  }
  return out.join('');
}

/**
 * Markdown metnini güvenli HTML'e çevirir.
 * @returns {import('./dom.js').SafeHTML} `html` şablonlarına doğrudan gömülebilir; `String()` ile metne çevrilir
 */
export function renderMarkdown(source) {
  const text = String(source ?? '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  return raw(blocks(text.split('\n')));
}

// ---------------------------------------------------------------------------
// Canlı önizleme editörü: satır satır render
// ---------------------------------------------------------------------------


/** Satırda biçim işaretlerinin (başlık #'leri, alıntı >, liste işareti, görev kutusu) bittiği, içeriğin başladığı konum. */
export function lineContentStart(line) {
  const m = /^( {0,3}#{1,6}\s+| {0,3}>+[ \t]?|\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?)/.exec(String(line ?? ''));
  return m ? m[0].length : 0;
}

/**
 * Enter'a basılınca yeni satırın başına gelecek liste/alıntı işareti.
 * Öğe boşsa (`clear`) işaret silinir ve liste biter; yeni satır açılmaz.
 * @returns {{prefix: string, clear: boolean}}
 */
export function listContinuation(line) {
  const text = String(line ?? '');
  const item = /^(\s*)([-*+]|\d{1,9}[.)])\s+(\[[ xX]\]\s+)?(.*)$/.exec(text);
  if (item) {
    const [, indent, marker, task, rest] = item;
    if (!rest.trim()) return { prefix: '', clear: true };
    const next = /^\d/.test(marker) ? `${parseInt(marker, 10) + 1}${marker.slice(-1)}` : marker;
    return { prefix: `${indent}${next} ${task ? '[ ] ' : ''}`, clear: false };
  }
  const quote = /^( {0,3}>+[ \t]?)(.*)$/.exec(text);
  if (quote) return quote[2].trim() ? { prefix: quote[1], clear: false } : { prefix: '', clear: true };
  return { prefix: '', clear: false };
}

// ---------------------------------------------------------------------------
// Düz metin özeti
// ---------------------------------------------------------------------------

/** Biçim işaretlerini kaldırıp tek satırlık düz metin döner (kart ve arama özetleri için). */
export function stripMarkdown(source) {
  return String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^ {0,3}(?:`{3,}|~{3,})[\w+-]*\s*$/gm, '')
    .replace(/^ {0,3}#{1,6}\s+/gm, '')
    .replace(/^ {0,3}>\s?/gm, '')
    .replace(/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/gm, '')
    .replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*\*|\*\*|__|~~|`)/g, '')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!~])/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Editör araç çubuğu: saf metin dönüşümleri
// ---------------------------------------------------------------------------

const WRAP = {
  bold: { pre: '**', post: '**', placeholder: 'kalın' },
  italic: { pre: '*', post: '*', placeholder: 'italik', guard: '*' },
  strike: { pre: '~~', post: '~~', placeholder: 'üstü çizili' },
  code: { pre: '`', post: '`', placeholder: 'kod' },
};
const LINE_PREFIX = { h: '## ', ul: '- ', task: '- [ ] ', quote: '> ' };
const LIST_MARK = /^(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/;

/**
 * Seçili metne biçim uygular veya zaten uygulanmışsa kaldırır.
 * @param {string} value tüm metin
 * @param {number} start seçim başı
 * @param {number} end seçim sonu
 * @param {'bold'|'italic'|'strike'|'code'|'link'|'h'|'ul'|'ol'|'task'|'quote'} kind
 * @returns {{value: string, start: number, end: number}} yeni metin ve yeni seçim
 */
export function applyFormat(value, start, end, kind) {
  const wrap = WRAP[kind];
  if (wrap) {
    const { pre, post, placeholder, guard } = wrap;
    const selected = value.slice(start, end);
    const before = value.slice(start - pre.length, start);
    const after = value.slice(end, end + post.length);
    const guarded = guard && (value[start - pre.length - 1] === guard || value[end + post.length] === guard); // *italik* ile **kalın**ı karıştırma
    if (start >= pre.length && before === pre && after === post && !guarded) {
      return { value: value.slice(0, start - pre.length) + selected + value.slice(end + post.length), start: start - pre.length, end: end - pre.length };
    }
    if (selected.length >= pre.length + post.length && selected.startsWith(pre) && selected.endsWith(post) && !(guard && selected[pre.length] === guard)) {
      const inner = selected.slice(pre.length, selected.length - post.length);
      return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
    }
    const inner = selected || placeholder;
    return { value: value.slice(0, start) + pre + inner + post + value.slice(end), start: start + pre.length, end: start + pre.length + inner.length };
  }

  if (kind === 'link') {
    const selected = value.slice(start, end);
    if (/^https?:\/\/\S+$/i.test(selected)) {
      const label = 'bağlantı';
      return { value: `${value.slice(0, start)}[${label}](${selected})${value.slice(end)}`, start: start + 1, end: start + 1 + label.length };
    }
    const label = selected || 'bağlantı';
    const url = 'https://';
    const urlStart = start + label.length + 3; // [label](
    return { value: `${value.slice(0, start)}[${label}](${url})${value.slice(end)}`, start: urlStart, end: urlStart + url.length };
  }

  // Satır başı biçimleri: seçilen tüm satırlara uygulanır; hepsinde varsa kaldırılır
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const stopAt = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nl = value.indexOf('\n', stopAt);
  const lineEnd = nl === -1 ? value.length : nl;
  const lines = value.slice(lineStart, lineEnd).split('\n');

  const exact = {
    h: /^#{1,6}\s/,
    ul: /^[-*+]\s(?!\[[ xX]\]\s)/,
    ol: /^\d{1,9}[.)]\s/,
    task: /^[-*+]\s\[[ xX]\]\s/,
    quote: /^>\s?/,
  }[kind];
  const allHave = lines.every((l) => !l.trim() || exact.test(l));
  const nonEmpty = lines.filter((l) => l.trim()).length;
  let n = 0;
  const changed = lines.map((line) => {
    if (!line.trim()) return line;
    if (allHave && nonEmpty > 0) return line.replace(exact, '');
    n++;
    const base = kind === 'h' || kind === 'quote' ? line : line.replace(LIST_MARK, ''); // liste türünü değiştirirken eski işareti at
    return (kind === 'ol' ? `${n}. ` : LINE_PREFIX[kind]) + base;
  });
  const replaced = changed.join('\n');
  return { value: value.slice(0, lineStart) + replaced + value.slice(lineEnd), start: lineStart, end: lineStart + replaced.length };
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** İmlecin değdiği kelimenin [başlangıç, bitiş) aralığı (harf/rakam/alt çizgi); değmiyorsa boş aralık [pos, pos]. */
export function wordRangeAt(value, pos) {
  let s = pos;
  let e = pos;
  while (s > 0 && WORD_CHAR.test(value[s - 1])) s -= 1;
  while (e < value.length && WORD_CHAR.test(value[e])) e += 1;
  return [s, e];
}

/**
 * Araç çubuğu eylemi: seçim YOKKEN de anlamlı çalışır (seçim varsa `applyFormat` ile aynıdır).
 *  - Satır içi biçimler (kalın, italik, üstü çizili, kod): imleç bir kelimeye değiyorsa **kelime** sarılır (zaten sarılıysa açılır) ve imleç kelimenin
 *    içinde, olduğu yerde kalır; boşluktaysa `**|**` gibi boş bir çift bırakılır, imleç ortasındadır (yazmaya devam edince biçimli yazılır). Boş çiftin
 *    içindeyken tekrar basmak çifti kaldırır. Yer tutucu metin eklenmez.
 *  - Bağlantı: imleç bir kelimeye değiyorsa kelime bağlantı etiketi olur (adres seçilir); aksi halde `[bağlantı](https://)`.
 *  - Satır biçimleri (başlık, liste, görev, alıntı) imlecin bulunduğu satıra uygulanır (applyFormat zaten böyle çalışır).
 * @returns {{value: string, start: number, end: number}} yeni metin ve yeni seçim
 */
export function formatAtCaret(value, start, end, kind) {
  if (start !== end) return applyFormat(value, start, end, kind);
  const [ws, we] = wordRangeAt(value, start);
  const word = we > ws;
  if (kind === 'link') return word ? applyFormat(value, ws, we, 'link') : applyFormat(value, start, end, 'link');
  const wrap = WRAP[kind];
  if (!wrap) return applyFormat(value, start, end, kind);
  const { pre, post, guard } = wrap;
  if (word) {
    const r = applyFormat(value, ws, we, kind);
    const caret = start + (r.value.length > value.length ? pre.length : -pre.length); // sarıldıysa işaret kadar sağa, açıldıysa sola
    return { value: r.value, start: caret, end: caret };
  }
  const inPair = start >= pre.length && value.slice(start - pre.length, start) === pre && value.slice(start, start + post.length) === post
    && !(guard && (value[start - pre.length - 1] === guard || value[start + post.length] === guard));
  if (inPair) return { value: value.slice(0, start - pre.length) + value.slice(start + post.length), start: start - pre.length, end: start - pre.length };
  return { value: value.slice(0, start) + pre + post + value.slice(start), start: start + pre.length, end: start + pre.length };
}
