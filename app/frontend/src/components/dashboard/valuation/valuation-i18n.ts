// i18n for the valuation module (Tək / Kütləvi / Portfel analizi / Bazar
// analizi). AZ is the source language (the prototype's strings); TR and EN
// are dictionary lookups keyed by the AZ source. Unknown strings fall back
// to AZ so nothing ever renders empty.
//
// `setValLang` is called by each view root on render; `T` is used inline.

import type { Lang } from "@/lib/i18n";

let cur: Lang = "az";
export const setValLang = (l: Lang) => {
  cur = l;
};

type Dict = Record<string, { tr: string; en: string }>;

const D: Dict = {
  // ── shared ──
  "Tək qiymətləndirmə": { tr: "Tek Fiyatlandırma", en: "Single Valuation" },
  "Kütləvi qiymətləndirmə": { tr: "Kütlesel Fiyatlandırma", en: "Mass Valuation" },
  "Portfel analizi": { tr: "Portföy Analizi", en: "Portfolio Analysis" },
  "Yeni qiymətləndirmə": { tr: "Yeni fiyatlandırma", en: "New valuation" },
  "Ləğv et": { tr: "İptal", en: "Cancel" },
  "Yadda saxla": { tr: "Kaydet", en: "Save" },
  "Qiymətləndir": { tr: "Fiyatlandır", en: "Valuate" },
  "Hesablanır…": { tr: "Hesaplanıyor…", en: "Calculating…" },
  "Növ": { tr: "Tür", en: "Type" },
  "Ünvan": { tr: "Adres", en: "Address" },
  "Sahə": { tr: "Alan", en: "Area" },
  "Otaq": { tr: "Oda", en: "Rooms" },
  "Fair value": { tr: "Fair value", en: "Fair value" },
  "Qiymət/m²": { tr: "Fiyat/m²", en: "Price/m²" },
  "Aylıq kirayə": { tr: "Aylık kira", en: "Monthly rent" },
  "Gəlirlilik": { tr: "Getiri", en: "Yield" },
  "Geri ödəmə": { tr: "Geri ödeme", en: "Payback" },
  "Likvidlik": { tr: "Likidite", en: "Liquidity" },
  "Əməliyyat": { tr: "İşlem", en: "Actions" },
  "Redaktə et": { tr: "Düzenle", en: "Edit" },
  "Sil": { tr: "Sil", en: "Delete" },
  "Hesabatı aç": { tr: "Raporu aç", en: "Open report" },
  "Hələ qiymətləndirilməyib": { tr: "Henüz fiyatlandırılmadı", en: "Not valuated yet" },
  "Hamısı": { tr: "Hepsi", en: "All" },
  "Yeni tikili": { tr: "Yeni yapı", en: "New build" },
  "Köhnə tikili": { tr: "Eski yapı", en: "Old build" },
  "Orta": { tr: "Ortalama", en: "Mean" },
  "Median": { tr: "Medyan", en: "Median" },
  "Metrika": { tr: "Metrik", en: "Metric" },
  "Mərkəz": { tr: "Merkez", en: "Center" },
  "Rayon": { tr: "Bölge", en: "District" },
  "Skor": { tr: "Skor", en: "Score" },
  "Bağla": { tr: "Kapat", en: "Close" },
  "mənzil": { tr: "konut", en: "units" },
  "gün": { tr: "gün", en: "days" },
  "il": { tr: "yıl", en: "yrs" },
  "ədəd": { tr: "adet", en: "pcs" },

  // ── single page ──
  "Bir mənzili anında qiymətləndirin. Qiymətləndirilmiş mənzillər aşağıdakı siyahıda yadda saxlanılır.": {
    tr: "Bir konutu anında fiyatlandırın. Fiyatlandırılan konutlar aşağıdaki listede saklanır.",
    en: "Valuate a property instantly. Valuated properties are kept in the list below."
  },
  "Kütləvi qiymətləndirməyə keç": { tr: "Kütlesel fiyatlandırmaya geç", en: "Go to mass valuation" },
  "Parametrlə qiymətləndir": { tr: "Parametreyle fiyatlandır", en: "Valuate by parameters" },
  "Elan linki ilə qiymətləndir": { tr: "İlan linkiyle fiyatlandır", en: "Valuate by listing link" },
  "qiymətləndirmə tarixçədə": { tr: "fiyatlandırma geçmişte", en: "valuations in history" },
  "Qiymətləndirilmiş": { tr: "Fiyatlandırılan", en: "Valuated" },
  "Orta fair value": { tr: "Ort. fair value", en: "Avg fair value" },
  "Orta gəlirlilik": { tr: "Ort. getiri", en: "Avg yield" },
  "Orta skor": { tr: "Ort. skor", en: "Avg score" },
  "Qiymətləndirmə tarixçəsi": { tr: "Fiyatlandırma geçmişi", en: "Valuation history" },
  "Excel ixrac": { tr: "Excel dışa aktar", en: "Export Excel" },
  "Hələ qiymətləndirmə yoxdur": { tr: "Henüz fiyatlandırma yok", en: "No valuations yet" },
  '"Yeni qiymətləndirmə" düyməsi ilə ilk mənzili qiymətləndirin — nəticə burada görünəcək.': {
    tr: '"Yeni fiyatlandırma" düğmesiyle ilk konutu fiyatlandırın — sonuç burada görünecek.',
    en: 'Valuate your first property with "New valuation" — the result will appear here.'
  },
  "Çoxlu mənzil qiymətləndirməyiniz lazımdır?": { tr: "Çok sayıda konut mu fiyatlandıracaksınız?", en: "Need to valuate many properties?" },
  "Excel cədvəlini yükləyin və ya 5-500 mənzili eyni anda qiymətləndirin.": {
    tr: "Excel tablosu yükleyin veya 5-500 konutu aynı anda fiyatlandırın.",
    en: "Upload an Excel sheet or valuate 5-500 properties at once."
  },

  // ── entry modal ──
  "Mənzili redaktə et": { tr: "Konutu düzenle", en: "Edit property" },
  "Mənzil haqqında məlumat": { tr: "Konut bilgileri", en: "Property details" },
  "Xəritədən seç": { tr: "Haritadan seç", en: "Pick on map" },
  "Mənzil növü": { tr: "Konut türü", en: "Property type" },
  "Təmir vəziyyəti": { tr: "Tadilat durumu", en: "Renovation" },
  "Çıxarış": { tr: "Tapu (çıxarış)", en: "Title deed" },
  "Yaşayış kompleksi (rezidens)": { tr: "Site/rezidans mı?", en: "Residence complex?" },
  "Yaşayış kompleksi adı": { tr: "Site/rezidans adı", en: "Complex name" },
  "Sahə kv.m": { tr: "Alan m²", en: "Area m²" },
  "Binanın mərtəbə sayı": { tr: "Bina kat sayısı", en: "Building floors" },
  "Yerləşdiyi mərtəbə": { tr: "Bulunduğu kat", en: "Floor" },
  "Otaq sayı": { tr: "Oda sayısı", en: "Room count" },
  "Seçin": { tr: "Seçin", en: "Select" },
  "Dəqiq qiymətləndirmə üçün tam ünvanı daxil edin (məs. Mir Cəlal küç. 89) və ya xəritədən mənzilin yerləşdiyi binanı seçin.": {
    tr: "Doğru fiyatlandırma için tam adresi girin (örn. Mir Cəlal küç. 89) veya haritadan binayı seçin.",
    en: "For an accurate valuation enter the full address (e.g. Mir Calal St. 89) or pick the building on the map."
  },
  "Rezidensiya və ya kompleksdirsə — Bəli. Adi binalar bu kateqoriyaya aid deyil.": {
    tr: "Site/rezidans ise — Evet. Normal binalar bu kategoriye girmez.",
    en: "If it's a residence/complex — Yes. Regular buildings are not in this category."
  },

  // ── mass landing/detail ──
  "Hər portfel — bir qrup mənzilin yığını. Portfelə daxil olub mənzilləri əlavə edin və ya toplu qiymətləndirin.": {
    tr: "Her portföy — bir grup konut. Portföye girip konut ekleyin veya toplu fiyatlandırın.",
    en: "Each portfolio is a group of properties. Open one to add properties or valuate in bulk."
  },
  "Yeni portfel": { tr: "Yeni portföy", en: "New portfolio" },
  "Yeni portfel yarat": { tr: "Yeni portföy oluştur", en: "Create portfolio" },
  "Boş portfeli yaradıb mənzil əlavə et": { tr: "Boş portföy oluşturup konut ekle", en: "Create an empty portfolio and add properties" },
  "Portfellər qiymətləndirilir…": { tr: "Portföyler fiyatlandırılıyor…", en: "Valuating portfolios…" },
  "Portfelin adı": { tr: "Portföy adı", en: "Portfolio name" },
  "Portfeli yarat": { tr: "Portföyü oluştur", en: "Create portfolio" },
  "Qaralama": { tr: "Taslak", en: "Draft" },
  "Qiymətləndirildi": { tr: "Fiyatlandırıldı", en: "Valuated" },
  "Boş": { tr: "Boş", en: "Empty" },
  "qaralama": { tr: "taslak", en: "draft" },
  "Mənzil": { tr: "Konut", en: "Units" },
  "Dəyər": { tr: "Değer", en: "Value" },
  "Excel cədvəli ilə əlavə et": { tr: "Excel tablosuyla ekle", en: "Add via Excel sheet" },
  "Şablon": { tr: "Şablon", en: "Template" },
  "Nümunə yüklə": { tr: "Örnek yükle", en: "Load sample" },
  "Oxunur…": { tr: "Okunuyor…", en: "Reading…" },
  "Ümumi dəyər": { tr: "Toplam değer", en: "Total value" },
  "Portfeldə mənzil sayı": { tr: "Portföydeki konut sayısı", en: "Properties in portfolio" },
  "Portfeli qiymətləndir": { tr: "Portföyü fiyatlandır", en: "Valuate portfolio" },
  "Qiymətləndirilir…": { tr: "Fiyatlandırılıyor…", en: "Valuating…" },
  "Portfel qiymətləndirilir…": { tr: "Portföy fiyatlandırılıyor…", en: "Valuating portfolio…" },
  "mənzil yenidən hesablanır": { tr: "konut yeniden hesaplanıyor", en: "properties recalculating" },
  "Bu portfeldə hələ mənzil yoxdur": { tr: "Bu portföyde henüz konut yok", en: "No properties in this portfolio yet" },
  "Nəticə tapılmadı": { tr: "Sonuç bulunamadı", en: "No results" },
  "İlk mənzili əlavə et": { tr: "İlk konutu ekle", en: "Add first property" },
  "Axtarış və ya filtri dəyişib yenidən cəhd edin.": { tr: "Arama veya filtreyi değiştirip tekrar deneyin.", en: "Change the search or filter and try again." },
  "Ünvan, rayon və ya ID ilə axtar…": { tr: "Adres, bölge veya ID ile ara…", en: "Search by address, district or ID…" },

  // ── analysis page ──
  "Portfel üzrə zəngin analitika — risk profili, paylanma, top performans və müqayisə.": {
    tr: "Portföy bazında zengin analitik — risk profili, dağılım, en iyi performans ve karşılaştırma.",
    en: "Rich portfolio analytics — risk profile, distribution, top performers and comparison."
  },
  "Analitik hesabat (PDF)": { tr: "Analitik rapor (PDF)", en: "Analytics report (PDF)" },
  "Portfel skoru": { tr: "Portföy skoru", en: "Portfolio score" },
  "aşağı risk": { tr: "düşük risk", en: "low risk" },
  "orta": { tr: "orta", en: "medium" },
  "yüksək": { tr: "yüksek", en: "high" },
  "Orta qiymət/m²": { tr: "Ort. fiyat/m²", en: "Avg price/m²" },
  "Orta aylıq kirayə": { tr: "Ort. aylık kira", en: "Avg monthly rent" },
  "Orta likvidlik": { tr: "Ort. likidite", en: "Avg liquidity" },
  "Rayon üzrə paylanma": { tr: "Bölgeye göre dağılım", en: "Distribution by district" },
  "Portfeldəki mənzillərin coğrafi paylanması.": { tr: "Portföydeki konutların coğrafi dağılımı.", en: "Geographic distribution of the portfolio." },
  "Növ üzrə": { tr: "Türe göre", en: "By type" },
  "Yeni vs köhnə tikili.": { tr: "Yeni vs eski yapı.", en: "New vs old build." },
  "paylanması": { tr: "dağılımı", en: "distribution" },
  "Top 5 — ən yüksək skor": { tr: "İlk 5 — en yüksek skor", en: "Top 5 — highest score" },
  "Aşağı 5 — diqqət lazımdır": { tr: "Son 5 — dikkat gerekli", en: "Bottom 5 — needs attention" },
  "Seçilmiş aralıq": { tr: "Seçilen aralık", en: "Selected range" },
  "mənzil bu aralıqda": { tr: "konut bu aralıkta", en: "properties in this range" },
  "Sərmayə skoru": { tr: "Yatırım skoru", en: "Investment score" },

  // ── market page ──
  "Bazar analizi": { tr: "Pazar Analizi", en: "Market Analysis" },
  "Bazar analizi · Bakı": { tr: "Pazar Analizi · Bakü", en: "Market Analysis · Baku" },
  "Şəhər üzrə əmlak bazarının canlı göstəriciləri — qiymət indeksi, kirayə gəlirliyi, likvidlik və əqd həcmi. Məlumat 12 rayon üzrə yenilənir.": {
    tr: "Şehir genelinde emlak piyasası göstergeleri — fiyat endeksi, kira getirisi, likidite ve işlem hacmi. Veri 12 bölge için güncellenir.",
    en: "City-wide market indicators — price index, rental yield, liquidity and transaction volume. Updated for 12 districts."
  },
  "İxrac": { tr: "Dışa aktar", en: "Export" },
  "Hesabat": { tr: "Rapor", en: "Report" },
  "Orta kirayə": { tr: "Ort. kira", en: "Avg rent" },
  "Aylıq əqd həcmi": { tr: "Aylık işlem hacmi", en: "Monthly transactions" },
  "Qiymət indeksi": { tr: "Fiyat endeksi", en: "Price index" },
  "dinamikası": { tr: "dinamiği", en: "trend" },
  "Rayonlar üzrə müqayisə": { tr: "Bölgelere göre karşılaştırma", en: "District comparison" },
  "rayon": { tr: "bölge", en: "districts" },
  "Sütun başlığına klikləyib sıralayın": { tr: "Sütun başlığına tıklayıp sıralayın", en: "Click a column header to sort" },
  "Seqment": { tr: "Segment", en: "Segment" },
  "Premium": { tr: "Premium", en: "Premium" },
  "Əlçatan": { tr: "Uygun fiyatlı", en: "Affordable" },
  "Kirayə ₼": { tr: "Kira ₼", en: "Rent ₼" },
  "Əqd/ay": { tr: "İşlem/ay", en: "Deals/mo" },
  "Təklif": { tr: "Arz", en: "Supply" },
  "Artım (illik)": { tr: "Artış (yıllık)", en: "Growth (YoY)" },
  "Trend": { tr: "Trend", en: "Trend" },
  "Hal-hazırkı": { tr: "Şu an", en: "Current" },
  "Dəyişiklik": { tr: "Değişim", en: "Change" },
  "Bütün Bakı": { tr: "Tüm Bakü", en: "All Baku" },
  "Kateqoriya": { tr: "Kategori", en: "Category" },
  "Qiymət aralığı və kateqoriyaya görə satış günlərinin ortalaması": {
    tr: "Fiyat aralığı ve kategoriye göre ortalama satış günleri",
    en: "Average days-to-sell by price bucket and category"
  },
  "Rayonlar üzrə kirayə gəlirliyi": { tr: "Bölgelere göre kira getirisi", en: "Rental yield by district" },
  "Əlçatan rayonlarda gəlirlilik daha yüksək, premium rayonlarda daha aşağıdır.": {
    tr: "Uygun fiyatlı bölgelerde getiri daha yüksek, premium bölgelerde daha düşüktür.",
    en: "Affordable districts yield more; premium districts yield less."
  },
  "Ən sürətli artan rayonlar": { tr: "En hızlı artan bölgeler", en: "Fastest-growing districts" },
  "İllik qiymət artımı üzrə.": { tr: "Yıllık fiyat artışına göre.", en: "By annual price growth." },
  "Ən yavaş artan rayonlar": { tr: "En yavaş artan bölgeler", en: "Slowest-growing districts" },
  "Otaq sayına görə seqment": { tr: "Oda sayısına göre segment", en: "Segments by room count" },
  "Bazarın otaq sayı üzrə bölgüsü və göstəriciləri.": { tr: "Pazarın oda sayısına göre dağılımı ve göstergeleri.", en: "Market split and metrics by room count." },
  "Yeni vs köhnə tikili": { tr: "Yeni vs eski yapı", en: "New vs old build" },
  "Şəhər üzrə təklif strukturu.": { tr: "Şehir genelinde arz yapısı.", en: "City-wide supply structure." },
  "Yeni/köhnə qiymət fərqi": { tr: "Yeni/eski fiyat farkı", en: "New/old price gap" },
  "Orta satış günləri": { tr: "Ortalama satış günleri", en: "Average days to sell" },
  "Qiymət aralığı (₼)": { tr: "Fiyat aralığı (₼)", en: "Price bucket (₼)" },
  "pay": { tr: "pay", en: "share" },
  "vahid: gün": { tr: "birim: gün", en: "unit: days" },

  // ── standalone analysis picker ──
  "Analiz üçün portfel tapılmadı": { tr: "Analiz için portföy bulunamadı", en: "No portfolio to analyse" },
  "Əvvəlcə Kütləvi qiymətləndirmə bölməsində portfel yaradın və mənzil əlavə edin.": {
    tr: "Önce Kütlesel Fiyatlandırma bölümünde portföy oluşturup konut ekleyin.",
    en: "First create a portfolio and add properties in Mass Valuation."
  },
  "Mənzillər siyahısı": { tr: "Konut listesi", en: "Property list" },
  "Portfel:": { tr: "Portföy:", en: "Portfolio:" }
  ,"Analiz xəritəsi": { tr: "Analiz Haritası", en: "Analysis Map" },
  "H3 hexagonal əmlak istilik xəritəsi — hücrə başına göstəricilər və elan sıxlığı.": { tr: "H3 hexagonal emlak ısı haritası — hücre başına göstergeler ve ilan yoğunluğu.", en: "H3 hexagonal heat map — per-cell metrics and listing density." },
  "Toplam elan": { tr: "Toplam ilan", en: "Total listings" },
  "Aktiv H3 hücrə": { tr: "Aktif H3 hücre", en: "Active H3 cells" },
  "Rayon sayı": { tr: "Bölge sayısı", en: "Districts" },
  "Dövr": { tr: "Dönem", en: "Period" },
  "Göstərici": { tr: "Gösterge", en: "Metric" },
  "Dəqiqlik (H3)": { tr: "Çözünürlük (H3)", en: "Resolution (H3)" },
  "Hücrə üzərinə kursoru gətirin": { tr: "Hücrenin üzerine gelin", en: "Hover over a cell" },
  "Bakı H3 İstilik Xəritəsi": { tr: "Bakü H3 Isı Haritası", en: "Baku H3 Heat Map" },
  "Bütün kateqoriyalar": { tr: "Tüm kategoriler", en: "All categories" },
  "12 aylıq trend": { tr: "12 aylık trend", en: "12-month trend" },
  "Hücrələrin aralıq üzrə sayı": { tr: "Hücrelerin aralığa göre sayısı", en: "Cell counts by bucket" },
  "Yenilə": { tr: "Yenile", en: "Refresh" },
  "Elan sayı": { tr: "İlan sayısı", en: "Listing count" },
  "Elan": { tr: "İlan", en: "Listings" },
  "Qiymət / m²": { tr: "Fiyat / m²", en: "Price / m²" },
  "Qiymət (₼/m²)": { tr: "Fiyat (₼/m²)", en: "Price (₼/m²)" },
  "Orta kirayə (₼/ay)": { tr: "Ort. kira (₼/ay)", en: "Avg rent (₼/mo)" },
  "Likvidlik (gün)": { tr: "Likidite (gün)", en: "Liquidity (days)" },
  "Əqd həcmi": { tr: "İşlem hacmi", en: "Transactions" },
  "Təmirli": { tr: "Tadilatlı", en: "Renovated" },
  "Təmirsiz": { tr: "Tadilatsız", en: "Unrenovated" },
  "Yoxdur": { tr: "Yok", en: "No" },
  "Var": { tr: "Var", en: "Yes" },
  "Bəli": { tr: "Evet", en: "Yes" },
  "Xeyr": { tr: "Hayır", en: "No" },
  "Qiymətləndirmə tarixi": { tr: "Değerleme tarihi", en: "Valuation date" },
  "Köhnə tikili üçün yaşayış kompleksi seçimi tələb olunmur.": { tr: "Eski yapı için site/rezidans seçimi gerekmez.", en: "Residence complex is not required for old builds." },
  "Bu sahə tələb olunur!": { tr: "Bu alan zorunludur!", en: "This field is required!" },
  "Sahə 20 ilə 400 arası olmalıdır!": { tr: "Alan 20 ile 400 arasında olmalıdır!", en: "Area must be between 20 and 400!" },
  "Otaq sayı 1 ilə 10 arası olmalıdır!": { tr: "Oda sayısı 1 ile 10 arasında olmalıdır!", en: "Rooms must be between 1 and 10!" },
  "Binanın mərtəbə sayı 1 ilə 35 arası olmalıdır!": { tr: "Bina kat sayısı 1 ile 35 arasında olmalıdır!", en: "Building floors must be between 1 and 35!" },
  "Yerləşdiyi mərtəbə 1 ilə 35 arası olmalıdır!": { tr: "Bulunduğu kat 1 ile 35 arasında olmalıdır!", en: "Floor must be between 1 and 35!" },
  "Yerləşdiyi mərtəbə binanın mərtəbəsindən çox ola bilməz!": { tr: "Bulunduğu kat bina kat sayısından büyük olamaz!", en: "Floor cannot exceed the building's floor count!" },
  "PDF yüklə": { tr: "PDF indir", en: "Download PDF" },
  "Əlçatanlıq indeksləri": { tr: "Erişilebilirlik indeksleri", en: "Accessibility indices" },
  "Əlçatanlıq məlumatları hazırlanır": { tr: "Erişilebilirlik verileri hazırlanıyor", en: "Accessibility data coming soon" },
  "Təhsil, restoran, əyləncə, nəqliyyat, səyahət və gəzinti indeksləri API inteqrasiyasından sonra burada görünəcək.": { tr: "Eğitim, restoran, eğlence, ulaşım, seyahat ve gezinti indeksleri API entegrasyonundan sonra burada görünecek.", en: "Education, restaurant, entertainment, transport, travel and walk indices will appear here after the API integration." },
  "Təhsil": { tr: "Eğitim", en: "Education" },
  "Restoran": { tr: "Restoran", en: "Restaurant" },
  "Əyləncə": { tr: "Eğlence", en: "Entertainment" },
  "Nəqliyyat": { tr: "Ulaşım", en: "Transport" },
  "Səyahət": { tr: "Seyahat", en: "Travel" },
  "Gəzinti": { tr: "Gezinti", en: "Walk" },

  // ── B2C rate report (Mənzili qiymətləndir) ──
  "Nəticə": { tr: "Sonuç", en: "Result" },
  "ay": { tr: "ay", en: "mo" },
  "Mənbə": { tr: "Kaynak", en: "Source" },
  "Satış qiyməti": { tr: "Satış fiyatı", en: "Sale price" },
  "Kirayə qiyməti": { tr: "Kira fiyatı", en: "Rent price" },
  "Qiymət aralığı": { tr: "Fiyat aralığı", en: "Price range" },
  "Kirayə aralığı": { tr: "Kira aralığı", en: "Rent range" },
  "Mənzilin süni intellekt modeli ilə dəyərləndirilmiş satış qiyməti": {
    tr: "Konutun yapay zekâ modeliyle değerlendirilmiş satış fiyatı",
    en: "AI-model-estimated sale price of the property"
  },
  "Mənzilin süni intellekt modeli ilə dəyərləndirilmiş kirayə qiyməti": {
    tr: "Konutun yapay zekâ modeliyle değerlendirilmiş kira fiyatı",
    en: "AI-model-estimated rent price of the property"
  },
  "Sərmayə dəyərləndirməsi": { tr: "Yatırım değerlendirmesi", en: "Investment assessment" },
  "İllik kirayə gəliri": { tr: "Yıllık kira geliri", en: "Annual rent income" },
  "Kirayə gəlirliliyi": { tr: "Kira getirisi", en: "Rental yield" },
  "Geri ödəmə müddəti": { tr: "Geri ödeme süresi", en: "Payback period" },
  "1 m² qiyməti": { tr: "1 m² fiyatı", en: "Price per m²" },
  "Satış qiymətinin trendi": { tr: "Satış fiyatı trendi", en: "Sale price trend" },
  "Kirayə qiymətinin trendi": { tr: "Kira fiyatı trendi", en: "Rent price trend" },
  "Qrafik son 1 ildə qiymətləndirilmiş potensial satış dəyərinin dinamikasını əks etdirir.": {
    tr: "Grafik son 1 yılda değerlendirilmiş potansiyel satış değerinin dinamiğini gösterir.",
    en: "The chart shows the dynamics of the estimated potential sale value over the last year."
  },
  "Qrafik son 1 ildə qiymətləndirilmiş potensial kirayə qiymətinin dinamikasını əks etdirir.": {
    tr: "Grafik son 1 yılda değerlendirilmiş potansiyel kira fiyatının dinamiğini gösterir.",
    en: "The chart shows the dynamics of the estimated potential rent price over the last year."
  },
  "Lokasiya": { tr: "Konum", en: "Location" },
  "Mənzilin xəritə üzrə yerləşməsi və ətraf kontekst.": {
    tr: "Konutun harita üzerindeki konumu ve çevresel bağlam.",
    en: "The property's location on the map and surrounding context."
  },
  "İpoteka kalkulyatoru": { tr: "İpotek hesaplayıcı", en: "Mortgage calculator" },
  "Homora qiymətləndirməsinə əsasən": { tr: "Homora değerlemesine göre", en: "Based on the Homora valuation" },
  "İlkin ödəniş": { tr: "Peşinat", en: "Down payment" },
  "Kredit müddəti": { tr: "Kredi süresi", en: "Loan term" },
  "Faiz dərəcəsi": { tr: "Faiz oranı", en: "Interest rate" },
  "Mənzilin qiyməti": { tr: "Konutun fiyatı", en: "Property price" },
  "Kredit məbləği": { tr: "Kredi tutarı", en: "Loan amount" },
  "Aylıq ödəniş": { tr: "Aylık ödeme", en: "Monthly payment" },
  "Ümumi faiz": { tr: "Toplam faiz", en: "Total interest" },
  "Ümumi ödəniş": { tr: "Toplam ödeme", en: "Total payment" },
  "Tələb olunan minimum aylıq gəlir": { tr: "Gerekli minimum aylık gelir", en: "Required minimum monthly income" },
  "Yaşayış kompleksi": { tr: "Site/rezidans", en: "Residence complex" },
  "Bu əmlak üzrə qiymətləndirmə hesabatı Homora süni intellekt modeli əsasında hazırlanmışdır.": {
    tr: "Bu mülke ilişkin değerleme raporu Homora yapay zekâ modeli temel alınarak hazırlanmıştır.",
    en: "This valuation report for the property was prepared based on the Homora AI model."
  },
  "Link formatı düzgün deyil": { tr: "Link formatı geçersiz", en: "Invalid link format" },
  "Qiymətləndirmə məlumatı yoxdur": { tr: "Değerleme verisi yok", en: "No valuation data" },
  "Elan bazamızda tapılmadı": { tr: "İlan veritabanımızda bulunamadı", en: "Listing not found in our database" },
  "Link üzrə qiymətləndirmə alınmadı": { tr: "Link ile değerleme alınamadı", en: "Could not valuate by link" },
  "Yalnız bina.az və ya emlak.az linki daxil edin": {
    tr: "Yalnızca bina.az veya emlak.az linki girin",
    en: "Enter only a bina.az or emlak.az link"
  },
  "Elan linkini daxil edin (bina.az və ya emlak.az)": {
    tr: "İlan linkini girin (bina.az veya emlak.az)",
    en: "Enter the listing link (bina.az or emlak.az)"
  },
  "Giriş tələb olunur. Zəhmət olmasa yenidən daxil olun": {
    tr: "Giriş gerekli. Lütfen tekrar giriş yapın",
    en: "Sign-in required. Please log in again"
  }
};

export function T(s: string): string {
  if (cur === "az") return s;
  const hit = D[s];
  if (!hit) return s;
  return cur === "tr" ? hit.tr : hit.en;
}
