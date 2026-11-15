/**
 * settingsPanel.js — Ayarlar paneli (modal).
 *
 * Kenar çubuğunun altındaki "Ayarlar" düğmesiyle (veya Ctrl+K) açılır. Ayarlar sekmelere ayrılmıştır
 * (bkz. TABS); yeni ayarlar ilgili sekmeye eklenir:
 *   - Görünüm: tema (Açık / Koyu / Sistem + özel temalar) ve arka plan (görseller, yerleşim)
 *   - Takvim: çalışma günleri ve çalışma dışı günlerin Ay/Hafta görünümünde gösterilmesi
 *   - Genel: kenar çubuğu ikon modu, hatırlatmalar
 *   - Veri: JSON (yedek) ve ICS (Outlook/Gmail uyumlu takvim dosyası) dışa / içe aktarma, tüm verileri sıfırlama
 *   - Hakkında: sürüm bilgisi
 * Panel açıkken store değiştikçe içerik yeniden çizilir (kaydırma konumu ve odak korunur).
 */
import { html } from '../core/dom.js';
import { store } from '../core/state.js';
import { BASE_THEMES, CUSTOM_THEMES } from '../core/theme.js';
import { allBackgrounds, applyBackgroundSettings, BACKGROUND_FITS, backgroundUrl, COLOR_BG, colorBackgroundCss, colorBackgroundCssFromSettings, hasImage } from '../core/backgrounds.js';
import { normalizeWorkDays, orderedWeekdays } from '../core/workDays.js';
import { formatDate } from '../core/dateUtils.js';
import {
  addUserBackground,
  exportCalendar,
  exportData,
  importCalendar,
  importData,
  removeUserBackground,
  resetData,
  setBackground,
  setBackgroundColors,
  setBackgroundFit,
  setTheme,
  toggleNotifications,
  toggleShowOffDays,
  toggleSidebarCollapsed,
  toggleWorkDay,
} from '../core/actions.js';
import { openModal } from './modal.js';
import { icon } from './icons.js';
import { APP_VERSION } from '../core/version.js';

let current = null; // { modal, show }

/** Paneldeki bölümler (Ctrl+K komutları belirli bir bölüme açabilir). */
export const SETTINGS_SECTIONS = Object.freeze({ theme: 'Tema', background: 'Arka plan', calendar: 'Takvim', sidebar: 'Kenar çubuğu', notifications: 'Hatırlatmalar', data: 'Veri', about: 'Hakkında' });

function themeSection(settings) {
  return html`
    <section class="settings-section" data-section="theme">
      <h3>${icon('palette')} Tema</h3>
      <div class="segmented" role="radiogroup" aria-label="Temel tema">
        ${BASE_THEMES.map(
          (t) => html`<button type="button" role="radio" data-fk="theme-${t.value}" data-theme-set="${t.value}"
                    aria-checked="${String(settings.theme === t.value)}" class="${settings.theme === t.value ? 'is-active' : ''}">${icon(t.icon)}<span>${t.label}</span></button>`,
        )}
      </div>
      <p class="settings-sub">Özel temalar</p>
      <div class="theme-cards" role="radiogroup" aria-label="Özel temalar">
        ${CUSTOM_THEMES.map(
          (t) => html`<button type="button" role="radio" class="theme-card ${settings.theme === t.value ? 'is-active' : ''}" data-fk="theme-${t.value}" data-theme-set="${t.value}"
                    aria-checked="${String(settings.theme === t.value)}" title="${t.description}">
              <span class="theme-swatches" aria-hidden="true">${t.swatches.map((c) => html`<span style="background:${c}"></span>`)}</span>
              <span class="theme-card-name">${t.label}</span>
              ${settings.theme === t.value ? html`<span class="option-check">${icon('check')}</span>` : ''}
            </button>`,
        )}
      </div>
    </section>`;
}

function backgroundSection(settings, busy) {
  const imageSelected = hasImage(settings.background);
  return html`
    <section class="settings-section" data-section="background">
      <h3>${icon('image')} Arka plan</h3>
      <div class="bg-grid" role="radiogroup" aria-label="Arka plan">
        ${allBackgrounds().map((bg) => {
          const selected = settings.background === bg.value;
          const url = backgroundUrl(bg);
          const colorCss = bg.isColor ? colorBackgroundCssFromSettings(settings) : '';
          return html`<div class="bg-tile ${selected ? 'is-active' : ''}">
            <button type="button" role="radio" class="bg-tile-btn" data-fk="bg-${bg.value}" data-bg-value="${bg.value}" aria-checked="${String(selected)}" title="${bg.label}">
              <span class="bg-thumb ${url || colorCss ? '' : 'bg-thumb--standard'}" aria-hidden="true" ${url ? html`style="background-image:url('${url}')"` : colorCss ? html`style="background:${colorCss}"` : ''}>
                ${selected ? html`<span class="bg-thumb-check">${icon('check')}</span>` : ''}
              </span>
              <span class="bg-thumb-label">${bg.label}</span>
            </button>
            ${bg.isUser ? html`<button type="button" class="bg-thumb-remove" data-remove-bg="${bg.id}" aria-label="${bg.label} görselini sil" title="Sil">${icon('x')}</button>` : ''}
          </div>`;
        })}
        <button type="button" class="bg-tile bg-tile--add" data-fk="bg-add" data-add-bg ${busy ? 'disabled' : ''}>
          ${icon(busy ? 'scheduler' : 'upload')}<span>${busy ? 'Hazırlanıyor…' : 'Kendi görselini ekle'}</span>
        </button>
      </div>
      ${settings.background === COLOR_BG ? colorPanel(settings) : ''}
      <p class="settings-sub">Yerleşim${imageSelected ? '' : html` <span class="muted">— görsel arka planlarda</span>`}</p>
      <div class="segmented segmented--sm fit-options" role="radiogroup" aria-label="Görsel yerleşimi">
        ${BACKGROUND_FITS.map(
          (f) => html`<button type="button" role="radio" data-fk="fit-${f.value}" data-fit="${f.value}" title="${f.hint}"
                    aria-checked="${String(settings.backgroundFit === f.value)}" class="${settings.backgroundFit === f.value ? 'is-active' : ''}" ${imageSelected ? '' : 'disabled'}>${f.label}</button>`,
        )}
      </div>
    </section>`;
}

/** "Renk" arka planı seçiliyken: tek/çift renk, renk seçiciler ve önizleme. */
function colorPanel(settings) {
  const dual = settings.bgColorMode === 'dual';
  const css = colorBackgroundCssFromSettings(settings);
  const field = (n, label, value) => html`
    <label class="color-field">
      <input type="color" data-bg-color="${n}" value="${value}" aria-label="${label}" />
      <span>${label}</span><code>${value}</code>
    </label>`;
  const c1 = colorBackgroundCss({ mode: 'single', color1: settings.bgColor1 });
  const c2 = colorBackgroundCss({ mode: 'single', color1: settings.bgColor2 });
  return html`
    <div class="bg-colors">
      <p class="settings-sub">Renk arka planı</p>
      <div class="segmented segmented--sm" role="radiogroup" aria-label="Renk sayısı">
        <button type="button" role="radio" data-fk="bg-mode-single" data-bg-mode="single" aria-checked="${String(!dual)}" class="${dual ? '' : 'is-active'}">Tek renk</button>
        <button type="button" role="radio" data-fk="bg-mode-dual" data-bg-mode="dual" aria-checked="${String(dual)}" class="${dual ? 'is-active' : ''}">Çift renk · gradient</button>
      </div>
      <div class="bg-color-fields">
        ${field(1, dual ? 'Renk 1' : 'Renk', c1)}
        ${dual
          ? html`${field(2, 'Renk 2', c2)}
              <button type="button" class="icon-btn" data-fk="bg-swap" data-bg-swap aria-label="Renkleri değiştir" title="Renkleri değiştir">${icon('swap')}</button>`
          : ''}
      </div>
      <div class="bg-color-preview" style="background:${css}" aria-hidden="true"></div>
    </div>`;
}

/** 4 Ocak 2026 Pazar olduğu için 4 + gün numarası o günün tarihini verir. */
const weekdayLabel = (day, style) => formatDate(new Date(2026, 0, 4 + day), { weekday: style });

function calendarSection(settings) {
  const work = new Set(normalizeWorkDays(settings.workDays));
  return html`
    <section class="settings-section" data-section="calendar">
      <h3>${icon('month')} Takvim</h3>
      <p class="settings-sub">Çalışma günleri</p>
      <div class="workday-chips" role="group" aria-label="Çalışma günleri">
        ${orderedWeekdays(settings.weekStartsOn).map((d) => {
          const on = work.has(d);
          return html`<button type="button" class="workday-chip ${on ? 'is-on' : ''}" aria-pressed="${String(on)}" data-fk="wd-${d}" data-workday="${d}"
                    title="${weekdayLabel(d, 'long')}: ${on ? 'çalışma günü' : 'çalışma dışı'}">${weekdayLabel(d, 'short')}</button>`;
        })}
      </div>
      ${toggleRow({
        key: 'offdays',
        iconName: 'eye',
        title: 'Çalışma dışı günleri göster',
        hint: 'Ay ve Hafta görünümünde. Kapalıyken bu günlerin sütunları gizlenir; takvim başlığındaki düğmeyle de değiştirilebilir.',
        checked: settings.showOffDays !== false,
      })}
    </section>`;
}

function toggleRow({ key, iconName, title, hint, checked }) {
  return html`
    <label class="settings-row">
      <span class="settings-row-icon">${icon(iconName)}</span>
      <span class="settings-row-text"><b>${title}</b><small>${hint}</small></span>
      <span class="switch"><input type="checkbox" data-fk="toggle-${key}" data-toggle="${key}" ${checked ? 'checked' : ''} /><span></span></span>
    </label>`;
}

function generalSections(settings) {
  return html`
    <section class="settings-section" data-section="sidebar">
      <h3>${icon('menu')} Kenar çubuğu</h3>
      ${toggleRow({ key: 'sidebar', iconName: 'menu', title: 'Yalnızca ikonlar', hint: 'Kenar çubuğunu daraltır. Logoya tıklamak veya [ tuşu da aynı işi yapar.', checked: settings.sidebarCollapsed })}
    </section>
    <section class="settings-section" data-section="notifications">
      <h3>${icon('bell')} Hatırlatmalar</h3>
      ${toggleRow({ key: 'notify', iconName: 'bell', title: 'Etkinlik hatırlatmaları', hint: 'Etkinlikten 5, 15 veya 60 dakika önce bildirim gösterir.', checked: settings.notificationsEnabled })}
    </section>`;
}

function dataSection() {
  return html`
    <section class="settings-section" data-section="data">
      <h3>${icon('layers')} Veri</h3>
      <p class="settings-sub">Yedek (JSON)</p>
      <div class="settings-actions">
        <button type="button" class="btn btn-ghost" data-fk="export" data-export>${icon('download')} JSON dışa aktar</button>
        <button type="button" class="btn btn-ghost" data-fk="import" data-import>${icon('upload')} JSON içe aktar</button>
      </div>
      <p class="settings-note">Etkinlikler ve ayarlar dışa aktarılır; ekler ve kendi arka plan görselleriniz bu tarayıcıda kalır.</p>
      <p class="settings-sub">Takvim dosyası (ICS)</p>
      <div class="settings-actions">
        <button type="button" class="btn btn-ghost" data-fk="export-ics" data-export-ics>${icon('download')} ICS dışa aktar</button>
        <button type="button" class="btn btn-ghost" data-fk="import-ics" data-import-ics>${icon('upload')} ICS içe aktar</button>
      </div>
      <p class="settings-note">Outlook, Gmail ve diğer takvim uygulamalarıyla uyumlu .ics dosyası. Gmail'de Ayarlar → İçe aktar ve dışa aktar, Outlook'ta Takvim ekle → Dosyadan yükle ile içe aktarabilirsiniz. Bu tek seferlik bir aktarımdır; iki yönlü senkron değildir.</p>
      <p class="settings-sub">Sıfırla</p>
      <div class="settings-actions">
        <button type="button" class="btn btn-danger-ghost" data-fk="reset" data-reset>${icon('trash')} Tüm verileri sıfırla</button>
      </div>
      <p class="settings-note">Etkinlikler, ekler, kendi arka plan görselleriniz ve ayarlar silinir; uygulama ilk kurulum haline döner. Önce onayınız istenir ve isteğe bağlı olarak yedek alınır.</p>
    </section>`;
}

function aboutSection() {
  return html`
    <section class="settings-section" data-section="about">
      <div class="about-card">
        <span class="brand-logo" aria-hidden="true">${icon('month')}</span>
        <div>
          <h3 class="about-title">Calendar <b>Pro</b></h3>
          <p class="settings-note">Sürüm <b class="about-version">v${APP_VERSION}</b></p>
        </div>
      </div>
      <p class="settings-note">Takvim, görev ve proje planlama uygulaması. İnternet olmadan da çalışır; tüm veriler yalnızca bu tarayıcıda saklanır.</p>
      <p class="settings-note">Değişiklikler için projedeki <code>CHANGELOG.md</code> dosyasına bakın.</p>
    </section>`;
}

/**
 * Sekmeler — yeni ayarlar ilgili sekmeye eklenir (gerekirse yeni sekme açılır).
 * `sections`: Ctrl+K komutlarının açabileceği bölüm adları.
 */
const TABS = Object.freeze([
  { id: 'appearance', label: 'Görünüm', icon: 'palette', sections: ['theme', 'background'], render: (s, busy) => html`${themeSection(s)}${backgroundSection(s, busy)}` },
  { id: 'calendar', label: 'Takvim', icon: 'month', sections: ['calendar'], render: (s) => calendarSection(s) },
  { id: 'general', label: 'Genel', icon: 'settings', sections: ['sidebar', 'notifications'], render: (s) => generalSections(s) },
  { id: 'data', label: 'Veri', icon: 'layers', sections: ['data'], render: () => dataSection() },
  { id: 'about', label: 'Hakkında', icon: 'sparkles', sections: ['about'], render: () => aboutSection() },
]);

const tabForSection = (section) => TABS.find((t) => t.sections.includes(section))?.id;
let lastTab = TABS[0].id; // panel yeniden açıldığında son sekme hatırlanır

function render(body, busy, activeTab) {
  const { settings } = store.get();
  const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
  body.innerHTML = html`
    <div class="settings">
      <div class="settings-tabs" role="tablist" aria-label="Ayar grupları">
        ${TABS.map(
          (t) => html`<button type="button" role="tab" id="settings-tab-${t.id}" class="settings-tab ${t.id === tab.id ? 'is-active' : ''}"
                    data-fk="tab-${t.id}" data-tab="${t.id}" aria-selected="${String(t.id === tab.id)}" aria-controls="settings-panel"
                    tabindex="${t.id === tab.id ? '0' : '-1'}">${icon(t.icon)}<span>${t.label}</span></button>`,
        )}
      </div>
      <div class="settings-panel" id="settings-panel" role="tabpanel" aria-labelledby="settings-tab-${tab.id}">
        ${tab.render(settings, busy)}
      </div>
    </div>`;
}

/**
 * Ayarlar panelini açar.
 * @param {{section?: keyof SETTINGS_SECTIONS}} [options] verilirse ilgili sekme açılır ve bölüme kaydırılır
 */
export function openSettings({ section } = {}) {
  if (current) {
    current.show(section);
    return;
  }
  const body = document.createElement('div');
  let busy = false;
  let activeTab = tabForSection(section) || lastTab;
  render(body, busy, activeTab);

  // Sabit boyutlu: sekmeler arasında geçerken panel büyüyüp küçülmez; telefonda tam ekran (bkz. .modal--settings)
  const modal = openModal({ title: 'Ayarlar', body, size: 'lg', className: 'modal--settings', onClose: () => {
    unsubscribe();
    current = null;
  } });
  const scroller = modal.body;

  /** Odak ve kaydırma konumunu koruyarak yeniden çizer. */
  function rerender() {
    const focusKey = document.activeElement?.dataset?.fk;
    const top = scroller.scrollTop;
    render(body, busy, activeTab);
    scroller.scrollTop = top;
    if (focusKey) body.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  }

  function selectTab(id, { focus = true } = {}) {
    if (!TABS.some((t) => t.id === id)) return;
    activeTab = id;
    lastTab = id;
    render(body, busy, activeTab);
    scroller.scrollTop = 0;
    if (focus) body.querySelector(`[data-tab="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }

  const unsubscribe = store.subscribe((s, prev) => {
    if (s.settings !== prev.settings || s.userBackgrounds !== prev.userBackgrounds) rerender();
  });

  body.addEventListener('click', async (e) => {
    const t = e.target;
    if (!body.contains(t)) return undefined;
    const tabBtn = t.closest('[data-tab]');
    if (tabBtn) return selectTab(tabBtn.dataset.tab);
    const theme = t.closest('[data-theme-set]');
    if (theme) return setTheme(theme.dataset.themeSet);
    const remove = t.closest('[data-remove-bg]');
    if (remove) return removeUserBackground(remove.dataset.removeBg);
    // Not: <html> öğesinin de data-bg özniteliği var; bu yüzden ayrı bir öznitelik (data-bg-value) kullanılır
    const bg = t.closest('[data-bg-value]');
    if (bg) {
      await setBackground(bg.dataset.bgValue);
      // "Renk" seçilince renk ayarları panelin altında kalmasın
      if (bg.dataset.bgValue === COLOR_BG) body.querySelector('.bg-colors')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return undefined;
    }
    if (t.closest('[data-add-bg]')) {
      if (busy) return undefined;
      busy = true;
      rerender();
      await addUserBackground();
      busy = false;
      return rerender();
    }
    const workday = t.closest('[data-workday]');
    if (workday) return toggleWorkDay(Number(workday.dataset.workday));
    const fit = t.closest('[data-fit]');
    if (fit && !fit.disabled) return setBackgroundFit(fit.dataset.fit);
    if (t.closest('[data-export]')) return exportData();
    if (t.closest('[data-import]')) return importData();
    if (t.closest('[data-export-ics]')) return exportCalendar();
    if (t.closest('[data-import-ics]')) return importCalendar();
    if (t.closest('[data-reset]')) return resetData();
    const mode = t.closest('[data-bg-mode]');
    if (mode) return setBackgroundColors({ mode: mode.dataset.bgMode });
    if (t.closest('[data-bg-swap]')) {
      const cur = store.get().settings;
      return setBackgroundColors({ color1: cur.bgColor2, color2: cur.bgColor1 });
    }
    return undefined;
  });

  // Sekmeler arasında ← → / Home / End ile gezinme (WAI-ARIA tab deseni)
  body.addEventListener('keydown', (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (!tabBtn) return;
    const ids = TABS.map((t) => t.id);
    const i = ids.indexOf(tabBtn.dataset.tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(ids[(next + ids.length) % ids.length]);
  });

  // Renk seçici sürüklenirken canlı önizleme (kaydetmeden); seçim bitince (change) kaydedilir.
  // Kaydetmek paneli yeniden çizdiği için sürükleme sırasında store güncellenmez.
  body.addEventListener('input', (e) => {
    const input = e.target.closest?.('[data-bg-color]');
    if (!input) return;
    const cur = store.get().settings;
    const value = (n) => body.querySelector(`[data-bg-color="${n}"]`)?.value;
    const css = colorBackgroundCss({ mode: cur.bgColorMode, color1: value(1) ?? cur.bgColor1, color2: value(2) ?? cur.bgColor2 });
    document.documentElement.style.setProperty('--app-bg-color', css);
    body.querySelector('.bg-color-preview')?.style.setProperty('background', css);
    const code = input.closest('.color-field')?.querySelector('code');
    if (code) code.textContent = input.value;
  });
  // Seçici iptal edilirse (değişiklik kaydedilmediyse) sayfa kaydedilmiş arka plana döner
  body.addEventListener('focusout', (e) => {
    if (e.target.closest?.('[data-bg-color]')) applyBackgroundSettings(store.get().settings);
  });

  body.addEventListener('change', (e) => {
    const colorInput = e.target.closest('[data-bg-color]');
    if (colorInput) {
      setBackgroundColors({ [colorInput.dataset.bgColor === '2' ? 'color2' : 'color1']: colorInput.value });
      return;
    }
    const toggle = e.target.closest('[data-toggle]');
    if (!toggle) return;
    if (toggle.dataset.toggle === 'sidebar') {
      if (toggle.checked !== Boolean(store.get().settings.sidebarCollapsed)) toggleSidebarCollapsed();
    } else if (toggle.dataset.toggle === 'offdays') {
      toggleShowOffDays(toggle.checked);
    } else if (toggle.dataset.toggle === 'notify') {
      toggleNotifications(toggle.checked);
    }
  });

  /** İlgili sekmeyi açar ve bölüme kaydırır. */
  const show = (name) => {
    const tabId = tabForSection(name);
    if (tabId && tabId !== activeTab) selectTab(tabId, { focus: false });
    const target = name && body.querySelector(`[data-section="${CSS.escape(name)}"]`);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  current = { modal, show };
  if (section) show(section);
}
