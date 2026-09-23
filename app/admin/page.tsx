import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminAccessState } from "../components/AdminAccessState";
import { AdminDashboard } from "../components/AdminDashboard";
import { resolveAdminAccess } from "../lib/auth/admin-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İdarəetmə mərkəzi — EduRate",
  description:
    "EduRate istifadəçilərini, klublarını, tədbirlərini və platforma göstəricilərini vahid idarəetmə mərkəzindən izlə.",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const access = await resolveAdminAccess({ allowAssistant: true });
  if (access.status === "signed-out") redirect(access.signInHref);

  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      {access.status === "granted" ? (
        <AdminDashboard administrator={access.principal} />
      ) : (
        <AdminAccessState access={access} />
      )}
    </main>
  );
}
