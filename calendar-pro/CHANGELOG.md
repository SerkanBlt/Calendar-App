# Değişiklik Günlüğü

Sürüm numaraları [semver](https://semver.org/lang/tr/) kuralına göre verilir:
**MAJOR** uyumsuz değişiklik · **MINOR** yeni özellik · **PATCH** hata düzeltmesi.
Uygulamadaki sürüm, kenar çubuğunda Ayarlar düğmesinin sağında ve Ayarlar → Hakkında'da görünür.

## 1.31.0
- **Cihazlar arası eşitleme (Google Drive)**: Ayarlar → Veri → **Bulut eşitleme**: Google Drive'a bağlanınca etkinlikler, **ekler** ve bazı ayarlar (tema, çalışma günleri, tatiller ve tatil grupları, haftanın başlangıcı, varsayılan hatırlatma)
  Drive'daki uygulamaya ait **gizli klasöre** (`drive.appdata`; başka Drive dosyalarına erişim yok) eşitlenir; aynı hesapla bağlanan her cihaz aynı veriyi görür. Sunucu yok: doğrudan tarayıcıdan Drive'a. Arka plan, kenar çubuğu, düğme konumu ve
  örnek (demo) etkinlikler gibi cihaza özel şeyler eşitlenmez
- **Birleştirme**: etkinlik başına **en son değişiklik kazanır**; **silmeler eşitlenir ve geri gelmez** (silme izleri; "Geri al" ve silmeden sonra başka cihazda yapılan düzenleme etkinliği yeniden doğurur); ekler değişmezdir ve etkinlikle birlikte silinir;
  ayarlarda anahtar başına son değişiklik kazanır. Aynı anda oluşan iki `sync.json` birleştirilir; buluttaki veri bu uygulamadan daha yeni bir şemayla yazılmışsa hiçbir şey ezilmez
- **Yeni cihaz**: buluttaki veriye ilk bağlanışta cihazın dokunulmamış örnek etkinlikleri atılır (düzenlenmiş olanlar korunur); örnek veriler hiçbir zaman buluta gitmez
- **Tetikleyiciler**: bağlanınca, açılışta, değişiklikten ~5 sn sonra (etkinlik, ek ve eşitlenen ayarlar), sekme yeniden görününce, internet gelince, 5 dakikada bir, elle "Şimdi eşitle" / `Ctrl + K`. Değişiklik yoksa buluta yazılmaz
- **Dayanıklılık**: çevrimdışıyken durum "Çevrimdışı — internet gelince eşitlenir" (veri yerelde güvende); 401'de belirteç sessizce yenilenir, 429/5xx'te üstel bekleyerek yeniden denenir; tarayıcı Google penceresini engellerse "Yeniden bağlan" uyarısı çıkar ve
  otomatik denemeler durur; **4 MB üstü ekler** devam ettirilebilir (resumable) yüklemeyle gider; aynı cihazdaki birden çok sekme/pencere Web Locks ile tek tur eşitler, BroadcastChannel ile birbirinin ekranını yeniler ve silme izlerini ezmez
- **Bağlantıyı kes** (erişim Google'da da iptal edilir; yerel veri ve bulut kalır) · **Bulut verisini sil** (Drive'daki eşitleme dosyalarını siler, bağlantıyı keser) · **Tüm verileri sıfırla** bağlantıyı da keser (onay penceresi uyarır)
- Altyapı: `eventRepo`/`attachmentRepo` silmelerde iz bırakır ve buluttan gelenleri zaman damgasını koruyarak yazar (`applyRemote`); `settings` satırlarına `updatedAt` eklendi (eski satırlar zaman damgasızdır, bulutun gerçek damgalı değerine yenilir);
  bağımlılığı temizlenen etkinliklerin `updatedAt`'i de yenilenir. Yeni dosyalar: `services/syncService.js`, `services/sync/{syncCore,syncState,driveClient,config}.js`
- Test: 25 yeni birim test (birleştirme kuralları, idempotans, sıradan bağımsızlık, TTL, doğrulama, demo verisi, iki cihazın 8 farklı tohumla 300 adımlık rastgele işlem sonunda yakınsaması). Gerçek tarayıcıda **sahte Google oturumu ve sahte Drive** ile iki cihazlı uçtan uca test:
  bağlanma/ilk yükleme (demo verisi hariç), yeni cihazın indirmesi, düzenleme/silme yayılımı, geri gelmeme, çakışmada son değişiklik, ek ekleme/silme (otomatik), tema eşitleme, oturum bitimi ve "Yeniden bağlan", 401/500/429, çevrimdışı → internet gelince,
  sayfalı liste, yinelenen belge, daha yeni şema, bağlantıyı kes/yeniden bağlan, sıfırlama, bulut verisini silme, izin reddi, büyük ek, çoklu sekme, mobil düzen. **Gerçek Google hesabıyla bu sürümde denenmedi** (ilk denemeyi kullanıcı yapar)

## 1.30.0
- **Menüde Yıl, Ay'ın üstünde**: görünüm sırası Dashboard, Yıl, Ay, Hafta, Gün, Scheduler, Timeline, Gantt, Kanban. Klavye kısayolları **değişmedi** (`2` Ay, `9` Yıl …); menü rozetleri ve ipuçları gerçek kısayolu gösterir
  (artık menü sırasından değil `core/router.js` → `ROUTES`'tan türetilir); komut paletindeki ipuçları da aynı
- **Gantt'ta görevi başka projeye taşıma**: "Tüm projeler"de görev satırını başka projenin başlığına ya da satırına sürükle-bırak (fare; dokunmatikte basılı tutarak) ya da görev çubuğu/satırında **sağ tık → Proje**
  (mevcut projeler, Projesiz, **Yeni proje…** ad penceresi); taşıma "Geri al" ile geri alınır; başka projedeki görevlerle bağımlılık kalırsa toast belirtir. Yeni `promptDialog` (tek satırlık metin sorusu),
  `moveToProject` eylemi, saf `projectValue` / `crossProjectLinks` yardımcıları
- **Menüdeki mini takvimde ISO hafta numaraları**: satır başında numara (sütun başlığı **H**), ISO 8601; numaraya tıklamak o haftayı Hafta görünümünde açar
- Test: 6 yeni birim test (proje taşıma yardımcıları, gruplama, bağımlılık sayımı, proje başına kritik yol); gerçek tarayıcıda (masaüstü + mobil) menü sırası/kısayollar, mini takvim hafta numaraları (yıl sınırı, Pazar başlangıcı),
  sürükle-bırak (başlığa/satıra, kendi projesine, geri al, bağımlılık uyarısı, dokunmatik basılı tutma), sağ tık menüsü (fare/klavye, Yeni proje…, tek proje görünümü, düz liste, 80 karakter sınırı)

## 1.29.0
- **Zamanı geçince otomatik kapat**: etkinlik formunda yeni anahtar; açıksa bitiş zamanı geçince etkinlik **Tamamlandı** (%100) olur (açılışta, her 30 sn'de ve sekme görününce denetlenir; kapananlar tek bildirimle
  duyurulur). Tekrarlayan serilerde pasif (durum seri düzeyindedir). Yeni alan `autoClose` (eski kayıtlar: kapalı)
- **Sayfa kenar boşluğu her kenarda aynı** (`--page-pad`, 12 px): paneller ve kenar çubuğu ekran kenarlarından ve birbirinden eşit uzaklıkta; masaüstünde kenar çubuğunun alt kenarı artık alttaki panellerle hizalı
  (önceden daha yakındı); mobil çekmece de aynı boşlukla açılır
- **Hızlı komut yalnızca açıkken vurgulu**: palet kapalıyken düğme artık "hep seçili" görünmez
- **Menü solda** (Ayarlar → Genel → Kenar çubuğu; yalnız masaüstü, mobilde görünmez): varsayılan KAPALI = menü sağda. Açılınca kenar çubuğu soldaki sütuna geçer, Tab sırası/gölge/bildirim konumu da uyar. `settings.sidebarLeft`
- **Temalı açılır listeler**: `select` listeleri yerel tarayıcı listesi yerine temanın renkleriyle çizilir (açık/koyu/özel temalar); tam klavye desteği; dokunmatik cihazlarda yerel liste korunur
- **Sağ tık menüsü ile durum değiştirme**: etkinliği açmadan Durum (Yapılacak · Devam Ediyor · Tamamlandı) + Aç + Sil; Ay/Hafta/Gün/Scheduler/Timeline/Kanban/Gantt/Dashboard'da çalışır; tekrarlayan örneklerde
  "Yalnızca bu / Tüm seri" sorulur; ilerleme tutarlı kalır; klavyeyle kullanılır
- **Tatil grupları**: hazır gruplar **Resmî (mavi)**, **Dini (yeşil)**, **Özel (mor)**; tatil penceresinde grup seçici; Yıl görünümünde **Tatil grupları** paneli (renk değiştirme — hazır gruplarda da —, yeni grup ekleme,
  eklenen grupların adını değiştirme ve silme; silinen grubun tatilleri Özel'e taşınır, Geri al). Tatil günleri grubunun renginde görünür: Yıl kartları ve lejantı, Yıl listesi, Ay hücresi, mini takvim, Gantt gölgesi,
  Gün başlığı. `settings.holidayGroups` (ayarlar yedeğine dahil); tatil kaydına `group` alanı eklendi (eski kayıtlar Özel sayılır)
- **Yıl görünümünde ISO hafta numaraları**: her ay kartında satır başı numara (sütun başlığı **H**), ISO 8601'e göre (1. hafta = yılın ilk Perşembesini içeren hafta; 2026 → 53 hafta); numaraya tıklamak o haftayı açar
- Sürüklerken imleç pencerenin en kenarındaki sayfa boşluğuna (12 px) gelse de otomatik kaydırma çalışır (kenar boşluğu eşitlenince bu şerit kaydırılamaz hâle gelmişti; otomatik kaydırıcı artık kaydırılabilir öğeyi biraz içeriden arar)
- Test: ISO hafta (yıl sınırları, 53 haftalı yıllar, 2019–2030 tüm günler), otomatik kapat, durum yaması ve tatil grupları için 21 yeni birim test; gerçek tarayıcıda (masaüstü + mobil) hafta numaraları, grup ekleme/renk/ad/silme/geri al,
  tatil rengi (Yıl/Ay/Gün/Gantt/mini takvim), sağ tık menüsü, temalı liste, otomatik kapat, kenar boşlukları ve Menü solda

## 1.28.0
- **Yeni "Yıl" görünümü** (kenar çubuğunda; kısayol `9` — mevcut 1–8 kısayolları değişmedi; `Ctrl + K` → "Yıl Aç"): 12 ay kartı, Geri/İleri bir yıl kaydırır, ay başlığı Ay görünümünü açar. Çalışma dışı günler soluk, etkinlik olan günler noktalı,
  bugün çerçeveli; telefonda 2 sütun
- **Tatil günleri tanımlama**: Yıl görünümünde bir güne dokunarak (ya da **Tatil ekle** ile) tatil eklenir; pencerede ad, tarih, isteğe bağlı bitiş tarihi (çok günlü bayram → her gün ayrı kayıt, en çok 60 gün) ve
  **"Her yıl aynı tarihte tekrarla"**: **açıksa** tatil her yıl aynı ay-günde çalışma dışı (off) görünür (geçmiş/gelecek tüm yıllar; 29 Şubat yalnızca artık yıllarda); **kapalıysa** (değişken tatil) yalnızca o yıl için geçerlidir.
  Yılın tatil listesi (tarih, ad, "Her yıl" / "Yalnızca 2026" rozeti) düzenle/sil içerir; silme "Geri al" ile geri alınır. Aynı güne en çok bir kayıt tutulur (tekrarlı kayıt aynı ay-günün tek seferlik kayıtlarını birleştirir)
- **Tatil = çalışma dışı (off) gün**: Ay görünümünde hücre soluk + kırmızı tonlu, adı hücrede (hafta günü sütunları yalnızca çalışma günü olmayan günlere göre gizlenir; tatil sütunu kalkmaz); Hafta görünümünde sütun soluk ve
  "çalışma dışı gizli" iken tatil sütunu kalkar; Gün başlığında "Tatil: ad"; Scheduler'da sütun soluk; Gantt'ta gün sütunu gölgeli; mini takvimde kırmızı gün. Veri `settings.holidays` (ayarlar yedeğine dahil)
- Test: 21 yeni birim testi (tekrarlı/değişken tatil, artık yıl, yıl sınırı, off-gün entegrasyonu, ekleme/birleştirme/aralık/düzenleme/silme); gerçek tarayıcıda (masaüstü + mobil) tanımlama, aralık, yıl gezinme (2025/2026/2027),
  Ay/Hafta/Gün/Gantt/mini takvim yansıması, "çalışma dışı gizle", düzenle/sil/geri al, kalıcılık

## 1.27.0
- **Proje bazlı Gantt**: etkinlik formunda **Bağımlılıkların altında yeni "Gantt projesi" alanı** (proje adı yazılır ya da önceki projelerden seçilir). Gantt'ta proje varsa başlıkta bir **proje seçici** çıkar:
  **Tüm projeler** (proje başlıkları altında gruplu satırlar; başlıkta görev sayısı, ağırlıklı ilerleme % ve ilk başlangıç → son bitiş özet çubuğu; başlığa tıklayınca grup **daralır/genişler**, kalıcı; projesiz görevler en sonda
  "Projesiz"), **tek proje** ya da **Projesiz** (yalnızca o görevler, zaman ekseni de onlara göre). Seçim kalıcıdır (`ganttProject`, `ganttCollapsedProjects`; ayarlar içe/dışa aktarımına dahil)
- **Kritik yol proje başına** hesaplanır; projeler arası bağımlılıklar çizilir ama kritik yolu belirlemez; döngü denetimi tüm görevler üzerinden. Bir projeye atanmış görev tek günlük saatli toplantı olsa da Gantt'ta görünür
- Veri: etkinliğe `project` alanı (en çok 80 karakter; eski kayıtlar boş sayılır). JSON'a otomatik yazılır; ICS'te `X-CALENDAR-PRO-PROJECT`. Arama, Kanban/Timeline filtresi ve `Ctrl + K` paleti proje adında da eşleşir; bağımlılık listesinde projeler soluk metinle görünür
- **Açılır kutular**: yerel ok kenara yapışık duruyordu; tüm `select`'lerde (durum, hatırlatma, sıklık, ay günü, Gantt proje seçici …) yerine kenardan **14 px içeride** özel bir ok çizilir (sağ dolgu 40 px, uzun metin üç nokta ile kısalır;
  tema bağımsız nötr gri; açık/koyu temada ve mobilde kontrol edildi)
- Test: 13 yeni birim testi (`ganttProjects`: seçenekler, gruplu/düz/daraltılmış satırlar, özet, proje başına kritik yol, döngü) + ICS'te proje gidiş-dönüşü; gerçek tarayıcıda (masaüstü + mobil) alanın yeri, öneri listesi,
  seçici, gruplu görünüm, daralt/genişlet + kalıcılık + yenileme, tek proje, Projesiz, proje değiştirme, projeli saatli toplantı

## 1.26.0
- **Tekrarlı etkinliklerde tarih seçimi (desenler)**: Tekrar bölümü yeniden yazıldı (`recurrenceEditor.js`). Sıklığa göre desen seçilir:
  **günlük** → her gün / **iş günleri** / belirli günler (ör. 2 günde bir + yalnızca iş günleri); **haftalık** → haftanın **birden çok günü** (Sal + Per); **aylık** → ayın **N. günü** (ya da son günü) veya
  **ayın N. haftasının X günü** (ilk/ikinci/üçüncü/dördüncü/son × Pzt…Paz ya da *iş günü*: "ayın ilk Salısı", "ayın son iş günü"); yeni **çeyreklik** → çeyreğin **1./2./3. ayı** + aylık deseni;
  **yıllık** → ay + aylık deseni. Bitiş: yok / tarihte / N tekrar. Seçimler canlı bir özet cümlesine yansır. Başlangıcı izleyen alanlar (haftanın günü, ayın günü, ay) başlangıç tarihi değişince kendiliğinden değişir
- **Tüm tarihler listesi**: kuralın ürettiği tarihler (sonsuz serilerde 24'er 24'er) tek tek **değiştirilebilir** (başka güne alınır), **silinebilir** (**Geri al** ile) ve **Tarih ekle** ile yenisi **eklenebilir**;
  "Eklendi", "Silindi", "Ayrı düzenlendi" etiketleri. Bunlar kuralın `exdates` (silinen) ve yeni `rdates` (eklenen) alanlarına yazılır: sonuç = (kural ∪ rdates) \ exdates. Silinmiş tarihi eklemek onu geri getirir;
  `Enter` satır düzenlemesini onaylar, `Esc` yalnızca satırı kapatır (modal artık `data-handles-escape` ile iç bileşenin Esc'sini bırakabilir)
- **Tekrar motoru** (`recurrenceService.js`) dönem dönem tarih üretir (gün/hafta/ay/çeyrek/yıl), hızlı atlama ve kaba tarama aynı sonucu verir; çok günlü örnekler aralığa taşarsa görünür. **Geriye uyumlu**: eski kurallar
  (desen alanı yok) aynı tarihleri üretir; yeni alanlar yalnızca anlamlıysa saklanır, açılıp kapatılan eski seri değişmez. Bir örneği sürükleyip **"Tüm seri"** seçmek deseni taşınan örneğe uyarlar (`shiftRule`)
- **ICS**: yeni desenler `RRULE`'a (`BYDAY`, `BYMONTHDAY`, `BYMONTH`, `BYSETPOS`; çeyreklik = `FREQ=MONTHLY;INTERVAL=3N`), eklenen tarihler `RDATE`'e yazılır; `DTSTART` kuralın ürettiği ilk tarihtir (dönemler başka
  uygulamalarda birebir örtüşür). İçe aktarmada artık `BYDAY=MO,WE,FR`, "ayın 2. salısı", `-1FR`, "ayın son iş günü", `BYMONTHDAY`, çeyreklik `BYMONTH` ve `RDATE` (tek başına da) **desteklenir**; desteklenmeyenler
  (ör. ayda her salı) yine ilk örnek olarak eklenip bildirilir. Yeniden içe aktarmada yerelde eklenen tarihler korunur. Eski dosyalar etkilenmez
- Test: 40 tekrar motoru + 20 ICS birim testi (iş günleri, belirli günler, N. haftanın günü, çeyreklik, yıllık, rdates/exdates, hızlı atlama eşdeğerliği, shiftRule, gidiş-dönüşte aynı tarihler); gerçek tarayıcıda (masaüstü + mobil) tüm
  sıklıklar, bitiş kipleri, tarih sil/geri al/değiştir/ekle, kaydet-yeniden aç, eski seri, ayrı düzenlenmiş örnek etiketi, hafta görünümünde iş günleri
- Düzeltme: "Her 2 günda bir" yazım hatası ("günde bir"); `hidden` düğmeleri `.btn` ile görünür kalıyordu (Tekrar bölümünde giderildi)

## 1.25.1
- **Masaüstü başlığı düzeltildi**: sayfa başlığının arkasında, içerik panelinden her iki yanda 8 px taşan, yalnız alt köşeleri yuvarlak, kenarsız koyu bir bant duruyordu (1.24.0'da kaydırma başlığın altına
  taşınınca gereksiz kalan, eskiden kaydırılan içeriği örten yarı saydam bandın artığı). Artık başlık, mobildeki gibi **dört köşesi yuvarlak, ince kenarlı bir panel**dir ve içerik paneliyle **aynı genişlik ve
  hizadadır** (başlığın üstü kenar çubuğuyla aynı hizada, altında 8 px boşluk). Koyu/açık tema ve fotoğraf arka planında okunur kalır. Mobil/kısa ekran başlıkları ve yükseklikleri birebir aynı
- Kontrol: 8 sayfa × 4 masaüstü genişliği (başlık yüksekliği, panelle hizalama, taşma), mobil başlık yükseklikleri, kenar ölçümü, kaydırma/Kanban/yan panel regresyonları

## 1.25.0
- **Başlangıç–bitiş saat bağı**: etkinlik formunda başlangıç ile bitiş arasında bir **zincir düğmesi** var (geniş ekranda tek satırda iki grubun arasında; dar ekranda iki saat kutusunun sağında "]" ayracının ortasında).
  Bağ **açıkken** başlangıç saati/tarihi değişince bitiş, aradaki **süre korunacak** biçimde birlikte kayar (09:00–10:00 iken başlangıç 14:00 olursa bitiş 15:00; gece yarısını aşarsa bitiş tarihi ertesi güne geçer,
  geri dönünce iner; çok günlü aralığın uzunluğu da korunur). Düğmeye basınca bağ **kopar** (kopuk zincir simgesi): iki uç bağımsızdır, yalnızca bitiş başlangıçtan önceye düşmez. Yeniden bağlanınca o anki fark
  korunacak süre olur; bitişi elle değiştirmek süreyi günceller. Bağ **etkinliğe her girişte AÇIKTIR** (kalıcı ayar değil) ve tek başına "değişiklik yapıldı" sayılmaz (çıkarken sormaz). Tüm gün'de gizlenir (düzen kaymaz).
  Klavyeyle (Enter/Boşluk) ve dokunmayla çalışır, `aria-pressed` ile duyurulur. Mantık `shiftEnd` (`dateUtils.js`) ile saf fonksiyondur (6 birim testi)
- **Kanban panelleri üst üste binmiyor**: 1.24.0'daki "alt alta" düzeninde Yapılacak / Devam Ediyor / Tamamlandı panelleri üst üste biniyordu (sabit yükseklikli ızgara); düzen yeniden akan sütuna döndü, paneller kendi
  içeriği kadar yer tutar ve sayfa kaydırılır. 7 görünüm boyutu × 2 düzende örtüşme ölçüldü: hiçbirinde yok
- **Kanban panelleri açılıp kapanır**: her panel başlığındaki ok düğmesiyle (ya da başlığa tıklayarak) **daraltılır/genişletilir**; daraltılan panel yalnız başlığı + sayacı gösterir. Durum kaydedilir
  (`settings.kanbanCollapsed`, dışa/içe aktarımda korunur; geçersiz değerler okunurken temizlenir). Daraltılmış panele kart **sürükleyip bırakmak** çalışır; klavye (`Enter`/`Boşluk`, `aria-expanded`) ve dokunma desteklenir
- **Boş satırda liste/başlık başlatma**: açıklama araç çubuğundaki **madde, numaralı, görev, alıntı ve başlık** düğmeleri satırda karakter olmasa da çalışır: boş satıra `- `, `1. `, `- [ ] `, `> `, `## ` eklenir, imleç
  önekin sonuna gelir (yazmaya devam edilir); öneke tekrar basmak onu kaldırır; başka türe basmak türü değiştirir. Birkaç satır seçiliyken boş satırlar yine atlanır; yalnızca boş satırlar seçiliyse hepsine uygulanır.
  Düzeltme: ilk satır boşken ve imleç 0. konumdayken satır başı yanlış bulunuyordu (`lastIndexOf` + negatif indeks) — `lineStartOf` ile giderildi
- Test: saat bağı (açık/kopuk/yeniden bağlama, gece yarısı, çok günlü, tüm gün, yeniden girişte açık, kirli sayılmama, klavye, dar/geniş yerleşim), Kanban çakışma ve daraltma, boş satır biçimlendirme (masaüstü + dokunma)

## 1.24.0
- **Çıkarken sorar**: etkinlik editöründe kaydedilmemiş değişiklik varsa `Esc` / ✕ / **İptal** **"Değişiklikler kaydedilsin mi?"** diye sorar: **Kaydet** (kaydeder; ad boşsa pencere açık kalır) · **Kaydetme** (atar) ·
  **Vazgeç**. Form açılıştaki anlık görüntüyle karşılaştırılır: değişiklik geri alınırsa sorulmaz; kapsam seçimi tek başına değişiklik sayılmaz; tam ekran açıklamadaki yazı sayılır; Kaydet/Sil sormaz.
  `openModal` yeni `canClose` seçeneği ve `requestClose()` kazandı (doğrudan `close()` denetimi atlar)
- **Açıklama düğmeleri seçim yokken de çalışır**: önceden Kalın, kelimenin ortasına `**kalın**` yer tutucusu sokuyordu (`mer**kalın**haba`). Artık imleç **kelimedeyse kelime sarılır/açılır** (imleç yerinde kalır),
  **boşluktaysa** `**|**` gibi boş çift bırakılır (içindeyken tekrar basmak kaldırır); italik, çizili, kod aynı; bağlantıda kelime etiket olur. Ctrl+B/I de aynı. (`formatAtCaret`, 9 birim testi)
- **Araç çubuğu notun içinde, üstte (dock=top)**: açıklama araç çubuğu kutunun dışından, kutunun içine **CodeMirror paneli** olarak taşındı; kenarlıkla bütün, içerik kutu içinde kayarken sabit. Kutunun alt sınırı
  araç çubuğu dahil 140 px
- **Kaydırırken içerik başlığın altından akmaz**: kaydırma `.view`'den `.view-body`'ye taşındı; sayfa başlığı içeriğin üstünde sabit ve ayrı. Önceden Dashboard, Gün, Ay (yatay) ve Timeline'da kaydırılan içerik şeffaf başlığın
  arkasından görünüyordu (10 sayfa/boyutta ölçüldü; sonra hiçbirinde yok). Yan etkiler ele alındı: yeniden çizimde kaydırma konumu korunur; Timeline'ın ortalı sütunu dolguyla ortalanır (kaydırma çubuğu sayfa kenarında);
  Ay `flex` düzeltildi; Kanban "alt alta" kendi kaydırıcısı oldu (sürüklerken otomatik kaydırma çalışır, yan yana düzende yatay kaydırma aynen). Başlık yükseklikleri ve sayfa altı boşlukları birebir aynı
- Test: çıkış onayı (tüm kapanma yolları, geri alınan değişiklik, Kaydet/Kaydetme/Vazgeç, çift Esc, tam ekran, mobil), seçimsiz biçimlendirme (masaüstü/dokunma/kısayol), kaydırma yapısı (8 sayfa × 3 boyut, tekerlek,
  Timeline, yeniden çizim, Kanban, otomatik kaydırma), panel yerleşimi

## 1.23.0
- **Kenar çubuğu sağda**: masaüstünde kalıcı kenar çubuğu artık içeriğin **sağında**; telefon/dar ekran/yatay telefonda hamburgere (başlığın sağ ucunda) basınca menü **sağ kenardan kayarak** açılır.
  Kapatma yolları aynı (✕, perde, `Esc`); perde sol tarafı kaplar. DOM'da kenar çubuğu `main`'den sonra gelir, böylece Tab sırası görsel sırayla aynıdır.
  Masaüstünde sağ-alttaki bildirimler kenar çubuğunu örtmeden onun soluna oturur ve daraltılmış (64 px) genişliği izler. Mobilde kapalı çekmece ekranın sağında durur, yatay kaydırma yapmaz
- **Kanban başlığı**: "Yan yana / Alt alta" düğmeleri **yalnızca ikon** (açıklama `title` ve `aria-label`'da); **filtre kutusu** bu düğmelerle **aynı satırda, aynı yükseklikte (34 px) ve ortalı**
  (dikey/yatay/tablet/masaüstü). Dikeyde Kanban başlığı 159 → 119 px; diğer sayfaların başlık yükseklikleri (Timeline dahil) birebir aynı
- Test: kenar çubuğunun konumu/genişliği (masaüstü, daraltılmış), bildirim çakışması, mobil çekmece (3 boyut: sağdan açılma, kayarak kapanma, taşma yok), Kanban hizası (5 boyut), başlık yüksekliği karşılaştırması

## 1.22.1
- **Çekme kulakçığı geri alındı**: 1.22.0'daki sol kenar kulakçığı kaldırıldı (`drawerTab.js` ve stilleri silindi). Yerine eski **hamburger düğmesi başlığın SAĞ ucuna** döndü:
  dikey düzende başlığın yanında (ilk satırın sağı), yatay kompakt şeritte eylemlerden sonra en sağda. Kenar çubuğu çekmecesi, ✕, perde ve `Esc` aynen çalışır; masaüstünde hamburger yoktur
- Başlık yükseklikleri, hamburger solda olduğu hâldeki değerlerle birebir aynı (5 boyut × 8 sayfa ölçülerek karşılaştırıldı)

## 1.22.0
- **Hamburger kalktı, sol kenara çekme kulakçığı geldi**: başlıktaki hamburger düğmesi kaldırıldı. Yerine ekranın sol kenarında, dar (14 px) ve parmak boyunda (52 px), dikeyde ortada, yarı saydam bir kulakçık var;
  kenar boşluğuna sığar (içeriği örtmez). **Dokununca** kenar çubuğunu açar, **sağa çekilince** çekmece parmağı izler (arkada perde belirir); bırakınca ≥%35 açıksa tamamlanır, değilse geri kapanır.
  Dikey/sola kayma çekme sayılmaz. Klavyeyle (Tab → Enter) açılır, `aria-expanded` güncellenir; açıkken kulakçık gizlenir. Dar ekranlarda ve yatay telefonda görünür; masaüstü/yatay tablette (kalıcı kenar çubuğu) yoktur
- Başlık panelinin yüksekliği **birebir aynı** kaldı (5 boyut × 8 sayfa: dikey 85–215 px, kompakt yatay 50 px; ölçülerek karşılaştırıldı); kompakt başlıkta satır yüksekliği artık başlık bloğuyla sabitlenir
- Test: kulakçık geometrisi, dokunma, gerçek dokunma olaylarıyla (CDP) çekme (izleme, perde, uzun/kısa çekme, dikey kaydırma), klavye, kapatma yolları, masaüstünde yokluk
- Sınırlama: Android'in kenardan içeri "geri" hareketi işletim sisteminde işlenebilir; bu yüzden dokunma her zaman açar, çekme işletim sisteminin izin verdiği yerde çalışır (gerçek telefonda denenmedi)

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
