/**
 * backgroundPicker.js — Arka plan seçim paneli.
 * Arka planlar küçük önizlemelerle iki sütunlu ızgarada gösterilir (altyapı: pickerPopover.js).
 * "Standart" önizlemesi aktif temanın kendi degradesidir.
 */
import { html } from '../core/dom.js';
import { BACKGROUNDS, backgroundUrl } from '../core/backgrounds.js';
import { icon } from './icons.js';
import { togglePicker } from './pickerPopover.js';

/**
 * @param {{anchor?: HTMLElement, value: string, onSelect: (value: string) => void}} options
 */
export function openBackgroundPicker({ anchor, value, onSelect }) {
  togglePicker({
    key: 'background',
    title: 'Arka plan',
    iconName: 'image',
    layout: 'grid',
    anchor,
    items: BACKGROUNDS,
    value,
    onSelect,
    renderItem: (bg, selected) => html`
      <span class="bg-thumb ${bg.src ? '' : 'bg-thumb--standard'}" aria-hidden="true"
            ${bg.src ? html`style="background-image:url('${backgroundUrl(bg)}')"` : ''}>
        ${selected ? html`<span class="bg-thumb-check">${icon('check')}</span>` : ''}
      </span>
      <span class="bg-thumb-label">${bg.label}</span>`,
  });
}
