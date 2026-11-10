import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { FacilityRegisterForm } from "@/components/facility/facility-register-form";

export default async function FacilityRegisterPage() {
  await requireRole(["FACILITY_ADMIN"]);
  return (
    <div>
      <PageHeader title="창고(스튜디오) 등록" description="정보를 입력해 등록을 신청하세요. 최고관리자 승인 후 셀러에게 공개됩니다." />
      <FacilityRegisterForm />
    </div>
  );
}
