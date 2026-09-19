import { Router } from "express";
import { z } from "zod";
import {
  createTimetableEntry,
  deleteTimetableEntry,
  listTimetable,
  updateTimetableEntry,
  TIMETABLE_TONES,
} from "../db/timetable.js";
import { ApiError } from "../lib/api-error.js";
import { authenticate } from "../middleware/authenticate.js";

export const timetableRouter = Router();
timetableRouter.use(authenticate);

/**
 * Sahələr `default()` olmadan saxlanır.
 *
 * İki ayrı tələ var idi:
 *  1. `.partial()` refinement daşıyan sxemdə ÇALIŞMIR — Zod runtime-da
 *     "cannot be used on object schemas containing refinements" atır. Əvvəlki
 *     `entrySchema.partial()` buna görə PATCH-i hər sorğuda 500-ə salırdı.
 *  2. `.partial()` sahəni optional edir, amma `default()` yenə də işləyir:
 *     yalnız `room` göndərəndə `teacher` boşalır və `tone` "mint"-ə qayıdır,
 *     yəni redaktə səssizcə məlumat itirir. Ona görə default-lar yalnız
 *     yaratma sxeminə əlavə olunur.
 */
const baseFields = {
  subject: z.string().trim().min(2).max(120),
  teacher: z.string().trim().max(120),
  room: z.string().trim().max(80),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  startMinute: z.coerce.number().int().min(0).max(1439),
  endMinute: z.coerce.number().int().min(1).max(1440),
  tone: z.enum(TIMETABLE_TONES),
};

const createSchema = z
  .object({
    ...baseFields,
    teacher: baseFields.teacher.default(""),
    room: baseFields.room.default(""),
    tone: baseFields.tone.default("mint"),
  })
  .strict()
  .refine((value) => value.endMinute > value.startMinute, {
    path: ["endMinute"],
    message: "Bitmə vaxtı başlama vaxtından sonra olmalıdır.",
  });

const patchSchema = z.object(baseFields).strict().partial();

timetableRouter.get("/", async (request, response) => {
  response.json({ data: await listTimetable(request.auth!.userId) });
});

timetableRouter.post("/", async (request, response) => {
  const input = createSchema.parse(request.body);
  response.status(201).json({ data: await createTimetableEntry(request.auth!.userId, input) });
});

timetableRouter.patch("/:id", async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const patch = patchSchema.parse(request.body);

  const current = (await listTimetable(request.auth!.userId)).find((entry) => entry.id === id);
  if (!current) throw new ApiError(404, "TIMETABLE_ENTRY_NOT_FOUND", "Cədvəl qeydi tapılmadı.");

  // Yalnız başlama (və ya yalnız bitmə) vaxtı göndəriləndə də nəticə düzgün
  // olmalıdır, ona görə yoxlama mövcud qeydlə birləşmiş dəyərlər üzərində gedir.
  // Əks halda tək sahəli PATCH bazadakı CHECK-i pozardı.
  const startMinute = patch.startMinute ?? current.startMinute;
  const endMinute = patch.endMinute ?? current.endMinute;
  if (endMinute <= startMinute) {
    throw new ApiError(422, "INVALID_TIME_RANGE", "Bitmə vaxtı başlama vaxtından sonra olmalıdır.");
  }

  const entry = await updateTimetableEntry(request.auth!.userId, id, patch);
  if (!entry) throw new ApiError(404, "TIMETABLE_ENTRY_NOT_FOUND", "Cədvəl qeydi tapılmadı.");
  response.json({ data: entry });
});

timetableRouter.delete("/:id", async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  if (!(await deleteTimetableEntry(request.auth!.userId, id))) {
    throw new ApiError(404, "TIMETABLE_ENTRY_NOT_FOUND", "Cədvəl qeydi tapılmadı.");
  }
  response.status(204).send();
});
