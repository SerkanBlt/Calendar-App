/**
 * backgroundPicker.js — Arka plan seçim paneli.
 *
 * Üstte arka planlar (hazır olanlar + kullanıcının yükledikleri) küçük önizlemelerle iki sütunlu
 * ızgarada; altta "Kendi görselini ekle" butonu ve yerleşim seçenekleri
 * (Doldur · Sığdır · Uzat · Döşe · Ortala) yer alır.
 * Panel seçimden sonra açık kalır; görsel ve yerleşim art arda denenebilir.
 * Kullanıcı görsellerinin köşesindeki × ile görsel silinir ("Geri al" bildirimiyle).
 * "Standart" seçiliyken yerleşim devre dışıdır. Altyapı: pickerPopover.js
 */
import { html } from '../core/dom.js';
import { allBackgrounds, BACKGROUND_FITS, backgroundUrl, hasImage } from '../core/backgrounds.js';
import { addUserBackground, removeUserBackground } from '../core/actions.js';
import { icon } from './icons.js';
import { togglePicker } from './pickerPopover.js';

/**
 * @param {{anchor?: HTMLElement|Function, value: string, fit: string,
 *          onSelect: (value: string) => void, onFit: (fit: string) => void}} options
 */
export function openBackgroundPicker({ anchor, value, fit, onSelect, onFit }) {
  let currentFit = fit;
  let busy = false;

  togglePicker({
    key: 'background',
    title: 'Arka plan',
    iconName: 'image',
    layout: 'grid',
    anchor,
    items: allBackgrounds,
    value,
    closeOnSelect: false,
    onSelect,
    renderItem: (bg, selected) => {
      const url = backgroundUrl(bg);
      return html`
        <span class="bg-thumb ${url ? '' : 'bg-thumb--standard'}" aria-hidden="true" ${url ? html`style="background-image:url('${url}')"` : ''}>
          ${selected ? html`<span class="bg-thumb-check">${icon('check')}</span>` : ''}
        </span>
        <span class="bg-thumb-label" title="${bg.label}">${bg.label}</span>
        ${bg.isUser
          ? html`<button type="button" class="bg-thumb-remove" data-item-action="remove" data-id="${bg.id}" aria-label="${bg.label} görselini sil" title="Sil">${icon('x')}</button>`
          : ''}`;
    },
    footer: (selectedBg) => {
      const disabled = !hasImage(selectedBg);
      return html`
        <button type="button" class="bg-add-btn" data-add-bg ${busy ? 'disabled' : ''}>
          ${icon(busy ? 'scheduler' : 'upload')}<span>${busy ? 'Görsel hazırlanıyor…' : 'Kendi görselini ekle'}</span>
        </button>
        <div class="picker-footer-label">Yerleşim${disabled ? html` <span class="muted">— görsel arka planlarda</span>` : ''}</div>
        <div class="segmented segmented--sm fit-options" role="radiogroup" aria-label="Görsel yerleşimi">
          ${BACKGROUND_FITS.map(
            (f) => html`<button type="button" role="radio" data-fit="${f.value}" title="${f.hint}"
                      aria-checked="${f.value === currentFit}" class="${f.value === currentFit ? 'is-active' : ''}" ${disabled ? 'disabled' : ''}>${f.label}</button>`,
          )}
        </div>`;
    },
    onFooterClick: async (e, refresh) => {
      if (e.target.closest('[data-add-bg]')) {
        if (busy) return;
        busy = true;
        refresh();
        const added = await addUserBackground();
        busy = false;
        refresh(added); // eklendiyse yeni görsel seçili olarak gösterilir
        return;
      }
      const btn = e.target.closest('[data-fit]');
      if (!btn || btn.disabled) return;
      currentFit = btn.dataset.fit;
      onFit(currentFit);
      refresh();
    },
    onItemAction: async (e, refresh) => {
      const btn = e.target.closest('[data-item-action="remove"]');
      if (!btn) return;
      const changedTo = await removeUserBackground(btn.dataset.id);
      refresh(changedTo);
    },
  });
}
