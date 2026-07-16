import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { getSettings } from "@/lib/settings";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSiteSettings() {
  await requireRole(["SUPER_ADMIN"]);
  const settings = await getSettings();

  return (
    <div className="space-y-5">
      <PageHeader title="사이트 설정" description="배너와 사이트 기본 정보를 관리합니다." />
      <SiteSettingsForm initial={settings} />
    </div>
  );
}
