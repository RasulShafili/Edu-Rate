import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { redirect } from "next/navigation";
import { AdminAccessState } from "../components/AdminAccessState";
import { ApiExplorer } from "../components/ApiExplorer";
import { resolveAdminAccess } from "../lib/auth/admin-access";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("apiDocs", { robots: { index: false, follow: false } });
}

export default async function ApiDocsPage() {
  const access = await resolveAdminAccess();
  if (access.status === "signed-out") redirect("/auth?returnTo=%2Fapi-docs");
  return access.status === "granted" ? <ApiExplorer /> : <AdminAccessState access={access} />;
}
