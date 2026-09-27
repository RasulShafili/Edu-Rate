import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createTeacherReview, listTeacherReviews } from "../db/platform.js";
import { ApiError } from "../lib/api-error.js";
import { authenticate } from "../middleware/authenticate.js";
import { userOrIpKey } from "../lib/client-key.js";
import { findProfessionalProfile } from "../db/professionals.js";
import { findUserById } from "../db/database.js";

export const reviewsRouter = Router();

// Hesab üzrə: əvvəl IP üzrə idi və BFF arxasında saatda 5 rəy BÜTÜN sayt üçün idi.
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Çox sayda rəy cəhdi edildi." } },
});

const score = z.number().int().min(1).max(5);
const reviewSchema = z.object({
  teacherId: z.string().trim().min(2).max(120),
  course: z.string().trim().min(2).max(180),
  semester: z.string().trim().min(2).max(80),
  criteria: z.object({
    clarity: score,
    subjectKnowledge: score,
    objectivity: score,
    communication: score,
  }),
}).strict();

reviewsRouter.get("/mine", authenticate, async (request, response) => {
  const query = z.object({
    semester: z.string().trim().min(2).max(80),
  }).parse(request.query);
  const reviews = await listTeacherReviews({
    userId: request.auth!.userId,
    semester: query.semester,
    limit: 100,
  });
  response.json({
    data: reviews.map(({ userId: _userId, text: _text, ...review }) => review),
  });
});

reviewsRouter.get("/", async (request, response) => {
  const query = z.object({
    teacherId: z.string().trim().min(2).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  }).parse(request.query);
  const reviews = await listTeacherReviews({
    teacherId: query.teacherId,
    status: "approved",
    limit: query.limit,
  });
  response.json({
    data: reviews.map(({ userId: _userId, text: _text, ...review }) => ({
      ...review,
      author: "Təsdiqlənmiş EduRate hesabı",
      initials: "ER",
    })),
  });
});

reviewsRouter.post("/", authenticate, limiter, async (request, response) => {
  const reviewer=await findUserById(request.auth!.userId);
  if(!reviewer||reviewer.role!=="student")throw new ApiError(403,"STUDENT_ACCOUNT_REQUIRED","Müəllim qiymətləndirməsi yalnız tələbə hesabı üçündür.");
  if(!reviewer.emailVerifiedAt)throw new ApiError(403,"EMAIL_NOT_VERIFIED","Rəy vermək üçün e-poçt ünvanını təsdiqlə.");
  const input = reviewSchema.parse(request.body);
  const teacher = await findProfessionalProfile(input.teacherId, "teacher");
  if (!teacher || teacher.status !== "approved" || !teacher.visible) {
    throw new ApiError(404, "TEACHER_NOT_FOUND", "Aktiv müəllim profili tapılmadı.");
  }
  const review = await createTeacherReview(request.auth!.userId, {
    ...input,
    teacherId: teacher.slug,
    text: "Meyarlar üzrə rəqəmsal qiymətləndirmə.",
  }, teacher.id);
  response.status(201).json({ data: review });
});
