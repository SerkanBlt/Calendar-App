# Değişiklik Günlüğü

Sürüm numaraları [semver](https://semver.org/lang/tr/) kuralına göre verilir:
**MAJOR** uyumsuz değişiklik · **MINOR** yeni özellik · **PATCH** hata düzeltmesi.
Uygulamadaki sürüm, kenar çubuğunda Ayarlar düğmesinin sağında ve Ayarlar → Hakkında'da görünür.

## 1.14.0
- **Mobil/tablet (≤900px) başlık**: Geri / Bugün / İleri bloğu sola dayalı ve her zaman en başta; eylem satırı (Gantt'ta S-M-L ve Kritik yol dahil) sola dayalı
- **Bugün düğmesi** artık "Bugün: 15.Kas" gibi bugünün tarihini gösterir (tüm ekran boyutlarında)
- **Yeni etkinlik düğmesi**: mobil/tablette başlıktaki "+" yerine sağ altta yüzen, yuvarlak ve daha büyük (56 px) bir düğme; bildirimler bunun üstünde çıkar,
  içerik son satırlarını kapatmasın diye sayfanın altına boşluk eklendi. Masaüstünde başlıktaki "Yeni" düğmesi aynen duruyor
- **Etkinlik formu**: "Tüm gün" açılınca bitiş tarihi başlangıçla aynı olur; açıklama alanının köşesindeki düğmeyle açıklama **tam ekranda** düzenlenir
  (Esc yalnızca tam ekranı kapatır); renk seçiminde 8 hazır renge ek olarak **paletten özel renk** seçilebilir
- **Ara paneli**: sonuçlar arasında küçük boşluk
- **Hızlı komut paneli**: Kanban'dan sonraki komutlar açılıp kapanabilen gruplarda toplandı (Veri, Tema, Arka plan). Başlığa tıklayın/Enter ya da →/← ile açıp kapatın;
  arama yazınca gruplar yok sayılır ve eşleşenler düz listelenir
- **Kanban**: kolonları **yan yana** veya **alt alta** göstermek için düzen seçimi (seçim kaydedilir; alt alta düzende her durum tam genişlikte bir bant olur ve kartlar bantta ızgara halinde dizilir)
- Test: `dayMonthShort`, `normalizeHexColor` ve palet satır üretimi (`buildRows`) için birim testleri

## 1.13.0
- **Yeni sürüm bildirimi**: yeni bir sürüm yüklendiğinde "Yeni sürüm hazır (vX)" mesajı ve **Yenile** düğmesi çıkar; × ile kapatılabilir.
  Sayfa kendiliğinden yenilenmez (açık formlar kaybolmasın). Sayfa zaten en yeni sürümle açıldıysa ve ilk kurulumda mesaj gösterilmez
- Arka plandan dönen veya uzun süre açık kalan uygulama (ör. telefonda PWA) güncellemeyi kaçırmasın diye sayfa görünür olunca ve saatte bir sürüm denetlenir
- Not: bu bildirim 1.13.0 ve sonrası için çalışır; eski sürümü açık tutan cihazlar bu güncellemeye bir kez elle geçer (uygulamayı kapatıp açın)
- Bildirimler kalıcı (`duration: 0`) ve kapatılabilir (`dismissible`) olabilir
- Test: service worker VERSION'ının package.json sürümüyle aynı olduğunu denetleyen test (`npm test`)

## 1.12.0
- **Tüm verileri sıfırlama** — Ayarlar → Veri → "Tüm verileri sıfırla" ve `Ctrl + K` → "Reset All Data…"
- Onay penceresi sorar: **Yedek al ve sıfırla** (varsayılan; önce JSON yedeği indirir, yedek alınamazsa hiçbir şey silinmez),
  **Yedeksiz sıfırla** veya Vazgeç
- Silinenler: etkinlikler, ekler, hatırlatma kayıtları, kendi arka plan görselleri ve tüm ayarlar (tema, çalışma günleri vb. varsayılana döner).
  Silme tek işlemde yapılır; yarıda kalmaz. Sıfırlanan uygulama boş açılır, örnek veriler geri yüklenmez

## 1.11.1
- Mobilde görünüm başlığı (Ay, Hafta, Gün… üstündeki panel) dört köşesi yuvarlak, çerçeveli bir panel oldu; içeriğine her yönden 12 px dolgu uygulanır ve altındaki takvim kartıyla aynı genişliktedir. Masaüstü görünümü değişmedi

## 1.11.0
- **ICS (.ics) dışa/içe aktarma** — Ayarlar → Veri sekmesi ve `Ctrl + K` → "Export/Import Calendar (ICS)"; Outlook, Gmail ve diğer takvim uygulamalarıyla uyumlu
- Dışa aktarma: tek ve tekrarlayan etkinlikler (RRULE/EXDATE), seriden ayrılmış tek örnekler (RECURRENCE-ID), hatırlatmalar (VALARM);
  durum, ilerleme, renk, kritik ve Gantt bağımlılıkları uygulamaya özel alanlarla korunur (diğer uygulamalar yok sayar)
- İçe aktarma: saat dilimleri (UTC, IANA ve Outlook'un Windows adları) yerel saate çevrilir; aynı etkinlik yeniden içe aktarılınca çoğalmaz, güncellenir;
  bildirimdeki "Geri al" yeni kayıtları siler, değişenleri eski haline getirir
- Desteklenmeyen tekrar kuralları (ör. haftanın birden çok günü, "ayın 2. salısı") yalnızca ilk örnek olarak eklenir ve bildirilir
- Yabancı dosyalardan gelen geçmiş etkinlikler "Tamamlandı" olarak eklenir (Dashboard'daki geciken sayacını şişirmemek için)
- Not: tek seferlik aktarımdır, iki yönlü senkron değildir
- Geliştirme: `npm test` — Node'un yerleşik test koşucusuyla ICS testleri (ek bağımlılık yok)

## 1.10.1
- Düzeltme: mobilde yatay konumda Ay görünümü aşağı kaydırılamıyordu (ızgara sıkışıp alt haftalar kesiliyordu)
- Düzeltme: kaydırınca içerik başlık çubuğunun arkasından görünüyordu; başlık artık buzlu cam zeminli
- Ay görünümünde hücreye sığmayan içerik komşu hücreye taşmaz
- Mobilde başlıktaki düğmeler masaüstündeki gibi sağa dayalı
- Ayarlar paneli sabit boyutlu (sekme değişince büyüyüp küçülmez); telefonda (dikey ve yatay) tam ekran

## 1.10.0
- Kenar çubuğunda "Yeni etkinlik" yerine **Hızlı komut** (Ctrl+K) düğmesi
- **Ara** düğmesi yeni etkinlik arama panelini açar (`/` kısayolu): başlık/açıklama/kategoride arama,
  eşleşmeleri vurgulama, zaman ve durum filtreleri, sonuca tıklayınca o güne gidip etkinliği açma
- Ay, Hafta ve Gün düğmeleri yeniden alt alta
- Kenar çubuğu düğmelerinin alt/üst boşlukları azaltıldı
- Daraltılmış kenar çubuğu daha dar (76 → 64 px); düğme boyutu aynı

## 1.9.0
- Kenar çubuğu açıkken Ay, Hafta ve Gün düğmeleri yan yana
- Ayarlar düğmesinin sağında sürüm numarası
- Ayarlar paneli sekmelere ayrıldı: Görünüm, Takvim, Genel, Veri, Hakkında
- Komut paleti: Esc her yerde çalışır; sağ üstte kapatma (×) düğmesi

## 1.8.0
- Çalışma günleri (varsayılan Pzt–Cum) ve Ay/Hafta görünümünde çalışma dışı günleri gizleme; başlıkta aç/kapat düğmesi
- Düzeltme: saatli etkinlik başka güne sürüklenince takılıp kaydedilmiyordu
- Sürüklerken kenarda otomatik kaydırma; Tüm gün satırı ↔ saat ızgarası arasında taşıma
- Mobil: etkinliklerin üzerinden dokunarak kaydırma; basılı tutarak sürükleme

## 1.7.0
- Kenar çubuğunun altında sabit Ayarlar düğmesi ve Ayarlar paneli
- Yeni etkinlik ve Ara düğmeleri diğer düğmelerle aynı boyutta; gizli kaydırma çubuğu

## 1.6.0
- Logoya tıklayınca kenar çubuğu ikon moduna daralır (`[` kısayolu)

## 1.5.0
- Kullanıcının kendi arka plan görselini eklemesi (otomatik küçültme, silme / geri alma)

## 1.4.0
- Arka plan yerleşimi: Doldur, Sığdır, Uzat, Döşe, Ortala

## 1.3.0
- Seçilebilir arka planlar (Standart, Deri)

## 1.2.0
- Özel temalar: Sonbahar, Gün Batımı, Okyanus, Misket Limonu, Grafit, Kızıl Çelik, Dağ Yolu

## 1.1.0
- GitHub Pages yayını (alt klasörde çalışma, otomatik dağıtım)

## 1.0.0
- İlk sürüm: Dashboard, Ay, Hafta, Gün, Scheduler, Timeline, Gantt, Kanban; IndexedDB, hatırlatmalar,
  JSON dışa/içe aktarma, komut paleti, temalar, PWA; tekrarlayan etkinliklerde tek örnek düzenleme
