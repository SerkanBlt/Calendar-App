# Calendar Pro

Modüler, offline çalışan takvim ve üretkenlik SPA'sı — Vite + Vanilla JS (ES Modules) + IndexedDB + PWA.
Çalışma zamanı bağımlılığı yoktur; tek geliştirme bağımlılığı Vite'tır.

## Başlangıç

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # dist/ klasörüne üretim çıktısı
npm run preview   # üretim çıktısını sunar (service worker burada aktif olur)
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
| Timeline  | Ay/gün gruplu kronolojik akış, yaklaşan/tümü/geçmiş filtresi, arama |
| Gantt     | Çubuklar, ilerleme tutamacı, taşıma, iki kenardan boyutlandırma, bağımlılık oluşturma/kaldırma, kritik görevler, CPM ile kritik yol, bağımlılık ihlali uyarısı |
| Kanban    | Todo / Doing / Done, kolonlar arası sürükle-bırak, filtre |

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

Yeni arka plan eklemek için:
1. Görseli `public/backgrounds/` klasörüne kopyalayın (webp/jpg önerilir, ~300 KB altı).
2. `src/core/backgrounds.js` içindeki `BACKGROUNDS` listesine `{ value, label, src, dim }` ekleyin.
   `dim` (0–90): tema renginin görsel üzerindeki yoğunluğu; koyu/yoğun desenler için daha yüksek bir değer seçin.

## Kenar çubuğu

Üstte Yeni etkinlik ve Ara, ardından görünümler ve mini takvim yer alır; **Ay · Hafta · Gün** yan yana tek satırdadır
(daraltılmış modda alt alta ikon olur). Liste kaydırılabilir (kaydırma çubuğu gizli). En altta sabit duran **Ayarlar**
düğmesinin sağında uygulamanın sürüm numarası görünür.

**Ayarlar** paneli sekmelidir (`Ctrl + K` → "Ayarlar"); yeni ayarlar ilgili sekmeye eklenir (`src/components/settingsPanel.js` → `TABS`):

| Sekme | İçerik |
|-------|--------|
| Görünüm | Tema, arka plan, yerleşim |
| Takvim | Çalışma günleri, çalışma dışı günleri göster/gizle |
| Genel | Kenar çubuğu ikon modu, hatırlatmalar |
| Veri | JSON dışa / içe aktarma |
| Hakkında | Sürüm bilgisi |

## Sürümler

Sürüm numarası `package.json` → `version` alanından gelir ve derleme sırasında uygulamaya yerleştirilir
(`src/core/version.js`). Semver kullanılır: yeni özellik → MINOR, hata düzeltmesi → PATCH, uyumsuz değişiklik → MAJOR.
Her yayında `CHANGELOG.md` güncellenir ve `public/service-worker.js` içindeki `VERSION` da aynı numaraya getirilir
(eski önbellekler temizlenir).

Sol üstteki **logoya** tıklamak (veya `[` tuşu) kenar çubuğunu ikon moduna daraltır: yalnızca ikonlar kalır,
mini takvim gizlenir ve takvime daha fazla alan açılır. İkonların üzerine gelince adları görünür. Tercih kaydedilir.
Telefonda menü her zaman tam genişlikte açılır.

## Klavye kısayolları

| Kısayol | Eylem |
|---------|-------|
| `Ctrl/⌘ + K` | Komut paleti (komutlar + etkinlik araması) |
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
               settingsRepo, actions, theme, dateUtils, overlap, dom (güvenli şablon), utils, seed
  services/    recurrenceService, notificationService, exportService, criticalPathService
  components/  sidebar, commandPalette, modal, toast, eventCard, eventEditor, timeGrid,
               dragDrop, toolbar, icons
  views/       dashboard, month, week, day, scheduler, timeline, gantt, kanban
  styles/      theme, main, dashboard, calendar, scheduler, gantt, kanban
public/        manifest.json, service-worker.js, icons/
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

- `startTime` boşsa etkinlik tüm gündür.
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
- JSON dışa aktarma ekleri (attachments) içermez.
- Hatırlatmalar sekme açıkken çalışır (30 sn'de bir kontrol); izin yoksa uygulama içi bildirim gösterilir.
- PWA ikonları SVG'dir; bazı platformlar kurulum için PNG ikon isteyebilir.
