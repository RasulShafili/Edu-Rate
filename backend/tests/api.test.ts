import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "edurate-test-secret-with-at-least-32-characters";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.TRUST_PROXY = "true";
const PROXY_SECRET = "edurate-test-proxy-secret-with-at-least-32-chars";
process.env.EDURATE_PROXY_SECRET = PROXY_SECRET;

let app: Express;
let reusableStudentId = "";
let reusableStudentToken = "";
let reusableAdminToken = "";
let reusableMediaStudentToken = "";
let reusableReviewId = "";

before(async () => {
  const module = await import("../src/app.js");
  app = module.createApp();
  const [{createUser},{createAccessToken,hashPassword}]=await Promise.all([import("../src/db/database.js"),import("../src/lib/auth.js")]);
  const admin=await createUser({name:"Başlanğıc Platforma Sahibi",email:"bootstrap.admin@example.az",passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"Pedaqoji fakültə",program:"Riyaziyyat müəllimliyi",role:"owner_admin",status:"Aktiv"});
  reusableAdminToken=createAccessToken(admin);
  const mediaStudent=await createUser({name:"Şəkil Təhlükəsizlik Testi",email:"media.security@example.az",passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"Mühəndislik fakültəsi",program:"Kompüter mühəndisliyi",role:"student",status:"Aktiv"});
  reusableMediaStudentToken=createAccessToken(mediaStudent);
});

describe("EduRate API", () => {
  it("health endpoint-i server vəziyyətini qaytarır", async () => {
    const response = await request(app).get("/api/health").expect(200);
    assert.equal(response.body.data.status, "ok");
    assert.equal(response.body.data.database, "memory");
  });

  it("OpenAPI sənədini təqdim edir", async () => {
    const response = await request(app).get("/api/openapi.json").expect(200);
    assert.equal(response.body.openapi, "3.1.0");
    assert.ok(response.body.paths["/api/auth/signup"]);
    assert.ok(response.body.paths["/api/events/{eventId}"]);
    assert.ok(response.body.paths["/api/mentorship/requests"]);
    assert.ok(response.body.paths["/api/clubs/{clubId}/memberships"]);
    assert.ok(response.body.paths["/api/clubs/{clubId}"]);
    assert.ok(response.body.paths["/api/clubs/{clubId}"].patch);
    assert.ok(response.body.paths["/api/clubs/{clubId}"].delete);
    assert.ok(response.body.paths["/api/clubs/{clubId}/members"].get);
    assert.ok(response.body.paths["/api/clubs/{clubId}/leaders/{userId}"].patch);
    assert.ok(response.body.paths["/api/reviews"]);
    assert.ok(response.body.paths["/api/network/announcements"]);
    assert.ok(response.body.paths["/api/network/announcements/{id}/state"].patch);
    assert.ok(response.body.paths["/api/network/feed"]);
    assert.ok(response.body.paths["/api/admin/reviews"]);
    assert.ok(response.body.paths["/api/admin/announcements"]);
    assert.ok(response.body.paths["/api/admin/feed"]);
    assert.ok(response.body.paths["/api/admin/support-tickets"]);
    assert.ok(response.body.paths["/api/workspace"]);
    assert.ok(response.body.paths["/api/workspace/mentorship/{id}"]);
    assert.ok(response.body.paths["/api/support/tickets"]);
    assert.ok(response.body.paths["/api/academic-catalog"]);
    assert.ok(response.body.paths["/api/network/feed"].post);
    assert.ok(response.body.paths["/api/support/tickets"].get);
    assert.ok(response.body.paths["/api/support/tickets/{id}"].patch);
    assert.ok(response.body.paths["/api/community/connections/{id}"].patch);
    assert.ok(response.body.paths["/api/community/connections/{id}"].delete);
    assert.ok(response.body.paths["/api/community/conversations/{id}/read"].patch);
    assert.ok(response.body.paths["/api/community/groups"].get);
    assert.ok(response.body.paths["/api/community/conversations/{id}/messages/{messageId}"].delete);
    assert.ok(response.body.paths["/api/media/sign"].post);
    assert.ok(response.body.paths["/api/media/confirm"].post);
  });

  it("CORS-u yalnız frontend allowlist-i ilə məhdudlaşdırır", async () => {
    const allowed = await request(app)
      .options("/api/auth/signup")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    assert.equal(allowed.headers["access-control-allow-origin"], "http://localhost:3000");
    assert.equal(allowed.headers["access-control-allow-credentials"], undefined);

    const denied = await request(app)
      .options("/api/auth/signup")
      .set("Origin", "https://attacker.example")
      .set("Access-Control-Request-Method", "POST")
      .expect(200);
    assert.equal(denied.headers["access-control-allow-origin"], undefined);
  });

  it("yanlış və həddindən böyük JSON sorğularını təhlükəsiz rədd edir", async () => {
    const malformed = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":')
      .expect(400);
    assert.equal(malformed.body.error.code, "INVALID_JSON");

    const oversized = await request(app)
      .post("/api/support/tickets")
      .send({
        name: "Test İstifadəçisi",
        email: "payload@example.az",
        topic: "Təhlükəsizlik testi",
        message: "x".repeat(70_000),
      })
      .expect(413);
    assert.equal(oversized.body.error.code, "PAYLOAD_TOO_LARGE");
  });

  it("qeydiyyat, giriş və sessiya axınını tamamlayır", async () => {
    const email = `telebe.${Date.now()}@example.az`;
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Nümunə Tələbə",
        email,
        password: "Kampus-Yolu-2026",
        university: "Qarabağ Universiteti",
        faculty: "Mühəndislik fakültəsi",
        program: "Kompüter mühəndisliyi",
      })
      .expect(201);

    assert.equal(signup.body.data.user.email, email);
    assert.ok(signup.body.data.token);
    const tokenPayload = jwt.decode(signup.body.data.token) as { iat?: number; exp?: number } | null;
    assert.ok(tokenPayload?.iat && tokenPayload.exp);
    assert.ok(tokenPayload.exp - tokenPayload.iat >= 60 * 60 * 24 * 29);
    assert.equal(signup.body.data.user.passwordHash, undefined);
    reusableStudentId = signup.body.data.user.id;
    reusableStudentToken = signup.body.data.token;

    await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Nümunə Tələbə",
        email,
        password: "Kampus-Yolu-2026",
        faculty: "Mühəndislik fakültəsi",
        program: "Kompüter mühəndisliyi",
      })
      .expect(409);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Kampus-Yolu-2026" })
      .expect(200);

    const session = await request(app)
      .get("/api/auth/session")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .expect(200);

    assert.equal(session.body.data.user.email, email);

    const invalidProfile = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({
        name: "Nümunə Tələbə",
        university: "Qarabağ Universiteti",
        faculty: "Mühəndislik fakültəsi",
        program: "Psixologiya",
        year: "2-ci kurs",
        about: "Uyğun olmayan ixtisas seçimi sınağı.",
      })
      .expect(422);
    assert.equal(invalidProfile.body.error.code, "INVALID_ACADEMIC_SELECTION");

    const profile = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({
        name: "Nümunə Tələbə",
        university: "Qarabağ Universiteti",
        faculty: "Mühəndislik fakültəsi",
        program: "Kompüter mühəndisliyi",
        year: "2-ci kurs",
        about: "Texnologiya və tələbə icmaları ilə maraqlanıram.",
      })
      .expect(200);

    assert.equal(profile.body.data.user.program, "Kompüter mühəndisliyi");

    const devices = await request(app).get("/api/auth/sessions").set("Authorization", `Bearer ${login.body.data.token}`).expect(200);
    assert.equal(devices.body.data.filter((item: { current: boolean }) => item.current).length, 1);
    await request(app).delete("/api/auth/sessions").set("Authorization", `Bearer ${login.body.data.token}`).expect(204);
    await request(app).get("/api/auth/session").set("Authorization", `Bearer ${signup.body.data.token}`).expect(401);
    await request(app).get("/api/auth/session").set("Authorization", `Bearer ${login.body.data.token}`).expect(200);
    reusableStudentToken = login.body.data.token;
  });

  it("şəkil yükləməsini autentifikasiya, rol və server konfiqurasiyası ilə qoruyur", async () => {
    await request(app).post("/api/media/sign").send({ kind: "avatar" }).expect(401);
    const authorization = `Bearer ${reusableMediaStudentToken}`;

    const status = await request(app)
      .get("/api/media/status")
      .set("Authorization", authorization)
      .expect(200);
    assert.equal(status.body.data.enabled, false);
    assert.deepEqual(status.body.data.formats, ["jpg", "jpeg", "png", "webp"]);

    const unavailable = await request(app)
      .post("/api/media/sign")
      .set("Authorization", authorization)
      .send({ kind: "avatar" })
      .expect(503);
    assert.equal(unavailable.body.error.code, "MEDIA_NOT_CONFIGURED");

    const forbidden = await request(app)
      .post("/api/media/sign")
      .set("Authorization", authorization)
      .send({ kind: "announcement", ownerId: "test-announcement" })
      .expect(403);
    assert.equal(forbidden.body.error.code, "MEDIA_OWNER_MISMATCH");
  });

  it("rəsmi akademik kataloqu və fakültə-ixtisas uyğunluğunu qoruyur", async () => {
    const { ACADEMIC_CATALOG, isValidAcademicSelection } = await import(
      "../src/data/academic-catalog.js"
    );
    assert.equal(ACADEMIC_CATALOG.length, 7);

    const catalog = await request(app).get("/api/academic-catalog").expect(200);
    assert.deepEqual(catalog.body.data, ACADEMIC_CATALOG);

    for (const entry of ACADEMIC_CATALOG) {
      assert.ok(entry.programs.length > 0);
      for (const program of entry.programs) {
        assert.equal(isValidAcademicSelection(entry.faculty, program), true);
      }
    }
    assert.equal(isValidAcademicSelection("Mühəndislik fakültəsi", "Psixologiya"), false);
    assert.equal(isValidAcademicSelection("Mövcud olmayan fakültə", "Tibb"), false);

    const validBase = {
      name: "Akademik Seçim Testi",
      password: "Kampus-Yolu-2026",
      university: "Qarabağ Universiteti",
      faculty: "Mühəndislik fakültəsi",
      program: "Kompüter mühəndisliyi",
    };

    const mismatched = await request(app)
      .post("/api/auth/signup")
      .set("X-Forwarded-For", "203.0.113.21")
      .send({ ...validBase, email: `mismatch.${Date.now()}@example.az`, program: "Psixologiya" })
      .expect(422);
    assert.equal(mismatched.body.error.code, "INVALID_ACADEMIC_SELECTION");
    assert.ok(mismatched.body.error.details.program);

    const unsupportedUniversity = await request(app)
      .post("/api/auth/signup")
      .set("X-Forwarded-For", "203.0.113.22")
      .send({ ...validBase, email: `university.${Date.now()}@example.az`, university: "Başqa Universitet" })
      .expect(422);
    assert.equal(unsupportedUniversity.body.error.code, "INVALID_ACADEMIC_SELECTION");
    assert.ok(unsupportedUniversity.body.error.details.university);

    const missingProgram = await request(app)
      .post("/api/auth/signup")
      .set("X-Forwarded-For", "203.0.113.23")
      .send({
        name: validBase.name,
        email: `missing.${Date.now()}@example.az`,
        password: validBase.password,
        university: validBase.university,
        faculty: validBase.faculty,
      })
      .expect(422);
    assert.equal(missingProgram.body.error.code, "VALIDATION_ERROR");
    assert.ok(missingProgram.body.error.details.program);
  });

  it("kataloq endpoint-lərini təqdim edir", async () => {
    const [events, clubs, mentors, teachers, announcements, feed] = await Promise.all([
      request(app).get("/api/events").expect(200),
      request(app).get("/api/clubs").expect(200),
      request(app).get("/api/mentors").expect(200),
      request(app).get("/api/teachers").expect(200),
      request(app).get("/api/network/announcements").expect(200),
      request(app).get("/api/network/feed").expect(200),
    ]);

    assert.ok(events.body.data.length > 0);
    assert.ok(clubs.body.data.length > 0);
    assert.ok(mentors.body.data.length > 0);
    assert.ok(teachers.body.data.length > 0);
    assert.equal(typeof teachers.body.data[0].rating, "number");
    assert.equal(typeof teachers.body.data[0].reviewCount, "number");
    assert.ok(announcements.body.data.length > 0);
    assert.ok(feed.body.data.length > 0);
  });

  it("tədbir CRUD, qeydiyyat və mentorluq axınlarını başdan sona tamamlayır", async () => {
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Test İstifadəçisi",
        email: `crud.${Date.now()}@example.az`,
        password: "Kampus-Yolu-2026",
        university: "Qarabağ Universiteti",
        faculty: "İqtisadiyyat fakültəsi",
        program: "İqtisadiyyat",
      })
      .expect(201);
    const authorization = `Bearer ${signup.body.data.token}`;
    const eventInput = {
      title: "Sprint 2 innovasiya görüşü",
      category: "Technology",
      description: "Tələbə layihələrinin təqdim olunduğu açıq innovasiya görüşü.",
      longDescription: "Komandalar işlək prototiplərini təqdim edir, rəy alır və növbəti inkişaf addımlarını birlikdə müəyyənləşdirirlər.",
      location: "İnnovasiya mərkəzi",
      city: "Xankəndi",
      organizer: "EduRate tələbə komandası",
      startAt: "2026-12-10T14:00:00+04:00",
      endAt: "2026-12-10T16:00:00+04:00",
      registrationDeadline: "2026-12-09T23:59:59+04:00",
      speakers: ["Nigar Hüseynli", "Tural Kərimov"],
      capacity: 40,
      accent: "#c8ff4d",
      glow: "rgba(200, 255, 77, 0.28)",
    };

    const created = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${reusableAdminToken}`)
      .send(eventInput)
      .expect(201);
    const eventId = created.body.data.id as string;
    assert.equal(created.body.data.availableSpots, 40);

    const updated = await request(app)
      .patch(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${reusableAdminToken}`)
      .send({ ...eventInput, title: "Yenilənmiş innovasiya görüşü" })
      .expect(200);
    assert.equal(updated.body.data.title, "Yenilənmiş innovasiya görüşü");

    await request(app)
      .post(`/api/events/${eventId}/registrations`)
      .set("Authorization", authorization)
      .expect(201);
    await request(app)
      .post(`/api/events/${eventId}/registrations`)
      .set("Authorization", authorization)
      .expect(409);

    const myEvents = await request(app)
      .get("/api/events/registrations/me")
      .set("Authorization", authorization)
      .expect(200);
    assert.ok(myEvents.body.data.some((event: { id: string }) => event.id === eventId));

    await request(app)
      .delete(`/api/events/${eventId}/registrations`)
      .set("Authorization", authorization)
      .expect(200);

    const registrationsAfterCancellation = await request(app)
      .get("/api/events/registrations/me")
      .set("Authorization", authorization)
      .expect(200);
    assert.ok(!registrationsAfterCancellation.body.data.some((event: { id: string }) => event.id === eventId));

    const eventAfterCancellation = await request(app)
      .get(`/api/events/${eventId}`)
      .expect(200);
    assert.equal(eventAfterCancellation.body.data.availableSpots, 40);

    const mentorship = await request(app)
      .post("/api/mentorship/requests")
      .set("Authorization", authorization)
      .send({ mentorId: "aygun-rzayeva", note: "Məhsul ideyamı dəqiqləşdirmək istəyirəm." })
      .expect(201);
    const mentorshipId = mentorship.body.data.id as string;

    await request(app)
      .patch(`/api/mentorship/requests/${mentorshipId}`)
      .set("Authorization", authorization)
      .send({ note: "Məhsul strategiyası üzrə ilkin plan hazırlamaq istəyirəm." })
      .expect(200);
    await request(app)
      .delete(`/api/mentorship/requests/${mentorshipId}`)
      .set("Authorization", authorization)
      .expect(204);

    await request(app)
      .delete(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${reusableAdminToken}`)
      .expect(204);
    await request(app).get(`/api/events/${eventId}`).expect(404);
  });

  it("klub üzvlüyü, müəllim rəyi və dəstək müraciətini bazada saxlayır", async () => {
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Aysel Məmmədli",
        email: `platform.${Date.now()}@example.az`,
        password: "Kampus-Yolu-2026",
        university: "Qarabağ Universiteti",
        faculty: "Humanitar və sosial elmlər fakültəsi",
        program: "Psixologiya",
      })
      .expect(201);
    const authorization = `Bearer ${signup.body.data.token}`;

    await request(app)
      .post("/api/clubs/innovasiya-robototexnika/memberships")
      .set("Authorization", authorization)
      .expect(201);
    const memberships = await request(app)
      .get("/api/clubs/memberships/me")
      .set("Authorization", authorization)
      .expect(200);
    assert.ok(memberships.body.data.some((club: { slug: string }) => club.slug === "innovasiya-robototexnika"));

    const reviewInput = {
      teacherId: "nigar-huseynli",
      course: "İngilis dili",
      semester: `2026-payız-${Date.now()}`,
      criteria: { clarity: 5, subjectKnowledge: 5, objectivity: 4, communication: 5 },
    };
    const createdReview = await request(app).post("/api/reviews").set("Authorization", authorization).send(reviewInput).expect(201);
    reusableReviewId = createdReview.body.data.id;
    await request(app).post("/api/reviews").set("Authorization", authorization).send(reviewInput).expect(409);
    const currentSemesterReviews = await request(app)
      .get(`/api/reviews/mine?semester=${encodeURIComponent(reviewInput.semester)}`)
      .set("Authorization", authorization)
      .expect(200);
    assert.equal(currentSemesterReviews.body.data.length, 1);
    assert.equal(currentSemesterReviews.body.data[0].teacherId, reviewInput.teacherId);
    assert.equal(currentSemesterReviews.body.data[0].semester, reviewInput.semester);
    assert.equal(currentSemesterReviews.body.data[0].userId, undefined);
    await request(app).post("/api/reviews").set("Authorization", authorization).send({ ...reviewInput, semester: "2027-yaz", text: "Açıq mətn API tərəfindən qəbul edilməməlidir." }).expect(422);

    const ticket = await request(app).post("/api/support/tickets").set("Authorization", authorization).send({
      name: "Aysel Məmmədli",
      email: "aysel.memmedli@example.az",
      topic: "Tədbir qeydiyyatı",
      message: "Tədbir qeydiyyatımın vəziyyətini dəqiqləşdirmək istəyirəm.",
    }).expect(201);
    assert.match(ticket.body.data.reference, /^EDU-/);

    await request(app)
      .delete("/api/clubs/innovasiya-robototexnika/memberships")
      .set("Authorization", authorization)
      .expect(200);
  });

  it("admin icmalı və real idarəetmə siyahılarını qorunan API-dən qaytarır", async () => {
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Test Administratoru",
        email: "admin.test@example.az",
        password: "Kampus-Yolu-2026",
        university: "Qarabağ Universiteti",
        faculty: "Pedaqoji fakültə",
        program: "Riyaziyyat müəllimliyi",
      })
      .expect(201);
    assert.equal(signup.body.data.user.role, "student");
    const denied = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${signup.body.data.token}`)
      .expect(403);
    assert.equal(denied.body.error.code, "ADMIN_REQUIRED");
    const authorization = `Bearer ${reusableAdminToken}`;

    const overview = await request(app).get("/api/admin/overview").set("Authorization", authorization).expect(200);
    assert.equal(overview.body.data.metrics.length, 4);
    assert.equal(overview.body.data.activity.length, 6);
    assert.match(overview.body.data.activity[5].month, /^\d{4}-\d{2}$/);
    for (const metric of overview.body.data.metrics) {
      assert.equal(metric.trend, undefined);
      assert.equal(typeof metric.counts.value, "number");
    }
    for (let index = 1; index < overview.body.data.activity.length; index += 1) {
      assert.ok(overview.body.data.activity[index].users >= overview.body.data.activity[index - 1].users);
      assert.ok(overview.body.data.activity[index].clubs >= overview.body.data.activity[index - 1].clubs);
      assert.ok(overview.body.data.activity[index].events >= overview.body.data.activity[index - 1].events);
    }
    const users = await request(app).get("/api/admin/users?page=1&pageSize=5").set("Authorization", authorization).expect(200);
    assert.equal(users.body.data.page, 1);
    assert.ok(users.body.data.total >= 1);
    const clubs = await request(app).get("/api/admin/clubs?page=1&pageSize=5").set("Authorization", authorization).expect(200);
    assert.ok(clubs.body.data.total >= 1);

    await request(app)
      .patch(`/api/admin/users/${reusableStudentId}`)
      .set("Authorization", authorization)
      .send({ status: "Məhdudlaşdırılıb" })
      .expect(200);
    await request(app)
      .get("/api/auth/session")
      .set("Authorization", `Bearer ${reusableStudentToken}`)
      .expect(403);

  });

  it("admin rəy moderasiyasını tamamlayır və yalnız təsdiqlənmiş rəyi yayımlayır", async () => {
    const authorization = `Bearer ${reusableAdminToken}`;
    const pending = await request(app)
      .get("/api/admin/reviews?status=pending")
      .set("Authorization", authorization)
      .expect(200);
    assert.ok(pending.body.data.some((review: { id: string }) => review.id === reusableReviewId));

    await request(app)
      .patch(`/api/admin/reviews/${reusableReviewId}`)
      .set("Authorization", authorization)
      .send({ status: "approved" })
      .expect(200);

    const published = await request(app)
      .get("/api/reviews?teacherId=nigar-huseynli")
      .expect(200);
    const review = published.body.data.find((item: { id: string }) => item.id === reusableReviewId);
    assert.ok(review);
    assert.equal(review.userId, undefined);
    assert.equal(review.text, undefined);
    assert.equal(review.author, "Təsdiqlənmiş EduRate hesabı");
  });

  it("üç səviyyəli admin icazələrini server tərəfində tətbiq edir", async () => {
    const adminAuthorization = `Bearer ${reusableAdminToken}`;
    const suffix = Date.now();

    const primaryAdminSession = await request(app)
      .get("/api/auth/session")
      .set("Authorization", adminAuthorization)
      .expect(200);
    const primaryAdminId = primaryAdminSession.body.data.user.id as string;

    for (const unsafeSelfPatch of [{ role: "student" }, { status: "Məhdudlaşdırılıb" }]) {
      const deniedSelfLockout = await request(app)
        .patch(`/api/admin/users/${primaryAdminId}`)
        .set("Authorization", adminAuthorization)
        .send(unsafeSelfPatch)
        .expect(409);
      assert.equal(deniedSelfLockout.body.error.code, "SELF_ADMIN_LOCKOUT_FORBIDDEN");
    }

    const assistantCandidate = await request(app)
      .post("/api/admin/users")
      .set("Authorization", adminAuthorization)
      .send({
        name: "Admin Köməkçisi",
        email: `assistant.${suffix}@example.az`,
        role: "student",
        university: "Qarabağ Universiteti",
        faculty: "İdarəetmə fakültəsi",
      })
      .expect(201);
    const assistantId = assistantCandidate.body.data.id as string;

    const student = await request(app)
      .post("/api/admin/users")
      .set("Authorization", adminAuthorization)
      .send({
        name: "RBAC Tələbəsi",
        email: `student.rbac.${suffix}@example.az`,
        role: "student",
        university: "Qarabağ Universiteti",
        faculty: "Mühəndislik fakültəsi",
      })
      .expect(201);
    const studentId = student.body.data.id as string;

    const [{ findUserById }, { createAccessToken }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const assistantRecord = await findUserById(assistantId);
    const studentRecord = await findUserById(studentId);
    assert.ok(assistantRecord);
    assert.ok(studentRecord);
    const assistantAuthorization = `Bearer ${createAccessToken(assistantRecord)}`;
    const studentAuthorization = `Bearer ${createAccessToken(studentRecord)}`;

    const promoted = await request(app)
      .patch(`/api/admin/users/${assistantId}`)
      .set("Authorization", adminAuthorization)
      .send({ role: "assistant_admin" })
      .expect(200);
    assert.equal(promoted.body.data.role, "assistant_admin");

    const assistantSession = await request(app)
      .get("/api/auth/session")
      .set("Authorization", assistantAuthorization)
      .expect(200);
    assert.equal(assistantSession.body.data.user.role, "assistant_admin");

    await Promise.all([
      request(app).get("/api/admin/overview").set("Authorization", assistantAuthorization).expect(200),
      request(app).get("/api/admin/users").set("Authorization", assistantAuthorization).expect(200),
      request(app).get("/api/admin/clubs").set("Authorization", assistantAuthorization).expect(200),
      request(app).get("/api/admin/events").set("Authorization", assistantAuthorization).expect(200),
    ]);

    const eventInput = {
      name: "RBAC inteqrasiya tədbiri",
      category: "Texnologiya",
      organizer: "EduRate komandası",
      startAt: "2027-02-12T14:00:00+04:00",
      capacity: 80,
      place: "İnnovasiya mərkəzi",
    };
    const createdEvent = await request(app)
      .post("/api/admin/events")
      .set("Authorization", assistantAuthorization)
      .send(eventInput)
      .expect(201);
    const eventId = createdEvent.body.data.id as string;
    await request(app)
      .patch(`/api/admin/events/${eventId}`)
      .set("Authorization", assistantAuthorization)
      .send({ name: "Yenilənmiş RBAC tədbiri" })
      .expect(200);

    const clubSlug = `rbac-klubu-${suffix}`;
    const createdClub = await request(app)
      .post("/api/admin/clubs")
      .set("Authorization", assistantAuthorization)
      .send({
        name: "RBAC İnnovasiya Klubu",
        slug: clubSlug,
        category: "Texnologiya",
        coordinatorInitials: "RK",
        shortName:"RBAC Klub",
        tagline:"Tələbə ideyalarını birlikdə işlək layihəyə çevir.",
        description:"Texnologiya və məhsul ideyaları üzərində çalışan açıq tələbə klubudur.",
        about:["Klub müxtəlif ixtisaslardan tələbələri real kampus problemləri ətrafında birləşdirir."],
        tone:"lime",visualMark:"RK",meeting:{cadence:"Həftəlik",day:"Çərşənbə",time:"18:00",place:"İnnovasiya zalı"},
        focusTags:["Texnologiya","Komanda işi"],
        status:"Aktiv",
      })
      .expect(201);
    const clubId = createdClub.body.data.id as string;
    const publicClub=await request(app).get(`/api/clubs/${clubSlug}`).expect(200);
    assert.equal(publicClub.body.data.tagline,"Tələbə ideyalarını birlikdə işlək layihəyə çevir.");
    assert.equal(publicClub.body.data.memberCount,1);
    assert.deepEqual(publicClub.body.data.focusTags,["Texnologiya","Komanda işi"]);
    await request(app)
      .patch(`/api/admin/clubs/${clubId}`)
      .set("Authorization", assistantAuthorization)
      .send({ name: "RBAC Texnologiya Klubu" })
      .expect(200);

    const forbiddenUserCreate = await request(app)
      .post("/api/admin/users")
      .set("Authorization", assistantAuthorization)
      .send({
        name: "İcazəsiz İstifadəçi",
        email: `forbidden.${suffix}@example.az`,
        role: "student",
        university: "Qarabağ Universiteti",
        faculty: "İqtisadiyyat fakültəsi",
      })
      .expect(403);
    assert.equal(forbiddenUserCreate.body.error.code, "OWNER_ADMIN_REQUIRED");

    const allowedLowerRoleChange = await request(app)
      .patch(`/api/admin/users/${studentId}`)
      .set("Authorization", assistantAuthorization)
      .send({ role: "mentor" })
      .expect(200);
    assert.equal(allowedLowerRoleChange.body.data.role, "mentor");

    const forbiddenRoleEscalation = await request(app)
      .patch(`/api/admin/users/${studentId}`)
      .set("Authorization", assistantAuthorization)
      .send({ role: "admin" })
      .expect(403);
    assert.equal(forbiddenRoleEscalation.body.error.code, "ROLE_ESCALATION_FORBIDDEN");

    const forbiddenSelfRoleChange = await request(app)
      .patch(`/api/admin/users/${assistantId}`)
      .set("Authorization", assistantAuthorization)
      .send({ role: "student" })
      .expect(403);
    assert.equal(
      forbiddenSelfRoleChange.body.error.code,
      "PRIVILEGED_USER_MODIFICATION_FORBIDDEN",
    );

    const forbiddenPrimaryAdminChange = await request(app)
      .patch(`/api/admin/users/${primaryAdminId}`)
      .set("Authorization", assistantAuthorization)
      .send({ role: "teacher" })
      .expect(403);
    assert.equal(
      forbiddenPrimaryAdminChange.body.error.code,
      "PRIVILEGED_USER_MODIFICATION_FORBIDDEN",
    );

    await request(app)
      .patch(`/api/admin/users/${studentId}`)
      .set("Authorization", assistantAuthorization)
      .send({ role: "teacher", status: "Aktiv" })
      .expect(422);

    const forbiddenUserDelete = await request(app)
      .delete(`/api/admin/users/${studentId}`)
      .set("Authorization", assistantAuthorization)
      .expect(403);
    assert.equal(forbiddenUserDelete.body.error.code, "OWNER_ADMIN_REQUIRED");

    for (const path of ["/api/admin/overview", "/api/admin/users", "/api/admin/events", "/api/admin/clubs"]) {
      const denied = await request(app)
        .get(path)
        .set("Authorization", studentAuthorization)
        .expect(403);
      assert.equal(denied.body.error.code, "ADMIN_REQUIRED");
    }

    await request(app)
      .delete(`/api/admin/events/${eventId}`)
      .set("Authorization", assistantAuthorization)
      .expect(204);
    await request(app)
      .delete(`/api/admin/clubs/${clubId}`)
      .set("Authorization", assistantAuthorization)
      .expect(204);

    await request(app)
      .delete(`/api/admin/users/${studentId}`)
      .set("Authorization", adminAuthorization)
      .expect(204);
    await request(app)
      .delete(`/api/admin/users/${assistantId}`)
      .set("Authorization", adminAuthorization)
      .expect(204);
  });

  it("müəllim qeydiyyatından sonra eyni hesabla mentorluq müraciəti yaradır", async () => {
    const suffix = Date.now();
    const adminAuthorization = `Bearer ${reusableAdminToken}`;

    const teacherSignup = await request(app).post("/api/auth/signup").set("X-Forwarded-For", "203.0.113.61").send({
      name: "Səma Həsənli", email: `teacher.${suffix}@example.az`, password: "Kampus-Yolu-2026",
      university: "Qarabağ Universiteti", accountType: "teacher", program: "Riyaziyyat",
    }).expect(201);
    assert.equal(teacherSignup.body.data.requiresApproval, true);
    assert.equal(teacherSignup.body.data.token, undefined);
    assert.equal(teacherSignup.body.data.user.role, "teacher");
    assert.equal(teacherSignup.body.data.user.status, "Gözləmədə");

    const repeatedTeacherSignup = await request(app).post("/api/auth/signup").set("X-Forwarded-For", "203.0.113.66").send({
      name: "Səma Həsənli", email: `teacher.${suffix}@example.az`, password: "Kampus-Yolu-2026",
      university: "Qarabağ Universiteti", accountType: "teacher", program: "Riyaziyyat",
    }).expect(409);
    assert.equal(repeatedTeacherSignup.body.error.code, "TEACHER_APPROVAL_PENDING");

    await request(app).post("/api/auth/login").set("X-Forwarded-For", "203.0.113.62")
      .send({ email: `teacher.${suffix}@example.az`, password: "Kampus-Yolu-2026" }).expect(403);
    await request(app).patch(`/api/admin/users/${teacherSignup.body.data.user.id}`)
      .set("Authorization", adminAuthorization).send({ status: "Aktiv" }).expect(200);
    const teacherLogin = await request(app).post("/api/auth/login").set("X-Forwarded-For", "203.0.113.63")
      .send({ email: `teacher.${suffix}@example.az`, password: "Kampus-Yolu-2026" }).expect(200);
    const teacherAuthorization = `Bearer ${teacherLogin.body.data.token}`;
    const teacherWorkspace = await request(app).get("/api/workspace")
      .set("Authorization", teacherAuthorization).expect(200);
    assert.equal(teacherWorkspace.body.data.role, "teacher");
    assert.equal(teacherWorkspace.body.data.focus, "Riyaziyyat");
    const teacherEvent=await request(app).post("/api/events").set("Authorization",teacherAuthorization).send({
      title:"Müəllim seminarı",category:"Technology",description:"Tələbələr üçün praktik texnologiya seminarı.",
      longDescription:"Müəllimin təqdim etdiyi seminar praktiki nümunələr, açıq müzakirə və sual-cavab hissəsindən ibarətdir.",
      location:"Tədris zalı",city:"Xankəndi",organizer:"Səma Həsənli",startAt:"2027-06-10T14:00:00+04:00",
      endAt:"2027-06-10T16:00:00+04:00",registrationDeadline:"2027-06-09T18:00:00+04:00",speakers:["Səma Həsənli"],capacity:60,
    }).expect(201);
    assert.equal(teacherEvent.body.data.adminStatus,"Qaralama");
    const publicEventsAfterTeacher=await request(app).get("/api/events").expect(200);
    assert.equal(publicEventsAfterTeacher.body.data.some((item:{id:string})=>item.id===teacherEvent.body.data.id),false);
    const adminEventsAfterTeacher=await request(app).get("/api/admin/events").set("Authorization",adminAuthorization).expect(200);
    assert.equal(adminEventsAfterTeacher.body.data.items.some((item:{id:string;status:string})=>item.id===teacherEvent.body.data.id&&item.status==="Qaralama"),true);

    const teacherCatalog = await request(app).get("/api/teachers").expect(200);
    const teacherProfile = teacherCatalog.body.data.find((item: { userId: string }) => item.userId === teacherSignup.body.data.user.id);
    assert.ok(teacherProfile);

    await request(app).patch("/api/auth/profile").set("Authorization", teacherAuthorization).send({
      name: "Səma Həsənova", university: "Qarabağ Universiteti", faculty: "Müəllim heyəti",
      program: "Riyaziyyat müəllimliyi", year: "Müəllim", about: "Riyazi düşüncəni praktik nümunələrlə inkişaf etdirirəm.",
    }).expect(200);
    const updatedTeacherCatalog = await request(app).get("/api/teachers").expect(200);
    const updatedTeacherProfile = updatedTeacherCatalog.body.data.find((item: { userId: string }) => item.userId === teacherSignup.body.data.user.id);
    assert.equal(updatedTeacherProfile.name, "Səma Həsənova");
    assert.equal(updatedTeacherProfile.specialty, "Riyaziyyat müəllimliyi");

    await request(app).post("/api/auth/signup").set("X-Forwarded-For", "203.0.113.64").send({
      name: "Ayrıca Mentor", email: `mentor.${suffix}@example.az`, password: "Kampus-Yolu-2026",
      university: "Qarabağ Universiteti", accountType: "mentor", program: "Məhsul strategiyası",
    }).expect(422);

    const application = await request(app).post("/api/workspace/mentor-application")
      .set("Authorization", teacherAuthorization).send({
        specialty: "Riyaziyyat mentorluğu",
        biography: "Tələbələrə riyazi düşüncə və akademik inkişaf üzrə dəstək verirəm.",
        availability: "Həftəiçi 18:00-dan sonra",
        meetingMode: "Hibrid",
        languages: ["Azərbaycan dili"],
      }).expect(201);
    assert.equal(application.body.data.status, "pending");
    await request(app).post("/api/workspace/mentor-application")
      .set("Authorization", teacherAuthorization).send({
        specialty: "Riyaziyyat mentorluğu", biography: "Tələbələrə riyazi düşüncə və akademik inkişaf üzrə dəstək verirəm.",
        availability: "Həftəiçi", meetingMode: "Onlayn", languages: ["Azərbaycan dili"],
      }).expect(409);

    const pendingApplications = await request(app).get("/api/admin/mentor-applications?status=pending")
      .set("Authorization", adminAuthorization).expect(200);
    assert.ok(pendingApplications.body.data.some((item: { id: string }) => item.id === application.body.data.id));
    await request(app).patch(`/api/admin/mentor-applications/${application.body.data.id}`)
      .set("Authorization", adminAuthorization).send({ status: "approved" }).expect(200);

    const repeatedApprovedApplication = await request(app).post("/api/workspace/mentor-application")
      .set("Authorization", teacherAuthorization).send({
        specialty: "Riyaziyyat mentorluğu", biography: "Təsdiqlənmiş profili təkrar yaratmaq mümkün olmamalıdır.",
        availability: "Həftəiçi", meetingMode: "Onlayn", languages: ["Azərbaycan dili"],
      }).expect(409);
    assert.equal(repeatedApprovedApplication.body.error.code, "MENTOR_APPLICATION_EXISTS");

    const dualWorkspace = await request(app).get("/api/workspace").set("Authorization", teacherAuthorization).expect(200);
    assert.equal(dualWorkspace.body.data.role, "teacher");
    assert.equal(dualWorkspace.body.data.mentorEnabled, true);

    const studentSignup = await request(app).post("/api/auth/signup").set("X-Forwarded-For", "203.0.113.65").send({
      name: "Mentorluq Test Tələbəsi", email: `mentor.student.${suffix}@example.az`, password: "Kampus-Yolu-2026",
      university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi",
      program: "Kompüter mühəndisliyi", accountType: "student",
    }).expect(201);
    const mentorship = await request(app).post("/api/mentorship/requests")
      .set("Authorization", `Bearer ${studentSignup.body.data.token}`)
      .send({ mentorId: `mentor-${teacherSignup.body.data.user.id}`, note: "Karyera planımı dəqiqləşdirmək istəyirəm." }).expect(201);

    const mentorWorkspace = await request(app).get("/api/workspace").set("Authorization", teacherAuthorization).expect(200);
    assert.ok(mentorWorkspace.body.data.mentorItems.some((item: { id: string }) => item.id === mentorship.body.data.id));
    const accepted = await request(app).patch(`/api/workspace/mentorship/${mentorship.body.data.id}`)
      .set("Authorization", teacherAuthorization).send({ status: "accepted" }).expect(200);
    assert.equal(accepted.body.data.status, "accepted");
    assert.ok(accepted.body.data.conversationId);

    const repeatedMentorship = await request(app).post("/api/mentorship/requests")
      .set("Authorization", `Bearer ${studentSignup.body.data.token}`)
      .send({ mentorId: `mentor-${teacherSignup.body.data.user.id}`, note: "Eyni mentorluğa yenidən müraciət." })
      .expect(409);
    assert.equal(repeatedMentorship.body.error.code, "REQUEST_EXISTS");

    const [studentWorkspace, acceptedMentorWorkspace] = await Promise.all([
      request(app).get("/api/workspace").set("Authorization", `Bearer ${studentSignup.body.data.token}`).expect(200),
      request(app).get("/api/workspace").set("Authorization", teacherAuthorization).expect(200),
    ]);
    const studentMentorship = studentWorkspace.body.data.items.find((item: { id: string }) => item.id === mentorship.body.data.id);
    const teacherMentorship = acceptedMentorWorkspace.body.data.mentorItems.find((item: { id: string }) => item.id === mentorship.body.data.id);
    assert.equal(studentMentorship.chatPeer.id, teacherSignup.body.data.user.id);
    assert.equal(teacherMentorship.chatPeer.id, studentSignup.body.data.user.id);

    await request(app).post(`/api/community/conversations/${accepted.body.data.conversationId}/messages`)
      .set("Authorization", `Bearer ${studentSignup.body.data.token}`)
      .send({ body: "Salam müəllim, mentorluq söhbətimiz aktivdir." }).expect(201);
    await request(app).post(`/api/community/conversations/${accepted.body.data.conversationId}/messages`)
      .set("Authorization", teacherAuthorization)
      .send({ body: "Salam, başlaya bilərik." }).expect(201);
    const mentorshipMessages = await request(app)
      .get(`/api/community/conversations/${accepted.body.data.conversationId}/messages`)
      .set("Authorization", `Bearer ${studentSignup.body.data.token}`).expect(200);
    assert.equal(mentorshipMessages.body.data.length, 2);

    const endedMentorship = await request(app).patch(`/api/workspace/mentorship/${mentorship.body.data.id}`)
      .set("Authorization", teacherAuthorization).send({ status: "cancelled" }).expect(200);
    assert.equal(endedMentorship.body.data.status, "cancelled");
    await request(app).patch(`/api/workspace/mentorship/${mentorship.body.data.id}`)
      .set("Authorization", teacherAuthorization).send({ status: "cancelled" }).expect(404);

    const workspaceAfterEnding = await request(app).get("/api/workspace")
      .set("Authorization", `Bearer ${studentSignup.body.data.token}`).expect(200);
    const endedItem = workspaceAfterEnding.body.data.items.find((item: { id: string }) => item.id === mentorship.body.data.id);
    assert.equal(endedItem, undefined);
    const mentorWorkspaceAfterEnding = await request(app).get("/api/workspace")
      .set("Authorization", teacherAuthorization).expect(200);
    assert.equal(mentorWorkspaceAfterEnding.body.data.mentorItems.some((item: { id: string }) => item.id === mentorship.body.data.id), false);

    await request(app).post("/api/mentorship/requests")
      .set("Authorization", `Bearer ${studentSignup.body.data.token}`)
      .send({ mentorId: `mentor-${teacherSignup.body.data.user.id}`, note: "Yeni dövr üçün yenidən müraciət edirəm." })
      .expect(201);

    await request(app).patch(`/api/admin/users/${teacherSignup.body.data.user.id}`)
      .set("Authorization", adminAuthorization).send({ status: "Məhdudlaşdırılıb" }).expect(200);
    const restrictedCatalog = await request(app).get("/api/teachers").expect(200);
    assert.equal(restrictedCatalog.body.data.some((item: { userId: string }) => item.userId === teacherSignup.body.data.user.id), false);
  });

  it("legacy akademik məlumatlı hesabların sessiya və profil axınını pozmur", async () => {
    const adminAuthorization = `Bearer ${reusableAdminToken}`;
    const created = await request(app)
      .post("/api/admin/users")
      .set("Authorization", adminAuthorization)
      .send({
        name: "Legacy Tələbə",
        email: `legacy.${Date.now()}@example.az`,
        role: "student",
        university: "Köhnə Universitet",
        faculty: "Köhnə fakültə",
      })
      .expect(201);

    const [{ findUserById }, { createAccessToken }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const legacyUser = await findUserById(created.body.data.id as string);
    assert.ok(legacyUser);
    const authorization = `Bearer ${createAccessToken(legacyUser)}`;

    const session = await request(app)
      .get("/api/auth/session")
      .set("Authorization", authorization)
      .expect(200);
    assert.equal(session.body.data.user.university, "Köhnə Universitet");
    assert.equal(session.body.data.user.faculty, "Köhnə fakültə");

    const profile = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", authorization)
      .send({
        name: "Legacy Tələbə",
        university: legacyUser.university,
        faculty: legacyUser.faculty,
        program: legacyUser.program,
        year: legacyUser.year,
        about: "Mövcud akademik məlumatlar dəyişdirilmədən profil yeniləndi.",
      })
      .expect(200);
    assert.equal(profile.body.data.user.about, "Mövcud akademik məlumatlar dəyişdirilmədən profil yeniləndi.");

    await request(app)
      .delete(`/api/admin/users/${legacyUser.id}`)
      .set("Authorization", adminAuthorization)
      .expect(204);
  });

  it("qaralama tədbiri gizlədir və qismən redaktədə məlumatı qoruyur", async()=>{
    const authorization=`Bearer ${reusableAdminToken}`;
    const created=await request(app).post("/api/admin/events").set("Authorization",authorization).send({name:"Qaralama seminar",category:"Technology",organizer:"EduRate",startAt:"2027-01-12T10:00:00+04:00",capacity:30,place:"Kampus",status:"Qaralama"}).expect(201);
    const id=created.body.data.id as string;
    await request(app).get(`/api/events/${id}`).expect(404);
    const after=await request(app).patch(`/api/admin/events/${id}`).set("Authorization",authorization).send({name:"Yenilənmiş qaralama seminar"}).expect(200);
    assert.equal(after.body.data.description,created.body.data.description);
    const publicEvents=await request(app).get("/api/events").expect(200);
    assert.equal(publicEvents.body.data.some((item:{id:string})=>item.id===id),false);

    const [{createUser},{createAccessToken,hashPassword}]=await Promise.all([import("../src/db/database.js"),import("../src/lib/auth.js")]);
    const attendee=await createUser({name:"Qaralama Testi",email:`draft.${Date.now()}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"Mühəndislik fakültəsi",program:"Kompüter mühəndisliyi"});
    await request(app).post(`/api/events/${id}/registrations`).set("Authorization",`Bearer ${createAccessToken(attendee)}`).expect(409);
  });

  it("tədbirin tutumunu mövcud qeydiyyatdan aşağı salmağa icazə vermir", async()=>{
    const authorization=`Bearer ${reusableAdminToken}`;
    const event=await request(app).post("/api/admin/events").set("Authorization",authorization).send({name:"Tutum sınağı",category:"Technology",organizer:"EduRate",startAt:"2027-02-12T10:00:00+04:00",capacity:2,place:"Kampus",status:"Açıq"}).expect(201);
    const [{createUser},{createAccessToken,hashPassword}]=await Promise.all([import("../src/db/database.js"),import("../src/lib/auth.js")]);
    for(const index of [1,2]){
      const attendee=await createUser({name:`İştirakçı ${index}`,email:`capacity.${index}.${Date.now()}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"Mühəndislik fakültəsi",program:"Kompüter mühəndisliyi"});
      await request(app).post(`/api/events/${event.body.data.id}/registrations`).set("Authorization",`Bearer ${createAccessToken(attendee)}`).expect(201);
    }
    const response=await request(app).patch(`/api/admin/events/${event.body.data.id}`).set("Authorization",authorization).send({capacity:1}).expect(409);
    assert.equal(response.body.error.code,"CAPACITY_BELOW_REGISTRATIONS");
  });

  it("iki real hesab arasında əlaqə, qalıcı mesaj və oxunma axınını tamamlayır",async()=>{
    const [{createUser},{createAccessToken,hashPassword}]=await Promise.all([import("../src/db/database.js"),import("../src/lib/auth.js")]);
    const suffix=Date.now();
    const sender=await createUser({name:"Göndərən Test",email:`sender.${suffix}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"İqtisadiyyat fakültəsi",program:"İqtisadiyyat"});
    const peer=await createUser({name:"Mesaj Testi",email:`message.${suffix}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"İqtisadiyyat fakültəsi",program:"Maliyyə"});
    const withdrawnPeer=await createUser({name:"Geri çəkmə Testi",email:`withdraw.${suffix}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"İqtisadiyyat fakültəsi",program:"Menecment"});
    const rejectedPeer=await createUser({name:"Rədd Testi",email:`reject.${suffix}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"İqtisadiyyat fakültəsi",program:"Mühasibat"});
    const studentAuthorization=`Bearer ${createAccessToken(sender)}`;const peerAuthorization=`Bearer ${createAccessToken(peer)}`;
    const withdrawnConnection=await request(app).post("/api/community/connections").set("Authorization",studentAuthorization).send({userId:withdrawnPeer.id}).expect(201);
    await request(app).delete(`/api/community/connections/${withdrawnConnection.body.data.id}`).set("Authorization",studentAuthorization).expect(204);
    const connectionsAfterWithdrawal=await request(app).get("/api/community/connections").set("Authorization",studentAuthorization).expect(200);
    assert.equal(connectionsAfterWithdrawal.body.data.some((item:{id:string})=>item.id===withdrawnConnection.body.data.id),false);
    const rejectedConnection=await request(app).post("/api/community/connections").set("Authorization",`Bearer ${createAccessToken(rejectedPeer)}`).send({userId:sender.id}).expect(201);
    await request(app).delete(`/api/community/connections/${rejectedConnection.body.data.id}`).set("Authorization",studentAuthorization).expect(204);
    const connectionsAfterRejection=await request(app).get("/api/community/connections").set("Authorization",studentAuthorization).expect(200);
    assert.equal(connectionsAfterRejection.body.data.some((item:{id:string})=>item.id===rejectedConnection.body.data.id),false);
    const communityUsers=await request(app).get("/api/community/users").set("Authorization",studentAuthorization).expect(200);
    assert.equal(communityUsers.body.data.some((item:{id:string;name:string})=>item.id===peer.id&&item.name===peer.name),true);
    const connection=await request(app).post("/api/community/connections").set("Authorization",studentAuthorization).send({userId:peer.id}).expect(201);
    await request(app).patch(`/api/community/connections/${connection.body.data.id}`).set("Authorization",peerAuthorization).send({}).expect(200);
    const conversation=await request(app).post("/api/community/conversations").set("Authorization",studentAuthorization).send({peerId:peer.id}).expect(201);
    const id=conversation.body.data.id as string;
    const sent=await request(app).post(`/api/community/conversations/${id}/messages`).set("Authorization",studentAuthorization).send({body:"Salam, layihəni birlikdə yoxlayaq."}).expect(201);
    const report=await request(app).post("/api/community/reports").set("Authorization",peerAuthorization).send({entityType:"message",entityId:sent.body.data.id,reason:"spam",details:"Moderator yoxlaması üçün test şikayəti."}).expect(201);
    const reportQueue=await request(app).get("/api/admin/reports?status=open").set("Authorization",`Bearer ${reusableAdminToken}`).expect(200);
    assert.equal(reportQueue.body.data.some((item:{id:string})=>item.id===report.body.data.id),true);
    await request(app).patch(`/api/admin/reports/${report.body.data.id}`).set("Authorization",`Bearer ${reusableAdminToken}`).send({status:"resolved",resolutionNote:"Məzmun yoxlanıldı və qərar auditə yazıldı."}).expect(200);
    const history=await request(app).get(`/api/community/conversations/${id}/messages`).set("Authorization",peerAuthorization).expect(200);
    assert.equal(history.body.data[0].id,sent.body.data.id);
    // Köhnə mesajların səhifələnməsi: `before` kursorundan əvvəlki mesajlar, xronoloji sırada.
    const second=await request(app).post(`/api/community/conversations/${id}/messages`).set("Authorization",peerAuthorization).send({body:"İkinci mesaj."}).expect(201);
    const third=await request(app).post(`/api/community/conversations/${id}/messages`).set("Authorization",studentAuthorization).send({body:"Üçüncü mesaj."}).expect(201);
    const latestPage=await request(app).get(`/api/community/conversations/${id}/messages?limit=2`).set("Authorization",peerAuthorization).expect(200);
    assert.deepEqual(latestPage.body.data.map((item:{id:string})=>item.id),[second.body.data.id,third.body.data.id]);
    const olderPage=await request(app).get(`/api/community/conversations/${id}/messages?limit=2&before=${second.body.data.id}`).set("Authorization",peerAuthorization).expect(200);
    assert.deepEqual(olderPage.body.data.map((item:{id:string})=>item.id),[sent.body.data.id]);
    await request(app).delete(`/api/community/conversations/${id}/messages/${second.body.data.id}`).set("Authorization",peerAuthorization).expect(204);
    await request(app).delete(`/api/community/conversations/${id}/messages/${third.body.data.id}`).set("Authorization",studentAuthorization).expect(204);
    await request(app).delete(`/api/community/conversations/${id}/messages/${sent.body.data.id}`).set("Authorization",peerAuthorization).expect(404);
    await request(app).delete(`/api/community/conversations/${id}/messages/${sent.body.data.id}`).set("Authorization",studentAuthorization).expect(204);
    const historyAfterDeletion=await request(app).get(`/api/community/conversations/${id}/messages`).set("Authorization",peerAuthorization).expect(200);
    assert.equal(historyAfterDeletion.body.data.length,3);
    assert.equal(historyAfterDeletion.body.data[0].body,"Mesaj silindi");
    assert.equal(historyAfterDeletion.body.data[0].deleted,true);
    await request(app).patch(`/api/community/conversations/${id}/read`).set("Authorization",peerAuthorization).send({}).expect(200);
    await request(app).patch(`/api/community/conversations/${id}/mute`).set("Authorization",studentAuthorization).send({muted:true}).expect(200);
    const mutedDirectory=await request(app).get("/api/community/conversations").set("Authorization",studentAuthorization).expect(200);
    assert.equal(mutedDirectory.body.data.find((item:{id:string})=>item.id===id).muted,true);
    await request(app).patch(`/api/community/conversations/${id}/mute`).set("Authorization",studentAuthorization).send({muted:false}).expect(200);
    const unmutedDirectory=await request(app).get("/api/community/conversations").set("Authorization",studentAuthorization).expect(200);
    assert.equal(unmutedDirectory.body.data.find((item:{id:string})=>item.id===id).muted,false);
    await request(app).post("/api/community/blocks").set("Authorization",studentAuthorization).send({userId:peer.id}).expect(204);
    const directoryAfterBlock=await request(app).get("/api/community/conversations").set("Authorization",studentAuthorization).expect(200);
    assert.equal(directoryAfterBlock.body.data.some((item:{id:string})=>item.id===id),false);
    await request(app).post(`/api/community/conversations/${id}/messages`).set("Authorization",peerAuthorization).send({body:"Bu mesaj blokdan sonra göndərilməməlidir."}).expect(403);
    await request(app).delete(`/api/community/blocks/${sender.id}`).set("Authorization",peerAuthorization).expect(404);
    await request(app).delete(`/api/community/blocks/${peer.id}`).set("Authorization",studentAuthorization).expect(204);
    const linksAfterUnblock=await request(app).get("/api/community/connections").set("Authorization",studentAuthorization).expect(200);
    assert.equal(linksAfterUnblock.body.data.some((item:{requesterId:string;recipientId:string})=>item.requesterId===peer.id||item.recipientId===peer.id),false);
    await request(app).post("/api/community/connections").set("Authorization",studentAuthorization).send({userId:peer.id}).expect(201);
  });

  it("hər klub üçün üzvlərə açıq qrup yaradır və yaradıcını qrup admini edir", async () => {
    const adminAuthorization = `Bearer ${reusableAdminToken}`;
    const suffix = Date.now();
    const club = await request(app).post("/api/admin/clubs").set("Authorization", adminAuthorization).send({
      name: "Qrup Sınaq Klubu", slug: `qrup-sinaq-${suffix}`, category: "Texnologiya", coordinatorInitials: "QS", status: "Aktiv",
    }).expect(201);
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([import("../src/db/database.js"), import("../src/lib/auth.js")]);
    const member = await createUser({ name: "Qrup Üzvü", email: `group.member.${suffix}@example.az`, passwordHash: await hashPassword("Kampus-Yolu-2026"), university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi" });
    const outsider = await createUser({ name: "Kənar İstifadəçi", email: `group.outsider.${suffix}@example.az`, passwordHash: await hashPassword("Kampus-Yolu-2026"), university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Data analitikası" });
    const memberAuthorization = `Bearer ${createAccessToken(member)}`;
    const outsiderAuthorization = `Bearer ${createAccessToken(outsider)}`;

    await request(app).post(`/api/clubs/${club.body.data.id}/memberships`).set("Authorization", memberAuthorization).expect(201);
    const memberGroups = await request(app).get("/api/community/groups").set("Authorization", memberAuthorization).expect(200);
    const group = memberGroups.body.data.find((item: { club: { id: string } }) => item.club.id === club.body.data.id);
    assert.ok(group);
    assert.equal(group.isAdmin, false);
    const adminGroups = await request(app).get("/api/community/groups").set("Authorization", adminAuthorization).expect(200);
    assert.equal(adminGroups.body.data.find((item: { id: string }) => item.id === group.id).isAdmin, true);

    const sent = await request(app).post(`/api/community/conversations/${group.id}/messages`).set("Authorization", memberAuthorization).send({ body: "Klub qrupuna salam!" }).expect(201);
    assert.equal(sent.body.data.senderName, "Qrup Üzvü");
    await request(app).delete(`/api/community/conversations/${group.id}/messages/${sent.body.data.id}`).set("Authorization",adminAuthorization).expect(204);
    await request(app).get(`/api/community/conversations/${group.id}/messages`).set("Authorization", outsiderAuthorization).expect(403);

    await request(app).delete(`/api/clubs/${club.body.data.id}/memberships`).set("Authorization", memberAuthorization).expect(200);
    await request(app).get(`/api/community/conversations/${group.id}/messages`).set("Authorization", memberAuthorization).expect(403);
  });

  it("klub yaradıcısını daimi lider edir, əlavə liderləri idarə edir və klubu silməyə icazə verir",async()=>{
    const suffix=Date.now();
    const [{createUser},{createAccessToken,hashPassword}]=await Promise.all([import("../src/db/database.js"),import("../src/lib/auth.js")]);
    const creator=await createUser({name:"Klub Yaradıcısı",email:`club.creator.${suffix}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"Mühəndislik fakültəsi",program:"Kompüter mühəndisliyi",role:"teacher"});
    const member=await createUser({name:"Lider Namizədi",email:`club.leader.${suffix}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"İqtisadiyyat fakültəsi",program:"Menecment"});
    const creatorAuthorization=`Bearer ${createAccessToken(creator)}`;const memberAuthorization=`Bearer ${createAccessToken(member)}`;
    const created=await request(app).post("/api/clubs").set("Authorization",creatorAuthorization).send({name:"Liderlik Sınaq Klubu",category:"Akademik",tagline:"Birlikdə düzgün klub idarəetməsi qururuq.",about:["Klub liderlik və üzvlük ssenarilərini etibarlı şəkildə yoxlamaq üçün yaradılıb."],meeting:{cadence:"Həftəlik",day:"Cümə",time:"18:00",place:"Kampus"}}).expect(201);
    const clubId=created.body.data.id as string;
    await request(app).patch(`/api/admin/clubs/${clubId}`).set("Authorization",`Bearer ${reusableAdminToken}`).send({status:"Aktiv"}).expect(200);
    await request(app).post(`/api/clubs/${clubId}/memberships`).set("Authorization",memberAuthorization).expect(201);
    let management=await request(app).get(`/api/clubs/${clubId}/members`).set("Authorization",creatorAuthorization).expect(200);
    assert.equal(management.body.data.canDelete,true);
    assert.equal(management.body.data.members.find((item:{id:string})=>item.id===creator.id).role,"leader");
    await request(app).patch(`/api/clubs/${clubId}/leaders/${member.id}`).set("Authorization",creatorAuthorization).expect(200);
    management=await request(app).get(`/api/clubs/${clubId}/members`).set("Authorization",memberAuthorization).expect(200);
    assert.equal(management.body.data.canManage,true);assert.equal(management.body.data.canDelete,false);
    // Klub lideri (yaradıcı olmasa da) başqa üzvü lider təyin edə və geri götürə bilər.
    const member2=await createUser({name:"İkinci Namizəd",email:`club.leader2.${suffix}@example.az`,passwordHash:await hashPassword("Kampus-Yolu-2026"),university:"Qarabağ Universiteti",faculty:"İqtisadiyyat fakültəsi",program:"Menecment"});
    const member2Authorization=`Bearer ${createAccessToken(member2)}`;
    await request(app).post(`/api/clubs/${clubId}/memberships`).set("Authorization",member2Authorization).expect(201);
    await request(app).patch(`/api/clubs/${clubId}/leaders/${member2.id}`).set("Authorization",memberAuthorization).expect(200);
    await request(app).delete(`/api/clubs/${clubId}/leaders/${member2.id}`).set("Authorization",memberAuthorization).expect(200);
    // Tədbir və tarixçə: əvvəl bu sahələrə yazan yol yox idi, tablar həmişə boş qalırdı.
    const eventInput={title:"Açıq debat axşamı",summary:"Yeni üzvlər üçün tanışlıq.",startAt:"2026-10-20T18:30:00+04:00",place:"Kampus, 204-cü otaq",format:"meetup"};
    await request(app).post(`/api/clubs/${clubId}/events`).set("Authorization",member2Authorization).send(eventInput).expect(403);
    await request(app).post(`/api/clubs/${clubId}/events`).send(eventInput).expect(401);
    await request(app).post(`/api/clubs/${clubId}/events`).set("Authorization",memberAuthorization).send({...eventInput,format:"party"}).expect(422);
    await request(app).post(`/api/clubs/${clubId}/events`).set("Authorization",memberAuthorization).send({...eventInput,memberCount:9999}).expect(422);
    const withEvent=await request(app).post(`/api/clubs/${clubId}/events`).set("Authorization",memberAuthorization).send(eventInput).expect(201);
    assert.equal(withEvent.body.data.events.length,1);
    assert.equal(withEvent.body.data.events[0].date,"2026-10-20T14:30:00.000Z");
    const eventId=withEvent.body.data.events[0].id as string;
    const withHistory=await request(app).post(`/api/clubs/${clubId}/history`).set("Authorization",creatorAuthorization).send({year:"2025",title:"Klub yaradıldı",description:"İlk 12 üzv."}).expect(201);
    assert.equal(withHistory.body.data.history[0].title,"Klub yaradıldı");
    await request(app).post(`/api/clubs/${clubId}/history`).set("Authorization",creatorAuthorization).send({year:"25",title:"Yanlış il"}).expect(422);
    const publicView=await request(app).get(`/api/clubs/${clubId}`).expect(200);
    assert.equal(publicView.body.data.events[0].title,"Açıq debat axşamı");
    await request(app).delete(`/api/clubs/${clubId}/events/${eventId}`).set("Authorization",member2Authorization).expect(403);
    const afterDelete=await request(app).delete(`/api/clubs/${clubId}/events/${eventId}`).set("Authorization",memberAuthorization).expect(200);
    assert.equal(afterDelete.body.data.events.length,0);
    await request(app).delete(`/api/clubs/${clubId}/events/${eventId}`).set("Authorization",memberAuthorization).expect(404);
    await request(app).delete(`/api/clubs/${clubId}/history/${withHistory.body.data.history[0].id}`).set("Authorization",creatorAuthorization).expect(200);
    await request(app).delete(`/api/clubs/${clubId}/leaders/${creator.id}`).set("Authorization",creatorAuthorization).expect(409);
    await request(app).delete(`/api/clubs/${clubId}`).set("Authorization",memberAuthorization).expect(403);
    await request(app).delete(`/api/clubs/${clubId}/leaders/${member.id}`).set("Authorization",creatorAuthorization).expect(200);
    await request(app).delete(`/api/clubs/${clubId}`).set("Authorization",creatorAuthorization).expect(204);
  });

  it("elan, lent moderasiyası və dəstək statusunu admin axınında tamamlayır",async()=>{
    const adminAuthorization=`Bearer ${reusableAdminToken}`;
    const signup=await request(app).post("/api/auth/signup").set("X-Forwarded-For","203.0.113.90").send({
      name:"Məzmun Testi",email:`content.${Date.now()}@example.az`,password:"Kampus-Yolu-2026",university:"Qarabağ Universiteti",
      faculty:"Mühəndislik fakültəsi",program:"Kompüter mühəndisliyi",accountType:"student",
    }).expect(201);
    const studentAuthorization=`Bearer ${signup.body.data.token}`;
    const submittedAnnouncement=await request(app).post("/api/network/announcements").set("Authorization",studentAuthorization).send({
      category:"clubs",title:"Açıq klub görüşü",summary:"Yeni üzvlər üçün klub fəaliyyəti barədə məlumat görüşü keçiriləcək.",
      startsAt:"2027-03-01T10:00:00+04:00",expiresAt:"2027-03-20T18:00:00+04:00",
    }).expect(202);
    const submittedQueue=await request(app).get("/api/admin/announcements").set("Authorization",adminAuthorization).expect(200);
    const queuedAnnouncement=submittedQueue.body.data.find((item:{id:string})=>item.id===submittedAnnouncement.body.data.id);
    assert.equal(queuedAnnouncement.status,"draft");
    assert.equal(queuedAnnouncement.source,"Məzmun Testi");
    const announcement=await request(app).post("/api/admin/announcements").set("Authorization",adminAuthorization).send({
      category:"official",title:"Sprint təqdimatı",summary:"Sprint təqdimatı üçün zal və proqram məlumatları yenilənib.",source:"Tələbə İşləri",sourceInitials:"Tİ",tone:"lime",
      startsAt:"2027-03-10T10:00:00+04:00",expiresAt:"2027-03-10T18:00:00+04:00",priority:true,status:"draft",
    }).expect(201);
    let publicAnnouncements=await request(app).get("/api/network/announcements").expect(200);
    assert.equal(publicAnnouncements.body.data.some((item:{id:string})=>item.id===announcement.body.data.id),false);
    await request(app).patch(`/api/admin/announcements/${announcement.body.data.id}`).set("Authorization",adminAuthorization).send({status:"published"}).expect(200);
    publicAnnouncements=await request(app).get("/api/network/announcements").expect(200);
    assert.equal(publicAnnouncements.body.data.some((item:{id:string})=>item.id===announcement.body.data.id),true);
    const reaction=await request(app).patch(`/api/network/announcements/${announcement.body.data.id}/reaction`).set("Authorization",studentAuthorization).send({emoji:"❤️"}).expect(200);
    assert.equal(reaction.body.data.reactions["❤️"],1);
    assert.equal(reaction.body.data.myReaction,"❤️");
    const reactionPeople=await request(app).get(`/api/network/announcements/${announcement.body.data.id}/reactions`).set("Authorization",studentAuthorization).expect(200);
    assert.equal(reactionPeople.body.data.people.length,1);
    assert.equal(reactionPeople.body.data.people[0].name,"Məzmun Testi");
    publicAnnouncements=await request(app).get("/api/network/announcements").set("Authorization",studentAuthorization).expect(200);
    const reactedAnnouncement=publicAnnouncements.body.data.find((item:{id:string})=>item.id===announcement.body.data.id);
    assert.equal(reactedAnnouncement.reactions["❤️"],1);
    assert.equal(reactedAnnouncement.myReaction,"❤️");
    const announcementState=await request(app).patch(`/api/network/announcements/${announcement.body.data.id}/state`).set("Authorization",studentAuthorization).send({read:true,bookmarked:true}).expect(200);
    assert.deepEqual(announcementState.body.data,{read:true,bookmarked:true});
    const announcementAfterState=await request(app).get("/api/network/announcements").set("Authorization",studentAuthorization).expect(200);
    const persistedAnnouncement=announcementAfterState.body.data.find((item:{id:string})=>item.id===announcement.body.data.id);
    assert.equal(persistedAnnouncement.read,true);
    assert.equal(persistedAnnouncement.bookmarked,true);
    const missingAnnouncementState=await request(app).patch("/api/network/announcements/missing-announcement/state").set("Authorization",studentAuthorization).send({read:true}).expect(404);
    assert.equal(missingAnnouncementState.body.error.code,"ANNOUNCEMENT_NOT_FOUND");

    const post=await request(app).post("/api/network/feed").set("Authorization",studentAuthorization).send({title:"Layihə komandası",summary:"Yeni tələbə layihəsi üçün iki komanda yoldaşı axtarılır.",tags:["Komanda"]}).expect(202);
    let publicFeed=await request(app).get("/api/network/feed").expect(200);
    assert.equal(publicFeed.body.data.some((item:{id:string})=>item.id===post.body.data.id),false);
    await request(app).patch(`/api/admin/feed/${post.body.data.id}`).set("Authorization",adminAuthorization).send({status:"published"}).expect(200);
    publicFeed=await request(app).get("/api/network/feed").expect(200);
    assert.equal(publicFeed.body.data.some((item:{id:string})=>item.id===post.body.data.id),true);

    const ticket=await request(app).post("/api/support/tickets").set("Authorization",studentAuthorization).set("X-Forwarded-For","203.0.113.91").send({name:"Dəstək Testi",email:"support@example.az",topic:"Profil",message:"Profil məlumatlarımın yenilənməsi üçün köməyə ehtiyacım var."}).expect(201);
    const tickets=await request(app).get("/api/admin/support-tickets").set("Authorization",adminAuthorization).expect(200);
    const stored=tickets.body.data.find((item:{reference:string})=>item.reference===ticket.body.data.reference);
    assert.ok(stored);
    await request(app).patch(`/api/admin/support-tickets/${stored.id}`).set("Authorization",adminAuthorization).send({status:"resolved"}).expect(200);
    const mine=await request(app).get("/api/support/tickets/me").set("Authorization",studentAuthorization).expect(200);
    assert.equal(mine.body.data.find((item:{id:string})=>item.id===stored.id).status,"resolved");
  });
});

describe("Dərs cədvəli", () => {
  it("qeyd yaradır, hissə-hissə redaktə edir və sahibliyi qoruyur", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const owner = await createUser({ name: "Cədvəl Sahibi", email: "timetable.owner@example.az", passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", role: "student", status: "Aktiv" });
    const other = await createUser({ name: "Cədvəl Yadı", email: "timetable.other@example.az", passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", role: "student", status: "Aktiv" });
    const ownerAuth = `Bearer ${createAccessToken(owner)}`;
    const otherAuth = `Bearer ${createAccessToken(other)}`;

    await request(app).get("/api/timetable").expect(401);

    const created = await request(app).post("/api/timetable").set("Authorization", ownerAuth)
      .send({ subject: "Riyazi analiz", teacher: "Aygün Məmmədova", room: "204", dayOfWeek: 6, startMinute: 840, endMinute: 930, tone: "blue" })
      .expect(201);
    const id = created.body.data.id as string;

    // Reqressiya: `entrySchema.partial()` refinement daşıyan sxemdə atırdı və
    // PATCH hər sorğuda 500 qaytarırdı. Tək sahəli yeniləmə işləməlidir.
    const patched = await request(app).patch(`/api/timetable/${id}`).set("Authorization", ownerAuth)
      .send({ room: "305" }).expect(200);
    assert.equal(patched.body.data.room, "305");
    assert.equal(patched.body.data.startMinute, 840);
    // Hissəvi redaktə qalan sahələri silməməlidir: `.partial()` sahəni optional
    // etsə də `default()` yenə işləyir və müəllim adı ilə rəngi sıfırlayırdı.
    assert.equal(patched.body.data.teacher, "Aygün Məmmədova");
    assert.equal(patched.body.data.tone, "blue");

    // Tək vaxt sahəsi göndəriləndə də nəticə etibarlı qalmalıdır.
    await request(app).patch(`/api/timetable/${id}`).set("Authorization", ownerAuth)
      .send({ startMinute: 1000 }).expect(422);
    await request(app).patch(`/api/timetable/${id}`).set("Authorization", ownerAuth)
      .send({ endMinute: 600 }).expect(422);

    // Bazar günü (7) qəbul olunur — interfeys də yeddi gün göstərir.
    await request(app).post("/api/timetable").set("Authorization", ownerAuth)
      .send({ subject: "Bazar məşğələsi", dayOfWeek: 7, startMinute: 600, endMinute: 700 })
      .expect(201);
    await request(app).post("/api/timetable").set("Authorization", ownerAuth)
      .send({ subject: "Yanlış gün", dayOfWeek: 8, startMinute: 600, endMinute: 700 })
      .expect(422);

    // Başqasının qeydi nə görünür, nə dəyişdirilir, nə də silinir.
    const foreign = await request(app).get("/api/timetable").set("Authorization", otherAuth).expect(200);
    assert.equal(foreign.body.data.length, 0);
    await request(app).patch(`/api/timetable/${id}`).set("Authorization", otherAuth).send({ room: "999" }).expect(404);
    await request(app).delete(`/api/timetable/${id}`).set("Authorization", otherAuth).expect(404);

    await request(app).delete(`/api/timetable/${id}`).set("Authorization", ownerAuth).expect(204);
    await request(app).delete(`/api/timetable/${id}`).set("Authorization", ownerAuth).expect(404);
  });
});

describe("Klub görünürlüyü və silmə səlahiyyəti", () => {
  it("yoxlanışdakı klubu yalnız yaradana və rəhbərliyə göstərir", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const teacher = await createUser({ ...base, name: "Klub Müəllimi", email: "club.teacher@example.az", role: "teacher" });
    const student = await createUser({ ...base, name: "Klub Tələbəsi", email: "club.student@example.az", role: "student" });
    const owner = await createUser({ ...base, name: "Klub Sahibi", email: "club.owner@example.az", role: "owner_admin" });
    const assistant = await createUser({ ...base, name: "Klub Köməkçisi", email: "club.assistant@example.az", role: "assistant_admin" });
    const teacherAuth = `Bearer ${createAccessToken(teacher)}`;
    const studentAuth = `Bearer ${createAccessToken(student)}`;
    const ownerAuth = `Bearer ${createAccessToken(owner)}`;
    const assistantAuth = `Bearer ${createAccessToken(assistant)}`;

    const created = await request(app).post("/api/clubs").set("Authorization", teacherAuth)
      .send({ name: "Yoxlanış Klubu", category: "Texnologiya", tagline: "Yoxlanış üçün yaradılmış klub.", about: ["Bu klub avtomatik testdə yaradılıb."], meeting: { cadence: "Həftəlik", day: "Çərşənbə", time: "18:00", place: "B 204" } })
      .expect(201);
    const slug = created.body.data.slug as string;
    assert.equal(created.body.data.status, "Gözləmədə");

    // Kataloq yalnız təsdiqlənmiş klubları göstərir.
    const catalog = await request(app).get("/api/clubs").expect(200);
    assert.equal(catalog.body.data.some((club: { slug: string }) => club.slug === slug), false);

    // Reqressiya: əvvəl bu səhifə HAMI üçün 404 idi, yəni yaradan öz klubunu
    // heç yerdə aça bilmirdi.
    await request(app).get(`/api/clubs/${slug}`).set("Authorization", teacherAuth).expect(200);
    await request(app).get(`/api/clubs/${slug}`).set("Authorization", ownerAuth).expect(200);
    await request(app).get(`/api/clubs/${slug}`).expect(404);
    await request(app).get(`/api/clubs/${slug}`).set("Authorization", studentAuth).expect(404);

    // Yaradan onu öz üzvlüklərində görür — interfeys "yoxlanışda" blokunu buradan qurur.
    const mine = await request(app).get("/api/clubs/memberships/me").set("Authorization", teacherAuth).expect(200);
    assert.equal(mine.body.data.some((club: { slug: string }) => club.slug === slug), true);

    // Təsdiqlənməmiş kluba qoşulmaq olmur.
    await request(app).post(`/api/clubs/${slug}/memberships`).set("Authorization", studentAuth).expect(404);

    // Reqressiya: silmə yoxlaması yalnız `role === "admin"` idi, yəni ən yüksək
    // rol olan `owner_admin` özünün yaratmadığı klubu silə bilmirdi.
    const seeded = await request(app).post("/api/admin/clubs").set("Authorization", ownerAuth)
      .send({ name: "Silinəcək Klub", slug: "silinecek-klub", category: "Akademik", coordinatorInitials: "SK", status: "Aktiv" })
      .expect(201);
    assert.ok(seeded.body.data);
    await request(app).delete("/api/clubs/silinecek-klub").set("Authorization", studentAuth).expect(403);
    await request(app).delete("/api/clubs/silinecek-klub").set("Authorization", ownerAuth).expect(204);
    // API sənədinə görə admin köməkçisinin klub CRUD səlahiyyəti var (admin marşrutu
    // artıq icazə verirdi) — bu marşrut indi onunla eynidir.
    await request(app).post("/api/admin/clubs").set("Authorization", ownerAuth)
      .send({ name: "Köməkçinin Sildiyi Klub", slug: "komekci-klub", category: "Akademik", coordinatorInitials: "KK", status: "Aktiv" })
      .expect(201);
    await request(app).delete("/api/clubs/komekci-klub").set("Authorization", assistantAuth).expect(204);
  });
});

describe("Kampus sualları", () => {
  it("sualı və cavabı müəllif ilə moderator silə bilir, başqası yox", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const asker = await createUser({ ...base, name: "Sual Verən", email: "questions.asker@example.az", role: "student" });
    const replier = await createUser({ ...base, name: "Cavab Yazan", email: "questions.replier@example.az", role: "student" });
    const assistant = await createUser({ ...base, name: "Sual Moderatoru", email: "questions.assistant@example.az", role: "assistant_admin" });
    const askerAuth = `Bearer ${createAccessToken(asker)}`;
    const replierAuth = `Bearer ${createAccessToken(replier)}`;
    const assistantAuth = `Bearer ${createAccessToken(assistant)}`;

    const created = await request(app).post("/api/questions").set("Authorization", askerAuth)
      .send({ title: "Kitabxana həftəsonu açıqdır?", topic: "kampus" }).expect(201);
    const id = created.body.data.id as string;

    // Suallar anonimdir: siyahıda müəllifə aid heç bir sahə yoxdur.
    const listed = await request(app).get("/api/questions").set("Authorization", replierAuth).expect(200);
    const item = listed.body.data.find((question: { id: string }) => question.id === id);
    assert.deepEqual(Object.keys(item).sort(), ["answerCount", "body", "createdAt", "id", "mine", "title", "topic", "voteCount", "voted"]);
    assert.equal(item.mine, false);

    await request(app).post(`/api/questions/${id}/answers`).set("Authorization", replierAuth)
      .send({ body: "Şənbə 18:00-a qədər." }).expect(201);
    await request(app).post(`/api/questions/${id}/answers`).set("Authorization", replierAuth)
      .send({ body: "Bazar bağlıdır." }).expect(201);
    const answers = await request(app).get(`/api/questions/${id}/answers`).set("Authorization", replierAuth).expect(200);
    const [first, second] = answers.body.data as Array<{ id: string; mine: boolean }>;
    assert.equal(first.mine, true);

    // Reqressiya: cavabı silmək üçün heç bir endpoint yox idi.
    await request(app).delete(`/api/questions/${id}/answers/${first.id}`).expect(401);
    await request(app).delete(`/api/questions/${id}/answers/${first.id}`).set("Authorization", askerAuth).expect(404);
    await request(app).delete(`/api/questions/${id}/answers/${first.id}`).set("Authorization", replierAuth).expect(204);
    await request(app).delete(`/api/questions/${id}/answers/${first.id}`).set("Authorization", replierAuth).expect(404);
    await request(app).delete(`/api/questions/${id}/answers/${second.id}`).set("Authorization", assistantAuth).expect(204);
    const after = await request(app).get(`/api/questions/${id}/answers`).expect(200);
    assert.equal(after.body.data.length, 0);
    const recount = await request(app).get("/api/questions").expect(200);
    assert.equal(recount.body.data.find((question: { id: string }) => question.id === id).answerCount, 0);

    // Başqası sualı silə bilmir; moderator silə bilir (interfeys bunu D6-da göstərmirdi).
    await request(app).delete(`/api/questions/${id}`).set("Authorization", replierAuth).expect(404);
    await request(app).delete(`/api/questions/${id}`).set("Authorization", assistantAuth).expect(204);
    await request(app).post(`/api/questions/${id}/vote`).set("Authorization", replierAuth).expect(404);
  });
});

describe("Mentorluq müraciəti", () => {
  it("yalnız tələbə müraciət edir, mentor qeydi görür, müraciət geri çəkilir", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const student = await createUser({ ...base, name: "Mentorluq Tələbəsi", email: "mentorship.student@example.az", role: "student" });
    const mentor = await createUser({ ...base, name: "Mentorluq Mentoru", email: "mentorship.mentor@example.az", role: "mentor" });
    const teacher = await createUser({ ...base, name: "Mentorluq Müəllimi", email: "mentorship.teacher@example.az", role: "teacher" });
    const studentAuth = `Bearer ${createAccessToken(student)}`;
    const mentorAuth = `Bearer ${createAccessToken(mentor)}`;
    const teacherAuth = `Bearer ${createAccessToken(teacher)}`;

    // Mentor profili panel açılanda yaradılır (real saytda qeydiyyatda).
    await request(app).get("/api/workspace").set("Authorization", mentorAuth).expect(200);
    const catalog = await request(app).get("/api/mentors").expect(200);
    const profile = catalog.body.data.find((item: { userId: string | null }) => item.userId === mentor.id);
    assert.ok(profile);

    // D9: tələbədən başqa rollar müraciət edə bilmir — mentor özünə də.
    await request(app).post("/api/mentorship/requests").set("Authorization", mentorAuth)
      .send({ mentorId: profile.id }).expect(403);
    await request(app).post("/api/mentorship/requests").set("Authorization", teacherAuth)
      .send({ mentorId: profile.id }).expect(403);
    await request(app).post("/api/mentorship/requests").set("Authorization", `Bearer ${reusableAdminToken}`)
      .send({ mentorId: profile.id }).expect(403);

    const created = await request(app).post("/api/mentorship/requests").set("Authorization", studentAuth)
      .send({ mentorId: profile.id, note: "Portfel hazırlamaqda kömək lazımdır." }).expect(201);
    // İnterfeys müraciəti kataloqdakı profilə `mentorProfileId` ilə bağlayır.
    assert.equal(created.body.data.mentorProfileId, profile.profileId);
    await request(app).post("/api/mentorship/requests").set("Authorization", studentAuth)
      .send({ mentorId: profile.id }).expect(409);

    // Reqressiya: mentor panelində tələbənin qeydi görünmürdü.
    const workspace = await request(app).get("/api/workspace").set("Authorization", mentorAuth).expect(200);
    const item = workspace.body.data.items.find((entry: { id: string }) => entry.id === created.body.data.id);
    assert.equal(item.text, "Portfel hazırlamaqda kömək lazımdır.");
    assert.equal(item.userId, undefined);

    // Gözləyən müraciəti yalnız sahibi geri çəkə bilir.
    await request(app).delete(`/api/mentorship/requests/${created.body.data.id}`).set("Authorization", mentorAuth).expect(404);
    await request(app).delete(`/api/mentorship/requests/${created.body.data.id}`).set("Authorization", studentAuth).expect(204);
    const after = await request(app).get("/api/workspace").set("Authorization", mentorAuth).expect(200);
    assert.equal(after.body.data.items.some((entry: { id: string }) => entry.id === created.body.data.id), false);
  });
});

describe("Dəstək müraciəti", () => {
  it("daxil olmuş istifadəçinin müraciəti hesaba bağlanır, vaxtı bitmiş tokenlə isə bağlanmadığını bildirir", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const student = await createUser({ name: "Dəstək Tələbəsi", email: "support.linked@example.az", passwordHash: await hashPassword("Kampus-Yolu-2026"), university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", role: "student", status: "Aktiv" });
    const auth = `Bearer ${createAccessToken(student)}`;
    const body = { name: "Formadakı Ad", email: "formada@example.az", topic: "Hesab dəstəyi", message: "Hesabımla bağlı sualım var, kömək edin zəhmət olmasa." };

    const linked = await request(app).post("/api/support/tickets").set("Authorization", auth).set("X-Forwarded-For", "203.0.113.120").send(body).expect(201);
    assert.equal(linked.body.data.linked, true);
    const mine = await request(app).get("/api/support/tickets/me").set("Authorization", auth).expect(200);
    const stored = mine.body.data.find((item: { reference: string }) => item.reference === linked.body.data.reference);
    // Formada nə yazılsa da cavab hesab e-poçtuna gedir — interfeys bunu göstərməlidir.
    assert.equal(stored.email, "support.linked@example.az");

    // Etibarsız token səssizcə anonimə çevrilir; cavab bunu bildirməlidir.
    const unlinked = await request(app).post("/api/support/tickets").set("Authorization", "Bearer yanlis.token.deyeri").set("X-Forwarded-For", "203.0.113.121").send(body).expect(201);
    assert.equal(unlinked.body.data.linked, false);
    const after = await request(app).get("/api/support/tickets/me").set("Authorization", auth).expect(200);
    assert.equal(after.body.data.some((item: { reference: string }) => item.reference === unlinked.body.data.reference), false);
  });
});

describe("Hesabın silinməsi", () => {
  it("öz hesabını silən mentor kataloqdan çıxır və ona müraciət getmir", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const mentor = await createUser({ ...base, name: "Silinəcək Mentor", email: "deleted.mentor@example.az", role: "mentor" });
    const student = await createUser({ ...base, name: "Kataloq Tələbəsi", email: "catalog.student@example.az", role: "student" });
    const mentorAuth = `Bearer ${createAccessToken(mentor)}`;
    const studentAuth = `Bearer ${createAccessToken(student)}`;

    await request(app).get("/api/workspace").set("Authorization", mentorAuth).expect(200);
    const before = await request(app).get("/api/mentors").expect(200);
    const profile = before.body.data.find((item: { userId: string | null }) => item.userId === mentor.id);
    assert.ok(profile);

    await request(app).delete("/api/auth/account").set("Authorization", mentorAuth).send({ password: "yanlis-parol-1" }).expect(401);
    await request(app).delete("/api/auth/account").set("Authorization", mentorAuth).send({ password: "Kampus-Yolu-2026" }).expect(204);

    // Reqressiya: profil real adla kataloqda qalırdı və müraciət 201 alırdı.
    const after = await request(app).get("/api/mentors").expect(200);
    assert.equal(after.body.data.some((item: { id: string }) => item.id === profile.id), false);
    await request(app).post("/api/mentorship/requests").set("Authorization", studentAuth).send({ mentorId: profile.id }).expect(404);

    // Administrator hesabı bu yolla silinmir.
    const denied = await request(app).delete("/api/auth/account").set("Authorization", `Bearer ${reusableAdminToken}`).send({ password: "Kampus-Yolu-2026" }).expect(409);
    assert.equal(denied.body.error.code, "ADMIN_SELF_DELETE_FORBIDDEN");
  });
});

describe("İş paneli", () => {
  it("mentor gözləyən müraciəti görür, məlumatlarını redaktə edir; müəllim yalnız təsdiqlənmiş rəyləri görür", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const mentor = await createUser({ ...base, name: "Panel Mentoru", email: "workspace.mentor@example.az", role: "mentor" });
    const mentorAuth = `Bearer ${createAccessToken(mentor)}`;
    await request(app).get("/api/workspace").set("Authorization", mentorAuth).expect(200);
    const catalog = await request(app).get("/api/mentors").expect(200);
    const profile = catalog.body.data.find((item: { userId: string | null }) => item.userId === mentor.id);
    // Yer tutucu "haqqında" cümləsi mentor bio-su kimi köçürülmür.
    assert.equal(profile.biography, "");

    // Ən köhnə müraciət gözləyir, sonra 13 müraciət rədd edilir.
    const students = [];
    for (let index = 0; index < 14; index += 1) {
      const student = await createUser({ ...base, name: `Panel Tələbəsi ${index}`, email: `workspace.student${index}@example.az`, role: "student" });
      students.push(`Bearer ${createAccessToken(student)}`);
    }
    const oldest = await request(app).post("/api/mentorship/requests").set("Authorization", students[0]).send({ mentorId: profile.id }).expect(201);
    for (const auth of students.slice(1)) {
      const created = await request(app).post("/api/mentorship/requests").set("Authorization", auth).send({ mentorId: profile.id }).expect(201);
      await request(app).patch(`/api/workspace/mentorship/${created.body.data.id}`).set("Authorization", mentorAuth).send({ status: "rejected" }).expect(200);
    }
    const queue = await request(app).get("/api/workspace").set("Authorization", mentorAuth).expect(200);
    // Reqressiya: siyahı 12-yə kəsilirdi və köhnə gözləyən müraciət görünmürdü.
    assert.equal(queue.body.data.items.some((item: { id: string }) => item.id === oldest.body.data.id), true);

    // Mentor praktik məlumatlarını redaktə edir; kataloqda görünür.
    await request(app).patch("/api/workspace/mentor-profile").set("Authorization", mentorAuth)
      .send({ availability: "Həftəiçi 18:00-dan sonra", meetingMode: "Hibrid", languages: ["Azərbaycan dili", "İngilis dili"], experienceYears: 4 }).expect(200);
    const after = await request(app).get("/api/mentors").expect(200);
    const edited = after.body.data.find((item: { id: string }) => item.id === profile.id);
    assert.equal(edited.availability, "Həftəiçi 18:00-dan sonra");
    assert.deepEqual(edited.languages, ["Azərbaycan dili", "İngilis dili"]);
    assert.equal(edited.experienceYears, 4);
    await request(app).patch("/api/workspace/mentor-profile").set("Authorization", students[0])
      .send({ availability: "x", meetingMode: "Onlayn", languages: ["Azərbaycan dili"], experienceYears: 1 }).expect(403);
    await request(app).patch("/api/workspace/mentor-profile").set("Authorization", mentorAuth)
      .send({ availability: "x", meetingMode: "Onlayn", languages: [], experienceYears: 1 }).expect(422);

    // Müəllim: gözləyən rəy sayılır, amma siyahıda yalnız təsdiqlənmiş rəy var.
    const teacher = await createUser({ ...base, name: "Panel Müəllimi", email: "workspace.teacher@example.az", role: "teacher" });
    const teacherAuth = `Bearer ${createAccessToken(teacher)}`;
    await request(app).get("/api/workspace").set("Authorization", teacherAuth).expect(200);
    const teachers = await request(app).get("/api/teachers").expect(200);
    const teacherProfile = teachers.body.data.find((item: { userId: string | null }) => item.userId === teacher.id);
    const review = await request(app).post("/api/reviews").set("Authorization", students[1])
      .send({ teacherId: teacherProfile.id, course: "Riyazi analiz", semester: "2026-payız", criteria: { clarity: 5, subjectKnowledge: 4, objectivity: 4, communication: 5 } })
      .expect(201);
    const pendingView = await request(app).get("/api/workspace").set("Authorization", teacherAuth).expect(200);
    assert.equal(pendingView.body.data.metrics.find((metric: { label: string }) => metric.label === "Gözləyən rəy").value, 1);
    assert.equal(pendingView.body.data.items.length, 0);
    await request(app).patch(`/api/admin/reviews/${review.body.data.id}`).set("Authorization", `Bearer ${reusableAdminToken}`).send({ status: "approved" }).expect(200);
    const approvedView = await request(app).get("/api/workspace").set("Authorization", teacherAuth).expect(200);
    assert.equal(approvedView.body.data.items.length, 1);
    assert.equal(approvedView.body.data.items[0].course, "Riyazi analiz");
    assert.equal(approvedView.body.data.items[0].userId, undefined);
  });
});

describe("Şikayətlər", () => {
  it("admin şikayət edilən profili və klubu adı ilə görür", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const reporter = await createUser({ ...base, name: "Şikayətçi Tələbə", email: "report.reporter@example.az", role: "student" });
    const reported = await createUser({ ...base, name: "Şikayət Edilən", email: "report.target@example.az", role: "student" });
    const reporterAuth = `Bearer ${createAccessToken(reporter)}`;
    const ownerAuth = `Bearer ${reusableAdminToken}`;
    await request(app).post("/api/admin/clubs").set("Authorization", ownerAuth)
      .send({ name: "Şikayət Klubu", slug: "sikayet-klubu", category: "Akademik", coordinatorInitials: "ŞK", status: "Aktiv" })
      .expect(201);

    await request(app).post("/api/community/reports").send({ entityType: "profile", entityId: reported.id, reason: "spam" }).expect(401);
    await request(app).post("/api/community/reports").set("Authorization", reporterAuth)
      .send({ entityType: "profile", entityId: reported.id, reason: "spam", details: "Eyni reklamı hər kəsə göndərir." }).expect(201);
    await request(app).post("/api/community/reports").set("Authorization", reporterAuth)
      .send({ entityType: "club", entityId: "sikayet-klubu", reason: "fake_profile" }).expect(201);
    await request(app).post("/api/community/reports").set("Authorization", reporterAuth)
      .send({ entityType: "profile", entityId: "yoxdur-bele-biri", reason: "other" }).expect(201);
    await request(app).post("/api/community/reports").set("Authorization", reporterAuth)
      .send({ entityType: "profile", entityId: reported.id, reason: "yanlis" }).expect(422);

    const list = await request(app).get("/api/admin/reports").set("Authorization", ownerAuth).expect(200);
    type Report = { entityType: string; entityId: string; reason: string; details: string; target: { label: string; detail?: string; href?: string } | null };
    const reports = list.body.data as Report[];
    const profile = reports.find((item) => item.entityId === reported.id);
    assert.equal(profile?.reason, "spam");
    assert.equal(profile?.details, "Eyni reklamı hər kəsə göndərir.");
    assert.deepEqual(profile?.target, { label: "Şikayət Edilən", detail: "report.target@example.az" });
    const club = reports.find((item) => item.entityType === "club" && item.entityId === "sikayet-klubu");
    assert.equal(club?.target?.href, "/clubs/sikayet-klubu");
    assert.equal(reports.find((item) => item.entityId === "yoxdur-bele-biri")?.target, null);
  });
});

describe("Göndərilənlərin taleyi", () => {
  it("müəllim öz tədbirinin, müəllif öz elanı və paylaşımının vəziyyətini görür", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const teacher = await createUser({ ...base, name: "Tale Müəllim", email: "tale.teacher@example.az", role: "teacher" });
    const other = await createUser({ ...base, name: "Digər Müəllim", email: "tale.other@example.az", role: "teacher" });
    const teacherAuth = `Bearer ${createAccessToken(teacher)}`;
    const otherAuth = `Bearer ${createAccessToken(other)}`;
    const ownerAuth = `Bearer ${reusableAdminToken}`;

    await request(app).get("/api/events/mine").expect(401);
    const start = Date.now() + 10 * 86_400_000;
    const created = await request(app).post("/api/events").set("Authorization", teacherAuth).send({
      title: "Tale tədbiri", category: "Technology", description: "Qısa təsvir mətni", longDescription: "Ətraflı məlumat mətni burada yazılıb",
      location: "Zal 4", city: "Xankəndi", organizer: "Tale Müəllim", startAt: new Date(start).toISOString(),
      endAt: new Date(start + 7_200_000).toISOString(), registrationDeadline: new Date(start - 3_600_000).toISOString(), capacity: 30,
    }).expect(201);
    const mine = await request(app).get("/api/events/mine").set("Authorization", teacherAuth).expect(200);
    assert.deepEqual(mine.body.data.map((item: { id: string; status: string }) => [item.id, item.status]), [[created.body.data.id, "Qaralama"]]);
    // Başqa müəllim onu görmür; "mine" tədbir id-si kimi tutulmur.
    assert.equal((await request(app).get("/api/events/mine").set("Authorization", otherAuth).expect(200)).body.data.length, 0);
    await request(app).patch(`/api/admin/events/${created.body.data.id}`).set("Authorization", ownerAuth).send({ status: "Açıq" }).expect(200);
    assert.equal((await request(app).get("/api/events/mine").set("Authorization", teacherAuth).expect(200)).body.data[0].status, "Açıq");

    const now = Date.now();
    const announcement = await request(app).post("/api/network/announcements").set("Authorization", teacherAuth).send({
      category: "faculties", title: "Tale elanı", summary: "Fakültə üzrə yeni cədvəl dərc olunub.",
      startsAt: new Date(now).toISOString(), expiresAt: new Date(now + 86_400_000).toISOString(),
    }).expect(202);
    const myAnnouncements = await request(app).get("/api/network/announcements/mine").set("Authorization", teacherAuth).expect(200);
    assert.deepEqual(myAnnouncements.body.data.map((item: { id: string; status: string }) => [item.id, item.status]), [[announcement.body.data.id, "draft"]]);

    const post = await request(app).post("/api/network/feed").set("Authorization", teacherAuth).send({ title: "Tale paylaşımı", summary: "Kitabxana şənbə günü də açıqdır.", tags: [] }).expect(202);
    await request(app).patch(`/api/admin/feed/${post.body.data.id}`).set("Authorization", ownerAuth).send({ status: "rejected" }).expect(200);
    const myPosts = await request(app).get("/api/network/feed/mine").set("Authorization", teacherAuth).expect(200);
    assert.deepEqual(myPosts.body.data.map((item: { id: string; status: string }) => [item.id, item.status]), [[post.body.data.id, "rejected"]]);
    assert.equal((await request(app).get("/api/network/feed/mine").set("Authorization", otherAuth).expect(200)).body.data.length, 0);
    await request(app).get("/api/network/feed/mine").expect(401);
  });
});

describe("Admin paneli", () => {
  it("icmal qaralama tədbirini açıq saymır, axtarış e-poçtu da tapır", async () => {
    const ownerAuth = `Bearer ${reusableAdminToken}`;
    const readEvents = async () => {
      const overview = await request(app).get("/api/admin/overview").set("Authorization", ownerAuth).expect(200);
      return overview.body.data.metrics.find((metric: { id: string }) => metric.id === "events").counts;
    };
    const before = await readEvents();
    const startAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const draft = { name: "İcmal qaralaması", category: "Technology", organizer: "QA", startAt, capacity: 20, place: "Zal 1" };
    await request(app).post("/api/admin/events").set("Authorization", ownerAuth).send({ ...draft, status: "Qaralama" }).expect(201);
    const afterDraft = await readEvents();
    // Reqressiya: qaralama "Açıq tədbir" sayına düşürdü.
    assert.equal(afterDraft.value, before.value);
    assert.equal(afterDraft.pending, before.pending + 1);
    assert.equal(afterDraft.total, before.total + 1);
    await request(app).post("/api/admin/events").set("Authorization", ownerAuth).send({ ...draft, name: "İcmal açıq tədbiri", status: "Açıq" }).expect(201);
    assert.equal((await readEvents()).value, before.value + 1);

    const { createUser } = await import("../src/db/database.js");
    const target = await createUser({ passwordHash: "x", name: "Axtarış Hədəfi", email: "unikal.axtaris@example.az", role: "student", university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" });
    const found = await request(app).get("/api/admin/users?search=unikal.axtaris").set("Authorization", ownerAuth).expect(200);
    assert.deepEqual(found.body.data.items.map((item: { id: string }) => item.id), [target.id]);
  });

  it("adi admin rol yüksəldə və administrator hesabını dəyişə bilmir (D3); elanın prioriteti dərcdə qalır", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const admin = await createUser({ ...base, name: "Adi Admin", email: "d3.admin@example.az", role: "admin" });
    const otherAdmin = await createUser({ ...base, name: "Digər Admin", email: "d3.other@example.az", role: "admin" });
    const assistant = await createUser({ ...base, name: "D3 Köməkçi", email: "d3.assistant@example.az", role: "assistant_admin" });
    const student = await createUser({ ...base, name: "D3 Tələbə", email: "d3.student@example.az", role: "student" });
    const adminAuth = `Bearer ${createAccessToken(admin)}`;
    const ownerAuth = `Bearer ${reusableAdminToken}`;

    // Reqressiya D3: adi admin tələbəni admin / admin köməkçisi edirdi.
    const escalation = await request(app).patch(`/api/admin/users/${student.id}`).set("Authorization", adminAuth).send({ role: "admin" }).expect(403);
    assert.equal(escalation.body.error.code, "ROLE_ESCALATION_FORBIDDEN");
    await request(app).patch(`/api/admin/users/${student.id}`).set("Authorization", adminAuth).send({ role: "assistant_admin" }).expect(403);
    // Reqressiya D4 (backend tərəfi): başqa admini tələbəyə endirmək və ya məhdudlaşdırmaq.
    const demotion = await request(app).patch(`/api/admin/users/${otherAdmin.id}`).set("Authorization", adminAuth).send({ role: "student" }).expect(403);
    assert.equal(demotion.body.error.code, "PRIVILEGED_USER_MODIFICATION_FORBIDDEN");
    await request(app).patch(`/api/admin/users/${assistant.id}`).set("Authorization", adminAuth).send({ status: "Məhdudlaşdırılıb" }).expect(403);
    // Adi istifadəçi ilə işləmək olar.
    const renamed = await request(app).patch(`/api/admin/users/${student.id}`).set("Authorization", adminAuth).send({ name: "D3 Tələbə Yeni", role: "teacher" }).expect(200);
    assert.equal(renamed.body.data.role, "teacher");
    // Platforma sahibi administrator rolu verə bilir.
    await request(app).patch(`/api/admin/users/${student.id}`).set("Authorization", ownerAuth).send({ role: "assistant_admin" }).expect(200);
    // Cədvəldə sabit "Real hesab" yox, real e-poçt vəziyyəti.
    const users = await request(app).get("/api/admin/users?pageSize=100").set("Authorization", ownerAuth).expect(200);
    const row = users.body.data.items.find((item: { id: string }) => item.id === student.id);
    assert.equal(typeof row.emailVerified, "boolean");
    assert.notEqual(row.metric, "Real hesab");

    // Reqressiya: "Yayımla" (yalnız status) prioriteti sıfırlayırdı, yalnız başlıq
    // dəyişən PATCH isə elanı qaralamaya qaytarırdı.
    const now = Date.now();
    const created = await request(app).post("/api/admin/announcements").set("Authorization", ownerAuth).send({
      category: "official", title: "Prioritetli elan", summary: "İmtahan cədvəli dəyişib, yeni saatlara baxın.",
      source: "Tədris şöbəsi", sourceInitials: "TŞ", tone: "lime",
      startsAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 86_400_000).toISOString(), priority: true,
    }).expect(201);
    const id = created.body.data.id as string;
    const published = await request(app).patch(`/api/admin/announcements/${id}`).set("Authorization", ownerAuth).send({ status: "published" }).expect(200);
    assert.equal(published.body.data.priority, true);
    assert.equal(published.body.data.status, "published");
    const retitled = await request(app).patch(`/api/admin/announcements/${id}`).set("Authorization", ownerAuth).send({ title: "Prioritetli elan (yenilənib)" }).expect(200);
    assert.equal(retitled.body.data.status, "published");
    assert.equal(retitled.body.data.priority, true);
  });
});

describe("Giriş təhlükəsizliyi: şifrə siyasəti, hesab limiti, 2FA", () => {
  const strongPassword = "Kampus-Yolu-2026";
  let ipCounter = 10;
  const nextIp = () => `198.51.100.${(ipCounter += 1)}`;

  async function makeUser(email: string, role: "student" | "owner_admin" = "student") {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([import("../src/db/database.js"), import("../src/lib/auth.js")]);
    const user = await createUser({ name: "Təhlükəsizlik Testi", email, passwordHash: await hashPassword(strongPassword), university: "Qarabağ Universiteti", faculty: "Pedaqoji fakültə", program: "Riyaziyyat müəllimliyi", role, status: "Aktiv" });
    return { user, auth: `Bearer ${createAccessToken(user)}` };
  }

  it("TOTP RFC 6238 test vektorlarını verir", async () => {
    const { base32Encode, totpCode } = await import("../src/lib/totp.js");
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    for (const [time, code] of [[59, "287082"], [1111111109, "081804"], [1234567890, "005924"], [2000000000, "279037"]] as const) {
      assert.equal(totpCode(secret, Math.floor(time / 30)), code);
    }
  });

  it("zəif şifrəni qəbul etmir, güclüsünü qəbul edir", async () => {
    const { findPasswordProblem } = await import("../src/lib/password-policy.js");
    assert.equal(findPasswordProblem("Parol123"), "tooShort");
    assert.equal(findPasswordProblem("password1234"), "common");
    assert.equal(findPasswordProblem("Qwerty123456"), "common");
    assert.equal(findPasswordProblem("EduRate2026"), "common");
    assert.equal(findPasswordProblem("1q2w3e4r5t"), "common");
    assert.equal(findPasswordProblem("Resulov2026x", { name: "Resul Resulov" }), "personal");
    assert.equal(findPasswordProblem("nigar.q2026a", { email: "nigar.q@example.az" }), "personal");
    assert.equal(findPasswordProblem("abab1212ab"), "repetitive");
    assert.equal(findPasswordProblem("abcdefgh12"), "common");
    assert.equal(findPasswordProblem(`${"ş".repeat(36)}1`), "tooLong");
    assert.equal(findPasswordProblem(strongPassword), null);

    const weak = await request(app).post("/api/auth/signup").set("X-Forwarded-For", nextIp()).send({
      name: "Zəif Şifrə", email: "weak.password@example.az", password: "password1234",
      university: "Qarabağ Universiteti", faculty: "Pedaqoji fakültə", program: "Riyaziyyat müəllimliyi",
    }).expect(422);
    assert.equal(weak.body.error.code, "WEAK_PASSWORD");
    assert.equal(weak.body.error.details.reason, "common");
  });

  it("IP dəyişsə də hesab üzrə 10 uğursuz girişdən sonra kilidləyir", async () => {
    await makeUser("throttle.login@example.az");
    for (let attempt = 1; attempt <= 9; attempt += 1) {
      await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: "throttle.login@example.az", password: "yanlis-parol-1" }).expect(401);
    }
    const locked = await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: "throttle.login@example.az", password: "yanlis-parol-1" }).expect(429);
    assert.equal(locked.body.error.code, "ACCOUNT_THROTTLED");
    // Düzgün şifrə də kilid bitənə qədər qəbul edilmir.
    await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: "throttle.login@example.az", password: strongPassword }).expect(429);
    // Mövcud olmayan hesab da eyni cavabı alır (hesabın varlığı açılmır).
    for (let attempt = 1; attempt <= 9; attempt += 1) {
      await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: "yoxdur.hesab@example.az", password: "yanlis-parol-1" }).expect(401);
    }
    await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: "yoxdur.hesab@example.az", password: "yanlis-parol-1" }).expect(429);
  });

  it("6 rəqəmli bərpa kodunu hesab üzrə 5 səhvdən sonra kilidləyir", async () => {
    await makeUser("throttle.reset@example.az");
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await request(app).post("/api/auth/password/verify-code").set("X-Forwarded-For", nextIp()).send({ email: "throttle.reset@example.az", code: "000000" }).expect(422);
    }
    const locked = await request(app).post("/api/auth/password/verify-code").set("X-Forwarded-For", nextIp()).send({ email: "throttle.reset@example.az", code: "000000" }).expect(429);
    assert.equal(locked.body.error.code, "ACCOUNT_THROTTLED");
  });

  it("2FA: quraşdırma, kodla giriş, təkrar koda qadağa, bərpa kodu, admin tələbi", async () => {
    const { totpCode, currentTotpStep } = await import("../src/lib/totp.js");
    const { env } = await import("../src/config/env.js");
    const { user, auth } = await makeUser("twofactor.owner@example.az", "owner_admin");

    // Şifrəsiz quraşdırma olmur.
    await request(app).post("/api/auth/2fa/setup").set("Authorization", auth).send({ password: "yanlis-parol-1" }).expect(401);
    const setup = await request(app).post("/api/auth/2fa/setup").set("Authorization", auth).send({ password: strongPassword }).expect(200);
    const secret = setup.body.data.secret as string;
    assert.match(setup.body.data.otpauthUrl, /^otpauth:\/\/totp\/EduRate%3Atwofactor\.owner%40example\.az\?secret=/);

    // Təsdiqlənməmiş 2FA girişə təsir etmir.
    const beforeEnable = await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: user.email, password: strongPassword }).expect(200);
    assert.ok(beforeEnable.body.data.token);
    assert.equal(beforeEnable.body.data.user.twoFactorEnabled, false);

    const wrongCode = totpCode(secret, currentTotpStep()) === "000000" ? "111111" : "000000";
    await request(app).post("/api/auth/2fa/enable").set("Authorization", auth).send({ code: wrongCode }).expect(422);
    const enableCode = totpCode(secret, currentTotpStep());
    const enabled = await request(app).post("/api/auth/2fa/enable").set("Authorization", auth).send({ code: enableCode }).expect(200);
    const recoveryCodes = enabled.body.data.recoveryCodes as string[];
    assert.equal(recoveryCodes.length, 10);
    // Sirr yenidən alına bilməz.
    await request(app).post("/api/auth/2fa/setup").set("Authorization", auth).send({ password: strongPassword }).expect(409);

    // Şifrə düzgün → sessiya YOX, yalnız bilet.
    const step1 = await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: user.email, password: strongPassword }).expect(200);
    assert.equal(step1.body.data.twoFactorRequired, true);
    assert.equal(step1.body.data.token, undefined);
    const challenge = step1.body.data.challenge as string;

    // Aktivləşdirmədə işlənən kod ikinci dəfə keçmir (təkrar hücum).
    const replay = await request(app).post("/api/auth/login/2fa").set("X-Forwarded-For", nextIp()).send({ challenge, code: enableCode }).expect(401);
    assert.equal(replay.body.error.code, "TWO_FACTOR_INVALID");

    // Bərpa kodu ilə giriş; eyni bərpa kodu ikinci dəfə keçmir.
    const viaRecovery = await request(app).post("/api/auth/login/2fa").set("X-Forwarded-For", nextIp()).send({ challenge, code: recoveryCodes[0].toUpperCase() }).expect(200);
    assert.ok(viaRecovery.body.data.token);
    assert.equal(viaRecovery.body.data.recoveryCodeUsed, true);
    assert.equal(viaRecovery.body.data.recoveryCodesRemaining, 9);
    assert.equal(viaRecovery.body.data.user.twoFactorEnabled, true);
    // Bilet birdəfəlikdir.
    await request(app).post("/api/auth/login/2fa").set("X-Forwarded-For", nextIp()).send({ challenge, code: recoveryCodes[1] }).expect(401);
    const second = await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: user.email, password: strongPassword }).expect(200);
    await request(app).post("/api/auth/login/2fa").set("X-Forwarded-For", nextIp()).send({ challenge: second.body.data.challenge, code: recoveryCodes[0] }).expect(401);

    const session = await request(app).get("/api/auth/session").set("Authorization", `Bearer ${viaRecovery.body.data.token}`).expect(200);
    assert.equal(session.body.data.user.twoFactorEnabled, true);

    // Admin API: 2FA-sız sahib 403, 2FA-lı sahib 200.
    const previous = env.ADMIN_2FA_REQUIRED;
    env.ADMIN_2FA_REQUIRED = true;
    try {
      const { auth: noTwoFactorAuth } = await makeUser("twofactor.none@example.az", "owner_admin");
      const denied = await request(app).get("/api/admin/overview").set("Authorization", noTwoFactorAuth).expect(403);
      assert.equal(denied.body.error.code, "TWO_FACTOR_REQUIRED");
      await request(app).get("/api/admin/overview").set("Authorization", auth).expect(200);
    } finally {
      env.ADMIN_2FA_REQUIRED = previous;
    }

    // Söndürmək üçün şifrə + kod lazımdır.
    await request(app).post("/api/auth/2fa/disable").set("Authorization", auth).send({ password: strongPassword, code: "zzzzz-zzzzz" }).expect(401);
    await request(app).post("/api/auth/2fa/disable").set("Authorization", auth).send({ password: strongPassword, code: recoveryCodes[2] }).expect(200);
    const afterDisable = await request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email: user.email, password: strongPassword }).expect(200);
    assert.ok(afterDisable.body.data.token);
  });
});

describe("QA auditi: limitlər, moderasiya və görünürlük", () => {
  const password = "Kampus-Yolu-2026";
  let passwordHashPromise: Promise<string> | null = null;

  async function makeUser(email: string, role: "student" | "teacher" | "owner_admin" = "student") {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([import("../src/db/database.js"), import("../src/lib/auth.js")]);
    passwordHashPromise ??= hashPassword(password);
    const user = await createUser({ name: "Audit Testi", email, passwordHash: await passwordHashPromise, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", role, status: "Aktiv" });
    return { user, auth: `Bearer ${createAccessToken(user)}` };
  }

  it("eyni proxy IP-si arxasındakı fərqli istifadəçiləri ayrıca sayır, saxta IP başlığına inanmır", async () => {
    const { user } = await makeUser("proxy.login@example.az");
    // Reqressiya: BFF arxasında bütün istifadəçilər Vercel-in bir IP-si ilə gəlirdi
    // və 11-ci giriş (düzgün şifrə ilə belə) HAMI üçün 429 alırdı.
    const vercelIp = "203.0.113.50";
    for (let index = 1; index <= 12; index += 1) {
      await request(app).post("/api/auth/login").set("X-Forwarded-For", vercelIp)
        .set("X-EduRate-Proxy-Secret", PROXY_SECRET).set("X-EduRate-Client-IP", `192.0.2.${index}`)
        .send({ email: user.email, password }).expect(200);
    }
    const sessions = await request(app).get("/api/auth/sessions")
      .set("Authorization", `Bearer ${(await request(app).post("/api/auth/login").set("X-Forwarded-For", vercelIp)
        .set("X-EduRate-Proxy-Secret", PROXY_SECRET).set("X-EduRate-Client-IP", "192.0.2.77").set("User-Agent", "Audit Browser")
        .send({ email: user.email, password }).expect(200)).body.data.token}`)
      .expect(200);
    const current = sessions.body.data.find((session: { current: boolean }) => session.current);
    assert.equal(current.ipAddress, "192.0.2.77");
    assert.equal(current.userAgent, "Audit Browser");

    // Sirr düz deyilsə başlıq nəzərə alınmır: hamısı bir IP kimi sayılır və limitlənir.
    const attackerIp = "203.0.113.51";
    let limited = false;
    for (let index = 1; index <= 12 && !limited; index += 1) {
      const attempt = await request(app).post("/api/auth/login").set("X-Forwarded-For", attackerIp)
        .set("X-EduRate-Proxy-Secret", "x".repeat(PROXY_SECRET.length)).set("X-EduRate-Client-IP", `192.0.2.${100 + index}`)
        .send({ email: user.email, password });
      if (attempt.status === 429) {
        assert.equal(attempt.body.error.code, "RATE_LIMITED");
        limited = true;
      }
    }
    assert.equal(limited, true);
  });

  it("daxil olmuş istifadəçinin limitini IP-yə yox, hesaba bağlayır", async () => {
    // Reqressiya: söhbət bileti limiti `authenticate`-dən əvvəl və IP üzrə idi —
    // bir dəqiqədə 11-ci istifadəçinin söhbəti qoşulmurdu.
    const sharedIp = "203.0.113.60";
    for (let index = 1; index <= 12; index += 1) {
      const { auth } = await makeUser(`ticket.user${index}@example.az`);
      await request(app).post("/api/realtime/ticket").set("X-Forwarded-For", sharedIp).set("Authorization", auth).expect(201);
    }
  });

  it("müəllim dərc olunmuş tədbiri dəyişəndə tədbir yenidən yoxlamaya düşür", async () => {
    const { auth: teacherAuth } = await makeUser("audit.teacher@example.az", "teacher");
    const { auth: ownerAuth } = await makeUser("audit.owner@example.az", "owner_admin");
    const created = await request(app).post("/api/events").set("Authorization", teacherAuth).send({
      title: "Audit olimpiadası", category: "Technology", description: "Moderasiya testi üçün tədbir.",
      longDescription: "Bu tədbir təsdiqdən sonrakı redaktəni yoxlamaq üçün yaradılıb.", location: "Auditoriya 101",
      city: "Xankəndi", organizer: "Audit Testi", startAt: "2030-11-10T10:00:00+04:00", endAt: "2030-11-10T13:00:00+04:00",
      registrationDeadline: "2030-11-09T10:00:00+04:00", capacity: 30,
    }).expect(201);
    const id = created.body.data.id as string;
    assert.equal(created.body.data.adminStatus, "Qaralama");
    await request(app).patch(`/api/admin/events/${id}`).set("Authorization", ownerAuth).send({ status: "Açıq" }).expect(200);
    await request(app).get(`/api/events/${id}`).expect(200);

    // Reqressiya: əvvəl başlıq dəyişirdi, tədbir isə yoxlamasız "Açıq" qalırdı.
    const edited = await request(app).patch(`/api/events/${id}`).set("Authorization", teacherAuth).send({ title: "Yoxlanmamış başlıq" }).expect(200);
    assert.equal(edited.body.data.adminStatus, "Qaralama");
    await request(app).get(`/api/events/${id}`).expect(404);

    // Rəhbərliyin öz redaktəsi tədbiri dərcdə saxlayır.
    await request(app).patch(`/api/admin/events/${id}`).set("Authorization", ownerAuth).send({ status: "Açıq" }).expect(200);
    const byOwner = await request(app).patch(`/api/events/${id}`).set("Authorization", ownerAuth).send({ title: "Rəhbərliyin başlığı" }).expect(200);
    assert.equal(byOwner.body.data.adminStatus, "Açıq");
  });

  it("hesab silmə formasında şifrə təxmini limitlənir", async () => {
    const { user, auth } = await makeUser("audit.delete@example.az");
    // Reqressiya: əvvəl limitsiz idi — açıq qalmış sessiya ilə şifrə sonsuz sınanırdı.
    for (let attempt = 1; attempt <= 9; attempt += 1) {
      await request(app).delete("/api/auth/account").set("Authorization", auth).send({ password: `yanlis-parol-${attempt}` }).expect(401);
    }
    const locked = await request(app).delete("/api/auth/account").set("Authorization", auth).send({ password: "yanlis-parol-10" }).expect(429);
    assert.equal(locked.body.error.code, "ACCOUNT_THROTTLED");
    await request(app).delete("/api/auth/account").set("Authorization", auth).send({ password }).expect(429);
    const { findUserById } = await import("../src/db/database.js");
    assert.ok(await findUserById(user.id));
  });

  it("yoxlanışdakı klubun üzv siyahısını kənar şəxsə açmır", async () => {
    const { auth: teacherAuth } = await makeUser("audit.club.teacher@example.az", "teacher");
    const { auth: studentAuth } = await makeUser("audit.club.student@example.az");
    const created = await request(app).post("/api/clubs").set("Authorization", teacherAuth)
      .send({ name: "Audit Klubu", category: "Akademik", tagline: "Audit üçün yaradılmış klub.", about: ["Bu klub avtomatik testdə yaradılıb."], meeting: { cadence: "Həftəlik", day: "Çərşənbə", time: "18:00", place: "B 204" } })
      .expect(201);
    const slug = created.body.data.slug as string;
    // Reqressiya: səhifə 404 verirdi, üzv siyahısı isə klubu və yaradanı açırdı.
    await request(app).get(`/api/clubs/${slug}/members`).set("Authorization", studentAuth).expect(404);
    await request(app).get(`/api/clubs/${slug}/members`).set("Authorization", teacherAuth).expect(200);
  });

  it("profil şəklini oxumaq yükləmə limitinə düşmür", async () => {
    const { auth } = await makeUser("audit.avatar@example.az");
    // Reqressiya: hər səhifə açılışı bu sorğunu edir; limit bütün router-də idi və
    // 21-ci səhifədən sonra profil şəkli 429 ilə itirdi.
    for (let view = 1; view <= 25; view += 1) {
      await request(app).get("/api/media/avatar/me").set("Authorization", auth).expect(200);
    }
  });
});

describe("Şəxsi bildirişlər", () => {
  it("cavab və əlaqə qəbulunda bildiriş yaradır, oxunmuş işarələyir, başqasınınkını qoruyur", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const, role: "student" as const };
    const asker = await createUser({ ...base, name: "Bildiriş Alan", email: "notify.asker@example.az" });
    const replier = await createUser({ ...base, name: "Bildiriş Göndərən", email: "notify.replier@example.az" });
    const askerAuth = `Bearer ${createAccessToken(asker)}`;
    const replierAuth = `Bearer ${createAccessToken(replier)}`;

    await request(app).get("/api/notifications").expect(401);
    const question = await request(app).post("/api/questions").set("Authorization", askerAuth)
      .send({ title: "Yataqxanada internet nə vaxt düzələcək?", topic: "kampus" }).expect(201);
    const questionId = question.body.data.id as string;

    // Öz sualına cavab bildiriş yaratmır.
    await request(app).post(`/api/questions/${questionId}/answers`).set("Authorization", askerAuth).send({ body: "Əlavə: ikinci mərtəbədə problem var." }).expect(201);
    let inbox = await request(app).get("/api/notifications").set("Authorization", askerAuth).expect(200);
    assert.equal(inbox.body.data.items.length, 0);

    await request(app).post(`/api/questions/${questionId}/answers`).set("Authorization", replierAuth).send({ body: "Bu həftə sonu təmir olunur." }).expect(201);
    inbox = await request(app).get("/api/notifications").set("Authorization", askerAuth).expect(200);
    assert.equal(inbox.body.data.unread, 1);
    const [answered] = inbox.body.data.items;
    assert.equal(answered.kind, "question_answered");
    assert.equal(answered.params.title, "Yataqxanada internet nə vaxt düzələcək?");
    // Suallar anonimdir: bildirişdə cavab yazanın adı yoxdur.
    assert.equal(JSON.stringify(answered).includes("Bildiriş Göndərən"), false);
    assert.equal(answered.readAt, null);

    // Başqasının bildirişini oxunmuş etmək olmur.
    await request(app).patch(`/api/notifications/${answered.id}/read`).set("Authorization", replierAuth).expect(404);
    await request(app).patch(`/api/notifications/${answered.id}/read`).set("Authorization", askerAuth).expect(200);
    inbox = await request(app).get("/api/notifications").set("Authorization", askerAuth).expect(200);
    assert.equal(inbox.body.data.unread, 0);
    assert.ok(inbox.body.data.items[0].readAt);

    // Əlaqə sorğusu qəbul edilir -> sorğunu göndərən bildiriş alır.
    const connection = await request(app).post("/api/community/connections").set("Authorization", replierAuth).send({ userId: asker.id }).expect(201);
    await request(app).patch(`/api/community/connections/${connection.body.data.id}`).set("Authorization", askerAuth).send({}).expect(200);
    const replierInbox = await request(app).get("/api/notifications").set("Authorization", replierAuth).expect(200);
    assert.equal(replierInbox.body.data.items[0].kind, "connection_accepted");
    assert.equal(replierInbox.body.data.items[0].params.name, "Bildiriş Alan");

    const readAll = await request(app).post("/api/notifications/read-all").set("Authorization", replierAuth).expect(200);
    assert.equal(readAll.body.data.updated, 1);
    assert.equal((await request(app).get("/api/notifications").set("Authorization", replierAuth).expect(200)).body.data.unread, 0);
  });
});

describe("Tədbir qaydaları və iştirakçı bildirişləri", () => {
  it("boş yer sayını qəbul etmir, başlamış tədbirdən imtinanı bağlayır, iştirakçılara xəbər verir", async () => {
    const [{ createUser }, { createAccessToken, hashPassword }] = await Promise.all([
      import("../src/db/database.js"),
      import("../src/lib/auth.js"),
    ]);
    const passwordHash = await hashPassword("Kampus-Yolu-2026");
    const base = { passwordHash, university: "Qarabağ Universiteti", faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi", status: "Aktiv" as const };
    const teacher = await createUser({ ...base, name: "Tədbir Müəllimi", email: "events.rules.teacher@example.az", role: "teacher" });
    const student = await createUser({ ...base, name: "Tədbir İştirakçısı", email: "events.rules.student@example.az", role: "student" });
    const teacherAuth = `Bearer ${createAccessToken(teacher)}`;
    const studentAuth = `Bearer ${createAccessToken(student)}`;
    const adminAuth = `Bearer ${reusableAdminToken}`;
    const body = {
      title: "Qaydalar seminarı", category: "Technology", description: "Tələbələr üçün praktik texnologiya seminarı.",
      longDescription: "Müəllimin təqdim etdiyi seminar praktiki nümunələr, açıq müzakirə və sual-cavab hissəsindən ibarətdir.",
      location: "Tədris zalı", city: "Xankəndi", organizer: "Tədbir Müəllimi", startAt: "2027-06-10T14:00:00+04:00",
      endAt: "2027-06-10T16:00:00+04:00", registrationDeadline: "2027-06-09T18:00:00+04:00", speakers: [], capacity: 50,
    };

    // Yaradan boş yer sayını özü yaza bilmir.
    const created = await request(app).post("/api/events").set("Authorization", teacherAuth).send({ ...body, availableSpots: 2 }).expect(201);
    const eventId = created.body.data.id as string;
    assert.equal(created.body.data.availableSpots, 50);
    await request(app).patch(`/api/admin/events/${eventId}`).set("Authorization", adminAuth).send({ status: "Açıq" }).expect(200);
    await request(app).post(`/api/events/${eventId}/registrations`).set("Authorization", studentAuth).expect(201);

    // Yaradan öz tədbirini qeydiyyat sayı ilə görür.
    const mine = await request(app).get("/api/events/mine").set("Authorization", teacherAuth).expect(200);
    const own = mine.body.data.find((item: { id: string }) => item.id === eventId);
    assert.equal(own.registered, 1);
    assert.equal(own.capacity, 50);
    assert.equal(own.longDescription, body.longDescription);

    // Yer dəyişir -> iştirakçı bildiriş alır; başqa sahə dəyişəndə yox.
    await request(app).patch(`/api/events/${eventId}`).set("Authorization", teacherAuth).send({ description: "Yenilənmiş qısa təsvir mətni." }).expect(200);
    let inbox = await request(app).get("/api/notifications").set("Authorization", studentAuth).expect(200);
    assert.equal(inbox.body.data.items.length, 0);
    await request(app).patch(`/api/events/${eventId}`).set("Authorization", teacherAuth).send({ location: "Böyük akt zalı" }).expect(200);
    inbox = await request(app).get("/api/notifications").set("Authorization", studentAuth).expect(200);
    assert.equal(inbox.body.data.items[0].kind, "event_changed");
    assert.equal(inbox.body.data.items[0].params.title, "Qaydalar seminarı");

    // Tədbir başlayıb -> imtina olunmur.
    await request(app).patch(`/api/events/${eventId}`).set("Authorization", adminAuth)
      .send({ startAt: "2020-01-10T10:00:00+04:00", endAt: "2020-01-10T12:00:00+04:00", registrationDeadline: "2020-01-09T10:00:00+04:00" }).expect(200);
    const blocked = await request(app).delete(`/api/events/${eventId}/registrations`).set("Authorization", studentAuth).expect(409);
    assert.equal(blocked.body.error.code, "EVENT_STARTED");

    // Tədbir silinir -> iştirakçı ləğv bildirişi alır; başqasının tədbirini silmək olmur.
    const second = await request(app).post("/api/events").set("Authorization", teacherAuth).send({ ...body, title: "Ləğv ediləcək seminar" }).expect(201);
    const secondId = second.body.data.id as string;
    await request(app).patch(`/api/admin/events/${secondId}`).set("Authorization", adminAuth).send({ status: "Açıq" }).expect(200);
    await request(app).post(`/api/events/${secondId}/registrations`).set("Authorization", studentAuth).expect(201);
    await request(app).delete(`/api/events/${secondId}`).set("Authorization", studentAuth).expect(403);
    await request(app).delete(`/api/events/${secondId}`).set("Authorization", teacherAuth).expect(204);
    inbox = await request(app).get("/api/notifications").set("Authorization", studentAuth).expect(200);
    assert.equal(inbox.body.data.items[0].kind, "event_cancelled");
    assert.equal(inbox.body.data.items[0].params.title, "Ləğv ediləcək seminar");
  });
});
