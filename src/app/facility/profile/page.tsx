import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { FacilityProfileEdit } from "@/components/facility/facility-profile-edit";
import { formatKRW } from "@/lib/utils";
import {
  MapPin, Clock, Wallet, Star, CalendarCheck, TrendingUp,
  Building2, Tag, ExternalLink,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FacilityProfile() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let facilities: any[] = [];
  try {
    const ids = await ownedFacilityIds(user.id);
    facilities = await prisma.facility.findMany({
      where: { id: { in: ids } },
      include: {
        _count: { select: { bookings: true } },
        slots: { select: { id: true } },
      },
    });
  } catch {
    // DB 연결 실패 시 빈 배열
  }

  if (facilities.length === 0) {
    return (
      <div>
        <PageHeader title="시설 정보 · 편집" description="내 시설 프로필과 운영 현황을 관리하세요." />
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="등록된 시설이 없습니다"
          description="관리자에게 시설 등록을 요청하세요."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader title="시설 정보 · 편집" description="내 시설 프로필과 운영 현황을 관리하세요." />

      {facilities.map((f: any) => {
        const specialties = f.specialty
          ? f.specialty.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];

        return (
          <div key={f.id} className="space-y-4">
            {/* 메인 정보 카드 */}
            <Card>
              <CardContent className="pt-5">
                {/* 대표 이미지 */}
                {f.thumbnailUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={f.thumbnailUrl} alt={f.name} className="w-full h-52 object-cover rounded-2xl mb-5" />
                )}

                {/* 상태 + 이름 */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge tone={f.status === "APPROVED" ? "green" : "yellow"}>
                        {f.status === "APPROVED" ? "운영중" : "검토중"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {f.type === "STUDIO" ? "라이브 스튜디오" : "창고"}
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-navy">{f.name}</h2>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {f.address ?? f.region}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-navy">
                        {typeof f.rating === "number" ? f.rating.toFixed(1) : "-"}
                      </span>
                    </div>
                    {f.status === "APPROVED" && (
                      <Link
                        href={`/facilities/${f.id}`}
                        target="_blank"
                        className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                      >
                        시설 페이지 보기 <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* 운영 통계 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    {
                      label: "기본 이용료",
                      value: formatKRW(f.basePrice ?? 0),
                      icon: Wallet,
                    },
                    {
                      label: "총 예약 건수",
                      value: `${f._count?.bookings ?? 0}건`,
                      icon: CalendarCheck,
                    },
                    {
                      label: "예약 슬롯 수",
                      value: `${f.slots?.length ?? 0}개`,
                      icon: Clock,
                    },
                    {
                      label: "전문 분야 수",
                      value: `${specialties.length}개`,
                      icon: Tag,
                    },
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

                {/* 전문 분야 태그 미리보기 */}
                {specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {specialties.map((s: string) => (
                      <span key={s} className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                        {s} 전문
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 전문 분야 · 라이브 공간 편집 카드 */}
            <FacilityProfileEdit
              facilityId={f.id}
              initialSpecialty={f.specialty ?? ""}
              initialLiveSpaceInfo={f.liveSpaceInfo ?? ""}
              initialDescription={f.description ?? ""}
            />

            {/* 시설 페이지 편집 링크 */}
            <Card className="border-dashed">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-navy">시설 페이지 꾸미기</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      배너, 테마, 소개 문구, 장비 목록 등을 꾸밀 수 있습니다
                    </p>
                  </div>
                  <Link
                    href="/facility/pages"
                    className="flex items-center gap-1 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    페이지 꾸미기
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
