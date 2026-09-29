# EduRate təhlükəsizlik hesabatı

Tarix: 15 avqust 2026
Əhatə: Next.js BFF, Express API, PostgreSQL, autentifikasiya, rollar, moderasiya və mesajlaşma.

## Bağlanan əsas risklər

- Hər qorunan sorğuda istifadəçinin cari statusu və rolu database-dən yoxlanır.
- HttpOnly cookie mutasiyalarında eyni-origin/CSRF nəzarəti tətbiq olunur.
- Nonce əsaslı CSP, clickjacking, MIME sniffing və referrer müdafiələri aktivdir.
- Sorğu ölçüsü, JSON xətaları, timeout və lokal rate limit mövcuddur.
- Yeni sessiyalar serverdə hash edilmiş formada saxlanır, cihaz üzrə və toplu ləğv edilə bilir.
- Şifrə dəyişəndə digər sessiyalar ləğv olunur.
- E-poçt təsdiqi və şifrə bərpası tokenləri hash edilir, qısaömürlü və birdəfəlikdir.
- Production demo seed standart olaraq bağlıdır; əvvəlki demo kataloq məlumatları migration-la silinir.
- Rəylər yalnız aktiv tələbə hesabı, cari semestr və dörd pedaqoji meyar əsasında qəbul edilir.
- Mesajlar silinəndə audit üçün tombstone qalır; bloklama, səssizə alma və şikayət növbəsi mövcuddur.
- Məzmun şikayəti üzrə moderator, əsaslandırma, status və audit qeydi saxlanır.
- Swagger production-da standart olaraq bağlıdır.
- Dəstək forması girişsiz istifadə oluna bilər və saxta e-poçt ünvanı göstərilmir.
- Hüquqi razılıq ayrıca checkbox ilə (16+ təsdiqi daxil) alınır; şərt/məxfilik versiyası və qəbul vaxtı saxlanır, sənədlər yenilənəndə mövcud istifadəçilərdən yenidən razılıq istənir.
- Giriş və qeydiyyat e-poçta göndərilən 6 rəqəmli birdəfəlik kodla təsdiqlənir (hesab üzrə 5 səhv cəhddən sonra kilid, 60 saniyəlik yenidən göndərmə limiti); başqasının e-poçtu ilə hesab açmaq mümkün deyil.
- İstifadəçi öz məlumatlarının surətini yükləyə bilir (`GET /api/auth/account/export`, saatda 3 dəfə); başqa istifadəçilərin məlumatı və şifrə heşi daxil edilmir.

## Production genişlənməsindən əvvəl bloklayan risklər

1. Admin hesabları üçün TOTP MFA və bərpa kodları hələ tamamlanmayıb.
2. Rate limit və birdəfəlik realtime biletləri çox instansiyalı mühit üçün Redis-ə keçirilməyib.
3. `owner_admin` rolu və son owner-in silinməsinin qarşısını alan ayrıca model yoxdur.
4. Hesab dərhal anonimləşdirilir (push, bildiriş, şəkil silinir), lakin 30 günlük gözləmə pəncərəsi və legal-hold axını yoxdur.
5. Köhnə başlanğıc SQL-lərinin hamısı migration-only modelə keçirilməyib.
6. Müəllimin rəyə cavab və formal apellyasiya interfeysi tamamlanmayıb.
7. Operator və əlaqə ünvanı siyasətdə göstərilib (fərdi layihə); mətnlərin hüquqşünas tərəfindən təsdiqlənməsi təşkilati qərar gözləyir.
8. E-poçt kodu poçt xidmətindən asılıdır: göndərən domen təsdiqlənməyibsə (məs. Resend sınaq göndərici) yalnız hesab sahibinin ünvanına çatır və digər istifadəçilər daxil ola bilməz.

Bu səbəbdən hazır buraxılış nəzarətli, qeyri-rəsmi pilot kimi qiymətləndirilir; geniş ictimai production xidməti kimi elan edilməməlidir.

## Saxlanma prinsipləri

- Şikayət edilmiş məzmun: 180 günədək.
- Giriş sessiyaları: bitdikdən 7 gün, çıxışdan 30 gün sonra silinir; uğursuz giriş cəhdləri və giriş kodları 1 gün.
- Həll olunmuş dəstək müraciətləri: 2 ilə qədər; oxunmuş bildirişlər: 180 gün.
- Admin audit qeydləri: 365 günədək.
- Hüquqi tələb olduqda legal-hold ayrıca təşkilati qərarla tətbiq edilməlidir.

## Məcburi yoxlamalar

- frontend lint, test və production build;
- backend typecheck, test və build;
- hər iki workspace üçün yüksək riskli dependency audit;
- PostgreSQL migration və restore sınağı;
- mobil 390×844 və desktop 1440×900 smoke/E2E axınları;
- e-poçt təsdiqi, şifrə bərpası, sessiya ləğvi və rol testləri;
- şikayət, bloklama, silinmiş mesaj və moderasiya audit testləri;
- production CSP, CORS, cookie və health cavabları.

Əməliyyat addımları [PRODUCTION_RELEASE_CHECKLIST.md](PRODUCTION_RELEASE_CHECKLIST.md) faylında verilib.
