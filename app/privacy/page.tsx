import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { PageHeader } from "../components/ui/Primitives";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy", { alternates: { canonical: "/privacy" } });
}

export default function PrivacyPage() {
  return <main id="main-content" className="route-page legal-page" tabIndex={-1}><PageHeader id="privacy-title" eyebrow="Hüquqi məlumat · 15 avqust 2026" title="Məxfilik siyasəti" description="EduRate müstəqil tələbə pilotudur; Qarabağ Universitetinin rəsmi informasiya sistemi deyil." /><article><h2>Operator və pilot statusu</h2><p>EduRate tədris və təqdimat məqsədli müstəqil pilot layihədir. Operatorun hüquqi adı və rəsmi əlaqə ünvanı təsdiqlənmədən platforma rəsmi universitet xidməti kimi təqdim edilmir.</p><h2>Toplanan məlumatlar</h2><p>Hesab və profil məlumatları, profil/klub/elan şəkilləri, tədbir və klub iştirakları, müəllim qiymətləndirmələri, mentorluq müraciətləri, dəstək biletləri, əlaqələr, mesajlar və təhlükəsizlik qeydləri emal edilə bilər.</p><h2>Məqsəd və təminatçılar</h2><p>Məlumatlar xidmətin göstərilməsi, hesabın qorunması, moderasiya və xəta araşdırması üçün istifadə olunur. Hosting və məlumat bazası xidmətləri Vercel və Render, şəkillərin təhlükəsiz emalı və çatdırılması isə Cloudinary və onların infrastruktur təminatçıları üzərindən işləyə bilər.</p><h2>Saxlanma və hüquqların</h2><p>Hesabın, məlumatlarının surətinin, düzəlişin və silinmənin tələb edilməsi mümkündür. Şikayət edilmiş məzmun 180 günədək, təhlükəsizlik qeydləri 90 günədək, admin audit qeydləri 365 günədək saxlanıla bilər; hüquqi öhdəlik olduqda müddət uzadıla bilər.</p><h2>Əlaqə</h2><p>Məxfilik, məlumat düzəlişi və ya silinmə sorğusu üçün <a href="/support?topic=privacy">ictimai dəstək formasından</a> istifadə et. Bu mətn hüquqşünas təsdiqinə təqdim edilməlidir.</p></article></main>;
}
