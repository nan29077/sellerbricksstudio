import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getFacilityPageConfig } from "@/lib/facility-page";
import { FacilityStorefront } from "@/components/facility/facility-storefront";

export const dynamic = "force-dynamic";

const DUMMY_FACILITY = {
  id: "d1",
  name: "강남 프리미엄 라이브 스튜디오",
  type: "STUDIO",
  status: "APPROVED",
  region: "서울 강남구",
  address: "서울 강남구 테헤란로 123 8층",
  specialty: "의류,코스메틱,패션잡화",
  liveSpaceInfo: `메인 스튜디오: 65㎡, 크로마키 배경, 4K 카메라 3대, 링라이트 세트\n부속 공간: 의상 준비실, 분장실 별도 제공\n조명: 전문 조명 시스템 완비 (색온도 조절 가능)`,
  description: `국내 최고 수준의 라이브 커머스 전용 스튜디오입니다.

전문 방송 장비와 완벽한 조명 시스템을 갖추고 있어 셀러가 방송에만 집중할 수 있는 환경을 제공합니다.
그린스크린 배경 교체, 다채널 카메라, 고속 인터넷(1Gbps)이 기본 제공됩니다.

방송 중 스태프 1인 상시 대기하며 기술적 지원을 드립니다.`,
  equipment: "전문 카메라 3대, LED 조명 시스템, 그린스크린, 고속 인터넷 1Gbps, 음향장비, 모니터 4대",
  openTime: "09:00",
  closeTime: "22:00",
  basePrice: 150000,
  rating: 4.9,
  thumbnailUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80&auto=format&fit=crop",
  images: [
    { id: "i1", url: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&q=70&auto=format&fit=crop", sortOrder: 1 },
    { id: "i2", url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=70&auto=format&fit=crop", sortOrder: 2 },
    { id: "i3", url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=70&auto=format&fit=crop", sortOrder: 3 },
  ],
  slots: [
    { id: "s1", weekday: 1, startTime: "09:00", endTime: "13:00", price: 150000, isActive: true },
    { id: "s2", weekday: 1, startTime: "14:00", endTime: "18:00", price: 150000, isActive: true },
    { id: "s3", weekday: 2, startTime: "09:00", endTime: "13:00", price: 150000, isActive: true },
    { id: "s4", weekday: 5, startTime: "10:00", endTime: "22:00", price: 130000, isActive: true },
    { id: "s5", weekday: 6, startTime: "10:00", endTime: "22:00", price: 130000, isActive: true },
  ],
};

export default async function FacilityDetail({ params }: { params: { id: string } }) {
  let f: any = null;
  const user = await getSessionUser();

  try {
    f = await prisma.facility.findUnique({
      where: { id: params.id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        slots: { where: { isActive: true }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
      },
    });
  } catch {
    /* DB 없을 때 dummy 사용 */
  }

  if (!f) {
    f = { ...DUMMY_FACILITY, id: params.id };
  } else if (f.status !== "APPROVED") {
    notFound();
  }

  const pageConfig = await getFacilityPageConfig(f);
  return <FacilityStorefront facility={f} pageConfig={pageConfig} user={user} />;
}
