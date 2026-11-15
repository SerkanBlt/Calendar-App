/**
 * fab.js — Sağ alttaki yüzen "Yeni etkinlik" düğmesi (mobil/tablet).
 *
 *  - Kısa dokunuş / tıklama: etkinlik oluşturur (`onActivate`).
 *  - Basılı tutma (≈0,4 sn): düğme "taşıma moduna" girer (hafif titreşim, büyür, tam opak olur); parmakla **dikey eksende** yukarı/aşağı
 *    sürüklenir. Yatay konum sabittir (sağ kenar). Bırakınca konum kaydedilir (`onMoved`), sonraki açılışta korunur.
 *  - Basılı tutmadan önce parmak kayarsa (ör. sayfayı kaydırma niyeti) taşıma başlamaz; taşımadan sonra gelen tıklama yeni etkinlik açmaz.
 *  - Konum, `--fab-bottom` CSS değişkeniyle (alt kenardan piksel) verilir; sınırlar clampFabBottom'dadır (alt boşluk ve üstte başlığa yer).
 */
export const FAB_SIZE = 56;
const MARGIN_BOTTOM = 16;
const MARGIN_TOP = 72; // üstte başlık panelinin altında kalınır
const HOLD_MS = 420;
const MOVE_TOLERANCE = 10; // basılı tutma süresi dolmadan bu kadar kayarsa taşıma iptal

/** Alt kenardan uzaklığı (px) ekran yüksekliğine göre izinli aralığa sıkıştırır. */
export function clampFabBottom(bottom, viewportHeight = window.innerHeight) {
  const max = Math.max(MARGIN_BOTTOM, viewportHeight - FAB_SIZE - MARGIN_TOP);
  const value = Number.isFinite(Number(bottom)) ? Number(bottom) : MARGIN_BOTTOM;
  return Math.min(max, Math.max(MARGIN_BOTTOM, Math.round(value)));
}

/** Konumu CSS değişkenine yazar. */
export function applyFabBottom(bottom, root = document.documentElement) {
  root.style.setProperty('--fab-bottom', `${clampFabBottom(bottom)}px`);
}

/**
 * @param {HTMLElement} el düğme
 * @param {{onActivate: () => void, getBottom: () => number, onMoved?: (bottom: number) => void}} options
 */
export function setupFab(el, { onActivate, getBottom, onMoved }) {
  let timer = null;
  let dragging = false;
  let pointerId = null;
  let startY = 0;
  let startBottom = 0;
  let bottom = 0;
  let suppressClick = false;
  let slid = false; // basılı tutma dolmadan kaydı (kaydırma niyeti): bırakınca gelen click yeni etkinlik açmasın

  const cancelHold = () => {
    clearTimeout(timer);
    timer = null;
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    startY = e.clientY;
    startBottom = clampFabBottom(getBottom());
    bottom = startBottom;
    dragging = false;
    slid = false;
    cancelHold();
    try {
      el.setPointerCapture(pointerId); // imleç/parmak düğmenin dışına çıksa da hareketler buraya gelsin (dokunmada zaten örtük)
    } catch {
      /* pointer artık etkin değil */
    }
    timer = setTimeout(() => {
      dragging = true;
      el.classList.add('is-dragging');
      navigator.vibrate?.(12);
    }, HOLD_MS);
  });

  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    if (!dragging) {
      if (timer && Math.abs(e.clientY - startY) > MOVE_TOLERANCE) {
        cancelHold(); // basılı tutma değil, kaydırma/sürükleme niyeti
        slid = true;
      }
      return;
    }
    e.preventDefault();
    bottom = clampFabBottom(startBottom - (e.clientY - startY)); // yukarı sürükleyince alt kenardan uzaklık artar
    applyFabBottom(bottom);
  });

  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    cancelHold();
    pointerId = null;
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    suppressClick = true; // parmak kalkınca gelen click yeni etkinlik açmasın
    setTimeout(() => {
      suppressClick = false;
    }, 400);
    onMoved?.(bottom);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  el.addEventListener('click', (e) => {
    if (suppressClick || slid) {
      suppressClick = false;
      slid = false;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    onActivate();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault()); // uzun basınca bağlam menüsü çıkmasın
}
