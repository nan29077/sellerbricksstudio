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
          스위치를 끄면 셀러·창고(스튜디오) 관리자의 좌측 메뉴에서 <b className="text-navy">라이브</b> 항목이 사라지고,
          라이브 관련 페이지 접근이 대시보드로 차단됩니다. 다시 켜면 즉시 복구됩니다.
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-navy">역할별 권한</h2>
        <RoleAccessToggles
          managerDisabled={settings.managerDisabled}
          facilityDisabled={settings.facilityDisabled}
        />
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
          비활성화 스위치를 켜면 해당 역할 계정의 모든 기능이 중지되고, 로그인·회원가입 화면에서 해당 역할 옵션이 숨겨집니다.
          <b className="text-navy"> 시설이용자 비활성화</b> 시 셀러 계정의 <b className="text-navy">예약 · 시설 예약 · 주문 관리</b> 메뉴도 함께 숨겨집니다.
          스위치를 끄면 즉시 복구됩니다.
        </div>
      </div>
    </div>
  );
}
