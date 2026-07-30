// Qaydalar və Şərtlər — team #5. Content supplied by the team (AZ).
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Qaydalar və Şərtlər · Homora.ai" };

const SECTIONS: { h: string; body: (string | string[])[] }[] = [
  {
    h: "1. Xidmətin Təsviri",
    body: [
      "1.1. Homora.ai süni intellekt əsaslı daşınmaz əmlak analitika və mənzil qiymətləndirmə platformasıdır. Platforma istifadəçilərə yaşayış mənzillərinin təxmini bazar dəyəri, kirayə potensialı və sərmayə göstəricilərinin avtomatlaşdırılmış şəkildə hesablanması xidmətlərini təqdim edir.",
      "1.2. Qiymətləndirmə və analitika aşağıdakılara əsaslanır:",
      [
        "Açıq mənbələrdən əldə edilən daşınmaz əmlak elan və bazar məlumatları",
        "Coğrafi İnformasiya Sistemləri (GİS / GIS) məlumatları",
        "Son 12 ay üzrə satış və kirayə bazarı trendləri",
        "Homora.ai tərəfindən hazırlanmış maşın öyrənməsi, süni intellekt və statistik modellər"
      ],
      "1.3. Platformada təqdim olunan xidmətlərə aşağıdakılar daxil ola bilər:",
      [
        "Mənzillərin təxmini bazar dəyərinin hesablanması",
        "Kirayə gəliri və sərmayə potensialının analizi",
        "Gəlirlilik və Geri Ödəmə Müddəti (Payback Period) göstəricilərinin hesablanması",
        "Satış və kirayə bazar trendlərinin analitik təqdimatı",
        "Avtomatlaşdırılmış hesabatlar və müqayisəli analizlər"
      ],
      "1.4. Platformada təqdim olunan bütün nəticələr analitik və məlumatlandırma xarakteri daşıyır və rəsmi qiymətləndirmə, maliyyə və ya hüquqi sənəd hesab edilmir.",
      "1.5. Homora.ai adı, platforması, domeni, proqram təminatı, dizayn elementləri və süni intellekt modelləri Advanced AI Solutions MMC tərəfindən yaradılmış və idarə olunan məhsuldur. Bu məhsula dair bütün əqli mülkiyyət hüquqları mövcud qanunvericiliyə uyğun olaraq Advanced AI Solutions MMC-yə məxsusdur."
    ]
  },
  {
    h: "2. Məlumat Mənbələri və Dəqiqlik",
    body: [
      "2.1. Platformada istifadə olunan məlumatlar əsasən açıq və hamı üçün əlçatan mənbələrdən əldə edilir. Bu məlumatlar üçüncü şəxslər tərəfindən yerləşdirildiyinə səbəbindən natamam, köhnəlmiş və ya yanlış ola bilər.",
      "2.2. Xüsusi qeyd edilmədiyi hallarda, Homora.ai üçüncü tərəf elan saytları, dövlət qurumları və digər platformalarla rəsmi tərəfdaşlıq münasibətində deyil.",
      "2.3. Qiymətləndirmə və analitik nəticələr tarixi bazar məlumatlarına və modelləşdirməyə əsaslanır və təxmini xarakter daşıyır. Gələcək bazar nəticələri üçün zəmanət verilmir."
    ]
  },
  {
    h: "3. Süni İntellekt Modeli və Əhatə Məhdudiyyətləri",
    body: [
      "3.1. Qiymətləndirmə xidməti hazırda yalnız Azərbaycan Respublikası, Bakı şəhəri və Abşeron yarımadası ərazisini əhatə edir.",
      "3.2. Xidmət yalnız çoxmənzilli yaşayış binalarında yerləşən yeni və köhnə tikili mənzillər üçün nəzərdə tutulub.",
      "3.3. Platformada təqdim olunan qiymətləndirmələr və digər analitik nəticələr maşın öyrənməsi alqoritmləri və süni intellekt modelləri vasitəsilə hesablanır. Modellər aşağıdakı amilləri nəzərə ala bilməz və ya məhdud şəkildə nəzərə alır:",
      ["Bazarın ani dəyişikliklərini", "Mənzilin faktiki texniki vəziyyətini", "Hüquqi status fərqlərini"],
      "3.4. Platforma bu və ya digər səbəblərdən yaranan hər hansı uyğunsuzluq, səhv və ya itki üçün məsuliyyət daşımır."
    ]
  },
  {
    h: "4. Ödənişli Xidmətlər və Abunəliklər",
    body: [
      "4.1. Platformada xidmətlər aşağıdakı formada təklif edilə bilər:",
      ["Abunəlik əsaslı (aylıq / illik)", "Tək-tək (pay-per-use)"],
      "4.2. Yeni istifadəçilərə sınaq və ya hədiyyə paketləri təqdim edilə bilər. Bu paketlər məhdud funksionallıq və müddətə malikdir və Homora.ai tərəfindən dəyişdirilə və ya dayandırıla bilər.",
      "4.3. Abunəliklər istifadəçi tərəfindən ləğv edilmədiyi halda avtomatik yenilənə bilər. Ləğv növbəti ödəniş dövründən əvvəl edilməlidir.",
      "4.4. Ödənilmiş məbləğlər, qanunvericiliklə nəzərdə tutulmuş hallar istisna olmaqla, geri qaytarılmır."
    ]
  },
  {
    h: "5. İstifadəçinin Məsuliyyəti",
    body: [
      "5.1. İstifadəçi platformadan əldə etdiyi məlumatları yalnız şəxsi və ya daxili istifadə məqsədi ilə istifadə edə bilər.",
      "5.2. İstifadəçiyə qadağandır:",
      [
        "Homora.ai məlumatlarını öz adından satmaq və ya yenidən kommersiya məqsədilə paylaşmaq",
        "Bu məlumatlara əsaslanaraq üçüncü şəxslərə zəmanət və ya qarantiya vermək",
        "Homora.ai-ni rəsmi qiymətləndirici və ya tərəfdaş kimi təqdim etmək"
      ],
      "5.3. İstifadəçi platformadan istifadə etməklə qəbul etdiyi bütün qərarlara görə məsuliyyəti öz üzərinə götürür."
    ]
  },
  {
    h: "6. Hüquqi Məsuliyyətin Məhdudlaşdırılması",
    body: [
      '6.1. Platformada təqdim olunan bütün məlumatlar "olduğu kimi" prinsipi ilə təqdim olunur.',
      "6.2. Homora.ai aşağıdakılara görə məsuliyyət daşımır:",
      ["Qiymətləndirmə nəticələrinin dəqiqliyinə", "İnvestisiya və maliyyə qərarlarının nəticələrinə", "İtirilmiş gəlir və ya dolayı zərərlərə"],
      "6.3. Homora.ai-nin istifadəçi qarşısında maksimum məsuliyyəti, qanunvericiliyin icazə verdiyi həddə, istifadəçi tərəfindən müvafiq xidmət üçün faktiki ödənilmiş məbləğlə məhdudlaşır."
    ]
  },
  {
    h: "7. Qaydaların Dəyişdirilməsi",
    body: ["Homora.ai bu Qaydaları istənilən vaxt dəyişmək hüququnu özündə saxlayır. Yenilənmiş versiya platformada dərc edildiyi andan qüvvəyə minir."]
  },
  {
    h: "8. Tətbiq Olunan Hüquq",
    body: ["Bu Qaydalar Azərbaycan Respublikasının qanunvericiliyinə uyğun olaraq tənzimlənir."]
  },
  {
    h: "9. Əlaqə",
    body: ["Email ünvan: office@homora.ai"]
  }
];

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 80px", lineHeight: 1.7 }}>
      <Link href="/login" style={{ color: "hsl(var(--primary))", fontSize: 14, fontWeight: 600 }}>← Geri</Link>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: "16px 0 6px", letterSpacing: "-0.02em" }}>Qaydalar və Şərtlər</h1>
      <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 13, marginBottom: 20 }}>Son yenilənmə tarixi: 03 / 03 / 2026</p>
      <p style={{ marginBottom: 28 }}>
        Bu Qaydalar və Şərtlər (&quot;Qaydalar&quot;) Homora.ai platformasından (&quot;Platforma&quot;, &quot;Xidmət&quot;) istifadə edən bütün fiziki və hüquqi şəxslər üçün məcburidir. Platformadan istifadə etməklə istifadəçi bu Qaydaları tam və qeyd-şərtsiz qəbul etdiyini təsdiqləyir.
      </p>
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
