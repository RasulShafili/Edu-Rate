import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { openApiDocument } from "./openapi.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { clubsRouter } from "./routes/clubs.js";
import { mediaRouter } from "./routes/media.js";
import { eventsRouter } from "./routes/events.js";
import { healthRouter } from "./routes/health.js";
import { mentorshipRouter } from "./routes/mentorship.js";
import { networkRouter } from "./routes/network.js";
import { reviewsRouter } from "./routes/reviews.js";
import { supportRouter } from "./routes/support.js";
import { workspaceRouter } from "./routes/workspace.js";
import { communityRouter } from "./routes/community.js";
import { realtimeRouter } from "./routes/realtime.js";
import { timetableRouter } from "./routes/timetable.js";
import { pushRouter } from "./routes/push.js";
import { questionsRouter } from "./routes/questions.js";
import { trailRouter } from "./routes/trail.js";
import { notificationsRouter } from "./routes/notifications.js";
import { authenticate, requirePrimaryAdmin } from "./middleware/authenticate.js";

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use((request, response, next) => {
    const suppliedRequestId = request.header("x-request-id")?.trim();
    const requestId = suppliedRequestId && /^[A-Za-z0-9._-]{1,80}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();
    response.locals.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    cors((request, callback) => {
      const origin = request.header("origin");
      const isAllowed = !origin || env.ALLOWED_ORIGINS.includes(origin);

      callback(null, {
        origin: isAllowed,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
        credentials: false,
        maxAge: 86_400,
      });
    }),
  );
  app.use(express.json({ limit: "64kb", strict: true }));

  app.get("/", (_request, response) => {
    response.json({
      data: {
        service: "EduRate API",
        status: "ready",
        documentation: "/api-docs",
      },
    });
  });
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/clubs", clubsRouter);
  app.use("/api/mentorship/requests", mentorshipRouter);
  app.use("/api/network", networkRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/support", supportRouter);
  app.use("/api/workspace", workspaceRouter);
  app.use("/api/community", communityRouter);
  app.use("/api/media", mediaRouter);
  app.use("/api/realtime", realtimeRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/timetable", timetableRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/questions", questionsRouter);
  app.use("/api/trail", trailRouter);
  app.use("/api", catalogRouter);
  app.use("/api/admin", adminRouter);
  if(env.NODE_ENV!=="production"||env.SWAGGER_PUBLIC){
    app.get("/api/openapi.json", (_request, response) => response.json(openApiDocument));
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, {
        customSiteTitle: "EduRate API sənədləri",
        swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
      }),
    );
  } else {
    app.get("/api/openapi.json", authenticate, requirePrimaryAdmin, (_request, response) => response.json(openApiDocument));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
