/**
 * Canlı önizleme planı (components/markdownLive.js): hangi aralıkların gizleneceği, hangi satırlara hangi sınıfın verileceği.
 * planLive saf bir fonksiyondur; DOM gerekmez, gerçek Markdown ayrıştırıcısıyla çalışır.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EditorState } from '@codemirror/state';
import { markdownLanguage, planLive, safeHref } from '../src/components/markdownLive.js';

const plan = (doc, active = []) => planLive(EditorState.create({ doc, extensions: [markdownLanguage] }), new Set(active));
const hidden = (doc, active) => plan(doc, active).filter((p) => p.type === 'hide').map((p) => doc.slice(p.from, p.to)).sort();
const lineClasses = (doc, active) => plan(doc, active).filter((p) => p.type === 'line').map((p) => p.class);

describe('planLive — işaretlerin gizlenmesi', () => {
  test('satır içi biçimler: işaretler gizlenir, metin biçim sınıfı alır', () => {
    const doc = '**kalın** *italik* ~~çizili~~ `kod`';
    assert.deepEqual(hidden(doc), ['*', '*', '**', '**', '`', '`', '~~', '~~']);
    const marks = plan(doc).filter((p) => p.type === 'mark').map((p) => p.class);
    assert.deepEqual(marks.sort(), ['cm-md-del', 'cm-md-em', 'cm-md-icode', 'cm-md-strong']);
  });

  test('aktif satırda hiçbir işaret gizlenmez (ham Markdown)', () => {
    assert.deepEqual(hidden('**kalın** ve ~~çizili~~', [1]), []);
    assert.ok(lineClasses('**kalın**', [1]).includes('cm-md-active'));
  });

  test('yalnızca aktif satır ham olur; diğer satırlar işlenmiş kalır', () => {
    const doc = '# Başlık\n**kalın**\n> alıntı';
    assert.deepEqual(hidden(doc, [2]), ['# ', '> ']);
  });

  test('başlık: işaret ve boşluğu gizlenir, seviye sınıfı verilir', () => {
    const doc = '## Başlık';
    assert.deepEqual(hidden(doc), ['## ']);
    assert.ok(lineClasses(doc).includes('cm-md-h cm-md-h2'));
  });

  test('alıntı: işaret gizlenir; derinlik değişkeni satıra yazılır', () => {
    const doc = '> bir\n> > iki';
    assert.deepEqual(hidden(doc), ['> ', '> ', '> ']);
    const q = plan(doc).filter((p) => p.class === 'cm-md-quote').map((p) => p.style);
    assert.deepEqual(q, ['--qd:1', '--qd:2']);
  });

  test('kaçış karakteri: ters eğik çizgi gizlenir', () => {
    assert.deepEqual(hidden('\\*yıldız\\*'), ['\\', '\\']);
  });
});

describe('planLive — listeler ve görevler', () => {
  test('madde işareti • parçacığı olur; iç içe listede derinlik artar; numaralı liste işareti kalır', () => {
    const doc = '- bir\n  - iki\n1. üç';
    const p = plan(doc);
    assert.equal(p.filter((x) => x.type === 'bullet').length, 2);
    assert.deepEqual(p.filter((x) => x.class === 'cm-md-li').map((x) => x.style), ['--depth:0', '--depth:1', '--depth:0']);
  });

  test('görev: işaret gizlenir, kutu parçacığı konur; tamamlanan satır sınıf alır', () => {
    const doc = '- [ ] açık\n- [x] bitti';
    const p = plan(doc);
    const boxes = p.filter((x) => x.type === 'task');
    assert.deepEqual(boxes.map((b) => [doc.slice(b.from, b.to), b.checked]), [['[ ]', false], ['[x]', true]]);
    assert.deepEqual(hidden(doc), ['- ', '- ']);
    assert.ok(lineClasses(doc).includes('cm-md-task cm-md-done'));
    assert.ok(!p.some((x) => x.type === 'bullet'), 'görev satırında madde işareti yok');
  });

  test('boş görev satırı (Enter sonrası "- [ ] ") da kutu olur', () => {
    const p = plan('- [ ] ');
    assert.equal(p.filter((x) => x.type === 'task').length, 1);
  });

  test('aktif görev satırı ham kalır (kutu yok)', () => {
    assert.equal(plan('- [x] iş', [1]).filter((x) => x.type === 'task').length, 0);
  });
});

describe('planLive — kod ve çizgi', () => {
  test('kod çiti: çit satırları gizlenir ve daralır, içerik kod sınıfı alır', () => {
    const doc = '```js\nlet a;\n```\nson';
    assert.deepEqual(hidden(doc), ['```', '```js']);
    const lines = lineClasses(doc);
    assert.ok(lines.includes('cm-md-fence cm-md-fence--open cm-md-fence--idle'));
    assert.ok(lines.includes('cm-md-code'));
    assert.ok(lines.includes('cm-md-fence cm-md-fence--close cm-md-fence--idle'));
  });

  test('kod çitinin içindeki işaretler işlenmez', () => {
    const doc = '```\n**kalın** # başlık\n```';
    assert.ok(!plan(doc).some((x) => x.type === 'mark'));
    assert.ok(!hidden(doc).includes('**'));
  });

  test('aktif çit satırı ham görünür', () => {
    assert.deepEqual(hidden('```js\nx\n```', [1]), ['```']);
  });

  test('yatay çizgi: parçacıkla değişir, aktifken ham kalır', () => {
    assert.equal(plan('---').filter((x) => x.type === 'rule').length, 1);
    assert.equal(plan('---', [1]).filter((x) => x.type === 'rule').length, 0);
  });
});

describe('planLive — bağlantılar ve güvenlik', () => {
  test('satır içi bağlantı: köşeli parantez ve adres gizlenir, adres özniteliğe taşınır', () => {
    const doc = '[site](https://x.com)';
    assert.deepEqual(hidden(doc), ['[', '](https://x.com)']);
    const link = plan(doc).find((x) => x.type === 'mark' && x.class.startsWith('cm-md-link'));
    assert.equal(link.href, 'https://x.com');
    assert.match(link.class, /cm-md-link--idle/);
  });

  test('aktif satırda bağlantı ham kalır ve tıklayınca açılmaz (idle sınıfı yok)', () => {
    const link = plan('[a](https://x.com)', [1]).find((x) => x.type === 'mark' && x.class.startsWith('cm-md-link'));
    assert.doesNotMatch(link.class, /idle/);
  });

  test('açılı ve çıplak adresler bağlantı olur', () => {
    const marks = plan('<https://a.com> ve https://b.com').filter((x) => x.type === 'mark').map((x) => x.href);
    assert.deepEqual(marks, ['https://a.com', 'https://b.com']);
  });

  test('görüntüler desteklenmez: ham metin olarak kalır', () => {
    assert.deepEqual(hidden('![alt](http://img)'), []);
  });

  test('ham HTML yorumlanmaz: planda yalnızca bu dosyanın sabit türleri bulunur', () => {
    const p = plan('<script>alert(1)</script> <img src=x onerror=alert(1)> **kalın**');
    const allowed = new Set(['line', 'mark', 'hide', 'bullet', 'task', 'rule']);
    assert.ok(p.every((x) => allowed.has(x.type)));
    assert.ok(p.every((x) => !('html' in x)), 'plana HTML taşınmaz');
  });

  test('safeHref: yalnızca http(s) ve mailto', () => {
    assert.equal(safeHref('https://a.com/x?y=1'), 'https://a.com/x?y=1');
    assert.equal(safeHref(' http://a.com '), 'http://a.com');
    assert.equal(safeHref('mailto:a@b.com'), 'mailto:a@b.com');
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>', 'vbscript:x', '//evil.com', 'ftp://x', '', null, undefined]) assert.equal(safeHref(bad), '');
  });
});

describe('planLive — sağlamlık', () => {
  test('yerine koyma aralıkları çakışmaz, sıralıdır', () => {
    const doc = '**[a](https://x.com) \\) ~~`k`~~** > - [ ] x';
    const reps = plan(doc).filter((p) => ['hide', 'bullet', 'task', 'rule'].includes(p.type)).sort((a, b) => a.from - b.from);
    for (let i = 1; i < reps.length; i++) assert.ok(reps[i].from >= reps[i - 1].to, `çakışma: ${JSON.stringify([reps[i - 1], reps[i]])}`);
  });

  test('boş ve patolojik girdiler (uzun, iç içe) makul sürede işlenir', () => {
    assert.deepEqual(plan(''), []);
    const t = Date.now();
    plan('*'.repeat(5000) + '\n' + '> '.repeat(500) + '\n' + '- '.repeat(300) + '[ ] x');
    plan(Array.from({ length: 800 }, (_, i) => `- madde ${i} **kalın** [a](http://x.com)`).join('\n'));
    assert.ok(Date.now() - t < 5000, `yavaş: ${Date.now() - t} ms`);
  });
});
