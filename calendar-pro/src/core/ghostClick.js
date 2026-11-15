/**
 * ghostClick.js — "Hayalet tıklama" koruması.
 *
 * Dokunmatik ekranda bir öğeye dokunulunca tarayıcı, parmak kalktıktan (pointerup) hemen sonra aynı noktaya sahte fare olayları
 * (mousedown / mouseup / click) gönderir. Uygulama bir etkinliğe dokunulunca pencereyi `pointerup` anında açtığı için bu sahte olaylar
 * yeni açılan pencerenin, dokunulan noktanın altına düşen öğesine ulaşırdı (ör. açıklamada o satır kendiliğinden ham hale geçer,
 * bir anahtar değişir, başlık alanı odaklanıp klavye açılır).
 *
 * Çözüm: son dokunmanın (touch/pen) zamanı ve konumu kaydedilir; bir pencere hemen ardından açılırsa, o noktadaki sahte fare olayları kısa
 * süre yutulur. Gerçek fare tıklamaları ve başka bir noktaya yapılan dokunmalar etkilenmez.
 */
const WINDOW_MS = 700; // dokunma ile pencere açılışı arasındaki en çok süre ve yutma penceresi
const RADIUS = 14; // sahte olay, dokunma noktasına bu kadar piksel yakınsa hayalet sayılır
const TYPES = ['mousedown', 'mouseup', 'click', 'dblclick'];

let lastTouch = null;

/** Son dokunuşu kaydeder (pencere yüklendiğinde bir kez bağlanır; capture: uygulamanın pointerup işleyicilerinden önce çalışsın). */
export function trackTouches(target = window) {
  target.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') lastTouch = { t: performance.now(), x: e.clientX, y: e.clientY };
    },
    true,
  );
}

/**
 * Bir pencere (modal) açıldıktan hemen sonra çağrılır; açılış az önceki bir dokunuştan kaynaklandıysa o noktadaki sahte fare olaylarını yutar.
 * @returns {boolean} koruma devreye girdi mi
 */
export function swallowGhostClicks(now = performance.now()) {
  if (!lastTouch || now - lastTouch.t > WINDOW_MS) return false;
  const touch = lastTouch;
  const stop = (e) => {
    if (performance.now() - touch.t > WINDOW_MS) {
      off();
      return;
    }
    if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) <= RADIUS) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  const off = () => TYPES.forEach((t) => window.removeEventListener(t, stop, true));
  TYPES.forEach((t) => window.addEventListener(t, stop, true));
  setTimeout(off, WINDOW_MS + 50);
  return true;
}

if (typeof window !== 'undefined') trackTouches();
