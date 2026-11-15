/**
 * colorPicker.js — Daraltılabilir renk seçici.
 *
 * Kapalıyken TEK SATIRDA yuvarlak hızlı renkler (uygulamanın klasik 8 etkinlik rengi) ve sonunda aç/kapa düğmesi görünür. Seçili renk hızlı
 * renklerden biri değilse (paletten veya özel seçilmişse) satıra ek bir yuvarlak olarak eklenir; böylece seçim kapalıyken de görünür.
 * Açılınca altında: 12 ton × 3 yoğunluk (açık / canlı / koyu) palet ve **özel renk** (sistem renk seçicisi + hex kodu) çıkar.
 *
 *  - Renkler radyo düğmeleridir (ok tuşlarıyla gezilir, tek sekme durağı); seçili renk halka ve onay işaretiyle belirtilir.
 *  - Tek durum kaynağı `value`'dur; tüm kontroller onu günceller ve `onChange(hex)` çağrılır.
 * Palet ve renk matematiği core/colors.js içindedir (DOM'suz, test edilir).
 */
import { html } from '../core/dom.js';
import { COLOR_PALETTE, isLightColor, paletteColorName, parseHexInput } from '../core/colors.js';
import { EVENT_COLORS, normalizeHexColor } from '../core/eventModel.js';
import { icon } from './icons.js';

let uid = 0;

/**
 * @param {{value: string, onChange?: (hex: string) => void}} options
 * @returns {{el: HTMLElement, value: () => string, setValue: (hex: string) => void, setExpanded: (open: boolean) => void}}
 */
export function createColorPicker({ value, onChange }) {
  const id = ++uid;
  const quickName = `color-quick-${id}`;
  const gridName = `color-grid-${id}`;
  const panelId = `color-panel-${id}`;
  let current = normalizeHexColor(value) || EVENT_COLORS[0];

  const chip = (name, hex, label) => html`<label class="cp-chip ${isLightColor(hex) ? 'is-light' : ''}" style="--c:${hex}" title="${label}">
    <input type="radio" name="${name}" value="${hex}" aria-label="${label}" />
    <span></span>
  </label>`;

  const root = document.createElement('div');
  root.className = 'color-picker';
  root.innerHTML = html`
    <div class="cp-quick" role="radiogroup" aria-label="Hızlı renkler">
      ${EVENT_COLORS.map((c) => chip(quickName, c, paletteColorName(c) ?? c))}
      <label class="cp-chip cp-chip--current" hidden title="Seçili renk">
        <input type="radio" name="${quickName}" value="" aria-label="Seçili renk" />
        <span></span>
      </label>
      <button type="button" class="cp-more" aria-expanded="false" aria-controls="${panelId}" aria-label="Diğer renkler ve özel renk" title="Diğer renkler ve özel renk">${icon('chevronDown')}</button>
    </div>
    <div class="cp-panel" id="${panelId}" hidden>
      <div class="cp-grid" role="radiogroup" aria-label="Renk paleti">
        ${COLOR_PALETTE.flatMap((row) => row.colors.map((c) => chip(gridName, c.hex, `${c.name} · ${row.label}`)))}
      </div>
      <div class="cp-custom">
        <label class="cp-native" title="Paletten özel renk seç">
          <input type="color" class="cp-native-input" aria-label="Özel renk seç" />
          <span class="cp-native-swatch"></span>
        </label>
        <input type="text" class="cp-hex" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Renk kodu (hex)" placeholder="#7c6cff" />
        <span class="cp-name" aria-live="polite"></span>
      </div>
    </div>`;

  const radios = [...root.querySelectorAll('.cp-quick .cp-chip:not(.cp-chip--current) input, .cp-grid input')];
  const extra = root.querySelector('.cp-chip--current');
  const extraRadio = extra.querySelector('input');
  const more = root.querySelector('.cp-more');
  const panel = root.querySelector('.cp-panel');
  const native = root.querySelector('.cp-native-input');
  const swatch = root.querySelector('.cp-native-swatch');
  const hex = root.querySelector('.cp-hex');
  const nameEl = root.querySelector('.cp-name');

  function setExpanded(open) {
    panel.hidden = !open;
    more.setAttribute('aria-expanded', String(open));
    if (open) panel.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  /** Tüm kontrolleri verilen renge göre günceller. `keepText`: hex alanı yazılırken metin yeniden yazılmaz. */
  function set(next, { keepText = false, silent = false } = {}) {
    const c = normalizeHexColor(next);
    if (!c) return;
    current = c;
    radios.forEach((r) => {
      r.checked = r.value === c;
    });
    // Seçili renk hızlı renklerden değilse satıra ek bir yuvarlak olarak eklenir (kapalıyken de görünsün)
    const quick = EVENT_COLORS.includes(c);
    extra.hidden = quick;
    extraRadio.value = c;
    extraRadio.checked = !quick;
    extra.style.setProperty('--c', c);
    extra.classList.toggle('is-light', isLightColor(c));
    const label = paletteColorName(c) ?? 'Özel renk';
    extra.title = label;
    extraRadio.setAttribute('aria-label', label);
    native.value = c;
    swatch.style.setProperty('--c', c);
    if (!keepText) hex.value = c;
    hex.classList.remove('is-invalid');
    nameEl.textContent = label;
    if (!silent) onChange?.(c);
  }

  root.addEventListener('change', (e) => {
    if (e.target.matches('.cp-chip input')) set(e.target.value);
  });
  more.addEventListener('click', () => setExpanded(panel.hidden));
  native.addEventListener('input', () => set(native.value));
  native.addEventListener('change', () => set(native.value));
  hex.addEventListener('input', () => {
    const parsed = parseHexInput(hex.value);
    if (parsed) set(parsed, { keepText: true });
    else hex.classList.toggle('is-invalid', hex.value.trim() !== '');
  });
  hex.addEventListener('blur', () => {
    hex.value = current; // geçersiz/yarım yazılmış metin son geçerli renge döner
    hex.classList.remove('is-invalid');
  });

  set(current, { silent: true });
  return { el: root, value: () => current, setValue: (c) => set(c), setExpanded };
}
