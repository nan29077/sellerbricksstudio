import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { resolveProfileImageIndex } from "@/lib/profile-server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "SUPER_ADMIN") redirect(ROLE_HOME[u.role]);
  const profileImageIndex = await resolveProfileImageIndex(u);
  return <DashboardShell role="SUPER_ADMIN" roleLabel="최고관리자" userName={u.name ?? u.email} profileImageIndex={profileImageIndex}>{children}</DashboardShell>;
}
