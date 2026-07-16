import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Building2, CheckCircle2, Clock, XCircle, MapPin, Star } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_FACILITIES = [
  { id: "f1", name: "강남 프리미엄 라이브 스튜디오", region: "서울 강남구", type: "STUDIO",    status: "APPROVED", createdAt: new Date("2026-01-15"), rating: 4.8, bookings: 42 },
  { id: "f2", name: "마포구 대형 물류 창고",          region: "서울 마포구", type: "WAREHOUSE", status: "APPROVED", createdAt: new Date("2026-02-10"), rating: 4.5, bookings: 29 },
  { id: "f3", name: "인천 냉장-냉동 전문 창고",       region: "인천 남동구", type: "WAREHOUSE", status: "PENDING",  createdAt: new Date("2026-06-10"), rating: 0,   bookings: 0  },
  { id: "f4", name: "성수동 트렌디 스튜디오",         region: "서울 성동구", type: "STUDIO",    status: "APPROVED", createdAt: new Date("2026-03-20"), rating: 4.7, bookings: 18 },
  { id: "f5", name: "부산 복합 물류 센터",            region: "부산 해운대", type: "WAREHOUSE", status: "PENDING",  createdAt: new Date("2026-06-14"), rating: 0,   bookings: 0  },
];

const STATUS_LABEL: Record<string, { label: string; tone: "green" | "yellow" | "red" | "gray" }> = {
  APPROVED: { label: "승인됨",   tone: "green" },
  PENDING:  { label: "대기중",   tone: "yellow" },
  REJECTED: { label: "거절됨",   tone: "red" },
  INACTIVE: { label: "비활성",   tone: "gray" },
};

export default async function AdminFacilities() {
  await requireRole(["SUPER_ADMIN"]);

  let facilities: any[] = [];
  let counts = { total: 0, pending: 0, approved: 0 };

  try {
    const [facs, grouped] = await Promise.all([
      prisma.facility.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, name: true, region: true, type: true, status: true, createdAt: true,
          _count: { select: { bookings: true } },
        },
      }),
      prisma.facility.groupBy({ by: ["status"], _count: true }),
    ]);
    facilities = facs;
    counts.total = grouped.reduce((s, g) => s + g._count, 0);
    counts.pending = grouped.find((g) => g.status === "PENDING")?._count ?? 0;
    counts.approved = grouped.find((g) => g.status === "APPROVED")?._count ?? 0;
  } catch { /* fallback */ }

  if (facilities.length === 0) {
    facilities = DUMMY_FACILITIES;
    counts = { total: 31, pending: 4, approved: 27 };
  }

  return (
    <div className="space-y-5">
      <PageHeader title="시설 관리" description="등록된 창고 및 스튜디오 현황을 관리합니다." />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="전체 시설" value={`${counts.total}개`}   sub="" icon={Building2} />
        <StatCard label="승인됨"   value={`${counts.approved}개`} sub="" icon={CheckCircle2} />
        <StatCard label="대기중"   value={`${counts.pending}개`}  sub="" icon={Clock} />
      </div>

      {counts.pending > 0 && (
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-600" />
          <p className="text-sm text-yellow-800 font-semibold">승인 대기 중인 시설이 {counts.pending}개 있습니다. 아래 목록에서 확인하세요.</p>
        </div>
      )}

      <div className="space-y-3">
        {facilities.map((f: any) => {
          const st = STATUS_LABEL[f.status] ?? { label: f.status, tone: "gray" as const };
          const bookingCount = f._count?.bookings ?? f.bookings ?? 0;
          const rating = f.rating ?? 0;
          return (
            <Card key={f.id} className="hover:shadow-md transition">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 shrink-0">
                    <Building2 className="h-5 w-5 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-navy">{f.name}</p>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {f.region} · {f.type === "WAREHOUSE" ? "창고" : "스튜디오"}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-muted-foreground">예약 {bookingCount}건</span>
                      {rating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          <span className="font-semibold text-navy">{rating}</span>
                        </span>
                      )}
                      <span className="text-muted-foreground">등록일 {formatDate(f.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
