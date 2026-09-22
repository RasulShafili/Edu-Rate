/*
 * `/api/workspace` göstərici adlarını, element növlərini və statusları hazır
 * azərbaycanca və ya xam (`pending`, `open`) qaytarır. İş paneli və Profil
 * əvvəl onları olduğu kimi göstərirdi — istifadəçi "pending" görürdü, digər
 * dillərdə isə azərbaycanca mətn qalırdı. Tanınan dəyər tərcümə açarına
 * çevrilir, tanınmayan dəyər olduğu kimi qalır.
 */
export const METRIC_KEYS: Record<string, string> = {
  "Tədbir qeydiyyatı": "profile.metric.eventRegistrations",
  "Klub üzvlüyü": "profile.metric.clubs",
  "Mentorluq müraciəti": "profile.metric.mentorships",
  "Dəstək bileti": "profile.metric.tickets",
  "Təsdiqlənmiş rəy": "profile.metric.approvedReviews",
  "Gözləyən rəy": "profile.metric.pendingReviews",
  "Orta qiymət": "profile.metric.averageRating",
  "Yeni müraciət": "profile.metric.newRequests",
  "Qəbul edilib": "profile.metric.acceptedRequests",
  "Ümumi müraciət": "profile.metric.totalRequests",
  "İstifadəçi": "profile.metric.users",
  "Tədbir": "profile.metric.events",
  "Klub": "profile.metric.clubCount",
};

export const TYPE_KEYS: Record<string, string> = {
  "Tədbir": "profile.type.event",
  "Klub": "profile.type.club",
  "Mentor": "profile.type.mentor",
  "Dəstək": "profile.type.support",
};

export const STATUS_KEYS: Record<string, string> = {
  pending: "profile.status.pending",
  accepted: "profile.status.accepted",
  rejected: "profile.status.rejected",
  cancelled: "profile.status.cancelled",
  open: "profile.status.open",
  in_progress: "profile.status.in_progress",
  resolved: "profile.status.resolved",
  approved: "profile.status.approved",
  "Qeydiyyat aktivdir": "profile.status.registered",
  "Klub üzvü": "profile.status.member",
};

/** Backend `toChatPeer` rol adını azərbaycanca verir; söhbət paneli isə `role.*` açarı gözləyir. */
export const CHAT_ROLE_KEYS: Record<string, string> = {
  "Tələbə": "role.student",
  "Mentor": "role.mentor",
  "Müəllim / Mentor": "role.teacher",
};

export function translateLabel(map: Record<string, string>, value: string, t: (key: string) => string) {
  return map[value] ? t(map[value]) : value;
}
