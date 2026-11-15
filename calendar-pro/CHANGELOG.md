# Değişiklik Günlüğü

Sürüm numaraları [semver](https://semver.org/lang/tr/) kuralına göre verilir:
**MAJOR** uyumsuz değişiklik · **MINOR** yeni özellik · **PATCH** hata düzeltmesi.
Uygulamadaki sürüm, kenar çubuğunda Ayarlar düğmesinin sağında ve Ayarlar → Hakkında'da görünür.

## 1.21.1
- **Yatay telefon düzeni düzeltildi**: telefon yan çevrilince genişlik 900 px'i aşıyor (~950×375) ve **masaüstü düzeni** devreye giriyordu: sabit kenar çubuğu (272 px, öğeleri kesiliyor) ve 127 px'lik başlık,
  içeriğe yalnızca ~225 px yükseklik bırakıyordu. Mobil kabuk (kenar çubuğu çekmece + hamburger + yüzen düğme) artık genişliğe **veya** kısa yüksekliğe (≤500 px) bağlı
- Kısa ekranda **kompakt başlık**: hamburger + sayfa adı + eylemler tek satırda, 127/119 → **50 px** (8 sayfada aynı; altyazı gizli). Dar ekranda (≈≤670 px) çok düğmeli sayfalar gerekirse alt satıra sarar
- Kısa ekranda Ay satırları 96 → 60 px, gün başlığı sıkılaştı (görünür hafta satırı ~2 → ~4,5)
- Dikey telefon, tablet ve masaüstü düzenleri değişmedi (ölçülerek doğrulandı); yatayda çekmece, ileri/geri, yüzen düğme (alta 16 px) ve etkinlik penceresi test edildi
- Not: yatay modda etkinlik penceresinin üst/alt çubukları hâlâ ~110 px yer kaplıyor; istenirse onlar da sıkılaştırılabilir

## 1.21.0
- **Açıklamada satırlar arası seçim**: seçim tutamağı artık alt satırlara kaydırılabilir. Açıklama editörü, her satırı ayrı bir metin kutusu yapan yapıdan **tek parça bir metin düzenleyicisine
  (CodeMirror 6)** taşındı. Sonuç: fareyle/parmakla/`Shift`+oklarla **satırlar arası seçim**, yerel seçim tutamakları, `Ctrl+A`, mobil klavye (IME), kopyala-yapıştır ve **geri al / yinele satırlar arası da** çalışır
  (önceki yapıda geri al satır başınaydı). Çok satırlı seçime araç çubuğu da uygulanır (birden çok satırı tek seferde listeye çevirme)
- **Canlı önizleme korundu**: imlecin/seçimin değdiği satırlar ham, diğerleri işlenmiş (başlık, `•`, görev kutusu, kalın/italik/çizili/kod, bağlantı, alıntı, çizgi, kod bloğu); odaksızken (ilk açılış, tam ekran)
  hiçbir satır ham değil. Önizleme yalnızca görünümdür, metin hep ham Markdown. Dokunmatik cihazlarda seçim sürerken satırların durumu dondurulur (tutamak sürüklenirken DOM değişmesin)
- Görev kutusu: tıklayınca `[ ]` ↔ `[x]`, satırın (çok satırlıysa tamamının) dikeyde ortasında, tamamlanan görev üstü çizili. Enter liste/alıntı devamı ve boş öğede liste bitirme aynen çalışır
- `Esc` (pencereyi kapat) ve `Ctrl/⌘+Enter` (formu kaydet) editör tarafından yutulmaz; yükseklik tutamağı ve tam ekran editör korundu
- **Bağımlılık ve boyut**: CodeMirror 6 (`state`, `view`, `commands`, `language`) ve `@lezer/markdown` eklendi (artık "çalışma zamanı bağımlılığı yok" değil). JS paketi ≈57 → ≈157 KB gzip.
  Yalnızca Markdown ayrıştırıcısı alınarak (HTML/CSS/JS dil paketleri olmadan) ≈174 KB yerine ≈100 KB'a indirildi
- Güvenlik: metin HTML olarak yorumlanmaz (gerçek tarayıcıda `<script>`, `<img onerror>`, `<b onmouseover>` yazılarak sınandı); bağlantılar yalnızca `http(s)`/`mailto` açılır (`javascript:` açılmaz)
- Kaldırıldı: satır-textarea mimarisi (`renderLineRows` ve testleri, `.md-row/.md-view/.md-edit` stilleri)
- Test: canlı önizleme planı için 22 birim testi (`planLive`, `safeHref`; XSS ve patolojik girdiler dahil) ve gerçek tarayıcı E2E (satırlar arası fare/klavye seçimi, geri al/yinele, görev kutusu, bağlantılar, Ctrl+Enter, Esc, tam ekran, dokunma)
- Sınırlama: Android'in kendi damla seçim tutamakları tarayıcı arayüzüdür ve otomasyonla sürülemez; tutamak sürüklenirken görünüm dondurma önlemi emülasyonda doğrulandı, gerçek telefonda denenmedi

## 1.20.0
- **Yüzen "+" düğmesi**: dokunurken/tıklarken renk değişmez. Neden: basılınca opaklık %82'den %100'e sıçrıyor ve alttaki renkli parıltı (gölge) değişiyordu. Artık basınca yalnızca küçülür,
  taşırken yalnızca büyür; gölge yok, tarayıcının dokunma vurgusu kapalı. (Düz gradyan noktalarında basılı/boşta renk farkı ≤ 0.9, önceden ortalama 15)
- **Hiçbir panelde gölge yok**: `--shadow`, `--shadow-sm`, `--shadow-lg` tüm temalarda `none` (cam paneller, kartlar, pencereler, komut paleti, kenar çubuğu, menüler, bildirimler).
  1.19.1'deki ekran kenarı şeridi geçici çözümü (`.view` içinde dar gölge, kapalı kenar çubuğunda gölge yok) gereksiz kaldığı için kaldırıldı. Kanban kolon durum şeridi (iç çizgi) kalır
- **Sayfa altı boşlukları kapandı**: mobilde FAB için ayrılan 80 px alt boşluk kalktı; Ay/Hafta/Planlayıcı/Gantt paneli alta kadar uzar (alt boşluk 88 → 16 px; kalanı dış kenar boşluğu).
  Kaydırmalı sayfalarda içerik FAB'ın altında kalmasın diye boşluk son panelin içine verildi
- **Açıklama alanı yeniden büyütülebilir**: kutunun sağ alt köşesinde tutamak (fare, dokunma, `↑` `↓`); en az 96 px, çift tıklama otomatik yükseklik; sabitlenince uzun metin kutu içinde kayar. Tam ekranda yok
- Düzeltme (iç): tutamak için yüzey bir kap içine alındığında tam ekran düzenleyicinin yüksekliği çökmüştü (54 px); kap yeniden doldurur hale getirildi
- Test: FAB basılı/boşta piksel farkı, tüm sayfalarda kalan gölge taraması (4 tema, masaüstü + mobil), sayfa altı boşluk ölçümü, tutamak (fare/klavye/gerçek dokunma)

## 1.19.1
- **Ekran kenarındaki panel şeridi kaldırıldı**: kaydırılan ana panelin (`.view`) kenarında, ekranın sol/sağ boşluğunda keskin kenarlı koyu bir şerit görünüyordu. Neden: sayfa içindeki
  kartların/ızgaraların büyük gölgesi (30 px) panelin 8 px'lik iç boşluğunu aşıp panel sınırında kesiliyordu; mobilde ayrıca **kapalı kenar çubuğunun** gölgesi ekranın sol kenarına taşıyordu.
  Düzeltme: sayfa içinde gölge dar (`--shadow-sm`), kapalı kenar çubuğunda gölge yok (açıkken var). Piksel ölçümü: Dashboard'da kenar basamağı 10.4 → 0.9, diğer sayfalarda ton farkı 4.4 → 0
- **1.19.0'daki "en alttaki panel görünmez" değişikliği geri alındı**: o değişiklik yanlış anlaşılan bir isteğe dayanıyordu (kolonlar/ızgaralar değil, kenar şeridi kastedilmişti). Kanban kolonları,
  Ay/Hafta/Gün/Planlayıcı ızgarası, Gantt ve liste kutuları 1.17.0'daki cam görünümüne döndü

## 1.19.0
- **Sayfaların en alttaki ana paneli görünmez**: Kanban kolonları, Ay ızgarası, Hafta/Gün/Planlayıcı ızgarası, Gantt ve Dashboard/Gün sayfasındaki liste kutuları artık
  dolgusuz, kenarsız, gölgesiz ve bulanıklıksız; kartlar/satırlar/hücreler doğrudan arka plan rengi veya görseli üzerinde durur. Kanban kolonunun üst durum şeridi de kalktı
  (durum rengi başlıktaki noktada). Kartlar (Kanban, Dashboard istatistikleri, Timeline), başlık paneli, pencereler ve komut paleti aynen duruyor; sürüklerken hedef kolon vurgusu çalışmaya devam eder
- Not: çok açık arka plan renklerinde panelsiz kalan soluk yazılar (ör. hafta günü başlıkları) daha zor okunur; koyu renk veya Standart arka plan önerilir
- Test: her sayfada (masaüstü + mobil) alt panelin hesaplanan stilleri, değişmemesi gerekenler ve Kanban sürükle-bırak vurgusu gerçek tarayıcıda doğrulandı

## 1.18.1
- **Geri alındı**: 1.18.0'daki panel saydamlığı. Sayfa içi paneller (Dashboard kartları, Kanban kolonları, Ay/Hafta/Gün ızgarası, listeler) ve başlık paneli
  1.17.0'daki görünümüne döndü. (1.18.0 bunları birlikte saydamlaştırmıştı; istenen yalnızca en alttaki ana panelin saydam olmasıydı.)
  1.18.0'ın diğer değişiklikleri (hayalet tıklama, ToDo, ilk açılış önizlemesi, yüzen düğme) aynen duruyor

## 1.18.0
- **Saydam ana paneller**: sayfalardaki ana paneller (Ay/Hafta/Gün ızgarası, Dashboard kartları, Kanban kolonları, listeler) ve yapışkan başlık paneli artık **saydam cam**
  yüzeydedir; arka plan rengi/görseli arkalarından görünür, bulanıklaştırma okunabilirliği korur. Pencereler, komut paleti ve kenar çubuğu değişmedi
- **Hayalet tıklama düzeltmesi**: dokunmatik ekranda bir etkinliğe dokununca, açılan pencerede dokunulan noktanın altındaki öğe (satır, tarih kutusu, anahtar…) kendiliğinden
  tetikleniyordu. Pencere açılışından sonra o noktadaki sahte fare olayları kısa süre yutulur (`core/ghostClick.js`); gerçek tıklamalar ve başka noktalara dokunuşlar etkilenmez
- Ay görünümü: etkinlik çubuğunun **Sil** düğmesi yalnızca hover'lı aygıtlarda görünür (dokunmatikte "yapışkan hover" ile parmağın altında beliriyordu)
- **ToDo kutuları** satırın metnine göre **dikeyde ortalı** (çok satırlı görevlerde de); **tamamlanan görevin üstü çizili** ve soluk
- **Açıklama ilk açıldığında** (ve tam ekranda) tüm satırlar **önizleme** halindedir; hiçbir satır ham değildir, klavye açılmaz. Başlıkta "Markdown" yazısı kaldırıldı
- **Yüzen "+" düğmesi** biraz saydam (%82); **basılı tutup dikey eksende sürüklenerek** yeri değiştirilir (hafif titreşim, büyür; sınırlar: altta 16 px, üstte başlığa 72 px).
  Konum `fabBottom` ayarında saklanır, dışa/içe aktarılır; taşımadan sonra yeni etkinlik açılmaz, basılı tutmadan önce kayma taşımayı başlatmaz
- Test: `clampFabBottom`, ToDo `task`/`done` bayrakları ve `md-task-done` çıktısı; gerçek tarayıcıda ToDo ortalama/çizgi, ilk açılış önizlemesi, saydamlık, FAB sürükleme ve
  kalıcılık, hayalet tıklama (koruma açık/kapalı karşılaştırmalı)

## 1.17.0
- **Açıklamada canlı önizleme**: Yaz / Önizle düğmeleri kaldırıldı. İmlecin bulunduğu (aktif) satır **ham Markdown** olarak (işaretleriyle) görünür ve düzenlenir,
  **diğer tüm satırlar önizleme halinde** kalır (Obsidian tarzı). Bir satıra dokununca o satır ham hale geçer; editörden çıkınca hepsi işlenmiş görünür
- Satır işlemleri: **Enter** böler (liste/alıntı işareti sürer, numara artar, boş öğede liste biter), satır başında **Backspace** / satır sonunda **Delete** birleştirir,
  **ok tuşları** satırlar arası gezer, görev kutusuna tıklamak `[ ]`/`[x]` değiştirir, çok satırlı yapıştırma satırlara bölünür, **Ctrl/⌘+A** tüm metni seçer.
  Araç çubuğu aktif satıra uygulanır; tam ekran düzenleyici de aynı şekilde çalışır
- Sınırlama: satırlar ayrı alanlar olduğu için fare/parmakla satırlar arası seçim yoktur (Ctrl/⌘+A tüm metni seçer)
- **Renk alanı** önceki gibi **yuvarlak ve tek satır**: klasik 8 renk ve sonunda aç/kapa düğmesi. Seçili renk bu 8'den değilse satıra ek yuvarlak olarak eklenir (360 px'te de tek satır).
  Açılınca 36 yuvarlaklık palet (Açık/Canlı/Koyu) ve **özel renk** (sistem seçicisi + hex) çıkar
- Düzeltme (iç): satır türüne göre `display` kuralları `hidden` özniteliğini eziyordu; artık gizli öğeler gerçekten gizli
- Test: satır satır render (XSS vektörleri dahil), `listContinuation`, `lineContentStart`

## 1.16.0
- **Etkinlik tam sayfa** açılır: ekranı kaplar, içerik en çok 760 px'lik ortalanmış sütundadır, alt çubuk sabittir
- **Etkinlik başlığı**: "Etkinliği düzenle" yerine etkinliğin kendi adı görünür; dokununca metin kutusuna dönüşür, uzunsa üç nokta ile kısalır
  (tamamı ipucu olarak). Yeni etkinlikte "Yeni etkinlik" ipucu ve odaklı kutu; düzenlemede klavye kendiliğinden açılmaz. Formdaki yinelenen başlık alanı kaldırıldı
- **Gantt**: Kritik yol ve sağındaki düğme (mobilde) sağa dayalı; S-M-L solda
- **Başlık**: hamburger menü ve sayfa adı büyüdü (mobilde 44 px düğme / 24 px ad); panel yüksekliği değişmedi (uzun adlar üç noktayla kısalır)
- Modal: `titleNode` (başlığa özel öğe) ve `initialFocus: 'dialog'` seçenekleri; pencerenin kendisi odaktayken Tab pencerenin içinde kalır

## 1.15.0
- **Timeline**: renkli noktalar zaman çizgisinin tam üstünde (her ekran boyutunda; çizgi ve noktalar aynı ölçülerden türetiliyor);
  **Yaklaşan / Tümü / Geçmiş** filtresi ve arama alanı sayfa gövdesinden **başlığa** taşındı
- **Tüm günler / Çalışma günleri** düğmesi (Ay ve Hafta) mobilde başlığın sağ ucuna dayalı
- **Açıklamada Markdown**: Yaz / Önizle sekmeleri ve araç çubuğu (kalın, italik, üstü çizili, kod, bağlantı, başlık, listeler, görev listesi, alıntı;
  Ctrl/⌘+B ve +I). Tam ekran düzenleyici de aynı araçlara sahip. Çıktı güvenlidir: ham HTML çalışmaz, yalnızca http(s)/mailto bağlantıları kabul edilir.
  Kanban kartı ve arama özetlerinde işaretler gizlenir
- **Modern renk paleti**: 12 ton × 3 yoğunluk (Açık / Canlı / Koyu), seçili renk onay işaretiyle; özel renk için sistem seçicisi ve hex alanı;
  telefonda 6 sütun, ok tuşlarıyla gezilebilir. Eski etkinlik renkleri paletin "Canlı" satırında korunur
- **Arka plan**: **Deri** kaldırıldı (seçmiş olanlar otomatik Standart'a taşınır). Yeni **Renk** arka planı: **tek renk** veya **çift renk · gradient**
  (135° degrade, renkleri değiştir düğmesi, sürüklerken canlı önizleme). Seçim ilk boyamada da uygulanır
- Test: Markdown (XSS vektörleri dahil), renk paleti/ayrıştırma ve renk arka planı CSS'i için birim testleri

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
