import type { LegalDocSet } from "./types";

/** İstifadə şərtləri. Dəyişəndə `legal/version.ts` və backend `lib/legal.ts` versiyasını artır. */
export const termsOfUse: LegalDocSet = {
  az: {
    title: "İstifadə şərtləri",
    lead: "Bu şərtlər EduRate platformasından istifadə qaydalarını, sənin və bizim hüquq və vəzifələrimizi müəyyən edir. Platformadan istifadə etməzdən əvvəl diqqətlə oxu.",
    sections: [
      {
        id: "acceptance",
        title: "1. Ümumi müddəalar və şərtlərin qəbulu",
        blocks: [
          { p: "EduRate (bundan sonra — «Platforma») Qarabağ Universitetinin tələbələri, müəllimləri və mentorları üçün müəllim rəyləri, kampus sualları, klublar, tədbirlər, mentorluq və yazışma imkanları təqdim edən müstəqil tələbə pilot layihəsidir. Platformanın operatoru fiziki şəxs Rəsul Şəfilidir (fərdi layihə), əlaqə: edurate111@gmail.com." },
          { p: "Qeydiyyat formasında «oxudum və qəbul edirəm» qutusunu işarələməklə və ya platformadan istifadə etməklə bu İstifadə şərtlərini, Məxfilik siyasətini, Kuki siyasətini və İcma qaydalarını (birlikdə — «Şərtlər») qəbul etmiş olursan. Şərtlərlə razı deyilsənsə, platformadan istifadə etmə." },
          { p: "Platforma universitetin rəsmi informasiya sistemi deyil və universitetin adından çıxış etmir. Platformadakı rəylər və qiymətləndirmələr universitetin rəsmi mövqeyi deyil." },
        ],
      },
      {
        id: "eligibility",
        title: "2. Kimlər istifadə edə bilər",
        blocks: [
          { ul: [
            "Platformadan 16 yaşı tamam olmuş şəxslər istifadə edə bilər. Qeydiyyatla 16 yaşının tamam olduğunu təsdiq edirsən.",
            "Tələbə hesabı universitetin tələbələri üçündür. Müəllim və mentor hesabları administrator təsdiqindən sonra aktivləşir.",
            "Hər şəxs yalnız bir hesab aça bilər. Başqasının adından, saxta və ya yanıltıcı məlumatla hesab açmaq qadağandır.",
            "Əvvəllər qaydaları pozduğu üçün hesabı bağlanmış şəxs icazəsiz yeni hesab aça bilməz.",
          ] },
        ],
      },
      {
        id: "account",
        title: "3. Hesab və təhlükəsizlik",
        blocks: [
          { ul: [
            "Qeydiyyatda düzgün və aktual məlumat verməli, dəyişdikdə profilini yeniləməlisən.",
            "Şifrəni gizli saxlamaq və başqası ilə paylaşmamaq sənin məsuliyyətindir. Hesabından edilən hərəkətlərə görə sən məsuliyyət daşıyırsan.",
            "Hesabının icazəsiz istifadə edildiyindən şübhələnsən, dərhal şifrəni dəyiş və edurate111@gmail.com ünvanına xəbər ver.",
            "Hesabını başqasına vermək, satmaq və ya ötürmək qadağandır.",
          ] },
        ],
      },
      {
        id: "acceptable-use",
        title: "4. İcazə verilən istifadə",
        blocks: [
          { p: "Platformadan yalnız qanuni məqsədlərlə və İcma qaydalarına uyğun istifadə edə bilərsən. Xüsusilə aşağıdakılar qadağandır:" },
          { ul: [
            "təhqir, hədə, təqib, nifrət nitqi, ayrı-seçkilik və zorakılığa çağırış;",
            "böhtan, yalan məlumat yaymaq və ya başqasının şərəf və ləyaqətini alçaltmaq;",
            "başqasının fərdi məlumatlarını (telefon, ünvan, şəkil, sənəd) onun razılığı olmadan yaymaq;",
            "spam, reklam, fırıldaqçılıq, kütləvi və ya avtomatlaşdırılmış mesaj göndərmək;",
            "müəllif hüquqlarını və digər əqli mülkiyyət hüquqlarını pozan məzmun paylaşmaq;",
            "imtahan suallarının, cavablarının sızdırılması və ya akademik dürüstlüyün pozulmasına kömək;",
            "platformanın təhlükəsizliyini yoxlamaq, sındırmaq, məlumat toplamaq (scraping), sorğu limitlərini aşmaq və ya işini pozmaq cəhdləri;",
            "başqa şəxs, müəllim, universitet və ya təşkilat adından çıxış etmək;",
            "Azərbaycan Respublikasının qanunvericiliyi ilə qadağan olunmuş hər hansı məzmun.",
          ] },
        ],
      },
      {
        id: "reviews",
        title: "5. Müəllim rəyləri",
        blocks: [
          { ul: [
            "Rəy yalnız həqiqətən dərs aldığın müəllim haqqında, öz şəxsi təcrübənə əsasən yazılmalıdır.",
            "Rəy tədris prosesinə (izah, obyektivlik, ünsiyyət, fənn biliyi) aid olmalıdır; müəllimin şəxsi həyatı, xarici görünüşü və ya ailəsi haqqında yazmaq qadağandır.",
            "Faktlar yoxlanıla bilən olmalıdır; sübutsuz ittihamlar (məsələn, rüşvət iddiası) rəydə deyil, müvafiq rəsmi orqanlara şikayət şəklində bildirilməlidir.",
            "Rəylər dərc olunmazdan əvvəl moderasiyadan keçə bilər və qaydalara uyğun olmayan rəy dərc edilməyə bilər.",
            "Rəy müəllifin adı göstərilmədən dərc olunur, lakin bu, sənin məzmuna görə məsuliyyətini aradan qaldırmır.",
          ] },
        ],
      },
      {
        id: "anonymous",
        title: "6. Anonim məzmun",
        blocks: [
          { p: "Kampus sualları və elanlara anonim şərhlər digər istifadəçilərə müəllif adı olmadan göstərilir. Anonimlik yalnız digər istifadəçilərə qarşıdır: müəllif sistemdə qeyd olunur və anonim məzmun da bu Şərtlərə, İcma qaydalarına və qanunvericiliyə tabedir. Qaydaları pozan anonim məzmun silinir, müəllifinə qarşı tədbir görülür və qanunla nəzərdə tutulmuş hallarda məlumat səlahiyyətli orqanlara verilə bilər." },
        ],
      },
      {
        id: "communication",
        title: "7. Yazışma, klublar, tədbirlər və mentorluq",
        blocks: [
          { ul: [
            "Mesajlar yalnız söhbət iştirakçılarına görünür. Şikayət olunmuş mesajlar moderasiya məqsədilə administratorlar tərəfindən yoxlanıla bilər.",
            "Klub və tədbir yaradan şəxs təqdim etdiyi məlumatın doğruluğuna, tədbirin təşkilinə və təhlükəsizliyinə görə məsuliyyət daşıyır. Platforma tədbirlərin təşkilatçısı deyil.",
            "Tədbir ləğv edildikdə və ya vaxtı/yeri dəyişdikdə qeydiyyatdan keçmiş iştirakçılara bildiriş göndərilir.",
            "Mentorluq könüllü əsasda aparılır; platforma mentorların məsləhətlərinin nəticəsinə zəmanət vermir.",
            "Bazar elanlarındakı alqı-satqı və mübadilələr istifadəçilər arasında aparılır; platforma onların tərəfi deyil.",
          ] },
        ],
      },
      {
        id: "content-license",
        title: "8. Məzmun hüquqları",
        blocks: [
          { p: "Paylaşdığın məzmunun müəllif hüquqları səndə qalır. Məzmunu paylaşmaqla EduRate-ə onu platformada göstərmək, saxlamaq, texniki cəhətdən uyğunlaşdırmaq (məsələn, şəkli kiçiltmək) və platformanın işləməsi üçün lazım olan həcmdə istifadə etmək üçün qeyri-müstəsna, ödənişsiz lisenziya verirsən. Bu lisenziya məzmunu sildikdə bitir; ehtiyat nüsxələrdən isə avtomatik yeniləmə dövründə silinir." },
          { p: "Paylaşdığın məzmunun üçüncü şəxslərin hüquqlarını pozmadığına zəmanət verirsən. EduRate adı, loqosu, dizaynı və proqram kodu operatora məxsusdur və icazəsiz kopyalana bilməz." },
        ],
      },
      {
        id: "moderation",
        title: "9. Moderasiya, şikayət və etiraz",
        blocks: [
          { ul: [
            "Hər istifadəçi qaydaları pozan məzmundan «Şikayət et» funksiyası ilə şikayət edə bilər.",
            "Moderatorlar şikayətə baxır və məzmunu gizlədə, silə və ya hesaba qarşı İcma qaydalarında göstərilən tədbirləri görə bilər.",
            "Qərarla razı deyilsənsə, «Dəstək» bölməsi və ya edurate111@gmail.com vasitəsilə səbəbini göstərməklə etiraz edə bilərsən. Etiraza mümkün olduqda ilkin qərarı verməmiş moderator baxır.",
            "Açıq-aşkar qanunsuz məzmun əvvəlcədən xəbərdarlıq edilmədən silinə bilər.",
          ] },
        ],
      },
      {
        id: "termination",
        title: "10. Hesabın dayandırılması və silinməsi",
        blocks: [
          { p: "Hesabını istənilən vaxt «Ayarlar → Hesabı sil» vasitəsilə silə bilərsən (nəticələri Məxfilik siyasətinin 9-cu bölməsində izah olunub)." },
          { p: "Şərtləri ciddi və ya təkrar pozduqda hesabını müvəqqəti məhdudlaşdıra və ya bağlaya bilərik. Mümkün olduqda qərarın səbəbi barədə səni məlumatlandırırıq. Pilot layihə başa çatarsa, bu barədə ən azı 30 gün əvvəl xəbərdarlıq edəcək və məlumatlarını yükləmək imkanı verəcəyik." },
        ],
      },
      {
        id: "pilot",
        title: "11. Pilot statusu və xidmətin təqdim olunması",
        blocks: [
          { p: "Platforma pulsuzdur və pilot mərhələsindədir. Xidmət «olduğu kimi» təqdim olunur: funksiyalar dəyişə, əlavə edilə və ya dayandırıla bilər, texniki fasilələr ola bilər. Fasiləsiz və xətasız işə zəmanət vermirik, lakin məlumatlarının təhlükəsizliyi və xidmətin sabitliyi üçün ağlabatan səy göstəririk." },
        ],
      },
      {
        id: "liability",
        title: "12. Məsuliyyətin məhdudlaşdırılması",
        blocks: [
          { p: "İstifadəçilərin paylaşdığı rəy, şərh, mesaj və digər məzmun onların şəxsi fikridir; operator bu məzmunun doğruluğuna görə məsuliyyət daşımır, lakin qanunsuz məzmundan xəbər tutduqda onu aradan qaldırır. Platformadan istifadə nəticəsində qəbul etdiyin qərarlara (məsələn, fənn və ya müəllim seçiminə) görə məsuliyyət səndədir." },
          { p: "Qanunvericiliyin icazə verdiyi həddə operator dolayı zərərə, əldən çıxmış fayda və ya məlumat itkisinə görə məsuliyyət daşımır. Bu məhdudiyyət operatorun qəsdən və ya kobud ehtiyatsızlıqla vurduğu zərərə və qanunla istisna edilə bilməyən məsuliyyətə şamil olunmur." },
        ],
      },
      {
        id: "law",
        title: "13. Tətbiq olunan hüquq və mübahisələr",
        blocks: [
          { p: "Bu Şərtlər Azərbaycan Respublikasının qanunvericiliyi ilə tənzimlənir. Mübahisələr ilk növbədə danışıqlar yolu ilə həll edilir: edurate111@gmail.com ünvanına yaz, 14 gün ərzində cavab verməyə çalışacağıq. Razılaşma əldə olunmazsa, mübahisə Azərbaycan Respublikasının səlahiyyətli məhkəməsində həll olunur." },
        ],
      },
      {
        id: "changes",
        title: "14. Şərtlərdə dəyişikliklər",
        blocks: [
          { p: "Şərtləri yeniləyə bilərik. Hər versiyanın tarixi səhifənin yuxarısındadır. Mahiyyətcə vacib dəyişikliklərdə platformaya növbəti girişində yenilənmiş sənədləri yenidən qəbul etməyin istənəcək. Qəbul etmirsənsə, hesabından çıxa və ya onu silə bilərsən." },
          { p: "Şərtlərin hər hansı müddəası etibarsız sayılarsa, qalan müddəalar qüvvədə qalır." },
        ],
      },
      {
        id: "contact",
        title: "15. Əlaqə",
        blocks: [
          { p: "Operator: Rəsul Şəfili (EduRate, fərdi layihə). E-poçt: edurate111@gmail.com. Platforma daxilində: «Dəstək» bölməsi." },
        ],
      },
    ],
  },
  en: {
    title: "Terms of Use",
    lead: "These terms set out the rules for using the EduRate platform and the rights and obligations of you and us. Please read them carefully before using the Platform.",
    sections: [
      {
        id: "acceptance",
        title: "1. General provisions and acceptance",
        blocks: [
          { p: "EduRate (the “Platform”) is an independent student pilot project offering teacher reviews, campus questions, clubs, events, mentorship and messaging to students, teachers and mentors of Karabakh University. The Platform is operated by Rasul Shafili, a private individual (personal project); contact: edurate111@gmail.com." },
          { p: "By ticking “I have read and accept” on the registration form or by using the Platform you accept these Terms of Use, the Privacy Policy, the Cookie Policy and the Community Guidelines (together — the “Terms”). If you do not agree, do not use the Platform." },
          { p: "The Platform is not the university's official information system and does not speak on the university's behalf. Reviews and ratings on the Platform are not the university's official position." },
        ],
      },
      {
        id: "eligibility",
        title: "2. Who may use the Platform",
        blocks: [
          { ul: [
            "The Platform may be used by people aged 16 and over. By registering you confirm that you are at least 16.",
            "Student accounts are for students of the university. Teacher and mentor accounts become active after administrator approval.",
            "Each person may have only one account. Creating an account in someone else's name or with false or misleading information is prohibited.",
            "A person whose account was closed for breaking the rules may not open a new account without permission.",
          ] },
        ],
      },
      {
        id: "account",
        title: "3. Account and security",
        blocks: [
          { ul: [
            "You must give accurate, up-to-date information at registration and update your profile when it changes.",
            "You are responsible for keeping your password secret and not sharing it. You are responsible for actions taken from your account.",
            "If you suspect unauthorised use of your account, change your password immediately and notify edurate111@gmail.com.",
            "Giving, selling or transferring your account to someone else is prohibited.",
          ] },
        ],
      },
      {
        id: "acceptable-use",
        title: "4. Acceptable use",
        blocks: [
          { p: "You may use the Platform only for lawful purposes and in line with the Community Guidelines. In particular, the following are prohibited:" },
          { ul: [
            "insults, threats, harassment, hate speech, discrimination and incitement to violence;",
            "defamation, spreading false information or degrading another person's honour and dignity;",
            "sharing other people's personal data (phone, address, photos, documents) without their consent;",
            "spam, advertising, fraud, and mass or automated messaging;",
            "sharing content that infringes copyright or other intellectual property rights;",
            "leaking exam questions or answers or otherwise helping to breach academic integrity;",
            "attempts to probe, break into, scrape, exceed rate limits of or disrupt the Platform;",
            "impersonating another person, teacher, the university or an organisation;",
            "any content prohibited by the laws of the Republic of Azerbaijan.",
          ] },
        ],
      },
      {
        id: "reviews",
        title: "5. Teacher reviews",
        blocks: [
          { ul: [
            "Only review teachers who actually taught you, based on your own experience.",
            "Reviews must concern teaching (clarity, fairness, communication, subject knowledge); writing about a teacher's private life, appearance or family is prohibited.",
            "Facts must be verifiable; unproven accusations (for example, of bribery) belong in a complaint to the competent official bodies, not in a review.",
            "Reviews may be moderated before publication, and reviews that break the rules may not be published.",
            "Reviews are published without the author's name, but this does not remove your responsibility for the content.",
          ] },
        ],
      },
      {
        id: "anonymous",
        title: "6. Anonymous content",
        blocks: [
          { p: "Campus questions and anonymous comments on announcements are shown to other users without the author's name. Anonymity applies only towards other users: the author is recorded in the system, and anonymous content is subject to these Terms, the Community Guidelines and the law. Anonymous content that breaks the rules is removed, action is taken against its author and, in cases provided by law, information may be disclosed to competent authorities." },
        ],
      },
      {
        id: "communication",
        title: "7. Messaging, clubs, events and mentorship",
        blocks: [
          { ul: [
            "Messages are visible only to the conversation participants. Reported messages may be reviewed by administrators for moderation.",
            "Whoever creates a club or event is responsible for the accuracy of the information, the organisation and the safety of the event. The Platform is not the organiser of events.",
            "When an event is cancelled or its time/place changes, registered participants are notified.",
            "Mentorship is voluntary; the Platform does not guarantee the outcome of mentors' advice.",
            "Marketplace sales and exchanges take place between users; the Platform is not a party to them.",
          ] },
        ],
      },
      {
        id: "content-license",
        title: "8. Content rights",
        blocks: [
          { p: "You keep the copyright in the content you share. By sharing it you grant EduRate a non-exclusive, royalty-free licence to display, store, technically adapt (for example, resize images) and use it to the extent needed to operate the Platform. The licence ends when you delete the content; backups are cleared in the normal overwrite cycle." },
          { p: "You warrant that your content does not infringe third-party rights. The EduRate name, logo, design and source code belong to the operator and may not be copied without permission." },
        ],
      },
      {
        id: "moderation",
        title: "9. Moderation, reports and appeals",
        blocks: [
          { ul: [
            "Any user can report content that breaks the rules using the “Report” feature.",
            "Moderators review reports and may hide or remove content or take the account measures listed in the Community Guidelines.",
            "If you disagree with a decision, you can appeal with reasons via “Support” or edurate111@gmail.com. Where possible, appeals are reviewed by a moderator who did not make the original decision.",
            "Clearly unlawful content may be removed without prior notice.",
          ] },
        ],
      },
      {
        id: "termination",
        title: "10. Suspension and deletion of accounts",
        blocks: [
          { p: "You may delete your account at any time via “Settings → Delete account” (the consequences are explained in section 9 of the Privacy Policy)." },
          { p: "For serious or repeated breaches of the Terms we may temporarily restrict or close your account. Where possible we tell you the reason. If the pilot project ends, we will give at least 30 days' notice and the opportunity to download your data." },
        ],
      },
      {
        id: "pilot",
        title: "11. Pilot status and availability",
        blocks: [
          { p: "The Platform is free and in a pilot phase. It is provided “as is”: features may change, be added or be discontinued, and there may be maintenance breaks. We do not guarantee uninterrupted or error-free operation, but we make reasonable efforts to keep your data secure and the service stable." },
        ],
      },
      {
        id: "liability",
        title: "12. Limitation of liability",
        blocks: [
          { p: "Reviews, comments, messages and other content shared by users are their personal opinions; the operator is not responsible for their accuracy but removes unlawful content once aware of it. You are responsible for decisions you make based on the Platform (for example, choosing a course or teacher)." },
          { p: "To the extent permitted by law, the operator is not liable for indirect loss, lost profit or loss of data. This limitation does not apply to damage caused intentionally or through gross negligence, or to liability that cannot be excluded by law." },
        ],
      },
      {
        id: "law",
        title: "13. Governing law and disputes",
        blocks: [
          { p: "These Terms are governed by the laws of the Republic of Azerbaijan. Disputes are first resolved through negotiation: write to edurate111@gmail.com and we will try to respond within 14 days. If no agreement is reached, the dispute is resolved by the competent court of the Republic of Azerbaijan." },
        ],
      },
      {
        id: "changes",
        title: "14. Changes to the Terms",
        blocks: [
          { p: "We may update the Terms. The date of each version is at the top of the page. For material changes you will be asked to accept the updated documents at your next visit. If you do not accept, you can sign out or delete your account." },
          { p: "If any provision of the Terms is found invalid, the remaining provisions remain in force." },
        ],
      },
      {
        id: "contact",
        title: "15. Contact",
        blocks: [
          { p: "Operator: Rasul Shafili (EduRate, personal project). E-mail: edurate111@gmail.com. On the Platform: the “Support” section." },
        ],
      },
    ],
  },
  ru: {
    title: "Условия использования",
    lead: "Эти условия определяют правила пользования платформой EduRate, ваши и наши права и обязанности. Внимательно прочитайте их перед использованием Платформы.",
    sections: [
      {
        id: "acceptance",
        title: "1. Общие положения и принятие условий",
        blocks: [
          { p: "EduRate («Платформа») — независимый студенческий пилотный проект, предоставляющий студентам, преподавателям и менторам Карабахского университета отзывы о преподавателях, вопросы кампуса, клубы, мероприятия, менторство и переписку. Оператор Платформы — физическое лицо Расул Шафили (личный проект), контакт: edurate111@gmail.com." },
          { p: "Отмечая «прочитал(а) и принимаю» в форме регистрации или пользуясь Платформой, вы принимаете настоящие Условия использования, Политику конфиденциальности, Политику cookie и Правила сообщества (вместе — «Условия»). Если вы не согласны, не пользуйтесь Платформой." },
          { p: "Платформа не является официальной информационной системой университета и не выступает от его имени. Отзывы и оценки на Платформе не являются официальной позицией университета." },
        ],
      },
      {
        id: "eligibility",
        title: "2. Кто может пользоваться Платформой",
        blocks: [
          { ul: [
            "Платформой могут пользоваться лица от 16 лет. Регистрируясь, вы подтверждаете, что вам исполнилось 16 лет.",
            "Студенческий аккаунт предназначен для студентов университета. Аккаунты преподавателей и менторов активируются после одобрения администратором.",
            "Одно лицо может иметь только один аккаунт. Запрещено создавать аккаунт от чужого имени или с ложными либо вводящими в заблуждение данными.",
            "Лицо, чей аккаунт был закрыт за нарушения, не может без разрешения создать новый.",
          ] },
        ],
      },
      {
        id: "account",
        title: "3. Аккаунт и безопасность",
        blocks: [
          { ul: [
            "При регистрации указывайте точные и актуальные данные и обновляйте профиль при их изменении.",
            "Вы отвечаете за сохранность пароля и не должны передавать его другим. Вы несёте ответственность за действия, совершённые с вашего аккаунта.",
            "Если подозреваете несанкционированный доступ, немедленно смените пароль и сообщите на edurate111@gmail.com.",
            "Передавать, продавать или уступать аккаунт другим запрещено.",
          ] },
        ],
      },
      {
        id: "acceptable-use",
        title: "4. Допустимое использование",
        blocks: [
          { p: "Пользоваться Платформой можно только в законных целях и в соответствии с Правилами сообщества. В частности, запрещены:" },
          { ul: [
            "оскорбления, угрозы, преследование, язык вражды, дискриминация и призывы к насилию;",
            "клевета, распространение ложной информации, унижение чести и достоинства;",
            "распространение чужих персональных данных (телефон, адрес, фото, документы) без согласия;",
            "спам, реклама, мошенничество, массовая или автоматическая рассылка;",
            "контент, нарушающий авторские и иные права интеллектуальной собственности;",
            "утечка экзаменационных вопросов и ответов, иное содействие нарушению академической честности;",
            "попытки взлома, сбора данных (scraping), обхода лимитов или нарушения работы Платформы;",
            "выдача себя за другое лицо, преподавателя, университет или организацию;",
            "любой контент, запрещённый законодательством Азербайджанской Республики.",
          ] },
        ],
      },
      {
        id: "reviews",
        title: "5. Отзывы о преподавателях",
        blocks: [
          { ul: [
            "Оставляйте отзыв только о преподавателе, у которого вы действительно учились, на основе личного опыта.",
            "Отзыв должен касаться преподавания (ясность, объективность, общение, знание предмета); запрещено писать о личной жизни, внешности или семье преподавателя.",
            "Факты должны быть проверяемыми; бездоказательные обвинения (например, во взяточничестве) следует направлять в компетентные органы, а не в отзыв.",
            "Отзывы могут проходить модерацию до публикации; отзыв, нарушающий правила, может быть не опубликован.",
            "Отзыв публикуется без имени автора, но это не снимает с вас ответственности за его содержание.",
          ] },
        ],
      },
      {
        id: "anonymous",
        title: "6. Анонимный контент",
        blocks: [
          { p: "Вопросы кампуса и анонимные комментарии к объявлениям показываются другим пользователям без имени автора. Анонимность действует только в отношении других пользователей: автор фиксируется в системе, а анонимный контент подчиняется этим Условиям, Правилам сообщества и закону. Нарушающий анонимный контент удаляется, к автору применяются меры, а в предусмотренных законом случаях сведения могут быть переданы компетентным органам." },
        ],
      },
      {
        id: "communication",
        title: "7. Переписка, клубы, мероприятия и менторство",
        blocks: [
          { ul: [
            "Сообщения видят только участники беседы. Сообщения, на которые поступила жалоба, могут быть проверены администраторами.",
            "Создатель клуба или мероприятия отвечает за достоверность информации, организацию и безопасность мероприятия. Платформа не является организатором мероприятий.",
            "При отмене мероприятия или изменении его времени/места зарегистрированные участники получают уведомление.",
            "Менторство добровольно; Платформа не гарантирует результат советов менторов.",
            "Сделки и обмены в маркетплейсе совершаются между пользователями; Платформа не является их стороной.",
          ] },
        ],
      },
      {
        id: "content-license",
        title: "8. Права на контент",
        blocks: [
          { p: "Авторские права на ваш контент остаются за вами. Публикуя его, вы предоставляете EduRate неисключительную безвозмездную лицензию на показ, хранение, техническую адаптацию (например, уменьшение изображений) и использование в объёме, необходимом для работы Платформы. Лицензия прекращается при удалении контента; резервные копии очищаются в обычном цикле перезаписи." },
          { p: "Вы гарантируете, что ваш контент не нарушает права третьих лиц. Название, логотип, дизайн и исходный код EduRate принадлежат оператору и не могут копироваться без разрешения." },
        ],
      },
      {
        id: "moderation",
        title: "9. Модерация, жалобы и обжалование",
        blocks: [
          { ul: [
            "Любой пользователь может пожаловаться на нарушающий контент через функцию «Пожаловаться».",
            "Модераторы рассматривают жалобы и могут скрыть или удалить контент либо применить к аккаунту меры, указанные в Правилах сообщества.",
            "Если вы не согласны с решением, обжалуйте его с указанием причин через «Поддержку» или edurate111@gmail.com. По возможности её рассматривает модератор, не принимавший первоначальное решение.",
            "Явно незаконный контент может быть удалён без предупреждения.",
          ] },
        ],
      },
      {
        id: "termination",
        title: "10. Приостановка и удаление аккаунта",
        blocks: [
          { p: "Вы можете удалить аккаунт в любое время через «Настройки → Удалить аккаунт» (последствия описаны в разделе 9 Политики конфиденциальности)." },
          { p: "При серьёзных или повторных нарушениях мы можем временно ограничить или закрыть аккаунт. По возможности мы сообщаем причину. Если пилотный проект завершится, мы предупредим минимум за 30 дней и дадим возможность скачать данные." },
        ],
      },
      {
        id: "pilot",
        title: "11. Пилотный статус и доступность",
        blocks: [
          { p: "Платформа бесплатна и находится на пилотной стадии. Она предоставляется «как есть»: функции могут меняться, добавляться или прекращаться, возможны технические перерывы. Мы не гарантируем бесперебойную и безошибочную работу, но прилагаем разумные усилия для безопасности данных и стабильности сервиса." },
        ],
      },
      {
        id: "liability",
        title: "12. Ограничение ответственности",
        blocks: [
          { p: "Отзывы, комментарии, сообщения и другой контент пользователей — их личное мнение; оператор не отвечает за его достоверность, но удаляет незаконный контент, узнав о нём. Ответственность за решения, принятые на основе Платформы (например, выбор курса или преподавателя), несёте вы." },
          { p: "В пределах, допускаемых законом, оператор не отвечает за косвенные убытки, упущенную выгоду или потерю данных. Ограничение не распространяется на вред, причинённый умышленно или по грубой неосторожности, и на ответственность, которую нельзя исключить по закону." },
        ],
      },
      {
        id: "law",
        title: "13. Применимое право и споры",
        blocks: [
          { p: "Условия регулируются законодательством Азербайджанской Республики. Споры сначала решаются путём переговоров: напишите на edurate111@gmail.com, мы постараемся ответить в течение 14 дней. Если соглашение не достигнуто, спор рассматривается компетентным судом Азербайджанской Республики." },
        ],
      },
      {
        id: "changes",
        title: "14. Изменение условий",
        blocks: [
          { p: "Мы можем обновлять Условия. Дата каждой версии указана вверху страницы. При существенных изменениях при следующем визите вас попросят принять обновлённые документы. Если вы не согласны, вы можете выйти или удалить аккаунт." },
          { p: "Если какое-либо положение признано недействительным, остальные положения сохраняют силу." },
        ],
      },
      {
        id: "contact",
        title: "15. Контакты",
        blocks: [
          { p: "Оператор: Расул Шафили (EduRate, личный проект). E-mail: edurate111@gmail.com. На Платформе: раздел «Поддержка»." },
        ],
      },
    ],
  },
};
