# Homora B2B — İş Takip Belgesi

> Tek kaynak. Her tur sonunda güncellenir. Bitenler silinmez, arşive taşınır.
> Son güncelleme: **2026-08-06**

---

## 🔴 ACİL — Ekipte bekliyor

| # | Konu | Detay | Durum |
|---|---|---|---|
| E1 | **Prod'da şifresiz super admin** | `analytics.homora.ai`'de `admin@homora.ai` / `12345` ile **OTP'siz** tam yetkili giriş yapılabiliyor. Sebep: compose'da `DEV_LOGIN_BYPASS` ve `SEED_ADMIN_PASSWORD` tanımlı değil, kod varsayılanları devrede | Kullanıcı "şimdilik kalsın" dedi |
| E2 | **`RESEND_API_KEY` yok** | Compose'da tanımlı değil → OTP e-postası **hiç gönderilemiyor** | Bekliyor |
| E3 | **`NEXT_PUBLIC_API_BASE_URL` hatalı** | Sonu `/api` ile bitiyor, kod `/api/v1` ekleyince `/api/api/v1` oluyordu. Kodu dayanıklı yaptım ama ayar yine de düzeltilmeli | Kod tolere ediyor |
| E4 | **Scraper durmuş (dev)** | `item_app_scraperunlog`'da toplam 5 kayıt, sonuncusu 2026-07-02 ve 0 ilan çekmiş. 10 dk aralıkla çalışması gerekiyor | Bekliyor |
| E5 | **Tahmin kuyruğu tıkalı (dev)** | 1 573 ilan `pending`, 5'i `processing`'de takılı, 863'ünde `prediction_error` | Bekliyor |
| E6 | **Köhnə tikili akışı yok** | Tanımlı 3 scrape stream'in hepsi `yeni_tikili` | Bekliyor |

---

## ❓ Ekibe sorulacak sorular

| # | Soru (Azerbaycanca) | Neden gerekli |
|---|---|---|
| S1 | *"Bir elanın neçə günə satıldığını hansı sahə göstərir? Elanın deaktiv olma tarixi saxlanılırmı?"* | **Likvidlik** göstergesi için hiç veri yok, şu an "—" |
| S2 | *"Aylıq satış (əqd) sayı hansı cədvəldədir?"* | **Aylıq əqd həcmi** için veri yok (#3f) |
| S3 | *"Elanın aktiv / satılmış / dayandırılmış olduğunu hansı sütun göstərir?"* | Status sütunu uydurmaydı, kaldırıldı |
| S4 | *"Rayon üzrə kirayə qiyməti üçün real mənbə varmı?"* | Rayon tablosundaki kirayə formülle türetiliyor |
| S5 | *"`item_app_items_excel` artıq istifadə olunmur — silinsinmi?"* | Arşiv tablosu, birleştirme kapatıldı |
| S6 | *"Şirkət və işçi siyahısı üçün real cədvəl varmı?"* | Admin ekranında şirket listesi hâlâ örnek veri |
| S7 | *"Production serverində CPU %99 idi — səbəbi nədir?"* | Ekran görüntüsünde görüldü |

---

## ⏳ Sıradaki işler (bende)

| # | İş | Not |
|---|---|---|
| B2 | **Rapor arayüzü** | Ekibin gönderdiği 30 dosyalık React paketi (`homora-valuation-report-ui-20260804`) bizim TypeScript yapımıza taşınacak. Başlı başına bir oturum |
| B4 | Portföy URL'i değişmiyor | `/bulk` sabit kalıyor, portföy id'si girmeli |
| B5 | İki "qiymətləndir" butonu | Turuncu/beyaz — farkı ne, neden iki tane |
| B6 | Sol bar aç/kapa | Klavye kısayolu + fare ile |
| B7 | Yuvarlak yüzde göstergesi | Tasarımı kötü, değiştirilecek |
| B8 | Toplu değerleme canlı testi | Kod hazır, deploy sonrası "başlat → sekmeyi kapat → dön" senaryosu denenmeli |
| B9 | Rayon bazlı artım mənzil hesabatında | `/model/market/rayons` gerçek artımı veriyor; portföy satırında rayon anahtarı yok, eklenmeli |
| B10 | Boş ekran metinleri | Uydurma veriler kalkınca bazı kartlar boş kaldı; "veri yok" mesajları gözden geçirilmeli |

---

## ✅ Tamamlananlar (arşiv)

**Veri bütünlüğü — 2. tur (2026-08-06): sistemde uydurma veri kalmadı**
- **Bazar analizi** rayon tablosu: `Gəlirlilik / Kirayə / Artım` artık gerçek (`/model/market/rayons`); `Likvidlik / Əqd-ay` veri yok → "—". Hash tabanlı `unitOf()`, `mktSeries()`, `seedRandom()`, `SALES_DAYS`, üç `MKT_*_FALLBACK` sabiti silindi
- **Trend grafiği** yalnız gerçek aylık seriler (satış ₼/m², kirayə, indeks); veri olmayan metrikalar listeden çıktı
- **Xəritə analizi** 12 aylık trend: uydurma eğri → gerçek Bakı satış eğrisi
- **Backend değerleme motoru silindi** (`/valuation/single`, `/valuation/batch`): kirayə, gəlirlilik, geri ödəmə, likvidlik ve skor sabit + hash jitter ile üretiliyordu. Artık tek yol ekibin predict modeli
- **Sərmayə skoru / risk / likvidlik** ön yüzde de üretiliyordu (`modelInvestment`) → kaldırıldı, sütunlar çıkarıldı
- **3 sahte demo portföy** (36 uydurma mənzil, uydurma sahipler) silindi — liste boş başlıyor
- **Super admin konsolundaki 10 sahte şirket** silindi: gerçek banka adları (ABB, Kapital Bank, PAŞA Bank…), sahte VÖEN, ~114 uydurma çalışan
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
- İmzalı oturum token'ları — deploy'dan sağ çıkıyor ("Sessiya bitib" hatası çözüldü)
- 401 alınca giriş sayfasına yönlendirme
- API URL ikilenmesi koda dayanıklı hale getirildi

**Kimlik / güvenlik**
- Kayıt → "pending" hesap → super admin onayı → giriş (uçtan uca test edildi)
- OTP e-posta bombardımanı açığı kapatıldı (60 sn'de 1, günde 10)
- Rol/durum yönetimi + kendini kilitleme koruması
- Kişisel gmail adresi koddan çıkarıldı (GitLab'a sızmıştı)

**Arayüz**
- Rotalama: her ekranın kendi URL'i (`/ads`, `/market`, …)
- Dark mode tek palete indirildi (3 ayrı palet vardı)
- Logo 404'ü çözüldü (SVG koda gömüldü)
- Çeviri karmaşası (AZ'de İngilizce, EN'de Türkçe) + ölü TR bloğu silindi
- Ayarlar & Hesap ekranları sıfırdan yazıldı
- Admin konsolu geri açıldı + gerçek onay listesi
- Arama: çok kelimeli + aksan duyarsız (`Güneşli` = `Günəşli`)
- Elanlar rozeti gerçek sayıya bağlandı (12.8k sabitti → 168.6k)
- Ölü butonlar kaldırıldı, Yenilə tüm ekranları tazeliyor

---

## 📌 Kalıcı notlar

- **Dev ve prod AYRI kaynak veritabanı.** Prod ~8x fazla veri (169k vs 12k). Ölçüm yaparken hangisine baktığını doğrula
- **Prod deploy disk sınırına takılabiliyor** — `MIN_DOCKER_FREE_GB` (varsayılan 100) CI değişkeni
- `prediction_info` **tamamen ekibin sistemi** üretiyor; biz sadece okuyoruz
- Kaynak DB **salt okunur** — SELECT dışında bir şey yapılmaz
