import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { resolveProfileImageIndex } from "@/lib/profile-server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "MANAGER") redirect(ROLE_HOME[u.role]);
  const { managerDisabled } = await getSettings();
  if (managerDisabled) redirect("/"); // 중간관리자 비활성화 시 모든 기능 중지
  const profileImageIndex = await resolveProfileImageIndex(u);
  return <DashboardShell role="MANAGER" roleLabel="중간관리자" userName={u.name ?? u.email} profileImageIndex={profileImageIndex}>{children}</DashboardShell>;
}
