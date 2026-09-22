import type { Metadata, Viewport } from "next";
import { AuthProvider } from "./components/AuthProvider";
import { PlatformProvider } from "./components/PlatformProvider";
import { PlatformShell } from "./components/PlatformShell";
import { createIdentityProfile } from "./data/user";
import { cookies } from "next/headers";
import { getServerRequestIdentity } from "./lib/auth/request-identity";
import { languageCookieName, normalizeLanguage } from "./i18n/config";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { getCanonicalSiteOrigin } from "./lib/site-origin";
import "./globals.css";
import "./kuds.css";
import "./creative.css";

const title = "EduRate — Universitet həyatın bir yerdə.";
const description =
  "Tədbirləri, tələbə klublarını, etibarlı icma əlaqələrini, mentorluğu, müəllim qiymətləndirməsini və ağıllı idarəetməni bir araya gətirən öyrənmə platforması.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16423c",
};

export function generateMetadata(): Metadata {
  const origin = getCanonicalSiteOrigin();
  const socialImage = `${origin}/og.jpg`;

  return {
    metadataBase: new URL(origin),
    title,
    description,
    applicationName: "EduRate",
    keywords: ["EduRate", "universitet", "tələbə", "tədbirlər", "mentor", "klublar"],
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "EduRate", statusBarStyle: "default" },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "az_AZ",
      url: origin,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: "EduRate universitet şəbəkəsi",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  // Dil serverde oxunur ki, <html lang> ve ilk render dogru dilde olsun.
  const language = normalizeLanguage(cookieStore.get(languageCookieName)?.value);
  const requestIdentity = await getServerRequestIdentity();
  // Server bütün istifadəçini artıq alıb: əvvəl ondan yalnız ad, e-poçt və rol
  // götürülürdü, qalan sahələr yer tutucu idi — profil hər açılışda əvvəlcə
  // "məlumat əlavə edilməyib" göstərir, sonra brauzerdə dəyişirdi.
  const initialUser = requestIdentity?.profile ?? (requestIdentity
    ? {
        ...createIdentityProfile(requestIdentity.displayName, requestIdentity.email),
        accessRole: requestIdentity.role ?? "student",
        role: requestIdentity.role === "teacher" ? "Müəllim" as const : requestIdentity.role === "mentor" ? "Mentor" as const : requestIdentity.role === "owner_admin" || requestIdentity.role === "admin" || requestIdentity.role === "assistant_admin" ? "Rəhbərlik" as const : "Tələbə" as const,
      }
    : null);
  return (
    <html lang={language} data-scroll-behavior="smooth">
      <body className="antialiased">
        <LanguageProvider initialLanguage={language}>
        <AuthProvider
          initialUser={initialUser}
        >
          <PlatformProvider>
            <PlatformShell>{children}</PlatformShell>
          </PlatformProvider>
        </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
