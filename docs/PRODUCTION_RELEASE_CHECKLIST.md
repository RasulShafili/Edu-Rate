# EduRate production buraxılış nəzarəti

## Buraxılışı bloklayan tələblər

- `SEED_DEMO_DATA=false` olmalıdır.
- `BREVO_API_KEY` və ya `RESEND_API_KEY`, təsdiqlənmiş `EMAIL_FROM` və real `PUBLIC_APP_URL` verilməlidir.
- **Giriş və qeydiyyat e-poçt koduyla təsdiqlənir**, ona görə poçt xidməti İSTƏNİLƏN alıcıya çatdırmalıdır. Resend-in `onboarding@resend.dev` göndəricisi yalnız hesab sahibinin öz ünvanına göndərir; təsdiqlənmiş domen (Resend) və ya təsdiqlənmiş göndərən (Brevo) lazımdır. Buraxılışdan əvvəl kodu 2–3 fərqli Gmail ünvanına göndərib yoxlayın. Poçt sıradan çıxarsa, Render-də `EMAIL_LOGIN_CODE=false` girişi müvəqqəti köhnə qaydaya qaytarır.
- Güclü, ayrıca saxlanan `JWT_SECRET` istifadə edilməlidir.
- PostgreSQL backup yaradılmalı və restore sınağı sənədləşdirilməlidir.
- Operator (Rəsul Şəfili, fərdi layihə) və əlaqə (edurate111@gmail.com) sənədlərdə göstərilib; Məxfilik siyasəti, İstifadə şərtləri, Kuki siyasəti və İcma qaydaları hüquqşünas tərəfindən təsdiqlənməlidir. Mətn dəyişəndə `app/legal/version.ts` və `backend/src/lib/legal.ts` versiyası birlikdə artırılır (istifadəçilərdən yenidən razılıq alınır).
- Admin MFA və paylanmış rate limit tamamlanmadan geniş ictimai açılış edilməməlidir.

## Deploy sırası

1. Database backup.
2. Migration tətbiqi.
3. Backend deploy və health yoxlaması.
4. Frontend deploy.
5. Auth (e-poçt kodu ilə giriş və qeydiyyat), rol, rəy, mentorluq, klub, tədbir, şikayət, chat, "Məlumatlarımı yüklə" və hüquqi razılıq pəncərəsi smoke testləri.

## Geri dönüş

Migration uğursuz olarsa frontend deploy dayandırılır. Backend əvvəlki işlək versiyaya qaytarılır və database yalnız təsdiqlənmiş backup proseduru ilə bərpa edilir. Məlumat itkisi ehtimalında yeni yazma əməliyyatları müvəqqəti bağlanır və insident qeydi açılır.

## Məlum production hardening borcu

- Admin üçün TOTP MFA və recovery kodları.
- Redis əsaslı shared rate limit və birdəfəlik realtime biletləri.
- `owner_admin` və son owner qoruması.
- Server başlanğıc SQL-lərinin tam migration-only modelə keçirilməsi.
- Hesab silinməsi indi dərhal anonimləşdirir (push abunələri, bildirişlər və profil şəkli də silinir); 30 günlük gözləmə pəncərəsi və legal-hold əməliyyatları hələ yoxdur.
- Müəllim etiraz/cavab interfeysi və hüquqi apellyasiya SLA-sı.

Bu maddələr bağlanmadan layihə “tam hüquqi production sistemi” deyil, nəzarətli pilot kimi saxlanmalıdır.
