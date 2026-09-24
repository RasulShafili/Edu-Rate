import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { redirect } from "next/navigation";
import { RoleWorkspace } from "../components/RoleWorkspace";
import { getServerRequestIdentity } from "../lib/auth/request-identity";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("workspace");
}

export default async function WorkspacePage() {
  const identity = await getServerRequestIdentity();
  if (!identity) redirect("/auth?returnTo=/workspace");
  if (identity.role === "owner_admin" || identity.role === "admin" || identity.role === "assistant_admin") redirect("/admin");
  return <main id="main-content" className="route-page" tabIndex={-1}><RoleWorkspace /></main>;
}
