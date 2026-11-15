/**
 * markdownLive.js — CodeMirror 6 için "canlı önizleme" (Obsidian tarzı) eklentisi.
 *
 * Belge her zaman düz metindir (ham Markdown). Önizleme yalnızca GÖRÜNÜMDÜR: imlecin/seçimin değdiği satırlar ham (işaretleriyle) görünür,
 * diğer satırlarda işaretler (`**`, `#`, `>`, `[...](...)`…) gizlenir; başlıklar büyür, maddeler `•` olur, görev kutuları işaretlenir.
 * Metin hiç değişmediği için seçim, tutamaklar, kopyala/yapıştır, geri al ve klavye/IME davranışları tarayıcı ve CodeMirror'ın yerel haliyle çalışır
 * (satırlar arası seçim dahil). Dokunmatik cihazlarda seçim sürerken satırların ham/işlenmiş durumu dondurulur (bkz. liveExtension).
 *
 * Güvenlik: hiçbir kullanıcı metni HTML olarak yorumlanmaz; yalnızca düz metin düğümleri ve bu dosyadaki sabit parçacıklar (madde işareti, görev kutusu,
 * çizgi) DOM'a girer. Bağlantı adresi `data-href` özniteliğinde taşınır ve yalnızca http(s)/mailto ise açılır (`safeHref`).
 *
 * `planLive` DOM'a dokunmayan saf bir fonksiyondur (birim testlenebilir); `liveExtension` onu CodeMirror dekorasyonlarına çevirir.
 */
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import { Language, LanguageSupport, defineLanguageFacet, ensureSyntaxTree } from '@codemirror/language';
import { GFM, parser } from '@lezer/markdown';

/** CommonMark + GFM (üstü çizili, görev listesi, çıplak adresler). Yalnızca ayrıştırıcı: HTML/CSS/JS dil paketleri gerekmez. */
export const markdownLanguage = new LanguageSupport(new Language(defineLanguageFacet(), parser.configure([GFM]), [], 'markdown'));

const TASK_LINE = /^(\s*(?:[-*+]|\d{1,9}[.)])\s+)\[([ xX])\](?=\s|$)/;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/** Yalnızca http(s) ve mailto adresleri açılır; aksi halde boş döner. */
export function safeHref(value) {
  const v = String(value ?? '').trim();
  return SAFE_HREF.test(v) ? v : '';
}

/**
 * Sözdizimi ağacından görünüm planı çıkarır.
 * @param {import('@codemirror/state').EditorState} state markdownLanguage eklentisi yüklü durum
 * @param {Set<number>} active ham görünecek satır numaraları (1 tabanlı)
 * @returns {{type: 'line'|'mark'|'hide'|'bullet'|'task'|'rule', from: number, to?: number, class?: string, style?: string, href?: string, checked?: boolean}[]}
 */
export function planLive(state, active = new Set()) {
  const { doc } = state;
  const tree = ensureSyntaxTree(state, doc.length, 200);
  if (!tree) return [];
  const plan = [];
  const lineAt = (pos) => doc.lineAt(Math.min(pos, doc.length));
  const idle = (pos) => !active.has(lineAt(pos).number);
  const quoteDepth = new Map();
  const hide = (from, to) => {
    if (to > from) plan.push({ type: 'hide', from, to });
  };
  const trailingSpace = (pos) => (doc.sliceString(pos, pos + 1) === ' ' ? 1 : 0);

  tree.iterate({
    enter(ref) {
      const { name, from, to } = ref;
      let m;

      if ((m = /^ATXHeading([1-6])$/.exec(name))) {
        plan.push({ type: 'line', from: lineAt(from).from, class: `cm-md-h cm-md-h${m[1]}` });
      } else if (name === 'HeaderMark' && ref.node.parent && /^ATXHeading/.test(ref.node.parent.name)) {
        if (idle(from)) hide(from, to + trailingSpace(to));
      } else if (name === 'QuoteMark') {
        const n = lineAt(from).number;
        quoteDepth.set(n, (quoteDepth.get(n) ?? 0) + 1);
        if (idle(from)) hide(from, to + trailingSpace(to));
      } else if (name === 'ListItem') {
        let depth = -1;
        for (let p = ref.node.parent; p; p = p.parent) if (p.name === 'BulletList' || p.name === 'OrderedList') depth += 1;
        plan.push({ type: 'line', from: lineAt(from).from, class: 'cm-md-li', style: `--depth:${Math.max(0, depth)}` });
      } else if (name === 'ListMark') {
        const line = lineAt(from);
        const task = TASK_LINE.exec(line.text);
        const markText = doc.sliceString(from, to);
        if (task) {
          const checked = task[2] !== ' ';
          const boxFrom = line.from + task[1].length;
          if (idle(from)) {
            plan.push({ type: 'line', from: line.from, class: `cm-md-task${checked ? ' cm-md-done' : ''}` });
            hide(from, boxFrom);
            plan.push({ type: 'task', from: boxFrom, to: boxFrom + 3, checked });
          }
        } else if (/^[-*+]$/.test(markText) && idle(from)) {
          plan.push({ type: 'bullet', from, to });
        }
      } else if (name === 'FencedCode') {
        let end = to;
        if (end > from && doc.sliceString(end - 1, end) === '\n') end -= 1;
        const first = lineAt(from).number;
        const last = lineAt(end).number;
        const closing = last > first && /^\s*(`{3,}|~{3,})\s*$/.test(doc.line(last).text);
        for (let n = first; n <= last; n++) {
          const line = doc.line(n);
          const edge = n === first || (closing && n === last);
          if (edge) {
            const quiet = !active.has(n);
            plan.push({ type: 'line', from: line.from, class: `cm-md-fence cm-md-fence--${n === first ? 'open' : 'close'}${quiet ? ' cm-md-fence--idle' : ''}` });
            if (quiet) hide(line.from, line.to);
          } else {
            plan.push({ type: 'line', from: line.from, class: 'cm-md-code' });
          }
        }
        return false;
      } else if (name === 'HorizontalRule') {
        if (idle(from)) {
          plan.push({ type: 'line', from: lineAt(from).from, class: 'cm-md-hrline' });
          plan.push({ type: 'rule', from, to });
        }
      } else if (name === 'StrongEmphasis') {
        plan.push({ type: 'mark', from, to, class: 'cm-md-strong' });
      } else if (name === 'Emphasis') {
        plan.push({ type: 'mark', from, to, class: 'cm-md-em' });
      } else if (name === 'Strikethrough') {
        plan.push({ type: 'mark', from, to, class: 'cm-md-del' });
      } else if (name === 'InlineCode') {
        plan.push({ type: 'mark', from, to, class: 'cm-md-icode' });
      } else if (name === 'EmphasisMark' || name === 'StrikethroughMark' || (name === 'CodeMark' && ref.node.parent?.name === 'InlineCode')) {
        if (idle(from)) hide(from, to);
      } else if (name === 'Escape') {
        if (idle(from)) hide(from, from + 1);
      } else if (name === 'Image') {
        return false; // görüntüler desteklenmez: ham metin olarak kalır
      } else if (name === 'Link') {
        const marks = ref.node.getChildren('LinkMark');
        const url = ref.node.getChild('URL');
        const href = url ? doc.sliceString(url.from, url.to) : '';
        const inline = url && marks.length >= 3 && doc.sliceString(marks[0].from, marks[0].to) === '[';
        const quiet = idle(from);
        plan.push({ type: 'mark', from, to, class: `cm-md-link${inline && quiet ? ' cm-md-link--idle' : ''}`, href: inline ? href : '' });
        if (inline && quiet) {
          hide(marks[0].from, marks[0].to);
          hide(marks[1].from, to);
        }
      } else if (name === 'Autolink') {
        const url = ref.node.getChild('URL');
        const quiet = idle(from);
        plan.push({ type: 'mark', from, to, class: `cm-md-link${quiet ? ' cm-md-link--idle' : ''}`, href: url ? doc.sliceString(url.from, url.to) : '' });
        if (quiet) ref.node.getChildren('LinkMark').forEach((mk) => hide(mk.from, mk.to));
        return false;
      } else if (name === 'URL') {
        const parent = ref.node.parent?.name;
        if (parent !== 'Link' && parent !== 'Image' && parent !== 'LinkReference' && parent !== 'Autolink') {
          plan.push({ type: 'mark', from, to, class: `cm-md-link${idle(from) ? ' cm-md-link--idle' : ''}`, href: doc.sliceString(from, to) });
        }
      }
      return undefined;
    },
  });

  quoteDepth.forEach((depth, n) => plan.push({ type: 'line', from: doc.line(n).from, class: 'cm-md-quote', style: `--qd:${depth}` }));
  active.forEach((n) => {
    if (n >= 1 && n <= doc.lines) plan.push({ type: 'line', from: doc.line(n).from, class: 'cm-md-active' });
  });
  return dropOverlaps(plan);
}

const REPLACING = new Set(['hide', 'bullet', 'task', 'rule']);

/** Üst üste binen "yerine koy" aralıklarını eler (CodeMirror çakışan değişimleri kabul etmez); sıralı döner. */
function dropOverlaps(plan) {
  const keep = plan.filter((p) => !REPLACING.has(p.type));
  const reps = plan.filter((p) => REPLACING.has(p.type)).sort((a, b) => a.from - b.from || b.to - a.to);
  let end = -1;
  for (const r of reps) {
    if (r.from >= end) {
      keep.push(r);
      end = r.to;
    }
  }
  return keep;
}

// ---------------------------------------------------------------------------
// Parçacıklar (widget) — yalnızca sabit, güvenli DOM
// ---------------------------------------------------------------------------

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-md-bullet';
    s.textContent = '•';
    return s;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-md-hr';
    return s;
  }
}

/** Görev kutusu: tıklayınca `[ ]` ↔ `[x]` değişir (belge değişir; kutu yeniden çizilir). */
class TaskWidget extends WidgetType {
  constructor(checked) {
    super();
    this.checked = checked;
  }
  eq(other) {
    return other.checked === this.checked;
  }
  toDOM(view) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'cm-md-check';
    box.checked = this.checked;
    box.tabIndex = -1;
    box.setAttribute('aria-label', 'Görev');
    box.addEventListener('mousedown', (e) => e.preventDefault()); // odak ve seçim kutuya kaymasın
    box.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTaskAt(view, view.posAtDOM(box));
    });
    return box;
  }
  ignoreEvent() {
    return true;
  }
}

/** `pos`, `[ ]`/`[x]` işaretinin başladığı konumdur; ortadaki karakteri değiştirir. */
export function toggleTaskAt(view, pos) {
  const mark = view.state.doc.sliceString(pos, pos + 3);
  if (!/^\[[ xX]\]$/.test(mark)) return false;
  view.dispatch({ changes: { from: pos + 1, to: pos + 2, insert: mark[1] === ' ' ? 'x' : ' ' }, userEvent: 'input' });
  return true;
}

const BULLET = new BulletWidget();
const RULE = new RuleWidget();
const HIDE = Decoration.replace({});

function toDecorations(plan) {
  const ranges = plan.map((p) => {
    switch (p.type) {
      case 'line':
        return Decoration.line({ class: p.class, attributes: p.style ? { style: p.style } : undefined }).range(p.from);
      case 'mark':
        return Decoration.mark({ class: p.class, attributes: p.href ? { 'data-href': p.href } : undefined }).range(p.from, p.to);
      case 'hide':
        return HIDE.range(p.from, p.to);
      case 'bullet':
        return Decoration.replace({ widget: BULLET }).range(p.from, p.to);
      case 'task':
        return Decoration.replace({ widget: new TaskWidget(p.checked) }).range(p.from, p.to);
      default:
        return Decoration.replace({ widget: RULE }).range(p.from, p.to);
    }
  });
  return Decoration.set(ranges, true);
}

function activeLines(view) {
  const set = new Set();
  if (!view.hasFocus) return set; // odak yokken (ör. ilk açılış) hiçbir satır ham değildir
  const { state } = view;
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) set.add(n);
  }
  return set;
}

/** Dokunmatik birincil giriş (telefon/tablet): yerel seçim tutamakları kullanılır. */
const isCoarsePointer = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);

/**
 * Canlı önizleme: eklentiyi döndürür (markdownLanguage ile birlikte kullanılır).
 * @param {{freezeOnSelection?: boolean}} [options] freezeOnSelection: seçim (yalnızca seçim) değişirken satırların ham/işlenmiş durumu değişmez.
 *   Dokunmatik cihazlarda varsayılan olarak açıktır: seçim tutamağı sürüklenirken DOM'u değiştirmek, Android'in tutamağı bırakmasına yol açabilir.
 *   Seçim boşaldığında (dokunuş), metin değiştiğinde ya da odak değiştiğinde görünüm yeniden hesaplanır.
 */
export function liveExtension({ freezeOnSelection = isCoarsePointer() } = {}) {
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = toDecorations(planLive(view.state, activeLines(view)));
      }
      update(update) {
        if (!(update.docChanged || update.selectionSet || update.focusChanged)) return;
        if (freezeOnSelection && update.selectionSet && !update.docChanged && !update.focusChanged && !update.state.selection.main.empty) return;
        this.decorations = toDecorations(planLive(update.state, activeLines(update.view)));
      }
    },
    { decorations: (v) => v.decorations },
  );

  // Ham görünmeyen (idle) bir bağlantıya dokunmak/tıklamak onu açar; düzenlemek için satırın başka bir yerine tıklanır.
  const links = EditorView.domEventHandlers({
    mousedown(event) {
      const link = event.target instanceof Element ? event.target.closest('.cm-md-link--idle') : null;
      const href = safeHref(link?.getAttribute('data-href'));
      if (!href) return false;
      event.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
      return true;
    },
  });

  return [plugin, links];
}
