# EduRate

EduRate universitet həyatı üçün hazırlanmış Azərbaycan dilli, müstəqil tələbə pilotudur. Layihə Qarabağ Universitetinin rəsmi informasiya sistemi deyil və universitet adından xidmət göstərmir.

## Hazır imkanlar

- tələbə və müəllim qeydiyyatı, giriş, e-poçt təsdiqi və şifrə bərpası;
- ləğv edilə bilən cihaz sessiyaları;
- tədbirlər, elanlar, klublar, mentorluq və müəllim qiymətləndirməsi;
- şəxsi və klub söhbətləri, bloklama, səssizə alma və şikayət;
- dəstək biletləri və ictimai məxfilik sorğusu;
- admin CRUD, rəy və məzmun moderasiyası, audit qeydləri.
- loading, empty, error və responsive vəziyyətlər.

Müəllim rəyləri şəxsin özü haqqında deyil, izahın aydınlığı, fənn biliyi, obyektivlik, ünsiyyət və dəstək meyarları üzrə verilir. Mesajlaşma end-to-end şifrələnmiş xidmət kimi təqdim edilmir.

## Texnologiyalar

- Next.js 16, React 19, TypeScript, Tailwind CSS və Framer Motion
- Node.js, Express, PostgreSQL və Socket.IO
- HttpOnly cookie əsaslı BFF, OpenAPI 3.1 və versiyalı database migration-ları
- Vercel frontend və Render backend

## Lokal işə salma

Node.js 22.13 və ya daha yeni versiya lazımdır.

```bash
npm install
npm run dev
```

Backend ayrıca başladılır:

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Frontend `http://localhost:3000`, backend `http://localhost:3001` ünvanında açılır.

Frontend mühit dəyişənləri:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EDURATE_APP_ORIGIN=http://localhost:3000
EDURATE_API_BASE_URL=http://localhost:3001
```

Backend üçün əsas production dəyişənləri `backend/.env.example` faylında göstərilib. Demo məlumat yalnız development/test mühitində açıq razılıqla aktivləşdirilməlidir:

```env
SEED_DEMO_DATA=true
```

Production-da bu dəyişən `false` qalmalıdır. E-poçt təsdiqi üçün `BREVO_API_KEY` (və ya `RESEND_API_KEY`), `EMAIL_FROM` və `PUBLIC_APP_URL` təyin edilməlidir. Domen olmayan pilot mühitində Brevo-da ayrıca təsdiqlənmiş sender ünvanı istifadə oluna bilər. Swagger production-da standart olaraq bağlıdır; yalnız nəzarətli texniki mühitdə `SWAGGER_PUBLIC=true` istifadə edilə bilər.

Profil, klub və elan şəkilləri tətbiq serverinin diskində saxlanmır. Cloudinary-də `edurate-secure` adlı **signed** upload preset yaradın; yalnız `jpg,jpeg,png,webp` formatlarını qəbul edin və maksimum ölçünü 5 MB edin. Sonra Render-də bunları əlavə edin:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=edurate-secure
```

API secret heç vaxt Vercel və ya brauzer dəyişəni kimi yazılmamalıdır. Profil şəkli üçün tətbiq əlavə olaraq 2 MB və 512×512, klub/elan şəkli üçün 5 MB və 1600×1600 limitini serverdə yenidən yoxlayır. SVG, GIF və aktiv məzmun qəbul edilmir; fayl adları server tərəfindən yaradılır və metadata təmizlənir.

## Yoxlama

```bash
npm run lint
npm test
npm run build
cd backend
npm run typecheck
npm test
npm run build
```

## Production buraxılış sırası

1. PostgreSQL backup yaradın və bərpa sınağını yoxlayın.
2. Migration-ları backup-dan sonra tətbiq edin.
3. Backend-i deploy edin və `/api/health` yoxlamasını keçirin.
4. Frontend-i deploy edin.
5. Qeydiyyat, təsdiq, şifrə bərpası, rol, rəy, şikayət və chat smoke testlərini icra edin.

## Hüquqi və əməliyyat qeydləri

- Məxfilik siyasəti, İstifadə şərtləri, Kuki siyasəti və İcma qaydaları (`app/legal/`) Azərbaycan qanunvericiliyinə uyğun hazırlanıb, lakin production yayımdan əvvəl Azərbaycan hüquqşünası tərəfindən təsdiqlənməlidir.
- Operator: Rəsul Şəfili (fərdi layihə), əlaqə: edurate111@gmail.com. Geniş ictimai production xidməti kimi təqdim etməzdən əvvəl bunun rəsmi təşkilat qərarı ilə təsdiqlənməsi lazımdır.
- Giriş və qeydiyyat e-poçt koduyla təsdiqlənir: poçt xidməti (Brevo/Resend) istənilən alıcıya çatdırmalıdır (təsdiqlənmiş göndərən/domen). Problem olarsa `EMAIL_LOGIN_CODE=false` müvəqqəti həll yoludur.
- Redis əsaslı paylanmış rate-limit/realtime token store və admin MFA production genişlənməsindən əvvəl tamamlanmalıdır.
- Məlumat bazası backup, secret rotasiyası, insident cavabı və moderasiya məsul şəxsləri təşkilati qaydada təyin edilməlidir.

Ətraflı təhlükəsizlik nəticələri: [docs/security_best_practices_report.md](docs/security_best_practices_report.md).
