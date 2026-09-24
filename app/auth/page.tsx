import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { AuthExperience } from "../components/AuthExperience";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("auth", { alternates: { canonical: "/auth" }, robots: { index: false, follow: false } });
}

type AuthPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const query = await searchParams;
  const initialMode = query.mode === "register" ? "register" : "login";
  const requestedReturnTo = typeof query.returnTo === "string" ? query.returnTo : "/profile";
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
    ? requestedReturnTo
    : "/profile";

  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <AuthExperience initialMode={initialMode} returnTo={returnTo} />
    </main>
  );
}
