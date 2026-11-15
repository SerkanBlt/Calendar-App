/**
 * Renk paleti, renk yardımcıları ve renk arka planı CSS'i.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildColorPalette, COLOR_PALETTE, isLightColor, luminance, mixHex, paletteColorName, PALETTE_HUES, parseHexInput } from '../src/core/colors.js';
import { colorBackgroundCss, DEFAULT_BG_COLORS } from '../src/core/backgrounds.js';
import { EVENT_COLORS } from '../src/core/eventModel.js';

describe('mixHex / luminance', () => {
  test('karıştırma oranları', () => {
    assert.equal(mixHex('#000000', '#ffffff', 0), '#000000');
    assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff');
    assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
    assert.equal(mixHex('#ff0000', '#000000', 0.5), '#800000');
  });
  test('kısa hex ve büyük harf kabul edilir; geçersizde normalleştirilmiş ilk değer', () => {
    assert.equal(mixHex('#F00', '#000', 0.5), '#800000');
    assert.equal(mixHex('kırmızı', '#000', 0.5), '');
  });
  test('parlaklık ve açık/koyu ayrımı', () => {
    assert.equal(luminance('#000000'), 0);
    assert.ok(Math.abs(luminance('#ffffff') - 1) < 1e-9);
    assert.ok(isLightColor('#ffffff') && isLightColor('#f5b84b'));
    assert.ok(!isLightColor('#000000') && !isLightColor('#7c6cff') && !isLightColor('#b91c1c'));
    assert.equal(isLightColor('geçersiz'), false);
  });
});

describe('renk paleti', () => {
  const all = COLOR_PALETTE.flatMap((r) => r.colors.map((c) => c.hex));

  test('3 satır × 12 ton, hepsi geçerli ve benzersiz #rrggbb', () => {
    assert.deepEqual(COLOR_PALETTE.map((r) => [r.id, r.colors.length]), [['soft', 12], ['vivid', 12], ['deep', 12]]);
    assert.ok(all.every((h) => /^#[0-9a-f]{6}$/.test(h)));
    assert.equal(new Set(all).size, 36);
  });

  test('"Canlı" satırı taban renkleri ve klasik etkinlik renklerini içerir', () => {
    const vivid = COLOR_PALETTE.find((r) => r.id === 'vivid').colors.map((c) => c.hex);
    assert.deepEqual(vivid, PALETTE_HUES.map((h) => h.hex));
    for (const legacy of EVENT_COLORS) assert.ok(vivid.includes(legacy), `${legacy} paletten düşmüş`);
  });

  test('açık satır tabandan açık, koyu satır tabandan koyu', () => {
    for (let i = 0; i < 12; i++) {
      const [soft, vivid, deep] = COLOR_PALETTE.map((r) => luminance(r.colors[i].hex));
      assert.ok(soft > vivid && vivid > deep, `ton ${i}: ${soft} ${vivid} ${deep}`);
    }
  });

  test('renk adları', () => {
    assert.equal(paletteColorName('#4f8cff'), 'Mavi · Canlı');
    assert.equal(paletteColorName('#4F8CFF'), 'Mavi · Canlı');
    assert.equal(paletteColorName('#123456'), null);
  });

  test('buildColorPalette özel girdilerle de çalışır', () => {
    const p = buildColorPalette([{ id: 'x', name: 'X', hex: '#808080' }], [{ id: 'a', label: 'A', mix: null }]);
    assert.deepEqual(p, [{ id: 'a', label: 'A', colors: [{ hex: '#808080', name: 'X', hue: 'x' }] }]);
  });
});

describe('parseHexInput', () => {
  test('yazım biçimleri', () => {
    assert.equal(parseHexInput('#7C6CFF'), '#7c6cff');
    assert.equal(parseHexInput('7c6cff'), '#7c6cff');
    assert.equal(parseHexInput('#abc'), '#aabbcc');
    assert.equal(parseHexInput('  abc '), '#aabbcc');
  });
  test('yarım veya geçersiz yazı boş döner', () => {
    for (const bad of ['', '#', '#ab', '#abcd', '#ggg', 'mavi', null]) assert.equal(parseHexInput(bad), '');
  });
});

describe('colorBackgroundCss', () => {
  test('tek renk düz renk, çift renk 135° degrade', () => {
    assert.equal(colorBackgroundCss({ mode: 'single', color1: '#112233', color2: '#445566' }), '#112233');
    assert.equal(colorBackgroundCss({ mode: 'dual', color1: '#112233', color2: '#445566' }), 'linear-gradient(135deg, #112233, #445566)');
  });
  test('geçersiz renkler varsayılana düşer; CSS enjeksiyonu mümkün değil', () => {
    assert.equal(colorBackgroundCss({ mode: 'single', color1: 'red; background:url(x)' }), DEFAULT_BG_COLORS.color1);
    assert.equal(colorBackgroundCss({ mode: 'dual', color1: 'x', color2: ')' }), `linear-gradient(135deg, ${DEFAULT_BG_COLORS.color1}, ${DEFAULT_BG_COLORS.color2})`);
    assert.equal(colorBackgroundCss({ mode: 'bilinmeyen', color1: '#abc' }), '#aabbcc');
    assert.equal(colorBackgroundCss(), DEFAULT_BG_COLORS.color1);
  });
  test('çıktı index.html ilk boyama doğrulamasıyla uyumlu', () => {
    const re = /^(#[0-9a-f]{6}|linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\))$/i;
    for (const mode of ['single', 'dual']) assert.match(colorBackgroundCss({ mode, color1: '#A1B2C3', color2: '#0f0' }), re);
  });
});
