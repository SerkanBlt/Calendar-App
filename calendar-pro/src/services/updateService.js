/**
 * updateService.js — Service worker kaydı ve "yeni sürüm hazır" algılama.
 *
 * Service worker `skipWaiting` + `clients.claim` kullandığı için yeni sürüm yüklenir yüklenmez denetimi devralır
 * (`controllerchange`). Açık sayfa ise eski kodla çalışmaya devam eder; bu yüzden denetimi devralan worker'a
 * sürümü sorulur ve sayfanın sürümünden (APP_VERSION) farklıysa `onUpdate` çağrılır — arayüz "Yenile" bildirimini gösterir.
 *  - Sayfa zaten en yeni kodla açıldıysa (sayfa istekleri ağ öncelikli) bildirim gösterilmez.
 *  - İlk kurulumda (öncesinde denetleyen worker yok) bildirim gösterilmez.
 *  - Sürüm yanıtı gelmezse (zaman aşımı) bildirim yine gösterilir; fazladan bir "Yenile" zararsızdır.
 * Açık kalan oturumlar (ör. telefonda arka plandan dönen PWA) güncellemeyi kaçırmasın diye sayfa görünür olunca
 * ve saatte bir `registration.update()` çağrılır.
 *
 * Önemli: public/service-worker.js içindeki VERSION, package.json sürümüyle aynı olmalıdır (bkz. tests/version.test.js);
 * karşılaştırma bu eşitliğe dayanır.
 */
import { APP_VERSION } from '../core/version.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const REPLY_TIMEOUT_MS = 3000;

/** Worker'a sürümünü sorar ("v" öneki atılır); yanıt gelmezse null. */
function askVersion(worker) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), REPLY_TIMEOUT_MS);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(typeof e.data?.version === 'string' ? e.data.version.replace(/^v/, '') : null);
    };
    worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

/**
 * Service worker'ı kaydeder ve yeni sürümü izler (yalnızca production build'de; geliştirmede HMR ile çakışmaması için).
 * @param {{onUpdate: (info: {version: string|null}) => void}} handlers
 */
export function registerServiceWorker({ onUpdate }) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let controlled = Boolean(sw.controller);
  const announced = new Set(); // aynı sürüm için bildirim bir kez gösterilir

  sw.addEventListener('controllerchange', async () => {
    if (!controlled) {
      controlled = true; // ilk kurulum: clients.claim() ilk kez denetimi alıyor, güncelleme değil
      return;
    }
    if (!sw.controller) return;
    const version = await askVersion(sw.controller);
    if (version === APP_VERSION || announced.has(version)) return;
    announced.add(version);
    onUpdate({ version });
  });

  sw.register(`${import.meta.env.BASE_URL}service-worker.js`)
    .then((registration) => {
      const check = () => registration.update().catch(() => {}); // çevrimdışıyken sessizce geç
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, CHECK_INTERVAL_MS);
    })
    .catch((err) => {
      console.warn('Service worker kaydedilemedi:', err);
    });
}
