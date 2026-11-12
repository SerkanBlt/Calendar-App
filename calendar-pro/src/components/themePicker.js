/**
 * themePicker.js — Özel tema seçim paneli.
 * Her tema renk şeridi, adı ve açıklamasıyla listelenir (altyapı: pickerPopover.js).
 */
import { html } from '../core/dom.js';
import { CUSTOM_THEMES } from '../core/theme.js';
import { icon } from './icons.js';
import { togglePicker } from './pickerPopover.js';

/**
 * @param {{anchor?: HTMLElement, value: string, onSelect: (value: string) => void}} options
 */
export function openThemePicker({ anchor, value, onSelect }) {
  togglePicker({
    key: 'theme',
    title: 'Özel temalar',
    iconName: 'palette',
    layout: 'list',
    anchor,
    items: CUSTOM_THEMES,
    value,
    onSelect,
    renderItem: (t, selected) => html`
      <span class="theme-swatches" aria-hidden="true">${t.swatches.map((c) => html`<span style="background:${c}"></span>`)}</span>
      <span class="theme-option-text"><b>${t.label}</b><small>${t.description}</small></span>
      <span class="option-check">${selected ? icon('check') : ''}</span>`,
  });
}
