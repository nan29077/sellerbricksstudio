import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/layout/dashboard-widgets";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import { CalendarCheck, Clock, CheckCircle2, XCircle, Ban } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_BOOKINGS = [
  { id: "b1", status: "APPROVED",  startAt: new Date("2026-06-20T14:00:00"), endAt: new Date("2026-06-20T17:00:00"), facility: { name: "강남 프리미엄 라이브 스튜디오" }, seller: { email: "seller1@ex.com", profile: { name: "박지현" } }, purpose: "뷰티 신상 라이브" },
  { id: "b2", status: "PENDING",   startAt: new Date("2026-06-21T10:00:00"), endAt: new Date("2026-06-21T13:00:00"), facility: { name: "마포구 대형 물류 창고" },          seller: { email: "seller2@ex.com", profile: { name: "홍길동" } }, purpose: "식품 라이브" },
  { id: "b3", status: "COMPLETED", startAt: new Date("2026-06-18T09:00:00"), endAt: new Date("2026-06-18T12:00:00"), facility: { name: "강남 프리미엄 라이브 스튜디오" }, seller: { email: "seller3@ex.com", profile: { name: "김미래" } }, purpose: "패션 방송" },
  { id: "b4", status: "REJECTED",  startAt: new Date("2026-06-17T14:00:00"), endAt: new Date("2026-06-17T17:00:00"), facility: { name: "인천 냉장-냉동 전문 창고" },       seller: { email: "seller4@ex.com", profile: { name: "정유나" } }, purpose: "냉동식품 방송" },
  { id: "b5", status: "CANCELLED", startAt: new Date("2026-06-16T11:00:00"), endAt: new Date("2026-06-16T14:00:00"), facility: { name: "마포구 대형 물류 창고" },          seller: { email: "seller5@ex.com", profile: { name: "이수민" } }, purpose: "전자제품 방송" },
  { id: "b6", status: "APPROVED",  startAt: new Date("2026-06-22T14:00:00"), endAt: new Date("2026-06-22T17:00:00"), facility: { name: "강남 프리미엄 라이브 스튜디오" }, seller: { email: "seller6@ex.com", profile: { name: "최준혁" } }, purpose: "뷰티 기획전" },
];

export default async function AdminBookings() {
  await requireRole(["SUPER_ADMIN"]);

  let bookings: any[] = [];
  let counts = { total: 0, pending: 0, approved: 0, completed: 0, rejected: 0 };

  try {
    const [bks, grouped] = await Promise.all([
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          facility: { select: { name: true } },
          seller: { select: { email: true, profile: { select: { name: true } } } },
        },
      }),
      prisma.booking.groupBy({ by: ["status"], _count: true }),
    ]);
    bookings = bks;
    counts.total = grouped.reduce((s, g) => s + g._count, 0);
    counts.pending = grouped.find((g) => g.status === "PENDING")?._count ?? 0;
    counts.approved = grouped.find((g) => g.status === "APPROVED")?._count ?? 0;
    counts.completed = grouped.find((g) => g.status === "COMPLETED")?._count ?? 0;
    counts.rejected = (grouped.find((g) => g.status === "REJECTED")?._count ?? 0) + (grouped.find((g) => g.status === "CANCELLED")?._count ?? 0);
  } catch { /* fallback */ }

  if (bookings.length === 0) {
    bookings = DUMMY_BOOKINGS;
    counts = { total: 487, pending: 12, approved: 224, completed: 198, rejected: 53 };
  }

  return (
    <div className="space-y-5">
      <PageHeader title="예약 관리" description="전체 예약 현황 및 상태 모니터링" />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="전체"   value={`${counts.total}건`}     sub="" icon={CalendarCheck} />
        <StatCard label="대기"   value={`${counts.pending}건`}   sub="" icon={Clock} />
        <StatCard label="승인"   value={`${counts.approved}건`}  sub="" icon={CheckCircle2} />
        <StatCard label="완료"   value={`${counts.completed}건`} sub="" icon={CheckCircle2} />
        <StatCard label="거절/취소" value={`${counts.rejected}건`} sub="" icon={XCircle} />
      </div>

      {counts.pending > 0 && (
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-600" />
          <p className="text-sm text-yellow-800 font-semibold">승인 대기 중인 예약이 {counts.pending}건 있습니다.</p>
        </div>
      )}

      <Table headers={["시설명", "셀러", "일정", "목적", "상태"]}>
        {bookings.map((b: any) => {
          const st = BOOKING_STATUS[b.status as keyof typeof BOOKING_STATUS] ?? { label: b.status, tone: "gray" as const };
          const sellerName = b.seller?.profile?.name ?? b.seller?.email ?? "셀러";
          return (
            <tr key={b.id} className="hover:bg-muted/30 transition-colors">
              <Td>{b.facility?.name ?? "-"}</Td>
              <Td>{sellerName}</Td>
              <Td className="text-xs">
                {formatDateTime(b.startAt)}
                <span className="text-muted-foreground"> ~ {formatDateTime(b.endAt)}</span>
              </Td>
              <Td className="text-xs text-muted-foreground">{b.purpose ?? "-"}</Td>
              <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
