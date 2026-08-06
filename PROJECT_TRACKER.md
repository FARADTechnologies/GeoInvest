# Homora B2B — İş Takip Belgesi

> Tek kaynak. Her tur sonunda güncellenir. Bitenler silinmez, arşive taşınır.
> Son güncelleme: **2026-08-06** (3. tur)

> ⚠️ **Bu belge repoda ve GitLab'da — ekip okuyor.**
> Giriş bilgileri, erişim bilgileri, kişisel e-posta adresleri, iç ağ adresleri
> buraya **yazılmaz**. Bir ayarın **adı** yazılır, **değeri asla**.

---

## 🔴 ACİL — Ekipte bekliyor

| # | Konu | Detay | Durum |
|---|---|---|---|
| E2 | **Prod'da e-posta anahtarı eksik** | ✅ **KESİN TEŞHİS.** `/admin/data-status` → `email.configured = false`, `email.sender_set = true`. Yani gönderen adresi tanımlı (`hello@updates.homora.ai`) ama **API anahtarı prod ortamında yok**. Ekibin "anahtarlar sistemde var" bilgisi doğru değil. Yerelde aynı kod ile tüm zincir çalışıyor | **Ekipte: anahtarı prod backend ortamına ekle** |
| E7 | Cloudflare 5xx'leri maskeliyor | Uygulamamız 502 + Azerbaycanca mesaj döndürüyor ama Cloudflare kendi "error code: 502" sayfasını gösteriyor. 401 gibi 4xx'ler aynen geçiyor. Kullanıcı hata sebebini göremiyor | Düşük öncelik |
| E3 | **`NEXT_PUBLIC_API_BASE_URL` hatalı** | Sonu `/api` ile bitiyor, kod `/api/v1` ekleyince `/api/api/v1` oluyordu. Kodu dayanıklı yaptım ama ayar yine de düzeltilmeli | Kod tolere ediyor |

**2. dereceye alındı** (ekibin kendi altyapısı, bizi bloklamıyor):
`E4` scraper durmuş (dev, son çalışma 02.07.2026) · `E5` tahmin kuyruğunda ~2 400 değerlenmemiş ilan · `E6` scrape stream'lerin hepsi yeni tikili, köhnə tikili verisi bayatlıyor

**Kapandı:** `E1` seed admin OTP muafiyeti — geliştirme süresince **kasıtlı**, kullanıcının kararı. Kod denetlendi: muafiyet tek bir hesaba kilitli, diğer herkes normal OTP akışından geçiyor. Kaldırma zamanını kullanıcı söyleyecek.

---

## ❓ Ekibe sorulacak sorular

**Şimdi sorulacak:** yok — güncel sorunlar bitene kadar bekletiliyor.

**2. derece (sonra):**
`S1` ilan kaç günde satıldı / deaktiv tarihi · `S2` aylık əqd sayısı · `S3` aktiv/satılmış/dayandırılmış sütunu · `S4` rayon kirayə için ayrı kaynak · `S8` predict'teki `price_trend` gerçek geçmiş mi tahmin mi · `S9` sərmayə skoru metodolojisi · `S10` Xəzər ve Pirallahı aynı rakamları dönüyor (olası spatial join hatası)

**Kapandı:** `S5` Excel — sistemden tamamen çıkarıldı, bir daha sorulmayacak · `S6` şirket tablosu — sistem içinden, kayıt oldukça üretilecek; dış dosya yok · `S7` prod CPU — bizi ilgilendirmiyor

---

## ⏳ Sıradaki işler (bende)

| # | İş | Not |
|---|---|---|
| B11 | **`send_email` hata yakalama** | httpx hataları `EmailError` olarak sarılmıyor → ağ/DNS sorununda istek çıplak 500/502 olarak ölüyor, mesaj kayboluyor. Düzeltme yazıldı, uygulanamadı |
| B12 | **`/admin/data-status`'a e-posta teşhis bloğu** | Ayarın **varlığını** raporlar, değerini asla. "Prod'da e-posta kurulu mu?" bir daha tahmin işi olmasın |
| B13 | **Excel arşiv ölü kodu** | `_MERGE_ARCHIVE_TABLE` yolu kapalı ama duruyor; tamamen sökülecek |
| B14 | **`city_value` / `district_value` boş geliyor** | Canlı testte doğrulandı: predict cevabında bu iki alan `null`. Rapordaki "Bakı üzrə artım" ve "Rayon üzrə artım" bu yüzden "—" gösteriyor. Ekibe sorulacak: bu alanları hangi uç dolduruyor? |

---

## ✅ Tamamlananlar (arşiv)

**Veri bütünlüğü — 2. tur (2026-08-06): sistemde uydurma veri kalmadı**
- **Bazar analizi** rayon tablosu: `Gəlirlilik / Kirayə / Artım` artık gerçek (`/model/market/rayons`); `Likvidlik / Əqd-ay` veri yok → "—". Hash tabanlı `unitOf()`, `mktSeries()`, `seedRandom()`, `SALES_DAYS`, üç `MKT_*_FALLBACK` sabiti silindi
- **Trend grafiği** yalnız gerçek aylık seriler (satış ₼/m², kirayə, indeks); veri olmayan metrikalar listeden çıktı
- **Xəritə analizi** 12 aylık trend: uydurma eğri → gerçek Bakı satış eğrisi
- **Backend değerleme motoru silindi** (`/valuation/single`, `/valuation/batch`): kirayə, gəlirlilik, geri ödəmə, likvidlik ve skor sabit + hash jitter ile üretiliyordu. Artık tek yol ekibin predict modeli
- **Sərmayə skoru / risk / likvidlik** ön yüzde de üretiliyordu (`modelInvestment`) → kaldırıldı, sütunlar çıkarıldı
- **3 sahte demo portföy** (36 uydurma mənzil, uydurma sahipler) silindi — liste boş başlıyor
- **Super admin konsolundaki 10 sahte şirket** silindi: gerçek banka adları, sahte VÖEN, ~114 uydurma çalışan
- **Login sayfası:** "94.6% forecast accuracy" (ölçülmemiş model iddiası) ve eskimiş "12 847 elan" kaldırıldı
- `reportFromLinkMock` (URL hash'inden tam değerleme üreten fonksiyon) silindi
- `genTrend`, `miniSeries`, rayon kartlarındaki sahte sparkline'lar silindi
- Mənzil hesabatındaki sabit "+9.1% / +10.2% / +10.1%" artım satırları ve "500m radius" uydurması kaldırıldı
- `mock-gate.ts` gereksiz kaldı, silindi

**Veri bütünlüğü — 1. tur**
- Uydurma veri dosyaları **tamamen silindi** (`mock-data.ts`, `listings-data.ts`, `snapshot.ts`, `public/snapshot/data.json`)
- Tüm fallback yolları kaldırıldı — gerçek veri yoksa artık **"—"** veya boş
- Yerel sahte değerleme motoru silindi
- Sahte `status` sütunu kaldırıldı
- Tek veri kaynağı: `item_app_items` (arşiv birleştirme kapatıldı)
- Kiralık ilanlar satış istatistiklerinden ayrıldı (**başlık** ile — `type_id` güvenilmezdi)
- Duplicate ilanlar tekilleştirildi (`source_url`)
- Filtreler tek merkezde toplandı (`_market_rows()`) — 6 sorgu aynı tanımı kullanıyor

**Altyapı**
- Gecelik iş aylardır çöküyordu (`postgresql+asyncpg://` öneki) → düzeltildi
- Otonom yenileme: her gece 00:00 + açılışta geride kalmışsa + `/admin/refresh`
- `/admin/data-status` ile hata görünürlüğü
- İmzalı oturum belirteçleri — deploy'dan sağ çıkıyor ("Sessiya bitib" hatası çözüldü)
- 401 alınca giriş sayfasına yönlendirme
- API URL ikilenmesi koda dayanıklı hale getirildi

**Kimlik / güvenlik**
- Kayıt → "pending" hesap → super admin onayı → giriş (uçtan uca test edildi)
- OTP e-posta bombardımanı açığı kapatıldı (60 sn'de 1, günde 10)
- Rol/durum yönetimi + kendini kilitleme koruması
- Kişisel gmail adresi koddan çıkarıldı (GitLab'a sızmıştı)

**Arayüz — 2. tur (2026-08-06)**
- Sol bar aç/kapa: `Ctrl+B` + panel başlığındaki buton, seçim kalıcı, kapalıyken ikonlarda tooltip
- Portföy URL'e yansıyor: `/bulk?p=<id>` (+ `&v=analysis`); geri/ileri portföyler arasında geziyor
- İki "qiymətləndir" butonu ayrıştı: **Yeniləri qiymətləndir (N)** vs **Hamısını yenidən hesabla (N)**; pahalı olan onay soruyor
- Yuvarlak gösterge yeniden yazıldı: skor eşikleri (78/60 → yeşil/kırmızı) hâlâ içindeydi, nötr bir oranı kırmızı hale ile çiziyordu; artık tek renk + nötr iz, birim sayının yanında, erişilebilir
- Mənzil hesabatında **rayon üzrə artım** gerçek (`/model/market/rayons`, min örneklem kuralıyla)
- Kütləvi boş ekran: portföy yokken ne yapılacağı yazıyor; yanıltıcı "portfellər qiymətləndirilir" mesajı kaldırıldı
- Rapor artık homora.ai ile birebir: 500m ortalama, Bakı artımı, rayon artımı (hepsi gerçek, predict'ten)
- **Tarih formatı Azerbaycan standardına çevrildi:** `06.08.2026` / `08.2026` / eksende `08.26`. Tek modül (`lib/format-date.ts`) yönetiyor; API hâlâ ISO konuşuyor
- Bazar analizi'nde "ən sürətli" ve "ən yavaş artan" listeleri aynı rayonları gösteriyordu (10'dan az rayon eşiği geçince dilimler çakışıyordu) → ayrıldı

**Canlı doğrulama (2026-08-06, yerel Docker)**
- **B8 toplu değerleme testi GEÇTİ:** 2 mənzillik iş başlatıldı, istemci tamamen koparıldı, iş sunucuda döndü ve 2/2 tamamlandı. Sonuçlar gerçek (362 011 ₼ / 173 540 ₼, rayonlar koordinattan çözülmüş)
- **B2 alanı doğrulandı:** `neighbourhood_price_500m` predict cevabında **gerçekten var** (3 286 / 2 614) → rapordaki "500m radiusda orta qiymət" artık gerçek sayı gösteriyor
- `price_trend` modelden 13 aylık gerçek seri dönüyor → rapordaki trend grafiği gerçek
- **OTP zinciri yerelde TAM doğrulandı** (tek tek, hepsi geçti):
  1. Kayıt → `pending` hesap
  2. Super admin onayı → `active`
  3. Giriş → 6 haneli kod üretildi, Redis'e yazıldı, e-posta gönderildi (200)
  4. **Kod doğrulama → oturum açıldı** (`company_admin` rolüyle) ← bu adım daha önce hiç test edilmemişti
  5. Kod tek kullanımlık: doğrulamadan sonra Redis'ten silindi, tekrar denemede 401
  6. Hız sınırı: 60 sn içinde ikinci istek 429
- Tarih formatı ekranda doğrulandı: grafik ekseni `05.25 · 07.25 · 09.25 …`

**Performans**
- ⚠️ **Ölçüm notu:** prod'da `/model/market/trends` **0.43 sn** dönüyor — yük bugün kritik değil. Sebep: JSONB açılımı sadece `prediction_info` dolu satırlara dokunuyor (~18k), 169k'nın hepsine değil. Tahmin kuyruğu ilerledikçe büyür; cache asıl o büyümeye karşı koruma
- **Bazar analizi cache'i** (ekibin isteği): 4 ağır analitik gecelik döngü başına 1 kez hesaplanıyor. Gecelik iş bitince cache temizleniyor. Redis varsa Redis, yoksa süreç içi sözlük
- **Ölçüldü:** soğuk çağrı **3.32 sn** → sonraki çağrılar **0.005 sn**

**Arayüz — 1. tur**
- Rotalama: her ekranın kendi URL'i (`/ads`, `/market`, …)
- Dark mode tek palete indirildi (3 ayrı palet vardı)
- Logo 404'ü çözüldü (SVG koda gömüldü)
- Çeviri karmaşası (AZ'de İngilizce, EN'de Türkçe) + ölü TR bloğu silindi
- Ayarlar & Hesap ekranları sıfırdan yazıldı
- Admin konsolu geri açıldı + gerçek onay listesi
- Arama: çok kelimeli + aksan duyarsız (`Güneşli` = `Günəşli`)
- Elanlar rozeti gerçek sayıya bağlandı (sabit değerdi → gerçek toplam)
- Ölü butonlar kaldırıldı, Yenilə tüm ekranları tazeliyor

---

## 📌 Kalıcı notlar

- **Bu belgeye hassas veri yazılmaz** (en üstteki uyarı). Aynı kural commit mesajları ve kod yorumları için de geçerli
- **Dev ve prod AYRI kaynak veritabanı.** Prod ~8x fazla veri. Ölçüm yaparken hangisine baktığını doğrula
- **Prod deploy disk sınırına takılabiliyor** — `MIN_DOCKER_FREE_GB` (varsayılan 100) CI değişkeni
- `prediction_info` **tamamen ekibin sistemi** üretiyor; biz sadece okuyoruz
- Kaynak DB **salt okunur** — SELECT dışında bir şey yapılmaz
