import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClubDetailExperience } from "../../components/ClubDetailExperience";
import { clubFromApi, type Club, type ClubApiRecord } from "../../data/clubs";
import { ApiHttpError } from "../../lib/api/http";
import { remoteCredentialCookieName, requestRemoteApi } from "../../lib/auth/remote-credential";

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
    // `notFound()` bu Next.js quraşdırmasında 200 statusu ilə cavab verir —
    // sadə yoxlama marşrutunda da eyni davranış var, yəni səbəb bu səhifə
    // deyil. Axtarış sistemlərinin "tapılmadı" səhifəsini indeksləməməsi üçün
    // açıq şəkildə qadağan edilir.
    return { title: "Klub tapılmadı — EduRate", robots: { index: false, follow: false } };
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
    return (
      <main id="main-content" className="route-page global-route-state is-error" tabIndex={-1}>
        <span>Klub açılmadı</span>
        <h1>Klub məlumatı yüklənmədi.</h1>
        <p>Server cavab vermədi. Bu, klubun silindiyi demək deyil — bir qədər sonra yenidən yoxla.</p>
        <div>
          <Link href="/clubs">Bütün klublar</Link>
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
