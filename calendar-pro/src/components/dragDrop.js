/**
 * dragDrop.js — Pointer Events tabanlı sürükle-bırak (fare + dokunmatik).
 *
 * HTML5 DnD API'si dokunmatik cihazlarda çalışmadığı için kendi uygulamamızı kullanıyoruz.
 *  - Fare: öğe 5px'ten fazla sürüklenince imleci takip eden bir "hayalet" kopya oluşur.
 *  - Dokunmatik: kısa basılı tutunca sürükleme başlar; parmakla kaydırmak sayfayı kaydırır.
 * Altındaki bırakma bölgesi vurgulanır; kenara yaklaşınca kaydırılabilir alan otomatik kayar.
 * Sürükleme olmadan bırakılırsa (veya dokunulursa) onClick çağrılır.
 * Olaylar window üzerinden dinlenir; böylece imleç öğeden/bölgeden çıksa da sürükleme kopmaz.
 *
 * @param {HTMLElement} root
 * @param {{itemSelector: string, zoneSelector: string,
 *          onDrop: (item: HTMLElement, zone: HTMLElement, point: {x: number, y: number}) => void,
 *          onClick?: (item: HTMLElement) => void}} options
 * @returns {Function} temizleme fonksiyonu
 */
import { createAutoScroller } from './autoScroll.js';
import { isTouch, lockTouchScroll, waitForHold } from './touchHold.js';

const DRAG_THRESHOLD = 5;

export function enableDragDrop(root, { itemSelector, zoneSelector, onDrop, onClick }) {
  let s = null;

  function findZone(x, y) {
    const zone = document.elementFromPoint(x, y)?.closest(zoneSelector) || null;
    return zone && root.contains(zone) ? zone : null;
  }

  function setZone(zone) {
    if (zone === s.zone) return;
    s.zone?.classList.remove('is-drop-target');
    zone?.classList.add('is-drop-target');
    s.zone = zone;
  }

  function beginDrag() {
    s.dragging = true;
    const rect = s.item.getBoundingClientRect();
    const ghost = s.item.cloneNode(true);
    ghost.classList.add('dnd-ghost');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    s.ghost = ghost;
    s.item.classList.add('is-drag-source');
    root.classList.add('is-dnd-active');
    moveGhost(s.x, s.y);
  }

  function moveGhost(x, y) {
    s.ghost.style.transform = `translate(${x - s.dx}px, ${y - s.dy}px)`;
  }

  function onMove(e) {
    if (!s || e.pointerId !== s.pointerId) return;
    if (!s.dragging) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < DRAG_THRESHOLD) return;
      beginDrag();
    }
    s.last = { x: e.clientX, y: e.clientY };
    moveGhost(e.clientX, e.clientY);
    setZone(findZone(e.clientX, e.clientY));
    s.autoScroll.update(e.clientX, e.clientY);
  }

  function cleanup() {
    if (!s) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    s.autoScroll.stop();
    s.unlock?.();
    s.ghost?.remove();
    s.zone?.classList.remove('is-drop-target');
    s.item.classList.remove('is-drag-source');
    root.classList.remove('is-dnd-active');
  }

  function onUp(e) {
    if (!s || e.pointerId !== s.pointerId) return;
    const { item, dragging, zone, last } = s;
    cleanup();
    s = null;
    if (dragging && zone) onDrop(item, zone, last);
    else if (!dragging) onClick?.(item);
  }

  function onCancel(e) {
    if (!s || e.pointerId !== s.pointerId) return;
    cleanup();
    s = null;
  }

  function start(item, e, { unlock = null, armed = false } = {}) {
    const rect = item.getBoundingClientRect();
    s = {
      item,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      last: { x: e.clientX, y: e.clientY },
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      dragging: false,
      ghost: null,
      zone: null,
      unlock,
      autoScroll: createAutoScroller({
        onScroll: (x, y) => s && s.dragging && setZone(findZone(x, y)),
      }),
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    if (armed) beginDrag(); // dokunmatikte basılı tutunca sürükleme hemen başlar
  }

  async function onPointerDown(e) {
    if (e.button !== 0 || s || e.target.closest('[data-no-drag]')) return;
    const item = e.target.closest(itemSelector);
    if (!item || !root.contains(item)) return;

    if (isTouch(e)) {
      const result = await waitForHold(e);
      if (result === 'tap') onClick?.(item);
      if (result !== 'hold') return; // 'move' → kullanıcı sayfayı kaydırıyor
      start(item, e, { unlock: lockTouchScroll(), armed: true });
      return;
    }
    start(item, e);
  }

  function onKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest(itemSelector);
    if (item && root.contains(item) && e.target === item) {
      e.preventDefault();
      onClick?.(item);
    }
  }

  // Dokunmatikte uzun basınca açılan sistem menüsünü engelle
  const onContextMenu = (e) => {
    if (e.target.closest(itemSelector)) e.preventDefault();
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('contextmenu', onContextMenu);
  return () => {
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('contextmenu', onContextMenu);
    cleanup();
    s = null;
  };
}
