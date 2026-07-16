"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Video, Camera, Music2, Globe, TrendingUp,
  Users, FileText, CheckCircle2, Clock, X,
} from "lucide-react";

// ──────────────────────────────────────────────
// 더미 데이터
// ──────────────────────────────────────────────
const SNS_PLATFORMS = [
  {
    id: "youtube",
    name: "YouTube",
    icon: Video,
    channel: "박지현 뷰티 라이브",
    metric: "구독자",
    count: "12,400",
    recentPosts: 8,
    color: "text-red-500",
    bg: "bg-red-50",
    border: "border-red-100",
    connected: true,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Camera,
    channel: "jihyun_beauty",
    metric: "팔로워",
    count: "8,500",
    recentPosts: 24,
    color: "text-pink-500",
    bg: "bg-pink-50",
    border: "border-pink-100",
    connected: true,
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: Music2,
    channel: "@jihyun_live",
    metric: "팔로워",
    count: "3,200",
    recentPosts: 15,
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-100",
    connected: false,
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: Globe,
    channel: "박지현 라이브 쇼핑",
    metric: "좋아요",
    count: "2,100",
    recentPosts: 6,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    connected: false,
  },
];

const APPLICATION_TYPES = [
  "SNS 광고 지원",
  "콘텐츠 제작",
  "인플루언서 연결",
  "기타",
];

const DUMMY_APPLICATIONS = [
  {
    id: "app-1",
    type: "SNS 광고 지원",
    content: "신규 뷰티 상품 론칭을 위해 인스타그램·유튜브 광고 지원을 요청드립니다.",
    budget: "500,000원",
    date: "2026-07-20",
    status: "승인",
    statusTone: "green" as const,
  },
  {
    id: "app-2",
    type: "콘텐츠 제작",
    content: "여름 기획전 홍보용 숏폼 영상 제작 지원을 요청합니다.",
    budget: "300,000원",
    date: "2026-07-15",
    status: "검토중",
    statusTone: "yellow" as const,
  },
  {
    id: "app-3",
    type: "인플루언서 연결",
    content: "뷰티 인플루언서와 협업하여 신상품 홍보를 진행하고자 합니다.",
    budget: "1,000,000원",
    date: "2026-07-01",
    status: "대기중",
    statusTone: "gray" as const,
  },
];

// ──────────────────────────────────────────────
// 탭 1: SNS 지표 연동
// ──────────────────────────────────────────────
function SnsTab() {
  const handleConnect = () => {
    alert("곧 지원 예정입니다.");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        SNS 채널을 연동하면 구독자·팔로워 현황을 한눈에 확인할 수 있습니다.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="총 팔로워"   value="20,900"  sub="연동 채널 합산"     icon={Users} />
        <StatCard label="연동 채널"   value="2개"     sub="전체 4개 중"        icon={CheckCircle2} />
        <StatCard label="최근 게시물" value="32개"    sub="최근 30일"          icon={FileText} />
        <StatCard label="주간 성장"   value="+340명"  sub="지난주 대비 +1.7%"  icon={TrendingUp} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {SNS_PLATFORMS.map((p) => {
          const Icon = p.icon;
          return (
            <Card key={p.id} className={`border ${p.border}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`rounded-xl p-2.5 ${p.bg}`}>
                    <Icon className={`h-5 w-5 ${p.color}`} />
                  </div>
                  {p.connected ? (
                    <Badge tone="green">연동됨</Badge>
                  ) : (
                    <Badge tone="gray">미연동</Badge>
                  )}
                </div>

                <div className="mt-3">
                  <p className="font-semibold text-navy text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.channel}</p>
                </div>

                {p.connected ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Users className="h-3 w-3" />
                        <span className="text-[10px]">{p.metric}</span>
                      </div>
                      <p className="text-base font-bold text-navy">{p.count}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <FileText className="h-3 w-3" />
                        <span className="text-[10px]">최근 게시물</span>
                      </div>
                      <p className="text-base font-bold text-navy">{p.recentPosts}개</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={handleConnect}
                    >
                      연동하기
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 탭 2: 마케팅 지원 신청
// ──────────────────────────────────────────────
function ApplicationTab() {
  const [type, setType] = useState(APPLICATION_TYPES[0]);
  const [content, setContent] = useState("");
  const [budget, setBudget] = useState("");
  const [date, setDate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleReset = () => {
    setType(APPLICATION_TYPES[0]);
    setContent("");
    setBudget("");
    setDate("");
    setSubmitted(false);
  };

  return (
    <div className="space-y-6">
      {/* 신청 폼 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">마케팅 지원 신청</CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="rounded-full bg-green-50 p-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <p className="font-semibold text-navy">신청이 완료되었습니다!</p>
              <p className="text-sm text-muted-foreground">담당자 검토 후 순차적으로 연락드리겠습니다.</p>
              <Button variant="outline" size="sm" onClick={handleReset} className="mt-2">
                새 신청하기
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">신청 유형</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                >
                  {APPLICATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">신청 내용</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="지원이 필요한 내용을 상세히 입력해주세요."
                  rows={4}
                  required
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">희망 예산</label>
                  <input
                    type="text"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="예: 500,000원"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">희망 일정</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="pt-1">
                <Button type="submit" className="w-full sm:w-auto">
                  신청하기
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 기존 신청 내역 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">신청 내역</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DUMMY_APPLICATIONS.map((app) => (
            <div key={app.id} className="rounded-xl border border-border p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-navy">{app.type}</span>
                <Badge tone={app.statusTone}>{app.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{app.content}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>예산: {app.budget}</span>
                <span>희망일: {app.date}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────
const TABS = [
  { id: "sns", label: "SNS 지표 연동" },
  { id: "apply", label: "마케팅 지원 신청" },
];

export default function SellerMarketingPage() {
  const [activeTab, setActiveTab] = useState("sns");

  return (
    <div className="space-y-5">
      <PageHeader
        title="SNS 마케팅 관리"
        description="인스타그램·유튜브·블로그 등 SNS 채널을 연동하고 마케팅 지원을 신청하세요."
      />

      {/* 탭 */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-muted-foreground hover:text-navy"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sns" && <SnsTab />}
      {activeTab === "apply" && <ApplicationTab />}
    </div>
  );
}
