import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  createAnswer,
  createQuestion,
  hideAnswer,
  hideQuestion,
  listAnswers,
  listQuestions,
  QUESTION_TOPICS,
  toggleVote,
} from "../db/questions.js";
import { ApiError } from "../lib/api-error.js";
import { userOrIpKey } from "../lib/client-key.js";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";

export const questionsRouter = Router();

// `authenticate`-dən sonra işləyir, ona görə limit hər hesab üçün ayrıdır.
const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Qısa müddətdə çox sayda paylaşım edildi." } },
});

const MODERATORS = ["admin", "owner_admin", "assistant_admin"];

questionsRouter.get("/", optionalAuthenticate, async (request, response) => {
  const { sort } = z.object({ sort: z.enum(["new", "top"]).default("new") }).parse(request.query);
  response.json({ data: await listQuestions(request.auth?.userId ?? null, sort) });
});

questionsRouter.get("/:id/answers", optionalAuthenticate, async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  response.json({ data: await listAnswers(id, request.auth?.userId ?? null) });
});

questionsRouter.post("/", authenticate, writeLimiter, async (request, response) => {
  const input = z.object({
    title: z.string().trim().min(8).max(180),
    body: z.string().trim().max(1200).default(""),
    topic: z.enum(QUESTION_TOPICS).default("kampus"),
  }).strict().parse(request.body);
  response.status(201).json({ data: await createQuestion(request.auth!.userId, input) });
});

questionsRouter.post("/:id/answers", authenticate, writeLimiter, async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const { body } = z.object({ body: z.string().trim().min(2).max(1200) }).strict().parse(request.body);
  const answer = await createAnswer(id, request.auth!.userId, body);
  if (!answer) throw new ApiError(404, "QUESTION_NOT_FOUND", "Sual tapılmadı.");
  response.status(201).json({ data: answer });
});

questionsRouter.post("/:id/vote", authenticate, async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const result = await toggleVote(id, request.auth!.userId);
  if (!result) throw new ApiError(404, "QUESTION_NOT_FOUND", "Sual tapılmadı.");
  response.json({ data: result });
});

questionsRouter.delete("/:id/answers/:answerId", authenticate, async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const answerId = z.string().uuid().parse(request.params.answerId);
  const isModerator = MODERATORS.includes(request.auth!.role);
  if (!(await hideAnswer(id, answerId, request.auth!.userId, isModerator))) {
    throw new ApiError(404, "ANSWER_NOT_FOUND", "Silinə bilən cavab tapılmadı.");
  }
  response.status(204).send();
});

questionsRouter.delete("/:id", authenticate, async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const isModerator = MODERATORS.includes(request.auth!.role);
  if (!(await hideQuestion(id, request.auth!.userId, isModerator))) {
    throw new ApiError(404, "QUESTION_NOT_FOUND", "Silinə bilən sual tapılmadı.");
  }
  response.status(204).send();
});
