import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { FacilityRegisterForm } from "@/components/facility/facility-register-form";

export default async function FacilityRegisterPage() {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  if (user.role !== "SUPER_ADMIN") redirect("/facility/dashboard"); // 공간 등록은 최고관리자만
  return (
    <div>
      <PageHeader title="공간 등록" description="스토리지마켓 직영 창고 · 스튜디오 · 쇼룸 또는 제휴 창고를 등록합니다. 바로 공개하거나 비공개(준비 중)로 저장한 뒤 공개할 수 있습니다." />
      <FacilityRegisterForm />
    </div>
  );
}
