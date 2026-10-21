import { redirect } from "next/navigation";
import { resolveServerIdentity } from "../lib/auth/request-identity";

export default async function WorkspacePage() {
  const identity = await resolveServerIdentity();
  if (identity && identity !== "unavailable" && (identity.role === "owner_admin" || identity.role === "admin" || identity.role === "assistant_admin")) {
    redirect("/admin");
  }
  redirect("/profile");
}
