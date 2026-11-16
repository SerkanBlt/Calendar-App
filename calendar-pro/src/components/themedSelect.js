/**
 * themedSelect.js — Açılır kutu (select) listelerini temaya uygun çizer.
 *
 * Tarayıcının yerel açılır listesi işletim sisteminin renklerini kullanır ve uygulama temasıyla (özellikle özel temalarla) uyuşmaz. Bu modül, ince işaretçili
 * (fare/dokunmatik yüzey) cihazlarda `<select>` öğesine tıklanınca YEREL listeyi engelleyip yerine temanın renk belirteçleriyle (--surface-solid, --accent …)
 * çizilen bir liste açar. `<select>` olduğu yerde, aynı görünümle ve değeriyle durur: form, `change`/`input` olayları, etiket odağı ve `selectOption` gibi
 * otomasyon aynen çalışır; yalnızca açılan liste özeldir.
 *
 * - Klavye: Boşluk / Enter / F4 / Alt+↓ açar; açıkken ↑ ↓ Home End PageUp PageDown gezinir, Enter/Boşluk seçer, Esc kapatır (pencereyi kapatmadan), Tab kapatır,
 *   harf yazmak ilk eşleşen seçeneğe gider.
 * - Dokunmatik (kaba işaretçi) cihazlarda yerel liste korunur: telefonun kendi seçicisi daha uygundur ve sistem temasına uyar.
 * - `multiple`, `size > 1` ve `data-native` işaretli select'ler kapsam dışıdır.
 */
let pop = null; // { el, select, options, active, typed, typedAt }

const fine = () => window.matchMedia('(pointer: fine)').matches;
const eligible = (el) => el instanceof HTMLSelectElement && !el.multiple && !(el.size > 1) && !el.hasAttribute('data-native') && !el.disabled;

function items(select) {
  return [...select.options].map((o, i) => ({ i, value: o.value, label: o.textContent.trim(), disabled: o.disabled || o.parentElement?.disabled }));
}

function setActive(index, { scroll = true } = {}) {
  if (!pop) return;
  const enabled = pop.options.filter((o) => !o.disabled);
  if (!enabled.length) return;
  pop.active = pop.options[index]?.disabled ? pop.active : index;
  pop.el.querySelectorAll('.cs-opt').forEach((n) => n.classList.toggle('is-active', Number(n.dataset.i) === pop.active));
  const node = pop.el.querySelector(`.cs-opt[data-i="${pop.active}"]`);
  if (node) {
    pop.el.setAttribute('aria-activedescendant', node.id);
    if (scroll) node.scrollIntoView({ block: 'nearest' });
  }
}

function move(delta) {
  const idx = pop.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  if (!idx.length) return;
  const at = idx.indexOf(pop.active);
  setActive(idx[Math.min(idx.length - 1, Math.max(0, (at < 0 ? 0 : at) + delta))]);
}

function position() {
  const r = pop.select.getBoundingClientRect();
  const el = pop.el;
  el.style.minWidth = `${Math.max(r.width, 140)}px`;
  el.style.maxHeight = '';
  const vh = window.innerHeight;
  const below = vh - r.bottom - 8;
  const above = r.top - 8;
  const natural = Math.min(el.scrollHeight, 320);
  const openUp = natural > below && above > below;
  const room = Math.max(120, Math.min(320, openUp ? above : below));
  el.style.maxHeight = `${room}px`;
  const h = Math.min(el.scrollHeight, room);
  el.style.top = `${openUp ? Math.max(8, r.top - 4 - h) : r.bottom + 4}px`;
  const w = el.offsetWidth;
  el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
}

export function closeThemedSelect({ focus = true } = {}) {
  if (!pop) return;
  const { el, select } = pop;
  pop = null;
  el.remove();
  select.setAttribute('aria-expanded', 'false');
  if (focus) select.focus({ preventScroll: true });
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('pointerdown', onOutside, true);
}

function choose(index) {
  const { select, options } = pop;
  const opt = options[index];
  if (!opt || opt.disabled) return;
  const changed = select.value !== opt.value;
  closeThemedSelect();
  if (changed) {
    select.value = opt.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function open(select) {
  closeThemedSelect({ focus: false });
  const options = items(select);
  const el = document.createElement('div');
  el.className = 'cs-pop';
  el.setAttribute('role', 'listbox');
  el.id = `cs-pop-${Math.random().toString(36).slice(2, 8)}`;
  el.innerHTML = options
    .map((o) => `<div class="cs-opt" role="option" id="${el.id}-${o.i}" data-i="${o.i}" aria-selected="${o.i === select.selectedIndex}" ${o.disabled ? 'aria-disabled="true"' : ''}></div>`)
    .join('');
  options.forEach((o) => {
    el.querySelector(`[data-i="${o.i}"]`).textContent = o.label || ' '; // metin olarak yazılır (HTML değil)
  });
  document.body.appendChild(el);
  pop = { el, select, options, active: Math.max(0, select.selectedIndex), typed: '', typedAt: 0 };
  select.setAttribute('aria-haspopup', 'listbox');
  select.setAttribute('aria-expanded', 'true');
  select.setAttribute('aria-controls', el.id);
  position();
  setActive(pop.active);
  el.addEventListener('pointermove', (e) => {
    const n = e.target.closest('.cs-opt');
    if (n && Number(n.dataset.i) !== pop.active && n.getAttribute('aria-disabled') !== 'true') setActive(Number(n.dataset.i), { scroll: false });
  });
  el.addEventListener('mousedown', (e) => e.preventDefault()); // odak select'te kalsın
  el.addEventListener('click', (e) => {
    const n = e.target.closest('.cs-opt');
    if (n) choose(Number(n.dataset.i));
  });
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerdown', onOutside, true);
}

function onScroll(e) {
  if (pop && !pop.el.contains(e.target)) closeThemedSelect({ focus: false });
}
function onResize() {
  closeThemedSelect({ focus: false });
}
function onOutside(e) {
  if (!pop) return;
  if (pop.el.contains(e.target) || e.target === pop.select) return; // select'in kendisi mousedown'da kapatır/açar
  closeThemedSelect({ focus: false });
}

function onMouseDown(e) {
  const select = e.target.closest?.('select');
  if (!select || e.button !== 0 || !eligible(select) || !fine()) return;
  e.preventDefault(); // yerel listeyi açma
  select.focus({ preventScroll: true });
  if (pop && pop.select === select) closeThemedSelect();
  else open(select);
}

function onKeyDown(e) {
  if (pop) {
    const key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation(); // üstteki pencerenin Esc'i çalışmasın: yalnızca liste kapanır
      closeThemedSelect();
    } else if (key === 'ArrowDown') (e.preventDefault(), move(1));
    else if (key === 'ArrowUp') (e.preventDefault(), move(-1));
    else if (key === 'Home') (e.preventDefault(), move(-1000));
    else if (key === 'End') (e.preventDefault(), move(1000));
    else if (key === 'PageDown') (e.preventDefault(), move(8));
    else if (key === 'PageUp') (e.preventDefault(), move(-8));
    else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (key === ' ' && Date.now() - pop.typedAt < 700 && pop.typed) typeahead(' ');
      else choose(pop.active);
    } else if (key === 'Tab') closeThemedSelect({ focus: false });
    else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) (e.preventDefault(), typeahead(key));
    return;
  }
  const select = e.target;
  if (!eligible(select) || !fine()) return;
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) {
    e.preventDefault();
    open(select);
  }
}

function typeahead(ch) {
  const now = Date.now();
  pop.typed = now - pop.typedAt > 700 ? ch : pop.typed + ch;
  pop.typedAt = now;
  const q = pop.typed.toLocaleLowerCase('tr');
  const start = pop.typed.length === 1 ? pop.active + 1 : pop.active;
  const order = [...pop.options.keys()];
  const rotated = [...order.slice(start % order.length), ...order.slice(0, start % order.length)];
  const hit = rotated.find((i) => !pop.options[i].disabled && pop.options[i].label.toLocaleLowerCase('tr').startsWith(q));
  if (hit !== undefined) setActive(hit);
}

let installed = false;
/** Uygulama başında bir kez çağrılır. */
export function installThemedSelects() {
  if (installed) return;
  installed = true;
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('keydown', onKeyDown, true);
}
