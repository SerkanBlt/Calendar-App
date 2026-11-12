/**
 * backgrounds.js — Arka plan kaydı ve uygulanması (temadan bağımsız).
 *
 * "Standart" temanın kendi degrade arka planıdır. Diğerleri bir görseli sayfanın arkasına yerleştirir;
 * görselin üzerine temanın zemin rengi `dim` oranında bindirilir, böylece her temada okunabilirlik korunur.
 *
 * Yeni arka plan eklemek için:
 *   1. Görseli public/backgrounds/ klasörüne kopyalayın (webp/jpg önerilir, ~300 KB altı),
 *   2. aşağıdaki BACKGROUNDS listesine { value, label, src, dim } ekleyin.
 *      value: benzersiz kısa ad (a-z, -) · dim: tema renginin görsel üzerindeki yoğunluğu (0–90)
 * Seçim ilk boyamada kullanılmak üzere localStorage'a da yansıtılır (bkz. index.html).
 */

export const BACKGROUNDS = Object.freeze([
  { value: 'standard', label: 'Standart', src: null, dim: 0 },
  { value: 'leather', label: 'Deri', src: 'backgrounds/leather.webp', dim: 30 },
]);

const byValue = new Map(BACKGROUNDS.map((b) => [b.value, b]));

export const backgroundLabel = (value) => byValue.get(value)?.label ?? 'Standart';

/** Görselin, uygulamanın yayınlandığı klasöre göre tam adresi (GitHub Pages alt klasörü dahil). */
export const backgroundUrl = (bg) => (bg?.src ? new URL(bg.src, document.baseURI).href : null);

export function applyBackground(value = 'standard') {
  const bg = byValue.get(value) || byValue.get('standard');
  const root = document.documentElement;
  root.dataset.bg = bg.value;
  if (bg.src) {
    root.style.setProperty('--app-bg-image', `url("${backgroundUrl(bg)}")`);
    root.style.setProperty('--app-bg-dim', `${bg.dim}%`);
  } else {
    root.style.removeProperty('--app-bg-image');
    root.style.removeProperty('--app-bg-dim');
  }
  try {
    localStorage.setItem('cp-bg', JSON.stringify({ value: bg.value, src: bg.src, dim: bg.dim }));
  } catch {
    /* özel modda localStorage erişilemeyebilir */
  }
}
