/**
 * utils.js — Saf, yan etkisiz yardımcı fonksiyonlar.
 */

/** Sayıyı [min, max] aralığına sıkıştırır. */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Benzersiz kimlik üretir (crypto.randomUUID yoksa yedek yöntem). */
export function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Fonksiyonu son çağrıdan `wait` ms sonra çalıştırır. */
export function debounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Türkçe karakterlere duyarlı küçük harfe çevirme. */
export const normalizeText = (s) => String(s ?? '').toLocaleLowerCase('tr-TR');

/** Kullanıcının bir yazı alanında olup olmadığını kontrol eder (kısayolları engellemek için). */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
