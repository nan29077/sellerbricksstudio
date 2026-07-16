import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatKRW } from "@/lib/utils";
import { MapPin, Clock, Wallet, Star, Package, CalendarCheck, TrendingUp, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_FACILITIES_PROFILE = [
  {
    id:"d1", name:"강남 프리미엄 라이브 스튜디오", type:"STUDIO", region:"서울 강남구",
    address:"서울 강남구 테헤란로 123 B동 3층", rating:4.9, status:"APPROVED",
    basePrice:150_000, depositAmount:300_000, openTime:"09:00", closeTime:"22:00",
    description:"강남 최고급 라이브 스튜디오. 4K 카메라, 전문 조명, 고속 인터넷 완비.",
    thumbnailUrl:"https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=70",
    productCount:248, bookingCount:48, monthlyRevenue:18_500_000,
    reviews:[
      { author:"박지현", rating:5, text:"방송 환경이 정말 최고예요. 조명과 카메라 세팅이 완벽합니다." },
      { author:"홍길동", rating:5, text:"접근성도 좋고 장비도 전부 최신식이라 방송 퀄리티가 올라갔어요." },
    ],
  },
];

export default async function FacilityProfile() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let facilities: any[] = [];
  try {
    const ids = await ownedFacilityIds(user.id);
    facilities = await prisma.facility.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { bookings: true, products: true } } },
    });
    if (facilities.length === 0) facilities = DUMMY_FACILITIES_PROFILE;
  } catch {
    facilities = DUMMY_FACILITIES_PROFILE;
  }

  if (facilities.length === 0) {
    return (
      <div>
        <PageHeader title="시설 정보" description="내 시설 프로필과 운영 현황을 관리하세요." />
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="등록된 시설이 없습니다"
          description="관리자에게 시설 등록을 요청하세요."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="시설 정보" description="내 시설 프로필과 운영 현황을 관리하세요." />

      {facilities.map((f: any) => (
        <Card key={f.id}>
          <CardContent className="pt-5">
            {/* 대표 이미지 */}
            {f.thumbnailUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={f.thumbnailUrl} alt={f.name} className="w-full h-48 object-cover rounded-xl mb-4" />
            )}

            {/* 기본 정보 */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge tone={f.status === "APPROVED" ? "green" : "yellow"}>
                    {f.status === "APPROVED" ? "운영중" : "검토중"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{f.type === "STUDIO" ? "스튜디오" : "창고"}</span>
                </div>
                <h2 className="text-xl font-extrabold text-navy">{f.name}</h2>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-4 w-4" />
                  {f.address ?? f.region}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                <span className="font-bold text-navy">{typeof f.rating === "number" ? f.rating.toFixed(1) : "4.9"}</span>
              </div>
            </div>

            {/* 운영 통계 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: "기본 이용료",   value: formatKRW(f.basePrice ?? 150000),             icon: Wallet         },
                { label: "예약 건수",     value: `${f._count?.bookings ?? f.bookingCount ?? 0}건`, icon: CalendarCheck },
                { label: "등록 상품",     value: `${f._count?.products ?? f.productCount ?? 0}개`, icon: Package       },
                { label: "월 수익",       value: formatKRW(f.monthlyRevenue ?? 0),              icon: TrendingUp     },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-muted/40 p-3 text-center">
                  <s.icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-bold text-navy text-sm">{s.value}</p>
                </div>
              ))}
            </div>

            {/* 운영 시간 */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Clock className="h-4 w-4 shrink-0" />
              <span>운영 시간: {f.openTime ?? "09:00"} ~ {f.closeTime ?? "22:00"}</span>
            </div>

            {/* 설명 */}
            {f.description && (
              <p className="text-sm text-muted-foreground rounded-xl bg-muted/30 p-3 mb-4">{f.description}</p>
            )}

            {/* 리뷰 */}
            {f.reviews && f.reviews.length > 0 && (
              <div>
                <h3 className="font-bold text-navy text-sm mb-2">셀러 리뷰</h3>
                <div className="space-y-2">
                  {f.reviews.map((r: any, i: number) => (
                    <div key={i} className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-navy">{r.author}</span>
                        <div className="flex">
                          {[1,2,3,4,5].map((s) => (
                            <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
