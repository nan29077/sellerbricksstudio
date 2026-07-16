"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Clock, CheckCircle2, XCircle, Search } from "lucide-react";

// ──────────────────────────────────────────────
// 상태 설정
// ──────────────────────────────────────────────
const STATUS_OPTIONS = ["대기중", "검토중", "승인", "거절"] as const;
type StatusType = (typeof STATUS_OPTIONS)[number];

const STATUS_TONE: Record<StatusType, "gray" | "yellow" | "green" | "red"> = {
  "대기중": "gray",
  "검토중": "yellow",
  "승인": "green",
  "거절": "red",
};

// ──────────────────────────────────────────────
// 더미 데이터
// ──────────────────────────────────────────────
const DUMMY_APPLICATIONS = [
  {
    id: "mk-1",
    seller: "박지현",
    type: "SNS 광고 지원",
    content: "신규 뷰티 상품 론칭을 위해 인스타그램·유튜브 광고 지원을 요청드립니다.",
    budget: "500,000원",
    date: "2026-07-20",
    status: "승인" as StatusType,
    createdAt: "2026-07-02",
  },
  {
    id: "mk-2",
    seller: "홍길동",
    type: "콘텐츠 제작",
    content: "여름 기획전 홍보용 숏폼 영상 제작 지원을 요청합니다.",
    budget: "300,000원",
    date: "2026-07-15",
    status: "검토중" as StatusType,
    createdAt: "2026-07-03",
  },
  {
    id: "mk-3",
    seller: "김미래",
    type: "인플루언서 연결",
    content: "뷰티 인플루언서와 협업하여 신상품 홍보를 진행하고자 합니다.",
    budget: "1,000,000원",
    date: "2026-07-25",
    status: "대기중" as StatusType,
    createdAt: "2026-07-03",
  },
  {
    id: "mk-4",
    seller: "정유나",
    type: "기타",
    content: "오프라인 팝업 스토어 연계 온라인 마케팅 지원을 요청합니다.",
    budget: "800,000원",
    date: "2026-08-01",
    status: "대기중" as StatusType,
    createdAt: "2026-07-04",
  },
  {
    id: "mk-5",
    seller: "이수민",
    type: "SNS 광고 지원",
    content: "식품 카테고리 신규 진출을 위한 SNS 마케팅 지원을 원합니다.",
    budget: "200,000원",
    date: "2026-07-10",
    status: "거절" as StatusType,
    createdAt: "2026-06-28",
  },
];

// ──────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────
export default function AdminMarketingPage() {
  const [applications, setApplications] = useState(DUMMY_APPLICATIONS);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusType | "전체">("전체");

  const counts = {
    total: applications.length,
    waiting: applications.filter((a) => a.status === "대기중").length,
    reviewing: applications.filter((a) => a.status === "검토중").length,
    approved: applications.filter((a) => a.status === "승인").length,
    rejected: applications.filter((a) => a.status === "거절").length,
  };

  const filtered = applications.filter((a) => {
    const matchStatus = filterStatus === "전체" || a.status === filterStatus;
    const matchSearch =
      !search ||
      a.seller.includes(search) ||
      a.type.includes(search) ||
      a.content.includes(search);
    return matchStatus && matchSearch;
  });

  const changeStatus = (id: string, newStatus: StatusType) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="마케팅 지원 관리"
        description="셀러의 마케팅 지원 신청을 검토하고 상태를 관리하세요."
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="전체"   value={`${counts.total}건`}    icon={Megaphone} />
        <StatCard label="대기중" value={`${counts.waiting}건`}  icon={Clock} />
        <StatCard label="승인"   value={`${counts.approved}건`} icon={CheckCircle2} />
        <StatCard label="거절"   value={`${counts.rejected}건`} icon={XCircle} />
      </div>

      {/* 필터 & 검색 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="셀러명, 신청유형, 내용 검색..."
            className="w-full rounded-lg border border-border bg-white pl-9 pr-3 py-2 text-sm text-navy placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["전체", ...STATUS_OPTIONS] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterStatus === s
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-muted-foreground border-border hover:border-brand-300 hover:text-brand-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 신청 목록 */}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["셀러명", "신청유형", "신청 내용", "희망 예산", "희망 일정", "신청일", "상태 변경"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  해당 조건의 신청 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((app) => (
                <tr key={app.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-navy font-medium whitespace-nowrap">
                    {app.seller}
                  </td>
                  <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">
                    {app.type}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
                    <p className="line-clamp-2">{app.content}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">
                    {app.budget}
                  </td>
                  <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">
                    {app.date}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {app.createdAt}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[app.status]}>{app.status}</Badge>
                      <select
                        value={app.status}
                        onChange={(e) => changeStatus(app.id, e.target.value as StatusType)}
                        className="rounded-md border border-border bg-white px-2 py-1 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
