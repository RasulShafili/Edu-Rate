import { Router } from "express";
import { z } from "zod";
import {
  cancelEventRegistration,
  createEvent,
  deleteEvent,
  findEventById,
  listEvents,
  listEventRegistrantIds,
  listEventsByCreator,
  listMyEventRegistrations,
  registerForEvent,
  updateEvent,
} from "../db/business.js";
import { ApiError } from "../lib/api-error.js";
import { noticeEventCancelled, noticeEventChanged } from "../lib/event-notices.js";
import { authenticate } from "../middleware/authenticate.js";

export const eventsRouter = Router();

const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Başlıq ən az 3 simvol olmalıdır.").max(140),
    category: z.enum(["Design", "Technology", "Culture", "Wellness"]),
    // Forma sadələşdirildi: tək "Tədbir haqqında məlumat" sahəsi (longDescription).
    // Qısa təsvir göndərilməsə ondan avtomatik qurulur (kartda görünür); şəhər ixtiyaridir.
    description: z.string().trim().min(10).max(280).optional(),
    longDescription: z.string().trim().min(20).max(1600),
    location: z.string().trim().min(2).max(180),
    city: z.string().trim().max(120).default(""),
    organizer: z.string().trim().min(2).max(180),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    registrationDeadline: z.string().datetime({ offset: true }),
    speakers: z.array(z.string().trim().min(2).max(120)).max(12).default([]),
    capacity: z.number().int().min(1).max(10_000),
    availableSpots: z.number().int().min(0).optional(),
    accent: z.string().trim().max(32).default("#c8ff4d"),
    glow: z.string().trim().max(80).default("rgba(200, 255, 77, 0.28)"),
  })
  .superRefine((event, context) => {
    const start = new Date(event.startAt).getTime();
    if (new Date(event.endAt).getTime() <= start) {
      context.addIssue({ code: "custom", path: ["endAt"], message: "Bitmə vaxtı başlama vaxtından sonra olmalıdır." });
    }
    if (new Date(event.registrationDeadline).getTime() > start) {
      context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Qeydiyyat son tarixi tədbirin başlanğıcından gec ola bilməz." });
    }
    if ((event.availableSpots ?? event.capacity) > event.capacity) {
      context.addIssue({ code: "custom", path: ["availableSpots"], message: "Boş yer sayı ümumi tutumdan çox ola bilməz." });
    }
  });

/** Kart üçün qısa mətn: ilk cümlə və ya ~200 simvol, sözün ortasında kəsmədən. */
function summarize(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentence = clean.match(/^.{10,200}?[.!?](\s|$)/)?.[0]?.trim();
  if (sentence) return sentence;
  if (clean.length <= 200) return clean;
  const cut = clean.slice(0, 200);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 120)).trim()}…`;
}

eventsRouter.get("/", async (_request, response) => {
  response.json({ data: await listEvents() });
});

eventsRouter.get("/registrations/me", authenticate, async (request, response) => {
  response.json({ data: await listMyEventRegistrations(request.auth!.userId) });
});

// `/:eventId`-dən əvvəl olmalıdır, yoxsa "mine" tədbir id-si kimi tutulur.
eventsRouter.get("/mine", authenticate, async (request, response) => {
  const events = await listEventsByCreator(request.auth!.userId);
  // Yaradan öz tədbirini redaktə edə bilsin deyə bütün sahələr və qeydiyyat sayı.
  response.json({
    data: await Promise.all(events.map(async (event) => ({
      id: event.id,
      title: event.title,
      category: event.category,
      description: event.description,
      longDescription: event.longDescription,
      location: event.location,
      city: event.city,
      organizer: event.organizer,
      startAt: event.startAt,
      endAt: event.endAt,
      registrationDeadline: event.registrationDeadline,
      speakers: event.speakers,
      capacity: event.capacity,
      registered: (await listEventRegistrantIds(event.id)).length,
      imageUrl: event.imageUrl,
      status: event.adminStatus ?? "Açıq",
      createdAt: event.createdAt,
    }))),
  });
});

eventsRouter.get("/:eventId", async (request, response) => {
  const eventId = z.string().parse(request.params.eventId);
  const event = await findEventById(eventId);
  if (!event || event.adminStatus !== "Açıq") {
    throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
  }
  response.json({ data: event });
});

eventsRouter.post("/", authenticate, async (request, response) => {
  if (!["teacher", "owner_admin", "admin", "assistant_admin"].includes(request.auth!.role)) {
    throw new ApiError(403, "EVENT_CREATE_FORBIDDEN", "Tədbiri yalnız müəllim və ya rəhbərlik yarada bilər.");
  }
  // Boş yer sayı qeydiyyatdan hesablanır: əvvəl yaradan onu özü yaza bilirdi
  // (məs. 50 yerlik tədbir "2 yer qaldı" kimi görünürdü).
  const parsed = eventSchema.parse(request.body);
  const input = { ...parsed, description: parsed.description ?? summarize(parsed.longDescription), availableSpots: undefined };
  const adminStatus=request.auth!.role==="teacher"?"Qaralama":"Açıq";
  response.status(201).json({ data: await createEvent({...input,adminStatus}, request.auth!.userId) });
});

eventsRouter.patch("/:eventId", authenticate, async (request, response) => {
  const eventId = z.string().parse(request.params.eventId);
  const current = await findEventById(eventId);
  if (!current) throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
  const isLeadership = ["owner_admin", "admin", "assistant_admin"].includes(request.auth!.role);
  if (!isLeadership && current.createdBy !== request.auth!.userId) {
    throw new ApiError(403, "EVENT_EDIT_FORBIDDEN", "Yalnız yaratdığın tədbiri dəyişə bilərsən.");
  }
  const patch = z.record(z.string(), z.unknown()).parse(request.body);
  // Mətn dəyişibsə və qısa təsvir ayrıca verilməyibsə, qısa təsvir yenidən qurulur.
  if (typeof patch.longDescription === "string" && patch.description === undefined) {
    patch.description = summarize(patch.longDescription);
  }
  const parsedPatch = eventSchema.parse({ ...current, ...patch });
  const input = { ...parsedPatch, description: parsedPatch.description ?? summarize(parsedPatch.longDescription) };
  // Müəllimin tədbiri rəhbərliyin yoxlamasından sonra dərc olunur. Əvvəl dərc
  // olunmuş tədbiri müəllim yenidən yoxlamasız dəyişə bilirdi — başlıq və mətn
  // moderasiyadan yan keçirdi. İndi belə dəyişiklik tədbiri yoxlamaya qaytarır.
  const adminStatus = !isLeadership && current.adminStatus !== "Qaralama" ? "Qaralama" : undefined;
  const event = await updateEvent(eventId, { ...input, adminStatus });
  if (event) await noticeEventChanged(current, event, request.auth!.userId);
  response.json({ data: event });
});

eventsRouter.delete("/:eventId", authenticate, async (request, response) => {
  const eventId = z.string().parse(request.params.eventId);
  const current = await findEventById(eventId);
  if (!current) throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
  if (!["owner_admin", "admin", "assistant_admin"].includes(request.auth!.role) && current.createdBy !== request.auth!.userId) {
    throw new ApiError(403, "EVENT_DELETE_FORBIDDEN", "Yalnız yaratdığın tədbiri silə bilərsən.");
  }
  await noticeEventCancelled(current, request.auth!.userId);
  await deleteEvent(eventId);
  response.status(204).send();
});

eventsRouter.post("/:eventId/registrations", authenticate, async (request, response) => {
  const eventId = z.string().parse(request.params.eventId);
  const event = await registerForEvent(eventId, request.auth!.userId);
  response.status(201).json({ data: { registered: true, event } });
});

eventsRouter.delete("/:eventId/registrations", authenticate, async (request, response) => {
  const eventId = z.string().parse(request.params.eventId);
  const event = await cancelEventRegistration(eventId, request.auth!.userId);
  response.json({ data: { registered: false, event } });
});
