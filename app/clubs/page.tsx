import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { cookies } from "next/headers";
import { ClubsExperience } from "../components/ClubsExperience";
import { clubFromApi, type ClubApiRecord } from "../data/clubs";
import { remoteCredentialCookieName, requestRemoteApi } from "../lib/auth/remote-credential";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("clubs", { alternates: { canonical: "/clubs" } });
}

export default async function ClubsPage() {
  const token = (await cookies()).get(remoteCredentialCookieName)?.value;

  const [result, mine] = await Promise.all([
    requestRemoteApi<ClubApiRecord[]>("/api/clubs")
      .then((items) => ({ clubs: items.map(clubFromApi), failed: false }))
      .catch(() => ({ clubs: [], failed: true })),
    // Kataloq yalnız "Aktiv" klubları göstərir. Yeni yaradılan klub isə
    // "Gözləmədə" statusu ilə açılır, yəni yaradan onu heç yerdə görmürdü.
    // Öz üzvlüklərindən yoxlanışda olanları ayrıca göstəririk.
    token
      ? requestRemoteApi<ClubApiRecord[]>("/api/clubs/memberships/me", { token })
          .then((items) => items.filter((club) => club.status !== "Aktiv").map(clubFromApi))
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <ClubsExperience clubs={result.clubs} failed={result.failed} pendingClubs={mine} />
    </main>
  );
}
