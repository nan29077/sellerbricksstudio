import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { getAccountAvatar } from "@/lib/profile-server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "SELLER") redirect(ROLE_HOME[u.role]);
  const { liveEnabled } = await getSettings();
  const { src: avatarSrc } = await getAccountAvatar(u);
  return <DashboardShell role="SELLER" roleLabel="셀러" userName={u.name ?? u.email} avatarSrc={avatarSrc} liveEnabled={liveEnabled}>{children}</DashboardShell>;
}
