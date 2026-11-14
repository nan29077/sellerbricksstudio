import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { getAccountAvatar } from "@/lib/profile-server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

// 창고 운영 콘솔 — 창고(스튜디오) 계정은 없다. 최고관리자는 모든 창고, 창고 운영 매니저는 담당 창고만 운영한다.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "SUPER_ADMIN" && u.role !== "MANAGER") redirect(ROLE_HOME[u.role]);
  const { liveEnabled, managerDisabled } = await getSettings();
  if (u.role === "MANAGER" && managerDisabled) redirect("/"); // 창고 운영 매니저 비활성화 시 모든 기능 중지
  const { src: avatarSrc } = await getAccountAvatar(u);
  const admin = u.role === "SUPER_ADMIN";
  return (
    <DashboardShell role={admin ? "FACILITY_OPS" : "FACILITY_OPS_MANAGER"} roleLabel={admin ? "창고 운영 · 최고관리자" : "창고 운영 매니저"}
      userName={u.name ?? u.email} avatarSrc={avatarSrc} liveEnabled={liveEnabled}>
      {children}
    </DashboardShell>
  );
}
