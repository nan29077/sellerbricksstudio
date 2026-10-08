"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Warehouse, CheckCircle2, type LucideIcon } from "lucide-react";

type ToggleRowProps = {
  settingKey: "managerDisabled" | "facilityDisabled";
  title: string;
  icon: LucideIcon;
  descOn: string;
  descOff: string;
  initial: boolean;
};

function ToggleRow({ settingKey, title, icon: Icon, descOn, descOff, initial }: ToggleRowProps) {
  const router = useRouter();
  const [on, setOn] = useState(initial); // on = 비활성화 상태
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true); setSaved(false);
    setOn(next); // 낙관적 업데이트
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [settingKey]: next }),
    });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) {
      setOn(!next); // 롤백
      alert(json.error ?? "저장에 실패했습니다.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${on ? "bg-red-50" : "bg-muted"}`}>
              <Icon className={`h-5 w-5 ${on ? "text-red-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-semibold text-navy">{title} {on ? "적용됨" : "해제됨"}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{on ? descOn : descOff}</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={toggle}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-red-500" : "bg-muted-foreground/30"}`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
        {saved && (
          <p className="mt-4 flex items-center gap-1 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />저장되었습니다. 사용자 화면에 즉시 반영됩니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function RoleAccessToggles({
  managerDisabled,
  facilityDisabled,
}: {
  managerDisabled: boolean;
  facilityDisabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <ToggleRow
        settingKey="managerDisabled"
        title="중간관리자 비활성화"
        icon={Briefcase}
        descOn="중간관리자 계정의 모든 기능이 중지되고, 로그인·회원가입 화면에서 해당 역할이 숨겨집니다."
        descOff="중간관리자 계정이 정상적으로 이용 가능합니다."
        initial={managerDisabled}
      />
      <ToggleRow
        settingKey="facilityDisabled"
        title="시설이용자 비활성화"
        icon={Warehouse}
        descOn="창고(스튜디오) 관리자 계정의 모든 기능이 중지되고, 로그인·회원가입 화면 및 셀러의 예약·시설 예약·주문 관리 메뉴가 숨겨집니다."
        descOff="창고(스튜디오) 관리자 계정이 정상적으로 이용 가능합니다."
        initial={facilityDisabled}
      />
    </div>
  );
}
