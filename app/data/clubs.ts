export const clubTabIds = ["about", "events", "members", "history"] as const;

export type ClubTabId = (typeof clubTabIds)[number];

export const clubTabLabels: Record<ClubTabId, string> = {
  about: "Haqqında",
  events: "Tədbirlər",
  members: "Üzvlər",
  history: "Tarixçə",
};

export type ClubCategory =
  | "Texnologiya"
  | "Akademik"
  | "Yaradıcılıq"
  | "Sosial təsir"
  | "Mədəniyyət";

export type ClubTone = "lime" | "violet" | "cyan" | "coral" | "amber" | "mint";

export type ClubStat = {
  label: string;
  value: string;
};

export type ClubMeeting = {
  cadence: string;
  day: string;
  time: string;
  place: string;
};

export type ClubEvent = {
  id: string;
  title: string;
  summary: string;
  date: string;
  dateLabel: string;
  timeLabel: string;
  place: string;
  format: "Açıq görüş" | "Emalatxana" | "Təqdimat" | "Səfər" | "Sessiya";
};

export type ClubMember = {
  id: string;
  initials: string;
  role: string;
  focus: string;
};

export type ClubHistoryMilestone = {
  year: string;
  title: string;
  description: string;
};

export type Club = {
  id?: string;
  createdBy?: string | null;
  /** "Aktiv" | "Gözləmədə" | "Məhdudlaşdırılıb" — yoxlanışdakı klubu göstərmək üçün lazımdır. */
  status?: string;
  slug: string;
  name: string;
  shortName: string;
  category: ClubCategory;
  tagline: string;
  description: string;
  about: readonly string[];
  stats: readonly ClubStat[];
  tone: ClubTone;
  visualMark: string;
  meeting: ClubMeeting;
  focusTags: readonly string[];
  events: readonly ClubEvent[];
  members: readonly ClubMember[];
  history: readonly ClubHistoryMilestone[];
  coverUrl?: string;
};

export type Community = {
  slug: string;
  name: string;
  eyebrow: string;
  tagline: string;
  description: string;
  memberCount: number;
  activityLabel: string;
  tone: ClubTone;
  visualMark: string;
  focusTags: readonly string[];
};

export const clubs = [
  {
    slug: "innovasiya-robototexnika",
    name: "İnnovasiya və Robototexnika Klubu",
    shortName: "Robototexnika",
    category: "Texnologiya",
    tagline: "Fikri prototipə, prototipi faydaya çevir.",
    description:
      "Elektronika, mexanika və proqramlaşdırmanı birləşdirən açıq laboratoriya icması.",
    about: [
      "Klub fərqli ixtisaslardan olan tələbələri real kampus problemləri üzərində işləmək üçün bir araya gətirir. İştirak etmək üçün əvvəlcədən texniki təcrübə tələb olunmur.",
      "Kiçik komandalar ideyanı araşdırır, təhlükəsiz prototip hazırlayır və nəticəni açıq sessiyada paylaşır. Məqsəd yalnız cihaz yaratmaq deyil, düşünülmüş həll qurmaqdır.",
    ],
    stats: [
      { label: "Aktiv üzv", value: "84" },
      { label: "Bu semestr layihə", value: "12" },
      { label: "Yaranıb", value: "2018" },
    ],
    tone: "lime",
    visualMark: "R01",
    meeting: {
      cadence: "Həftədə bir dəfə",
      day: "Çərşənbə",
      time: "18:00",
      place: "İnnovasiya laboratoriyası · B-204",
    },
    focusTags: ["Robototexnika", "IoT", "Prototipləmə", "Komanda işi"],
    events: [
      {
        id: "sensorlardan-ilk-prototip",
        title: "Sensorlardan ilk prototipə",
        summary: "Sadə sensor, mikrokontroller və vizual siqnalla işlək mini sistem qururuq.",
        date: "2026-07-18T16:00:00+04:00",
        dateLabel: "18 iyul",
        timeLabel: "16:00–18:00",
        place: "B-204 laboratoriyası",
        format: "Emalatxana",
      },
      {
        id: "kampus-ucun-agilli-heller",
        title: "Kampus üçün ağıllı həllər",
        summary: "Yeni layihə dövrü üçün problemləri seçir və kiçik komandalar formalaşdırırıq.",
        date: "2026-07-24T18:00:00+04:00",
        dateLabel: "24 iyul",
        timeLabel: "18:00–19:30",
        place: "İdeya otağı",
        format: "Açıq görüş",
      },
      {
        id: "prototip-demo-aksami",
        title: "Prototip demo axşamı",
        summary: "Dörd komanda sınaq nəticələrini və növbəti addımlarını qısa formatda təqdim edir.",
        date: "2026-08-06T17:30:00+04:00",
        dateLabel: "6 avqust",
        timeLabel: "17:30–19:00",
        place: "Mərkəzi atrium",
        format: "Təqdimat",
      },
    ],
    members: [
      { id: "robot-member-nh", initials: "NH", role: "Klub əlaqələndiricisi", focus: "Layihə axını" },
      { id: "robot-member-aa", initials: "AA", role: "Texniki mentor", focus: "Elektronika" },
      { id: "robot-member-se", initials: "SE", role: "Emalatxana rəhbəri", focus: "Prototipləmə" },
      { id: "robot-member-rm", initials: "RM", role: "İcma təmsilçisi", focus: "Yeni üzvlər" },
    ],
    history: [
      { year: "2018", title: "İlk laboratoriya görüşü", description: "On iki tələbə açıq avadanlıq masası ətrafında ilk komandanı qurdu." },
      { year: "2020", title: "Uzaqdan prototipləmə", description: "Sadə simulyasiya dəstləri ilə layihə sessiyaları rəqəmsal formata keçirildi." },
      { year: "2023", title: "Kampus problemləri proqramı", description: "Layihələr tələbə ehtiyacları əsasında seçilməyə başladı." },
      { year: "2026", title: "Açıq laboratoriya modeli", description: "Hər ixtisasdan tələbə üçün giriş sessiyaları daimi proqrama çevrildi." },
    ],
  },
  {
    slug: "debat-natiqlik",
    name: "Debat və Natiqlik Cəmiyyəti",
    shortName: "Debat",
    category: "Akademik",
    tagline: "Fikri aydın qur, diqqətlə dinlə, əsaslı danış.",
    description:
      "Arqument qurma, ictimai çıxış və hörmətli fikir mübadiləsi üçün praktik məkan.",
    about: [
      "Cəmiyyət arqumenti qalib gəlmək vasitəsi deyil, mürəkkəb mövzunu birlikdə anlama üsulu kimi görür. Sessiyalar qısa nəzəri giriş və bol praktika ilə qurulur.",
      "Yeni üzvlər müşahidəçi kimi başlaya, sonra kiçik qrup məşqlərinə qoşula bilər. Rəy konkret, nəzakətli və inkişaf yönümlüdür.",
    ],
    stats: [
      { label: "Aktiv üzv", value: "67" },
      { label: "Aylıq sessiya", value: "8" },
      { label: "Yaranıb", value: "2015" },
    ],
    tone: "violet",
    visualMark: "D02",
    meeting: {
      cadence: "Həftədə iki dəfə",
      day: "Çərşənbə axşamı və şənbə",
      time: "17:30",
      place: "Humanitar korpus · H-112",
    },
    focusTags: ["Debat", "Natiqlik", "Tənqidi düşüncə", "Dinləmə"],
    events: [
      {
        id: "arqumentin-arxitekturasi",
        title: "Arqumentin arxitekturası",
        summary: "İddia, əsaslandırma və nümunə arasında aydın əlaqə qurmağı məşq edirik.",
        date: "2026-07-19T15:00:00+04:00",
        dateLabel: "19 iyul",
        timeLabel: "15:00–16:30",
        place: "H-112 auditoriyası",
        format: "Emalatxana",
      },
      {
        id: "aciq-debat-gecesi",
        title: "Açıq debat gecəsi",
        summary: "İştirakçılar kampus həyatı ilə bağlı mövzunu iki fərqli baxışdan araşdırır.",
        date: "2026-07-25T18:30:00+04:00",
        dateLabel: "25 iyul",
        timeLabel: "18:30–20:00",
        place: "Kiçik akt zalı",
        format: "Açıq görüş",
      },
      {
        id: "iki-deqiqelik-cixis",
        title: "İki dəqiqəlik çıxış",
        summary: "Qısa hazırlıqdan sonra fikri sakit, dəqiq və yadda qalan şəkildə təqdim edirik.",
        date: "2026-08-02T16:00:00+04:00",
        dateLabel: "2 avqust",
        timeLabel: "16:00–17:30",
        place: "H-108 studiyası",
        format: "Sessiya",
      },
    ],
    members: [
      { id: "debate-member-na", initials: "NA", role: "Cəmiyyət rəhbəri", focus: "Proqram" },
      { id: "debate-member-te", initials: "TE", role: "Məşq koordinatoru", focus: "Natiqlik" },
      { id: "debate-member-ia", initials: "İA", role: "Turnir əlaqələndiricisi", focus: "Debat formatı" },
      { id: "debate-member-ms", initials: "MS", role: "Üzv təcrübəsi", focus: "Geri bildirim" },
    ],
    history: [
      { year: "2015", title: "İlk debat dairəsi", description: "Həftəlik kiçik qrup müzakirələri ilə cəmiyyət formalaşdı." },
      { year: "2017", title: "Açıq natiqlik proqramı", description: "Çıxış məşqləri bütün fakültələr üçün əlçatan oldu." },
      { year: "2022", title: "Dinləmə kodeksi", description: "Hörmətli müzakirə üçün ortaq davranış prinsipləri hazırlandı." },
      { year: "2025", title: "Kampus debat seriyası", description: "Tələbə həyatına aid mövzular aylıq açıq formatda müzakirə edilməyə başladı." },
    ],
  },
  {
    slug: "yasil-kampus",
    name: "Yaşıl Kampus Təşkilatı",
    shortName: "Yaşıl Kampus",
    category: "Sosial təsir",
    tagline: "Kiçik vərdişlərdən ölçülə bilən kampus dəyişikliyinə.",
    description:
      "Davamlılıq ideyalarını araşdıran və onları gündəlik kampus təcrübəsinə çevirən tələbə təşkilatı.",
    about: [
      "Təşkilat enerji, tullantı, su və biomüxtəliflik mövzularında kiçik, ölçülə bilən təşəbbüslər hazırlayır. Hər layihə müşahidə, sınaq və açıq nəticə paylaşımı mərhələlərindən keçir.",
      "İştirakçılar sahə işi, məlumat toplama, kommunikasiya və tədbir koordinasiyası kimi fərqli rollardan özlərinə uyğun olanı seçə bilirlər.",
    ],
    stats: [
      { label: "Aktiv könüllü", value: "103" },
      { label: "Davam edən təşəbbüs", value: "7" },
      { label: "Yaranıb", value: "2017" },
    ],
    tone: "mint",
    visualMark: "Y03",
    meeting: {
      cadence: "İki həftədən bir",
      day: "Cümə axşamı",
      time: "17:00",
      place: "Kampus bağı · Yaşıl pavilyon",
    },
    focusTags: ["Davamlılıq", "Təbiət", "Məlumat", "Sosial təsir"],
    events: [
      {
        id: "kampus-biomuxeliflik-seferi",
        title: "Kampus biomüxtəliflik səfəri",
        summary: "Bağ sahəsində bitki və quş müşahidələrini sadə xəritədə qeydə alırıq.",
        date: "2026-07-20T09:30:00+04:00",
        dateLabel: "20 iyul",
        timeLabel: "09:30–11:00",
        place: "Botanika bağı girişi",
        format: "Səfər",
      },
      {
        id: "tullantisiz-gun-laboratoriyasi",
        title: "Tullantısız gün laboratoriyası",
        summary: "Bir günlük sınaq üçün real və izlənə bilən azalma addımları hazırlayırıq.",
        date: "2026-07-28T17:00:00+04:00",
        dateLabel: "28 iyul",
        timeLabel: "17:00–18:30",
        place: "Yaşıl pavilyon",
        format: "Emalatxana",
      },
      {
        id: "yasil-tesebbuslar-demo",
        title: "Yaşıl təşəbbüslər demosu",
        summary: "Komandalar ölçdükləri təsiri, işləməyən fərziyyələri və növbəti sınağı paylaşır.",
        date: "2026-08-08T16:30:00+04:00",
        dateLabel: "8 avqust",
        timeLabel: "16:30–18:00",
        place: "Mərkəzi həyət",
        format: "Təqdimat",
      },
    ],
    members: [
      { id: "green-member-lm", initials: "LM", role: "Təşkilat koordinatoru", focus: "Təsir ölçümü" },
      { id: "green-member-eq", initials: "EQ", role: "Sahə işi rəhbəri", focus: "Biomüxtəliflik" },
      { id: "green-member-ss", initials: "SS", role: "Kommunikasiya", focus: "Maarifləndirmə" },
      { id: "green-member-ka", initials: "KA", role: "Layihə əlaqələndiricisi", focus: "Tullantıların azalması" },
    ],
    history: [
      { year: "2017", title: "Yaşıl işçi qrupu", description: "İlk tələbə qrupu kampusda çeşidləmə imkanlarını araşdırdı." },
      { year: "2019", title: "Açıq təsir hesabatı", description: "Təşəbbüslərin nəticələri semestr sonunda açıq paylaşılmağa başladı." },
      { year: "2023", title: "Kampus bağı tərəfdaşlığı", description: "Sahə müşahidələri üçün daimi açıq görüş nöqtəsi yaradıldı." },
      { year: "2026", title: "Yeddi paralel təşəbbüs", description: "Enerji, su, tullantı və biomüxtəliflik komandaları ortaq proqramda birləşdi." },
    ],
  },
  {
    slug: "vizual-hekaye",
    name: "Fotoqrafiya və Vizual Hekayə Klubu",
    shortName: "Vizual Hekayə",
    category: "Yaradıcılıq",
    tagline: "Gördüyün anı deyil, hiss etdiyin hekayəni göstər.",
    description:
      "Foto, kompozisiya və etik vizual hekayə quruculuğunu birlikdə öyrənən yaradıcı klub.",
    about: [
      "Klub bahalı avadanlıqdan çox müşahidə, işıq və hekayə düşüncəsinə diqqət edir. Telefon kamerası ilə də bütün sessiyalara qoşulmaq mümkündür.",
      "İşlər müqayisə üçün deyil, yaradıcı niyyəti aydınlaşdırmaq üçün müzakirə olunur. İnsan məxfiliyi və çəkiliş razılığı hər layihənin əsas qaydasıdır.",
    ],
    stats: [
      { label: "Aktiv üzv", value: "58" },
      { label: "Açıq arxiv seçimi", value: "240+" },
      { label: "Yaranıb", value: "2019" },
    ],
    tone: "coral",
    visualMark: "V04",
    meeting: {
      cadence: "Həftədə bir dəfə",
      day: "Cümə",
      time: "17:30",
      place: "Media studiyası · M-106",
    },
    focusTags: ["Fotoqrafiya", "Kompozisiya", "Hekayə", "Vizual etika"],
    events: [
      {
        id: "isik-ve-kolge-gezintisi",
        title: "İşıq və kölgə gəzintisi",
        summary: "Kampusun sakit keçidlərində kontrast və ritm üzərindən vizual qeydlər toplayırıq.",
        date: "2026-07-19T18:00:00+04:00",
        dateLabel: "19 iyul",
        timeLabel: "18:00–19:15",
        place: "Əsas bina qarşısı",
        format: "Səfər",
      },
      {
        id: "bir-kadr-bir-fikir",
        title: "Bir kadr, bir fikir",
        summary: "Seçilmiş kadrlarda diqqət mərkəzi və vizual sadəliyi birlikdə təhlil edirik.",
        date: "2026-07-26T16:00:00+04:00",
        dateLabel: "26 iyul",
        timeLabel: "16:00–17:30",
        place: "M-106 studiyası",
        format: "Sessiya",
      },
      {
        id: "kampus-hekayeleri-proyeksiyasi",
        title: "Kampus hekayələri proyeksiyası",
        summary: "Üzvlərin qısa vizual seriyaları səssiz proyeksiya və müəllif qeydləri ilə təqdim olunur.",
        date: "2026-08-07T19:00:00+04:00",
        dateLabel: "7 avqust",
        timeLabel: "19:00–20:30",
        place: "Açıq media həyəti",
        format: "Təqdimat",
      },
    ],
    members: [
      { id: "visual-member-ng", initials: "NG", role: "Klub rəhbəri", focus: "Vizual proqram" },
      { id: "visual-member-af", initials: "AF", role: "Studiyaya məsul", focus: "İşıq" },
      { id: "visual-member-za", initials: "ZA", role: "Arxiv redaktoru", focus: "Seçim" },
      { id: "visual-member-uo", initials: "ÜÖ", role: "Etika təmsilçisi", focus: "Razılıq və məxfilik" },
    ],
    history: [
      { year: "2019", title: "İlk foto gəzintisi", description: "Telefon və kamera ilə açıq kampus müşahidələri başladı." },
      { year: "2021", title: "Rəqəmsal seçim arxivi", description: "Üzvlərin işləri kontekst qeydləri ilə qorunmağa başladı." },
      { year: "2024", title: "Vizual etika çərçivəsi", description: "Razılıq və məxfilik qaydaları bütün layihələrə daxil edildi." },
      { year: "2026", title: "Səssiz proyeksiya seriyası", description: "Minimal təqdimat formatı aylıq klub ənənəsinə çevrildi." },
    ],
  },
  {
    slug: "konulluler-sebekesi",
    name: "Könüllülər Şəbəkəsi",
    shortName: "Könüllülər",
    category: "Sosial təsir",
    tagline: "Vaxtını mənalı işə, niyyətini davamlı təsirə çevir.",
    description:
      "Tələbələri bacarıqlarına və vaxtına uyğun etibarlı sosial təşəbbüslərlə birləşdirən təşkilat.",
    about: [
      "Şəbəkə könüllülüyü sadəcə tədbir günü deyil, hazırlıqdan nəticə qiymətləndirməsinə qədər bütöv proses kimi qurur. Hər rol üçün aydın vaxt və məsuliyyət təsviri verilir.",
      "İştirakçılar təhsil, əlçatanlıq, tədbir koordinasiyası və icma dəstəyi istiqamətlərindən birini seçə, istədikləri zaman rolunu dəyişə bilirlər.",
    ],
    stats: [
      { label: "Aktiv könüllü", value: "146" },
      { label: "Açıq imkan", value: "18" },
      { label: "Yaranıb", value: "2016" },
    ],
    tone: "amber",
    visualMark: "K05",
    meeting: {
      cadence: "Ayda iki dəfə",
      day: "Bazar ertəsi",
      time: "18:00",
      place: "Tələbə mərkəzi · T-201",
    },
    focusTags: ["Könüllülük", "Təhsil", "Əlçatanlıq", "İcma"],
    events: [
      {
        id: "konullu-rolunu-tap",
        title: "Könüllü rolunu tap",
        summary: "Vaxt, maraq və bacarıq əsasında uyğun rol seçmək üçün sakit tanışlıq sessiyası.",
        date: "2026-07-21T18:00:00+04:00",
        dateLabel: "21 iyul",
        timeLabel: "18:00–19:00",
        place: "T-201 görüş otağı",
        format: "Açıq görüş",
      },
      {
        id: "elcatan-tedbir-emalatxanasi",
        title: "Əlçatan tədbir emalatxanası",
        summary: "Tədbir məkanı, mətn və iştirak axınını daha əlçatan etməyin əsaslarını işləyirik.",
        date: "2026-07-30T17:30:00+04:00",
        dateLabel: "30 iyul",
        timeLabel: "17:30–19:00",
        place: "Tələbə mərkəzi",
        format: "Emalatxana",
      },
      {
        id: "yay-oxu-gunu",
        title: "Yay oxu günü",
        summary: "Məktəblilər üçün hekayə, sadə elm fəaliyyəti və yaradıcı oyun stansiyaları hazırlayırıq.",
        date: "2026-08-09T10:00:00+04:00",
        dateLabel: "9 avqust",
        timeLabel: "10:00–14:00",
        place: "İcma təhsil mərkəzi",
        format: "Səfər",
      },
    ],
    members: [
      { id: "volunteer-member-ra", initials: "RA", role: "Şəbəkə koordinatoru", focus: "Tərəfdaşlıqlar" },
      { id: "volunteer-member-hm", initials: "HM", role: "Rol dizaynı", focus: "Könüllü təcrübəsi" },
      { id: "volunteer-member-ay", initials: "AY", role: "Əlçatanlıq təmsilçisi", focus: "İnklüzivlik" },
      { id: "volunteer-member-vs", initials: "VS", role: "Təsir qeydləri", focus: "Nəticələr" },
    ],
    history: [
      { year: "2016", title: "Ortaq könüllü masası", description: "Kampus təşəbbüsləri ilk dəfə vahid siyahıda toplandı." },
      { year: "2018", title: "Rol təsviri standartı", description: "Hər imkan üçün vaxt, məsuliyyət və dəstək aydınlaşdırıldı." },
      { year: "2022", title: "Əlçatanlıq istiqaməti", description: "İnklüziv tədbir dəstəyi daimi proqrama çevrildi." },
      { year: "2026", title: "Bacarıq əsaslı uyğunluq", description: "Tələbələr maraq və bacarıqlarına görə imkanlarla uyğunlaşdırılmağa başladı." },
    ],
  },
  {
    slug: "sehne-musiqi",
    name: "Səhnə və Musiqi Birliyi",
    shortName: "Səhnə və Musiqi",
    category: "Mədəniyyət",
    tagline: "Səsini tap, səhnəni paylaş, birlikdə ritm yarat.",
    description:
      "Musiqi, performans və səhnə arxası yaradıcılıq üçün açıq, təzyiqsiz tələbə birliyi.",
    about: [
      "Birlik ifaçıları, səhnə quruluşu ilə maraqlananları və sadəcə yaradıcı prosesə qoşulmaq istəyənləri eyni məkanda birləşdirir. Dinləmə imtahanı yoxdur.",
      "Sessiyalar kiçik improvizasiya məşqləri, texniki hazırlıq və açıq səhnə gecələrindən ibarətdir. Təhlükəsiz və hörmətli yaradıcı mühit əsas prinsipdir.",
    ],
    stats: [
      { label: "Aktiv üzv", value: "92" },
      { label: "Aylıq açıq səhnə", value: "2" },
      { label: "Yaranıb", value: "2014" },
    ],
    tone: "cyan",
    visualMark: "S06",
    meeting: {
      cadence: "Həftədə bir dəfə",
      day: "Cümə axşamı",
      time: "19:00",
      place: "Yaradıcılıq studiyası · Y-101",
    },
    focusTags: ["Musiqi", "Performans", "Səhnə", "İmprovizasiya"],
    events: [
      {
        id: "ritm-dairesi",
        title: "Ritm dairəsi",
        summary: "Sadə ritm qatları ilə bir-birimizi dinləməyi və birlikdə temp qurmağı sınayırıq.",
        date: "2026-07-18T19:00:00+04:00",
        dateLabel: "18 iyul",
        timeLabel: "19:00–20:15",
        place: "Y-101 studiyası",
        format: "Sessiya",
      },
      {
        id: "sehne-arxasi-aciq-gorus",
        title: "Səhnə arxası açıq görüş",
        summary: "İşıq, səs və axın rollarını kiçik praktik stansiyalarda tanıyırıq.",
        date: "2026-07-27T17:00:00+04:00",
        dateLabel: "27 iyul",
        timeLabel: "17:00–18:30",
        place: "Kiçik akt zalı",
        format: "Emalatxana",
      },
      {
        id: "yay-aciq-sehnesi",
        title: "Yay açıq səhnəsi",
        summary: "Qısa musiqi və performans çıxışları sakit, dəstəkləyici açıq səhnədə görüşür.",
        date: "2026-08-05T19:30:00+04:00",
        dateLabel: "5 avqust",
        timeLabel: "19:30–21:00",
        place: "Mərkəzi həyət səhnəsi",
        format: "Təqdimat",
      },
    ],
    members: [
      { id: "stage-member-sd", initials: "SD", role: "Birlik rəhbəri", focus: "Yaradıcı proqram" },
      { id: "stage-member-op", initials: "ÖP", role: "Səhnə koordinatoru", focus: "İstehsal axını" },
      { id: "stage-member-cm", initials: "CM", role: "Musiqi sessiyaları", focus: "Ritm və ansambl" },
      { id: "stage-member-gn", initials: "GN", role: "Yeni üzvlər", focus: "Tanışlıq" },
    ],
    history: [
      { year: "2014", title: "İlk açıq səhnə", description: "Tələbələr kiçik akustik çıxışlar üçün bir araya gəldi." },
      { year: "2018", title: "Səhnə arxası komandası", description: "İşıq, səs və tədbir axını rolları ayrıca proqramlaşdırıldı." },
      { year: "2021", title: "Açıq studiya sessiyaları", description: "İmtahansız və təzyiqsiz yaradıcı məşqlər başladı." },
      { year: "2025", title: "Birgə səhnə kodeksi", description: "Təhlükəsiz, hörmətli və inklüziv iştirak prinsipləri qəbul edildi." },
    ],
  },
] as const satisfies readonly Club[];

export const communities = [
  {
    slug: "suni-intellekt",
    name: "Süni intellekt dairəsi",
    eyebrow: "Texnologiya",
    tagline: "Modeldən əvvəl problemi anla.",
    description: "AI alətlərini, etik sualları və kiçik praktik təcrübələri birlikdə araşdıran maraq qrupu.",
    memberCount: 238,
    activityLabel: "Bu həftə 12 yeni müzakirə",
    tone: "lime",
    visualMark: "AI",
    focusTags: ["AI", "Etika", "Praktika"],
  },
  {
    slug: "startap-emalatxanasi",
    name: "Startap emalatxanası",
    eyebrow: "Sahibkarlıq",
    tagline: "Fərziyyəni tez sına, öyrəndiyini paylaş.",
    description: "İdeya, istifadəçi problemi və dayanıqlı model haqqında açıq, praktik icma.",
    memberCount: 174,
    activityLabel: "6 komanda açıq rəy istəyir",
    tone: "violet",
    visualMark: "ST",
    focusTags: ["Məhsul", "Araşdırma", "Pitch"],
  },
  {
    slug: "kitab-dairesi",
    name: "Kitab dairəsi",
    eyebrow: "Oxu",
    tagline: "Səhifəni deyil, fikri birlikdə aç.",
    description: "Ayın seçilmiş kitabını tələsmədən oxuyan və fərqli baxışları dinləyən sakit icma.",
    memberCount: 126,
    activityLabel: "Növbəti görüşə 5 gün qalıb",
    tone: "amber",
    visualMark: "KD",
    focusTags: ["Ədəbiyyat", "Esse", "Müzakirə"],
  },
  {
    slug: "hereket-idman",
    name: "Hərəkət və idman",
    eyebrow: "Rifah",
    tagline: "Rəqabətdən çox davamlı ritm.",
    description: "Qaçış, komanda oyunları və yüngül hərəkət sessiyalarını əlçatan formatda birləşdirən qrup.",
    memberCount: 312,
    activityLabel: "Bu həftə 4 açıq məşq",
    tone: "cyan",
    visualMark: "HI",
    focusTags: ["Qaçış", "Komanda", "Rifah"],
  },
  {
    slug: "mehsul-dizayni",
    name: "Məhsul və UX icması",
    eyebrow: "Dizayn",
    tagline: "Sadə görünən təcrübənin arxasını qur.",
    description: "Araşdırma, interfeys və əlçatan məhsul qərarlarını nümunələr üzərindən işləyən icma.",
    memberCount: 159,
    activityLabel: "3 yeni portfel baxışı açıqdır",
    tone: "coral",
    visualMark: "UX",
    focusTags: ["UX", "UI", "Əlçatanlıq"],
  },
  {
    slug: "davamli-heyat",
    name: "Davamlı həyat qrupu",
    eyebrow: "Ekologiya",
    tagline: "Mükəmməl deyil, ölçülə bilən addım.",
    description: "Gündəlik seçimlər və kampus daxilində daha az resurs istifadəsi haqqında praktik fikir məkanı.",
    memberCount: 141,
    activityLabel: "Yeni 7 günlük sınaq başlayır",
    tone: "mint",
    visualMark: "DH",
    focusTags: ["Davamlılıq", "Vərdiş", "Kampus"],
  },
  {
    slug: "dil-mubadilesi",
    name: "Dil mübadiləsi",
    eyebrow: "Mədəniyyət",
    tagline: "Səhv etmək üçün rahat, danışmaq üçün canlı məkan.",
    description: "Fərqli dillərdə gündəlik danışıq məşqi və mədəniyyət mübadiləsi üçün kiçik qruplar.",
    memberCount: 205,
    activityLabel: "18 yeni uyğunluq yaradılıb",
    tone: "violet",
    visualMark: "DM",
    focusTags: ["Danışıq", "Mədəniyyət", "Uyğunluq"],
  },
  {
    slug: "musiqi-laboratoriyasi",
    name: "Musiqi laboratoriyası",
    eyebrow: "Yaradıcılıq",
    tagline: "Səsi sına, ritmi paylaş.",
    description: "Janr və təcrübə səviyyəsindən asılı olmayaraq improvizasiya və səs təcrübələri üçün açıq qrup.",
    memberCount: 118,
    activityLabel: "Cümə sessiyasında 8 yer qalıb",
    tone: "cyan",
    visualMark: "ML",
    focusTags: ["Musiqi", "Səs", "İmprovizasiya"],
  },
] as const satisfies readonly Community[];

export function getClubBySlug(slug: string) {
  return clubs.find((club) => club.slug === slug);
}

export type ClubApiRecord={
  id:string;slug:string;name:string;shortName:string;category:string;coordinatorInitials:string;memberCount:number;eventCount:number;status:string;coverUrl?:string;createdBy?:string|null;
  tagline:string;description:string;about:string[];tone:ClubTone;visualMark:string;meeting:ClubMeeting;focusTags:string[];
  events:ClubEvent[];members:ClubMember[];history:ClubHistoryMilestone[];
};

export function clubFromApi(record:ClubApiRecord):Club {
  return {id:record.id,createdBy:record.createdBy,status:record.status,slug:record.slug,name:record.name,shortName:record.shortName,category:normalizeClubCategory(record.category),tagline:record.tagline,
    description:record.description,about:record.about,stats:[{label:"club.statMembers",value:String(record.memberCount)},{label:"club.statEvents",value:String(record.events.length)}],
    tone:record.tone,visualMark:record.visualMark,meeting:record.meeting,focusTags:record.focusTags,events:record.events,members:record.members,history:record.history,coverUrl:record.coverUrl};
}

function normalizeClubCategory(value:string):ClubCategory {if(value==="Texnologiya"||value==="Akademik"||value==="Yaradıcılıq"||value==="Sosial təsir"||value==="Mədəniyyət")return value;return "Akademik";}
