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
  products: [
    { id: "fp1", isSellable: true, salePrice: 45000, consumerPrice: 65000, stock: 200, commissionType: "PERCENT", commissionValue: 15, product: { id: "p1", name: "퀄리티 뷰티 세럼 A", category: "뷰티", description: "피부 탄력 개선 세럼", thumbnailUrl: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&q=70" } },
    { id: "fp2", isSellable: true, salePrice: 28000, consumerPrice: 42000, stock: 350, commissionType: "PERCENT", commissionValue: 12, product: { id: "p2", name: "선크림 SPF50+ PA++++", category: "뷰티", description: "자외선 차단 선크림", thumbnailUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=300&q=70" } },
    { id: "fp3", isSellable: true, salePrice: 89000, consumerPrice: 120000, stock: 80, commissionType: "PERCENT", commissionValue: 18, product: { id: "p3", name: "홍삼 진액 선물세트", category: "건강식품", description: "6년근 고려 홍삼 진액", thumbnailUrl: "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=300&q=70" } },
    { id: "fp4", isSellable: true, salePrice: 35000, consumerPrice: 52000, stock: 150, commissionType: "PERCENT", commissionValue: 14, product: { id: "p4", name: "캐시미어 니트 가디건", category: "패션", description: "소프트 캐시미어 혼방 가디건", thumbnailUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=300&q=70" } },
    { id: "fp5", isSellable: true, salePrice: 12000, consumerPrice: 18000, stock: 500, commissionType: "PERCENT", commissionValue: 10, product: { id: "p5", name: "제주 감귤 2kg 박스", category: "식품", description: "신선한 제주 감귤", thumbnailUrl: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=300&q=70" } },
    { id: "fp6", isSellable: true, salePrice: 199000, consumerPrice: 280000, stock: 30, commissionType: "PERCENT", commissionValue: 20, product: { id: "p6", name: "에어프라이어 5.5L", category: "주방용품", description: "대용량 스마트 에어프라이어", thumbnailUrl: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=300&q=70" } },
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
        products: {
          where: { isSellable: true },
          include: { product: { include: { images: { take: 1 } } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch {
    /* DB 없을 때 dummy 사용 */
  }

  if (!f) {
    // params.id가 dummy id가 아니면 notFound()
    // demo 환경에서는 더미 데이터 사용
    f = { ...DUMMY_FACILITY, id: params.id };
  } else if (f.status !== "APPROVED") {
    notFound();
  }

  const pageConfig = await getFacilityPageConfig(f);
  return <FacilityStorefront facility={f} pageConfig={pageConfig} user={user} />;
}
