/**
 * dom.js — Güvenli HTML şablonlama.
 *
 * `html` etiketli şablonu, içine gömülen tüm değerleri otomatik olarak escape eder.
 * İç içe `html` çağrıları ve `raw()` ile işaretlenen değerler olduğu gibi eklenir.
 * Bu sayede kullanıcı verisi (etkinlik başlığı vb.) XSS'e yol açmaz.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Güvenli olduğu bilinen HTML parçası. */
export class SafeHTML {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

/** Değeri escape etmeden eklemek için işaretler. Sadece güvenilir içerik için kullanın. */
export const raw = (value) => new SafeHTML(String(value));

function format(value) {
  if (value == null || value === false) return '';
  if (value instanceof SafeHTML) return value.value;
  if (Array.isArray(value)) return value.map(format).join('');
  return escapeHtml(value);
}

/** Etiketli şablon: html`<p>${userText}</p>` */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += format(values[i]);
  });
  return new SafeHTML(out);
}

/** HTML string'ini tek bir DOM elemanına dönüştürür. */
export function toElement(markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(markup).trim();
  return tpl.content.firstElementChild;
}
