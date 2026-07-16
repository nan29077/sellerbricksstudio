"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Ticket, Percent, Users, Clock, Plus, Copy, Pause, Play,
} from "lucide-react";

type CouponStatus = "발급중" | "일시중지" | "종료";

const DUMMY_COUPONS: {
  id: string;
  name: string;
  code: string;
  benefit: string;
  condition: string;
  period: string;
  issued: number;
  used: number;
  status: CouponStatus;
}[] = [
  { id: "cp-1", name: "여름 시즌 10% 할인 쿠폰",     code: "SUMMER10",   benefit: "10% 할인 (최대 5,000원)", condition: "3만원 이상 구매",  period: "2026-07-01 ~ 2026-07-31", issued: 1520, used: 642, status: "발급중" },
  { id: "cp-2", name: "라이브 시청자 전용 쿠폰",     code: "LIVE3000",   benefit: "3,000원 즉시 할인",        condition: "라이브 방송 중 발급", period: "2026-07-10 ~ 2026-07-24", issued: 830,  used: 415, status: "발급중" },
  { id: "cp-3", name: "첫 구매 감사 쿠폰",           code: "WELCOME5",   benefit: "5,000원 할인",             condition: "첫 주문 1회 한정",   period: "상시",                     issued: 2410, used: 1188, status: "발급중" },
  { id: "cp-4", name: "무료배송 쿠폰",               code: "FREESHIP",   benefit: "배송비 무료",              condition: "2만원 이상 구매",   period: "2026-07-05 ~ 2026-07-19", issued: 640,  used: 512, status: "일시중지" },
  { id: "cp-5", name: "6월 감사제 15% 쿠폰",         code: "THANKS15",   benefit: "15% 할인 (최대 10,000원)", condition: "전 상품",            period: "2026-06-01 ~ 2026-06-30", issued: 1980, used: 1704, status: "종료" },
];

const STATUS_TONE: Record<CouponStatus, "green" | "yellow" | "gray"> = {
  발급중: "green",
  일시중지: "yellow",
  종료: "gray",
};

const FILTERS: ("전체" | CouponStatus)[] = ["전체", "발급중", "일시중지", "종료"];

export default function SellerMarketingCouponsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");

  const coupons = DUMMY_COUPONS.filter((c) => filter === "전체" || c.status === filter);
  const active = DUMMY_COUPONS.filter((c) => c.status === "발급중").length;
  const totalIssued = DUMMY_COUPONS.reduce((sum, c) => sum + c.issued, 0);
  const totalUsed = DUMMY_COUPONS.reduce((sum, c) => sum + c.used, 0);
  const usageRate = totalIssued > 0 ? Math.round((totalUsed / totalIssued) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="쿠폰 관리"
        description="할인 쿠폰을 발급하고 사용 현황을 관리하세요."
        action={
          <Button onClick={() => alert("쿠폰 발급 기능은 준비 중입니다.")}>
            <Plus className="h-4 w-4 mr-1.5" />새 쿠폰 발급
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="발급중 쿠폰" value={`${active}종`}                       sub="현재 발급 중"  icon={Ticket} />
        <StatCard label="총 발급"     value={totalIssued.toLocaleString() + "장"} sub="누적 발급 수"  icon={Users} />
        <StatCard label="총 사용"     value={totalUsed.toLocaleString() + "장"}   sub="누적 사용 수"  icon={Clock} />
        <StatCard label="사용률"      value={`${usageRate}%`}                     sub="발급 대비 사용" icon={Percent} />
      </div>

      <div className="flex flex-wrap gap-1.5">
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
        {coupons.map((c) => {
          const rate = c.issued > 0 ? Math.round((c.used / c.issued) * 100) : 0;
          return (
            <Card key={c.id} className="hover:shadow-md transition">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 shrink-0">
                    <Ticket className="h-5 w-5 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-navy">{c.name}</p>
                      <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {c.benefit} · {c.condition} · {c.period}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-navy">{c.code}</code>
                      <button
                        type="button"
                        onClick={() => alert("쿠폰 코드 복사 기능은 준비 중입니다.")}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-600 transition"
                      >
                        <Copy className="h-3 w-3" />복사
                      </button>
                    </div>
                  </div>
                  <div className="sm:w-48 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">사용 {c.used.toLocaleString()} / 발급 {c.issued.toLocaleString()}</span>
                      <span className="text-xs font-bold text-navy">{rate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => alert("쿠폰 상태 변경 기능은 준비 중입니다.")}
                      >
                        {c.status === "발급중" ? (
                          <><Pause className="h-3.5 w-3.5 mr-1" />일시중지</>
                        ) : (
                          <><Play className="h-3.5 w-3.5 mr-1" />발급 재개</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {coupons.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            해당 상태의 쿠폰이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
