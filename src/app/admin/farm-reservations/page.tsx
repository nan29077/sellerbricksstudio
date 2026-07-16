"use client";
import { useState } from "react";
import {
  Building2, CalendarCheck, Clock, CheckCircle2, XCircle, Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/dashboard-widgets";

/* ───── 타입 ───── */
type Status = "PENDING" | "APPROVED" | "REJECTED";
type TypeFilter = "ALL" | "농장" | "목장" | "가공공장" | "물류창고" | "촬영스튜디오" | "선별창고";

interface Reservation {
  id: string;
  facilityName: string;
  facilityType: string;
  sellerName: string;
  date: string;
  visitors: number;
  purpose: string;
  status: Status;
}

/* ───── 더미 데이터 ───── */
const DUMMY_RESERVATIONS: Reservation[] = [
  { id: "r1", facilityName: "고창 복분자 농장",     facilityType: "농장",        sellerName: "박지현", date: "2026-07-15", visitors: 3, purpose: "콘텐츠 촬영", status: "APPROVED" },
  { id: "r2", facilityName: "제주 감귤 농장",       facilityType: "농장",        sellerName: "홍길동", date: "2026-07-18", visitors: 5, purpose: "라이브 방송", status: "PENDING"  },
  { id: "r3", facilityName: "서울 라이브 스튜디오", facilityType: "촬영스튜디오", sellerName: "김미래", date: "2026-07-20", visitors: 2, purpose: "라이브 방송", status: "PENDING"  },
  { id: "r4", facilityName: "경기 물류 창고",       facilityType: "물류창고",    sellerName: "이수민", date: "2026-07-10", visitors: 4, purpose: "창고 이용",   status: "REJECTED" },
  { id: "r5", facilityName: "횡성 한우 목장",       facilityType: "목장",        sellerName: "정유나", date: "2026-07-22", visitors: 3, purpose: "콘텐츠 촬영", status: "APPROVED" },
  { id: "r6", facilityName: "부산 수산 가공공장",   facilityType: "가공공장",    sellerName: "최준혁", date: "2026-07-25", visitors: 2, purpose: "공장 견학",   status: "PENDING"  },
  { id: "r7", facilityName: "충북 과일 선별장",     facilityType: "선별창고",    sellerName: "박민준", date: "2026-07-28", visitors: 6, purpose: "제품 탐색",   status: "APPROVED" },
];

const STATUS_MAP: Record<Status, { label: string; tone: "yellow" | "green" | "red" }> = {
  PENDING:  { label: "대기중",   tone: "yellow" },
  APPROVED: { label: "승인완료", tone: "green"  },
  REJECTED: { label: "거절됨",   tone: "red"    },
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  "농장":         "bg-emerald-50 text-emerald-700",
  "목장":         "bg-emerald-50 text-emerald-700",
  "가공공장":     "bg-blue-50 text-blue-700",
  "물류창고":     "bg-orange-50 text-orange-700",
  "촬영스튜디오": "bg-purple-50 text-purple-700",
  "선별창고":     "bg-orange-50 text-orange-700",
};

/* ───── 통계 카드 ───── */
function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl mb-3 ${color}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
    </div>
  );
}

/* ───── 페이지 ───── */
export default function AdminFacilityReservations() {
  const [reservations, setReservations] = useState<Reservation[]>(DUMMY_RESERVATIONS);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("ALL");
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>("ALL");

  const counts = {
    total:    reservations.length,
    pending:  reservations.filter(r => r.status === "PENDING").length,
    approved: reservations.filter(r => r.status === "APPROVED").length,
    rejected: reservations.filter(r => r.status === "REJECTED").length,
  };

  const filtered = reservations.filter(r => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || r.facilityName.includes(q) || r.sellerName.includes(q) || r.facilityType.includes(q);
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchType   = typeFilter   === "ALL" || r.facilityType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const changeStatus = (id: string, status: Status) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="시설 예약 관리"
        description="셀러들의 시설 방문 예약 신청을 검토하고 승인·거절합니다."
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="전체 예약"  value={`${counts.total}건`}    icon={CalendarCheck} color="text-emerald-600 bg-emerald-50" />
        <StatCard label="대기중"     value={`${counts.pending}건`}   icon={Clock}         color="text-yellow-600 bg-yellow-50"  />
        <StatCard label="승인완료"   value={`${counts.approved}건`}  icon={CheckCircle2}  color="text-green-600 bg-green-50"    />
        <StatCard label="거절됨"     value={`${counts.rejected}건`}  icon={XCircle}       color="text-red-600 bg-red-50"        />
      </div>

      {/* 대기 알림 */}
      {counts.pending > 0 && (
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800 font-semibold">
            승인 대기 중인 시설 예약이 {counts.pending}건 있습니다.
          </p>
        </div>
      )}

      {/* 검색 + 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="시설명 또는 셀러명 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TypeFilter)}
          className="px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
        >
          <option value="ALL">전체 유형</option>
          <option value="농장">농장</option>
          <option value="목장">목장</option>
          <option value="가공공장">가공공장</option>
          <option value="물류창고">물류창고</option>
          <option value="촬영스튜디오">촬영스튜디오</option>
          <option value="선별창고">선별창고</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as "ALL" | Status)}
          className="px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
        >
          <option value="ALL">전체 상태</option>
          <option value="PENDING">대기중</option>
          <option value="APPROVED">승인완료</option>
          <option value="REJECTED">거절됨</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["시설명", "유형", "신청 셀러", "예약일", "방문 인원", "목적", "상태", "액션"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map(r => {
                const st        = STATUS_MAP[r.status];
                const typeCls   = TYPE_BADGE_CLASS[r.facilityType] ?? "bg-gray-50 text-gray-700";
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    {/* 시설명 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <span className="font-medium text-navy">{r.facilityName}</span>
                      </div>
                    </td>
                    {/* 유형 */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${typeCls}`}>
                        {r.facilityType}
                      </span>
                    </td>
                    {/* 셀러 */}
                    <td className="px-4 py-3 text-navy">{r.sellerName}</td>
                    {/* 예약일 */}
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.date}</td>
                    {/* 인원 */}
                    <td className="px-4 py-3 text-navy">{r.visitors}명</td>
                    {/* 목적 */}
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.purpose}</td>
                    {/* 상태 */}
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    {/* 액션 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {r.status !== "APPROVED" && (
                          <button
                            onClick={() => changeStatus(r.id, "APPROVED")}
                            className="rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 hover:bg-emerald-100 transition whitespace-nowrap"
                          >
                            승인
                          </button>
                        )}
                        {r.status !== "REJECTED" && (
                          <button
                            onClick={() => changeStatus(r.id, "REJECTED")}
                            className="rounded-lg bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 hover:bg-red-100 transition whitespace-nowrap"
                          >
                            거절
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
