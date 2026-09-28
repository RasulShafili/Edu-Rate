import { Router } from "express";
import { z } from "zod";
import { findProfessionalProfile } from "../db/professionals.js";
import {
  createMentorshipRequest,
  deleteMentorshipRequest,
  listMentorshipRequests,
  updateMentorshipRequest,
} from "../db/business.js";
import { ApiError } from "../lib/api-error.js";
import { findUserById } from "../db/database.js";
import { notifyUser } from "../db/notifications.js";
import { authenticate } from "../middleware/authenticate.js";

export const mentorshipRouter = Router();

const requestSchema = z.object({
  mentorId: z.string().trim().min(2).max(120),
  note: z.string().trim().max(600).default(""),
});
const updateSchema = z.object({ note: z.string().trim().max(600) });

mentorshipRouter.use(authenticate);

mentorshipRouter.get("/", async (request, response) => {
  response.json({ data: await listMentorshipRequests(request.auth!.userId) });
});

mentorshipRouter.post("/", async (request, response) => {
  // D9: əvvəl istənilən rol müraciət edə bilirdi. Amma göndərilmiş müraciətin
  // vəziyyətini yalnız tələbə paneli göstərir — müəllim, mentor və ya admin
  // müraciət edəndə onu heç yerdə izləyə bilmirdi. Rəylərdəki qayda ilə eyni.
  if (request.auth!.role !== "student") {
    throw new ApiError(403, "STUDENT_ACCOUNT_REQUIRED", "Mentorluq müraciəti yalnız tələbə hesabı üçündür.");
  }
  const input = requestSchema.parse(request.body);
  const mentor = await findProfessionalProfile(input.mentorId, "mentor");
  if (!mentor || mentor.status !== "approved" || !mentor.visible) {
    throw new ApiError(404, "MENTOR_NOT_FOUND", "Aktiv mentor tapılmadı.");
  }
  // D9: mentor öz profilinə müraciət edirdi və özünü öz panelində "yeni
  // müraciət" kimi görürdü. Rol qaydası bunu indi bağlayır; bu yoxlama isə
  // qayda gələcəkdə genişlənsə belə özünə müraciəti qadağan saxlayır.
  if (mentor.userId && mentor.userId === request.auth!.userId) {
    throw new ApiError(422, "SELF_MENTORSHIP", "Özünə mentorluq müraciəti göndərə bilməzsən.");
  }
  const created = await createMentorshipRequest(request.auth!.userId, mentor.slug, input.note, mentor.id);
  const student = await findUserById(request.auth!.userId);
  await notifyUser(mentor.userId, "mentorship_request", { name: student?.name ?? "" }, "/workspace", request.auth!.userId);
  response.status(201).json({ data: created });
});

mentorshipRouter.patch("/:requestId", async (request, response) => {
  const requestId = z.string().uuid().parse(request.params.requestId);
  const { note } = updateSchema.parse(request.body);
  const mentorshipRequest = await updateMentorshipRequest(requestId, request.auth!.userId, note);
  if (!mentorshipRequest) throw new ApiError(404, "MENTORSHIP_REQUEST_NOT_FOUND", "Dəyişdirilə bilən müraciət tapılmadı.");
  response.json({ data: mentorshipRequest });
});

mentorshipRouter.delete("/:requestId", async (request, response) => {
  const requestId = z.string().uuid().parse(request.params.requestId);
  const deleted = await deleteMentorshipRequest(requestId, request.auth!.userId);
  if (!deleted) throw new ApiError(404, "MENTORSHIP_REQUEST_NOT_FOUND", "Silinə bilən müraciət tapılmadı.");
  response.status(204).send();
});
