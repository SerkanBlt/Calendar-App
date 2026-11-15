/**
 * colors.js — Etkinlik renk paleti ve renk yardımcıları (saf fonksiyonlar, DOM yok).
 *
 * Palet 12 ton × 3 yoğunluktan oluşur: Açık (beyazla karıştırılmış), Canlı (taban renk) ve Koyu (siyahla karıştırılmış).
 * "Canlı" satırı uygulamanın klasik etkinlik renklerini içerir; eski etkinliklerin renkleri palette bulunur.
 * Palet elle yazılmaz, taban renklerden üretilir (bkz. buildColorPalette) — yeni bir ton eklemek için PALETTE_HUES'a eklemek yeter.
 */
import { normalizeHexColor } from './eventModel.js';

/** Taban (canlı) renkler. */
export const PALETTE_HUES = Object.freeze([
  { id: 'red', name: 'Kırmızı', hex: '#ff5d6c' },
  { id: 'orange', name: 'Turuncu', hex: '#ff8a4c' },
  { id: 'amber', name: 'Kehribar', hex: '#f5b84b' },
  { id: 'lime', name: 'Misket', hex: '#a3d65c' },
  { id: 'green', name: 'Yeşil', hex: '#3ecf8e' },
  { id: 'teal', name: 'Turkuaz', hex: '#22c3a6' },
  { id: 'cyan', name: 'Camgöbeği', hex: '#2fbfe8' },
  { id: 'blue', name: 'Mavi', hex: '#4f8cff' },
  { id: 'violet', name: 'Mor', hex: '#7c6cff' },
  { id: 'purple', name: 'Eflatun', hex: '#b26bf0' },
  { id: 'pink', name: 'Pembe', hex: '#e45cc4' },
  { id: 'slate', name: 'Arduvaz', hex: '#7b8aa3' },
]);

/** Yoğunluk satırları: `mix` taban rengin ne ile ve ne kadar karıştırılacağı (yoksa taban renk olduğu gibi). */
export const PALETTE_TONES = Object.freeze([
  { id: 'soft', label: 'Açık', mix: { with: '#ffffff', amount: 0.45 } },
  { id: 'vivid', label: 'Canlı', mix: null },
  { id: 'deep', label: 'Koyu', mix: { with: '#000000', amount: 0.35 } },
]);

const toRgb = (hex) => {
  const h = normalizeHexColor(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** `a` rengini `b` ile `amount` (0–1) oranında karıştırır; sonuç #rrggbb. Geçersiz girdide `a` normalleştirilmiş döner ('' olabilir). */
export function mixHex(a, b, amount) {
  if (!normalizeHexColor(a) || !normalizeHexColor(b)) return normalizeHexColor(a);
  const [ra, rb] = [toRgb(a), toRgb(b)];
  return toHex(ra.map((v, i) => v + (rb[i] - v) * amount));
}

/** Rengin göreli parlaklığı (0–1, WCAG). */
export function luminance(hex) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Üzerine koyu metin/işaret konmalı mı (açık bir renk mi)? */
export const isLightColor = (hex) => Boolean(normalizeHexColor(hex)) && luminance(hex) > 0.4;

/**
 * Paleti üretir.
 * @returns {{id: string, label: string, colors: {hex: string, name: string, hue: string}[]}[]} satırlar (Açık, Canlı, Koyu)
 */
export function buildColorPalette(hues = PALETTE_HUES, tones = PALETTE_TONES) {
  return tones.map((tone) => ({
    id: tone.id,
    label: tone.label,
    colors: hues.map((h) => ({ hex: tone.mix ? mixHex(h.hex, tone.mix.with, tone.mix.amount) : normalizeHexColor(h.hex), name: h.name, hue: h.id })),
  }));
}

export const COLOR_PALETTE = Object.freeze(buildColorPalette());

const paletteLookup = new Map(COLOR_PALETTE.flatMap((row) => row.colors.map((c) => [c.hex, `${c.name} · ${row.label}`])));

/** Paletteki bir rengin adı ("Mavi · Canlı"); palette yoksa null. */
export const paletteColorName = (hex) => paletteLookup.get(normalizeHexColor(hex)) ?? null;

/**
 * Kullanıcının yazdığı renk kodunu çözer: "#abc", "abc", "#aabbcc", "AABBCC" → "#aabbcc"; geçersizse ''.
 * (Yazarken kısmi değerler geçersiz sayılır, bu yüzden form alanı onaylanana kadar yeniden yazılmaz.)
 */
export function parseHexInput(text) {
  const t = String(text ?? '').trim();
  return normalizeHexColor(t.startsWith('#') ? t : `#${t}`);
}
