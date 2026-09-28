import { databasePool, type UserRecord } from "./database.js";
import { listSessions } from "./auth-security.js";
import { listNotifications } from "./notifications.js";
import { getMedia } from "./media.js";

/**
 * "Məlumatlarımı yüklə" — istifadəçinin öz fərdi məlumatlarının surəti
 * (Fərdi məlumatlar haqqında Qanun: subyektin məlumatla tanış olmaq hüququ).
 *
 * Qayda: yalnız bu istifadəçinin yaratdığı və ya ona aid olan qeydlər. Başqa
 * istifadəçilərin adı, e-poçtu və mesajları fayla düşmür — söhbətlərdən yalnız
 * istifadəçinin ÖZ göndərdiyi mesajlar gəlir. Şifrə heşi, token heşləri və 2FA
 * sirri heç vaxt daxil edilmir.
 */
export type AccountExport = {
  format: "edurate-account-export";
  version: 1;
  generatedAt: string;
  profile: Record<string, unknown>;
  data: Record<string, unknown[]>;
};

function iso(value: unknown) {
  return value ? new Date(String(value)).toISOString() : null;
}

/** Hər sorğu ayrıca: bir cədvəl problemi bütün ixracı pozmasın. */
async function rows(sql: string, userId: string): Promise<Record<string, unknown>[]> {
  if (!databasePool) return [];
  const result = await databasePool.query(sql, [userId]);
  return result.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])));
}

export async function buildAccountExport(user: UserRecord): Promise<AccountExport> {
  const avatar = await getMedia("avatar", user.id);
  const profile = {
    id: user.id,
    name: user.name,
    email: user.email,
    university: user.university,
    faculty: user.faculty,
    program: user.program,
    year: user.year,
    city: user.city,
    about: user.about,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    termsVersion: user.termsVersion,
    privacyVersion: user.privacyVersion,
    legalAcceptedAt: user.legalAcceptedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    avatarUrl: avatar?.secureUrl ?? null,
  };
  const [sessions, notifications] = await Promise.all([
    listSessions(user.id),
    listNotifications(user.id, 100),
  ]);
  const data: Record<string, unknown[]> = {
    sessions: sessions.map(({ current: _current, ...session }) => session),
    notifications: notifications.items,
  };

  if (databasePool) {
    const queries: Record<string, string> = {
      teacherReviews: `SELECT id, teacher_profile_id, course, semester, review_text, clarity, subject_knowledge, objectivity, communication, rating, status, created_at
                         FROM teacher_reviews WHERE user_id=$1 ORDER BY created_at`,
      campusQuestions: "SELECT id, title, body, topic, status, created_at, updated_at FROM campus_questions WHERE author_id=$1 ORDER BY created_at",
      campusAnswers: "SELECT id, question_id, body, status, created_at FROM campus_answers WHERE author_id=$1 ORDER BY created_at",
      announcementComments: "SELECT id, announcement_id, body, anonymous, created_at FROM announcement_comments WHERE author_id=$1 ORDER BY created_at",
      sentMessages: `SELECT id, conversation_id, body, created_at, edited_at, deleted_at
                       FROM messages WHERE sender_id=$1 ORDER BY created_at`,
      conversations: "SELECT conversation_id, role, joined_at, last_read_at FROM conversation_participants WHERE user_id=$1 ORDER BY joined_at",
      connections: `SELECT id, CASE WHEN requester_id=$1 THEN 'sent' ELSE 'received' END AS direction, status, created_at, updated_at
                      FROM connections WHERE requester_id=$1 OR recipient_id=$1 ORDER BY created_at`,
      clubMemberships: "SELECT club_id, role, created_at FROM club_memberships WHERE user_id=$1 ORDER BY created_at",
      clubsCreated: "SELECT id, name, status, created_at FROM clubs WHERE created_by=$1 ORDER BY created_at",
      eventRegistrations: "SELECT r.event_id, e.title, e.start_at, r.created_at FROM event_registrations r LEFT JOIN events e ON e.id=r.event_id WHERE r.user_id=$1 ORDER BY r.created_at",
      eventsCreated: "SELECT id, title, admin_status, start_at, created_at FROM events WHERE created_by=$1 ORDER BY created_at",
      mentorshipRequests: "SELECT id, mentor_profile_id, note, status, created_at, updated_at FROM mentorship_requests WHERE user_id=$1 ORDER BY created_at",
      mentorApplications: "SELECT id, specialty, biography, availability, meeting_mode, languages, status, created_at, updated_at FROM mentor_applications WHERE user_id=$1 ORDER BY created_at",
      supportTickets: "SELECT reference, name, email, topic, message, status, created_at, updated_at FROM support_tickets WHERE user_id=$1 ORDER BY created_at",
      contentReports: "SELECT id, entity_type, entity_id, reason, details, status, created_at FROM content_reports WHERE reporter_id=$1 ORDER BY created_at",
      marketplaceListings: "SELECT id, title, details, kind, category, price, status, created_at, updated_at FROM marketplace_listings WHERE user_id=$1 ORDER BY created_at",
      feedPosts: "SELECT id, kind, category, title, summary, status, published_at FROM feed_posts WHERE user_id=$1 ORDER BY published_at",
      timetable: "SELECT subject, teacher, room, day_of_week, start_minute, end_minute, created_at FROM timetable_entries WHERE user_id=$1 ORDER BY day_of_week, start_minute",
      announcementReactions: "SELECT announcement_id, emoji FROM announcement_reactions WHERE user_id=$1",
      pushDevices: "SELECT user_agent, created_at, last_used_at FROM push_subscriptions WHERE user_id=$1 ORDER BY created_at",
    };
    for (const [name, sql] of Object.entries(queries)) {
      data[name] = await rows(sql, user.id);
    }
  }

  return {
    format: "edurate-account-export",
    version: 1,
    generatedAt: new Date().toISOString(),
    profile: { ...profile, createdAt: iso(profile.createdAt), updatedAt: iso(profile.updatedAt) },
    data,
  };
}
