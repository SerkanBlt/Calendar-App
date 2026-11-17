# Calendar Pro

Modüler, offline çalışan takvim ve üretkenlik SPA'sı — Vite + Vanilla JS (ES Modules) + IndexedDB + PWA.
Çalışma zamanı bağımlılıkları yalnızca açıklama editörü içindir: CodeMirror 6 (`@codemirror/state|view|commands|language`) ve Lezer Markdown ayrıştırıcısı (`@lezer/markdown`); geliştirme bağımlılığı Vite'tır. JS paketi ≈157 KB gzip (CodeMirror ≈100 KB).

## Başlangıç

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # dist/ klasörüne üretim çıktısı
npm run preview   # üretim çıktısını sunar (service worker burada aktif olur)
npm test          # ICS testleri (Node'un yerleşik test koşucusu; ek bağımlılık yok)
```

İlk açılışta tüm görünümleri tanıtan örnek veriler yüklenir (bir kez).

## GitHub Pages'te yayınlama

`.github/workflows/deploy.yml`, `master` dalına her push'ta uygulamayı derleyip GitHub Pages'e yükler.
Build göreli yollarla (`base: './'`) üretildiği için alt klasörde sorunsuz çalışır:
**https://serkanblt.github.io/Calendar-App/**

Tek seferlik ayar:
1. Repo herkese açık olmalı (ücretsiz hesapta Pages yalnızca public repolarda çalışır) — *Settings → General → Danger Zone → Change visibility*.
2. *Settings → Pages → Build and deployment → Source* alanını **GitHub Actions** yapın.
3. *Actions* sekmesinden "Deploy to GitHub Pages" iş akışını çalıştırın (veya yeni bir push yapın).

## Görünümler

| Görünüm   | Özellikler |
|-----------|------------|
| Dashboard | Toplam / bugün / bu hafta / geciken sayaçları, bugünün ajandası, yaklaşanlar, durum ve kategori dağılımı |
| Ay        | 6 haftalık ızgara, tıkla-oluştur, düzenle, sil (×), günler arası sürükle-bırak, bugüne git |
| Hafta     | 7 günlük saat ızgarası, sürükle-bırak (30 dk snap), boyutlandırma |
| Gün       | Saat bazlı ızgara, çakışmaların yan yana yerleşimi, çakışma paneli ve "boş zamana kaydır" |
| Scheduler | 24 saat, 15 dk snap, sürükle-bırak, boyutlandırma, tüm gün satırı, 1/3/5/7 gün, yakınlaştırma |
| Timeline  | Ay/gün gruplu kronolojik akış; yaklaşan / tümü / geçmiş filtresi ve arama başlıkta; noktalar zaman çizgisinin tam üstünde |
| Gantt     | Çubuklar, ilerleme tutamacı, taşıma, iki kenardan boyutlandırma, bağımlılık oluşturma/kaldırma, kritik görevler, CPM ile kritik yol, bağımlılık ihlali uyarısı; **proje bazlı** görünüm (aşağıya bakın) |
| Kanban    | Todo / Doing / Done, kolonlar arası sürükle-bırak, filtre, kolonları yan yana / alt alta gösterme (başlıkta **yalnızca ikonlu** iki düğme; filtre kutusu onlarla aynı satırda ve aynı yükseklikte; seçim kaydedilir). Her panel başlığındaki ok ya da başlığa tıklama ile **daraltılıp genişletilir** (durum kaydedilir; daraltılmış panele kart bırakılabilir); alt alta düzende paneller üst üste binmez, sayfa kayar |
| Yıl       | 12 ay kartı (satır başlarında **ISO hafta numaraları**; çalışma dışı günler soluk, **tatil günleri grubunun renginde**, etkinlik olan günler noktalı); bir güne dokunarak **tatil günü** tanımlanır; **tatil grupları**; yıl listesi; ay başlığı Ay görünümünü açar (aşağıya bakın) |

Sürükle-bırak Pointer Events ile yazıldığı için fare ve dokunmatik ekranda çalışır:

- **Fare:** öğeyi tutup sürükleyin. Izgaranın/alanın kenarına yaklaşınca otomatik kaydırma yapılır.
- **Dokunmatik:** dokunmak öğeyi açar, parmakla kaydırmak sayfayı kaydırır, **basılı tutmak** sürüklemeyi başlatır.
- Hafta/Gün/Scheduler'da saatli bir etkinliği **Tüm gün** satırına bırakmak onu tüm gün yapar; tek günlük bir tüm gün
  etkinliğini saat ızgarasına bırakmak, bırakılan saatte 1 saatlik etkinliğe çevirir (çok günlü olanlar yalnızca gün kaydırır).

## Yıl görünümü ve tatil günleri

**Yıl** görünümü (kenar çubuğunda, kısayol `9`) yılın 12 ayını küçük kartlar hâlinde gösterir (Geri/İleri bir yıl kaydırır; ay başlığına tıklamak Ay görünümünü açar; telefonda 2 sütun).
Her kartta satırların başında **ISO 8601 hafta numaraları** vardır (sütun başlığı **H**): 1. hafta, yılın ilk Perşembesini içeren haftadır; yıl başı/sonu günleri komşu yılın haftasına ait olabilir
(ör. 29 Aralık 2025 → 2026'nın 1. haftası, 1 Ocak 2021 → 2020'nin 53. haftası; 2026 yılı 53 haftalıdır). Satırlar "Haftanın başladığı gün" ayarına göredir, numara her zaman ISO'dur;
numaraya tıklamak o haftayı **Hafta** görünümünde açar. Hesap `src/core/dateUtils.js` → `isoWeek` / `isoWeekInfo` (Perşembe-çapa algoritması, `tests/ui-logic.test.js`).
**Tatil günleri** buradan tanımlanır: bir güne dokunun (ya da **Tatil ekle**) → pencerede **ad**, **tarih**, isteğe bağlı **bitiş tarihi** (birkaç günlük bayram tatili: her gün ayrı kayıt olur, en çok 60 gün) ve
**"Her yıl aynı tarihte tekrarla"** anahtarı vardır:

- **Anahtar AÇIK (tekrarlı):** tatil her yıl aynı ay-günde (ör. 29 Ekim) çalışma dışı (**off**) görünür — geçmiş ve gelecek tüm yıllarda. 29 Şubat'ta tanımlanırsa yalnızca artık yıllarda vardır.
- **Anahtar KAPALI (değişken):** tatil **yalnızca o tarihin yılı** için geçerlidir (ör. tarihi her yıl değişen dini bayramlar); sonraki yıllarda görünmez.
- Aynı güne en çok **bir** kayıt tutulur: tekrarlı kayıt eklenince aynı ay-günün tek seferlik kayıtları ona birleşir; tekrarlı bir tatilin zaten kapsadığı güne tek seferlik kayıt eklenmez (yalnızca adı güncellenir).
- Altta o yılın **tatil listesi** vardır (tarih, ad, grup, "Her yıl" / "Yalnızca 2026" rozeti, **Düzenle** / **Sil**). Silme "Geri al" ile geri alınır. Pencerede o günün etkinlikleri ve **Gün görünümü** kısayolu da bulunur.

**Tatil grupları:** her tatil bir gruba aittir ve **grubunun renginde** görünür. Hazır gruplar **Resmî (mavi)**, **Dini (yeşil)** ve **Özel (mor)**'dür; yeni tatil **Özel** ile başlar, tatil penceresindeki
**Grup** seçiciyle değiştirilir (düzenlerken kayıtlı grup seçili gelir). Yıl görünümünün altındaki **Tatil grupları** panelinde: renk yuvarlağına basarak **grubun rengi değiştirilir** (hazır gruplarda da; adları sabittir),
**Yeni grup adı + renk → Grup ekle** ile kendi grubunuzu eklersiniz (en çok 20 grup; aynı ad iki kez kullanılamaz), eklenen grupların adı yazılarak değiştirilir ve **Sil** ile silinir — silinen grubun tatilleri
**Özel**'e taşınır, **Geri al** hepsini geri getirir. Hazır gruplar silinemez. Renk; Yıl kartlarında, Ay görünümünde (hücre tonu, gün numarası, tatil adı), kenar çubuğu mini takviminde, Gantt gün gölgesinde ve
Gün başlığındaki "Tatil (Grup): ad" yazısında kullanılır; Yıl görünümündeki açıklama (lejant) grupları listeler. Gruplar `settings.holidayGroups` içinde `[{ id, name, color, preset }]` olarak saklanır.

Tatil günleri **çalışma dışı (off) gün** sayılır: **Ay** görünümünde hücre soluk + grup renginde tonlu olur ve adı hücrede yazar (hafta günü sütunları yalnızca çalışma günü olmayan günlere göre gizlenir; tatil sütunu kalkmaz);
**Hafta** görünümünde sütun soluktur ve **"Çalışma günleri" (çalışma dışı gizli)** seçiliyken tatil günü sütunu da kalkar; **Gün** başlığında "Tatil (Grup): ad" yazar ve ızgara soluktur; **Scheduler**'da sütun soluktur; **Gantt**'ta gün sütunu
gölgelenir; kenar çubuğundaki **mini takvimde** gün grup renginde işaretlenir (ipucu: ad). Veri `settings.holidays` içinde `[{ id, date, name, yearly, group }]` olarak saklanır ve ayarlar yedeğine (JSON) dahildir.
Mantık: `src/core/holidays.js` (saf, `tests/holidays.test.js`), off-gün entegrasyonu `src/core/workDays.js` (`offDaySet(günler, çalışmaGünleri, tatiller)`).

## Proje bazlı Gantt

Etkinlik formunda **Bağımlılıkların altında** bir **Gantt projesi** alanı vardır: proje adı **yazılır** ya da daha önce kullanılan projelerden **seçilir** (açılır öneri listesi; en çok 80 karakter).
Aynı adı taşıyan görevler aynı projedir. Hiç proje yoksa Gantt eskisi gibi düz bir listedir; en az bir proje varsa başlıkta bir **proje seçici** çıkar:

- **Tüm projeler:** görevler proje başlıkları altında **gruplanır** (Türkçe sıralı; projesiz görevler en sonda **"Projesiz"** grubunda). Başlık satırında görev sayısı, süreye göre ağırlıklı **ilerleme %** ve
  projenin ilk başlangıcından son bitişine uzanan bir **özet çubuğu** görünür. Başlığa tıklayınca grup **daralır / genişler**; durum kaydedilir (`settings.ganttCollapsedProjects`).
  Daraltılan projenin görevleri satırlardan kalkar ama zaman ekseni kaymaz.
- **Tek proje / Projesiz:** yalnızca o görevler gösterilir (zaman ekseni de o görevlere göre kurulur); alt başlıkta proje adı yazar. Seçim kaydedilir (`settings.ganttProject`); proje silinir ya da adı değişirse "Tüm projeler"e döner.
- **Kritik yol proje başına** hesaplanır ("Kritik yol: N görev · süre"); farklı projeler arasındaki bağımlılıklar çizilir ve ihlal uyarısı verir ama kritik yolu belirlemez. Yeni bağımlılıkta döngü denetimi tüm görevler üzerinden yapılır.
- Bir projeye atanmış görev, tek günlük saatli bir toplantı olsa bile Gantt'ta görünür (tekrarlayan etkinlikler hâlâ Gantt'a girmez). Görevin projesi formdan değiştirilince Gantt'ta yeni grubun altına geçer.
- Bağımlılık listesinde görevlerin yanında projeleri soluk metinle yazar; arama, Kanban/Timeline filtresi ve `Ctrl + K` paleti proje adında da eşleşir. Mantık: `src/services/ganttProjects.js` (saf, `tests/gantt-projects.test.js`).
- **Görevi başka projeye taşıma:** "Tüm projeler" görünümünde soldaki listeden bir **görev satırını** başka bir projenin **başlığına ya da görev satırına sürükleyip bırakın** (fare: hemen sürüklenir; dokunmatik: satırı **basılı tutup** sürükleyin;
  hedef çerçevelenir). Ya da görev çubuğuna / satırına **sağ tıklayın → Proje** bölümü: mevcut projeler, **Projesiz** (geçerli olan işaretli) ve **Yeni proje…** (ad sorar; en çok 80 karakter; ilk proje de böyle atanabilir).
  Taşıma yalnızca görevin `project` alanını değiştirir; toast'ta **Geri al** vardır. Görevin başka projedeki görevlerle bağımlılığı kalıyorsa toast bunu belirtir ("N bağımlılık başka projedeki görevlerle": bu bağlantılar çizilmeye devam eder
  ama kritik yolu belirlemez). Kendi projesine bırakmak bir şey yapmaz; tek proje / Projesiz görünümünde ve proje yokken sürükleme hedefi olmadığından sağ tık menüsü kullanılır (taşınan görev o görünümden çıkar; seçili proje kalmazsa "Tüm projeler"e dönülür).
  Formdaki **Gantt projesi** alanı da aynı işi görür. Kod: `core/actions.js` → `moveToProject`, saf yardımcılar `services/ganttProjects.js` → `projectValue`, `crossProjectLinks`.

## Çalışma günleri

**Ayarlar → Takvim** bölümünden çalışma günleri seçilir (varsayılan: Pazartesi–Cuma; Cumartesi ve Pazar çalışma dışı).
Çalışma dışı günler Ay ve Hafta görünümünde soluk/taranmış gösterilir. **Çalışma dışı günleri göster** anahtarı kapatılırsa
bu günlerin sütunları Ay ve Hafta görünümünden kalkar. Aynı ayar, Ay ve Hafta başlığında **Yeni** düğmesinin solundaki
düğmeyle (Tüm günler / Çalışma günleri) ve `Ctrl + K` → "Çalışma Dışı Günleri Göster/Gizle" ile de değiştirilebilir.

## Temalar

**Ayarlar → Tema** bölümünde **Açık · Koyu · Sistem** ve renk şeritli özel tema kartları bulunur:
**Sonbahar** (orman / amber), **Gün Batımı** (gece mavisi / kayısı), **Okyanus** (derin deniz / turkuaz),
**Misket Limonu** (zeytin / lime), **Grafit** (renksiz gri), **Kızıl Çelik** (gece / kızıl) ve **Dağ Yolu** (asfalt / turuncu).
`Ctrl + K` → "Özel Temalar…" (Ayarlar'ı bu bölümde açar) veya "Tema: …" ile de seçilebilir.

Yeni özel tema eklemek için:
1. `src/styles/theme.css` içine `:root[data-theme='<ad>'] { ... }` token bloğu ekleyin (mevcut özel temaları örnek alın; `--on-accent` vurgu rengi üzerindeki yazı rengidir).
2. `src/core/theme.js` içindeki `CUSTOM_THEMES` listesine `{ value, label, description, meta, swatches }` ekleyin.

## Arka planlar

Arka plan temadan bağımsızdır; her tema her arka planla kullanılabilir. **Ayarlar → Arka plan** bölümünde
önizlemeli bir ızgara bulunur (`Ctrl + K` → "Arka Planlar…" veya "Arka Plan: …"). **Standart**, temanın kendi
degradesidir. Görsel arka planlarda görselin üzerine temanın zemin rengi bindirilir; böylece her temada yazılar okunur kalır.

### Renk arka planı

**Renk** karosu seçilince altında renk ayarları açılır:

- **Tek renk**: düz bir renk. **Çift renk · gradient**: iki renk arasında 135° çapraz degrade; ⇄ düğmesi renkleri değiştirir.
- Renk seçicide sürüklerken arka plan canlı önizlenir; seçim bitince kaydedilir (iptal edilirse eski arka plana dönülür).
- Renk olduğu gibi gösterilir (görsellerdeki gibi tema bindirmesi yoktur); paneller cam yüzeyli olduğu için metinler okunur kalır.
  Çok açık bir renk seçerseniz koyu tema metinleri zor okunabilir; açık temayı deneyin.
- Ayarlar: `bgColorMode` (`single` | `dual`), `bgColor1`, `bgColor2`. Değerler `#rrggbb` olarak doğrulanır; ilk boyamada (`index.html`)
  yalnızca tek renk veya `linear-gradient(135deg, #rrggbb, #rrggbb)` biçimleri kabul edilir.

### Gölge yok

**Hiçbir panelde gölge yoktur**: `--shadow`, `--shadow-sm` ve `--shadow-lg` belirteçleri tüm temalarda `none`'dır (cam paneller, kartlar, pencereler, komut paleti, kenar çubuğu, menüler,
bildirimler, yüzen düğme). Derinlik 1 px kenar çizgisi ve yüzey tonlarıyla verilir. Bu, kaydırılan ana panelin (`.view`) kenarında kesilen gölgelerin ekranın kenarında koyu bir "panel şeridi"
bırakmasını da kökten çözer. Panel olmayan küçük vurgular (birincil düğme parıltısı, takvim olay çubuğunun 1 px alt çizgisi, Timeline noktasının halkası, Gantt kritik yol vurgusu) kalır.
Kanban kolonunun üstündeki durum şeridi gölge değil iç çizgidir (`inset`), kalır.

### Sayfa altı

Sayfaların altında boşluk bırakılmaz: paneller (Ay/Hafta/Gün/Planlayıcı ızgarası, Gantt, Kanban bantları, Dashboard kutuları) görünür alanın altına, standart sayfa kenar boşluğuna (`--page-pad`, 12 px) kadar uzar.
**Başlık sabittir ve içerikten ayrıdır**: kaydırma `.view-body` içinde olur, sayfa başlığı (`.toolbar`) içeriğin üstünde hareketsiz durur; kaydırılan içerik başlığın arkasından/altından **akmaz**, başlığın hemen
altındaki kenardan kesilir. (Önceden `.view` kaydırılır, başlık yapışkan durur ve içerik şeffaf başlığın arkasından görünürdü.) **Başlık her ekranda aynı panel**dir: dört köşesi yuvarlak, ince kenarlı,
içerik paneliyle **aynı genişlikte ve hizada**; açık/koyu temada ve fotoğraf arka planlarında okunur kalır. Aynı görünüm yeniden çizildiğinde (ör. bir etkinlik değişince) kaydırma konumu
korunur; başka bir görünüme geçince sayfa en üstten başlar. Timeline'ın 920 px'lik ortalı sütunu, kaydırıcının tam genişlikte kalması için dolguyla ortalanır (kaydırma çubuğu sayfa kenarında, tekerlek kenar boşluğunda da çalışır).
Mobilde yüzen düğme panelin **üstünde yüzer** (yeri değiştirilebilir). Kaydırmalı sayfalarda son öğeler düğmenin altında kalmasın diye boşluk **son panelin içine** verilir
(Dashboard/Gün'ün son kutusu, alt alta Kanban'ın son bandı; yan yana Kanban'da kolon listelerinin sonu; Timeline listesinin sonu).
- Kaldırılan arka plan: eski **Deri** artık yok; onu seçmiş olanlar açılışta otomatik olarak Standart'a taşınır.

Görsel arka planlarda ızgaranın altındaki **Yerleşim** seçenekleriyle görselin ekrana nasıl oturacağı belirlenir:

| Yerleşim | Davranış |
|----------|----------|
| Doldur (varsayılan) | Ekranı kaplar, taşan kısımlar kırpılır |
| Sığdır | Görselin tamamı görünür, oran korunur; boşluklar tema rengiyle dolar |
| Uzat | Ekrana tam oturur, oran bozulabilir |
| Döşe | Gerçek boyutunda yan yana tekrarlanır (desen/doku görselleri için ideal) |
| Ortala | Gerçek boyutunda ortada tek kez |

Ayarlar paneli seçimden sonra açık kalır; görsel ve yerleşim art arda denenebilir. `Ctrl + K` → "Arka Plan Yerleşimi: …" ile de seçilebilir.

### Kendi arka planını ekleme

Izgaradaki **Kendi görselini ekle** kutusu (veya `Ctrl + K` → "Arka Plan Ekle…") ile cihazdan bir görsel seçilir;
görsel hemen arka plan olarak uygulanır ve listeye eklenir. Kendi görsellerinin köşesindeki **×** ile silinir
("Geri al" ile geri getirilebilir; seçili görsel silinirse Standart'a dönülür).

- Kabul edilen biçimler: JPG, PNG, WebP, AVIF, GIF, SVG (en fazla 25 MB).
- Büyük fotoğraflar uzun kenarı 2560 px olacak şekilde küçültülüp WebP'ye çevrilir (ör. 8 MB → ~130 KB).
- Görseller yalnızca bu tarayıcıda (IndexedDB) saklanır; JSON dışa aktarımına dahil değildir.

Yeni hazır görsel arka plan eklemek için:
1. Görseli `public/backgrounds/` klasörüne kopyalayın (webp/jpg önerilir, ~300 KB altı).
2. `src/core/backgrounds.js` içindeki `BACKGROUNDS` listesine `{ value, label, src, dim }` ekleyin.
   `dim` (0–90): tema renginin görsel üzerindeki yoğunluğu; koyu/yoğun desenler için daha yüksek bir değer seçin.

## Kenar çubuğu

Kenar çubuğu varsayılan olarak ekranın **sağındadır** (masaüstünde **Ayarlar → Genel → Kenar çubuğu → Menü solda** açılırsa sola geçer; bu ayar mobil/dar görünümde görünmez ve etkisizdir): masaüstünde içeriğin sağında kalıcı bir sütun, telefon/dar ekran/yatay telefonda hamburger düğmesine (başlığın sağ ucunda) basınca **sağ kenardan kayarak
açılan çekmece**. (DOM'da da `main`'den sonra gelir; Tab sırası görsel sırayla aynıdır.) Masaüstünde sağ-alttaki bildirimler kenar çubuğunun soluna oturur ve daraltılmış genişliği izler.

**Sayfa kenar boşluğu her kenarda aynıdır** (`--page-pad`, 12 px): içerik panelleri ile kenar çubuğu ekranın sağ/sol/üst/alt kenarından, ayrıca birbirinden aynı uzaklıktadır (masaüstünde kenar çubuğunun alt kenarı da alttaki panellerle hizalıdır);
telefonda çekmece de aynı boşlukla açılır.

Üstte **Hızlı komut** (komut paleti, `Ctrl + K`) ve **Ara** (etkinlik arama paneli, `/`), ardından görünümler ve mini
takvim yer alır. Görünümler yukarıdan aşağıya **Dashboard, Yıl, Ay, Hafta, Gün, Scheduler, Timeline, Gantt, Kanban** sırasındadır (**Yıl, Ay'ın hemen üstünde**); klavye kısayolları menü sırasından bağımsızdır ve değişmez
(`1` Dashboard · `2` Ay … `8` Kanban · `9` Yıl); menüdeki rozet ve ipucu gerçek kısayolu gösterir (ör. Yıl → 9). Mini takvimin solunda **ISO 8601 hafta numaraları** vardır (sütun başlığı **H**; satırın 4. günü
hangi ISO haftasındaysa o numara — "Haftanın başladığı gün" ayarından bağımsız ISO'dur); numaraya tıklamak o haftayı **Hafta** görünümünde açar (mobil çekmecede de çalışır). Liste kaydırılabilir (kaydırma çubuğu gizli). En altta sabit duran **Ayarlar** düğmesinin sağında
uygulamanın sürüm numarası görünür.

**Hızlı komut** düğmesi yalnızca palet **açıkken** vurgulu görünür (kapalıyken diğer öğeler gibi normaldir).

**Hızlı komut** paletinde Kanban'dan sonraki komutlardan gruplanabilenler açılıp kapanabilen gruplarda toplanır (**Veri**, **Tema**, **Arka plan**;
başlığa tıklayın veya `Enter` / `→` `←`). Arama yazınca gruplar yok sayılır, eşleşen komutlar düz listelenir. Yeni bir grup için `src/main.js` içindeki
`PALETTE_GROUPS` listesine ekleyip komutlara `group: '<id>'` verin.

**Arama paneli** başlık, açıklama ve kategoride arar (birden fazla kelime → hepsi eşleşmeli), eşleşmeleri vurgular;
Yaklaşan / Tümü / Geçmiş ve durum filtreleri vardır. Tekrarlayan etkinlikler bir sonraki tekrarıyla tek satırda görünür.
Bir sonuca tıklamak (veya ↑/↓ + Enter) takvimi o güne götürür ve etkinliği düzenleyicide açar.

**Ayarlar** paneli sekmelidir (`Ctrl + K` → "Ayarlar"); yeni ayarlar ilgili sekmeye eklenir (`src/components/settingsPanel.js` → `TABS`):

| Sekme | İçerik |
|-------|--------|
| Görünüm | Tema, arka plan (Standart / Renk / kendi görselin), yerleşim |
| Takvim | Çalışma günleri, çalışma dışı günleri göster/gizle |
| Genel | Kenar çubuğu: ikon modu, **menü solda** (yalnız masaüstü); hatırlatmalar |
| Veri | **Bulut eşitleme (Google Drive)**; JSON (yedek) ve ICS (Outlook/Gmail uyumlu takvim dosyası) dışa / içe aktarma, tüm verileri sıfırlama |
| Hakkında | Sürüm bilgisi |

## Açıklamada Markdown

Etkinlik açıklaması Markdown ile yazılır ve **canlı önizleme** ile gösterilir (Obsidian tarzı). Editör **tek parça bir metin düzenleyicidir** (CodeMirror 6): **satırlar arası seçim ve
seçim tutamakları**, imleç/klavye, mobil klavye (IME), kopyala-yapıştır ve **geri al / yinele satırlar arası da** yerel olarak çalışır.

- **Canlı önizleme yalnızca görünümdür**; metin her zaman ham Markdown olarak saklanır. İmlecin/seçimin değdiği satırlar **ham** (işaretleriyle: `**kalın**`, `## başlık`, `- madde`), **diğer
  satırlar işlenmiş** görünür: başlıklar büyür, maddeler `•` olur, bağlantılar tıklanır, görev kutuları işaretlenir. Bir satıra dokunmak/tıklamak onu ham hale geçirir; editörden çıkınca hepsi
  işlenmiş görünür. Fareyle/klavyeyle seçilen tüm satırlar ham açılır.
- **Dokunmatik cihazlarda** (`pointer: coarse`) seçim sürerken (tutamaklar sürüklenirken) satırların ham/işlenmiş durumu **dondurulur**; seçim boşalınca, metin değişince ya da odak değişince yenilenir.
  Amaç: tutamak sürüklenirken görünümü değiştirmenin Android'de tutamağı bırakmasına yol açmasını önlemek. (Gerçek telefon tutamakları otomasyonla sürülemez; bu önlem emülasyonda doğrulanmıştır.)
- **Biçimlendirme araç çubuğu notun İÇİNDE, üstte durur** (CodeMirror paneli, `dock = top`): kutunun kenarlığıyla bir bütündür ve içerik kutu içinde kayarken sabit kalır.
  Düğmeler: kalın, italik, üstü çizili, kod, bağlantı, başlık, madde / numaralı / görev listesi, alıntı (`Ctrl/⌘ + B` ve `+ I`).
  Seçim varsa **seçime ve seçili tüm satırlara** uygulanır (birden çok satırı tek seferde listeye çevirmek dahil). **Seçim yokken de anlamlı çalışır**: imleç bir **kelimedeyse kelime sarılır**
  (`mer|haba` → `**merhaba**`; zaten sarılıysa açılır) ve imleç yerinde kalır; **boşluktaysa** `**|**` gibi boş bir çift bırakılır, imleç ortasındadır ve yazdıkça biçimli yazılır
  (boş çiftin içinde tekrar basmak çifti kaldırır). Yer tutucu metin (`kalın`) eklenmez. Bağlantıda kelime etiket olur ve adres seçilir; başlık/liste/görev/alıntı imlecin satırına uygulanır —
  **satırda karakter olmasa da**: boş satırda madde `- `, numaralı `1. `, görev `- [ ] `, alıntı `> `, başlık `## ` eklenir ve imleç önekin sonuna gelir (öneke tekrar basmak kaldırır, başka türe basmak türü değiştirir).
  Editör hiç odaklanmadıysa (ilk açılış) biçim metnin sonuna uygulanır. Mantık: `formatAtCaret` (`src/core/markdown.js`, saf ve testli).
- Kutunun **sağ alt köşesindeki tutamak** sürüklenerek (fare/dokunma) ya da `↑` `↓` ile kutuyu **büyütüp küçültür** (en az 140 px: araç çubuğu dahil; çift tıklama otomatik yüksekliğe döner; yükseklik
  sabitlenince uzun metin kutu içinde kayar). Köşedeki düğme açıklamayı **tam ekranda** düzenletir. Kanban kartı ve arama özetlerinde işaretler gizlenir.
- Açıklama (ve tam ekran düzenleyici) **ilk açıldığında hiçbir satır ham değildir** ve klavye açılmaz (editör odakta değilken tüm satırlar işlenmiş görünür). Düzenlemek için dokunulur.
- **Görev listesi** (`- [ ]` / `- [x]`): onay kutusu satırın **dikeyde ortasındadır** (çok satırlı görevde de); tamamlanan görevin metni **üstü çizili ve soluk** görünür.

| Tuş / eylem | Davranış |
|-------------|----------|
| `Enter` | Liste (`-`, `1.`, `- [ ]`) ve alıntı (`>`) işareti yeni satıra sürer (numara artar); **boş öğede** `Enter` listeyi bitirir |
| Fare/parmak sürükleme, `Shift + ↑ ↓ ← →` | Yerel seçim; **alt satırlara** genişler |
| `Ctrl/⌘ + A` | Tüm metni seçer |
| `Ctrl/⌘ + Z`, `Ctrl + Y` / `Ctrl + Shift + Z` | Geri al / yinele (satırlar arası da) |
| Görev kutusuna tıklama | `[ ]` ↔ `[x]` değiştirir; satırı ham hale getirmez |
| İşlenmiş bağlantıya tıklama | Yeni sekmede açar (yalnızca `http(s)`/`mailto`); düzenlemek için satırın başka bir yerine tıklanır |
| `Esc` / `Ctrl/⌘ + Enter` | Pencereyi kapatır / formu kaydeder (editör bu tuşları yutmaz) |
| `Tab` | Normal sekme sırası (girinti eklemez) |

Uygulama: `src/components/markdownEditor.js` (arayüz, Enter, araç çubuğu, yükseklik tutamağı), `src/components/markdownLive.js` (canlı önizleme: hangi aralığın gizleneceğini söyleyen saf
`planLive` + güvenli parçacıklar) ve `src/core/markdown.js` (`listContinuation`, `lineContentStart`, `applyFormat`, `stripMarkdown`; saf ve testli).

| Yazım | Sonuç |
|-------|-------|
| `# Başlık` … `###### Başlık` | Başlıklar |
| `**kalın**` `*italik*` `~~çizili~~` `` `kod` `` | Satır içi biçimler |
| `[metin](https://…)`, çıplak `https://…` adresleri | Bağlantı (yeni sekmede, `noopener noreferrer`) |
| `- madde`, `1. madde`, iç içe girintili | Listeler |
| `- [ ] yapılacak`, `- [x] bitti` | Görev listesi (önizlemede işaret kutusu) |
| `> alıntı`, `---`, ` ``` ` kod bloğu | Alıntı, çizgi, kod bloğu |

**Güvenlik:** metin hiçbir zaman HTML olarak yorumlanmaz. Editör yalnızca düz metin düğümleri ve sabit parçacıklar (madde işareti, görev kutusu, çizgi) çizer; ham HTML (`<script>`,
`<img onerror>` …) yazıldığı gibi **metin olarak** görünür (gerçek tarayıcıda sınanır). Bağlantı adresi `data-href` özniteliğinde taşınır ve yalnızca `http(s)` ile `mailto` açılır
(`safeHref`; `javascript:`, `data:` reddedilir). `tests/markdown-live.test.js` bu vektörleri sınar. `core/markdown.js` içindeki `renderMarkdown` (kaçır-önce, izinli etiket) güvenli bir
HTML çıktısı üretir ve testlidir, ancak şu an arayüzde kullanılmaz (canlı önizleme CodeMirror üzerindedir).
Satır sonları korunur (not tutma alışkanlığı için tek satır sonu da yeni satırdır). Başka uygulamalara aktarılan ICS dosyalarında açıklama ham Markdown olarak görünür.

## Etkinlik rengi

Renk alanı (`src/components/colorPicker.js`) **daraltılabilirdir**:

- **Kapalıyken tek satır, yuvarlak**: uygulamanın klasik 8 etkinlik rengi ve sonunda aç/kapa düğmesi (▾). Seçili renk bu 8'den biri değilse (paletten veya özel seçilmişse)
  satıra **ek bir yuvarlak** olarak eklenir; böylece seçim kapalıyken de görünür. Satır dar ekranda da (360 px) alt satıra geçmez, yuvarlaklar küçülür.
- **Açılınca**: **12 ton × 3 yoğunluk** (Açık / Canlı / Koyu) yuvarlaklık palet ve **özel renk**: renk seçici (sistem paleti) ve hex alanı (`#abc`, `aabbcc` …);
  seçili rengin adı ("Mavi · Canlı" / "Özel renk") yazılır. Telefonda palet 6 sütundur.
- Palet elle yazılmaz, taban renklerden üretilir (`src/core/colors.js` → `PALETTE_HUES`, `PALETTE_TONES`); "Canlı" satırı klasik renkleri içerir.
  Renkler radyo düğmeleridir: ok tuşlarıyla gezilir, seçili renk halka ve onay işaretiyle gösterilir.

## Etkinlik sayfası

Etkinlik (yeni veya düzenleme) **tam sayfa** açılır (`modal--page`): ekranı kaplar, içerik en çok 760 px'lik ortalanmış bir sütundadır, gövde kayar,
Kaydet / İptal / Sil çubuğu altta sabittir. `Esc` kapatır; açıklamanın tam ekran düzenleyicisi bunun üstüne ayrı bir pencere olarak açılır.

**Çıkarken sorar:** kaydedilmemiş değişiklik varsa `Esc`, ✕ ya da **İptal** ile çıkmak **"Değişiklikler kaydedilsin mi?"** diye sorar: **Kaydet** (kaydeder ve kapatır; ad boşsa pencere açık kalır ve ad kutusu
işaretlenir), **Kaydetme** (değişiklikleri atar ve kapatır), **Vazgeç** (düzenlemeye devam). Karşılaştırma formun açılıştaki anlık görüntüsüne göredir: bir değişiklik geri alınırsa (başlangıç hâline dönülürse)
**sorulmaz**; kapsam seçimi (Yalnızca bu / Tüm seri) tek başına değişiklik sayılmaz; tam ekran açıklamada yazılanlar da sayılır. Kaydet ve Sil doğrudan kapatır, sormaz. Ek dosyalar (mevcut etkinlikte) anında
kaydedildiği için bu denetime dahil değildir. Altyapı: `openModal({ canClose })` ve `modal.requestClose()` (`src/components/modal.js`).

**Başlangıç–bitiş saat bağı:** Başlangıç ve bitiş alanları arasındaki **zincir düğmesi** (geniş ekranda iki grubun arasında, dar ekranda iki saat kutusunun sağında; yalnızca saatli etkinlikte görünür) başlangıç ile bitişi
birbirine bağlar. Bağ **açıkken** başlangıç tarihi ya da saati değiştikçe bitiş, aradaki **süre korunacak** biçimde birlikte kayar: 09:00–10:00 iken başlangıç 14:00 olunca bitiş 15:00 olur; gece yarısını aşarsa
bitiş tarihi ertesi güne geçer (23:00 → 01:30), geri dönünce iner; çok günlü bir aralık başlangıç kayınca aynı uzunlukta kalır. Düğmeye basınca bağ **kopar** (kopuk zincir simgesi): iki uç bağımsız düzenlenir
(yalnızca bitiş başlangıçtan önceye düşemez). Yeniden bağlanınca o anki fark korunacak süre olur; bitişi elle değiştirmek de süreyi günceller. Bağ **etkinliğe her girişte açıktır** (kalıcı bir ayar değildir) ve
tek başına "değişiklik" sayılmaz. Mantık: `shiftEnd` (`src/core/dateUtils.js`, saf ve testli).

### Tekrarlayan etkinlikler

Formun **Tekrar** bölümünde sıklık (Günlük · Haftalık · Aylık · **Çeyreklik** · Yıllık), "her N …" aralığı, **desen**, bitiş ve **Tüm tarihler** listesi vardır
(arayüz: `src/components/recurrenceEditor.js`, hesap: `src/services/recurrenceService.js`). Sıklığa göre desen:

| Sıklık | Seçilebilenler |
|--------|----------------|
| Günlük | Hangi günler: **Her gün**, **İş günleri** (Ayarlar'daki çalışma günleri) ya da istediğiniz günler (Pzt … Paz düğmeleri). "2 günde bir + yalnızca iş günleri" de olur |
| Haftalık | Haftanın **birden çok günü** (ör. Salı + Perşembe); hiçbiri seçilmezse başlangıç günü. Başlangıç tarihi değişirse otomatik gün de değişir |
| Aylık | **Ayın N. günü** (1–31 ya da *Son gün*) **veya** **ayın N. haftasının X günü**: ilk / ikinci / üçüncü / dördüncü / son × Pazartesi … Pazar ya da **iş günü** (ör. "ayın son iş günü", "ayın ilk Salısı") |
| Çeyreklik | **Çeyreğin 1. / 2. / 3. ayı** (Oca·Nis·Tem·Eki …) + aylıktaki gün/hafta deseni. Aralık "çeyrek" cinsindendir (2 → altı ayda bir) |
| Yıllık | **Ay** + aylıktaki gün/hafta deseni (ör. "Mart'ın ilk Pazartesisi") |

- **Bitiş:** yok · belirli tarihte · belirli sayıda tekrar. Seçimler canlı bir **özet** cümlesine yansır ("Her çeyrek · çeyreğin 2. ayı · ayın son iş günü").
- Ayın 29–31'i seçilirse, o günü olmayan ayda **ayın son günü** kullanılır; "5. hafta" olmayan aylar atlanır. Başlangıç tarihi desene uymuyorsa (ör. Pazartesi başlayıp "Sal–Per") ilk örnek ondan sonraki ilk uygun gündür.
- **Tüm tarihler** (açılır liste, başlıkta sayı): kuralın ürettiği tarihler (sonsuz serilerde 24'er 24'er, "Daha fazla göster") tek tek **değiştirilebilir** (başka güne alınır), **silinebilir** (üstü çizilir; **Geri al**) ve altındaki
  **Tarih ekle** ile yeni tarih **eklenebilir**. Eklenenler "Eklendi", "Yalnızca bu" ile ayrı düzenlenmiş örnekler "Ayrı düzenlendi" etiketi taşır. Bunlar kuralın `exdates` / `rdates` alanlarına yazılır; kural sonradan
  değiştirilse de silinen/eklenen tarihler korunur. Silinmiş bir tarihi tekrar eklemek onu geri getirir. Bir tarihin **saatini ya da içeriğini** değiştirmek için o tarihteki etkinlik açılıp "Yalnızca bu" seçilir.
- Satırda tarih düzenlenirken `Enter` onaylar, `Esc` yalnızca satır düzenlemesini kapatır (pencereyi kapatmaz). Tekrar bölümü ve liste yalnızca "Tüm seri" kapsamında görünür; değişiklikler "kaydedilmemiş değişiklik" denetimine dahildir.
- Eski seriler (desen alanı olmayan) aynen çalışır ve açılıp kapatılınca değişmez.

**Başlık:** sayfanın başlığında etkinliğin **kendi adı** görünür ("Etkinliği düzenle" yazmaz). Ad düz metin gibi durur, **dokununca metin kutusuna dönüşür**
(zemin + vurgu kenarlığı); uzunsa **üç nokta** ile kısalır (tamamı ipucu olarak görünür). Yeni etkinlikte ad boştur, "Yeni etkinlik" ipucu görünür ve kutu açılışta odaklıdır;
düzenlemede hiçbir alan kendiliğinden odaklanmaz (telefonda klavye açılmaz). Adda `Enter` veya `Ctrl/⌘ + Enter` kaydeder. Ad girdisi formun dışında (başlıkta) durduğu için
`form="event-form"` özniteliğiyle forma bağlanır.

## Mobil düzen

Ekran genişliği **900 px ve altındayken** (telefon, dikey tablet):

- Başlığın eylem satırı tam genişlikte ve **sola dayalıdır**; Geri / Bugün / İleri bloğu (`.toolbar-nav`) her zaman en başta durur. Bugün düğmesi
  bugünün tarihini gösterir ("Bugün: 15.Kas").
- Başlıktaki "Yeni" düğmesi gizlenir; yerine sağ altta yüzen, yuvarlak ve büyük (56 px) bir **yeni etkinlik düğmesi** (FAB) gösterilir (`src/main.js`, `.fab`).
  Bildirimler düğmenin üstünde çıkar; sayfa altında düğme için ayrı bir boşluk yoktur (bkz. "Sayfa altı"). `N` kısayolu aynen çalışır.
  Düğme **biraz saydamdır** (%82) ve gölgesizdir; **basılırken ya da taşınırken rengi/opaklığı değişmez** (basınca yalnızca küçülür, taşırken büyür; tarayıcının dokunma vurgusu kapalıdır). **Basılı tutup** (≈0,4 sn; hafif titreşim, düğme büyür) **dikey eksende** sürükleyerek yeri değiştirilir;
  yatay konum sağ kenarda sabittir. Alt kenardan en az 16 px, üstten başlığa 72 px yer bırakılır. Konum `settings.fabBottom` olarak saklanır (dışa/içe aktarmaya dahildir),
  yeniden açılışta ve ekran döndürmede korunur. Basılı tutmadan önce parmak kayarsa taşıma başlamaz; taşımadan sonra yeni etkinlik açılmaz (`src/components/fab.js`).
- **Hayalet tıklama koruması** (`src/core/ghostClick.js`): dokunmatik ekranda bir etkinliğe dokunulunca tarayıcı, parmak kalkınca aynı noktaya sahte fare olayları gönderir.
  Pencere `pointerup` anında açıldığından bu olaylar açılan pencerenin o noktadaki öğesini tetikliyordu (ör. açıklamada satır kendiliğinden ham olur, bitiş tarihi kutusu odaklanır).
  Son dokunuşun yeri ve zamanı izlenir; pencere hemen ardından açılırsa o noktadaki (14 px) sahte fare olayları ≈0,7 sn yutulur. Gerçek fare tıklamaları ve başka bir noktaya
  yapılan dokunuşlar etkilenmez.
- Ay görünümündeki etkinlik çubuğunun **Sil** düğmesi yalnızca gerçek hover'lı aygıtlarda (`@media (hover: hover)`) görünür; dokunmatikte ilk dokunuşun bıraktığı "yapışkan hover" artık
  düğmeyi parmağın altında açmaz.
- Ay ve Hafta başlığındaki **Tüm günler / Çalışma günleri** düğmesi eylem satırının sağ ucuna dayanır (`.offdays-toggle`).
- Gantt'ta S-M-L solda kalır; **Kritik yol** ve sağındaki düğme eylem satırının sağ ucuna dayanır (`.gantt-push`).
- **Hamburger düğmesi başlığın sağ ucundadır** (dikey düzende başlığın yanında, ilk satırın sağında; yatay kompakt şeritte eylemlerden sonra, en sağda). Kenar çubuğunu çekmece olarak açar;
  kapatma: ✕, perdeye dokunma, `Esc`, menüden sayfa seçme. Sayfa adı büyüktür (24 px); başlık paneli yüksekliği hamburger solda olduğu hâldeki ile birebir aynıdır
  (5 boyut × 8 görünüm ölçülerek karşılaştırıldı): ad satır yüksekliği sabit (27 px) ve uzun adlar üç noktayla kısalır.
- Timeline'da Yaklaşan / Tümü / Geçmiş filtresi ve arama alanı başlıktadır (eylem satırında, sola dayalı).

**Yatay telefon / kısa ekran (yükseklik ≤ 500 px)**: telefon yan çevrilince genişlik 900 px'i aşsa bile ekran kısadır; sabit kenar çubuğu ve uzun başlık içeriğe yalnızca ~225 px bırakırdı.
Bu yüzden yukarıdaki **mobil kabuk** (kenar çubuğu çekmeceye iner + sağ uçta hamburger, yüzen düğme) genişliğe **ya da** kısa yüksekliğe bağlıdır (`@media (max-width: 900px), (max-height: 500px)`).
Genişliğe özgü içerik kuralları (Kanban sütun genişliği, form sütunları) yalnızca genişliğe bağlı kalır. Kısa ekranda ayrıca:
- Başlık, sayfa adı + eylemler + hamburger **tek satırlık kompakt bir şerit** olur (hamburger en sağda) (127 → **50 px**; 8 sayfada aynı yükseklik), altyazı gizlenir. Çok düğmeli sayfalarda dar ekranda (≈≤670 px;
  ör. Planlayıcı) eylemler gerekirse alt satıra sarar.
- Ay ızgarası satırları 96 → 60 px'e, zaman ızgarasının gün başlığı da sıkılaşır (ekranda ~2 yerine ~4,5 hafta satırı görünür).
- Dikey telefon, tablet ve masaüstü düzenleri değişmez (ölçülerek doğrulandı). Masaüstünde pencere 500 px'in altına kısaltılırsa da aynı kabuk devreye girer.
- Masaüstünde (>900 px) başlık eskisi gibidir: eylemler sağda, "Yeni" başlıktadır.

## Takvim dosyası (ICS)

**Ayarlar → Veri → ICS dışa aktar / içe aktar** (veya `Ctrl + K` → "Export/Import Calendar (ICS)") ile etkinlikler
standart `.ics` dosyası olarak Outlook, Gmail (Google Takvim), Apple Takvim ve benzerleriyle paylaşılır.
Gmail'de *Ayarlar → İçe aktar ve dışa aktar*, Outlook'ta *Takvim ekle → Dosyadan yükle* ile içe aktarılır.
Bu **tek seferlik bir aktarımdır**, iki yönlü senkron değildir. Mantık `src/services/icsService.js` içindedir (DOM'suz, `tests/ics.test.js` ile test edilir).

| Alan | Dışa aktarma | İçe aktarma |
|------|--------------|-------------|
| Başlık, açıklama, kategori | `SUMMARY`, `DESCRIPTION`, `CATEGORIES` | Aynı; kategori olarak yalnızca ilki alınır |
| Tarih / saat | Saatler **saat dilimsiz** (floating) yazılır; takvimin saat dilimine göre yorumlanır. Tüm gün: `VALUE=DATE`, bitiş ertesi gün | UTC (`Z`), IANA (`Europe/Istanbul`) ve Outlook'un Windows adları (`Turkey Standard Time`) yerel saate çevrilir. Tanınmayan dilim yerel saat sayılır ve bildirilir |
| Tekrar | `RRULE` (günlük/haftalık/aylık/yıllık, aralık, adet, bitiş; `BYDAY`, `BYMONTHDAY`, `BYMONTH`, `BYSETPOS` desenleri; çeyreklik = `FREQ=MONTHLY;INTERVAL=3N`) + `EXDATE` (silinen tarihler) + `RDATE` (eklenen tarihler). `DTSTART` kuralın ürettiği **ilk tarihtir** | Aynı kurallar; aşağıdaki sınırlamalara bakın |
| Tek örnek değişikliği | Aynı UID + `RECURRENCE-ID` ile ayrı `VEVENT` | Seriye bağlanır ("Seriye geri döndür" çalışır) |
| Hatırlatma | `VALARM` (5/15/60 dk) | Alarm en yakın 5/15/60 dakikaya yuvarlanır |
| Durum, ilerleme, renk, kritik, Gantt projesi, bağımlılık | `X-CALENDAR-PRO-*` (proje: `X-CALENDAR-PRO-PROJECT`) ve `RELATED-TO;RELTYPE=DEPENDS-ON`; diğer uygulamalar yok sayar | Yalnızca bu uygulamanın dışa aktarımında geri yüklenir |

İçe aktarma davranışı:

- **Silme yapmaz**; aynı UID'li kayıt güncellenir, yenisi eklenir. Aynı dosya tekrar yüklenirse etkinlikler çoğalmaz.
  Güncellenen kayıtlarda dosyada bulunmayan uygulama alanları (durum, ilerleme, renk, kritik, bağımlılık) korunur.
- Bildirimdeki **Geri al** yeni eklenenleri siler, güncellenenleri eski haline getirir.
- Yabancı bir dosyadan gelen ve geçmişte kalan etkinlikler **Tamamlandı** olarak eklenir; aksi halde hepsi Dashboard'da "geciken" sayılırdı.
- İptal edilmiş (`STATUS:CANCELLED`) etkinlikler atlanır.
- Dosya boyutu en fazla 20 MB.

**Tekrar kuralları:** `FREQ` / `INTERVAL` / `COUNT` / `UNTIL`, günlük/haftalık `BYDAY` listeleri (`BYDAY=MO,WE,FR`), aylık/yıllık `BYMONTHDAY`
(tek gün ya da `-1` = son gün), "ayın N. haftasının X günü" (`BYDAY=2TU`, `-1FR`), "ayın N. iş günü" (`BYDAY=MO,TU,WE,TH,FR;BYSETPOS=N`), yıllıkta `BYMONTH`
ve `FREQ=YEARLY;BYMONTH=1,4,7,10` (çeyreklik) ile `RDATE` desteklenir. **Desteklenmeyenler** (`BYYEARDAY`, ayda her salı, birden çok `BYMONTHDAY` gibi) **yalnızca ilk örnek**
olarak eklenir ve içe aktarma bildiriminde sayısı belirtilir. Ayın 29–31'i: uygulamada kısa aylarda ayın son gününe kayar; ICS'te 31 `BYMONTHDAY=-1` olarak yazılır,
29/30 ise o günü olmayan ayları atlayan `BYMONTHDAY=N` olur. Ekler (attachments) ICS'e dahil edilmez.

## Bulut eşitleme (Google Drive)

Cihazlar arası eşitleme **Ayarlar → Veri → Bulut eşitleme** bölümündendir (ya da `Ctrl + K` → "Google Drive Eşitlemesi…" / bağlıyken "Şimdi Eşitle"). **Google Drive'a bağlan**'a basıp Google izni verilince bu cihazdaki veriler
Drive'a gider; aynı hesapla bağlanan her cihaz aynı veriyi görür. Uygulamanın kendi sunucusu yoktur: eşitleme doğrudan tarayıcıdan **sizin Drive'ınıza** yapılır.

**Ne eşitlenir:** etkinlikler (tekrarlar, bağımlılıklar, Gantt projesi, durum… dahil), **ekler** (10 MB'a kadar; 4 MB üstü Drive'a devam ettirilebilir yüklemeyle gider) ve bazı ayarlar: tema, çalışma günleri, çalışma dışı günleri göster, tatiller ve
**tatil grupları**, haftanın başlangıcı, varsayılan hatırlatma. **Eşitlenmez:** arka plan/kendi görselleriniz, kenar çubuğu ve Menü solda, yüzen düğme konumu, görünüm yakınlaştırmaları ve daraltma durumları, bildirim izni (cihaza özel) ve **örnek (demo) etkinlikler**
(bir cihazda hiç dokunulmadıysa hiçbir zaman eşitlenmez; yeni bir cihaz buluttaki veriye ilk bağlandığında kendi örnek verileri atılır, siz birini düzenlediyseniz gerçek veri sayılır ve korunur).

**Gizlilik:** yalnızca Google'ın `drive.appdata` izni istenir: dosyalar Drive'ınızdaki **bu uygulamaya ait gizli klasörde** durur, Drive arayüzünde görünmez ve uygulamanın başka hiçbir Drive dosyanıza erişimi yoktur (kota Drive'ınızdan düşer).
Erişim belirteci yalnızca bellekte tutulur. **Bağlantıyı kes** erişimi Google tarafında da iptal eder; **Bulut verisini sil** Drive'daki tüm eşitleme dosyalarını siler ve bağlantıyı keser (yerel veriye dokunulmaz).
Google betiği yalnızca Bulut eşitleme bölümü görüntülendiğinde ya da bağlıyken yüklenir; eşitleme kullanmayan biri Google'a hiç istek yapmaz.

**Nasıl çalışır:** Drive'daki gizli klasörde `sync.json` (etkinlikler, silme izleri, ek listesi, ayarlar) ve her ek için `att-<kimlik>` dosyası bulunur. Bir tur: Drive'daki dosyalar okunur → yerel veriyle birleştirilir → farklar yerele uygulanır → yeni ekler yüklenir →
değiştiyse `sync.json` yazılır. Tetikleyiciler: bağlanınca, uygulama açılınca, bir değişiklikten ~5 sn sonra (etkinlik/ek/eşitlenen ayar), sekme yeniden görününce (son eşitleme 1 dakikadan eskiyse), internet gelince, her 5 dakikada bir ve elle "Şimdi eşitle". Yazma yalnızca bir şey değiştiyse yapılır.

**Birleştirme kuralları** (saf ve testli: `src/services/sync/syncCore.js`):
- **Aynı etkinlik iki cihazda değiştirildiyse en son değişiklik kazanır** (etkinlik başına; alan düzeyinde birleştirme yok). Bu yüzden cihaz saatlerinin doğru olması gerekir; saati çok sapmış bir cihazın değişiklikleri haksız yere kazanabilir.
- **Silmeler eşitlenir** ve geri gelmez: silinen etkinlik/ek için iz (tombstone) tutulur; iz, silmeden SONRA başka cihazda yapılan bir düzenlemeyle (ya da "Geri al"la) geçersiz kılınır. İzler 120 gün sonra budanır: bundan uzun süre hiç eşitlenmeyen bir cihaz,
  silinmiş etkinlikleri geri getirebilir.
- Ekler değişmezdir (yalnızca eklenir/silinir); etkinliği silinen etkinliğin ekleri de silinir.
- Ayarlarda anahtar başına son değişiklik kazanır. Bağlanan yeni cihazda daha önce değiştirilmemiş (zaman damgasız) ayarlar buluttakiyle değişir.
- Bulutta karşılaştır-ve-yaz yoktur: iki cihaz aynı anda yazarsa biri diğerinin üzerine yazabilir, ama her cihaz kendi değişikliğini yerelde tuttuğu için bir sonraki turda birleştirme bunları yeniden buluta taşır (sonunda tutarlı). Aynı anda oluşan iki `sync.json` birleştirilip tek dosyaya indirilir.
- Aynı cihazda birden çok sekme/pencere (tarayıcı + yüklü uygulama) olabilir: tur Web Locks ile tek yapılır, bir sekme eşitleyince diğerleri ekranını/durumunu kendiliğinden yeniler (BroadcastChannel) ve silme izleri sekmeler arası ezilmez.

**Durumlar** (Ayarlar'daki rozet): *Eşitlendi · tarih*, *Eşitleniyor…* (ek ilerlemesiyle), *Çevrimdışı — internet gelince eşitlenir* (hata değildir; yerel veri güvende), *Yeniden bağlanmanız gerekiyor* ve *Hata: …*.
Erişim belirteci yaklaşık 1 saat geçerlidir; süre dolunca sessizce yenilenir. Tarayıcı açılır pencereyi kullanıcı hareketi olmadan engellerse durum "Yeniden bağlanmanız gerekiyor" olur, bir uyarı ("Yeniden bağlan") çıkar ve otomatik denemeler
durur; **Yeniden bağlan**'a (ya da Şimdi eşitle'ye) basmanız yeter. Buluttaki dosya bu uygulamadan DAHA YENİ bir şema sürümüyle yazılmışsa eşitleme hata verir ve buluttaki veriye dokunmaz (uygulamayı güncelleyin).
**Tüm verileri sıfırla** eşitleme bağlantısını da keser (buluttaki kopya silinmez; yeniden bağlanırsanız veriler geri iner).

**Kurulum (uygulamayı yayınlayan kişi için):** Google Cloud Console'da bir **Web uygulaması** OAuth istemci kimliği oluşturulur ve `src/services/sync/config.js` içindeki `GOOGLE_CLIENT_ID`'ye yazılır (ya da derlerken `VITE_GOOGLE_CLIENT_ID` verilir).
İstemci kimliği gizli değildir. Gerekli ayarlar: **Yetkili JavaScript kaynakları** = yayın adresi (`https://serkanblt.github.io`) ve geliştirmede `http://localhost:5173`; OAuth onay ekranında `…/auth/drive.appdata` kapsamı eklenir; uygulama "Test"
durumundaysa kullanıcılar **Test kullanıcıları** listesine eklenmelidir (ya da yayına alınır: yalnızca hassas olmayan kapsam istendiği için Google doğrulaması gerekmez). Kod: `src/services/syncService.js` (orkestrasyon), `sync/driveClient.js`
(Google oturumu + Drive REST), `sync/syncCore.js` (saf birleştirme), `sync/syncState.js` (yerel durum ve silme izleri).

## Verileri sıfırlama

**Ayarlar → Veri → Tüm verileri sıfırla** (veya `Ctrl + K` → "Reset All Data…") uygulamayı ilk kurulum haline döndürür.
Önce bir onay penceresi açılır:

- **Yedek al ve sıfırla** (varsayılan): önce JSON yedeği indirilir, ardından sıfırlanır. Yedek alınamazsa hiçbir şey silinmez.
- **Yedeksiz sıfırla**: doğrudan sıfırlar.
- **Vazgeç**: hiçbir şey değişmez.

Silinenler: etkinlikler, ekler, gönderilmiş hatırlatma kayıtları, kendi arka plan görselleri ve tüm ayarlar (tema, çalışma günleri, kenar çubuğu
vb. varsayılana döner). Veritabanı tek transaction'da temizlenir, yarım kalmaz. Sıfırlanmış uygulama **boş** açılır; ilk açılıştaki örnek veriler
geri yüklenmez. İşlem geri alınamaz; JSON yedeği etkinlikleri ve ayarları içerir, ekler ve kendi arka plan görselleri yedeğe girmez.
**Bulut eşitleme bağlıysa** bağlantı da kesilir; buluttaki kopyaya dokunulmaz.
Mantık `src/services/resetService.js` içindedir.

## Sürümler

Sürüm numarası `package.json` → `version` alanından gelir ve derleme sırasında uygulamaya yerleştirilir
(`src/core/version.js`). Semver kullanılır: yeni özellik → MINOR, hata düzeltmesi → PATCH, uyumsuz değişiklik → MAJOR.
Her yayında `CHANGELOG.md` güncellenir ve `public/service-worker.js` içindeki `VERSION` da aynı numaraya getirilir
(eski önbellekler temizlenir).

**Yeni sürüm bildirimi:** yeni bir sürüm yüklendiğinde uygulama "Yeni sürüm hazır" mesajını ve **Yenile** düğmesini gösterir
(`src/services/updateService.js`). Service worker `skipWaiting` + `clients.claim` ile hemen devreye girer; açık sayfa eski kodla
çalıştığı için, denetimi devralan worker'a sürümü sorulur ve sayfanın sürümünden farklıysa mesaj çıkar. Sayfa zaten en yeni
sürümle açıldıysa ve ilk kurulumda mesaj gösterilmez. Sayfa görünür olunca ve saatte bir `registration.update()` ile denetlenir.
Bu karşılaştırma `public/service-worker.js` → `VERSION` ile `package.json` sürümünün **aynı** olmasına dayanır (`npm test` denetler).
Sayfa kendiliğinden yenilenmez; Yenile'ye basılana kadar açık formlar korunur.

Kenar çubuğunun üstündeki **logoya** tıklamak (veya `[` tuşu) kenar çubuğunu ikon moduna daraltır: yalnızca ikonlar kalır,
mini takvim gizlenir ve takvime daha fazla alan açılır. İkonların üzerine gelince adları görünür. Tercih kaydedilir.
Telefonda menü her zaman tam genişlikte, sağdan açılır.

## Klavye kısayolları

| Kısayol | Eylem |
|---------|-------|
| `Ctrl/⌘ + K` | Hızlı komut (komut paleti) |
| `/` | Etkinlik arama paneli |
| `N` | Yeni etkinlik |
| `T` | Bugüne git |
| `←` / `→` | Önceki / sonraki dönem |
| `1`–`9` | Görünüm değiştir (1 Dashboard · 2 Ay · 3 Hafta · 4 Gün · 5 Scheduler · 6 Timeline · 7 Gantt · 8 Kanban · 9 Yıl); kısayollar menüdeki görünüm sırasından bağımsızdır |
| `[` | Kenar çubuğunu daralt / genişlet (logoya tıklamakla aynı) |
| `Ctrl + Enter` | Formu kaydet |
| `Esc` | Modal / palet kapat |

## Mimari

```
src/
  core/        state (store + bus), router (hash), db (IndexedDB), eventRepo, eventModel,
               settingsRepo, actions, theme, backgrounds, colors (renk paleti), markdown (güvenli Markdown), ghostClick, dateUtils, overlap,
               dom (güvenli şablon), utils, seed
  services/    recurrenceService, notificationService, exportService, icsService, resetService, updateService, criticalPathService, autoCloseService,
               ganttProjects, syncService (+ sync/: syncCore, syncState, driveClient, config — Google Drive eşitlemesi)
  components/  sidebar, commandPalette, modal, toast, eventCard, eventEditor, timeGrid,
               dragDrop, toolbar, icons, markdownEditor, markdownLive, colorPicker, fab
  views/       dashboard, month, week, day, scheduler, timeline, gantt, kanban
  styles/      theme, main, dashboard, calendar, scheduler, gantt, kanban
public/        manifest.json, service-worker.js, icons/
tests/         ICS, Markdown (XSS dahil), canlı önizleme planı, renk/palet, arayüz mantığı ve sürüm tutarlılığı testleri (node --test)
```

- **Tek yönlü veri akışı:** View → `ctx` / `actions` → `eventRepo` → IndexedDB + `store` → yeniden çizim.
- **Router** URL'yi (`#/view?date=YYYY-MM-DD`) tek doğruluk kaynağı olarak kullanır; yenileme ve geri tuşu çalışır.
- **View sözleşmesi:** her view `{ id, title, render(el, ctx) }` dışa aktarır; `render` isteğe bağlı bir temizleme fonksiyonu döner.
- **Güvenlik:** tüm HTML `html` etiketli şablonla üretilir ve değerler otomatik escape edilir; renkler regex ile doğrulanır.

### Veri modeli

IndexedDB store'ları: `events`, `settings`, `notifications`, `attachments`, `backgrounds`. `settings` satırları `{ key, value, updatedAt }`'tir (`updatedAt`: bulut eşitlemede anahtar başına son değişiklik kazansın diye); ayrılmış `sync:state` satırı bu cihazın
eşitleme durumunu (bağlı mı, cihaz kimliği, son eşitleme, silme izleri) tutar, ayarlara/yedeğe girmez.

```js
{ id, title, description, date, startDate, endDate, startTime, endTime, color, status,
  progress, category, project, critical, autoClose, recurrence, reminder, dependencies, createdAt, updatedAt }
```

- `startTime` boşsa etkinlik tüm gündür (formda "Tüm gün" açılınca bitiş tarihi başlangıca eşitlenir).
- `color`: paletten veya özel olarak seçilen herhangi bir `#rrggbb` (bkz. "Etkinlik rengi").
- `description`: ham Markdown metni olarak saklanır (bkz. "Açıklamada Markdown").
- `recurrence`: `{ freq: 'daily'|'weekly'|'monthly'|'quarterly'|'yearly', interval, until, count, exdates, … }` — yalnızca ana kayıt saklanır, tekrarlar görüntüleme anında üretilir.
  İsteğe bağlı alanlar (yalnızca anlamlıysa saklanır; eski kayıtlar değişmeden çalışır): `weekdays` (günlük/haftalık günler), `monthDay` (1–31 ya da -1 = son gün),
  `nth` + `weekday` (ayın N. haftasının X günü; `weekday`: 0–6 ya da `'work'` = iş günü), `quarterMonth` (çeyreğin 1./2./3. ayı), `month` (yıllık), `rdates` (elle eklenen tarihler).
  Sonuç = (kuralın tarihleri ∪ `rdates`) \ `exdates`. Mantık `src/services/recurrenceService.js` içindedir (saf, `tests/recurrence.test.js` ile test edilir).
- `seriesId` / `originalDate`: seriden ayrılıp tek başına düzenlenmiş örneğin bağlantısı.
- `reminder`: 0 / 5 / 15 / 60 dakika.
- `dependencies`: Gantt için öncül görev id'leri.
- `project`: "Gantt projesi" (serbest metin, en çok 80 karakter); Gantt'ı proje bazlı gruplar (bkz. "Proje bazlı Gantt"). Eski kayıtlarda yoktur (boş sayılır).
- `autoClose`: "Zamanı geçince otomatik kapat" (bkz. aşağıdaki bölüm). Eski kayıtlarda yoktur (kapalı sayılır).

## Otomatik kapat, sağ tık menüsü ve temalı açılır listeler

**Zamanı geçince otomatik kapat:** etkinlik formunda (Tüm gün / Bağ anahtarlarının yanında) **"Zamanı geçince otomatik kapat"** anahtarı vardır. Açıksa etkinliğin **bitiş zamanı** geçtiğinde durumu otomatik olarak
**Tamamlandı** (ilerleme %100) olur: saatli etkinlikte bitiş saati, tüm gün/çok günlü etkinlikte bitiş gününün sonu. Uygulama açılışında, her 30 saniyede bir ve sekme yeniden görününce denetlenir; kapananlar tek bir
bildirimle duyurulur. Zaten tamamlanmış etkinliğe dokunulmaz. **Tekrarlayan seriler** için seçenek kapalıdır (durum seri düzeyindedir; formda anahtar pasif olur ve nedeni ipucunda yazar); bir örnek "Yalnızca bu
etkinlik" ile seriden ayrılırsa o kayıt kendi başına otomatik kapanabilir. Kapanan bir etkinliği yeniden açarsanız bitiş zamanı geçmiş olduğundan yeniden kapanır — istemiyorsanız o etkinlikte seçeneği kapatın.
Mantık: `src/core/eventModel.js` → `dueForAutoClose` (saf, test edilir), zamanlayıcı `src/services/autoCloseService.js`.

**Sağ tık menüsü (durum değiştirme):** farenin sağ tuşuyla bir etkinliğe tıklanınca — Ay/Hafta/Gün/Scheduler çip ve blokları, Timeline/Dashboard satırları, Kanban/Dashboard kartları, Gantt çubukları ve görev satırları —
etkinliği açmadan **Durum** (Yapılacak · Devam Ediyor · Tamamlandı; geçerli olan işaretli), **Aç** ve **Sil** içeren küçük bir menü açılır. Durum değişince ilerleme tutarlı kalır (Tamamlandı → %100; tamamlanmış etkinlik
yeniden açılırsa Devam Ediyor → %50, Yapılacak → %0). Tekrarlayan serinin bir **örneğinde** "Yalnızca bu etkinlik / Tüm seri" sorulur. Menü klavyeyle de kullanılır (↑ ↓ Home End, Enter/Boşluk, Esc, Tab).
**Gantt'ta** menüye ayrıca **Proje** bölümü eklenir (görevi başka projeye / Projesiz'e taşır; bkz. "Proje bazlı Gantt"). Dokunmatik ekranda devreye girmez (basılı tutma sürüklemeye ayrılmıştır); metin kutularında tarayıcının kendi menüsü korunur. Kod: `src/components/contextMenu.js`, `core/actions.js` → `changeEventStatus`.

**Temalı açılır listeler:** tüm açılır kutuların (`select`) listesi, tarayıcının yerel listesi yerine uygulama temasının renkleriyle çizilir (açık/koyu/özel temalar; seçili seçenekte onay işareti). Açma/kapama
fare ve klavyeyle yapılır (Boşluk/Enter/F4/Alt+↓ açar; ↑ ↓ Home End PageUp PageDown gezinir; harf yazmak seçeneğe gider; Esc yalnızca listeyi kapatır). **Telefon/tablet gibi dokunmatik (kaba işaretçili)
cihazlarda yerel liste korunur** (işletim sisteminin seçicisi daha uygundur). `multiple`, `size > 1` ve `data-native` işaretli kutular kapsam dışıdır. Kod: `src/components/themedSelect.js`, stiller `src/styles/popups.css`.

## Bilinen davranışlar

- Tekrarlayan bir örnek taşındığında, boyutlandırıldığında veya silindiğinde **"Yalnızca bu etkinlik / Tüm seri"** sorulur;
  düzenleme formunda da aynı seçim üstteki kapsam seçiciyle yapılır. "Yalnızca bu" seçilirse örneğin tarihi serinin
  `recurrence.exdates` listesine eklenir ve `seriesId` + `originalDate` ile seriye bağlı bağımsız bir kayıt oluşturulur.
  Bir örneği sürükleyip **"Tüm seri"** seçilirse seri o kadar kayar ve desen taşınan örneğe uyar (haftanın günleri döner; "ayın 15'i" → yeni gün; "ayın ilk salısı" → yeni gün/hafta).
  Bu kayıt açıldığında **"Seriye geri döndür"** ile değişiklik geri alınabilir. Seri silinirse ayrılmış örnekleri de silinir.
- Ekler, tekrar kuralı ve bağımlılıklar yalnızca seri düzeyinde düzenlenir ("Yalnızca bu" modunda gizlenir).
- Service worker yalnızca üretim build'inde kaydedilir (geliştirmede HMR ile çakışmaması için).
- JSON ve ICS dışa aktarma ekleri (attachments) içermez.
- Hatırlatmalar sekme açıkken çalışır (30 sn'de bir kontrol); izin yoksa uygulama içi bildirim gösterilir.
- PWA ikonları SVG'dir; bazı platformlar kurulum için PNG ikon isteyebilir.
