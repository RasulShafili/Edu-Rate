import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClubDetailExperience } from "../../components/ClubDetailExperience";
import { clubFromApi, type Club, type ClubApiRecord } from "../../data/clubs";
import { ApiHttpError } from "../../lib/api/http";
import { remoteCredentialCookieName, requestRemoteApi } from "../../lib/auth/remote-credential";
import { getServerT } from "../../i18n/server";

type ClubDetailPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Klubun yüklənməsi üç ayrı haldır.
 *
 * Əvvəl hamısı `catch(() => null)` ilə birləşdirilirdi: backend cavab
 * verməyəndə istifadəçi "Klub tapılmadı" görürdü, yəni müvəqqəti nasazlıq
 * klubun silindiyi kimi təqdim olunurdu.
 */
type ClubLoad =
  | { state: "ok"; club: Club }
  | { state: "missing" }
  | { state: "error" };

async function loadClub(slug: string): Promise<ClubLoad> {
  // Yoxlanışdakı klubu yalnız onu yaradan, klub liderləri və rəhbərlik görə
  // bilir, ona görə sorğu istifadəçinin öz tokeni ilə gedir.
  const token = (await cookies()).get(remoteCredentialCookieName)?.value;
  try {
    const record = await requestRemoteApi<ClubApiRecord>(
      `/api/clubs/${encodeURIComponent(slug)}`,
      { token },
    );
    return { state: "ok", club: clubFromApi(record) };
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 404) return { state: "missing" };
    return { state: "error" };
  }
}

export async function generateMetadata({ params }: ClubDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadClub(slug);

  if (result.state !== "ok") {
    // `notFound()` burada 200 ilə cavab verir. Səbəb Next.js deyil, kök
    // `app/loading.tsx`-dir: səhifə axın kimi göndərilir və status kod işləməmişdən
    // yazılır (fayl müvəqqəti götürüləndə eyni sorğu 404 verdi; metadata-da
    // `notFound()` da kömək etmədi — botlar üçün də 200). Ona görə indeksləmə
    // açıq şəkildə qadağan edilir.
    const t = await getServerT();
    return { title: t("meta.clubNotFound.title"), robots: { index: false, follow: false } };
  }

  return {
    title: `${result.club.name} — EduRate`,
    description: result.club.description,
    // Yoxlanışdakı klub ictimai deyil — indeksləməyə göndərilməməlidir.
    ...(result.club.status === "Aktiv" ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { slug } = await params;
  const result = await loadClub(slug);

  if (result.state === "missing") {
    notFound();
  }

  if (result.state === "error") {
    const t = await getServerT();
    return (
      <main id="main-content" className="route-page global-route-state is-error" tabIndex={-1}>
        <span>{t("club.loadError.eyebrow")}</span>
        <h1>{t("club.loadError.title")}</h1>
        <p>{t("club.loadError.text")}</p>
        <div>
          <Link href="/clubs">{t("club.loadError.back")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <ClubDetailExperience club={result.club} />
    </main>
  );
}
