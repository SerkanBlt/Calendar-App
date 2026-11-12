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

Sürükle-bırak Pointer Events ile yazıldığı için fare ve dokunmatik ekranda çalışır.

## Temalar

Kenar çubuğunda **Özel · Açık · Koyu · Sistem** seçimleri vardır. **Özel**, renk şeritli bir panel açar:
**Sonbahar** (orman / amber), **Gün Batımı** (gece mavisi / kayısı), **Okyanus** (derin deniz / turkuaz),
**Misket Limonu** (zeytin / lime), **Grafit** (renksiz gri), **Kızıl Çelik** (gece / kızıl) ve **Dağ Yolu** (asfalt / turuncu).
`Ctrl + K` → "Özel Temalar…" veya "Tema: …" ile de seçilebilir.

Yeni özel tema eklemek için:
1. `src/styles/theme.css` içine `:root[data-theme='<ad>'] { ... }` token bloğu ekleyin (mevcut özel temaları örnek alın; `--on-accent` vurgu rengi üzerindeki yazı rengidir).
2. `src/core/theme.js` içindeki `CUSTOM_THEMES` listesine `{ value, label, description, meta, swatches }` ekleyin.

## Arka planlar

Arka plan temadan bağımsızdır; her tema her arka planla kullanılabilir. Kenar çubuğundaki **Arka plan** butonu,
önizlemeli bir seçim paneli açar (`Ctrl + K` → "Arka Planlar…" veya "Arka Plan: …"). **Standart**, temanın kendi
degradesidir. Görsel arka planlarda görselin üzerine temanın zemin rengi bindirilir; böylece her temada yazılar okunur kalır.

Yeni arka plan eklemek için:
1. Görseli `public/backgrounds/` klasörüne kopyalayın (webp/jpg önerilir, ~300 KB altı).
2. `src/core/backgrounds.js` içindeki `BACKGROUNDS` listesine `{ value, label, src, dim }` ekleyin.
   `dim` (0–90): tema renginin görsel üzerindeki yoğunluğu; koyu/yoğun desenler için daha yüksek bir değer seçin.

## Klavye kısayolları

| Kısayol | Eylem |
|---------|-------|
| `Ctrl/⌘ + K` | Komut paleti (komutlar + etkinlik araması) |
| `N` | Yeni etkinlik |
| `T` | Bugüne git |
| `←` / `→` | Önceki / sonraki dönem |
| `1`–`8` | Görünüm değiştir |
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
