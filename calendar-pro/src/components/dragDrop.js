/**
 * dragDrop.js — Pointer Events tabanlı sürükle-bırak (fare + dokunmatik).
 *
 * HTML5 DnD API'si dokunmatik cihazlarda çalışmadığı için kendi uygulamamızı kullanıyoruz.
 * Öğe 5px'ten fazla sürüklenince imleci takip eden bir "hayalet" kopya oluşturulur;
 * altındaki bırakma bölgesi vurgulanır. Sürükleme olmadan bırakılırsa onClick çağrılır.
 *
 * @param {HTMLElement} root
 * @param {{itemSelector: string, zoneSelector: string, onDrop: (item: HTMLElement, zone: HTMLElement) => void,
 *          onClick?: (item: HTMLElement) => void}} options
 * @returns {Function} temizleme fonksiyonu
 */
export function enableDragDrop(root, { itemSelector, zoneSelector, onDrop, onClick }) {
  let s = null;

  function onPointerDown(e) {
    if (e.button !== 0 || e.target.closest('[data-no-drag]')) return;
    const item = e.target.closest(itemSelector);
    if (!item || !root.contains(item)) return;
    const rect = item.getBoundingClientRect();
    s = { item, pointerId: e.pointerId, x: e.clientX, y: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, dragging: false, ghost: null, zone: null };
    item.setPointerCapture?.(e.pointerId);
    item.addEventListener('pointermove', onPointerMove);
    item.addEventListener('pointerup', onPointerUp);
    item.addEventListener('pointercancel', onPointerCancel);
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
  }

  function onPointerMove(e) {
    if (!s) return;
    if (!s.dragging) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) return;
      beginDrag();
    }
    s.ghost.style.transform = `translate(${e.clientX - s.dx}px, ${e.clientY - s.dy}px)`;
    const zone = document.elementFromPoint(e.clientX, e.clientY)?.closest(zoneSelector) || null;
    const valid = zone && root.contains(zone) ? zone : null;
    if (valid !== s.zone) {
      s.zone?.classList.remove('is-drop-target');
      valid?.classList.add('is-drop-target');
      s.zone = valid;
    }
  }

  function cleanup() {
    if (!s) return;
    s.item.removeEventListener('pointermove', onPointerMove);
    s.item.removeEventListener('pointerup', onPointerUp);
    s.item.removeEventListener('pointercancel', onPointerCancel);
    s.ghost?.remove();
    s.zone?.classList.remove('is-drop-target');
    s.item.classList.remove('is-drag-source');
    root.classList.remove('is-dnd-active');
  }

  function onPointerUp() {
    if (!s) return;
    const { item, dragging, zone } = s;
    cleanup();
    s = null;
    if (dragging && zone) onDrop(item, zone);
    else if (!dragging) onClick?.(item);
  }

  function onPointerCancel() {
    cleanup();
    s = null;
  }

  function onKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest(itemSelector);
    if (item && root.contains(item) && e.target === item) {
      e.preventDefault();
      onClick?.(item);
    }
  }

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('keydown', onKeyDown);
  return () => {
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('keydown', onKeyDown);
    cleanup();
  };
}
