/**
 * touchHold.js — Dokunmatik ekranda "basılı tut, sonra sürükle".
 *
 * Telefonda/tablette parmakla bir etkinliğin üzerinden kaydırmak sayfayı kaydırmalıdır; sürükleme ise
 * kısa bir basılı tutmayla başlar. Böylece etkinliklerle dolu görünümler (Ay, Kanban, Gantt…)
 * dokunarak kaydırılabilir.
 *
 *   const result = await waitForHold(pointerDownEvent);   // 'hold' | 'tap' | 'move'
 *   if (result === 'hold') { const unlock = lockTouchScroll(); ...sürükle...; unlock(); }
 *
 *  - 'hold': parmak HOLD_MS boyunca yerinde kaldı → sürükleme başlayabilir
 *  - 'tap' : süre dolmadan kaldırıldı → normal dokunma (ör. düzenleyiciyi aç)
 *  - 'move': süre dolmadan kaydırıldı / tarayıcı kaydırmayı devraldı → hiçbir şey yapma
 */

const HOLD_MS = 350;
const TOLERANCE = 8; // px

export const isTouch = (e) => e.pointerType === 'touch';

export function waitForHold(e, { delay = HOLD_MS, tolerance = TOLERANCE } = {}) {
  return new Promise((resolve) => {
    const { clientX: sx, clientY: sy, pointerId } = e;
    let timer = null;
    const done = (result) => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      resolve(result);
    };
    const onMove = (ev) => {
      if (ev.pointerId === pointerId && Math.hypot(ev.clientX - sx, ev.clientY - sy) > tolerance) done('move');
    };
    const onUp = (ev) => {
      if (ev.pointerId === pointerId) done('tap');
    };
    const onCancel = (ev) => {
      if (ev.pointerId === pointerId) done('move');
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    timer = setTimeout(() => {
      navigator.vibrate?.(12); // destekleyen cihazlarda kısa titreşimle geri bildirim
      done('hold');
    }, delay);
  });
}

/** Sürükleme süresince sayfanın dokunarak kaydırılmasını engeller. Kilidi açan fonksiyonu döner. */
export function lockTouchScroll() {
  const prevent = (ev) => ev.preventDefault();
  document.addEventListener('touchmove', prevent, { passive: false });
  document.documentElement.classList.add('is-touch-dragging');
  return () => {
    document.removeEventListener('touchmove', prevent);
    document.documentElement.classList.remove('is-touch-dragging');
  };
}
