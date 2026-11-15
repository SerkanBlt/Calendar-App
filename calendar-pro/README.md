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
| Gantt     | Çubuklar, ilerleme tutamacı, taşıma, iki kenardan boyutlandırma, bağımlılık oluşturma/kaldırma, kritik görevler, CPM ile kritik yol, bağımlılık ihlali uyarısı |
| Kanban    | Todo / Doing / Done, kolonlar arası sürükle-bırak, filtre, kolonları yan yana / alt alta gösterme (seçim kaydedilir) |

Sürükle-bırak Pointer Events ile yazıldığı için fare ve dokunmatik ekranda çalışır:

- **Fare:** öğeyi tutup sürükleyin. Izgaranın/alanın kenarına yaklaşınca otomatik kaydırma yapılır.
- **Dokunmatik:** dokunmak öğeyi açar, parmakla kaydırmak sayfayı kaydırır, **basılı tutmak** sürüklemeyi başlatır.
- Hafta/Gün/Scheduler'da saatli bir etkinliği **Tüm gün** satırına bırakmak onu tüm gün yapar; tek günlük bir tüm gün
  etkinliğini saat ızgarasına bırakmak, bırakılan saatte 1 saatlik etkinliğe çevirir (çok günlü olanlar yalnızca gün kaydırır).

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

Sayfaların altında boşluk bırakılmaz: paneller (Ay/Hafta/Gün/Planlayıcı ızgarası, Gantt, Kanban bantları, Dashboard kutuları) görünür alanın altına, standart 8 px dış kenar boşluğuna kadar uzar.
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

Üstte **Hızlı komut** (komut paleti, `Ctrl + K`) ve **Ara** (etkinlik arama paneli, `/`), ardından görünümler ve mini
takvim yer alır. Liste kaydırılabilir (kaydırma çubuğu gizli). En altta sabit duran **Ayarlar** düğmesinin sağında
uygulamanın sürüm numarası görünür.

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
| Genel | Kenar çubuğu ikon modu, hatırlatmalar |
| Veri | JSON (yedek) ve ICS (Outlook/Gmail uyumlu takvim dosyası) dışa / içe aktarma, tüm verileri sıfırlama |
| Hakkında | Sürüm bilgisi |

## Açıklamada Markdown

Etkinlik açıklaması Markdown ile yazılır ve **canlı önizleme** ile gösterilir (Obsidian tarzı). Editör **tek parça bir metin düzenleyicidir** (CodeMirror 6): **satırlar arası seçim ve
seçim tutamakları**, imleç/klavye, mobil klavye (IME), kopyala-yapıştır ve **geri al / yinele satırlar arası da** yerel olarak çalışır.

- **Canlı önizleme yalnızca görünümdür**; metin her zaman ham Markdown olarak saklanır. İmlecin/seçimin değdiği satırlar **ham** (işaretleriyle: `**kalın**`, `## başlık`, `- madde`), **diğer
  satırlar işlenmiş** görünür: başlıklar büyür, maddeler `•` olur, bağlantılar tıklanır, görev kutuları işaretlenir. Bir satıra dokunmak/tıklamak onu ham hale geçirir; editörden çıkınca hepsi
  işlenmiş görünür. Fareyle/klavyeyle seçilen tüm satırlar ham açılır.
- **Dokunmatik cihazlarda** (`pointer: coarse`) seçim sürerken (tutamaklar sürüklenirken) satırların ham/işlenmiş durumu **dondurulur**; seçim boşalınca, metin değişince ya da odak değişince yenilenir.
  Amaç: tutamak sürüklenirken görünümü değiştirmenin Android'de tutamağı bırakmasına yol açmasını önlemek. (Gerçek telefon tutamakları otomasyonla sürülemez; bu önlem emülasyonda doğrulanmıştır.)
- Biçimlendirme araç çubuğu (kalın, italik, üstü çizili, kod, bağlantı, başlık, madde / numaralı / görev listesi, alıntı; `Ctrl/⌘ + B` ve `+ I`) **seçime ve seçili tüm satırlara** uygulanır
  (birden çok satırı tek seferde listeye çevirmek dahil).
- Kutunun **sağ alt köşesindeki tutamak** sürüklenerek (fare/dokunma) ya da `↑` `↓` ile kutuyu **büyütüp küçültür** (en az 96 px; çift tıklama otomatik yüksekliğe döner; yükseklik
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
- Hamburger (44 px, 28 px ikon) ve sayfa adı (24 px) büyüktür; başlık paneli yüksekliği değişmez: ad satır yüksekliği sabit (27 px) ve uzun
  adlar üç noktayla kısalır. Panel yüksekliği 3 genişlik × 8 görünümde ölçülerek doğrulanmıştır.
- Timeline'da Yaklaşan / Tümü / Geçmiş filtresi ve arama alanı başlıktadır (eylem satırında, sola dayalı).
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
| Tekrar | `RRULE` (günlük/haftalık/aylık/yıllık, aralık, adet, bitiş) + `EXDATE` | Aynı kurallar; aşağıdaki sınırlamalara bakın |
| Tek örnek değişikliği | Aynı UID + `RECURRENCE-ID` ile ayrı `VEVENT` | Seriye bağlanır ("Seriye geri döndür" çalışır) |
| Hatırlatma | `VALARM` (5/15/60 dk) | Alarm en yakın 5/15/60 dakikaya yuvarlanır |
| Durum, ilerleme, renk, kritik, bağımlılık | `X-CALENDAR-PRO-*` ve `RELATED-TO;RELTYPE=DEPENDS-ON`; diğer uygulamalar yok sayar | Yalnızca bu uygulamanın dışa aktarımında geri yüklenir |

İçe aktarma davranışı:

- **Silme yapmaz**; aynı UID'li kayıt güncellenir, yenisi eklenir. Aynı dosya tekrar yüklenirse etkinlikler çoğalmaz.
  Güncellenen kayıtlarda dosyada bulunmayan uygulama alanları (durum, ilerleme, renk, kritik, bağımlılık) korunur.
- Bildirimdeki **Geri al** yeni eklenenleri siler, güncellenenleri eski haline getirir.
- Yabancı bir dosyadan gelen ve geçmişte kalan etkinlikler **Tamamlandı** olarak eklenir; aksi halde hepsi Dashboard'da "geciken" sayılırdı.
- İptal edilmiş (`STATUS:CANCELLED`) etkinlikler atlanır.
- Dosya boyutu en fazla 20 MB.

**Sınırlamalar:** uygulamanın tekrar modeli yalnızca `FREQ` / `INTERVAL` / `COUNT` / `UNTIL` bilir. Başlangıç gününden türetilebilen
`BYDAY` / `BYMONTHDAY` / `BYMONTH` (ör. haftalık + başlangıç günü) desteklenir; haftanın birden çok günü (`BYDAY=MO,WE,FR`),
"ayın 2. salısı", `BYSETPOS`, `RDATE` gibi kurallar desteklenmez — bu etkinlikler **yalnızca ilk örnek** olarak eklenir ve içe aktarma
bildiriminde sayısı belirtilir. Ekler (attachments) ICS'e dahil edilmez.

## Verileri sıfırlama

**Ayarlar → Veri → Tüm verileri sıfırla** (veya `Ctrl + K` → "Reset All Data…") uygulamayı ilk kurulum haline döndürür.
Önce bir onay penceresi açılır:

- **Yedek al ve sıfırla** (varsayılan): önce JSON yedeği indirilir, ardından sıfırlanır. Yedek alınamazsa hiçbir şey silinmez.
- **Yedeksiz sıfırla**: doğrudan sıfırlar.
- **Vazgeç**: hiçbir şey değişmez.

Silinenler: etkinlikler, ekler, gönderilmiş hatırlatma kayıtları, kendi arka plan görselleri ve tüm ayarlar (tema, çalışma günleri, kenar çubuğu
vb. varsayılana döner). Veritabanı tek transaction'da temizlenir, yarım kalmaz. Sıfırlanmış uygulama **boş** açılır; ilk açılıştaki örnek veriler
geri yüklenmez. İşlem geri alınamaz; JSON yedeği etkinlikleri ve ayarları içerir, ekler ve kendi arka plan görselleri yedeğe girmez.
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

Sol üstteki **logoya** tıklamak (veya `[` tuşu) kenar çubuğunu ikon moduna daraltır: yalnızca ikonlar kalır,
mini takvim gizlenir ve takvime daha fazla alan açılır. İkonların üzerine gelince adları görünür. Tercih kaydedilir.
Telefonda menü her zaman tam genişlikte açılır.

## Klavye kısayolları

| Kısayol | Eylem |
|---------|-------|
| `Ctrl/⌘ + K` | Hızlı komut (komut paleti) |
| `/` | Etkinlik arama paneli |
| `N` | Yeni etkinlik |
| `T` | Bugüne git |
| `←` / `→` | Önceki / sonraki dönem |
| `1`–`8` | Görünüm değiştir |
| `[` | Kenar çubuğunu daralt / genişlet (logoya tıklamakla aynı) |
| `Ctrl + Enter` | Formu kaydet |
| `Esc` | Modal / palet kapat |

## Mimari

```
src/
  core/        state (store + bus), router (hash), db (IndexedDB), eventRepo, eventModel,
               settingsRepo, actions, theme, backgrounds, colors (renk paleti), markdown (güvenli Markdown), ghostClick, dateUtils, overlap,
               dom (güvenli şablon), utils, seed
  services/    recurrenceService, notificationService, exportService, icsService, resetService, updateService, criticalPathService
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

IndexedDB store'ları: `events`, `settings`, `notifications`, `attachments`.

```js
{ id, title, description, date, startDate, endDate, startTime, endTime, color, status,
  progress, category, critical, recurrence, reminder, dependencies, createdAt, updatedAt }
```

- `startTime` boşsa etkinlik tüm gündür (formda "Tüm gün" açılınca bitiş tarihi başlangıca eşitlenir).
- `color`: paletten veya özel olarak seçilen herhangi bir `#rrggbb` (bkz. "Etkinlik rengi").
- `description`: ham Markdown metni olarak saklanır (bkz. "Açıklamada Markdown").
- `recurrence`: `{ freq: 'daily'|'weekly'|'monthly'|'yearly', interval, until, count, exdates }` — yalnızca ana kayıt saklanır, tekrarlar görüntüleme anında üretilir; `exdates` üretilmeyecek tarihlerdir.
- `seriesId` / `originalDate`: seriden ayrılıp tek başına düzenlenmiş örneğin bağlantısı.
- `reminder`: 0 / 5 / 15 / 60 dakika.
- `dependencies`: Gantt için öncül görev id'leri.

## Bilinen davranışlar

- Tekrarlayan bir örnek taşındığında, boyutlandırıldığında veya silindiğinde **"Yalnızca bu etkinlik / Tüm seri"** sorulur;
  düzenleme formunda da aynı seçim üstteki kapsam seçiciyle yapılır. "Yalnızca bu" seçilirse örneğin tarihi serinin
  `recurrence.exdates` listesine eklenir ve `seriesId` + `originalDate` ile seriye bağlı bağımsız bir kayıt oluşturulur.
  Bu kayıt açıldığında **"Seriye geri döndür"** ile değişiklik geri alınabilir. Seri silinirse ayrılmış örnekleri de silinir.
- Ekler, tekrar kuralı ve bağımlılıklar yalnızca seri düzeyinde düzenlenir ("Yalnızca bu" modunda gizlenir).
- Service worker yalnızca üretim build'inde kaydedilir (geliştirmede HMR ile çakışmaması için).
- JSON ve ICS dışa aktarma ekleri (attachments) içermez.
- Hatırlatmalar sekme açıkken çalışır (30 sn'de bir kontrol); izin yoksa uygulama içi bildirim gösterilir.
- PWA ikonları SVG'dir; bazı platformlar kurulum için PNG ikon isteyebilir.
