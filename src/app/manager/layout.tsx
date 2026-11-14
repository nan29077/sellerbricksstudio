import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { getAccountAvatar } from "@/lib/profile-server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "MANAGER") redirect(ROLE_HOME[u.role]);
  const { managerDisabled } = await getSettings();
  if (managerDisabled) redirect("/"); // 창고 운영 매니저 비활성화 시 모든 기능 중지
  const { src: avatarSrc } = await getAccountAvatar(u);
  return <DashboardShell role="MANAGER" roleLabel="창고 운영 매니저" userName={u.name ?? u.email} avatarSrc={avatarSrc}>{children}</DashboardShell>;
}
