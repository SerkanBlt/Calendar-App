/**
 * backgroundPicker.js — Arka plan seçim paneli.
 *
 * Üstte arka planlar küçük önizlemelerle iki sütunlu ızgarada, altta yerleşim seçenekleri
 * (Doldur · Sığdır · Uzat · Döşe · Ortala) yer alır. Panel seçimden sonra açık kalır; böylece
 * görsel ve yerleşim art arda denenebilir. "Standart" seçiliyken yerleşim devre dışıdır.
 * Altyapı: pickerPopover.js
 */
import { html } from '../core/dom.js';
import { BACKGROUND_FITS, BACKGROUNDS, backgroundUrl, hasImage } from '../core/backgrounds.js';
import { icon } from './icons.js';
import { togglePicker } from './pickerPopover.js';

/**
 * @param {{anchor?: HTMLElement|Function, value: string, fit: string,
 *          onSelect: (value: string) => void, onFit: (fit: string) => void}} options
 */
export function openBackgroundPicker({ anchor, value, fit, onSelect, onFit }) {
  let currentFit = fit;

  togglePicker({
    key: 'background',
    title: 'Arka plan',
    iconName: 'image',
    layout: 'grid',
    anchor,
    items: BACKGROUNDS,
    value,
    closeOnSelect: false,
    onSelect,
    renderItem: (bg, selected) => html`
      <span class="bg-thumb ${bg.src ? '' : 'bg-thumb--standard'}" aria-hidden="true"
            ${bg.src ? html`style="background-image:url('${backgroundUrl(bg)}')"` : ''}>
        ${selected ? html`<span class="bg-thumb-check">${icon('check')}</span>` : ''}
      </span>
      <span class="bg-thumb-label">${bg.label}</span>`,
    footer: (selectedBg) => {
      const disabled = !hasImage(selectedBg);
      return html`
        <div class="picker-footer-label">Yerleşim${disabled ? html` <span class="muted">— görsel arka planlarda</span>` : ''}</div>
        <div class="segmented segmented--sm fit-options" role="radiogroup" aria-label="Görsel yerleşimi">
          ${BACKGROUND_FITS.map(
            (f) => html`<button type="button" role="radio" data-fit="${f.value}" title="${f.hint}"
                      aria-checked="${f.value === currentFit}" class="${f.value === currentFit ? 'is-active' : ''}" ${disabled ? 'disabled' : ''}>${f.label}</button>`,
          )}
        </div>`;
    },
    onFooterClick: (e, refresh) => {
      const btn = e.target.closest('[data-fit]');
      if (!btn || btn.disabled) return;
      currentFit = btn.dataset.fit;
      onFit(currentFit);
      refresh();
    },
  });
}
