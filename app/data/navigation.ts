export const platformRoutes = [
  {
    href: "/schedule",
    label: "Cədvəl",
    number: "00",
    title: "Həftən bir baxışda",
    description: "Dərslərin, növbəti dərsin və bu gün kampusda baş verənlər bir yerdə.",
    metric: "Şəxsi dərs cədvəli",
    accent: "#7de5d1",
  },
  {
    href: "/events",
    label: "Tədbirlər",
    number: "01",
    title: "Yeni təcrübələr kəşf et",
    description: "Kiçik qruplar, böyük ideyalar və düşünülmüş görüşlər.",
    metric: "Yayımlanmış tədbirlər",
    accent: "#c8ff4d",
  },
  {
    href: "/community",
    label: "İcma",
    number: "02",
    title: "Doğru insanlarla tanış ol",
    description: "Ortaq maraqlardan başlayan səmimi və məqsədli əlaqələr.",
    metric: "Aktiv icma üzvləri",
    accent: "#77b8ff",
  },
  {
    href: "/support",
    label: "Dəstək",
    number: "05",
    title: "Cavabı vaxtında tap",
    description: "Aydın cavablar və ehtiyac olanda insan yönümlü dəstək.",
    metric: "1 iş günü ərzində cavab",
    accent: "#7de5d1",
  },
  {
    href: "/feed",
    label: "Elanlar",
    number: "06",
    title: "Universitetin nəbzini izlə",
    description: "Tələbə paylaşımlarını, vacib elanları və kampus yeniliklərini bir yerdə izlə.",
    metric: "gündəlik yenilənən şəbəkə",
    accent: "#ffcf66",
  },
  {
    href: "/clubs",
    label: "Klublar",
    number: "07",
    title: "Maraq dairəni icmaya çevir",
    description: "Tələbə klubları, təşkilatlar və ortaq məqsədlər ətrafında yaranan birliklər.",
    metric: "Aktiv tələbə klubları",
    accent: "#ff9e7a",
  },
] as const;

export type PlatformRoute = (typeof platformRoutes)[number];

export const accountRoutes = [
  { href: "/profile", label: "Profil" },
  { href: "/workspace", label: "İş paneli" },
  { href: "/settings", label: "Parametrlər" },
  { href: "/auth", label: "Daxil ol" },
] as const;

export const primaryNavigationGroups = [
  { label: "Gündəlik", routes: ["/schedule", "/feed"] },
  { label: "Kəşf et", routes: ["/events", "/clubs"] },
  { label: "İnsanlar", routes: ["/community"] },
] as const;

export const allPlatformRoutes = [...platformRoutes, ...accountRoutes] as const;
