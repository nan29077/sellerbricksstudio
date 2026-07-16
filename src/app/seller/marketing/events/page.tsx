"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone, CalendarDays, Users, Gift, Plus, Clock, CheckCircle2,
} from "lucide-react";

type EventStatus = "진행중" | "예정" | "종료";

const DUMMY_EVENTS: {
  id: string;
  title: string;
  type: string;
  period: string;
  participants: number;
  goal: number;
  status: EventStatus;
}[] = [
  { id: "ev-1", title: "여름 시즌 오프 최대 50% 할인전", type: "할인 프로모션", period: "2026-07-10 ~ 2026-07-31", participants: 1240, goal: 2000, status: "진행중" },
  { id: "ev-2", title: "라이브 방송 시청 인증 이벤트",     type: "참여형 이벤트", period: "2026-07-14 ~ 2026-07-21", participants: 486,  goal: 800,  status: "진행중" },
  { id: "ev-3", title: "신상품 론칭 기념 사전예약 혜택",   type: "사전예약",     period: "2026-08-01 ~ 2026-08-14", participants: 0,    goal: 1500, status: "예정" },
  { id: "ev-4", title: "6월 감사제 구매 고객 사은품 증정", type: "사은품 증정",   period: "2026-06-01 ~ 2026-06-30", participants: 2130, goal: 2000, status: "종료" },
];

const STATUS_TONE: Record<EventStatus, "green" | "blue" | "gray"> = {
  진행중: "green",
  예정: "blue",
  종료: "gray",
};

const FILTERS: ("전체" | EventStatus)[] = ["전체", "진행중", "예정", "종료"];

export default function SellerMarketingEventsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");

  const events = DUMMY_EVENTS.filter((e) => filter === "전체" || e.status === filter);
  const running = DUMMY_EVENTS.filter((e) => e.status === "진행중").length;
  const upcoming = DUMMY_EVENTS.filter((e) => e.status === "예정").length;
  const totalParticipants = DUMMY_EVENTS.reduce((sum, e) => sum + e.participants, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="이벤트/프로모션 관리"
        description="이벤트와 프로모션을 등록하고 참여 현황을 관리하세요."
        action={
          <Button onClick={() => alert("이벤트 등록 기능은 준비 중입니다.")}>
            <Plus className="h-4 w-4 mr-1.5" />새 이벤트 등록
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="진행중 이벤트" value={`${running}건`}  sub="현재 운영 중"    icon={Megaphone} />
        <StatCard label="예정 이벤트"   value={`${upcoming}건`} sub="오픈 대기"       icon={CalendarDays} />
        <StatCard label="총 참여자"     value={totalParticipants.toLocaleString() + "명"} sub="누적 참여"  icon={Users} />
        <StatCard label="지급 혜택"     value="312건"           sub="쿠폰·사은품 지급" icon={Gift} />
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
              filter === f
                ? "bg-brand-500 text-white border-brand-500"
                : "bg-white text-muted-foreground border-border hover:border-brand-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {events.map((e) => {
          const pct = e.goal > 0 ? Math.min(100, Math.round((e.participants / e.goal) * 100)) : 0;
          return (
            <Card key={e.id} className="hover:shadow-md transition">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                      e.status === "진행중" ? "bg-emerald-50" : e.status === "예정" ? "bg-blue-50" : "bg-muted"
                    }`}>
                      {e.status === "종료"
                        ? <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                        : e.status === "예정"
                          ? <Clock className="h-5 w-5 text-blue-500" />
                          : <Megaphone className="h-5 w-5 text-emerald-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-navy truncate">{e.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span>{e.type}</span>
                        <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{e.period}</span>
                      </div>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">참여 {e.participants.toLocaleString()}명 / 목표 {e.goal.toLocaleString()}명</span>
                    <span className="text-xs font-bold text-navy">{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-400" : "bg-brand-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {events.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            해당 상태의 이벤트가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
