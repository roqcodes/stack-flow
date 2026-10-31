import { ensureRequestScope } from "@/lib/request-scope";
import { getOperationalOverviewAction } from "@/modules/dashboard/actions";
import { HomeDashboard } from "@/components/dashboard/home-dashboard";

export const instant = false;

export default async function HomePage() {
  await ensureRequestScope();

  const { redirect } = await import("next/navigation");
  const { requireRole } = await import("@/modules/auth/auth-utils");
  const { profile } = await requireRole(["admin", "staff", "customer"]);
  if (profile.role === "customer") {
    redirect("/portal");
  }

  const overviewResult = await getOperationalOverviewAction();

  return (
    <HomeDashboard
      data={overviewResult.success ? overviewResult.data : null}
      errorMessage={overviewResult.success ? undefined : overviewResult.error.message}
    />
  );
}
