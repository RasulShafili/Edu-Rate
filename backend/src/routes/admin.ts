import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  createEvent,
  deleteEvent,
  findEventById,
  listEvents,
  updateEvent,
  type EventCategory,
  type EventRecord,
} from "../db/business.js";
import {
  assistantUpdateUserRole,
  adminUpdateUser,
  createUser,
  countOwnerAdmins,
  deleteUser,
  findUserById,
  listUsers,
  type UserRecord,
} from "../db/database.js";
import {
  createClub,
  deleteClub,
  getPlatformCounts,
  listSupportTickets,
  listTeacherReviews,
  listClubs,
  findClub,
  updateTeacherReviewStatus,
  updateClub,
  updateSupportTicketStatus,
  type ClubRecord,
} from "../db/platform.js";
import { ApiError } from "../lib/api-error.js";
import { hashPassword } from "../lib/auth.js";
import { authenticate, requireAdmin, requireAdminTwoFactor, requireOwnerAdmin } from "../middleware/authenticate.js";
import {
  deactivateProfessionalProfilesForUser,
  synchronizeProfessionalProfilesForUser,
} from "../db/professionals.js";
import { listAudit, writeAudit } from "../db/audit.js";
import { createAnnouncement, deleteAnnouncement, deleteFeedPost, findAnnouncementById, listAdminAnnouncements, listAdminFeed, updateAnnouncement, updateFeedPostStatus } from "../db/network.js";
import { decideMentorApplication, listMentorApplications } from "../db/mentor-applications.js";
import { ensureClubConversation, findMessageForReport, listContentReports, updateContentReport } from "../db/messaging.js";
import { createActionToken } from "../db/auth-security.js";
import { sendPush } from "../db/push.js";
import { notifyUser } from "../db/notifications.js";
import { accountActionUrl, EmailDeliveryError, sendAccountEmail } from "../lib/email.js";

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin, requireAdminTwoFactor);

const userStatus = z.enum(["Aktiv", "Gözləmədə", "Məhdudlaşdırılıb"]);
const userRole = z.enum(["student", "mentor", "teacher", "assistant_admin", "admin", "owner_admin"]);
const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  role: userRole,
  university: z.string().trim().min(2).max(180),
  faculty: z.string().trim().min(2).max(180),
  status: userStatus.optional(),
});
const clubSchema = z.object({
  name: z.string().trim().min(3).max(140),
  slug: z.string().trim().min(3).max(90).regex(/^[a-z0-9-]+$/),
  category: z.string().trim().min(2).max(80),
  coordinatorInitials: z.string().trim().min(2).max(6),
  shortName:z.string().trim().min(2).max(100).optional(),
  tagline:z.string().trim().min(5).max(220).optional(),
  description:z.string().trim().min(10).max(800).optional(),
  about:z.array(z.string().trim().min(10).max(1200)).min(1).max(4).optional(),
  tone:z.enum(["lime","violet","cyan","coral","amber","mint"]).optional(),
  visualMark:z.string().trim().min(1).max(12).optional(),
  meeting:z.object({cadence:z.string().trim().min(2).max(80),day:z.string().trim().min(1).max(80),time:z.string().trim().min(1).max(40),place:z.string().trim().min(2).max(180)}).optional(),
  focusTags:z.array(z.string().trim().min(1).max(50)).min(1).max(8).optional(),
  status: userStatus.optional(),
});
const eventSchema = z.object({
  name: z.string().trim().min(3).max(140),
  category: z.string().trim().min(2).max(80),
  organizer: z.string().trim().min(2).max(180),
  startAt: z.string().datetime({ offset: true }),
  capacity: z.number().int().min(1).max(10_000),
  place: z.string().trim().min(2).max(180),
  status: z.enum(["Açıq", "Qaralama", "Tamamlanıb"]).optional(),
});
const announcementFields={category:z.enum(["official","faculties","clubs","scholarship","events"]),title:z.string().trim().min(3).max(180),summary:z.string().trim().min(10).max(800),source:z.string().trim().min(2).max(140),sourceInitials:z.string().trim().min(1).max(8),tone:z.enum(["lime","lilac","blue","coral","mint","gold"]),startsAt:z.string().datetime({offset:true}),expiresAt:z.string().datetime({offset:true}),priority:z.boolean(),status:z.enum(["draft","published"])};
const announcementSchema=z.object({...announcementFields,priority:announcementFields.priority.default(false),status:announcementFields.status.default("draft")});
// `.partial()` sahədəki `default()`-u yenə tətbiq edir: "Yayımla" (yalnız status)
// elanın prioritetini sıfırlayırdı, yalnız başlıq dəyişən PATCH isə dərc olunmuş
// elanı qaralamaya qaytarırdı. PATCH sxemi default-suzdur.
const announcementPatchSchema=z.object(announcementFields).partial();

adminRouter.get("/overview", async (_request, response) => {
  const [users, events, platform, audit, clubs] = await Promise.all([listUsers(10_000), listEvents(false), getPlatformCounts(), listAudit(6), listClubs()]);
  const now = Date.now();
  const activeUsers = users.filter((user) => user.status === "Aktiv").length;
  // "Açıq tədbir" əvvəl bitməmiş HƏR tədbiri sayırdı — müəllimin yoxlanış gözləyən
  // qaralamaları da daxil. İndi yalnız dərc olunmuş və bitməmiş tədbirlər; qaralama
  // ayrıca sayılır ki, admin növbəni görsün. Klub göstəricisi də gözləyən və
  // məhdudlaşdırılmış klubları "tələbə klubu" kimi sayırdı.
  const openEvents = events.filter((event) => eventStatus(event) === "Açıq" && new Date(event.endAt).getTime() > now).length;
  const draftEvents = events.filter((event) => event.adminStatus === "Qaralama").length;
  const activeClubs = clubs.filter((club) => club.status === "Aktiv").length;
  const pendingClubs = clubs.filter((club) => club.status === "Gözləmədə").length;
  const participation = platform.memberships + platform.reviews;
  response.json({
    data: {
      updatedAt: new Date().toISOString(),
      // `counts` xam rəqəmlərdir: etiketi interfeys seçilmiş dildə qurur. Əvvəlki
      // `trend` sahəsi sabit "up" idi və heç bir müqayisəyə əsaslanmırdı — çıxarıldı.
      metrics: [
        { id: "users", label: "Aktiv istifadəçi", value: String(activeUsers), change: `${users.length} ümumi`, counts: { value: activeUsers, total: users.length } },
        { id: "clubs", label: "Aktiv klub", value: String(activeClubs), change: `${clubs.length} ümumi · ${pendingClubs} gözləyir`, counts: { value: activeClubs, total: clubs.length, pending: pendingClubs } },
        { id: "events", label: "Açıq tədbir", value: String(openEvents), change: `${events.length} ümumi · ${draftEvents} qaralama`, counts: { value: openEvents, total: events.length, pending: draftEvents } },
        { id: "engagement", label: "Üzvlük və rəylər", value: String(participation), change: `${platform.memberships} üzvlük · ${platform.reviews} rəy`, counts: { value: participation, memberships: platform.memberships, reviews: platform.reviews } },
      ],
      activity: buildActivity(users, clubs, events),
      distribution: buildDistribution(clubs),
      recentActivity: audit.length ? audit.map((item)=>({id:item.id,title:item.action,description:`${item.actor} · ${item.entityType}`,timeLabel:"audit",occurredAt:item.occurredAt,tone:"lime"})) : [
        { id: "live-users", title: "İstifadəçi bazası aktivdir", description: `${users.length} hesab real verilənlər bazasında saxlanılır.`, timeLabel: "indi", occurredAt: new Date().toISOString(), tone: "lime" },
        { id: "live-clubs", title: "Klub üzvlükləri işləyir", description: `${platform.memberships} aktiv klub üzvlüyü mövcuddur.`, timeLabel: "indi", occurredAt: new Date().toISOString(), tone: "blue" },
        { id: "live-moderation", title: "Rəy sistemi aktivdir", description: `${platform.reviews} rəy bazada saxlanılır.`, timeLabel: "indi", occurredAt: new Date().toISOString(), tone: "violet" },
      ],
    },
  });
});

adminRouter.get("/users", async (request, response) => {
  const users = (await listUsers(10_000)).map(toAdminUser);
  response.json({ data: paginate(filterRows(users, request.query), request.query) });
});

adminRouter.post("/users", requireOwnerAdmin, async (request, response) => {
  const input = userSchema.parse(request.body);
  const user = await createUser({ ...input, emailVerifiedAt: null, passwordHash: await hashPassword(randomBytes(24).toString("base64url")) });
  await synchronizeProfessionalProfilesForUser(user);
  const activationToken = await createActionToken(user.id, "reset_password", 24 * 60 * 60 * 1000);
  let invitationDelivered = true;
  try {
    const activationUrl = accountActionUrl("/auth/recovery", activationToken);
    await sendAccountEmail({
      to: user.email,
      subject: "EduRate hesabınızı aktivləşdirin",
      html: `<p>EduRate hesabınız yaradılıb.</p><p><a href="${activationUrl}">Şifrənizi yaradaraq hesabı aktivləşdirin</a></p><p>Keçid 24 saat qüvvədədir.</p>`,
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) invitationDelivered = false;
    else throw error;
  }
  await writeAudit(request.auth!.userId,"İstifadəçi dəvəti yaradıldı","user",user.id,{role:user.role,invitationDelivered});
  response.status(201).json({ data: { ...toAdminUser(user), invitationDelivered } });
});

adminRouter.patch("/users/:id", async (request, response) => {
  const id = z.string().parse(request.params.id);

  if (request.auth!.role === "assistant_admin") {
    const input = z.object({ role: userRole }).strict().parse(request.body);
    if (input.role === "admin" || input.role === "assistant_admin" || input.role === "owner_admin") {
      throw new ApiError(
        403,
        "ROLE_ESCALATION_FORBIDDEN",
        "Admin köməkçisi administrator rütbəsi verə bilməz.",
      );
    }
    const target = await findUserById(id);
    if (!target) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
    if (target.role === "admin" || target.role === "assistant_admin" || target.role === "owner_admin") {
      throw new ApiError(
        403,
        "PRIVILEGED_USER_MODIFICATION_FORBIDDEN",
        "Admin köməkçisi administrator hesablarını və öz hesabını dəyişə bilməz.",
      );
    }
    const user = await assistantUpdateUserRole(id, input.role);
    if (!user) {
      throw new ApiError(
        409,
        "USER_ROLE_CHANGED",
        "İstifadəçinin rolu dəyişib. Siyahını yeniləyib təkrar yoxlayın.",
      );
    }
    await synchronizeProfessionalProfilesForUser(user);
    await writeAudit(request.auth!.userId,"İstifadəçi rolu dəyişdirildi","user",id,{role:input.role});
    response.json({ data: toAdminUser(user) });
    return;
  }

  const patch = userSchema.partial().parse(request.body);
  const target = await findUserById(id);
  if (!target) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  // D3: əvvəl burada yalnız `owner_admin` qorunurdu — adi admin API ilə istənilən
  // istifadəçini admin/admin köməkçisi edə, digər adminləri tələbəyə endirə və ya
  // məhdudlaşdıra bilirdi. İnterfeysin öz qaydası (`canAssignElevatedRoles`,
  // `canEditPrivilegedUsers`) bunları yalnız platforma sahibinə verir.
  if (request.auth!.role !== "owner_admin") {
    if (isElevatedRole(target.role)) {
      throw new ApiError(403, "PRIVILEGED_USER_MODIFICATION_FORBIDDEN", "Administrator hesablarını yalnız platforma sahibi dəyişə bilər.");
    }
    if (patch.role !== undefined && isElevatedRole(patch.role)) {
      throw new ApiError(403, "ROLE_ESCALATION_FORBIDDEN", "Administrator rollarını yalnız platforma sahibi verə bilər.");
    }
  }
  if (
    id === request.auth!.userId &&
    ((patch.role !== undefined && patch.role !== request.auth!.role) ||
      (patch.status !== undefined && patch.status !== "Aktiv"))
  ) {
    throw new ApiError(
      409,
      "SELF_ADMIN_LOCKOUT_FORBIDDEN",
      "Aktiv admin öz rolunu və ya statusunu məhdudlaşdıra bilməz.",
    );
  }
  if (target.role === "owner_admin" && ((patch.role && patch.role !== "owner_admin") || (patch.status && patch.status !== "Aktiv"))) {
    if ((await countOwnerAdmins()) <= 1) {
      throw new ApiError(409, "LAST_OWNER_REQUIRED", "Sistemdə ən azı bir aktiv platforma sahibi qalmalıdır.");
    }
  }
  const user = await adminUpdateUser(id, patch);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  await synchronizeProfessionalProfilesForUser(user);
  await writeAudit(request.auth!.userId,"İstifadəçi yeniləndi","user",id,{role:patch.role,status:patch.status});
  response.json({ data: toAdminUser(user) });
});

adminRouter.delete("/users/:id", requireOwnerAdmin, async (request, response) => {
  const id = z.string().parse(request.params.id);
  if (id === request.auth!.userId) throw new ApiError(409, "SELF_DELETE_FORBIDDEN", "Aktiv admin hesabını silmək olmaz.");
  const target = await findUserById(id);
  if (!target) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  if (target.role === "owner_admin" && (await countOwnerAdmins()) <= 1) {
    throw new ApiError(409, "LAST_OWNER_REQUIRED", "Son platforma sahibi silinə bilməz.");
  }
  await deactivateProfessionalProfilesForUser(id);
  if (!(await deleteUser(id))) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  await writeAudit(request.auth!.userId,"İstifadəçi silindi","user",id);
  response.status(204).send();
});

adminRouter.get("/clubs", async (request, response) => {
  const clubs = (await listClubs()).map(toAdminClub);
  response.json({ data: paginate(filterRows(clubs, request.query), request.query) });
});

// Klub və tədbir əməliyyatları əvvəl audit jurnalına yazılmırdı — elan, rəy,
// şikayət kimi digər admin əməliyyatlarından fərqli olaraq izsiz qalırdı.
adminRouter.post("/clubs", async (request, response) => {
  const club = await createClub(clubSchema.parse(request.body), request.auth!.userId);
  await ensureClubConversation(club);
  await writeAudit(request.auth!.userId, "Klub yaradıldı", "club", club.id);
  response.status(201).json({ data: toAdminClub(club) });
});

adminRouter.patch("/clubs/:id", async (request, response) => {
  const clubId = z.string().parse(request.params.id);
  const before = await findClub(clubId);
  const club = await updateClub(clubId, clubSchema.partial().parse(request.body));
  if (!club) throw new ApiError(404, "CLUB_NOT_FOUND", "Klub tapılmadı.");
  if (before && before.status !== "Aktiv" && club.status === "Aktiv") {
    await notifyUser(club.createdBy, "club_approved", { name: club.name }, `/clubs/${club.slug}`, request.auth!.userId);
  }
  await writeAudit(request.auth!.userId, "Klub yeniləndi", "club", club.id);
  response.json({ data: toAdminClub(club) });
});

adminRouter.delete("/clubs/:id", async (request, response) => {
  const id = z.string().parse(request.params.id);
  if (!(await deleteClub(id))) throw new ApiError(404, "CLUB_NOT_FOUND", "Klub tapılmadı.");
  await writeAudit(request.auth!.userId, "Klub silindi", "club", id);
  response.status(204).send();
});

adminRouter.get("/events", async (request, response) => {
  const events = (await listEvents(false)).map((event) => toAdminEvent(event));
  response.json({ data: paginate(filterRows(events, request.query), request.query) });
});

adminRouter.post("/events", async (request, response) => {
  const input = eventSchema.parse(request.body);
  const event = await createEvent(toEventInput(input), request.auth!.userId);
  await writeAudit(request.auth!.userId, "Tədbir yaradıldı", "event", event.id);
  response.status(201).json({ data: toAdminEvent(event, input.status) });
});

adminRouter.patch("/events/:id", async (request, response) => {
  const id = z.string().parse(request.params.id);
  const current = await findEventById(id);
  if (!current) throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
  const patch = eventSchema.partial().parse(request.body);
  const mergedAdmin = {
    name: patch.name ?? current.title,
    category: patch.category ?? current.category,
    organizer: patch.organizer ?? current.organizer,
    startAt: patch.startAt ?? current.startAt,
    capacity: patch.capacity ?? current.capacity,
    place: patch.place ?? current.location,
    status: patch.status,
  };
  const generated = toEventInput(mergedAdmin);
  const event = await updateEvent(id, {
    ...current,
    title: generated.title,
    category: generated.category,
    organizer: generated.organizer,
    location: generated.location,
    capacity: generated.capacity,
    startAt: generated.startAt,
    endAt: patch.startAt ? generated.endAt : current.endAt,
    registrationDeadline: patch.startAt ? generated.registrationDeadline : current.registrationDeadline,
    adminStatus: patch.status ?? current.adminStatus,
  });
  await writeAudit(request.auth!.userId, "Tədbir yeniləndi", "event", id, patch.status ? { status: patch.status } : {});
  if (patch.status === "Açıq" && current.adminStatus !== "Açıq") {
    await notifyUser(current.createdBy, "event_published", { title: event!.title }, "/events", request.auth!.userId);
  }
  response.json({ data: toAdminEvent(event!, patch.status) });
});

adminRouter.delete("/events/:id", async (request, response) => {
  const id = z.string().parse(request.params.id);
  if (!(await deleteEvent(id))) throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
  await writeAudit(request.auth!.userId, "Tədbir silindi", "event", id);
  response.status(204).send();
});

adminRouter.get("/announcements",async(_request,response)=>response.json({data:await listAdminAnnouncements()}));
adminRouter.post("/announcements",async(request,response)=>{
  const input=announcementSchema.parse(request.body);
  const item=await createAnnouncement(input,request.auth!.userId);
  await writeAudit(request.auth!.userId,"Elan yaradıldı","announcement",String(item.id));
  // Yayımlanan elan bütün abunə cihazlara bildiriş göndərir; push bağlıdırsa səssiz keçir.
  if(input.status==="published"){
    void sendPush({title:"Yeni elan",body:input.title,url:"/feed",tag:`announcement-${item.id}`})
      .catch((error)=>console.error("Push bildirişi göndərilmədi.",error));
  }
  response.status(201).json({data:item});
});
adminRouter.patch("/announcements/:id",async(request,response)=>{
  const id=z.string().parse(request.params.id);
  const input=announcementPatchSchema.parse(request.body);
  const before=await findAnnouncementById(id);
  const item=await updateAnnouncement(id,input);
  if(!item)throw new ApiError(404,"ANNOUNCEMENT_NOT_FOUND","Elan tapılmadı.");
  await writeAudit(request.auth!.userId,"Elan yeniləndi","announcement",id);
  // İnterfeys elanı həmişə qaralama kimi yaradır və "Yayımla" ilə bu marşrutdan
  // dərc edir; push isə yalnız birbaşa dərc olunmuş yaradılanda gedirdi — yəni
  // interfeysdən heç vaxt getmirdi.
  if(input.status==="published"&&before?.status!=="published"){
    void sendPush({title:"Yeni elan",body:String((item as {title?:unknown}).title??""),url:"/feed",tag:`announcement-${id}`})
      .catch((error)=>console.error("Push bildirişi göndərilmədi.",error));
  }
  response.json({data:item});
});
adminRouter.delete("/announcements/:id",async(request,response)=>{const id=z.string().parse(request.params.id);if(!await deleteAnnouncement(id))throw new ApiError(404,"ANNOUNCEMENT_NOT_FOUND","Elan tapılmadı.");await writeAudit(request.auth!.userId,"Elan silindi","announcement",id);response.status(204).send();});

adminRouter.get("/feed",async(request,response)=>{
  const {status}=z.object({status:z.enum(["pending","published","rejected"]).optional()}).parse(request.query);
  response.json({data:await listAdminFeed(status)});
});
adminRouter.patch("/feed/:id",async(request,response)=>{
  const id=z.string().parse(request.params.id);
  const {status}=z.object({status:z.enum(["published","rejected"])}).strict().parse(request.body);
  const item=await updateFeedPostStatus(id,status);
  if(!item)throw new ApiError(404,"FEED_POST_NOT_FOUND","Lent paylaşımı tapılmadı.");
  await writeAudit(request.auth!.userId,status==="published"?"Lent paylaşımı yayımlandı":"Lent paylaşımı rədd edildi","feed_post",id);
  response.json({data:item});
});
adminRouter.delete("/feed/:id",async(request,response)=>{
  const id=z.string().parse(request.params.id);
  if(!await deleteFeedPost(id))throw new ApiError(404,"FEED_POST_NOT_FOUND","Lent paylaşımı tapılmadı.");
  await writeAudit(request.auth!.userId,"Lent paylaşımı silindi","feed_post",id);
  response.status(204).send();
});

adminRouter.get("/support-tickets",async(_request,response)=>response.json({data:await listSupportTickets()}));
adminRouter.patch("/support-tickets/:id",async(request,response)=>{
  const id=z.string().uuid().parse(request.params.id);
  const {status}=z.object({status:z.enum(["open","in_progress","resolved"])}).strict().parse(request.body);
  const ticket=await updateSupportTicketStatus(id,status);
  if(!ticket)throw new ApiError(404,"TICKET_NOT_FOUND","Dəstək müraciəti tapılmadı.");
  await writeAudit(request.auth!.userId,"Dəstək müraciətinin statusu dəyişdirildi","support_ticket",id,{status});
  await notifyUser(ticket.userId,"support_updated",{reference:ticket.reference,status},"/support",request.auth!.userId);
  response.json({data:ticket});
});

adminRouter.get("/reviews", async (request, response) => {
  const query = z.object({
    status: z.enum(["pending", "approved", "rejected"]).default("pending"),
    teacherId: z.string().trim().min(2).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }).parse(request.query);
  const reviews = await listTeacherReviews(query);
  response.json({ data: reviews });
});

adminRouter.patch("/reviews/:id", async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const { status, reason } = z.object({ status: z.enum(["approved", "rejected"]), reason:z.string().trim().min(3).max(500).default("Moderasiya qərarı") }).strict().parse(request.body);
  const review = await updateTeacherReviewStatus(id, status);
  if (!review) throw new ApiError(404, "REVIEW_NOT_FOUND", "Rəy tapılmadı.");
  await writeAudit(request.auth!.userId,status==="approved"?"Rəy təsdiqləndi":"Rəy rədd edildi","teacher_review",id,{status,reason});
  response.json({ data: review });
});

adminRouter.get("/reports", async (request, response) => {
  const { status } = z.object({ status: z.enum(["open", "reviewing", "resolved", "dismissed"]).optional() }).parse(request.query);
  const reports = await listContentReports(status);
  // Admin əvvəl yalnız səbəbi və növü görürdü — şikayət edilən profilin, klubun və
  // ya mesajın hansı olduğunu tapmaq mümkün deyildi.
  const data = await Promise.all(reports.map(async (report) => ({ ...report, target: await describeReportTarget(report.entityType, report.entityId) })));
  response.json({ data });
});

async function describeReportTarget(entityType: string, entityId: string) {
  // Mövcud olmayan və ya uuid olmayan id bazada xəta verə bilər — o halda "tapılmadı".
  const safe = async <T,>(load: () => Promise<T>) => load().catch(() => null);
  if (entityType === "profile") {
    const user = await safe(() => findUserById(entityId));
    return user ? { label: user.name, detail: user.email } : null;
  }
  if (entityType === "club") {
    const club = await safe(() => findClub(entityId));
    return club ? { label: club.name, detail: club.slug, href: `/clubs/${club.slug}` } : null;
  }
  if (entityType === "message") {
    const message = await safe(() => findMessageForReport(entityId));
    if (!message) return null;
    const sender = await safe(() => findUserById(message.senderId));
    return { label: sender?.name ?? "", detail: message.body.slice(0, 280), deleted: message.deleted };
  }
  return null;
}

adminRouter.patch("/reports/:id", async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const input = z.object({ status: z.enum(["reviewing", "resolved", "dismissed"]), resolutionNote: z.string().trim().min(3).max(1000) }).strict().parse(request.body);
  const report = await updateContentReport(id, request.auth!.userId, input);
  if (!report) throw new ApiError(404, "REPORT_NOT_FOUND", "Şikayət tapılmadı.");
  await writeAudit(request.auth!.userId, "Məzmun şikayəti yeniləndi", "content_report", id, { status: input.status, reason: input.resolutionNote });
  response.json({ data: report });
});

adminRouter.get("/mentor-applications", async (request, response) => {
  const { status } = z.object({ status: z.enum(["pending", "approved", "rejected"]).default("pending") }).parse(request.query);
  response.json({ data: await listMentorApplications(status) });
});

adminRouter.patch("/mentor-applications/:id", async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const { status } = z.object({ status: z.enum(["approved", "rejected"]) }).strict().parse(request.body);
  const application = await decideMentorApplication(id, status, request.auth!.userId);
  if (!application) throw new ApiError(404, "MENTOR_APPLICATION_NOT_FOUND", "Mentorluq müraciəti tapılmadı.");
  await writeAudit(request.auth!.userId, status === "approved" ? "Mentor müraciəti təsdiqləndi" : "Mentor müraciəti rədd edildi", "mentor_application", id, { teacherId: application.userId });
  response.json({ data: application });
});

function isElevatedRole(role: string) {
  return role === "admin" || role === "assistant_admin" || role === "owner_admin";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join("");
}

function toAdminUser(user: UserRecord) {
  return {
    kind: "users", id: user.id, name: user.name, email: user.email, initials: initials(user.name), role: user.role,
    university: user.university, faculty: user.faculty, connectionCount: 0, joinedAt: user.createdAt,
    lastActiveAt: user.updatedAt, detail: `${user.role} · ${user.faculty}`, status: user.status,
    // Əvvəl hər istifadəçi üçün sabit "Real hesab" yazılırdı — heç nə bildirmirdi.
    emailVerified: Boolean(user.emailVerifiedAt),
    metric: user.emailVerifiedAt ? "E-poçt təsdiqlənib" : "E-poçt təsdiqlənməyib", updatedAt: user.updatedAt,
  };
}

function toAdminClub(club: ClubRecord) {
  return {
    kind: "clubs", ...club, name: club.name, detail: `${club.category} · ${club.memberCount} üzv`,
    metric: `${club.eventCount} tədbir`, updatedAt: club.updatedAt,
  };
}

function eventStatus(event: EventRecord) {
  if (event.adminStatus) return event.adminStatus;
  return new Date(event.endAt).getTime() < Date.now() ? "Tamamlanıb" : "Açıq";
}

function toAdminEvent(event: EventRecord, status?: "Açıq" | "Qaralama" | "Tamamlanıb") {
  const attendeeCount = Math.max(0, event.capacity - event.availableSpots);
  return {
    kind: "events", id: event.id, name: event.title, category: event.category, organizer: event.organizer,
    startAt: event.startAt, attendeeCount, capacity: event.capacity, place: event.location,
    imageUrl: event.imageUrl,
    detail: `${event.category} · ${event.organizer}`, status: status ?? eventStatus(event),
    metric: `${attendeeCount}/${event.capacity} iştirakçı`, updatedAt: event.updatedAt,
  };
}

function normalizeCategory(value: string): EventCategory {
  const category = value.toLocaleLowerCase("az");
  if (category.includes("tex") || category.includes("tech")) return "Technology";
  if (category.includes("mədəni") || category.includes("culture") || category.includes("yarad")) return "Culture";
  if (category.includes("sağ") || category.includes("well") || category.includes("sosial")) return "Wellness";
  return "Design";
}

function toEventInput(input: { name: string; category: string; organizer: string; startAt: string; capacity: number; place: string; status?: "Açıq" | "Qaralama" | "Tamamlanıb" }) {
  const start = new Date(input.startAt);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const deadline = new Date(start.getTime() - 60 * 60 * 1000);
  return {
    title: input.name, category: normalizeCategory(input.category),
    description: `${input.name} üçün tələbə yönümlü açıq tədbir proqramı.`,
    longDescription: `${input.organizer} tərəfindən təşkil olunan tədbirdə iştirakçılar mövzu üzrə öyrənir, fikir mübadiləsi aparır və praktiki təcrübə qazanırlar.`,
    location: input.place, city: "Xankəndi", organizer: input.organizer,
    startAt: start.toISOString(), endAt: end.toISOString(), registrationDeadline: deadline.toISOString(),
    speakers: [], capacity: input.capacity, accent: "#c8ff4d", glow: "rgba(200, 255, 77, 0.28)",
    ...(input.status ? { adminStatus: input.status } : {}),
  };
}

function filterRows<T extends { name: string; status: string; category?: string; role?: string; email?: string }>(rows: T[], query: Record<string, unknown>) {
  const search = String(query.search ?? "").trim().toLocaleLowerCase("az");
  return rows.filter((row) => {
    // İstifadəçini e-poçtla da tapmaq olur — axtarış sahəsi bunu vəd edirdi, amma
    // yalnız adı yoxlayırdı.
    if (search && !row.name.toLocaleLowerCase("az").includes(search) && !(row.email ?? "").toLocaleLowerCase("az").includes(search)) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.category && row.category !== query.category) return false;
    if (query.role && row.role !== query.role) return false;
    return true;
  });
}

function paginate<T>(items: T[], query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

function buildActivity(users: UserRecord[], clubs: ClubRecord[], events: EventRecord[]) {
  const now = new Date();
  const monthFormatter = new Intl.DateTimeFormat("az-AZ", { month: "short" });
  return Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const createdBeforeMonthEnd = (createdAt: string) => new Date(createdAt).getTime() < monthEnd.getTime();
    return {
      label: monthFormatter.format(monthStart),
      // Ay adı interfeysdə lüğətdən qurulur; `label` köhnə klientlər üçün qalır.
      month: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
      users: users.filter((item) => createdBeforeMonthEnd(item.createdAt)).length,
      clubs: clubs.filter((item) => createdBeforeMonthEnd(item.createdAt)).length,
      events: events.filter((item) => createdBeforeMonthEnd(item.createdAt)).length,
    };
  });
}

function buildDistribution(clubs: ClubRecord[]) {
  const colors = ["#c8ff4d", "#77b8ff", "#b9a7ff", "#ff9e7a", "#7ce8c3"];
  const grouped = new Map<string, number>();
  clubs.forEach((club) => grouped.set(club.category, (grouped.get(club.category) ?? 0) + 1));
  return [...grouped.entries()].map(([name, value], index) => ({ name, value, color: colors[index % colors.length] }));
}
