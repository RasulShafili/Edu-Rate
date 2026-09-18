/**
 * QA harness — YALNIZ lokal test üçün.
 *
 * Problem: yaddaş rejimində (boş `DATABASE_URL`) heç bir seed işləmir — bütün
 * seed funksiyaları `if (!databasePool) return;` ilə başlayır. Üstəlik admin və
 * müəllim rolu üçün HTTP yolu yoxdur: rol yalnız DB-dən qaldırılır. Ona görə
 * rolları gözü ilə yoxlamaq mümkün olmurdu.
 *
 * Bu skript `backend/tests/api.test.ts`-dəki üsulu təkrarlayır: serveri və
 * istifadəçiləri EYNİ prosesdə yaradır, beləliklə yaddaşdakı məlumat serverə
 * görünür. Nəticədə hər rol üçün hazır hesab və test məzmunu olur.
 *
 * İşə salmaq:  cd backend && npx tsx scripts/qa-server.ts
 *
 * DİQQƏT: production-da işlədilməməlidir — hesabların parolu koda yazılıb.
 */

import { createServer } from "node:http";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { createUser, databaseMode } from "../src/db/database.js";
import { createEvent } from "../src/db/business.js";
import { hashPassword } from "../src/lib/auth.js";
import { attachRealtime } from "../src/realtime.js";

if (env.NODE_ENV === "production") {
  console.error("QA harness production mühitində işlədilə bilməz.");
  process.exit(1);
}

/** Test fixture parolu — istifadəçinin real parolu ilə əlaqəsi yoxdur. */
const PASSWORD = "EduRateQA2026!";

const accounts = [
  { key: "student", email: "qa.student@example.az", name: "QA Tələbə",
    role: "student" as const, faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi" },
  { key: "teacher", email: "qa.teacher@example.az", name: "QA Müəllim",
    role: "teacher" as const, faculty: "Pedaqoji fakültə", program: "Riyaziyyat müəllimliyi" },
  { key: "mentor", email: "qa.mentor@example.az", name: "QA Mentor",
    role: "mentor" as const, faculty: "Mühəndislik fakültəsi", program: "Kompüter mühəndisliyi" },
  { key: "assistant", email: "qa.assistant@example.az", name: "QA Admin Köməkçisi",
    role: "assistant_admin" as const, faculty: "Pedaqoji fakültə", program: "Riyaziyyat müəllimliyi" },
  { key: "admin", email: "qa.admin@example.az", name: "QA Platforma Sahibi",
    role: "owner_admin" as const, faculty: "Pedaqoji fakültə", program: "Riyaziyyat müəllimliyi" },
];

function isoIn(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

async function main() {
  if (databaseMode() !== "memory") {
    console.warn("XƏBƏRDARLIQ: yaddaş rejimi deyil — DATABASE_URL təyin olunub.");
  }

  const passwordHash = await hashPassword(PASSWORD);
  const created: Record<string, { id: string; email: string; role: string }> = {};

  for (const account of accounts) {
    const user = await createUser({
      name: account.name,
      email: account.email,
      passwordHash,
      university: "Qarabağ Universiteti",
      faculty: account.faculty,
      program: account.program,
      role: account.role,
      status: "Aktiv",
    });
    created[account.key] = { id: user.id, email: user.email, role: user.role };
  }

  // --- Test tədbirləri: hər QA ssenarisi üçün bir hal ---
  const adminId = created.admin.id;
  const teacherId = created.teacher.id;

  const base = {
    description: "QA testi üçün yaradılmış nümunə tədbir təsviri.",
    longDescription:
      "Bu tədbir yalnız lokal QA yoxlaması üçündür. Siyahı, süzgəc, qeydiyyat və " +
      "tutum ssenarilərini yoxlamaq məqsədi ilə yaradılıb.",
    city: "Xankəndi",
    speakers: ["QA Spiker"],
    accent: "#c8ff4d",
    glow: "rgba(200, 255, 77, 0.28)",
  };

  const fixtures = [
    { title: "Açıq tədbir — boş yer var", category: "Technology" as const,
      location: "TUP Mərkəzi", organizer: "Rəqəmsal İnnovasiya Klubu",
      startAt: isoIn(7), endAt: isoIn(7, 13), registrationDeadline: isoIn(6),
      capacity: 50, adminStatus: "Açıq" as const, owner: adminId },

    { title: "Tutumu dolu tədbir", category: "Culture" as const,
      location: "Konfrans zalı", organizer: "Mədəniyyət Klubu",
      startAt: isoIn(9), endAt: isoIn(9, 12), registrationDeadline: isoIn(8),
      capacity: 20, availableSpots: 0, adminStatus: "Açıq" as const, owner: adminId },

    { title: "Keçmiş tədbir", category: "Design" as const,
      location: "Dizayn studiyası", organizer: "Dizayn Klubu",
      startAt: isoIn(-14), endAt: isoIn(-14, 12), registrationDeadline: isoIn(-15),
      capacity: 40, adminStatus: "Açıq" as const, owner: adminId },

    { title: "Sağlamlıq həftəsi", category: "Wellness" as const,
      location: "İdman kompleksi", organizer: "İdman Klubu",
      startAt: isoIn(21), endAt: isoIn(21, 15), registrationDeadline: isoIn(20),
      capacity: 100, adminStatus: "Açıq" as const, owner: adminId },

    // Müəllimin yaratdığı tədbir qaralama olur — QA sualı: müəllim onu harada görür?
    { title: "Müəllim qaralaması — yoxlanışı gözləyir", category: "Technology" as const,
      location: "Auditoriya 204", organizer: "QA Müəllim",
      startAt: isoIn(12), endAt: isoIn(12, 12), registrationDeadline: isoIn(11),
      capacity: 30, adminStatus: "Qaralama" as const, owner: teacherId },
  ];

  const events: Array<{ title: string; id: string; status: string }> = [];
  for (const { owner, ...fixture } of fixtures) {
    const event = await createEvent({ ...base, ...fixture }, owner);
    events.push({ title: event.title, id: event.id, status: event.adminStatus });
  }

  const server = createServer(createApp());
  attachRealtime(server);
  server.listen(env.PORT, "0.0.0.0", () => {
    console.log("\n=== EduRate QA harness ===");
    console.log(`Server : http://localhost:${env.PORT}  (rejim: ${databaseMode()})`);
    console.log(`Parol  : ${PASSWORD}   (bütün test hesabları üçün eyni)\n`);
    console.table(created);
    console.log("\nTest tədbirləri:");
    console.table(events);
    console.log("\nQeyd: yaddaş rejimidir — serveri dayandıranda hər şey silinir.\n");
  });
}

void main().catch((error) => {
  console.error("QA harness başlamadı:", error);
  process.exit(1);
});
