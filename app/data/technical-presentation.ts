export const presentationQuestions = [
  "EduRate hansı problemi həll edir?",
  "Sistem hansı texnologiyalarla qurulub?",
  "Hazırda hansı əsas istifadəçi axınları canlı işləyir?",
  "Sistem necə qorunur və necə yoxlanılır?",
] as const;

export const presentationModules = [
  "Ana səhifə",
  "Dərs cədvəli",
  "Elanlar və paylaşımlar",
  "Tədbirlər",
  "Klublar və qrup söhbətləri",
  "İcma və mesajlaşma",
  "Dəstək sistemi",
  "Profil və giriş/qeydiyyat",
  "Admin panel",
] as const;

export const presentationStack = [
  {
    label: "Frontend",
    value: "React, Next.js App Router və TypeScript",
    detail: "Modullu səhifə quruluşu, tip təhlükəsizliyi və gələcək genişlənmə üçün əsas qat.",
  },
  {
    label: "UI sistemi",
    value: "KUDS, Tailwind CSS və vahid komponent sistemi",
    detail: "Qarabağ Universiteti yaşıl palitrası, Poppins tipografiyası, 4–96 px spacing, sol naviqasiya və 72 px header.",
  },
  {
    label: "Hərəkət",
    value: "Framer Motion",
    detail: "Səhifə keçidləri, kart hover-ləri, list reflow-ları və əlçatan azaldılmış hərəkət dəstəyi.",
  },
  {
    label: "API hazırlığı",
    value: "REST Route Handlers, Fetch client və OpenAPI 3.1",
    detail: "Next.js BFF qatı canlı Node.js + Express API-yə bağlıdır və əsas əməliyyatlar PostgreSQL-də saxlanılır.",
  },
] as const;

export const plannedApiContracts = [
  "GET /api/health",
  "POST /api/auth/signup və /api/auth/login",
  "GET /api/auth/session və PATCH /api/auth/profile",
  "GET /api/admin/overview",
  "GET, POST, PATCH, DELETE /api/admin/users",
  "GET, POST, PATCH, DELETE /api/admin/clubs və /api/admin/events",
  "POST, DELETE /api/clubs/:clubId/memberships",
  "GET, POST, PATCH, DELETE /api/events və /api/events/:eventId",
  "GET, POST, PATCH, DELETE /api/timetable",
  "GET, POST, PATCH, DELETE /api/community/connections",
  "GET, POST /api/community/conversations və /messages",
  "POST /api/support/tickets",
  "GET /api/openapi.json",
] as const;

export const reviewCriteria = [
  "HttpOnly sessiya",
  "2FA və e-poçt təsdiqi",
  "Məzmun moderasiyası",
  "Rol əsaslı icazələr",
] as const;

export const readinessNotes = [
  {
    label: "Frontend",
    status: "Hazır",
    detail: "Əsas istifadəçi axınları və premium interfeys modulları qurulub.",
  },
  {
    label: "Backend",
    status: "Canlı",
    detail: "Giriş, sessiya, profil, cədvəl, tədbir, klub, dəstək, icma, mesajlaşma və idarəetmə endpoint-ləri Render-də işləyir.",
  },
  {
    label: "Database",
    status: "Aktiv",
    detail: "Render PostgreSQL production bazası istifadəçi və əsas biznes əməliyyatlarını qalıcı saxlayır.",
  },
  {
    label: "Təhlükəsizlik",
    status: "Tətbiq edilib",
    detail: "HttpOnly sessiya, server validasiyası, məzmun moderasiyası, sorğu limiti və rol əsaslı icazələr tətbiq edilib.",
  },
] as const;

export const presentationChecklist = [
  "Sayt desktop və mobil ölçülərdə açılır.",
  "Sol menyudan bütün bölmələrə keçid işləyir.",
  "Cədvəl, elan, tədbir, klub və icma səhifələri səliqəli açılır.",
  "Real vaxt mesajlaşma və klub qrup söhbətləri işləyir.",
  "Admin panel verilənlər bazasından canlı məlumatları göstərir.",
  "Build prosesi uğurla tamamlanır.",
] as const;

export const leadershipScript =
  "EduRate Qarabağ Universiteti üçün tələbə təcrübəsini birləşdirən rəqəmsal platformadır. Frontend React, Next.js və TypeScript, backend Node.js və Express, qalıcı məlumat qatı isə PostgreSQL ilə hazırlanıb. Qeydiyyat, dərs cədvəli, elanlar, tədbir iştirakı, klub üzvlüyü, dəstək, şəxsi mesajlaşma və rol əsaslı idarəetmə canlı API-yə bağlıdır. Sistem HttpOnly sessiya, server validasiyası, moderasiya, audit tarixçəsi və səlahiyyət nəzarəti ilə Sprint 4 çərçivəsində yekunlaşdırılıb.";
