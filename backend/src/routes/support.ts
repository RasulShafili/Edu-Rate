import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createSupportTicket, listSupportTickets, updateSupportTicketStatus } from "../db/platform.js";
import { authenticate, optionalAuthenticate, requireAdmin } from "../middleware/authenticate.js";
import { findUserById } from "../db/database.js";
import { ApiError } from "../lib/api-error.js";
import { userOrIpKey } from "../lib/client-key.js";

export const supportRouter = Router();

// Daxil olmuş istifadəçi üçün hesab üzrə, anonim üçün real IP üzrə.
const limiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 4,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Çox sayda dəstək sorğusu göndərilib." } },
});

const ticketSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  topic: z.string().trim().min(2).max(120),
  message: z.string().trim().min(20).max(2000),
});

supportRouter.get("/tickets/me", authenticate, async (request, response) => {
  response.json({ data: await listSupportTickets(request.auth!.userId) });
});

supportRouter.get("/tickets", authenticate, requireAdmin, async (_request, response) => {
  response.json({ data: await listSupportTickets() });
});

supportRouter.patch("/tickets/:id", authenticate, requireAdmin, async (request, response) => {
  const id=z.string().uuid().parse(request.params.id);
  const {status}=z.object({status:z.enum(["open","in_progress","resolved"])}).strict().parse(request.body);
  const ticket=await updateSupportTicketStatus(id,status);
  if(!ticket) throw new ApiError(404,"TICKET_NOT_FOUND","Dəstək müraciəti tapılmadı.");
  response.json({data:ticket});
});

supportRouter.post("/tickets", optionalAuthenticate, limiter, async (request, response) => {
  const user=request.auth ? await findUserById(request.auth.userId) : null;
  const input=ticketSchema.parse(request.body);
  const ticket = await createSupportTicket(user ? { ...input, name:user.name, email:user.email } : input, user?.id??null);
  // `optionalAuthenticate` vaxtı bitmiş tokeni səssizcə anonim sayır. Müraciət
  // hesaba bağlanmayıbsa interfeys bunu bilməlidir — yoxsa "tarixçədə izlə" deyir,
  // müraciət isə tarixçəyə heç düşmür.
  response.status(201).json({ data: { reference: ticket.reference, status: ticket.status, linked: Boolean(user) } });
});
