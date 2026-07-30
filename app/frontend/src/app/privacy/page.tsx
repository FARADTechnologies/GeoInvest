// Məxfilik Siyasəti — team #6. Content supplied by the team (AZ).
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Məxfilik Siyasəti · Homora.ai" };

const SECTIONS: { h: string; body: (string | string[])[] }[] = [
  {
    h: "1. Ümumi müddəalar",
    body: [
      "1.1. Bu Məxfilik Siyasəti Homora.ai platformasının Qaydalar və şərtlərinin ayrılmaz hissəsidir.",
      "1.2. Bu sənəd istifadəçilərin şəxsi məlumatlarının toplanması, saxlanılması, işlənməsi, istifadəsi, ötürülməsi və qorunması qaydalarını müəyyən edir.",
      "1.3. Homora.ai platforması Advanced AI Solutions MMC tərəfindən idarə olunur və şəxsi məlumat bazasının sərəncamçısı həmin şirkətdir.",
      "1.4. İstifadəçi platformadan istifadə etməklə bu Məxfilik Siyasətində göstərilən qaydalara razılıq verir."
    ]
  },
  {
    h: "2. Toplanan məlumatlar",
    body: [
      "2.1. Homora.ai aşağıdakı növ məlumatları toplaya bilər:",
      "2.1.1. İstifadəçi tərəfindən təqdim olunan məlumatlar:",
      [
        "Ad və soyad",
        "Elektron poçt ünvanı",
        "Telefon nömrəsi",
        "Hesab məlumatları",
        "Ödənişlə bağlı məlumatlar (ödəniş provayderı vasitəsilə)",
        "Platformaya daxil edilən əmlak məlumatları"
      ],
      "2.1.2. Avtomatik toplanan texniki məlumatlar:",
      ["IP ünvan", "Brauzer növü", "Qurğu məlumatları", "Giriş tarixləri və istifadə statistikası"]
    ]
  },
  {
    h: "3. Məlumatların işlənmə məqsədləri",
    body: [
      "3.1. Toplanan məlumatlar aşağıdakı məqsədlərlə istifadə olunur:",
      [
        "Platformanın fəaliyyətinin təmin edilməsi",
        "Maşın öyrənməsi və süni intellekt əsaslı qiymətləndirmə və analitika xidmətlərinin göstərilməsi",
        "Bazar məlumatlarının təhlili",
        "Xidmətlərin təkmilləşdirilməsi və yeni funksiyaların inkişafı",
        "Abunəlik və ödənişlərin idarə edilməsi",
        "Təhlükəsizliyin təmin olunması və sui-istifadənin qarşısının alınması",
        "İstifadəçiyə məlumat və ya marketinq bildirişlərinin göndərilməsi (istifadəçinin razılığı ilə)",
        "Qanunvericiliyin tələblərinə əməl olunması"
      ]
    ]
  },
  {
    h: "4. Məlumatların üçüncü şəxslərə ötürülməsi",
    body: [
      "4.1. Homora.ai istifadəçilərin şəxsi məlumatlarını satmır və icarəyə vermir.",
      "4.2. İstifadəçi məlumatları aşağıdakı hallarda üçüncü tərəflərə ötürülə bilər:",
      ["Ödəniş provayderlərinə (ödənişlərin icrası üçün)", "Texniki xidmət təminatçılarına", "Hüquqi öhdəlik yarandıqda dövlət orqanlarına"],
      "4.3. Bütün üçüncü tərəf tərəfdaşlar məlumatların qorunması üzrə öhdəlik daşıyırlar."
    ]
  },
  {
    h: "5. İstifadəçinin hüquqları",
    body: [
      "5.1. İstifadəçi aşağıdakı hüquqlara malikdir:",
      ["Öz şəxsi məlumatlarına çıxış əldə etmək", "Onların düzəldilməsini tələb etmək", "Məlumatların silinməsini tələb etmək", "Marketinq bildirişlərindən imtina etmək"],
      "5.2. Sorğular support@homora.ai ünvanına göndərilə bilər."
    ]
  },
  {
    h: "6. Məlumatların saxlanılması və qorunması",
    body: [
      "6.1. Şəxsi məlumatlar qorunan serverlərdə saxlanılır.",
      "6.2. Homora.ai məlumatların icazəsiz girişdən qorunması üçün texniki və təşkilati tədbirlər görür.",
      "6.3. Məlumatlara yalnız səlahiyyətli əməkdaşlar çıxış əldə edə bilər."
    ]
  },
  {
    h: "7. Cookies və oxşar texnologiyalar",
    body: [
      "7.1. Platforma cookies və oxşar texnologiyalardan istifadə edə bilər:",
      ["İstifadəçi təcrübəsinin yaxşılaşdırılması", "Təhlükəsizlik", "Analitika", "Reklam"],
      "7.2. İstifadəçi brauzer parametrləri vasitəsilə cookies-i idarə edə və ya bloklaya bilər.",
      "7.3. Cookies şəxsi məlumatları birbaşa saxlamır, lakin istifadəçi təcrübəsini fərdiləşdirmək üçün istifadə oluna bilər."
    ]
  },
  {
    h: "8. Məlumatların saxlanma müddəti",
    body: [
      "8.1. Şəxsi məlumatlar yalnız emal məqsədi üçün zəruri olan müddət ərzində saxlanılır.",
      "8.2. Hesab silindikdən sonra məlumatlar qanunvericiliyin tələb etdiyi müddət istisna olmaqla silinir və ya anonimləşdirilir."
    ]
  },
  {
    h: "9. Məxfilik Siyasətinə dəyişikliklər",
    body: [
      "9.1. Homora.ai bu Məxfilik Siyasətini yeniləmək hüququnu özündə saxlayır.",
      "9.2. Dəyişikliklər platformada dərc edildiyi andan qüvvəyə minir.",
      "9.3. Platformadan istifadəni davam etdirməklə istifadəçi yenilənmiş siyasəti qəbul etmiş sayılır."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 80px", lineHeight: 1.7 }}>
      <Link href="/login" style={{ color: "hsl(var(--primary))", fontSize: 14, fontWeight: 600 }}>← Geri</Link>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: "16px 0 6px", letterSpacing: "-0.02em" }}>Məxfilik Siyasəti</h1>
      <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 13, marginBottom: 28 }}>Son yenilənmə tarixi: 03 / 03 / 2026</p>
      {SECTIONS.map((s) => (
        <section key={s.h} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>{s.h}</h2>
          {s.body.map((b, i) =>
            Array.isArray(b) ? (
              <ul key={i} style={{ margin: "0 0 8px", paddingLeft: 22, listStyle: "disc" }}>
                {b.map((li, j) => <li key={j} style={{ marginBottom: 3 }}>{li}</li>)}
              </ul>
            ) : (
              <p key={i} style={{ margin: "0 0 8px" }}>{b}</p>
            )
          )}
        </section>
      ))}
    </main>
  );
}
