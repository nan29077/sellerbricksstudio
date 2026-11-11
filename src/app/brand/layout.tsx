import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionUser } from "@/lib/auth";
import { getAccountAvatar } from "@/lib/profile-server";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/rbac";

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "BRAND_ADMIN") redirect(ROLE_HOME[user.role]);
  const avatar = await getAccountAvatar(user);
  return <DashboardShell role={user.role} roleLabel={ROLE_LABELS[user.role]} userName={user.name ?? user.email} avatarSrc={avatar.src}>{children}</DashboardShell>;
}
