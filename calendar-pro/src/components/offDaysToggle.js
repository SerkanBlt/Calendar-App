/**
 * offDaysToggle.js — Ay ve Hafta görünümlerinin başlığındaki "çalışma dışı günler" düğmesi.
 * Tıklanınca settings.showOffDays değişir (Ayarlar → Takvim'deki anahtarla aynı ayar).
 * Tıklama main.js'teki kabuk eylemleri arasında `data-action="toggle-offdays"` ile işlenir.
 */
import { html } from '../core/dom.js';
import { icon } from './icons.js';

export function offDaysToggle(settings) {
  const shown = settings.showOffDays !== false;
  const label = shown ? 'Çalışma dışı günleri gizle' : 'Çalışma dışı günleri göster';
  return html`
    <button type="button" class="chip-btn ${shown ? '' : 'is-on'}" data-action="toggle-offdays" aria-pressed="${String(!shown)}" title="${label}" aria-label="${label}">
      ${icon(shown ? 'eye' : 'eyeOff')}<span class="hide-sm">${shown ? 'Tüm günler' : 'Çalışma günleri'}</span>
    </button>`;
}
