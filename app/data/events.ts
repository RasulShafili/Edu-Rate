export type EventCategory = "Design" | "Technology" | "Culture" | "Wellness";
export type EventMonth = "JAN" | "FEB" | "MAR" | "APR" | "MAY" | "JUN" | "JUL" | "AUG" | "SEP" | "OCT" | "NOV" | "DEC";

export type Event = {
  id: string;
  category: EventCategory;
  date: string;
  month: EventMonth;
  time: string;
  title: string;
  location: string;
  city: string;
  description: string;
  longDescription: string;
  accent: string;
  glow: string;
  speakers: string[];
  capacity: string;
  startAt: string;
  endAt: string;
  registrationDeadline: string;
  organizer: string;
  availableSpots: number;
  imageUrl?: string;
};

export const categories = [
  "All",
  "Design",
  "Technology",
  "Culture",
  "Wellness",
] as const;

export type EventFilter = (typeof categories)[number];

export const eventCategoryLabels: Record<EventFilter, string> = {
  All: "Hamısı",
  Design: "Dizayn",
  Technology: "Texnologiya",
  Culture: "Mədəniyyət",
  Wellness: "Sağlamlıq",
};

export const eventMonthLabels: Record<EventMonth, string> = {
  JAN: "YAN",
  FEB: "FEV",
  MAR: "MAR",
  APR: "APR",
  MAY: "MAY",
  JUN: "İYN",
  JUL: "İYL",
  AUG: "AVQ",
  SEP: "SEN",
  OCT: "OKT",
  NOV: "NOY",
  DEC: "DEK",
};

export const eventMonthLongLabels: Record<EventMonth, string> = {
  JAN: "yanvar",
  FEB: "fevral",
  MAR: "mart",
  APR: "aprel",
  MAY: "may",
  JUN: "iyun",
  JUL: "iyul",
  AUG: "avqust",
  SEP: "sentyabr",
  OCT: "oktyabr",
  NOV: "noyabr",
  DEC: "dekabr",
};

export type ApiEvent = {
  id: string;
  category: EventCategory;
  title: string;
  description: string;
  longDescription: string;
  location: string;
  city: string;
  organizer: string;
  startAt: string;
  endAt: string;
  registrationDeadline: string;
  speakers: string[];
  capacity: number;
  availableSpots: number;
  accent: string;
  glow: string;
  imageUrl?: string;
};

const monthCodes: EventMonth[] = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function mapApiEvent(event: ApiEvent): Event {
  const start = new Date(event.startAt);
  return {
    ...event,
    date: new Intl.DateTimeFormat("az-AZ", { day: "2-digit", timeZone: "Asia/Baku" }).format(start),
    month: monthCodes[Number(new Intl.DateTimeFormat("en-US", { month: "2-digit", timeZone: "Asia/Baku" }).format(start)) - 1] ?? "JAN",
    time: new Intl.DateTimeFormat("az-AZ", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Baku" }).format(start),
    // Bu sahə TUTUMDUR, qeydiyyatdan keçənlərin sayı deyil. Əvvəl "iştirakçı"
    // yazılırdı və drawer-də "50 iştirakçı · 50 boş yer" kimi ziddiyyətli
    // cümlə çıxırdı (tutum 50, qeydiyyat 0 olduğu halda).
    capacity: `${event.capacity} nəfərlik tutum`,
  };
}

export const events: Event[] = [
  {
    id: "future-forms",
    category: "Design",
    date: "18",
    month: "SEP",
    time: "18:30",
    title: "Gələcəyin formaları",
    location: "Yaradıcılıq zalı",
    city: "Xankəndi",
    description: "Yeni ideyaları, sistemləri və hekayələri birlikdə araşdıran kampus görüşü.",
    longDescription:
      "Dizayna maraq göstərən tələbələr üçün canlı görüş. Material təcrübələrini, məkan interfeyslərini və daha düşünülmüş sabah yaradan insanlarla söhbətləri kampusda bir araya gətirir.",
    accent: "#c8ff4d",
    glow: "rgba(200, 255, 77, 0.28)",
    speakers: ["Ləman Həsənli", "Nihad Əlizadə", "Aytac Hüseynova"],
    capacity: "180 nəfərlik tutum",
    startAt: "2026-09-18T18:30:00+04:00",
    endAt: "2026-09-18T20:00:00+04:00",
    registrationDeadline: "2026-09-17T23:59:59+04:00",
    organizer: "Dizayn və yaradıcılıq mərkəzi",
    availableSpots: 42,
  },
  {
    id: "human-machine",
    category: "Technology",
    date: "22",
    month: "SEP",
    time: "19:00",
    title: "İnsan / Maşın",
    location: "Texnologiya laboratoriyası",
    city: "Xankəndi",
    description: "Zəka, təxəyyül və bizi insan edən dəyərlər haqqında səmimi söhbət.",
    longDescription:
      "Ağıllı alətlərlə münasibətimiz barədə daha düzgün suallar verən bu görüş praktik düşüncə, canlı müzakirə və açıq fikirli tələbələri bir araya gətirir.",
    accent: "#b9a7ff",
    glow: "rgba(185, 167, 255, 0.3)",
    speakers: ["İradə Babayeva", "Kamran Məmmədli", "Aysu Quliyeva"],
    capacity: "120 nəfərlik tutum",
    startAt: "2026-09-22T19:00:00+04:00",
    endAt: "2026-09-22T20:30:00+04:00",
    registrationDeadline: "2026-09-21T23:59:59+04:00",
    organizer: "Texnologiya klubu",
    availableSpots: 18,
  },
  {
    id: "afterlight",
    category: "Culture",
    date: "28",
    month: "SEP",
    time: "21:00",
    title: "İşıqdan sonra",
    location: "Kampus mədəniyyət mərkəzi",
    city: "Xankəndi",
    description: "Səs, işıq, hərəkət və ortaq heyrət hissini birləşdirən immersiv gecə.",
    longDescription:
      "Kampus axşamında “İşıqdan sonra” başlayır. İnteraktiv instalyasiyalar, canlı performanslar və dəyişən səs mənzərələri arasında sərbəst dolaş.",
    accent: "#ff9e7a",
    glow: "rgba(255, 158, 122, 0.3)",
    speakers: ["Xəzər Studiyası", "Elvin Vəliyev", "Aynur Rəhimli"],
    capacity: "350 nəfərlik tutum",
    startAt: "2026-09-28T21:00:00+04:00",
    endAt: "2026-09-28T23:00:00+04:00",
    registrationDeadline: "2026-09-27T23:59:59+04:00",
    organizer: "Mədəniyyət mərkəzi",
    availableSpots: 96,
  },
  {
    id: "soft-reset",
    category: "Wellness",
    date: "04",
    month: "OCT",
    time: "09:30",
    title: "Yumşaq başlanğıc",
    location: "Yaşıl kampus həyəti",
    city: "Xankəndi",
    description: "Diqqəti, enerjini və yenidən başlamaq hissini bərpa edən sakit səhər.",
    longDescription:
      "Daim məşğul düşüncələr üçün yarımgünlük fasilə. Kampusun sakit həyətində hərəkət, nəfəs məşqləri və şüurlu fasilə bir araya gəlir.",
    accent: "#7de5d1",
    glow: "rgba(125, 229, 209, 0.28)",
    speakers: ["Nərmin Əliyeva", "Mahir Soltanlı", "Sakit Studiyası"],
    capacity: "48 nəfərlik tutum",
    startAt: "2026-10-04T09:30:00+04:00",
    endAt: "2026-10-04T12:30:00+04:00",
    registrationDeadline: "2026-10-02T18:00:00+04:00",
    organizer: "Tələbə rifahı mərkəzi",
    availableSpots: 8,
  },
  {
    id: "strange-loops",
    category: "Technology",
    date: "11",
    month: "OCT",
    time: "17:45",
    title: "Qəribə dövrlər",
    location: "Açıq laboratoriya",
    city: "Xankəndi",
    description: "Kod, musiqi və yeni yaradıcı sistemlərin sərhədində canlı təcrübələr.",
    longDescription:
      "Bir qədər konsert, bir qədər laboratoriya olan “Qəribə dövrlər” yaradıcı texnoloqları səhnədə yeni sistemlər qurmağa, sınaqdan keçirməyə və canlı remiks etməyə dəvət edir. Nəticəni tamaşaçılar da formalaşdırır.",
    accent: "#77b8ff",
    glow: "rgba(119, 184, 255, 0.3)",
    speakers: ["Sıra Laboratoriyası", "Mələk Cəfərova", "Tural Qarayev"],
    capacity: "220 nəfərlik tutum",
    startAt: "2026-10-11T17:45:00+04:00",
    endAt: "2026-10-11T20:00:00+04:00",
    registrationDeadline: "2026-10-10T23:59:59+04:00",
    organizer: "Açıq laboratoriya",
    availableSpots: 64,
  },
  {
    id: "new-rituals",
    category: "Design",
    date: "16",
    month: "OCT",
    time: "18:00",
    title: "Yeni rituallar",
    location: "Dizayn studiyası",
    city: "Xankəndi",
    description: "Dizaynerlər gündəlik həyatı quran əşyalara və vərdişlərə yenidən baxırlar.",
    longDescription:
      "Gündəlik həyatın sakit axınından bəhs edən, əşyaların ön planda olduğu səmimi sərgi. Sənətkarlıq, texnologiya və qayğı ilə tanış vərdişlərə yeni məna verən dizaynerlərlə görüş.",
    accent: "#f7d56f",
    glow: "rgba(247, 213, 111, 0.28)",
    speakers: ["Nərgiz Vəlizadə", "Səhər Bürosu", "Rauf İsmayılov"],
    capacity: "95 nəfərlik tutum",
    startAt: "2026-10-16T18:00:00+04:00",
    endAt: "2026-10-16T19:30:00+04:00",
    registrationDeadline: "2026-10-15T18:00:00+04:00",
    organizer: "Memarlıq və dizayn fakültəsi",
    availableSpots: 27,
  },
];
