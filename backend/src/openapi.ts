import {
  ACADEMIC_CATALOG,
  ACADEMIC_UNIVERSITY,
} from "./data/academic-catalog.js";

const academicFaculties = ACADEMIC_CATALOG.map((entry) => entry.faculty);
const academicPrograms = ACADEMIC_CATALOG.flatMap((entry) => [...entry.programs]);

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "EduRate REST API",
    version: "1.0.0",
    description:
      "EduRate tələbə portalının Express və PostgreSQL əsaslı REST API sənədləri.",
  },
  servers: [{ url: "/", description: "Cari EduRate API serveri" }],
  tags: [
    { name: "System", description: "Server vəziyyəti" },
    { name: "Authentication", description: "Qeydiyyat və giriş" },
    { name: "Catalog", description: "EduRate kataloqları" },
    { name: "Events", description: "Tədbir CRUD və iştirak qeydiyyatları" },
    { name: "Clubs", description: "Klublar və üzvlüklər" },
    { name: "Mentorship", description: "Mentorluq müraciətlərinin idarə edilməsi" },
    { name: "Reviews", description: "Müəllimlərin meyar əsaslı rəqəmsal qiymətləndirilməsi" },
    { name: "Support", description: "Dəstək müraciətləri" },
    { name: "Community", description: "İstifadəçi kataloqu və əlaqələr" },
    { name: "Media", description: "Təsdiqlənmiş profil və məzmun şəkilləri" },
    { name: "Messaging", description: "Qalıcı şəxsi mesajlaşma və realtime hadisələri" },
    {
      name: "Administration",
      description:
        "Əsas admin və admin köməkçisi üçün idarəetmə əməliyyatları. Köməkçi admin yalnız adi istifadəçilərə tələbə, mentor və müəllim rolu verə bilər.",
    },
  ],
  paths: {
    "/api/media/status": {
      get: { tags: ["Media"], summary: "Şəkil yaddaşının vəziyyətini və limitləri qaytar", security: [{ bearerAuth: [] }], responses: { "200": { description: "Şəkil siyasəti" }, "401": { description: "Giriş tələb olunur" } } },
    },
    "/api/media/sign": {
      post: { tags: ["Media"], summary: "Qısaömürlü imzalanmış yükləmə icazəsi yarat", security: [{ bearerAuth: [] }], responses: { "201": { description: "Yükləmə icazəsi yaradıldı" }, "403": { description: "Məzmun şəkli üçün rol kifayət deyil" }, "503": { description: "Şəkil yaddaşı konfiqurasiya edilməyib" } } },
    },
    "/api/media/confirm": {
      post: { tags: ["Media"], summary: "Bulud imzasını və real şəkil metadata-sını yoxlayıb yadda saxla", security: [{ bearerAuth: [] }], responses: { "201": { description: "Şəkil təsdiqləndi" }, "422": { description: "Format, ölçü və ya imza təhlükəsizlik siyasətinə uyğun deyil" } } },
    },
    "/api/media/{kind}/{ownerId}": {
      delete: { tags: ["Media"], summary: "Şəkli təhlükəsiz sil", security: [{ bearerAuth: [] }], parameters: [{ name: "kind", in: "path", required: true, schema: { type: "string", enum: ["avatar", "club", "announcement", "event"] } }, { name: "ownerId", in: "path", required: true, schema: { type: "string" } }], responses: { "204": { description: "Şəkil silindi" }, "403": { description: "İcazə yoxdur" }, "404": { description: "Şəkil tapılmadı" } } },
    },
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Serverin işləkliyini yoxla",
        responses: {
          "200": {
            description: "Server işləyir",
            content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
          },
          "503": { description: "PostgreSQL bağlantısı hazır deyil" },
        },
      },
    },
    "/api/auth/signup": {
      post: {
        tags: ["Authentication"],
        summary: "Yeni tələbə hesabı və ya müəllim təsdiq müraciəti yarat",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/SignupInput" } },
          },
        },
        responses: {
          "201": { description: "Hesab yaradıldı" },
          "409": { description: "E-poçt artıq mövcuddur" },
          "422": {
            description: "Validasiya və ya fakültə-ixtisas uyğunluğu xətası",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AcademicSelectionError" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Hesaba daxil ol",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/LoginInput" } },
          },
        },
        responses: {
          "200": { description: "Giriş uğurludur" },
          "401": { description: "Giriş məlumatları yanlışdır" },
        },
      },
    },
    "/api/auth/session": {
      get: {
        tags: ["Authentication"],
        summary: "Cari istifadəçini qaytar",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Aktiv sessiya" },
          "401": { description: "Token yoxdur və ya yanlışdır" },
        },
      },
    },
    "/api/auth/verify-email/request": { post: { tags:["Authentication"], summary:"E-poçt təsdiq keçidini yenidən göndər", responses:{"202":{description:"Sorğu qəbul edildi"},"429":{description:"Çox sayda cəhd"}} } },
    "/api/auth/verify-email/confirm": { post: { tags:["Authentication"], summary:"Birdəfəlik tokenlə e-poçtu təsdiqlə", responses:{"200":{description:"E-poçt təsdiqləndi"},"422":{description:"Token etibarsızdır və ya vaxtı bitib"}} } },
    "/api/auth/password/forgot": { post: { tags:["Authentication"], summary:"6 rəqəmli şifrə bərpa kodu istə", responses:{"202":{description:"Sorğu qəbul edildi"}} } },
    "/api/auth/password/verify-code": { post: { tags:["Authentication"], summary:"6 rəqəmli kodu təsdiqlə və qısaömürlü bərpa icazəsi al", responses:{"200":{description:"Kod təsdiqləndi"},"422":{description:"Kod etibarsızdır"}} } },
    "/api/auth/password/reset": { post: { tags:["Authentication"], summary:"Təsdiqlənmiş bərpa icazəsi ilə yeni şifrəni saxla", responses:{"200":{description:"Şifrə yeniləndi və sessiyalar ləğv edildi"},"422":{description:"İcazənin vaxtı bitib və ya şifrələr uyğun deyil"}} } },
    "/api/auth/sessions": { get:{tags:["Authentication"],summary:"Aktiv cihaz sessiyalarını göstər",security:[{bearerAuth:[]}],responses:{"200":{description:"Sessiyalar"}}},delete:{tags:["Authentication"],summary:"Cari sessiyadan başqa bütün sessiyaları bağla",security:[{bearerAuth:[]}],responses:{"204":{description:"Sessiyalar bağlandı"}}} },
    "/api/community/reports": { post:{tags:["Community"],summary:"Məzmun və ya profil haqqında təhlükəsizlik şikayəti yarat",security:[{bearerAuth:[]}],responses:{"201":{description:"Şikayət moderasiya növbəsinə əlavə edildi"}}} },
    "/api/admin/reports": { get:{tags:["Administration"],summary:"Məzmun şikayətlərinin moderasiya növbəsini göstər",security:[{bearerAuth:[]}],responses:{"200":{description:"Şikayətlər"},"403":{description:"Admin icazəsi tələb olunur"}}} },
    "/api/admin/reports/{id}": { patch:{tags:["Administration"],summary:"Şikayət üzrə əsaslandırılmış qərar yaz",security:[{bearerAuth:[]}],parameters:[{name:"id",in:"path",required:true,schema:{type:"string",format:"uuid"}}],responses:{"200":{description:"Şikayət yeniləndi"},"404":{description:"Şikayət tapılmadı"}}} },
    "/api/auth/profile": {
      patch: {
        tags: ["Authentication"],
        summary: "Cari istifadəçinin profilini yenilə",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ProfileInput" } },
          },
        },
        responses: {
          "200": { description: "Profil yeniləndi" },
          "401": { description: "Token yoxdur və ya yanlışdır" },
          "422": {
            description: "Validasiya və ya fakültə-ixtisas uyğunluğu xətası",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AcademicSelectionError" },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Client sessiyasını bitir",
        responses: { "204": { description: "Çıxış edildi" } },
      },
    },
    "/api/academic-catalog": {
      get: {
        tags: ["Catalog"],
        summary: "Rəsmi fakültə və ixtisas kataloqunu göstər",
        responses: {
          "200": {
            description: "Fakültələr və onlara aid ixtisaslar",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AcademicCatalogResponse" },
              },
            },
          },
        },
      },
    },
    "/api/events": {
      get: {
        tags: ["Events"],
        summary: "Tədbirləri siyahıla",
        responses: { "200": { description: "Tədbirlər", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Event" } } } } } } } },
      },
      post: {
        tags: ["Events"],
        summary: "Yeni tədbir yarat",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/EventInput" } } } },
        responses: { "201": { description: "Tədbir yaradıldı" }, "401": { description: "Giriş tələb olunur" }, "422": { description: "Validasiya xətası" } },
      },
    },
    "/api/events/{eventId}": {
      parameters: [{ name: "eventId", in: "path", required: true, schema: { type: "string" } }],
      get: { tags: ["Events"], summary: "Tədbir təfərrüatını göstər", responses: { "200": { description: "Tədbir" }, "404": { description: "Tədbir tapılmadı" } } },
      patch: {
        tags: ["Events"], summary: "Yaratdığın tədbiri yenilə", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", minProperties: 1, description: "EventInput sahələrinin dəyişdiriləcək alt çoxluğu. Göndərilməyən sahələr qorunur." } } } },
        responses: { "200": { description: "Tədbir yeniləndi" }, "403": { description: "İcazə yoxdur" }, "404": { description: "Tədbir tapılmadı" }, "409": { description: "Tutum mövcud qeydiyyat sayından azdır" }, "422": { description: "Validasiya xətası" } },
      },
      delete: { tags: ["Events"], summary: "Yaratdığın tədbiri sil", security: [{ bearerAuth: [] }], responses: { "204": { description: "Tədbir silindi" }, "403": { description: "İcazə yoxdur" }, "404": { description: "Tədbir tapılmadı" } } },
    },
    "/api/events/{eventId}/registrations": {
      parameters: [{ name: "eventId", in: "path", required: true, schema: { type: "string" } }],
      post: { tags: ["Events"], summary: "Tədbirə qeydiyyatdan keç", security: [{ bearerAuth: [] }], responses: { "201": { description: "Qeydiyyat tamamlandı" }, "409": { description: "Tədbir yayımlanmayıb, qeydiyyat bağlıdır, yer yoxdur və ya qeydiyyat təkrardır" } } },
      delete: { tags: ["Events"], summary: "Tədbir qeydiyyatını ləğv et", security: [{ bearerAuth: [] }], responses: { "200": { description: "Qeydiyyat ləğv edildi" }, "404": { description: "Qeydiyyat tapılmadı" } } },
    },
    "/api/events/registrations/me": {
      get: { tags: ["Events"], summary: "Qeydiyyatdan keçdiyim tədbirləri göstər", security: [{ bearerAuth: [] }], responses: { "200": { description: "İstifadəçinin tədbirləri" } } },
    },
    "/api/clubs": {
      get: {
        tags: ["Clubs"],
        summary: "Klubları siyahıla",
        responses: { "200": { description: "Klublar" } },
      },
      post: { tags: ["Clubs"], summary: "Yeni klub müraciəti yarat (müəllim, mentor və rəhbərlik)", security: [{ bearerAuth: [] }], responses: { "201": { description: "Klub müraciəti yaradıldı" }, "403": { description: "Uyğun rol tələb olunur" } } },
    },
    "/api/clubs/memberships/me": {
      get: { tags: ["Clubs"], summary: "Üzv olduğum klubları göstər", security: [{ bearerAuth: [] }], responses: { "200": { description: "Klub üzvlükləri" } } },
    },
    "/api/clubs/{clubId}": {
      parameters: [{ name: "clubId", in: "path", required: true, schema: { type: "string" } }],
      get: { tags: ["Clubs"], summary: "Klubun database əsaslı profilini göstər", responses: { "200": { description: "Klub profili, real üzv sayı və görüş məlumatı" }, "404": { description: "Aktiv klub tapılmadı" } } },
      patch: { tags: ["Clubs"], summary: "Klub məlumatlarını qismən yenilə (rəhbərlik)", security: [{ bearerAuth: [] }], responses: { "200": { description: "Klub yeniləndi" }, "403": { description: "Rəhbərlik icazəsi tələb olunur" }, "404": { description: "Klub tapılmadı" } } },
      delete: { tags: ["Clubs"], summary: "Klubu sil (rəhbərlik)", security: [{ bearerAuth: [] }], responses: { "204": { description: "Klub silindi" }, "403": { description: "Rəhbərlik icazəsi tələb olunur" }, "404": { description: "Klub tapılmadı" } } },
    },
    "/api/clubs/{clubId}/memberships": {
      parameters: [{ name: "clubId", in: "path", required: true, schema: { type: "string" } }],
      post: { tags: ["Clubs"], summary: "Kluba qoşul", security: [{ bearerAuth: [] }], responses: { "201": { description: "Üzvlük yaradıldı" }, "409": { description: "Artıq üzvdür" } } },
      delete: { tags: ["Clubs"], summary: "Klub üzvlüyündən çıx", security: [{ bearerAuth: [] }], responses: { "200": { description: "Üzvlük silindi" }, "404": { description: "Üzvlük tapılmadı" } } },
    },
    "/api/clubs/{clubId}/members": {
      get: { tags: ["Clubs"], summary: "Klub üzvlərini və liderlik icazələrini göstər", security: [{ bearerAuth: [] }], parameters: [{ name: "clubId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Üzvlər və idarəetmə icazələri" }, "404": { description: "Klub tapılmadı" } } },
    },
    "/api/clubs/{clubId}/leaders/{userId}": {
      parameters: [{ name: "clubId", in: "path", required: true, schema: { type: "string" } }, { name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: { tags: ["Clubs"], summary: "Klub üzvünü əlavə lider təyin et", security: [{ bearerAuth: [] }], responses: { "200": { description: "Lider təyin edildi" }, "403": { description: "Yaradıcı və ya əsas admin icazəsi tələb olunur" }, "404": { description: "Klub və ya üzv tapılmadı" } } },
      delete: { tags: ["Clubs"], summary: "Əlavə liderin səlahiyyətini götür", security: [{ bearerAuth: [] }], responses: { "200": { description: "Liderlik götürüldü" }, "409": { description: "Klub yaradıcısının liderliyi götürülə bilməz" } } },
    },
    "/api/mentors": {
      get: {
        tags: ["Catalog"],
        summary: "Mentorları siyahıla",
        responses: { "200": { description: "Mentorlar" } },
      },
    },
    "/api/mentorship/requests": {
      get: { tags: ["Mentorship"], summary: "Müraciətlərimi siyahıla", security: [{ bearerAuth: [] }], responses: { "200": { description: "Mentorluq müraciətləri" } } },
      post: {
        tags: ["Mentorship"], summary: "Mentorluq müraciəti yarat", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MentorshipRequestInput" } } } },
        responses: { "201": { description: "Müraciət yaradıldı" }, "404": { description: "Mentor tapılmadı" }, "409": { description: "Gözləyən müraciət artıq var" }, "422": { description: "Validasiya xətası" } },
      },
    },
    "/api/mentorship/requests/{requestId}": {
      parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: {
        tags: ["Mentorship"], summary: "Gözləyən müraciətin qeydini yenilə", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["note"], properties: { note: { type: "string", maxLength: 600 } } } } } },
        responses: { "200": { description: "Müraciət yeniləndi" }, "404": { description: "Müraciət tapılmadı" } },
      },
      delete: { tags: ["Mentorship"], summary: "Gözləyən müraciəti sil", security: [{ bearerAuth: [] }], responses: { "204": { description: "Müraciət silindi" }, "404": { description: "Müraciət tapılmadı" } } },
    },
    "/api/reviews": {
      get: {
        tags: ["Reviews"], summary: "Təsdiqlənmiş müəllim qiymətləndirmələrini siyahıla",
        parameters: [
          { name: "teacherId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 30 } },
        ],
        responses: { "200": { description: "Dərc edilmiş rəqəmsal nəticələr" }, "422": { description: "Validasiya xətası" } },
      },
      post: {
        tags: ["Reviews"], summary: "Müəllim üçün meyar əsaslı qiymətləndirmə göndər", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/TeacherReviewInput" } } } },
        responses: { "201": { description: "Qiymətləndirmə saxlanıldı" }, "409": { description: "Cari semestr üçün qiymətləndirmə mövcuddur" }, "422": { description: "Açıq mətn, naməlum sahə və ya natamam meyar qəbul edilmir" } },
      },
    },
    "/api/reviews/mine": {
      get: {
        tags: ["Reviews"],
        summary: "Cari semestr üçün göndərdiyim qiymətləndirmələri siyahıla",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "semester", in: "query", required: true, schema: { type: "string", example: "2026-payız" } },
        ],
        responses: {
          "200": { description: "Cari istifadəçinin semestr qiymətləndirmələri" },
          "401": { description: "Daxil olmaq tələb olunur" },
          "422": { description: "Semestr parametrində validasiya xətası" },
        },
      },
    },
    "/api/network/announcements": {
      get: {
        tags: ["Catalog"], summary: "Aktiv universitet elanlarını siyahıla",
        parameters: [{ name: "category", in: "query", schema: { type: "string", enum: ["official", "faculties", "clubs", "scholarship", "events"] } }],
        responses: { "200": { description: "Elanlar" }, "422": { description: "Validasiya xətası" } },
      },
      post: { tags:["Catalog"],summary:"Yoxlanış üçün elan göndər",security:[{bearerAuth:[]}],responses:{"202":{description:"Elan admin yoxlanışına göndərildi"},"401":{description:"Giriş tələb olunur"},"422":{description:"Validasiya xətası"}} },
    },
    "/api/network/announcements/{id}/view": { post:{tags:["Catalog"],summary:"Elanın unikal baxışını qeydə al",security:[{bearerAuth:[]}],parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"Baxış sayı"},"401":{description:"Giriş tələb olunur"}}} },
    "/api/network/announcements/{id}/reaction": { patch:{tags:["Catalog"],summary:"Elana emoji reaksiyası əlavə et və ya geri götür",security:[{bearerAuth:[]}],parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"Reaksiya yeniləndi"},"401":{description:"Giriş tələb olunur"}}} },
    "/api/network/announcements/{id}/reactions": { get:{tags:["Catalog"],summary:"Elana reaksiya verən istifadəçiləri siyahıla",security:[{bearerAuth:[]}],parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"Reaksiya sayı və istifadəçi siyahısı"},"401":{description:"Giriş tələb olunur"}}} },
    "/api/network/announcements/{id}/state": { patch:{tags:["Catalog"],summary:"Elanın oxunma və yadda saxlama vəziyyətini yenilə",security:[{bearerAuth:[]}],parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"İstifadəçi vəziyyəti yeniləndi"},"401":{description:"Giriş tələb olunur"}}} },
    "/api/network/feed": {
      get: {
        tags: ["Catalog"], summary: "Tələbə lentini siyahıla",
        parameters: [{ name: "category", in: "query", schema: { type: "string", enum: ["official", "faculties", "clubs", "scholarship", "events"] } }],
        responses: { "200": { description: "Lent paylaşımları" }, "422": { description: "Validasiya xətası" } },
      },
      post: {
        tags: ["Catalog"], summary: "Moderasiya üçün lent paylaşımı yarat", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["title", "summary"], properties: { title: { type: "string", minLength: 3, maxLength: 180 }, summary: { type: "string", minLength: 10, maxLength: 800 }, tags: { type: "array", maxItems: 5, items: { type: "string", minLength: 1, maxLength: 32 } } } } } } },
        responses: { "202": { description: "Paylaşım moderasiya növbəsinə əlavə edildi" }, "401": { description: "Daxil olmaq tələb olunur" }, "422": { description: "Validasiya xətası" } },
      },
    },
    "/api/support/tickets": {
      get: {
        tags: ["Support"], summary: "Bütün dəstək müraciətlərini göstər (rəhbərlik)", security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Dəstək müraciətləri" }, "403": { description: "Rəhbərlik icazəsi tələb olunur" } },
      },
      post: {
        tags: ["Support"], summary: "Dəstək müraciəti yarat", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SupportTicketInput" } } } },
        responses: { "201": { description: "Müraciət saxlanıldı" }, "422": { description: "Validasiya xətası" } },
      },
    },
    "/api/support/tickets/{id}": {
      parameters:[{name:"id",in:"path",required:true,schema:{type:"string",format:"uuid"}}],
      patch:{tags:["Support"],summary:"Dəstək müraciətinin vəziyyətini yenilə (rəhbərlik)",security:[{bearerAuth:[]}],responses:{"200":{description:"Müraciət yeniləndi"},"403":{description:"Rəhbərlik icazəsi tələb olunur"},"404":{description:"Müraciət tapılmadı"}}},
    },
    "/api/support/tickets/me": { get:{tags:["Support"],summary:"Cari istifadəçinin dəstək müraciətlərini göstər",security:[{bearerAuth:[]}],responses:{"200":{description:"Müraciətlər"}}} },
    "/api/teachers": { get:{tags:["Catalog"],summary:"Təsdiqlənmiş müəllim profillərini siyahıla",responses:{"200":{description:"Müəllimlər"}}} },
    "/api/community/users": { get:{tags:["Community"],summary:"Aktiv istifadəçi kataloqu",security:[{bearerAuth:[]}],responses:{"200":{description:"İstifadəçilər"}}} },
    "/api/community/connections": {
      get:{tags:["Community"],summary:"Əlaqələri siyahıla",security:[{bearerAuth:[]}],responses:{"200":{description:"Əlaqələr"}}},
      post:{tags:["Community"],summary:"Əlaqə sorğusu göndər",security:[{bearerAuth:[]}],requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:false,required:["userId"],properties:{userId:{type:"string",format:"uuid"}}}}}},responses:{"201":{description:"Sorğu yaradıldı"},"409":{description:"Sorğu və ya əlaqə artıq mövcuddur"}}},
    },
    "/api/community/connections/{id}": {
      parameters:[{name:"id",in:"path",required:true,schema:{type:"string",format:"uuid"}}],
      patch:{tags:["Community"],summary:"Gələn əlaqə sorğusunu qəbul et",security:[{bearerAuth:[]}],responses:{"200":{description:"Əlaqə qəbul edildi"},"403":{description:"Bu sorğunu idarə etmək olmaz"},"404":{description:"Sorğu tapılmadı"}}},
      delete:{tags:["Community"],summary:"Sorğunu geri çək, rədd et və ya əlaqəni sil",security:[{bearerAuth:[]}],responses:{"204":{description:"Əlaqə silindi"},"404":{description:"Əlaqə tapılmadı"}}},
    },
    "/api/community/blocks": {
      post:{tags:["Community"],summary:"İstifadəçini blokla",security:[{bearerAuth:[]}],requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:false,required:["userId"],properties:{userId:{type:"string",format:"uuid"}}}}}},responses:{"204":{description:"İstifadəçi bloklandı"},"422":{description:"Öz hesabını bloklamaq olmaz"}}},
    },
    "/api/community/blocks/{userId}": {
      parameters:[{name:"userId",in:"path",required:true,schema:{type:"string",format:"uuid"}}],
      delete:{tags:["Community"],summary:"Öz tətbiq etdiyin bloku aç",security:[{bearerAuth:[]}],responses:{"204":{description:"Blok açıldı"},"404":{description:"Açılması mümkün olan blok tapılmadı"}}},
    },
    "/api/community/conversations": {
      get:{tags:["Messaging"],summary:"Söhbətləri siyahıla",security:[{bearerAuth:[]}],responses:{"200":{description:"Söhbətlər"}}},
      post:{tags:["Messaging"],summary:"Şəxsi söhbət yarat",security:[{bearerAuth:[]}],requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:false,required:["peerId"],properties:{peerId:{type:"string",format:"uuid"}}}}}},responses:{"201":{description:"Söhbət yaradıldı"},"403":{description:"Qəbul edilmiş əlaqə tələb olunur"}}},
    },
    "/api/community/groups": {
      get:{tags:["Messaging"],summary:"Üzv olduğun klub qruplarını siyahıla",security:[{bearerAuth:[]}],responses:{"200":{description:"Klub qrupları"},"401":{description:"Giriş tələb olunur"}}},
    },
    "/api/community/conversations/{id}/messages": {
      parameters:[{name:"id",in:"path",required:true,schema:{type:"string",format:"uuid"}}],
      get:{tags:["Messaging"],summary:"Cursor əsaslı mesaj tarixçəsi",security:[{bearerAuth:[]}],responses:{"200":{description:"Mesajlar"}}},
      post:{tags:["Messaging"],summary:"Mesaj göndər",security:[{bearerAuth:[]}],requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:false,required:["body"],properties:{body:{type:"string",minLength:1,maxLength:2000}}}}}},responses:{"201":{description:"Mesaj saxlanıldı"},"429":{description:"Mesaj limiti aşıldı"}}},
    },
    "/api/community/conversations/{id}/messages/{messageId}": {
      parameters:[{name:"id",in:"path",required:true,schema:{type:"string",format:"uuid"}},{name:"messageId",in:"path",required:true,schema:{type:"string",format:"uuid"}}],
      delete:{tags:["Messaging"],summary:"Öz mesajını sil",security:[{bearerAuth:[]}],responses:{"204":{description:"Mesaj silindi"},"404":{description:"Mesaj tapılmadı"}}},
    },
    "/api/community/conversations/{id}/read": {
      parameters:[{name:"id",in:"path",required:true,schema:{type:"string",format:"uuid"}}],
      patch:{tags:["Messaging"],summary:"Söhbətin mesajlarını oxunmuş kimi işarələ",security:[{bearerAuth:[]}],responses:{"200":{description:"Oxunma vəziyyəti yeniləndi"},"403":{description:"Söhbətə giriş yoxdur"},"404":{description:"Söhbət tapılmadı"}}},
    },
    "/api/realtime/ticket": { post:{tags:["Messaging"],summary:"Birdəfəlik realtime bileti al",security:[{bearerAuth:[]}],responses:{"201":{description:"60 saniyəlik bilet"}}} },
    "/api/community/conversations/{id}/mute": {
      parameters:[{name:"id",in:"path",required:true,schema:{type:"string",format:"uuid"}}],
      patch:{tags:["Messaging"],summary:"Söhbəti səssizə al və ya səsi aktiv et",security:[{bearerAuth:[]}],requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:false,required:["muted"],properties:{muted:{type:"boolean"}}}}}},responses:{"200":{description:"Bildiriş seçimi yeniləndi"},"403":{description:"Söhbətə giriş yoxdur"}}},
    },
    "/api/admin/overview": {
      get: { tags: ["Administration"], summary: "Canlı idarəetmə göstəricilərini göstər", security: [{ bearerAuth: [] }], responses: { "200": { description: "İdarəetmə icmalı" }, "403": { description: "Admin icazəsi tələb olunur" } } },
    },
    "/api/admin/users": {
      get: {
        tags: ["Administration"],
        summary: "İstifadəçiləri siyahıla",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "İstifadəçilər" },
          "403": { description: "Admin icazəsi tələb olunur" },
        },
      },
      post: {
        tags: ["Administration"],
        summary: "Yeni istifadəçi yarat (yalnız əsas admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          "201": { description: "İstifadəçi yaradıldı" },
          "403": { description: "Əsas admin icazəsi tələb olunur" },
          "422": { description: "Validasiya xətası" },
        },
      },
    },
    "/api/admin/users/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: {
        tags: ["Administration"],
        summary: "İstifadəçini yenilə və ya adi istifadəçi rolunu dəyiş",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "İstifadəçi yeniləndi" },
          "403": { description: "Administrator hesabı qorunur və ya səlahiyyət yüksəltmə cəhdi rədd edildi" },
          "409": { description: "Aktiv adminin özünü kilidləmə cəhdinin qarşısı alındı" },
          "404": { description: "İstifadəçi tapılmadı" },
        },
      },
      delete: {
        tags: ["Administration"],
        summary: "İstifadəçini sil (yalnız əsas admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          "204": { description: "İstifadəçi silindi" },
          "403": { description: "Əsas admin icazəsi tələb olunur" },
          "409": { description: "Admin öz hesabını silə bilməz" },
          "404": { description: "İstifadəçi tapılmadı" },
        },
      },
    },
    "/api/admin/clubs": {
      get: { tags: ["Administration"], summary: "Klubları idarəetmə üçün siyahıla", security: [{ bearerAuth: [] }], responses: { "200": { description: "Klublar" }, "403": { description: "Admin icazəsi tələb olunur" } } },
      post: { tags: ["Administration"], summary: "Yeni klub yarat", security: [{ bearerAuth: [] }], responses: { "201": { description: "Klub yaradıldı" }, "403": { description: "Admin icazəsi tələb olunur" } } },
    },
    "/api/admin/clubs/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: { tags: ["Administration"], summary: "Klubu yenilə", security: [{ bearerAuth: [] }], responses: { "200": { description: "Klub yeniləndi" }, "403": { description: "Admin icazəsi tələb olunur" } } },
      delete: { tags: ["Administration"], summary: "Klubu sil", security: [{ bearerAuth: [] }], responses: { "204": { description: "Klub silindi" }, "403": { description: "Admin icazəsi tələb olunur" } } },
    },
    "/api/admin/events": {
      get: { tags: ["Administration"], summary: "Tədbirləri idarəetmə üçün siyahıla", security: [{ bearerAuth: [] }], responses: { "200": { description: "Tədbirlər" }, "403": { description: "Admin icazəsi tələb olunur" } } },
      post: { tags: ["Administration"], summary: "Yeni tədbir yarat", security: [{ bearerAuth: [] }], responses: { "201": { description: "Tədbir yaradıldı" }, "403": { description: "Admin icazəsi tələb olunur" } } },
    },
    "/api/admin/events/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      patch: { tags: ["Administration"], summary: "Tədbiri yenilə", security: [{ bearerAuth: [] }], responses: { "200": { description: "Tədbir yeniləndi" }, "403": { description: "Admin icazəsi tələb olunur" } } },
      delete: { tags: ["Administration"], summary: "Tədbiri sil", security: [{ bearerAuth: [] }], responses: { "204": { description: "Tədbir silindi" }, "403": { description: "Admin icazəsi tələb olunur" } } },
    },
    "/api/admin/announcements": {
      get: { tags: ["Administration"], summary: "Bütün elanları idarəetmə üçün siyahıla", security: [{ bearerAuth: [] }], responses: { "200": { description: "Elanlar" } } },
      post: { tags: ["Administration"], summary: "Yeni elan yarat", security: [{ bearerAuth: [] }], responses: { "201": { description: "Elan yaradıldı" } } },
    },
    "/api/admin/announcements/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      patch: { tags: ["Administration"], summary: "Elanı yenilə və ya yayımla", security: [{ bearerAuth: [] }], responses: { "200": { description: "Elan yeniləndi" } } },
      delete: { tags: ["Administration"], summary: "Elanı sil", security: [{ bearerAuth: [] }], responses: { "204": { description: "Elan silindi" } } },
    },
    "/api/admin/feed": {
      get: { tags: ["Administration"], summary: "Lent moderasiya növbəsini siyahıla", security: [{ bearerAuth: [] }], responses: { "200": { description: "Lent paylaşımları" } } },
    },
    "/api/admin/feed/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      patch: { tags: ["Administration"], summary: "Lent paylaşımını təsdiqlə və ya rədd et", security: [{ bearerAuth: [] }], responses: { "200": { description: "Paylaşım yeniləndi" } } },
      delete: { tags: ["Administration"], summary: "Lent paylaşımını sil", security: [{ bearerAuth: [] }], responses: { "204": { description: "Paylaşım silindi" } } },
    },
    "/api/admin/support-tickets": {
      get: { tags: ["Administration"], summary: "Dəstək müraciətlərini siyahıla", security: [{ bearerAuth: [] }], responses: { "200": { description: "Dəstək müraciətləri" } } },
    },
    "/api/admin/support-tickets/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: { tags: ["Administration"], summary: "Dəstək müraciətinin statusunu dəyiş", security: [{ bearerAuth: [] }], responses: { "200": { description: "Müraciət yeniləndi" } } },
    },
    "/api/admin/reviews": {
      get: {
        tags: ["Administration"], summary: "Rəyləri moderasiya üçün siyahıla", security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"], default: "pending" } },
          { name: "teacherId", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Moderasiya rəyləri" }, "403": { description: "Admin icazəsi tələb olunur" } },
      },
    },
    "/api/admin/reviews/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: {
        tags: ["Administration"], summary: "Rəyi təsdiqlə və ya rədd et", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["approved", "rejected"] } } } } } },
        responses: { "200": { description: "Rəy yeniləndi" }, "404": { description: "Rəy tapılmadı" }, "403": { description: "Admin icazəsi tələb olunur" } },
      },
    },
    "/api/workspace": {
      get: {
        tags: ["Authentication"], summary: "Cari rol üçün iş panelini göstər", security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Tələbə, müəllim, mentor və ya rəhbərlik paneli" }, "401": { description: "Giriş tələb olunur" } },
      },
    },
    "/api/workspace/mentor-application": {
      post: {
        tags: ["Mentorship"], summary: "Müəllim hesabından mentorluq üçün müraciət et", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["specialty", "biography", "availability", "meetingMode", "languages"], properties: {
          specialty: { type: "string", minLength: 2, maxLength: 180 }, biography: { type: "string", minLength: 20, maxLength: 1200 },
          availability: { type: "string", minLength: 2, maxLength: 240 }, meetingMode: { type: "string", enum: ["Onlayn", "Əyani", "Hibrid"] },
          languages: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        } } } } },
        responses: { "201": { description: "Mentorluq müraciəti yaradıldı" }, "403": { description: "Aktiv müəllim hesabı tələb olunur" }, "409": { description: "Aktiv və ya gözləyən müraciət mövcuddur" } },
      },
    },
    "/api/admin/mentor-applications": {
      get: { tags: ["Administration"], summary: "Mentorluq müraciətlərini siyahıla", security: [{ bearerAuth: [] }], responses: { "200": { description: "Mentorluq müraciətləri" }, "403": { description: "Admin icazəsi tələb olunur" } } },
    },
    "/api/admin/mentor-applications/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: { tags: ["Administration"], summary: "Mentorluq müraciətini təsdiqlə və ya rədd et", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["approved", "rejected"] } } } } } }, responses: { "200": { description: "Mentorluq müraciəti yeniləndi" }, "404": { description: "Müraciət tapılmadı" } } },
    },
    "/api/workspace/mentorship/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: {
        tags: ["Mentorship"], summary: "Mentorluq müraciətini qəbul et, rədd et və ya aktiv mentorluğu bitir", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["accepted", "rejected", "cancelled"] } } } } } },
        responses: { "200": { description: "Müraciət yeniləndi" }, "403": { description: "Mentor icazəsi tələb olunur" }, "404": { description: "Müraciət tapılmadı" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      UserRole: {
        type: "string",
        enum: ["student", "mentor", "teacher", "assistant_admin", "admin", "owner_admin"],
        description:
          "owner_admin: tam səlahiyyət, istifadəçi yaratma/silmə və administrator rolları vermək; admin: bütün məzmun, adi istifadəçilərin məlumatı, rolu və statusu (administrator hesablarını dəyişə və administrator rolu verə bilməz); assistant_admin: məzmun moderasiyası — klub/tədbir CRUD, elanlar, lent, rəylər, şikayətlər, dəstək müraciətləri, mentor müraciətləri — və adi istifadəçilərə student/mentor/teacher rolu vermək; başqasının profil şəklini silə bilməz; digər rollar: standart istifadəçi səlahiyyətləri.",
      },
      HealthResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            required: ["status", "service", "database", "timestamp"],
            properties: {
              status: { type: "string", example: "ok" },
              service: { type: "string", example: "EduRate API" },
              database: { type: "string", enum: ["memory", "postgresql"] },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
      SignupInput: {
        type: "object",
        required: ["name", "email", "password", "accountType", "program", "legalAccepted"],
        properties: {
          name: { type: "string", example: "Nümunə Tələbə" },
          email: { type: "string", format: "email", example: "telebe@example.az" },
          password: { type: "string", format: "password", minLength: 8, example: "EduRate2026" },
          university: {
            type: "string",
            enum: [ACADEMIC_UNIVERSITY],
            default: ACADEMIC_UNIVERSITY,
            example: ACADEMIC_UNIVERSITY,
          },
          accountType: {
            type: "string",
            enum: ["student", "teacher"],
            default: "student",
            description: "Müəllim hesabı rəhbərlik təsdiqindən sonra aktivləşir. Mentor olmaq üçün müəllim panelindən ayrıca müraciət edilir.",
          },
          faculty: {
            type: "string",
            enum: academicFaculties,
            description: "Yalnız tələbə qeydiyyatı üçün tələb olunur.",
            example: "Mühəndislik fakültəsi",
          },
          program: {
            type: "string",
            description: "Tələbə üçün ixtisas, müəllim üçün tədris sahəsi.",
            example: "Kompüter mühəndisliyi",
          },
          legalAccepted: { type: "boolean", enum: [true], description: "Cari istifadə şərtləri və məxfilik siyasətinin açıq qəbulu." },
        },
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "telebe@example.az" },
          password: { type: "string", format: "password", example: "EduRate2026" },
        },
      },
      ProfileInput: {
        type: "object",
        required: ["name", "university", "faculty", "program", "year", "about"],
        properties: {
          name: { type: "string", example: "Nümunə Tələbə" },
          university: {
            type: "string",
            enum: [ACADEMIC_UNIVERSITY],
            example: ACADEMIC_UNIVERSITY,
          },
          faculty: {
            type: "string",
            enum: academicFaculties,
            example: "Mühəndislik fakültəsi",
          },
          program: {
            type: "string",
            enum: academicPrograms,
            description: "Seçilmiş fakültəyə aid ixtisas olmalıdır.",
            example: "Kompüter mühəndisliyi",
          },
          year: { type: "string", example: "2-ci kurs" },
          about: { type: "string", maxLength: 600 },
        },
      },
      AcademicCatalogResponse: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            type: "array",
            minItems: 7,
            items: {
              type: "object",
              required: ["faculty", "programs"],
              properties: {
                faculty: { type: "string", enum: academicFaculties },
                programs: {
                  type: "array",
                  minItems: 1,
                  items: { type: "string", enum: academicPrograms },
                },
              },
            },
          },
        },
      },
      AcademicSelectionError: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", example: "INVALID_ACADEMIC_SELECTION" },
              message: {
                type: "string",
                example: "Universitet, fakültə və ixtisas seçimi rəsmi kataloqa uyğun deyil.",
              },
              details: {
                type: "object",
                additionalProperties: { type: "string" },
                example: { program: "İxtisası seçilmiş fakültənin siyahısından seçin." },
              },
            },
          },
        },
      },
      EventInput: {
        type: "object",
        required: ["title", "category", "description", "longDescription", "location", "city", "organizer", "startAt", "endAt", "registrationDeadline", "speakers", "capacity"],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 140, example: "Kampus innovasiya günü" },
          category: { type: "string", enum: ["Design", "Technology", "Culture", "Wellness"] },
          description: { type: "string", minLength: 10, maxLength: 280 },
          longDescription: { type: "string", minLength: 20, maxLength: 1600 },
          location: { type: "string", example: "İnnovasiya mərkəzi" },
          city: { type: "string", example: "Xankəndi" },
          organizer: { type: "string", example: "Tələbə innovasiya klubu" },
          startAt: { type: "string", format: "date-time", example: "2026-10-20T14:00:00+04:00" },
          endAt: { type: "string", format: "date-time", example: "2026-10-20T16:00:00+04:00" },
          registrationDeadline: { type: "string", format: "date-time", example: "2026-10-19T23:59:59+04:00" },
          speakers: { type: "array", items: { type: "string" }, example: ["Nigar Hüseynli", "Tural Kərimov"] },
          capacity: { type: "integer", minimum: 1, maximum: 10000, example: 100 },
          accent: { type: "string", example: "#c8ff4d" },
          glow: { type: "string", example: "rgba(200, 255, 77, 0.28)" },
        },
      },
      Event: {
        allOf: [
          { $ref: "#/components/schemas/EventInput" },
          { type: "object", required: ["id", "availableSpots", "createdAt", "updatedAt"], properties: { id: { type: "string" }, availableSpots: { type: "integer" }, createdBy: { type: ["string", "null"] }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } },
        ],
      },
      MentorshipRequestInput: {
        type: "object",
        required: ["mentorId"],
        properties: { mentorId: { type: "string", example: "aygun-rzayeva" }, note: { type: "string", maxLength: 600, example: "Məhsul ideyam üçün istiqamət almaq istəyirəm." } },
      },
      TeacherReviewInput: {
        type: "object",
        required: ["teacherId", "course", "semester", "criteria"],
        properties: {
          teacherId: { type: "string", example: "nigar-huseynli" },
          course: { type: "string", example: "İngilis dili" },
          semester: { type: "string", example: "2026-payız" },
          criteria: { type: "object", required: ["clarity", "subjectKnowledge", "objectivity", "communication"], properties: { clarity: { type: "integer", minimum: 1, maximum: 5 }, subjectKnowledge: { type: "integer", minimum: 1, maximum: 5 }, objectivity: { type: "integer", minimum: 1, maximum: 5 }, communication: { type: "integer", minimum: 1, maximum: 5 } } },
        },
      },
      SupportTicketInput: {
        type: "object",
        required: ["name", "email", "topic", "message"],
        properties: { name: { type: "string", minLength: 2 }, email: { type: "string", format: "email" }, topic: { type: "string", minLength: 2 }, message: { type: "string", minLength: 20, maxLength: 2000 } },
      },
    },
  },
} as const;
