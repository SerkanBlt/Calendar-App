/**
 * colorPicker.js — Modern renk seçici: 12 ton × 3 yoğunluk (açık / canlı / koyu) palet + özel renk.
 *
 *  - Palet radyo düğmeleridir (ok tuşlarıyla gezilir, tek sekme durağı); seçili renk halka ve onay işaretiyle belirtilir.
 *  - "Özel": yuvarlak düğme sistemin renk seçicisini açar; yanındaki alana hex kod yazılabilir (#abc veya #aabbcc).
 *  - Tek durum kaynağı `value`'dur; her kontrol onu günceller ve `onChange(hex)` çağrılır.
 * Palet ve renk matematiği core/colors.js içindedir (DOM'suz, test edilir).
 */
import { html } from '../core/dom.js';
import { COLOR_PALETTE, isLightColor, paletteColorName, parseHexInput } from '../core/colors.js';
import { normalizeHexColor } from '../core/eventModel.js';

let uid = 0;

/**
 * @param {{value: string, onChange?: (hex: string) => void}} options
 * @returns {{el: HTMLElement, value: () => string, setValue: (hex: string) => void}}
 */
export function createColorPicker({ value, onChange }) {
  const group = `color-choice-${++uid}`;
  let current = normalizeHexColor(value) || COLOR_PALETTE[1].colors[0].hex;

  const root = document.createElement('div');
  root.className = 'color-picker';
  root.innerHTML = html`
    <div class="cp-grid" role="radiogroup" aria-label="Renk paleti">
      ${COLOR_PALETTE.flatMap((row) =>
        row.colors.map(
          (c) => html`<label class="cp-chip ${isLightColor(c.hex) ? 'is-light' : ''}" style="--c:${c.hex}" title="${c.name} · ${row.label}">
            <input type="radio" name="${group}" value="${c.hex}" aria-label="${c.name} (${row.label})" />
            <span></span>
          </label>`,
        ),
      )}
    </div>
    <div class="cp-custom">
      <label class="cp-native" title="Paletten özel renk seç">
        <input type="color" class="cp-native-input" aria-label="Özel renk seç" />
        <span class="cp-native-swatch"></span>
      </label>
      <input type="text" class="cp-hex" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Renk kodu (hex)" placeholder="#7c6cff" />
      <span class="cp-name" aria-live="polite"></span>
    </div>`;

  const radios = [...root.querySelectorAll('.cp-chip input')];
  const native = root.querySelector('.cp-native-input');
  const swatch = root.querySelector('.cp-native-swatch');
  const hex = root.querySelector('.cp-hex');
  const nameEl = root.querySelector('.cp-name');

  /** Tüm kontrolleri verilen renge göre günceller. `keepText`: hex alanı yazılırken metin yeniden yazılmaz. */
  function set(next, { keepText = false, silent = false } = {}) {
    const c = normalizeHexColor(next);
    if (!c) return;
    current = c;
    radios.forEach((r) => {
      r.checked = r.value === c;
    });
    native.value = c;
    swatch.style.setProperty('--c', c);
    if (!keepText) hex.value = c;
    hex.classList.remove('is-invalid');
    nameEl.textContent = paletteColorName(c) ?? 'Özel renk';
    if (!silent) onChange?.(c);
  }

  root.querySelector('.cp-grid').addEventListener('change', (e) => {
    if (e.target.matches('input[type="radio"]')) set(e.target.value);
  });
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
  return { el: root, value: () => current, setValue: (c) => set(c) };
}
