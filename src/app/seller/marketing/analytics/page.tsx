"use client";

import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye, MousePointerClick, TrendingUp, ShoppingCart, BarChart3,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const WEEKLY_VIEWS = [
  { day: "월", value: 1800 },
  { day: "화", value: 2400 },
  { day: "수", value: 2100 },
  { day: "목", value: 3200 },
  { day: "금", value: 2900 },
  { day: "토", value: 4100 },
  { day: "일", value: 3600 },
];

const CHANNELS = [
  { name: "YouTube",   views: 12400, clicks: 980, ctr: 7.9, trend: +12.4 },
  { name: "Instagram", views: 8500,  clicks: 610, ctr: 7.2, trend: +5.1 },
  { name: "블로그",    views: 4200,  clicks: 240, ctr: 5.7, trend: -2.3 },
  { name: "이벤트 페이지", views: 3100, clicks: 350, ctr: 11.3, trend: +18.9 },
];

const TOP_CONTENTS = [
  { title: "여름 세일 메인 배너",       views: 12400, clicks: 1120, ctr: 9.0 },
  { title: "프로모션 숏폼 영상 (15초)", views: 21600, clicks: 1580, ctr: 7.3 },
  { title: "라이브 방송 예고 썸네일",   views: 8300,  clicks: 540,  ctr: 6.5 },
];

export default function SellerMarketingAnalyticsPage() {
  const maxWeekly = Math.max(...WEEKLY_VIEWS.map((d) => d.value));
  const maxChannelViews = Math.max(...CHANNELS.map((c) => c.views));

  return (
    <div className="space-y-5">
      <PageHeader
        title="마케팅 성과 분석"
        description="조회수·클릭률·전환 등 마케팅 성과를 한눈에 확인하세요."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="총 조회수" value="28,200" sub="최근 7일 · 전주 대비 +14%" icon={Eye} />
        <StatCard label="총 클릭"   value="2,180"  sub="배너·링크 클릭 합산"        icon={MousePointerClick} />
        <StatCard label="평균 클릭률" value="7.7%" sub="업계 평균 4.2%"             icon={TrendingUp} />
        <StatCard label="전환 주문" value="164건"  sub="마케팅 유입 주문"           icon={ShoppingCart} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-brand-500" />
              <h3 className="font-bold text-navy">이번 주 일별 조회수</h3>
            </div>
            <div className="flex items-end gap-2 h-32">
              {WEEKLY_VIEWS.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">{(d.value / 1000).toFixed(1)}K</span>
                  <div
                    className="w-full bg-brand-500 rounded-t-sm hover:bg-brand-600 transition-all"
                    style={{ height: `${Math.max(8, (d.value / maxWeekly) * 100)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-brand-500" />
              <h3 className="font-bold text-navy">채널별 성과</h3>
            </div>
            <div className="space-y-3.5">
              {CHANNELS.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-navy">{c.name}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{c.views.toLocaleString()}회 · CTR {c.ctr}%</span>
                      <span className={`flex items-center gap-0.5 font-semibold ${c.trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {c.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(c.trend)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${(c.views / maxChannelViews) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-4 w-4 text-brand-500" />
            <h3 className="font-bold text-navy">성과 상위 콘텐츠</h3>
          </div>
          <div className="space-y-3">
            {TOP_CONTENTS.map((t, i) => (
              <div key={t.title} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                  i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : "bg-orange-50 text-orange-600"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">조회 {t.views.toLocaleString()}회 · 클릭 {t.clicks.toLocaleString()}회</p>
                </div>
                <Badge tone={t.ctr >= 8 ? "green" : "blue"}>CTR {t.ctr}%</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
