export type ProfileStat = {
  id: "events" | "connections" | "saved";
  label: string;
  value: number;
};

export type ProfileActivity = {
  id: string;
  category: string;
  title: string;
  description: string;
  date: string;
  dateTime: string;
};

export type UserProfile = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "Tələbə" | "Müəllim" | "Mentor" | "Rəhbərlik";
  accessRole?: "student" | "mentor" | "teacher" | "admin" | "assistant_admin" | "owner_admin";
  university: string;
  faculty: string;
  program: string;
  year: string;
  city: string;
  about: string;
  /**
   * İstifadəçinin HƏQİQƏTƏN doldurduğu dəyərlər. Backend yeni hesabı yer
   * tutucu mətnlərlə yaradır ("Kurs məlumatı əlavə edilməyib" və s.) və
   * yuxarıdakı sahələr göstəriş üçün də yer tutucu ilə doldurulur — burada
   * isə doldurulmayan sahə boş sətirdir. Tamamlanma faizi və redaktə forması
   * bunu işlədir.
   */
  details: { program: string; year: string; about: string };
  interests: readonly string[];
  completion: number;
  stats: readonly ProfileStat[];
  activities: readonly ProfileActivity[];
};

export type SignInInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  university: string;
  faculty: string;
  program: string;
  accountType: "student" | "teacher";
  legalAccepted: true;
};

export type RegisterResult = {
  user: UserProfile | null;
  requiresApproval: boolean;
  requiresEmailVerification?: boolean;
  emailDeliveryPending?: boolean;
  accountType: RegisterInput["accountType"];
};

export type ProfileUpdateInput = Pick<
  UserProfile,
  "name" | "university" | "faculty" | "program" | "year" | "about"
>;

export type AuthGateway = {
  signIn: (input: SignInInput) => Promise<UserProfile>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  signOut: () => Promise<void>;
  updateProfile: (
    profile: UserProfile,
    input: ProfileUpdateInput,
  ) => Promise<UserProfile>;
};

const emptyProfileStats: readonly ProfileStat[] = [
  { id: "events", label: "Qoşulduğu tədbirlər", value: 0 },
  { id: "connections", label: "İcma əlaqələri", value: 0 },
  { id: "saved", label: "Yadda saxlananlar", value: 0 },
];

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("az") ?? "")
    .join("") || "ER";
}

export function createIdentityProfile(nameValue: string, emailValue: string): UserProfile {
  const name = nameValue.trim() || emailValue.trim();
  const email = emailValue.trim().toLocaleLowerCase("az");

  return {
    id: `student-${normalizeIdentifier(email)}`,
    name,
    initials: getInitials(name),
    email,
    role: "Tələbə",
    accessRole: "student",
    university: "Universitet məlumatı əlavə edilməyib",
    faculty: "Fakültə məlumatı əlavə edilməyib",
    program: "İxtisas məlumatı əlavə edilməyib",
    year: "Kurs məlumatı əlavə edilməyib",
    city: "Azərbaycan",
    about: "Profilini tamamlayaraq universitetini, maraqlarını və öyrənmə məqsədlərini icma ilə paylaş.",
    details: { program: "", year: "", about: "" },
    interests: [],
    completion: 0,
    stats: emptyProfileStats,
    activities: [],
  };
}

function normalizeIdentifier(email: string): string {
  const normalized = email
    .trim()
    .toLocaleLowerCase("az")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "new-member";
}
