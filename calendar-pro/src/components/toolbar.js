/**
 * toolbar.js — Görünüm başlık çubuğu.
 *
 * Kabuk eylemleri `data-action` ile işaretlenir ve main.js tarafından delegasyonla işlenir:
 *  menu (mobil kenar çubuğu), prev, next, today, new
 * View'a özgü kontroller `extra` parametresiyle eklenir; `beforeNew` ise doğrudan "Yeni" düğmesinin soluna yerleşir.
 *
 * Mobil kabuk (≤900px genişlik VEYA ≤500px yükseklik = yatay telefon): eylem satırı tam genişlikte ve sola dayalıdır (yatayda başlıkla tek satırda kompakt şerit, altyazı gizli); Geri/Bugün/İleri bloğu (`.toolbar-nav`)
 * her zaman en başta durur ve "Yeni" düğmesi gizlenir — onun yerine sağ alttaki yuvarlak düğme (FAB, bkz. main.js) kullanılır.
 */
import { html } from '../core/dom.js';
import { dayMonthShort } from '../core/dateUtils.js';
import { icon } from './icons.js';

export function toolbar({ title, subtitle = '', nav = false, extra = '', beforeNew = '' }) {
  return html`
    <header class="toolbar">
      <button type="button" class="icon-btn only-mobile" data-action="menu" aria-label="Menüyü aç">${icon('menu')}</button>
      <div class="toolbar-title">
        <h1>${title}</h1>
        ${subtitle ? html`<p>${subtitle}</p>` : ''}
      </div>
      <div class="toolbar-actions">
        ${extra}
        ${nav
          ? html`<div class="btn-group toolbar-nav">
              <button type="button" class="icon-btn" data-action="prev" aria-label="Önceki" title="Önceki (←)">${icon('chevronLeft')}</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="today" title="Bugüne git (T)">Bugün: ${dayMonthShort()}</button>
              <button type="button" class="icon-btn" data-action="next" aria-label="Sonraki" title="Sonraki (→)">${icon('chevronRight')}</button>
            </div>`
          : ''}
        ${beforeNew}
        <button type="button" class="btn btn-primary btn-sm" data-action="new" title="Yeni etkinlik (N)">${icon('plus')}<span class="hide-sm">Yeni</span></button>
      </div>
    </header>`;
}
