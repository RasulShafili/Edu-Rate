import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { PageHeader } from "../components/ui/Primitives";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("terms", { alternates: { canonical: "/terms" } });
}

export default function TermsPage() {
  return <main id="main-content" className="route-page legal-page" tabIndex={-1}><PageHeader id="terms-title" eyebrow="Hüquqi məlumat · 15 avqust 2026" title="İstifadə şərtləri" description="EduRate müstəqil pilotdur və universitetin rəsmi informasiya sistemi deyil." /><article><h2>Uyğunluq və hesab</h2><p>İstifadəçi doğru hesab məlumatı təqdim etməli, öz sessiyasını qorumalı və başqa şəxsin kimliyindən istifadə etməməlidir. Yetkinlik yaşına çatmayan istifadəçi qanuni nümayəndəsinin razılığı ilə istifadə etməlidir.</p><h2>Rəylər</h2><p>Müəllim rəyi yalnız şəxsi tədris təcrübəsinə və göstərilən pedaqoji meyarlara əsaslanmalıdır. Təhqir, böhtan, ayrı-seçkilik və şəxsi məlumat paylaşmaq qadağandır. Müəllim rəyə etiraz və yenidən baxılma tələb edə bilər.</p><h2>Mesaj və icma qaydaları</h2><p>Təhdid, təqib, spam və icazəsiz şəxsi məlumat paylaşımı qadağandır. İstifadəçi bloklama və şikayət vasitələrindən istifadə edə bilər. Mesajlaşma end-to-end şifrələnmiş xidmət kimi təqdim edilmir.</p><h2>Şəkil və müəllif hüquqları</h2><p>İstifadəçi yalnız paylaşmaq hüququna malik olduğu şəkli yükləyə bilər. Açıq-saçıq, zorakı, təhqiredici, saxta kimlik yaradan, zərərli və ya başqa şəxsin məxfiliyini pozan şəkillər qadağandır; belə məzmun xəbərdarlıq edilmədən silinə və hesab məhdudlaşdırıla bilər.</p><h2>Moderasiya və apellyasiya</h2><p>Qayda pozuntusu olduqda məzmun məhdudlaşdırıla, hesab dayandırıla və sübut audit məqsədi ilə saxlanıla bilər. Qərarla bağlı dəstək forması vasitəsilə yenidən baxılma istənilə bilər.</p><h2>Məhdudiyyət</h2><p>Pilot məlumatları rəsmi universitet qərarı, akademik arayış və ya hüquqi məsləhət hesab edilmir. Bu şərtlər production istifadəsindən əvvəl hüquqşünas tərəfindən təsdiqlənməlidir.</p></article></main>;
}
