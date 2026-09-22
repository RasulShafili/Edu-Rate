import { Router } from "express";
import { z } from "zod";
import { decideMentorshipRequest, endMentorshipRequest, listEvents, listMentorRequests, listMentorshipRequests, listMyEventRegistrations } from "../db/business.js";
import { findUserById, listUsers } from "../db/database.js";
import { getPlatformCounts, listMyClubMemberships, listSupportTickets, listTeacherReviews } from "../db/platform.js";
import { ApiError } from "../lib/api-error.js";
import { authenticate } from "../middleware/authenticate.js";
import { ensureProfessionalProfileForUser, findProfessionalByUser, findProfessionalProfile } from "../db/professionals.js";
import { createMentorApplication, getMentorApplication } from "../db/mentor-applications.js";
import { ensureMentorshipConversation } from "../db/messaging.js";

export const workspaceRouter = Router();
workspaceRouter.use(authenticate);

workspaceRouter.get("/", async (request, response) => {
  const user = await findUserById(request.auth!.userId);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");

  if (user.role === "teacher") {
    const profile = await ensureProfessionalProfileForUser(user);
    const [reviews, mentorApplication, mentorProfile] = await Promise.all([
      listTeacherReviews({ teacherId: profile?.id ?? normalizeRoleId(user.name), limit: 100 }),
      getMentorApplication(user.id),
      findProfessionalByUser(user.id, "mentor"),
    ]);
    const mentorRequests = mentorProfile?.status === "approved"
      ? await listMentorRequests(mentorProfile.slug, mentorProfile.id)
      : [];
    const visibleMentorRequests = mentorRequests.filter((item) => item.status !== "cancelled");
    const mentorItems = await Promise.all(visibleMentorRequests.slice(0, 12).map(async (item) => {
      const requester = await findUserById(item.userId);
      return { ...item, userId: undefined, title: requester?.name ?? "Tələbə müraciəti", course: requester?.program ?? "Mentorluq", text: item.note || undefined,
        chatPeer: item.status === "accepted" && requester ? toChatPeer(requester) : undefined };
    }));
    const approved = reviews.filter((review) => review.status === "approved");
    const average = approved.length ? approved.reduce((sum, review) => sum + review.rating, 0) / approved.length : 0;
    response.json({ data: { role: user.role, title: "Müəllim paneli", focus: user.program, metrics: [
      { label: "Təsdiqlənmiş rəy", value: approved.length },
      { label: "Gözləyən rəy", value: reviews.filter((review) => review.status === "pending").length },
      { label: "Orta qiymət", value: average ? average.toFixed(1) : "—" },
    ], items: reviews.slice(0, 8).map(({ userId: _userId, text: _text, ...review }) => review),
      mentorApplication, mentorEnabled: mentorProfile?.status === "approved" && mentorProfile.visible,
      mentorItems,
    } });
    return;
  }

  if (user.role === "mentor") {
    const profile = await ensureProfessionalProfileForUser(user);
    const requests = await listMentorRequests(profile?.slug ?? normalizeRoleId(user.name), profile?.id);
    const visibleRequests = requests.filter((item) => item.status !== "cancelled");
    const items = await Promise.all(visibleRequests.slice(0, 12).map(async (item) => {
      const requester = await findUserById(item.userId);
      return {
        ...item,
        userId: undefined,
        title: requester?.name ?? "Tələbə müraciəti",
        course: requester?.program ?? "Mentorluq",
        text: item.note || undefined,
        chatPeer: item.status === "accepted" && requester ? toChatPeer(requester) : undefined,
      };
    }));
    response.json({ data: { role: user.role, title: "Mentor paneli", focus: user.program, metrics: [
      { label: "Yeni müraciət", value: visibleRequests.filter((item) => item.status === "pending").length },
      { label: "Qəbul edilib", value: visibleRequests.filter((item) => item.status === "accepted").length },
      { label: "Ümumi müraciət", value: visibleRequests.length },
    ], items } });
    return;
  }

  if (["owner_admin", "admin", "assistant_admin"].includes(user.role)) {
    const [users, events, counts] = await Promise.all([listUsers(10_000), listEvents(), getPlatformCounts()]);
    response.json({ data: { role: user.role, title: "Rəhbərlik paneli", focus: "Platforma idarəetməsi", metrics: [
      { label: "İstifadəçi", value: users.length },
      { label: "Tədbir", value: events.length },
      { label: "Klub", value: counts.clubs },
    ], items: [] } });
    return;
  }

  const [events, clubs, mentorships, tickets] = await Promise.all([
    listMyEventRegistrations(user.id), listMyClubMemberships(user.id), listMentorshipRequests(user.id), listSupportTickets(user.id),
  ]);
  const visibleMentorships = mentorships.filter((item) => item.status !== "cancelled");
  const mentorshipItems = await Promise.all(visibleMentorships.slice(0, 4).map(async (item) => {
    const mentorProfile = await findProfessionalProfile(item.mentorProfileId ?? item.mentorId, "mentor");
    const mentorUser = mentorProfile?.userId ? await findUserById(mentorProfile.userId) : null;
    return {
      id: item.id,
      title: mentorProfile?.name ?? "Mentorluq müraciəti",
      text: item.note,
      status: item.status,
      type: "Mentor",
      chatPeer: item.status === "accepted" && mentorUser ? toChatPeer(mentorUser) : undefined,
    };
  }));
  response.json({ data: { role: user.role, title: "Tələbə paneli", focus: user.program, metrics: [
    { label: "Tədbir qeydiyyatı", value: events.length },
    { label: "Klub üzvlüyü", value: clubs.length },
    { label: "Mentorluq müraciəti", value: visibleMentorships.length },
    { label: "Dəstək bileti", value: tickets.length },
  ], items: [
    ...events.slice(0, 4).map((item) => ({ id: item.id, title: item.title, status: "Qeydiyyat aktivdir", type: "Tədbir" })),
    ...clubs.slice(0, 4).map((item) => ({ id: item.id, title: item.name, status: "Klub üzvü", type: "Klub" })),
    ...mentorshipItems,
    ...tickets.slice(0, 4).map((item) => ({ id: item.id, title: item.topic, text: item.reference, status: item.status, type: "Dəstək" })),
  ] } });
});

workspaceRouter.patch("/mentorship/:id", async (request, response) => {
  const user = await findUserById(request.auth!.userId);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  const mentorProfile = user.role === "mentor"
    ? await ensureProfessionalProfileForUser(user)
    : user.role === "teacher"
      ? await findProfessionalByUser(user.id, "mentor")
      : null;
  if (!mentorProfile || mentorProfile.status !== "approved" || !mentorProfile.visible) {
    throw new ApiError(403, "MENTOR_REQUIRED", "Bu əməliyyat yalnız təsdiqlənmiş mentor üçündür.");
  }
  const id = z.string().uuid().parse(request.params.id);
  const { status } = z.object({ status: z.enum(["accepted", "rejected", "cancelled"]) }).strict().parse(request.body);
  const result = status === "cancelled"
    ? await endMentorshipRequest(id, mentorProfile.slug, mentorProfile.id)
    : await decideMentorshipRequest(id, mentorProfile.slug, status, mentorProfile.id);
  if (!result) throw new ApiError(404, "MENTORSHIP_REQUEST_NOT_FOUND", status === "cancelled"
    ? "Aktiv mentorluq tapılmadı."
    : "Gözləyən mentorluq müraciəti tapılmadı.");
  const conversation = status === "accepted"
    ? await ensureMentorshipConversation(result.userId, user.id)
    : null;
  response.json({ data: { ...result, conversationId: conversation?.id } });
});

workspaceRouter.post("/mentor-application", async (request, response) => {
  const user = await findUserById(request.auth!.userId);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  const input = z.object({
    specialty: z.string().trim().min(2).max(180),
    biography: z.string().trim().min(20).max(1200),
    availability: z.string().trim().min(2).max(240),
    meetingMode: z.enum(["Onlayn", "Əyani", "Hibrid"]),
    languages: z.array(z.string().trim().min(2).max(80)).min(1).max(5),
  }).strict().parse(request.body);
  response.status(201).json({ data: await createMentorApplication(user, input) });
});

function normalizeRoleId(value: string) {
  return value.toLocaleLowerCase("az").replace(/[ə]/g, "e").replace(/[ı]/g, "i").replace(/[ş]/g, "s").replace(/[ç]/g, "c").replace(/[ö]/g, "o").replace(/[ü]/g, "u").replace(/[ğ]/g, "g").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toChatPeer(user: { id: string; name: string; role: string; program: string; city: string }) {
  return {
    id: user.id,
    name: user.name,
    role: user.role === "teacher" ? "Müəllim / Mentor" : user.role === "mentor" ? "Mentor" : "Tələbə",
    focus: user.program,
    city: user.city,
  };
}
