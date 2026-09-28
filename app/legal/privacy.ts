import type { LegalDocSet } from "./types";

/**
 * Məxfilik siyasəti. Hər iddia kodla yoxlanıb: saxlama müddətləri
 * `backend/src/db/auth-security.ts` (cleanupExpiredSecurityData), silmə
 * `routes/auth.ts` (DELETE /account), ixrac `db/account-export.ts`.
 * Mətni dəyişəndə `legal/version.ts` və backend `lib/legal.ts` versiyasını artır.
 */
export const privacyPolicy: LegalDocSet = {
  az: {
    title: "Məxfilik siyasəti",
    lead: "Bu sənəd EduRate platformasının hansı fərdi məlumatları topladığını, onlardan nə üçün və necə istifadə etdiyini, kimlərlə paylaşdığını, nə qədər saxladığını və sənin hansı hüquqlara malik olduğunu izah edir.",
    sections: [
      {
        id: "operator",
        title: "1. Məlumatların sahibi və operatoru",
        blocks: [
          { p: "EduRate (bundan sonra — «Platforma», «biz») Qarabağ Universitetinin tələbələri, müəllimləri və mentorları üçün hazırlanmış müstəqil tələbə pilot layihəsidir. Platforma universitetin rəsmi informasiya sistemi deyil və universitetin adından fəaliyyət göstərmir." },
          { p: "Fərdi məlumatların operatoru fiziki şəxs Rəsul Şəfilidir (fərdi layihə). Məxfilik, fərdi məlumatlar və bu siyasətlə bağlı bütün müraciətlər üçün əlaqə ünvanı: edurate111@gmail.com." },
          { p: "Bu siyasət Azərbaycan Respublikasının «Fərdi məlumatlar haqqında» Qanununa və «İnformasiya, informasiyalaşdırma və informasiyanın mühafizəsi haqqında» Qanununa uyğun hazırlanıb. Siyasətdə işlənən «fərdi məlumat», «subyekt», «emal» və «operator» anlayışları həmin qanunlardakı mənada başa düşülür." },
        ],
      },
      {
        id: "scope",
        title: "2. Tətbiq dairəsi",
        blocks: [
          { p: "Siyasət EduRate veb saytına, onun mobil (PWA) versiyasına, platformanın API-sinə və platformanın göndərdiyi e-poçt və push bildirişlərinə şamil olunur. Platformadakı linklər vasitəsilə keçdiyin üçüncü tərəf saytları (məsələn, universitetin saytı) öz məxfilik qaydalarına tabedir." },
          { p: "Qeydiyyatdan keçməklə və ya platformadan istifadə etməklə bu siyasətlə tanış olduğunu təsdiq edirsən. Siyasət İstifadə şərtlərinin, Kuki siyasətinin və İcma qaydalarının ayrılmaz hissəsidir." },
        ],
      },
      {
        id: "data",
        title: "3. Topladığımız məlumatlar",
        blocks: [
          { p: "Yalnız platformanın işləməsi üçün lazım olan məlumatları toplayırıq. Şəxsiyyət vəsiqəsi, FİN kod, telefon nömrəsi, ünvan, bank kartı, sağlamlıq, din, siyasi baxış kimi xüsusi kateqoriyalı məlumatları soruşmuruq — onları platformaya yazma." },
          {
            table: {
              head: ["Kateqoriya", "Nümunələr", "Mənbə"],
              rows: [
                ["Hesab məlumatları", "Ad və soyad, e-poçt ünvanı, hesab növü (tələbə/müəllim/mentor), universitet, fakültə, ixtisas", "Qeydiyyat zamanı sən"],
                ["Şifrə", "Şifrə açıq şəkildə saxlanmır — yalnız bcrypt ilə geri qaytarılmayan heşi", "Sən"],
                ["Profil məlumatları", "Kurs, şəhər, «haqqımda» mətni, profil şəkli", "Profili redaktə edəndə sən"],
                ["Paylaşdığın məzmun", "Müəllim rəyləri və qiymətləri, kampus sualları və cavablar, elanlara şərhlər, reaksiyalar, klub və tədbir təklifləri, elanlar, bazar elanları, dəstək müraciətləri, şikayətlər", "Sən"],
                ["Yazışmalar", "Söhbətlərdə göndərdiyin mesajlar, reaksiyalar, oxunma vaxtı", "Sən və həmsöhbətin"],
                ["Əlaqələr və fəaliyyət", "Əlaqə sorğuları, klub üzvlükləri, tədbir qeydiyyatları, mentorluq müraciətləri, dərs cədvəli", "Sən"],
                ["Bildirişlər", "Platformadaxili bildirişlər və push abunəliyi (brauzerin verdiyi texniki ünvan və açarlar)", "Sistem və sən"],
                ["Təhlükəsizlik məlumatları", "Aktiv sessiyalar: IP ünvanı, brauzer/cihaz (user-agent), giriş vaxtı; uğursuz giriş cəhdlərinin sayı; iki mərhələli doğrulama açarı (aktiv edilibsə)", "Brauzerin və sistem"],
                ["Razılıq qeydləri", "Qəbul etdiyin İstifadə şərtləri və Məxfilik siyasətinin versiyası və tarixi, kuki seçimi", "Sən"],
                ["Anonim statistika", "Yalnız kukilərə razılıq versən: səhifə baxışlarının ümumi sayı (Vercel Analytics, kuki və şəxsi identifikator olmadan)", "Brauzerin"],
              ],
            },
          },
          { p: "Platforma avtomatlaşdırılmış qərar qəbulu və ya profilləşdirmə (səni haqqında hüquqi nəticə doğuran avtomatik qərarlar) aparmır. Reklam göstərmirik və məlumatlarını reklam məqsədilə istifadə etmirik." },
        ],
      },
      {
        id: "purposes",
        title: "4. Məqsədlər və hüquqi əsaslar",
        blocks: [
          { p: "Fərdi məlumatları yalnız aşağıdakı konkret məqsədlər üçün və hər məqsədə uyğun hüquqi əsasla emal edirik:" },
          {
            table: {
              head: ["Məqsəd", "Hüquqi əsas"],
              rows: [
                ["Hesab yaratmaq, girişi təmin etmək, profili göstərmək", "Sənin razılığın və İstifadə şərtlərinin icrası"],
                ["Rəy, sual, şərh, mesaj və digər funksiyaların işləməsi", "İstifadə şərtlərinin icrası"],
                ["Bildirişlər (platformadaxili, push, e-poçt)", "İstifadə şərtlərinin icrası; push üçün ayrıca razılığın"],
                ["Hesabın təhlükəsizliyi: sessiyaların idarəsi, şifrə sındırma cəhdlərinin qarşısının alınması, sui-istifadənin aşkarlanması", "Platformanın və istifadəçilərin qanuni marağı"],
                ["Moderasiya: şikayətlərə baxmaq, qaydaları pozan məzmunu gizlətmək", "Qanuni maraq və İcma qaydalarının icrası"],
                ["Dəstək müraciətlərinə cavab vermək", "Sənin müraciətin (razılıq)"],
                ["Anonim ziyarət statistikası", "Yalnız kuki bannerində verdiyin razılıq"],
                ["Dövlət orqanlarının qanuni tələblərinin icrası", "Qanunvericilikdən irəli gələn öhdəlik"],
              ],
            },
          },
          { p: "Razılığa əsaslanan emal üçün razılığını istənilən vaxt geri götürə bilərsən (bax: 10-cu bölmə). Bu, geri götürülənə qədər aparılmış emalın qanuniliyinə təsir etmir." },
        ],
      },
      {
        id: "visibility",
        title: "5. Məlumatların kimə görünür",
        blocks: [
          { ul: [
            "Profilin (ad, universitet, fakültə, ixtisas, kurs, «haqqımda», profil şəkli) platformaya daxil olmuş digər istifadəçilərə görünə bilər. E-poçt ünvanın digər istifadəçilərə göstərilmir.",
            "Müəllim rəyləri müəllifin adı göstərilmədən, «Təsdiqlənmiş EduRate hesabı» kimi dərc olunur.",
            "Kampus sualları və cavablar digər istifadəçilərə müəllif adı olmadan göstərilir.",
            "Elana şərh yazanda «Anonim göndər» seçimini etsən, adın və şəklin digər istifadəçilərə göstərilmir və API cavablarında ümumiyyətlə yer almır.",
            "Mesajları yalnız söhbətin iştirakçıları görür. Klub üzvlərinin adları klub səhifəsində digər üzvlərə və ziyarətçilərə görünə bilər.",
            "Mentorluq müraciəti yalnız seçdiyin mentora və administratorlara görünür.",
          ] },
          { note: "Anonimlik digər istifadəçilərə qarşıdır. Anonim məzmunun müəllifi sistemdə qeyd olunur ki, moderasiya, sui-istifadənin qarşısının alınması və qanunla nəzərdə tutulmuş hallarda səlahiyyətli orqanların tələbi icra oluna bilsin. Bu məlumat heç bir halda digər istifadəçilərə açıqlanmır." },
          { p: "Administratorlar və moderatorlar yalnız öz vəzifələri (təsdiq, moderasiya, dəstək) üçün zəruri olan məlumatlara çıxış əldə edirlər və bu hərəkətlər audit jurnalında qeyd olunur." },
        ],
      },
      {
        id: "processors",
        title: "6. Xidmət təminatçıları (məlumatların ötürülməsi)",
        blocks: [
          { p: "Fərdi məlumatlarını satmırıq və reklam şirkətlərinə vermirik. Platformanın texniki işləməsi üçün aşağıdakı xidmət təminatçılarından istifadə edirik. Onlar məlumatları yalnız bizim tapşırığımızla və öz təhlükəsizlik öhdəlikləri çərçivəsində emal edirlər:" },
          {
            table: {
              head: ["Təminatçı", "Nə üçün", "Hansı məlumatlar"],
              rows: [
                ["Vercel Inc. (ABŞ)", "Veb saytın yerləşdirilməsi və çatdırılması; razılıq verilərsə anonim statistika", "Sorğu məlumatları (IP, brauzer), razılıqla anonim baxış sayı"],
                ["Render Services, Inc. (ABŞ)", "Backend server və PostgreSQL verilənlər bazası", "Platformadakı bütün hesab və məzmun məlumatları"],
                ["Cloudinary Ltd.", "Profil, klub və elan şəkillərinin saxlanması", "Yüklədiyin şəkillər"],
                ["Resend / Brevo", "Hesab e-poçtları: e-poçtun təsdiqi, şifrənin bərpası, hesab bildirişləri", "Ad, e-poçt ünvanı, məktubun mətni"],
                ["Brauzer push xidmətləri (Google, Mozilla, Apple, Microsoft)", "Push bildirişlərinin cihazına çatdırılması (yalnız icazə versən)", "Brauzerin push ünvanı və bildirişin mətni"],
              ],
            },
          },
          { p: "Məlumatlar səlahiyyətli dövlət orqanlarına yalnız qanunla nəzərdə tutulmuş hallarda və qaydada, yazılı və əsaslandırılmış tələb əsasında verilə bilər." },
        ],
      },
      {
        id: "transfer",
        title: "7. Məlumatların ölkə xaricinə ötürülməsi",
        blocks: [
          { p: "Yuxarıdakı təminatçıların serverləri Azərbaycan Respublikasından kənarda (əsasən ABŞ və Avropa İttifaqında) yerləşir. Qeydiyyatdan keçərkən və platformadan istifadə edərkən məlumatlarının platformanın işləməsi üçün zəruri həcmdə bu serverlərə ötürülməsinə razılıq vermiş olursan." },
          { p: "Ötürmə zamanı məlumatlar şifrələnmiş (HTTPS/TLS) kanalla göndərilir və təminatçılar tanınmış təhlükəsizlik standartlarına əməl edirlər. Ötürmənin dövlət təhlükəsizliyinə təhlükə yaratdığı və ya qanunla qadağan olunduğu hallarda ötürmə aparılmır." },
        ],
      },
      {
        id: "retention",
        title: "8. Saxlama müddətləri",
        blocks: [
          { p: "Məlumatları yalnız məqsəd üçün lazım olduğu müddətdə saxlayırıq. Aşağıdakı müddətlər platformada avtomatik təmizləmə işi ilə (hər 6 saatdan bir) tətbiq olunur:" },
          {
            table: {
              head: ["Məlumat", "Müddət"],
              rows: [
                ["Hesab və profil məlumatları", "Hesab aktiv olduğu müddətdə; hesab silinəndə dərhal anonimləşdirilir"],
                ["Giriş sessiyası (IP, brauzer)", "Sessiya 30 gün etibarlıdır; bitdikdən 7 gün, çıxış edildikdən 30 gün sonra silinir"],
                ["Uğursuz giriş cəhdləri, giriş kodları", "1 gün"],
                ["E-poçt təsdiqi və şifrə bərpası tokenləri", "İstifadədən 7 gün, vaxtı bitdikdən 1 gün sonra"],
                ["Bildirişlər", "Hər istifadəçi üçün son 100 bildiriş; oxunmuş bildirişlər 180 gün"],
                ["Baxılıb bağlanmış şikayətlər", "180 gün"],
                ["Həll olunmuş dəstək müraciətləri", "2 il"],
                ["Administrator hərəkətlərinin audit jurnalı", "1 il"],
                ["Kuki seçimi, dil seçimi", "Brauzerində, sən silənə qədər (dil — 1 il)"],
                ["Ehtiyat nüsxələr", "Hosting təminatçısının ehtiyat nüsxə dövrü ərzində; sonra avtomatik yenilənir"],
              ],
            },
          },
          { p: "Rəylər, suallar, şərhlər və mesajlar sən onları silənə və ya hesabını silənə qədər saxlanılır. Sildiyin mesajın mətni bazadan dərhal təmizlənir." },
        ],
      },
      {
        id: "deletion",
        title: "9. Hesabın silinməsi",
        blocks: [
          { p: "Hesabını istənilən vaxt «Ayarlar → Hesabı sil» bölməsindən, şifrəni təsdiq etməklə silə bilərsən. Silinmə geri qaytarılmır. Silinən anda:" },
          { ul: [
            "adın, e-poçtun, şifrən və bütün profil sahələrin silinərək «Silinmiş istifadəçi» ilə əvəz olunur və hesaba giriş bağlanır;",
            "bütün aktiv sessiyaların ləğv olunur;",
            "profil şəklin həm bazadan, həm şəkil yaddaşından (Cloudinary) silinir;",
            "push abunəliklərin və bildirişlərin silinir;",
            "müəllim və ya mentor profilin kataloqdan çıxarılır.",
          ] },
          { p: "İcmanın bütövlüyü üçün yazdığın rəylər, cavablar və mesajlar silinmir, lakin artıq sənin adınla deyil, «Silinmiş istifadəçi» kimi görünür. Onların da silinməsini istəyirsənsə, hesabı silməzdən əvvəl özün silə və ya edurate111@gmail.com ünvanına yaza bilərsən." },
        ],
      },
      {
        id: "rights",
        title: "10. Sənin hüquqların",
        blocks: [
          { p: "«Fərdi məlumatlar haqqında» Qanuna əsasən, subyekt kimi aşağıdakı hüquqlara maliksən:" },
          { ul: [
            "Tanış olmaq: haqqında hansı məlumatların toplandığını, emalın məqsədini, hüquqi əsasını, müddətini və məlumatların kimlərə verildiyini bilmək. «Ayarlar → Məxfilik və məlumatlarım → Məlumatlarımı yüklə» düyməsi ilə bütün məlumatlarının surətini dərhal JSON faylı kimi ala bilərsən.",
            "Düzəliş: yanlış və ya natamam məlumatları düzəltmək — profil məlumatlarını «Profil» bölməsindən özün dəyişə bilərsən.",
            "Silmə və məhv etmə: məlumatlarının silinməsini tələb etmək — «Hesabı sil» funksiyası və ya müraciət vasitəsilə.",
            "Razılığı geri götürmək: kuki razılığını istənilən vaxt «Kuki ayarları» ilə, push bildirişlərini «Ayarlar»dan söndürmək; hesab emalına razılığı hesabı silməklə geri götürmək.",
            "Etiraz: qanuni marağa əsaslanan emala etiraz etmək.",
            "Emalın məhdudlaşdırılması: mübahisəli məlumatın emalının yoxlama dövründə dayandırılmasını tələb etmək.",
            "Şikayət: hüquqlarının pozulduğunu düşünürsənsə, fərdi məlumatlar sahəsində səlahiyyətli dövlət orqanına və ya məhkəməyə müraciət etmək.",
          ] },
          { p: "Hüquqlarını həyata keçirmək üçün edurate111@gmail.com ünvanına və ya «Dəstək → Məxfilik və fərdi məlumatlar» mövzusu ilə yaz. Müraciətə qanunla müəyyən edilmiş müddətdə, adətən 7 iş günü ərzində cavab veririk. Başqasının məlumatlarını qorumaq üçün müraciət edənin hesab sahibi olduğunu yoxlaya bilərik." },
        ],
      },
      {
        id: "security",
        title: "11. Təhlükəsizlik tədbirləri",
        blocks: [
          { ul: [
            "Bütün bağlantılar HTTPS/TLS ilə şifrələnir.",
            "Şifrələr bcrypt heşi ilə saxlanır; heç kim, o cümlədən administrator, şifrəni görə bilmir.",
            "Giriş tokeni JavaScript-in oxuya bilmədiyi httpOnly kukidə saxlanır; saytlararası sorğu saxtakarlığına (CSRF) qarşı mənbə yoxlanışı aparılır.",
            "Uğursuz giriş cəhdləri sayılır və hesab müvəqqəti bloklanır; sorğu limitləri tətbiq olunur.",
            "Şifrə bərpa ediləndə və hesab silinəndə bütün aktiv sessiyalar dərhal ləğv olunur.",
            "Administrator hərəkətləri audit jurnalına yazılır; çıxış rollara görə məhdudlaşdırılır.",
          ] },
          { p: "Heç bir sistem mütləq təhlükəsiz deyil. Fərdi məlumatlarına təsir edən təhlükəsizlik insidenti baş verərsə, bundan xəbər tutduqdan sonra ağlabatan müddətdə səni platforma və ya e-poçt vasitəsilə məlumatlandıracaq və zərəri azaltmaq üçün tədbir görəcəyik." },
        ],
      },
      {
        id: "age",
        title: "12. Yaş həddi",
        blocks: [
          { p: "Platforma 16 yaşı tamam olmuş şəxslər üçündür. Qeydiyyat zamanı 16 yaşının tamam olduğunu təsdiq edirsən. 16 yaşından kiçik şəxsin qanuni nümayəndəsinin razılığı olmadan qeydiyyatdan keçdiyini öyrənsək, hesabı bağlayıb məlumatları silirik. Valideyn və ya qanuni nümayəndə bu barədə edurate111@gmail.com ünvanına yaza bilər." },
        ],
      },
      {
        id: "cookies",
        title: "13. Kukilər və brauzer yaddaşı",
        blocks: [
          { p: "Girişi saxlamaq üçün zəruri kuki, dil seçimi üçün funksional kuki və yalnız razılıqla anonim statistika istifadə olunur. Ətraflı siyahı və müddətlər Kuki siyasətindədir. Seçimini istənilən vaxt səhifənin aşağısındakı «Kuki ayarları» ilə dəyişə bilərsən." },
        ],
      },
      {
        id: "changes",
        title: "14. Siyasətdəki dəyişikliklər",
        blocks: [
          { p: "Siyasəti platformanın funksiyaları və ya qanunvericilik dəyişdikcə yeniləyə bilərik. Hər versiyanın tarixi səhifənin yuxarısında göstərilir. Mahiyyətcə vacib dəyişikliklərdə növbəti girişində yenilənmiş sənədləri yenidən qəbul etməyin istənəcək; qəbul etmədən hesabından çıxa və ya onu silə bilərsən." },
        ],
      },
      {
        id: "contact",
        title: "15. Əlaqə",
        blocks: [
          { p: "Operator: Rəsul Şəfili (EduRate, fərdi layihə). E-poçt: edurate111@gmail.com. Platforma daxilində: «Dəstək» bölməsi, «Məxfilik və fərdi məlumatlar» mövzusu." },
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    lead: "This document explains what personal data the EduRate platform collects, why and how we use it, who we share it with, how long we keep it and what rights you have.",
    sections: [
      {
        id: "operator",
        title: "1. Data controller and operator",
        blocks: [
          { p: "EduRate (the “Platform”, “we”) is an independent student pilot project built for students, teachers and mentors of Karabakh University. The Platform is not the university's official information system and does not act on the university's behalf." },
          { p: "The operator of personal data is Rasul Shafili, a private individual (personal project). For any request about privacy, personal data or this policy, contact: edurate111@gmail.com." },
          { p: "This policy is prepared in accordance with the Law of the Republic of Azerbaijan “On Personal Data” and the Law “On Information, Informatization and Protection of Information”. The terms “personal data”, “data subject”, “processing” and “operator” have the meaning given in those laws." },
        ],
      },
      {
        id: "scope",
        title: "2. Scope",
        blocks: [
          { p: "The policy applies to the EduRate website, its installable (PWA) version, the Platform's API and the e-mails and push notifications the Platform sends. Third-party websites you reach through links (for example, the university website) are governed by their own privacy rules." },
          { p: "By registering or using the Platform you confirm that you have read this policy. It forms an integral part of the Terms of Use, the Cookie Policy and the Community Guidelines." },
        ],
      },
      {
        id: "data",
        title: "3. Data we collect",
        blocks: [
          { p: "We only collect the data needed to run the Platform. We do not ask for ID documents, personal identification numbers, phone numbers, home addresses, bank cards or special categories of data such as health, religion or political views — please do not post them on the Platform." },
          {
            table: {
              head: ["Category", "Examples", "Source"],
              rows: [
                ["Account data", "First and last name, e-mail address, account type (student/teacher/mentor), university, faculty, programme", "You, at registration"],
                ["Password", "Never stored in plain text — only an irreversible bcrypt hash", "You"],
                ["Profile data", "Year of study, city, “about me” text, profile photo", "You, when editing your profile"],
                ["Content you share", "Teacher reviews and ratings, campus questions and answers, announcement comments, reactions, club and event proposals, announcements, marketplace listings, support requests, reports", "You"],
                ["Messages", "Messages you send in chats, reactions, read times", "You and the people you chat with"],
                ["Connections and activity", "Connection requests, club memberships, event registrations, mentorship requests, class timetable", "You"],
                ["Notifications", "In-app notifications and push subscription (technical address and keys issued by your browser)", "The system and you"],
                ["Security data", "Active sessions: IP address, browser/device (user agent), sign-in time; number of failed sign-in attempts; two-factor secret (if enabled)", "Your browser and the system"],
                ["Consent records", "The version and date of the Terms and Privacy Policy you accepted, your cookie choice", "You"],
                ["Anonymous statistics", "Only if you accept cookies: aggregate page-view counts (Vercel Analytics, without cookies or personal identifiers)", "Your browser"],
              ],
            },
          },
          { p: "The Platform does not carry out automated decision-making or profiling that produces legal effects about you. We show no advertising and never use your data for advertising." },
        ],
      },
      {
        id: "purposes",
        title: "4. Purposes and legal bases",
        blocks: [
          { p: "We process personal data only for the specific purposes below, each with an appropriate legal basis:" },
          {
            table: {
              head: ["Purpose", "Legal basis"],
              rows: [
                ["Creating your account, signing you in, displaying your profile", "Your consent and performance of the Terms of Use"],
                ["Running reviews, questions, comments, messages and other features", "Performance of the Terms of Use"],
                ["Notifications (in-app, push, e-mail)", "Performance of the Terms of Use; separate consent for push"],
                ["Account security: managing sessions, preventing password-guessing, detecting abuse", "Legitimate interest of the Platform and its users"],
                ["Moderation: reviewing reports, hiding content that breaks the rules", "Legitimate interest and enforcement of the Community Guidelines"],
                ["Answering support requests", "Your request (consent)"],
                ["Anonymous visit statistics", "Only the consent you give in the cookie banner"],
                ["Complying with lawful requests of state authorities", "Legal obligation"],
              ],
            },
          },
          { p: "Where processing relies on consent you can withdraw it at any time (see section 10). Withdrawal does not affect the lawfulness of processing before it." },
        ],
      },
      {
        id: "visibility",
        title: "5. Who can see your data",
        blocks: [
          { ul: [
            "Your profile (name, university, faculty, programme, year, “about me”, photo) may be visible to other signed-in users. Your e-mail address is never shown to other users.",
            "Teacher reviews are published without the author's name, as “Verified EduRate account”.",
            "Campus questions and answers are shown to other users without the author's name.",
            "If you choose “Post anonymously” when commenting on an announcement, your name and photo are not shown to other users and are not included in API responses at all.",
            "Messages are visible only to the participants of the conversation. Club members' names may be visible to other members and visitors on the club page.",
            "A mentorship request is visible only to the mentor you chose and to administrators.",
          ] },
          { note: "Anonymity applies towards other users. The author of anonymous content is recorded in the system so that moderation, abuse prevention and, where required by law, requests from competent authorities can be handled. This information is never disclosed to other users." },
          { p: "Administrators and moderators access only the data they need for their duties (approval, moderation, support), and their actions are recorded in an audit log." },
        ],
      },
      {
        id: "processors",
        title: "6. Service providers (data sharing)",
        blocks: [
          { p: "We do not sell your personal data or give it to advertisers. To run the Platform we use the service providers below. They process data only on our instructions and under their own security obligations:" },
          {
            table: {
              head: ["Provider", "Purpose", "Data"],
              rows: [
                ["Vercel Inc. (USA)", "Hosting and delivering the website; anonymous statistics if you consent", "Request data (IP, browser); anonymous view counts with consent"],
                ["Render Services, Inc. (USA)", "Backend server and PostgreSQL database", "All account and content data on the Platform"],
                ["Cloudinary Ltd.", "Storing profile, club and announcement images", "Images you upload"],
                ["Resend / Brevo", "Account e-mails: e-mail verification, password recovery, account notices", "Name, e-mail address, message content"],
                ["Browser push services (Google, Mozilla, Apple, Microsoft)", "Delivering push notifications to your device (only if you allow it)", "Your browser's push address and the notification text"],
              ],
            },
          },
          { p: "Data may be disclosed to competent state authorities only in the cases and manner provided by law, on the basis of a written and substantiated request." },
        ],
      },
      {
        id: "transfer",
        title: "7. Cross-border transfer",
        blocks: [
          { p: "The servers of the providers above are located outside the Republic of Azerbaijan (mainly in the USA and the European Union). By registering and using the Platform you consent to your data being transferred to these servers to the extent necessary to run the Platform." },
          { p: "Data is transferred over encrypted (HTTPS/TLS) connections and the providers follow recognised security standards. No transfer takes place where it would threaten national security or is prohibited by law." },
        ],
      },
      {
        id: "retention",
        title: "8. Retention periods",
        blocks: [
          { p: "We keep data only as long as needed for its purpose. The periods below are enforced by an automatic clean-up job that runs every 6 hours:" },
          {
            table: {
              head: ["Data", "Period"],
              rows: [
                ["Account and profile data", "While the account is active; anonymised immediately when the account is deleted"],
                ["Sign-in sessions (IP, browser)", "A session is valid for 30 days; deleted 7 days after expiry or 30 days after sign-out"],
                ["Failed sign-in attempts, sign-in codes", "1 day"],
                ["E-mail verification and password recovery tokens", "7 days after use, 1 day after expiry"],
                ["Notifications", "The latest 100 per user; read notifications 180 days"],
                ["Closed reports", "180 days"],
                ["Resolved support requests", "2 years"],
                ["Audit log of administrator actions", "1 year"],
                ["Cookie choice, language choice", "In your browser until you clear it (language — 1 year)"],
                ["Backups", "For the hosting provider's backup cycle, then overwritten automatically"],
              ],
            },
          },
          { p: "Reviews, questions, comments and messages are kept until you delete them or delete your account. When you delete a message, its text is removed from the database immediately." },
        ],
      },
      {
        id: "deletion",
        title: "9. Deleting your account",
        blocks: [
          { p: "You can delete your account at any time under “Settings → Delete account” by confirming your password. Deletion cannot be undone. At that moment:" },
          { ul: [
            "your name, e-mail, password and all profile fields are erased and replaced with “Deleted user”, and sign-in is disabled;",
            "all your active sessions are revoked;",
            "your profile photo is deleted from the database and from image storage (Cloudinary);",
            "your push subscriptions and notifications are deleted;",
            "your teacher or mentor profile is removed from the directory.",
          ] },
          { p: "To keep the community's history intact, your reviews, answers and messages are not deleted but are shown as “Deleted user” instead of your name. If you want them removed too, delete them yourself before deleting the account or write to edurate111@gmail.com." },
        ],
      },
      {
        id: "rights",
        title: "10. Your rights",
        blocks: [
          { p: "Under the Law “On Personal Data”, as a data subject you have the right to:" },
          { ul: [
            "Access: know what data is collected about you, the purpose, legal basis and period of processing and who receives it. Use “Settings → Privacy and my data → Download my data” to get an instant copy of all your data as a JSON file.",
            "Rectification: correct inaccurate or incomplete data — you can edit your profile yourself under “Profile”.",
            "Erasure: request deletion of your data — via “Delete account” or a request to us.",
            "Withdraw consent: withdraw cookie consent at any time via “Cookie settings”, turn off push notifications in “Settings”, and withdraw consent to account processing by deleting your account.",
            "Object: object to processing based on legitimate interest.",
            "Restriction: ask us to suspend processing of disputed data while it is being checked.",
            "Complaint: if you believe your rights have been violated, apply to the competent state authority for personal data or to a court.",
          ] },
          { p: "To exercise your rights, write to edurate111@gmail.com or use “Support → Privacy and personal data”. We reply within the period set by law, usually within 7 working days. To protect other people's data we may verify that the requester is the account holder." },
        ],
      },
      {
        id: "security",
        title: "11. Security measures",
        blocks: [
          { ul: [
            "All connections are encrypted with HTTPS/TLS.",
            "Passwords are stored as bcrypt hashes; nobody, including administrators, can see them.",
            "The sign-in token is kept in an httpOnly cookie that JavaScript cannot read; requests are checked for their origin to prevent cross-site request forgery (CSRF).",
            "Failed sign-in attempts are counted and the account is temporarily locked; rate limits apply.",
            "All active sessions are revoked immediately when the password is reset or the account is deleted.",
            "Administrator actions are written to an audit log; access is restricted by role.",
          ] },
          { p: "No system is absolutely secure. If a security incident affecting your personal data occurs, we will inform you through the Platform or by e-mail within a reasonable time after becoming aware of it and take steps to limit the harm." },
        ],
      },
      {
        id: "age",
        title: "12. Minimum age",
        blocks: [
          { p: "The Platform is intended for people aged 16 and over. At registration you confirm that you are at least 16. If we learn that a person under 16 has registered without the consent of a legal representative, we close the account and delete the data. A parent or legal representative can contact us at edurate111@gmail.com." },
        ],
      },
      {
        id: "cookies",
        title: "13. Cookies and browser storage",
        blocks: [
          { p: "We use a strictly necessary cookie to keep you signed in, a functional cookie for your language and — only with consent — anonymous statistics. The full list and durations are in the Cookie Policy. You can change your choice at any time via “Cookie settings” at the bottom of the page." },
        ],
      },
      {
        id: "changes",
        title: "14. Changes to this policy",
        blocks: [
          { p: "We may update this policy as the Platform's features or the law change. The date of each version is shown at the top of the page. For material changes you will be asked to accept the updated documents at your next visit; if you do not accept, you can sign out or delete your account." },
        ],
      },
      {
        id: "contact",
        title: "15. Contact",
        blocks: [
          { p: "Operator: Rasul Shafili (EduRate, personal project). E-mail: edurate111@gmail.com. On the Platform: “Support”, topic “Privacy and personal data”." },
        ],
      },
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    lead: "Этот документ объясняет, какие персональные данные собирает платформа EduRate, зачем и как мы их используем, кому передаём, как долго храним и какие у вас есть права.",
    sections: [
      {
        id: "operator",
        title: "1. Владелец и оператор данных",
        blocks: [
          { p: "EduRate («Платформа», «мы») — независимый студенческий пилотный проект для студентов, преподавателей и менторов Карабахского университета. Платформа не является официальной информационной системой университета и не действует от его имени." },
          { p: "Оператор персональных данных — физическое лицо Расул Шафили (личный проект). По всем вопросам конфиденциальности, персональных данных и этой политики пишите на edurate111@gmail.com." },
          { p: "Политика подготовлена в соответствии с Законом Азербайджанской Республики «О персональных данных» и Законом «Об информации, информатизации и защите информации». Термины «персональные данные», «субъект», «обработка» и «оператор» используются в значении этих законов." },
        ],
      },
      {
        id: "scope",
        title: "2. Сфера действия",
        blocks: [
          { p: "Политика распространяется на сайт EduRate, его устанавливаемую (PWA) версию, API платформы, а также на письма и push-уведомления, которые отправляет платформа. Сторонние сайты, на которые ведут ссылки (например, сайт университета), подчиняются собственным правилам." },
          { p: "Регистрируясь или пользуясь Платформой, вы подтверждаете, что ознакомились с этой политикой. Она является неотъемлемой частью Условий использования, Политики cookie и Правил сообщества." },
        ],
      },
      {
        id: "data",
        title: "3. Какие данные мы собираем",
        blocks: [
          { p: "Мы собираем только данные, необходимые для работы Платформы. Мы не запрашиваем удостоверение личности, ФИН, телефон, адрес, банковские карты и данные особых категорий (здоровье, религия, политические взгляды) — не публикуйте их на Платформе." },
          {
            table: {
              head: ["Категория", "Примеры", "Источник"],
              rows: [
                ["Данные аккаунта", "Имя и фамилия, e-mail, тип аккаунта (студент/преподаватель/ментор), университет, факультет, специальность", "Вы, при регистрации"],
                ["Пароль", "Не хранится в открытом виде — только необратимый хеш bcrypt", "Вы"],
                ["Данные профиля", "Курс, город, текст «о себе», фото профиля", "Вы, при редактировании профиля"],
                ["Ваш контент", "Отзывы и оценки преподавателей, вопросы и ответы кампуса, комментарии к объявлениям, реакции, предложения клубов и мероприятий, объявления, объявления маркетплейса, обращения в поддержку, жалобы", "Вы"],
                ["Переписка", "Отправленные вами сообщения, реакции, время прочтения", "Вы и ваш собеседник"],
                ["Связи и активность", "Запросы на связь, членство в клубах, регистрации на мероприятия, заявки на менторство, расписание", "Вы"],
                ["Уведомления", "Уведомления внутри платформы и push-подписка (технический адрес и ключи браузера)", "Система и вы"],
                ["Данные безопасности", "Активные сессии: IP-адрес, браузер/устройство (user agent), время входа; число неудачных попыток входа; ключ двухфакторной аутентификации (если включена)", "Ваш браузер и система"],
                ["Записи о согласии", "Версия и дата принятых Условий и Политики, выбор cookie", "Вы"],
                ["Анонимная статистика", "Только при согласии на cookie: общее число просмотров страниц (Vercel Analytics, без cookie и персональных идентификаторов)", "Ваш браузер"],
              ],
            },
          },
          { p: "Платформа не принимает автоматизированных решений и не проводит профилирование, влекущее для вас юридические последствия. Мы не показываем рекламу и не используем ваши данные в рекламных целях." },
        ],
      },
      {
        id: "purposes",
        title: "4. Цели и правовые основания",
        blocks: [
          { p: "Мы обрабатываем персональные данные только для следующих целей и на соответствующих основаниях:" },
          {
            table: {
              head: ["Цель", "Правовое основание"],
              rows: [
                ["Создание аккаунта, вход, показ профиля", "Ваше согласие и исполнение Условий использования"],
                ["Работа отзывов, вопросов, комментариев, сообщений и других функций", "Исполнение Условий использования"],
                ["Уведомления (внутри платформы, push, e-mail)", "Исполнение Условий; для push — отдельное согласие"],
                ["Безопасность аккаунта: управление сессиями, защита от подбора пароля, выявление злоупотреблений", "Законный интерес Платформы и пользователей"],
                ["Модерация: рассмотрение жалоб, скрытие нарушающего контента", "Законный интерес и исполнение Правил сообщества"],
                ["Ответы на обращения в поддержку", "Ваше обращение (согласие)"],
                ["Анонимная статистика посещений", "Только согласие в баннере cookie"],
                ["Исполнение законных требований государственных органов", "Обязанность по закону"],
              ],
            },
          },
          { p: "Согласие можно отозвать в любой момент (см. раздел 10). Отзыв не влияет на законность обработки до него." },
        ],
      },
      {
        id: "visibility",
        title: "5. Кто видит ваши данные",
        blocks: [
          { ul: [
            "Ваш профиль (имя, университет, факультет, специальность, курс, «о себе», фото) может быть виден другим вошедшим пользователям. Ваш e-mail другим пользователям не показывается.",
            "Отзывы о преподавателях публикуются без имени автора, как «Подтверждённый аккаунт EduRate».",
            "Вопросы и ответы кампуса показываются другим пользователям без имени автора.",
            "Если при комментировании объявления выбрать «Отправить анонимно», ваше имя и фото не показываются другим пользователям и вообще не попадают в ответы API.",
            "Сообщения видят только участники беседы. Имена членов клуба могут быть видны другим участникам и посетителям страницы клуба.",
            "Заявку на менторство видят только выбранный ментор и администраторы.",
          ] },
          { note: "Анонимность действует по отношению к другим пользователям. Автор анонимного контента фиксируется в системе, чтобы можно было проводить модерацию, предотвращать злоупотребления и в предусмотренных законом случаях исполнять требования компетентных органов. Эти сведения никогда не раскрываются другим пользователям." },
          { p: "Администраторы и модераторы получают доступ только к данным, необходимым для их обязанностей (одобрение, модерация, поддержка), и их действия записываются в журнал аудита." },
        ],
      },
      {
        id: "processors",
        title: "6. Поставщики услуг (передача данных)",
        blocks: [
          { p: "Мы не продаём ваши персональные данные и не передаём их рекламодателям. Для работы Платформы используются следующие поставщики. Они обрабатывают данные только по нашему поручению и в рамках своих обязательств по безопасности:" },
          {
            table: {
              head: ["Поставщик", "Для чего", "Какие данные"],
              rows: [
                ["Vercel Inc. (США)", "Размещение и доставка сайта; анонимная статистика при согласии", "Данные запроса (IP, браузер), при согласии — анонимные просмотры"],
                ["Render Services, Inc. (США)", "Сервер backend и база данных PostgreSQL", "Все данные аккаунтов и контента"],
                ["Cloudinary Ltd.", "Хранение фото профилей, клубов и объявлений", "Загружаемые вами изображения"],
                ["Resend / Brevo", "Письма аккаунта: подтверждение e-mail, восстановление пароля, уведомления", "Имя, e-mail, текст письма"],
                ["Push-сервисы браузеров (Google, Mozilla, Apple, Microsoft)", "Доставка push-уведомлений на устройство (только с вашего разрешения)", "Push-адрес браузера и текст уведомления"],
              ],
            },
          },
          { p: "Данные могут быть переданы компетентным государственным органам только в предусмотренных законом случаях и порядке, на основании письменного и обоснованного запроса." },
        ],
      },
      {
        id: "transfer",
        title: "7. Трансграничная передача",
        blocks: [
          { p: "Серверы указанных поставщиков находятся за пределами Азербайджанской Республики (в основном в США и Европейском союзе). Регистрируясь и пользуясь Платформой, вы соглашаетесь на передачу данных на эти серверы в объёме, необходимом для работы Платформы." },
          { p: "Данные передаются по зашифрованным каналам (HTTPS/TLS), поставщики соблюдают признанные стандарты безопасности. Передача не осуществляется, если она угрожает государственной безопасности или запрещена законом." },
        ],
      },
      {
        id: "retention",
        title: "8. Сроки хранения",
        blocks: [
          { p: "Мы храним данные только столько, сколько нужно для цели. Сроки ниже соблюдаются автоматической очисткой, которая запускается каждые 6 часов:" },
          {
            table: {
              head: ["Данные", "Срок"],
              rows: [
                ["Данные аккаунта и профиля", "Пока аккаунт активен; при удалении аккаунта сразу обезличиваются"],
                ["Сессии входа (IP, браузер)", "Сессия действует 30 дней; удаляется через 7 дней после истечения или 30 дней после выхода"],
                ["Неудачные попытки входа, коды входа", "1 день"],
                ["Токены подтверждения e-mail и восстановления пароля", "7 дней после использования, 1 день после истечения"],
                ["Уведомления", "Последние 100 на пользователя; прочитанные — 180 дней"],
                ["Рассмотренные жалобы", "180 дней"],
                ["Решённые обращения в поддержку", "2 года"],
                ["Журнал аудита действий администраторов", "1 год"],
                ["Выбор cookie и языка", "В вашем браузере, пока вы их не удалите (язык — 1 год)"],
                ["Резервные копии", "В течение цикла резервного копирования хостинга, затем перезаписываются"],
              ],
            },
          },
          { p: "Отзывы, вопросы, комментарии и сообщения хранятся, пока вы их не удалите или не удалите аккаунт. Текст удалённого сообщения сразу стирается из базы данных." },
        ],
      },
      {
        id: "deletion",
        title: "9. Удаление аккаунта",
        blocks: [
          { p: "Вы можете удалить аккаунт в любой момент в разделе «Настройки → Удалить аккаунт», подтвердив пароль. Удаление необратимо. В этот момент:" },
          { ul: [
            "ваши имя, e-mail, пароль и все поля профиля стираются и заменяются на «Удалённый пользователь», вход закрывается;",
            "все активные сессии завершаются;",
            "фото профиля удаляется из базы и из хранилища изображений (Cloudinary);",
            "push-подписки и уведомления удаляются;",
            "профиль преподавателя или ментора убирается из каталога.",
          ] },
          { p: "Для сохранности истории сообщества ваши отзывы, ответы и сообщения не удаляются, но показываются как «Удалённый пользователь». Если вы хотите удалить и их, сделайте это до удаления аккаунта или напишите на edurate111@gmail.com." },
        ],
      },
      {
        id: "rights",
        title: "10. Ваши права",
        blocks: [
          { p: "Согласно Закону «О персональных данных», как субъект данных вы имеете право:" },
          { ul: [
            "На доступ: знать, какие данные о вас собраны, цель, основание и срок обработки и кому они передаются. Кнопка «Настройки → Конфиденциальность и мои данные → Скачать мои данные» сразу выдаёт копию всех ваших данных в файле JSON.",
            "На исправление: исправить неточные или неполные данные — профиль можно изменить самостоятельно в разделе «Профиль».",
            "На удаление: потребовать удаления данных — через «Удалить аккаунт» или обращение к нам.",
            "На отзыв согласия: отозвать согласие на cookie через «Настройки cookie», отключить push в «Настройках», отозвать согласие на обработку аккаунта, удалив его.",
            "На возражение: возразить против обработки на основании законного интереса.",
            "На ограничение: потребовать приостановить обработку спорных данных на время проверки.",
            "На жалобу: если вы считаете, что ваши права нарушены, обратиться в компетентный государственный орган в сфере персональных данных или в суд.",
          ] },
          { p: "Чтобы воспользоваться правами, напишите на edurate111@gmail.com или через «Поддержка → Конфиденциальность и персональные данные». Мы отвечаем в установленный законом срок, обычно в течение 7 рабочих дней. Для защиты чужих данных мы можем проверить, что обратившийся — владелец аккаунта." },
        ],
      },
      {
        id: "security",
        title: "11. Меры безопасности",
        blocks: [
          { ul: [
            "Все соединения зашифрованы HTTPS/TLS.",
            "Пароли хранятся в виде хеша bcrypt; их никто не видит, включая администраторов.",
            "Токен входа хранится в httpOnly cookie, недоступном для JavaScript; запросы проверяются на источник для защиты от подделки межсайтовых запросов (CSRF).",
            "Неудачные попытки входа подсчитываются, аккаунт временно блокируется; действуют лимиты запросов.",
            "При восстановлении пароля и удалении аккаунта все активные сессии сразу завершаются.",
            "Действия администраторов записываются в журнал аудита; доступ ограничен ролями.",
          ] },
          { p: "Ни одна система не защищена абсолютно. Если произойдёт инцидент, затрагивающий ваши персональные данные, мы сообщим вам через Платформу или по e-mail в разумный срок после того, как узнаем о нём, и примем меры для снижения вреда." },
        ],
      },
      {
        id: "age",
        title: "12. Возрастное ограничение",
        blocks: [
          { p: "Платформа предназначена для лиц от 16 лет. При регистрации вы подтверждаете, что вам исполнилось 16 лет. Если мы узнаем, что лицо младше 16 лет зарегистрировалось без согласия законного представителя, мы закроем аккаунт и удалим данные. Родитель или законный представитель может написать на edurate111@gmail.com." },
        ],
      },
      {
        id: "cookies",
        title: "13. Cookie и хранилище браузера",
        blocks: [
          { p: "Мы используем строго необходимый cookie для входа, функциональный cookie для языка и — только с согласия — анонимную статистику. Полный список и сроки приведены в Политике cookie. Выбор можно изменить в любой момент через «Настройки cookie» внизу страницы." },
        ],
      },
      {
        id: "changes",
        title: "14. Изменения политики",
        blocks: [
          { p: "Мы можем обновлять политику при изменении функций Платформы или законодательства. Дата каждой версии указана вверху страницы. При существенных изменениях при следующем визите вас попросят принять обновлённые документы; если вы не согласны, вы можете выйти или удалить аккаунт." },
        ],
      },
      {
        id: "contact",
        title: "15. Контакты",
        blocks: [
          { p: "Оператор: Расул Шафили (EduRate, личный проект). E-mail: edurate111@gmail.com. На Платформе: раздел «Поддержка», тема «Конфиденциальность и персональные данные»." },
        ],
      },
    ],
  },
};
