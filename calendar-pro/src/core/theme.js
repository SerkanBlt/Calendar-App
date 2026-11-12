/**
 * theme.js — Tema yönetimi (koyu / açık / sonbahar / sistem).
 * Tercih, ilk boyamada kullanılmak üzere localStorage'a da yansıtılır (bkz. index.html).
 */
const media = window.matchMedia('(prefers-color-scheme: dark)');
let preference = 'dark';

export const THEME_OPTIONS = Object.freeze([
  { value: 'dark', label: 'Koyu' },
  { value: 'light', label: 'Açık' },
  { value: 'autumn', label: 'Sonbahar' },
  { value: 'system', label: 'Sistem' },
]);

/** Tarayıcı arayüzü (adres çubuğu vb.) için tema rengi. */
const META_COLORS = { dark: '#0b0d12', light: '#f5f6fa', autumn: '#13191f' };
const KNOWN = new Set(THEME_OPTIONS.map((t) => t.value));

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
