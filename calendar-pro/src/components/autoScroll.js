/**
 * autoScroll.js — Sürükleme sırasında kenara yaklaşınca otomatik kaydırma.
 *
 * Kullanım:
 *   const scroller = createAutoScroller({ container, onScroll });
 *   scroller.update(clientX, clientY);   // her pointermove'da
 *   scroller.stop();                      // bırakınca
 *
 * `container` verilirse yalnızca o öğe kaydırılır (imleç öğenin dışına çıksa da). Verilmezse imlecin
 * altındaki en yakın kaydırılabilir üst öğe bulunur. Kaydırma hızı kenara yaklaştıkça artar.
 * `onScroll(x, y)` kaydırma olduğunda çağrılır; böylece sürüklenen öğenin konumu yeniden hesaplanır.
 */

const EDGE = 56; // px — bu mesafeden yakınsa kaydır
const MAX_SPEED = 20; // px / kare
const GUTTER = 24; // px — pencere kenarındaki kaydırılamayan sayfa boşluğu (--page-pad) için içeri kayma payı

const isScrollable = (el, axis) => {
  const style = getComputedStyle(el);
  const overflow = axis === 'y' ? style.overflowY : style.overflowX;
  if (!/(auto|scroll)/.test(overflow)) return false;
  return axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
};

function speedFor(distanceIntoEdge) {
  return Math.min(MAX_SPEED, Math.max(2, Math.round((distanceIntoEdge / EDGE) * MAX_SPEED)));
}

/** Bir öğeyi imlecin konumuna göre kaydırır; kaydırdıysa true döner. */
function scrollElement(el, x, y, axes) {
  const r = el.getBoundingClientRect();
  let moved = false;
  if (axes.includes('y')) {
    let dy = 0;
    if (y < r.top + EDGE) dy = -speedFor(r.top + EDGE - y);
    else if (y > r.bottom - EDGE) dy = speedFor(y - (r.bottom - EDGE));
    if (dy) {
      const before = el.scrollTop;
      el.scrollTop += dy;
      moved = moved || el.scrollTop !== before;
    }
  }
  if (axes.includes('x')) {
    let dx = 0;
    if (x < r.left + EDGE) dx = -speedFor(r.left + EDGE - x);
    else if (x > r.right - EDGE) dx = speedFor(x - (r.right - EDGE));
    if (dx) {
      const before = el.scrollLeft;
      el.scrollLeft += dx;
      moved = moved || el.scrollLeft !== before;
    }
  }
  return moved;
}

/** (hx, hy) noktasının altındaki en yakın kaydırılabilir üst öğeyi (önce dikey, sonra yatay) bulup imlecin (x, y) konumuna göre kaydırır. */
function scrollUnder(hx, hy, x, y, axes) {
  let moved = false;
  for (let el = document.elementFromPoint(hx, hy); el && el !== document.body && !moved; el = el.parentElement) {
    const ax = [...axes].filter((a) => isScrollable(el, a)).join('');
    if (ax) moved = scrollElement(el, x, y, ax);
  }
  return moved;
}

/**
 * @param {{container?: HTMLElement, axes?: string, onScroll?: (x: number, y: number) => void}} [options]
 *   axes: 'y', 'x' veya 'xy' (varsayılan 'xy')
 */
export function createAutoScroller({ container, axes = 'xy', onScroll } = {}) {
  let x = 0;
  let y = 0;
  let raf = null;
  let running = false;

  function tick() {
    raf = null;
    if (!running) return;
    let moved = false;
    if (container) {
      moved = scrollElement(container, x, y, axes);
    } else {
      moved = scrollUnder(x, y, x, y, axes);
      // İmleç pencere kenarındaki sayfa boşluğundaysa (kaydırılamayan dış kenar), kaydırılabilir öğeyi biraz içeriden ara: kenara yapışık sürükleme de kaydırır
      if (!moved) {
        const px = Math.min(Math.max(x, GUTTER), window.innerWidth - GUTTER);
        const py = Math.min(Math.max(y, GUTTER), window.innerHeight - GUTTER);
        if (px !== x || py !== y) moved = scrollUnder(px, py, x, y, axes);
      }
    }
    if (moved) onScroll?.(x, y);
    raf = requestAnimationFrame(tick);
  }

  return {
    update(nx, ny) {
      x = nx;
      y = ny;
      running = true;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
  };
}
