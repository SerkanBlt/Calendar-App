# Değişiklik Günlüğü

Sürüm numaraları [semver](https://semver.org/lang/tr/) kuralına göre verilir:
**MAJOR** uyumsuz değişiklik · **MINOR** yeni özellik · **PATCH** hata düzeltmesi.
Uygulamadaki sürüm, kenar çubuğunda Ayarlar düğmesinin sağında ve Ayarlar → Hakkında'da görünür.

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
