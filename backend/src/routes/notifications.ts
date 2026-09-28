import { Router } from "express";
import { z } from "zod";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../db/notifications.js";
import { ApiError } from "../lib/api-error.js";
import { authenticate } from "../middleware/authenticate.js";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (request, response) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }).parse(request.query);
  response.json({ data: await listNotifications(request.auth!.userId, limit) });
});

notificationsRouter.post("/read-all", async (request, response) => {
  response.json({ data: { updated: await markAllNotificationsRead(request.auth!.userId) } });
});

notificationsRouter.patch("/:id/read", async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  if (!(await markNotificationRead(request.auth!.userId, id))) {
    throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Bildiriş tapılmadı.");
  }
  response.json({ data: { read: true } });
});
