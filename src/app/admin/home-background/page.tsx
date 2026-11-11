import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { HomeBackgroundForm } from "@/components/admin/home-background-form";

export const dynamic = "force-dynamic";

export default async function HomeBackgroundPage() {
  await requireRole(["SUPER_ADMIN"]);
  const settings = await getSettings();

  return (
    <div>
      <PageHeader title="메인 여백 관리" description="메인페이지 양옆의 배경을 골라보세요. 인물이 있는 실사형 이미지와 따뜻한 일러스트를 준비했습니다." />
      <HomeBackgroundForm initial={settings.homeBackground} />
    </div>
  );
}
