/**
 * drawerTab.js — Sol kenardaki "çekme kulakçığı" (mobil kabuk: dar ekran ya da yatay telefon).
 *
 * Başlıktaki hamburger düğmesinin yerini alır: ekranın sol kenarında, dar (≈14 px) ve parmak boyunda (≈52 px) bir tutamaktır.
 *  - Dokunma / tıklama / Enter: kenar çubuğunu (çekmece) açar.
 *  - Sağa çekme: çekmece parmağı izler (arkada perde belirir); bırakınca yeterince açıksa (%35) tamamen açılır, değilse geri kapanır.
 *    Çekmecenin konumu satır içi `transform` ile verilir; bırakınca satır içi stil temizlenir ve CSS geçişi (240 ms) kalan yolu animasyonla tamamlar.
 * Not: Android'in "geri" hareketi ekranın en kenarından içeri kaydırmadır; işletim sistemi bu hareketi uygulamadan önce alabilir. Bu yüzden
 * dokunma her zaman açar, çekme ise işletim sisteminin izin verdiği yerde çalışır.
 */
const THRESHOLD = 0.35; // çekmecenin bu kadarı açıldıysa bırakınca tamamlanır
const START_PX = 8; // bu kadar kaymadan çekme başlamaz (dokunma ile ayrılsın)
const GAP = 16; // CSS'teki kapalı konum: translateX(calc(-100% - 16px))

/**
 * @param {HTMLElement} tab kulakçık düğmesi
 * @param {{app: HTMLElement, sidebar: HTMLElement, open: () => void}} options app: `sidebar-pulling` sınıfı ve `--pull` değişkeni buna yazılır
 */
export function setupDrawerTab(tab, { app, sidebar, open }) {
  let drag = null;
  let suppressClick = false;

  const closedX = () => -(sidebar.offsetWidth + GAP);
  const finish = () => {
    app.classList.remove('sidebar-pulling');
    app.style.removeProperty('--pull');
    sidebar.style.removeProperty('transform');
  };

  tab.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pulling: false, dead: false, progress: 0 };
    try {
      tab.setPointerCapture(e.pointerId); // parmak kulakçıktan çıksa da hareketler buraya gelsin
    } catch {
      /* pointer artık etkin değil */
    }
  });

  tab.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || drag.dead) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.pulling) {
      if (Math.abs(dx) < START_PX && Math.abs(dy) < START_PX) return;
      if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) {
        drag.dead = true; // sola ya da dikey kayma: çekme değil
        return;
      }
      drag.pulling = true;
      app.classList.add('sidebar-pulling');
    }
    e.preventDefault();
    const w = sidebar.offsetWidth + GAP;
    const x = Math.min(0, Math.max(closedX(), closedX() + dx));
    drag.progress = (x - closedX()) / w;
    sidebar.style.transform = `translateX(${x}px)`;
    app.style.setProperty('--pull', String(drag.progress));
  });

  const end = (e, cancelled) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { pulling, progress } = drag;
    drag = null;
    if (!pulling) return; // dokunma: click olayı açar
    suppressClick = true; // çekmeden sonra gelen click ikinci kez açmasın / geri kapanan çekmeyi açmasın
    setTimeout(() => {
      suppressClick = false;
    }, 400);
    const shouldOpen = !cancelled && progress >= THRESHOLD;
    finish(); // satır içi stil kalkar: CSS geçişi çekmeceyi kalan yoldan açar ya da geri kapatır
    if (shouldOpen) open();
  };
  tab.addEventListener('pointerup', (e) => end(e, false));
  tab.addEventListener('pointercancel', (e) => end(e, true));

  tab.addEventListener('click', (e) => {
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      return;
    }
    open();
  });
}
