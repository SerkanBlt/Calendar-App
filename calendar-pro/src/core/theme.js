/**
 * theme.js — Tema kaydı ve uygulanması.
 *
 * Temel temalar: Açık, Koyu, Sistem.
 * Özel temalar: CUSTOM_THEMES listesinde tanımlanır; renk token'ları styles/theme.css içinde
 * `:root[data-theme='<value>']` bloğu olarak yazılır. Yeni bir özel tema eklemek için:
 *   1. theme.css'e token bloğunu ekleyin,
 *   2. aşağıdaki CUSTOM_THEMES listesine { value, label, description, meta, swatches } ekleyin.
 * Tercih, ilk boyamada kullanılmak üzere localStorage'a da yansıtılır (bkz. index.html).
 */
const media = window.matchMedia('(prefers-color-scheme: dark)');
let preference = 'dark';

/** Kenar çubuğundaki temel seçimler ("Özel" ayrıca bir seçim panelini açar). */
export const BASE_THEMES = Object.freeze([
  { value: 'light', label: 'Açık', icon: 'sun' },
  { value: 'dark', label: 'Koyu', icon: 'moon' },
  { value: 'system', label: 'Sistem', icon: 'monitor' },
]);

/** Özel temalar — seçim panelinde renk şeritleriyle listelenir. */
export const CUSTOM_THEMES = Object.freeze([
  {
    value: 'autumn',
    label: 'Sonbahar',
    description: 'Koyu orman yeşili üzerinde amber ve ahşap tonları',
    meta: '#13191f',
    swatches: ['#13191f', '#2b2f2e', '#594c3d', '#906d4b', '#ca9c68'],
  },
  {
    value: 'sunset',
    label: 'Gün Batımı',
    description: 'Gece mavisi ve mürdüm üzerinde kayısı ve krem',
    meta: '#1c1e3a',
    swatches: ['#1c1e3a', '#40263a', '#6d324f', '#b85c4a', '#e89f6e', '#f7e6c4'],
  },
  {
    value: 'ocean',
    label: 'Okyanus',
    description: 'Derin deniz mavisi üzerinde turkuaz ve köpük tonları',
    meta: '#04222b',
    swatches: ['#04222b', '#0a3d4a', '#10606f', '#1d8b94', '#4fb8b4', '#98d8d0', '#e2f4f0'],
  },
]);

const META_COLORS = { dark: '#0b0d12', light: '#f5f6fa', ...Object.fromEntries(CUSTOM_THEMES.map((t) => [t.value, t.meta])) };
const KNOWN = new Set([...BASE_THEMES, ...CUSTOM_THEMES].map((t) => t.value));

export const isCustomTheme = (value) => CUSTOM_THEMES.some((t) => t.value === value);
export const themeLabel = (value) => [...BASE_THEMES, ...CUSTOM_THEMES].find((t) => t.value === value)?.label ?? value;

export function applyTheme(pref = 'dark') {
  preference = KNOWN.has(pref) ? pref : 'dark';
  const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[resolved]);
  try {
    localStorage.setItem('cp-theme', preference);
  } catch {
    /* özel modda localStorage erişilemeyebilir */
  }
}

media.addEventListener('change', () => {
  if (preference === 'system') applyTheme('system');
});
