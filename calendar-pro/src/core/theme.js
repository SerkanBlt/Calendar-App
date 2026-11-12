/**
 * theme.js — Tema yönetimi (koyu / açık / sistem).
 * Tercih, ilk boyamada kullanılmak üzere localStorage'a da yansıtılır (bkz. index.html).
 */
const media = window.matchMedia('(prefers-color-scheme: dark)');
let preference = 'dark';

export const THEME_OPTIONS = Object.freeze([
  { value: 'dark', label: 'Koyu' },
  { value: 'light', label: 'Açık' },
  { value: 'system', label: 'Sistem' },
]);

export function applyTheme(pref = 'dark') {
  preference = pref;
  const resolved = pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b0d12' : '#f5f6fa');
  try {
    localStorage.setItem('cp-theme', pref);
  } catch {
    /* özel modda localStorage erişilemeyebilir */
  }
}

media.addEventListener('change', () => {
  if (preference === 'system') applyTheme('system');
});
