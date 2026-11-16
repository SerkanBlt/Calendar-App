/**
 * Markdown (açıklama alanı): güvenlik (XSS), biçimler ve editör araç çubuğu dönüşümleri.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { applyFormat, formatAtCaret, lineContentStart, listContinuation, renderMarkdown, stripMarkdown, wordRangeAt } from '../src/core/markdown.js';

const md = (s) => String(renderMarkdown(s));

/** Çıktıda yalnızca bu dosyanın ürettiği etiketler olmalı; başka hiçbir '<' veya '>' kalmamalı. */
const ALLOWED_TAG = /<\/?(?:p|br|strong|em|del|code|pre|h[1-6]|hr|ul|ol|li|blockquote|label|span)(?: class="[a-z -]+")?>|<a href="[^"<>]*" target="_blank" rel="noopener noreferrer">|<\/a>|<input type="checkbox" disabled(?: checked)?>/g;
const strayAngles = (html) => html.replace(ALLOWED_TAG, '').match(/[<>]/g);

describe('renderMarkdown — güvenlik', () => {
  const vectors = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">x</a>',
    '<svg/onload=alert(1)>',
    '"><script>alert(1)</script>',
    "'><img src=x onerror=alert(1)>",
    '**<b onclick=alert(1)>x</b>**',
    '# <iframe src=javascript:alert(1)>',
    '> <style>body{display:none}</style>',
    '- <img src=x onerror=alert(1)>',
    '`<script>alert(1)</script>`',
    '```\n<script>alert(1)</script>\n```',
    '[<img src=x onerror=alert(1)>](https://a.com)',
  ];
  for (const v of vectors) {
    test(`ham HTML çalışmaz: ${v.slice(0, 40).replace(/\n/g, '⏎')}`, () => {
      const out = md(v);
      assert.equal(strayAngles(out), null, out);
      assert.ok(!/<script|<img|<svg|<iframe|<style/i.test(out), out);
    });
  }

  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', '//evil.com', ' javascript:alert(1)']) {
    test(`tehlikeli bağlantı reddedilir: ${url}`, () => {
      const out = md(`[tıkla](${url})`);
      assert.ok(!/<a /i.test(out), out);
      assert.equal(strayAngles(out), null);
    });
  }

  test('izinli bağlantılar güvenli öznitelikle açılır', () => {
    assert.match(md('[Google](https://google.com/?a=1&b=2)'), /<a href="https:\/\/google\.com\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Google<\/a>/);
    assert.match(md('[mail](mailto:ben@ornek.com)'), /<a href="mailto:ben@ornek\.com"/);
    assert.match(md('[ok](http://a.com)'), /<a href="http:\/\/a\.com"/);
  });

  test('tırnakla öznitelikten çıkma denemesi: href değeri tırnak içermez', () => {
    const out = md('[x](https://a.com" onmouseover="alert(1))');
    for (const m of out.matchAll(/href="([^"]*)"/g)) assert.ok(!/[<>"]/.test(m[1]), m[1]);
    assert.ok(!/ onmouseover=/.test(out.replace(/&quot;/g, '')) || !/<a [^>]* onmouseover=/.test(out), out);
    assert.equal(strayAngles(out), null);
  });

  test('girdideki NUL karakterleri yer tutucuyu taklit edemez', () => {
    const out = md('a \u00000\u0000 b `kod`');
    assert.ok(!out.includes('\u0000'));
    assert.match(out, /<code>kod<\/code>/);
  });

  test('boş / null girdi', () => {
    assert.equal(md(''), '');
    assert.equal(md(null), '');
    assert.equal(md(undefined), '');
  });
});

describe('renderMarkdown — satır içi biçimler', () => {
  test('kalın, italik, üstü çizili, kod', () => {
    assert.equal(md('**kalın** ve __kalın2__'), '<p><strong>kalın</strong> ve <strong>kalın2</strong></p>');
    assert.equal(md('*italik* ve _italik2_'), '<p><em>italik</em> ve <em>italik2</em></p>');
    assert.equal(md('~~yanlış~~'), '<p><del>yanlış</del></p>');
    assert.equal(md('`a < b`'), '<p><code>a &lt; b</code></p>');
    assert.equal(md('***ikisi***'), '<p><strong><em>ikisi</em></strong></p>');
  });

  test('kod içinde biçim işaretleri işlenmez', () => {
    assert.equal(md('`**kalın değil**`'), '<p><code>**kalın değil**</code></p>');
  });

  test('snake_case ve matematik yıldızları italik olmaz', () => {
    assert.equal(md('dosya_adi_son.txt'), '<p>dosya_adi_son.txt</p>');
    assert.equal(md('2 * 3 * 4'), '<p>2 * 3 * 4</p>');
  });

  test('ters eğik çizgi ile kaçış', () => {
    assert.equal(md('\\*yıldız\\*'), '<p>*yıldız*</p>');
  });

  test('çıplak adresler bağlanır; sondaki noktalama ve tırnak dışarıda kalır', () => {
    assert.match(md('bkz https://ornek.com/a_b_c.'), /<a href="https:\/\/ornek\.com\/a_b_c"[^>]*>https:\/\/ornek\.com\/a_b_c<\/a>\.<\/p>$/);
    assert.ok(!md('https://ornek.com/a_b_c').includes('<em>'), 'adres içindeki _ italik yapmaz');
    const quoted = md('"https://ornek.com"');
    assert.match(quoted, /<a href="https:\/\/ornek\.com"/);
  });

  test('bağlantı metni içinde biçim', () => {
    assert.match(md('[**kalın** link](https://a.com)'), /<a [^>]*><strong>kalın<\/strong> link<\/a>/);
  });
});

describe('renderMarkdown — bloklar', () => {
  test('başlıklar ve çizgi', () => {
    assert.equal(md('# Bir\n## İki\n###### Altı'), '<h1 class="md-h">Bir</h1><h2 class="md-h">İki</h2><h6 class="md-h">Altı</h6>');
    assert.equal(md('---'), '<hr>');
    assert.equal(md('* * *'), '<hr>');
  });

  test('paragraflar boş satırla ayrılır; satır sonu <br> olur', () => {
    assert.equal(md('bir\niki\n\nüç'), '<p>bir<br>iki</p><p>üç</p>');
  });

  test('madde işaretli ve numaralı listeler', () => {
    assert.equal(md('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
    assert.equal(md('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  });

  test('iç içe liste', () => {
    assert.equal(md('- a\n  - a1\n  - a2\n- b'), '<ul><li>a<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ul>');
  });

  test('aynı seviyede liste türü değişince yeni liste açılır', () => {
    assert.equal(md('- a\n1. b'), '<ul><li>a</li></ul><ol><li>b</li></ol>');
  });

  test('görev listesi', () => {
    const out = md('- [ ] yap\n- [x] bitti');
    assert.match(out, /<input type="checkbox" disabled> <span>yap<\/span>/);
    assert.match(out, /<input type="checkbox" disabled checked> <span>bitti<\/span>/);
    assert.match(out, /<label class="md-task md-task-done">/); // tamamlanan görev ayrı sınıfla (üstü çizili) işaretlenir
    assert.match(out, /<label class="md-task"><input type="checkbox" disabled> <span>yap/);
  });

  test('alıntı (içinde biçim ve iç içe alıntı)', () => {
    assert.equal(md('> **not**\n> ikinci'), '<blockquote><p><strong>not</strong><br>ikinci</p></blockquote>');
  });

  test('kod bloğu içeriği olduğu gibi (kaçırılmış) kalır', () => {
    assert.equal(md('```js\nlet a = "<b>";\n**x**\n```'), '<pre class="md-code"><code>let a = &quot;&lt;b&gt;&quot;;\n**x**</code></pre>');
  });

  test('kapanmamış kod bloğu sonuna kadar kod sayılır (donmaz)', () => {
    assert.match(md('```\nabc'), /<pre class="md-code"><code>abc<\/code><\/pre>/);
  });

  test('CRLF satır sonları', () => {
    assert.equal(md('a\r\nb'), '<p>a<br>b</p>');
  });

  test('çok uzun / patolojik girdi makul sürede işlenir', () => {
    const t = Date.now();
    md('*'.repeat(5000) + '_'.repeat(5000) + '['.repeat(2000) + '`'.repeat(2000) + '\n' + '- '.repeat(500));
    assert.ok(Date.now() - t < 1500, `${Date.now() - t} ms`);
  });
});

describe('stripMarkdown', () => {
  test('biçim işaretlerini kaldırır', () => {
    assert.equal(stripMarkdown('# Başlık\n**kalın** ve *italik* [link](https://a.com)'), 'Başlık kalın ve italik link');
    assert.equal(stripMarkdown('- [x] iş\n- [ ] iş2\n1. bir'), 'iş iş2 bir');
    assert.equal(stripMarkdown('> alıntı\n`kod` ~~sil~~'), 'alıntı kod sil');
  });
  test('snake_case korunur; boş girdi', () => {
    assert.equal(stripMarkdown('dosya_adi.txt'), 'dosya_adi.txt');
    assert.equal(stripMarkdown(null), '');
  });
});

describe('applyFormat', () => {
  test('seçimi sarar ve seçimi korur', () => {
    const r = applyFormat('merhaba dünya', 0, 7, 'bold');
    assert.deepEqual(r, { value: '**merhaba** dünya', start: 2, end: 9 });
  });
  test('seçim yoksa yer tutucu ekler ve onu seçer', () => {
    const r = applyFormat('', 0, 0, 'italic');
    assert.equal(r.value, '*italik*');
    assert.equal(r.value.slice(r.start, r.end), 'italik');
  });
  test('zaten sarılıysa kaldırır (seçim işaretlerin içinde)', () => {
    const r = applyFormat('**merhaba** dünya', 2, 9, 'bold');
    assert.deepEqual(r, { value: 'merhaba dünya', start: 0, end: 7 });
  });
  test('zaten sarılıysa kaldırır (seçim işaretlerle birlikte)', () => {
    const r = applyFormat('**merhaba**', 0, 11, 'bold');
    assert.equal(r.value, 'merhaba');
  });
  test('italik, **kalın** içindeki seçimi italiğe çevirmez', () => {
    const r = applyFormat('**x**', 2, 3, 'italic');
    assert.equal(r.value, '***x***'); // kalın korunur, üstüne italik eklenir
  });
  test('kod ve üstü çizili', () => {
    assert.equal(applyFormat('a', 0, 1, 'code').value, '`a`');
    assert.equal(applyFormat('a', 0, 1, 'strike').value, '~~a~~');
  });
  test('bağlantı: seçili metin etiket olur, adres seçilir', () => {
    const r = applyFormat('bkz site', 4, 8, 'link');
    assert.equal(r.value, 'bkz [site](https://)');
    assert.equal(r.value.slice(r.start, r.end), 'https://');
  });
  test('bağlantı: seçili adres bağlantının hedefi olur', () => {
    const r = applyFormat('https://a.com', 0, 13, 'link');
    assert.equal(r.value, '[bağlantı](https://a.com)');
    assert.equal(r.value.slice(r.start, r.end), 'bağlantı');
  });
  test('satır başı biçimleri seçili tüm satırlara uygulanır ve geri alınır', () => {
    const text = 'bir\niki\nüç';
    const added = applyFormat(text, 0, text.length, 'ul');
    assert.equal(added.value, '- bir\n- iki\n- üç');
    const removed = applyFormat(added.value, added.start, added.end, 'ul');
    assert.equal(removed.value, text);
  });
  test('numaralı liste sıralı numaralanır', () => {
    assert.equal(applyFormat('a\nb\nc', 0, 5, 'ol').value, '1. a\n2. b\n3. c');
  });
  test('liste türü değişirken eski işaret atılır', () => {
    assert.equal(applyFormat('- a\n- b', 0, 7, 'task').value, '- [ ] a\n- [ ] b');
    assert.equal(applyFormat('1. a', 0, 4, 'ul').value, '- a');
  });
  test('başlık ve alıntı; yalnızca imlecin bulunduğu satır etkilenir', () => {
    assert.equal(applyFormat('ilk\nikinci', 6, 6, 'h').value, 'ilk\n## ikinci');
    assert.equal(applyFormat('söz', 0, 0, 'quote').value, '> söz');
  });
  test('boş satırlar karışık seçimde atlanır', () => {
    assert.equal(applyFormat('a\n\nb', 0, 4, 'ul').value, '- a\n\n- b');
  });
  test('yalnızca boş satır(lar) seçiliyse ona da uygulanır (satırda karakter gerekmez)', () => {
    assert.equal(applyFormat('', 0, 0, 'ul').value, '- ');
    // seçim bir satır sonunun hemen ardında bitiyorsa sonraki satır dışarıda kalır (kullanıcı onu seçmemiştir)
    assert.equal(applyFormat('\n\n', 0, 2, 'ul').value, '- \n- \n');
    assert.equal(applyFormat('\n\n', 0, 2, 'ol').value, '1. \n2. \n');
    assert.equal(applyFormat('\n\n', 0, 0, 'ul').value, '- \n\n', 'ilk satır boşken de başı doğru bulunur');
  });
});

describe('lineContentStart / listContinuation', () => {
  test('içeriğin başladığı konum', () => {
    assert.equal(lineContentStart('düz metin'), 0);
    assert.equal(lineContentStart('## Başlık'), 3);
    assert.equal(lineContentStart('- madde'), 2);
    assert.equal(lineContentStart('  - [ ] iş'), 8);
    assert.equal(lineContentStart('12. on iki'), 4);
    assert.equal(lineContentStart('> alıntı'), 2);
    assert.equal(lineContentStart(null), 0);
  });

  test('Enter ile liste devamı: işaret sürer, numara artar, görev kutusu boş gelir', () => {
    assert.deepEqual(listContinuation('- a'), { prefix: '- ', clear: false });
    assert.deepEqual(listContinuation('  * a'), { prefix: '  * ', clear: false });
    assert.deepEqual(listContinuation('3. a'), { prefix: '4. ', clear: false });
    assert.deepEqual(listContinuation('9) a'), { prefix: '10) ', clear: false });
    assert.deepEqual(listContinuation('- [x] bitti'), { prefix: '- [ ] ', clear: false });
    assert.deepEqual(listContinuation('> alıntı'), { prefix: '> ', clear: false });
  });

  test('boş öğede liste biter (clear); düz satırda devam yok', () => {
    assert.deepEqual(listContinuation('- '), { prefix: '', clear: true });
    assert.deepEqual(listContinuation('- [ ] '), { prefix: '', clear: true });
    assert.deepEqual(listContinuation('> '), { prefix: '', clear: true });
    assert.deepEqual(listContinuation('düz'), { prefix: '', clear: false });
    assert.deepEqual(listContinuation(''), { prefix: '', clear: false });
  });
});

describe('formatAtCaret (seçim yokken araç çubuğu)', () => {
  const at = (text, kind) => {
    const i = text.indexOf('|');
    const value = text.replace('|', '');
    const r = formatAtCaret(value, i, i, kind);
    return `${r.value.slice(0, r.start)}${r.start === r.end ? '|' : '['}${r.value.slice(r.start, r.end)}${r.start === r.end ? '' : ']'}${r.value.slice(r.end)}`;
  };

  test('wordRangeAt: kelimenin sınırları (Türkçe harfler dahil); kelime yoksa boş aralık', () => {
    assert.deepEqual(wordRangeAt('merhaba dünya', 3), [0, 7]);
    assert.deepEqual(wordRangeAt('merhaba dünya', 7), [0, 7]); // kelimenin hemen sonu
    assert.deepEqual(wordRangeAt('merhaba dünya', 8), [8, 13]);
    assert.deepEqual(wordRangeAt('çalışma_2', 4), [0, 9]);
    assert.deepEqual(wordRangeAt('a  b', 2), [2, 2]);
  });

  test('kelimenin içinde kalın: kelime sarılır, imleç yerinde kalır', () => {
    assert.equal(at('mer|haba dünya', 'bold'), '**mer|haba** dünya');
    assert.equal(at('merhaba| dünya', 'bold'), '**merhaba|** dünya'); // kelimenin hemen sonu da kelimeye değer
    assert.equal(at('|merhaba', 'bold'), '**|merhaba**');
  });

  test('zaten kalın kelimede tekrar basmak açar', () => {
    assert.equal(at('**mer|haba** dünya', 'bold'), 'mer|haba dünya');
  });

  test('boşlukta: boş çift bırakılır, imleç ortada; tekrar basmak çifti kaldırır', () => {
    assert.equal(at('abc |', 'bold'), 'abc **|**');
    assert.equal(at('abc **|**', 'bold'), 'abc |');
    assert.equal(at('|', 'italic'), '*|*');
    assert.equal(at('|', 'strike'), '~~|~~');
    assert.equal(at('|', 'code'), '`|`');
  });

  test('italik çifti, kalın çiftiyle karışmaz', () => {
    assert.equal(at('**|**', 'italic'), '***|***'); // kalın çiftin içinde italik açılır; kalın çift bozulmaz
  });

  test('diğer biçimler de kelimeye uygulanır', () => {
    assert.equal(at('bir ko|d iki', 'code'), 'bir `ko|d` iki');
    assert.equal(at('çal|ışma', 'strike'), '~~çal|ışma~~');
    assert.equal(at('ça|lışma', 'italic'), '*ça|lışma*');
  });

  test('bağlantı: kelime etiket olur ve adres seçilir; kelime yoksa yer tutucu', () => {
    const w = formatAtCaret('git site şimdi', 6, 6, 'link');
    assert.equal(w.value, 'git [site](https://) şimdi');
    assert.equal(w.value.slice(w.start, w.end), 'https://');
    const e = formatAtCaret('a ', 2, 2, 'link');
    assert.equal(e.value, 'a [bağlantı](https://)');
  });

  test('satır biçimleri imleç satırına uygulanır (seçim gerekmez)', () => {
    const r = formatAtCaret('birinci\nikinci', 10, 10, 'ul');
    assert.equal(r.value, 'birinci\n- ikinci');
    assert.equal(formatAtCaret('metin', 2, 2, 'h').value, '## metin');
    assert.equal(formatAtCaret('metin', 2, 2, 'task').value, '- [ ] metin');
  });

  test('seçim varsa applyFormat ile aynıdır', () => {
    assert.deepEqual(formatAtCaret('merhaba dünya', 0, 7, 'bold'), applyFormat('merhaba dünya', 0, 7, 'bold'));
  });
});

describe('formatAtCaret — boş satırda satır biçimleri', () => {
  const run = (text, kind) => {
    const i = text.indexOf('|');
    const r = formatAtCaret(text.replace('|', ''), i, i, kind);
    return `${r.value.slice(0, r.start)}${r.start === r.end ? '|' : '['}${r.value.slice(r.start, r.end)}${r.start === r.end ? '' : ']'}${r.value.slice(r.end)}`;
  };

  test('boş satırda madde, numara, görev, alıntı ve başlık öneki eklenir; imleç önekin sonunda', () => {
    assert.equal(run('|', 'ul'), '- |');
    assert.equal(run('|', 'ol'), '1. |');
    assert.equal(run('|', 'task'), '- [ ] |');
    assert.equal(run('|', 'quote'), '> |');
    assert.equal(run('|', 'h'), '## |');
  });

  test('çok satırlı metinde yalnızca imlecin bulunduğu boş satır etkilenir', () => {
    assert.equal(run('ilk\n|\nson', 'ul'), 'ilk\n- |\nson');
    assert.equal(run('ilk\n|', 'quote'), 'ilk\n> |');
  });

  test('boş önek varken aynı düğme onu kaldırır; başka türe geçilir', () => {
    assert.equal(run('- |', 'ul'), '|');
    assert.equal(run('> |', 'quote'), '|');
    assert.equal(run('- |', 'task'), '- [ ] |');
    assert.equal(run('1. |', 'ul'), '- |');
  });

  test('doluk satırda imleç seçmek yerine yerinde kalır (öneke göre kayar)', () => {
    assert.equal(run('me|tin', 'h'), '## me|tin');
    assert.equal(run('## me|tin', 'h'), 'me|tin');
    assert.equal(run('|metin', 'ul'), '- |metin');
  });
});
