import type { LegalDocSet } from "./types";

/** İcma qaydaları — İstifadə şərtlərinin 4–9-cu bölmələrinin praktik izahı. */
export const communityGuidelines: LegalDocSet = {
  az: {
    title: "İcma qaydaları",
    lead: "EduRate tələbələr, müəllimlər və mentorlar üçün təhlükəsiz və faydalı məkan olmalıdır. Bu qaydalar platformada nəyin yaxşı, nəyin yolverilməz olduğunu və pozuntu zamanı nə baş verdiyini izah edir.",
    sections: [
      {
        id: "principles",
        title: "1. Əsas prinsiplər",
        blocks: [
          { ul: [
            "Hörmət: fikir ayrılığı normaldır, şəxsiyyətə hücum yox.",
            "Dürüstlük: öz təcrübəni yaz, şişirtmə, uydurma.",
            "Məxfilik: başqasının şəxsi məlumatını onun icazəsi olmadan paylaşma.",
            "Faydalılıq: yazdığın başqasına kömək etsin — konkret, aydın, konstruktiv.",
            "Məsuliyyət: anonim olsan belə, yazdığına görə məsuliyyət daşıyırsan.",
          ] },
        ],
      },
      {
        id: "reviews",
        title: "2. Yaxşı müəllim rəyi necə yazılır",
        blocks: [
          { ul: [
            "Dərsin necə keçdiyini, izahların aydınlığını, qiymətləndirmənin ədalətini, ünsiyyəti təsvir et.",
            "Konkret ol: «imtahan sualları mühazirələrlə uyğun idi» ümumi «pis müəllimdir»dən daha faydalıdır.",
            "Emosiyanı yox, təcrübəni paylaş; təhqiredici ifadə, ləqəb və ironiya işlətmə.",
            "Müəllimin xarici görünüşü, şəxsi həyatı, ailəsi, dini və ya siyasi baxışları haqqında yazma.",
            "Sübutu olmayan cinayət ittihamlarını (rüşvət və s.) rəydə yazma — bunun üçün rəsmi şikayət yolları var.",
          ] },
        ],
      },
      {
        id: "anonymous",
        title: "3. Anonim suallar və şərhlər",
        blocks: [
          { p: "Anonimlik utanmadan sual verə bilməyin üçündür, başqalarını incitmək üçün deyil. Anonim məzmun da eyni qaydalara tabedir, müəllifi sistemdə qeyd olunur və pozuntu zamanı tədbir görülür." },
        ],
      },
      {
        id: "prohibited",
        title: "4. Yolverilməz məzmun və davranış",
        blocks: [
          { ul: [
            "Təhqir, alçaltma, hədə, təqib və zorbalıq (bullying).",
            "Milli, etnik, dini, cinsi, əlilliyə və ya digər əlamətlərə görə nifrət nitqi və ayrı-seçkilik.",
            "Zorakılığa, özünə zərər verməyə və ya qanunsuz hərəkətə çağırış.",
            "Başqasının telefon nömrəsi, ünvanı, şəkilləri, sənədləri və yazışmalarının icazəsiz yayılması (doxxing).",
            "Cinsi xarakterli, açıq-saçıq və ya şok edici məzmun.",
            "Spam, reklam, piramida sxemləri, fırıldaqçılıq və saxta elanlar.",
            "İmtahan suallarının və cavablarının sızdırılması, pullu ödev yazdırma xidmətləri.",
            "Başqa şəxs, müəllim və ya təşkilat adından çıxış etmək, saxta hesablar.",
            "Müəllif hüququ ilə qorunan materialların icazəsiz paylaşılması.",
            "Platformanın işini pozmaq, zərərli linklər və ya proqramlar paylaşmaq.",
          ] },
        ],
      },
      {
        id: "report",
        title: "5. Şikayət etmək",
        blocks: [
          { p: "Qaydaları pozan məzmun görsən, onun yanındakı «Şikayət et» funksiyasından istifadə et və ya «Dəstək» bölməsinə yaz. Şikayətlər məxfidir — şikayət etdiyin şəxs kimin şikayət etdiyini görmür. Təcili təhlükə (zorakılıq hədəsi, özünə zərər) varsa, dərhal 112 və ya müvafiq xidmətlərə müraciət et." },
        ],
      },
      {
        id: "enforcement",
        title: "6. Pozuntu zamanı tədbirlər",
        blocks: [
          { p: "Tədbir pozuntunun ağırlığına və təkrarlanmasına görə seçilir:" },
          {
            table: {
              head: ["Pilləli tədbir", "Nə vaxt"],
              rows: [
                ["Məzmunun gizlədilməsi və ya silinməsi", "Qaydaya uyğun olmayan hər bir məzmun"],
                ["Xəbərdarlıq", "İlk və ya yüngül pozuntu"],
                ["Funksiyaların müvəqqəti məhdudlaşdırılması", "Təkrar pozuntu"],
                ["Hesabın bağlanması", "Ağır (hədə, nifrət nitqi, doxxing, fırıldaqçılıq) və ya sistematik pozuntu"],
                ["Səlahiyyətli orqanlara məlumat", "Yalnız qanunla nəzərdə tutulmuş hallarda"],
              ],
            },
          },
        ],
      },
      {
        id: "appeal",
        title: "7. Etiraz",
        blocks: [
          { p: "Qərarın səhv olduğunu düşünürsənsə, «Dəstək» bölməsindən və ya edurate111@gmail.com vasitəsilə səbəbini yazaraq etiraz et. Etirazına baxılır və nəticə barədə sənə məlumat verilir." },
        ],
      },
    ],
  },
  en: {
    title: "Community Guidelines",
    lead: "EduRate should be a safe and useful place for students, teachers and mentors. These guidelines explain what is welcome, what is not acceptable and what happens when the rules are broken.",
    sections: [
      {
        id: "principles",
        title: "1. Core principles",
        blocks: [
          { ul: [
            "Respect: disagreement is fine, personal attacks are not.",
            "Honesty: share your own experience; do not exaggerate or invent.",
            "Privacy: do not share other people's personal information without permission.",
            "Usefulness: write something that helps others — specific, clear and constructive.",
            "Responsibility: even when anonymous, you are responsible for what you write.",
          ] },
        ],
      },
      {
        id: "reviews",
        title: "2. How to write a good teacher review",
        blocks: [
          { ul: [
            "Describe how classes went, how clear the explanations were, how fair the grading was, and how communication worked.",
            "Be specific: “exam questions matched the lectures” is more useful than a general “bad teacher”.",
            "Share experience rather than emotion; avoid insults, nicknames and sarcasm.",
            "Do not write about a teacher's appearance, private life, family, religion or political views.",
            "Do not make unproven criminal accusations (bribery, etc.) in a review — official complaint channels exist for that.",
          ] },
        ],
      },
      {
        id: "anonymous",
        title: "3. Anonymous questions and comments",
        blocks: [
          { p: "Anonymity is there so you can ask without embarrassment, not to hurt others. Anonymous content follows the same rules, its author is recorded in the system, and action is taken on violations." },
        ],
      },
      {
        id: "prohibited",
        title: "4. Content and behaviour that are not allowed",
        blocks: [
          { ul: [
            "Insults, humiliation, threats, harassment and bullying.",
            "Hate speech and discrimination based on nationality, ethnicity, religion, sex, disability or other characteristics.",
            "Incitement to violence, self-harm or unlawful acts.",
            "Sharing someone's phone number, address, photos, documents or messages without permission (doxxing).",
            "Sexual, explicit or shocking content.",
            "Spam, advertising, pyramid schemes, fraud and fake listings.",
            "Leaking exam questions and answers, paid assignment-writing services.",
            "Impersonating another person, teacher or organisation; fake accounts.",
            "Sharing copyrighted material without permission.",
            "Disrupting the Platform, sharing malicious links or software.",
          ] },
        ],
      },
      {
        id: "report",
        title: "5. Reporting",
        blocks: [
          { p: "If you see content that breaks the rules, use the “Report” feature next to it or write to “Support”. Reports are confidential — the person you report does not see who reported them. If there is an immediate danger (threat of violence, self-harm), contact 112 or the relevant services right away." },
        ],
      },
      {
        id: "enforcement",
        title: "6. What happens on violations",
        blocks: [
          { p: "Measures depend on how serious and how repeated the violation is:" },
          {
            table: {
              head: ["Measure", "When"],
              rows: [
                ["Hiding or removing content", "Any content that breaks the rules"],
                ["Warning", "First or minor violation"],
                ["Temporary restriction of features", "Repeated violations"],
                ["Account closure", "Serious (threats, hate speech, doxxing, fraud) or systematic violations"],
                ["Information to competent authorities", "Only in cases provided by law"],
              ],
            },
          },
        ],
      },
      {
        id: "appeal",
        title: "7. Appeals",
        blocks: [
          { p: "If you think a decision was wrong, appeal with your reasons through “Support” or edurate111@gmail.com. Your appeal will be reviewed and you will be told the outcome." },
        ],
      },
    ],
  },
  ru: {
    title: "Правила сообщества",
    lead: "EduRate должен быть безопасным и полезным местом для студентов, преподавателей и менторов. Эти правила объясняют, что приветствуется, что недопустимо и что происходит при нарушениях.",
    sections: [
      {
        id: "principles",
        title: "1. Основные принципы",
        blocks: [
          { ul: [
            "Уважение: разногласия нормальны, переход на личности — нет.",
            "Честность: делитесь своим опытом, не преувеличивайте и не выдумывайте.",
            "Конфиденциальность: не публикуйте чужие личные данные без разрешения.",
            "Польза: пишите так, чтобы помочь другим — конкретно, ясно и конструктивно.",
            "Ответственность: даже анонимно вы отвечаете за написанное.",
          ] },
        ],
      },
      {
        id: "reviews",
        title: "2. Как написать хороший отзыв о преподавателе",
        blocks: [
          { ul: [
            "Опишите, как проходили занятия, насколько понятными были объяснения, справедливым — оценивание, каким — общение.",
            "Будьте конкретны: «вопросы экзамена соответствовали лекциям» полезнее, чем общее «плохой преподаватель».",
            "Делитесь опытом, а не эмоциями; избегайте оскорблений, прозвищ и сарказма.",
            "Не пишите о внешности, личной жизни, семье, религии или политических взглядах преподавателя.",
            "Не выдвигайте в отзыве бездоказательных обвинений в преступлениях (взятки и т. п.) — для этого есть официальные каналы.",
          ] },
        ],
      },
      {
        id: "anonymous",
        title: "3. Анонимные вопросы и комментарии",
        blocks: [
          { p: "Анонимность нужна, чтобы спрашивать без стеснения, а не чтобы обижать других. Анонимный контент подчиняется тем же правилам, его автор фиксируется в системе, а за нарушения применяются меры." },
        ],
      },
      {
        id: "prohibited",
        title: "4. Недопустимый контент и поведение",
        blocks: [
          { ul: [
            "Оскорбления, унижение, угрозы, преследование и травля.",
            "Язык вражды и дискриминация по национальности, этносу, религии, полу, инвалидности и другим признакам.",
            "Призывы к насилию, самоповреждению или противоправным действиям.",
            "Публикация чужого телефона, адреса, фото, документов или переписки без разрешения (доксинг).",
            "Сексуальный, откровенный или шокирующий контент.",
            "Спам, реклама, пирамиды, мошенничество и фальшивые объявления.",
            "Утечка экзаменационных вопросов и ответов, платное написание работ.",
            "Выдача себя за другое лицо, преподавателя или организацию; фейковые аккаунты.",
            "Публикация материалов, защищённых авторским правом, без разрешения.",
            "Нарушение работы Платформы, вредоносные ссылки и программы.",
          ] },
        ],
      },
      {
        id: "report",
        title: "5. Как пожаловаться",
        blocks: [
          { p: "Если вы видите нарушающий контент, воспользуйтесь функцией «Пожаловаться» рядом с ним или напишите в «Поддержку». Жалобы конфиденциальны — человек не видит, кто на него пожаловался. При непосредственной опасности (угроза насилия, самоповреждение) сразу обращайтесь по номеру 112 или в соответствующие службы." },
        ],
      },
      {
        id: "enforcement",
        title: "6. Меры при нарушениях",
        blocks: [
          { p: "Мера зависит от серьёзности и повторяемости нарушения:" },
          {
            table: {
              head: ["Мера", "Когда"],
              rows: [
                ["Скрытие или удаление контента", "Любой контент, нарушающий правила"],
                ["Предупреждение", "Первое или незначительное нарушение"],
                ["Временное ограничение функций", "Повторные нарушения"],
                ["Закрытие аккаунта", "Серьёзные (угрозы, язык вражды, доксинг, мошенничество) или систематические нарушения"],
                ["Передача сведений компетентным органам", "Только в предусмотренных законом случаях"],
              ],
            },
          },
        ],
      },
      {
        id: "appeal",
        title: "7. Обжалование",
        blocks: [
          { p: "Если вы считаете решение ошибочным, обжалуйте его с указанием причин через «Поддержку» или edurate111@gmail.com. Ваша жалоба будет рассмотрена, и вам сообщат результат." },
        ],
      },
    ],
  },
};
