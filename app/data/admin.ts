export type AdminCollectionKind = "users" | "clubs" | "events";

export type AdminRecordStatus =
  | "Aktiv"
  | "Gözləmədə"
  | "Məhdudlaşdırılıb"
  | "Açıq"
  | "Qaralama"
  | "Tamamlanıb";

export type AdminUserStatus = Extract<
  AdminRecordStatus,
  "Aktiv" | "Gözləmədə" | "Məhdudlaşdırılıb"
>;

export type AdminClubStatus = Extract<
  AdminRecordStatus,
  "Aktiv" | "Gözləmədə" | "Məhdudlaşdırılıb"
>;

export type AdminEventStatus = Extract<
  AdminRecordStatus,
  "Açıq" | "Qaralama" | "Tamamlanıb"
>;

export type AdminRecordBase<
  TStatus extends AdminRecordStatus = AdminRecordStatus,
> = {
  id: string;
  name: string;
  detail: string;
  status: TStatus;
  metric: string;
  updatedAt: string;
};

export type AdminUserRole = "student" | "mentor" | "teacher" | "assistant_admin" | "admin" | "owner_admin";

export type AdminUser = AdminRecordBase<AdminUserStatus> & {
  kind: "users";
  email: string;
  initials: string;
  role: AdminUserRole;
  university: string;
  faculty: string;
  /** Köhnə backend bu sahəni göndərmirdi — o halda `metric` göstərilir. */
  emailVerified?: boolean;
  connectionCount: number;
  joinedAt: string;
  lastActiveAt: string;
};

export type AdminClub = AdminRecordBase<AdminClubStatus> & {
  kind: "clubs";
  slug: string;
  category: string;
  coordinatorInitials: string;
  shortName?:string;
  tagline?:string;
  description?:string;
  about?:string[];
  tone?:"lime"|"violet"|"cyan"|"coral"|"amber"|"mint";
  visualMark?:string;
  meeting?:{cadence:string;day:string;time:string;place:string};
  focusTags?:string[];
  memberCount: number;
  eventCount: number;
  createdAt: string;
  coverUrl?: string;
};

export type AdminEvent = AdminRecordBase<AdminEventStatus> & {
  kind: "events";
  category: string;
  organizer: string;
  startAt: string;
  attendeeCount: number;
  capacity: number;
  place: string;
  imageUrl?: string;
};

export type AdminCollectionRecord = AdminUser | AdminClub | AdminEvent;

/**
 * `counts` xam rəqəmlərdir; etiketi interfeys seçilmiş dildə qurur. Əvvəl burada
 * `trend` sahəsi vardı: backend onu həmişə "up" göndərirdi, kart isə yaşıl ox və
 * "əvvəlki dövrlə müqayisə" yazırdı — halbuki heç bir müqayisə aparılmırdı.
 */
export type AdminMetric = {
  id: "users" | "clubs" | "events" | "engagement";
  label: string;
  value: string;
  change: string;
  counts?: {
    value: number;
    total?: number;
    pending?: number;
    memberships?: number;
    reviews?: number;
  };
};

export type AdminActivityPoint = {
  label: string;
  /** "2026-09" — ay adı lüğətdən qurulur. */
  month?: string;
  users: number;
  clubs: number;
  events: number;
};

export type AdminDistributionPoint = {
  name: string;
  value: number;
  color: string;
};

export type AdminRecentActivity = {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  occurredAt: string;
  tone: "lime" | "blue" | "violet" | "coral";
};

export type AdminOverview = {
  updatedAt: string;
  metrics: readonly AdminMetric[];
  activity: readonly AdminActivityPoint[];
  distribution: readonly AdminDistributionPoint[];
  recentActivity: readonly AdminRecentActivity[];
};

export type AdminPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminListQuery = {
  search?: string;
  status?: AdminRecordStatus | "all";
  page?: number;
  pageSize?: number;
};

export type AdminUserQuery = AdminListQuery & {
  role?: AdminUserRole | "all";
};

export type AdminClubQuery = AdminListQuery & {
  category?: string;
};

export type AdminEventQuery = AdminListQuery & {
  category?: string;
  from?: string;
  to?: string;
};

export type AdminUserCreateInput = Pick<
  AdminUser,
  "name" | "email" | "role" | "university" | "faculty"
> & {
  status?: AdminUser["status"];
};

export type AdminUserUpdateInput = Partial<AdminUserCreateInput>;

export type AdminClubCreateInput = Pick<AdminClub,"name"|"slug"|"category"|"coordinatorInitials"> & {
  shortName:string;tagline:string;description:string;about:string[];
  tone:"lime"|"violet"|"cyan"|"coral"|"amber"|"mint";visualMark:string;
  meeting:{cadence:string;day:string;time:string;place:string};focusTags:string[];
  status?: AdminClub["status"];
};

export type AdminClubUpdateInput = Partial<AdminClubCreateInput>;

export type AdminEventCreateInput = Pick<
  AdminEvent,
  "name" | "category" | "organizer" | "startAt" | "capacity" | "place"
> & {
  status?: AdminEvent["status"];
};

export type AdminEventUpdateInput = Partial<AdminEventCreateInput>;

export const adminRoleLabels: Record<AdminUserRole, string> = {
  student: "Tələbə",
  mentor: "Mentor",
  teacher: "Müəllim",
  assistant_admin: "Admin köməkçisi",
  admin: "Administrator",
  owner_admin: "Platforma sahibi",
};
