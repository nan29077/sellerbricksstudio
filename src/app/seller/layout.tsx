import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { resolveProfileImageIndex } from "@/lib/profile-server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "SELLER") redirect(ROLE_HOME[u.role]);
  const { liveEnabled, facilityDisabled } = await getSettings();
  const profileImageIndex = await resolveProfileImageIndex(u);
  return <DashboardShell role="SELLER" roleLabel="셀러" userName={u.name ?? u.email} profileImageIndex={profileImageIndex} liveEnabled={liveEnabled} facilityDisabled={facilityDisabled}>{children}</DashboardShell>;
}
