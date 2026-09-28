import type { LegalDocSet } from "./types";

/**
 * Kuki siyasəti — kodda həqiqətən istifadə olunan kuki və yaddaş açarları:
 * `edurate_api_token` (lib/auth/session-policy.ts), `edurate_lang`
 * (i18n/LanguageProvider.tsx), `edurate-cookie-consent` (CookieConsent.tsx),
 * `edurate:install-dismissed` (PwaLayer.tsx), Vercel Analytics (yalnız razılıqla).
 */
export const cookiePolicy: LegalDocSet = {
  az: {
    title: "Kuki siyasəti",
    lead: "Bu sənəd EduRate-in brauzerində hansı kukiləri və yaddaş qeydlərini saxladığını, nə üçün və nə qədər müddətə saxladığını və seçimini necə dəyişə biləcəyini izah edir.",
    sections: [
      {
        id: "what",
        title: "1. Kuki nədir",
        blocks: [
          { p: "Kuki (cookie) sayta daxil olanda brauzerində saxlanan kiçik mətn faylıdır. Oxşar məqsədlə brauzerin yerli yaddaşından (localStorage) da istifadə olunur. Bu siyasətdə hər ikisi «kuki» adlanır." },
          { p: "EduRate reklam kukiləri və ya səni başqa saytlarda izləyən üçüncü tərəf kukiləri istifadə etmir." },
        ],
      },
      {
        id: "list",
        title: "2. İstifadə etdiyimiz kukilər",
        blocks: [
          {
            table: {
              head: ["Ad", "Növ", "Məqsəd", "Müddət"],
              rows: [
                ["edurate_api_token", "Zəruri (httpOnly kuki)", "Hesabına daxil olduğunu yadda saxlayır. JavaScript onu oxuya bilmir.", "30 gün və ya çıxış edənə qədər"],
                ["edurate_lang", "Funksional kuki", "Seçdiyin interfeys dilini (AZ/EN/RU) yadda saxlayır.", "1 il"],
                ["edurate-cookie-consent", "Zəruri (localStorage)", "Kuki bannerində etdiyin seçimi yadda saxlayır ki, banner hər dəfə görünməsin.", "Sən silənə qədər"],
                ["edurate:install-dismissed", "Funksional (localStorage)", "Tətbiqi quraşdırma təklifini bağladığını yadda saxlayır.", "Sən silənə qədər"],
                ["Vercel Analytics", "Statistika (yalnız razılıqla)", "Səhifə baxışlarının anonim, ümumi sayını ölçür. Kuki yazmır və səni şəxsən tanımır.", "Razılığını geri götürənə qədər yüklənir"],
              ],
            },
          },
          { p: "Push bildirişlərinə icazə versən, brauzer bildiriş xidməti üçün texniki abunə yaradır; onu brauzerin və ya «Ayarlar»dan söndürə bilərsən." },
        ],
      },
      {
        id: "consent",
        title: "3. Razılıq",
        blocks: [
          { p: "Zəruri kukilər platformanın işləməsi üçün lazımdır və qanunvericiliyə əsasən ayrıca razılıq tələb etmir: onlarsız hesaba daxil olmaq mümkün deyil. Statistika yalnız kuki bannerində «Qəbul et» düyməsinə bassan yüklənir; «İmtina et» seçsən, heç vaxt yüklənmir. Hər iki düymə eyni ölçüdədir və imtina qəbul qədər asandır." },
        ],
      },
      {
        id: "manage",
        title: "4. Seçimini necə dəyişmək olar",
        blocks: [
          { ul: [
            "Səhifənin aşağısındakı «Kuki ayarları» düyməsinə və ya «Ayarlar → Məxfilik və məlumatlarım → Kuki ayarları»na bas: banner yenidən açılır və seçimini dəyişə bilərsən.",
            "Brauzerinin parametrlərindən bütün kukiləri və sayt məlumatlarını silə bilərsən. Bu zaman hesabından çıxış olunacaq və dil seçimi sıfırlanacaq.",
            "Brauzerdə kukiləri tamamilə bloklasan, hesaba daxil olmaq mümkün olmayacaq.",
          ] },
        ],
      },
      {
        id: "more",
        title: "5. Əlavə məlumat",
        blocks: [
          { p: "Kukilərlə toplanan məlumatların necə emal olunduğu Məxfilik siyasətində izah olunur. Suallar üçün: edurate111@gmail.com." },
        ],
      },
    ],
  },
  en: {
    title: "Cookie Policy",
    lead: "This document explains which cookies and storage entries EduRate keeps in your browser, why and for how long, and how you can change your choice.",
    sections: [
      {
        id: "what",
        title: "1. What is a cookie",
        blocks: [
          { p: "A cookie is a small text file stored in your browser when you visit a website. The browser's local storage (localStorage) is used for similar purposes. In this policy both are called “cookies”." },
          { p: "EduRate does not use advertising cookies or third-party cookies that track you across other websites." },
        ],
      },
      {
        id: "list",
        title: "2. Cookies we use",
        blocks: [
          {
            table: {
              head: ["Name", "Type", "Purpose", "Duration"],
              rows: [
                ["edurate_api_token", "Strictly necessary (httpOnly cookie)", "Keeps you signed in. JavaScript cannot read it.", "30 days or until you sign out"],
                ["edurate_lang", "Functional cookie", "Remembers your interface language (AZ/EN/RU).", "1 year"],
                ["edurate-cookie-consent", "Strictly necessary (localStorage)", "Remembers your choice in the cookie banner so it does not appear every time.", "Until you clear it"],
                ["edurate:install-dismissed", "Functional (localStorage)", "Remembers that you dismissed the install-app prompt.", "Until you clear it"],
                ["Vercel Analytics", "Statistics (consent only)", "Counts page views anonymously and in aggregate. It sets no cookies and does not identify you.", "Loaded until you withdraw consent"],
              ],
            },
          },
          { p: "If you allow push notifications, your browser creates a technical subscription for its notification service; you can turn it off in your browser or in “Settings”." },
        ],
      },
      {
        id: "consent",
        title: "3. Consent",
        blocks: [
          { p: "Strictly necessary cookies are required for the Platform to work and do not need separate consent: without them you cannot sign in. Statistics are loaded only if you press “Accept” in the cookie banner; if you choose “Decline”, they are never loaded. Both buttons are the same size, and declining is as easy as accepting." },
        ],
      },
      {
        id: "manage",
        title: "4. How to change your choice",
        blocks: [
          { ul: [
            "Press “Cookie settings” at the bottom of the page or in “Settings → Privacy and my data”: the banner reopens and you can change your choice.",
            "You can delete all cookies and site data in your browser settings. This signs you out and resets your language choice.",
            "If you block cookies completely, you will not be able to sign in.",
          ] },
        ],
      },
      {
        id: "more",
        title: "5. More information",
        blocks: [
          { p: "How data collected through cookies is processed is explained in the Privacy Policy. Questions: edurate111@gmail.com." },
        ],
      },
    ],
  },
  ru: {
    title: "Политика cookie",
    lead: "Этот документ объясняет, какие cookie и записи хранилища EduRate сохраняет в вашем браузере, зачем и на какой срок, и как изменить свой выбор.",
    sections: [
      {
        id: "what",
        title: "1. Что такое cookie",
        blocks: [
          { p: "Cookie — небольшой текстовый файл, который сохраняется в браузере при посещении сайта. Для похожих целей используется локальное хранилище браузера (localStorage). В этой политике и то и другое называется «cookie»." },
          { p: "EduRate не использует рекламные cookie и сторонние cookie, отслеживающие вас на других сайтах." },
        ],
      },
      {
        id: "list",
        title: "2. Какие cookie мы используем",
        blocks: [
          {
            table: {
              head: ["Название", "Тип", "Назначение", "Срок"],
              rows: [
                ["edurate_api_token", "Строго необходимый (httpOnly cookie)", "Сохраняет вход в аккаунт. JavaScript не может его прочитать.", "30 дней или до выхода"],
                ["edurate_lang", "Функциональный cookie", "Запоминает язык интерфейса (AZ/EN/RU).", "1 год"],
                ["edurate-cookie-consent", "Строго необходимый (localStorage)", "Запоминает ваш выбор в баннере cookie, чтобы он не появлялся каждый раз.", "Пока вы его не удалите"],
                ["edurate:install-dismissed", "Функциональный (localStorage)", "Запоминает, что вы закрыли предложение установить приложение.", "Пока вы его не удалите"],
                ["Vercel Analytics", "Статистика (только с согласия)", "Анонимно и в совокупности считает просмотры страниц. Не записывает cookie и не идентифицирует вас.", "Загружается, пока вы не отзовёте согласие"],
              ],
            },
          },
          { p: "Если вы разрешите push-уведомления, браузер создаст техническую подписку для своего сервиса уведомлений; её можно отключить в браузере или в «Настройках»." },
        ],
      },
      {
        id: "consent",
        title: "3. Согласие",
        blocks: [
          { p: "Строго необходимые cookie нужны для работы Платформы и не требуют отдельного согласия: без них невозможно войти. Статистика загружается только если вы нажмёте «Принять» в баннере; при выборе «Отклонить» она не загружается никогда. Обе кнопки одинакового размера, отказаться так же просто, как согласиться." },
        ],
      },
      {
        id: "manage",
        title: "4. Как изменить выбор",
        blocks: [
          { ul: [
            "Нажмите «Настройки cookie» внизу страницы или в «Настройки → Конфиденциальность и мои данные»: баннер откроется снова.",
            "В настройках браузера можно удалить все cookie и данные сайта. При этом вы выйдете из аккаунта, а выбор языка сбросится.",
            "Если полностью заблокировать cookie, войти в аккаунт будет невозможно.",
          ] },
        ],
      },
      {
        id: "more",
        title: "5. Дополнительно",
        blocks: [
          { p: "Как обрабатываются данные, собранные с помощью cookie, описано в Политике конфиденциальности. Вопросы: edurate111@gmail.com." },
        ],
      },
    ],
  },
};
