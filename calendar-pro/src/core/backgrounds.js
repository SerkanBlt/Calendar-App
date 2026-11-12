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
 *
 * Yerleşim (BACKGROUND_FITS): görselin ekrana nasıl yerleşeceği — Doldur, Sığdır, Uzat, Döşe, Ortala.
 * Seçimler ilk boyamada kullanılmak üzere localStorage'a da yansıtılır (bkz. index.html).
 */

export const BACKGROUNDS = Object.freeze([
  { value: 'standard', label: 'Standart', src: null, dim: 0 },
  { value: 'leather', label: 'Deri', src: 'backgrounds/leather.webp', dim: 30 },
]);

/**
 * Yerleşim seçenekleri → CSS background-size / repeat / position.
 * Sığdır ve Ortala'da görselin kaplamadığı alan temanın zemin rengiyle dolar.
 */
export const BACKGROUND_FITS = Object.freeze([
  { value: 'fill', label: 'Doldur', hint: 'Ekranı kaplar, taşan kısımlar kırpılır', size: 'cover', repeat: 'no-repeat', position: 'center' },
  { value: 'fit', label: 'Sığdır', hint: 'Görselin tamamı görünür, oran korunur', size: 'contain', repeat: 'no-repeat', position: 'center' },
  { value: 'stretch', label: 'Uzat', hint: 'Ekrana tam oturur, oran bozulabilir', size: '100% 100%', repeat: 'no-repeat', position: 'center' },
  { value: 'tile', label: 'Döşe', hint: 'Gerçek boyutunda yan yana tekrarlanır', size: 'auto', repeat: 'repeat', position: 'top left' },
  { value: 'center', label: 'Ortala', hint: 'Gerçek boyutunda ortada tek kez', size: 'auto', repeat: 'no-repeat', position: 'center' },
]);

const byValue = new Map(BACKGROUNDS.map((b) => [b.value, b]));
const fitByValue = new Map(BACKGROUND_FITS.map((f) => [f.value, f]));

export const backgroundLabel = (value) => byValue.get(value)?.label ?? 'Standart';
export const fitLabel = (value) => fitByValue.get(value)?.label ?? 'Doldur';
export const hasImage = (value) => Boolean(byValue.get(value)?.src);

/** Görselin, uygulamanın yayınlandığı klasöre göre tam adresi (GitHub Pages alt klasörü dahil). */
export const backgroundUrl = (bg) => (bg?.src ? new URL(bg.src, document.baseURI).href : null);

const CSS_VARS = ['--app-bg-image', '--app-bg-dim', '--app-bg-size', '--app-bg-repeat', '--app-bg-position'];

export function applyBackground(value = 'standard', fitValue = 'fill') {
  const bg = byValue.get(value) || byValue.get('standard');
  const fit = fitByValue.get(fitValue) || fitByValue.get('fill');
  const root = document.documentElement;
  root.dataset.bg = bg.value;
  if (bg.src) {
    root.style.setProperty('--app-bg-image', `url("${backgroundUrl(bg)}")`);
    root.style.setProperty('--app-bg-dim', `${bg.dim}%`);
    root.style.setProperty('--app-bg-size', fit.size);
    root.style.setProperty('--app-bg-repeat', fit.repeat);
    root.style.setProperty('--app-bg-position', fit.position);
  } else {
    CSS_VARS.forEach((v) => root.style.removeProperty(v));
  }
  try {
    localStorage.setItem('cp-bg', JSON.stringify({ value: bg.value, src: bg.src, dim: bg.dim, size: fit.size, repeat: fit.repeat, position: fit.position }));
  } catch {
    /* özel modda localStorage erişilemeyebilir */
  }
}
