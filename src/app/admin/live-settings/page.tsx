import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { getSettings } from "@/lib/settings";
import { LiveSettingsToggle } from "@/components/admin/live-settings-toggle";
import { RoleAccessToggles } from "@/components/admin/role-access-toggles";

export const dynamic = "force-dynamic";

export default async function AdminLiveSettings() {
  await requireRole(["SUPER_ADMIN"]);
  const settings = await getSettings();

  return (
    <div className="space-y-5">
      <PageHeader title="메뉴 권한 설정" description="라이브 커머스 기능과 역할별 메뉴 권한을 제어합니다." />

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-navy">라이브 기능</h2>
        <LiveSettingsToggle initial={settings.liveEnabled} />
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
          스위치를 끄면 셀러와 창고 운영 화면의 메뉴에서 <b className="text-navy">라이브</b> 항목이 사라지고,
          라이브 관련 페이지 접근이 대시보드로 차단됩니다. 다시 켜면 즉시 복구됩니다.
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-navy">역할별 권한</h2>
        <RoleAccessToggles managerDisabled={settings.managerDisabled} />
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
          창고(스튜디오)는 스토리지마켓 본사가 직접 운영하므로 창고 관리자 회원은 없습니다. 창고 운영 매니저 계정은 매니저 관리에서 만들고 담당 창고를 지정합니다.
          스위치를 끄면 즉시 복구됩니다.
        </div>
      </div>
    </div>
  );
}
