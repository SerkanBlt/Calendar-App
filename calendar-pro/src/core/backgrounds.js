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
 * Kullanıcılar kendi görsellerini de ekleyebilir (bkz. core/userBackgroundRepo.js); bunlar
 * allBackgrounds() ile hazır arka planlara eklenir.
 * Seçimler ilk boyamada kullanılmak üzere localStorage'a da yansıtılır (bkz. index.html).
 */
import { store } from './state.js';

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

const fitByValue = new Map(BACKGROUND_FITS.map((f) => [f.value, f]));

/** Kullanıcı görselleri için tema renginin bindirme oranı. */
const USER_DIM = 30;
export const USER_PREFIX = 'user:';

/**
 * Hazır arka planlar + kullanıcının yüklediği görseller (state.userBackgrounds).
 * Kullanıcı görsellerinin değeri `user:<id>` biçimindedir.
 */
export function allBackgrounds() {
  const users = (store.get().userBackgrounds || []).map((u) => ({
    value: `${USER_PREFIX}${u.id}`,
    label: u.name,
    url: u.url,
    dim: USER_DIM,
    isUser: true,
    id: u.id,
  }));
  return [...BACKGROUNDS, ...users];
}

const find = (value) => allBackgrounds().find((b) => b.value === value) || null;

export const backgroundLabel = (value) => find(value)?.label ?? 'Standart';
export const fitLabel = (value) => fitByValue.get(value)?.label ?? 'Doldur';
export const hasImage = (value) => Boolean(find(value)?.src || find(value)?.url);

/** Görselin adresi: kullanıcı görsellerinde object URL, hazır görsellerde yayın klasörüne göre tam adres. */
export const backgroundUrl = (bg) => bg?.url || (bg?.src ? new URL(bg.src, document.baseURI).href : null);

const CSS_VARS = ['--app-bg-image', '--app-bg-dim', '--app-bg-size', '--app-bg-repeat', '--app-bg-position'];

/**
 * Arka planı uygular. Seçili değer bulunamazsa (ör. silinmiş kullanıcı görseli) Standart'a düşer.
 * Not: kullanıcı görselleri ilk boyamada uygulanamaz (object URL sayfa yenilenince geçersizdir);
 * bu durumda görsel, veritabanı açılır açılmaz main.js tarafından uygulanır.
 */
export function applyBackground(value = 'standard', fitValue = 'fill') {
  const bg = find(value) || BACKGROUNDS[0];
  const fit = fitByValue.get(fitValue) || fitByValue.get('fill');
  const root = document.documentElement;
  root.dataset.bg = bg.value;
  if (bg.src || bg.url) {
    root.style.setProperty('--app-bg-image', `url("${backgroundUrl(bg)}")`);
    root.style.setProperty('--app-bg-dim', `${bg.dim}%`);
    root.style.setProperty('--app-bg-size', fit.size);
    root.style.setProperty('--app-bg-repeat', fit.repeat);
    root.style.setProperty('--app-bg-position', fit.position);
  } else {
    CSS_VARS.forEach((v) => root.style.removeProperty(v));
  }
  try {
    // Kullanıcı görsellerinde src kaydedilmez; ilk boyama betiği yalnızca hazır görselleri uygular
    localStorage.setItem('cp-bg', JSON.stringify({ value: bg.value, src: bg.src || null, dim: bg.dim, size: fit.size, repeat: fit.repeat, position: fit.position }));
  } catch {
    /* özel modda localStorage erişilemeyebilir */
  }
}
