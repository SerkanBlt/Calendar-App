/**
 * backgrounds.js — Arka plan kaydı ve uygulanması (temadan bağımsız).
 *
 * "Standart" temanın kendi degrade arka planıdır. "Renk", kullanıcının seçtiği tek rengi veya iki renkli (135°)
 * degradeyi gösterir (ayarlar: bgColorMode / bgColor1 / bgColor2). Diğerleri bir görseli sayfanın arkasına yerleştirir;
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
import { normalizeHexColor } from './eventModel.js';

export const COLOR_BG = 'color';

export const BACKGROUNDS = Object.freeze([
  { value: 'standard', label: 'Standart', src: null, dim: 0 },
  { value: COLOR_BG, label: 'Renk', src: null, dim: 0, isColor: true },
]);

/** Renk arka planının varsayılanları (ayarlarda bgColorMode / bgColor1 / bgColor2 olarak saklanır). */
export const DEFAULT_BG_COLORS = Object.freeze({ mode: 'single', color1: '#1e293b', color2: '#7c6cff' });

/**
 * Renk arka planının CSS değeri: tek renk ya da iki renkli 135° degrade. Geçersiz renkler varsayılana düşer.
 * @param {{mode?: 'single'|'dual', color1?: string, color2?: string}} colors
 */
export function colorBackgroundCss({ mode, color1, color2 } = {}) {
  const c1 = normalizeHexColor(color1) || DEFAULT_BG_COLORS.color1;
  const c2 = normalizeHexColor(color2) || DEFAULT_BG_COLORS.color2;
  return mode === 'dual' ? `linear-gradient(135deg, ${c1}, ${c2})` : c1;
}

/** Ayarlar nesnesinden renk arka planı CSS'i. */
export const colorBackgroundCssFromSettings = (settings) =>
  colorBackgroundCss({ mode: settings.bgColorMode, color1: settings.bgColor1, color2: settings.bgColor2 });

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

const CSS_VARS = ['--app-bg-color', '--app-bg-image', '--app-bg-dim', '--app-bg-size', '--app-bg-repeat', '--app-bg-position'];

/**
 * Arka planı uygular. Seçili değer bulunamazsa (ör. silinmiş kullanıcı görseli) Standart'a düşer.
 * Not: kullanıcı görselleri ilk boyamada uygulanamaz (object URL sayfa yenilenince geçersizdir);
 * bu durumda görsel, veritabanı açılır açılmaz main.js tarafından uygulanır.
 */
export function applyBackground(value = 'standard', fitValue = 'fill', colors = DEFAULT_BG_COLORS) {
  const bg = find(value) || BACKGROUNDS[0];
  const fit = fitByValue.get(fitValue) || fitByValue.get('fill');
  const root = document.documentElement;
  root.dataset.bg = bg.value;
  let cache;
  if (bg.isColor) {
    const css = colorBackgroundCss(colors);
    CSS_VARS.forEach((v) => root.style.removeProperty(v));
    root.style.setProperty('--app-bg-color', css);
    cache = { value: bg.value, css };
  } else if (bg.src || bg.url) {
    root.style.removeProperty('--app-bg-color');
    root.style.setProperty('--app-bg-image', `url("${backgroundUrl(bg)}")`);
    root.style.setProperty('--app-bg-dim', `${bg.dim}%`);
    root.style.setProperty('--app-bg-size', fit.size);
    root.style.setProperty('--app-bg-repeat', fit.repeat);
    root.style.setProperty('--app-bg-position', fit.position);
    // Kullanıcı görsellerinde src kaydedilmez; ilk boyama betiği yalnızca hazır görselleri uygular
    cache = { value: bg.value, src: bg.src || null, dim: bg.dim, size: fit.size, repeat: fit.repeat, position: fit.position };
  } else {
    CSS_VARS.forEach((v) => root.style.removeProperty(v));
    cache = { value: bg.value, src: null, dim: bg.dim, size: fit.size, repeat: fit.repeat, position: fit.position };
  }
  try {
    localStorage.setItem('cp-bg', JSON.stringify(cache));
  } catch {
    /* özel modda localStorage erişilemeyebilir */
  }
}

/** Ayarlar nesnesindeki arka plan seçimlerini uygular (görsel/renk, yerleşim, renkler). */
export const applyBackgroundSettings = (s) =>
  applyBackground(s.background, s.backgroundFit, { mode: s.bgColorMode, color1: s.bgColor1, color2: s.bgColor2 });
