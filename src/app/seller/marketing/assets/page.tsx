"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Image as ImageIcon, LayoutTemplate, Film, FolderOpen, Upload,
  Download, Eye,
} from "lucide-react";

type AssetType = "배너" | "썸네일" | "상세페이지" | "영상";

const DUMMY_ASSETS: {
  id: string;
  name: string;
  type: AssetType;
  size: string;
  usedIn: string;
  views: number;
  updatedAt: string;
}[] = [
  { id: "as-1", name: "여름 세일 메인 배너",        type: "배너",       size: "1920×600",  usedIn: "메인 홈 상단",     views: 12400, updatedAt: "2026-07-12" },
  { id: "as-2", name: "라이브 방송 예고 썸네일",    type: "썸네일",     size: "1280×720",  usedIn: "라이브 목록",      views: 8300,  updatedAt: "2026-07-11" },
  { id: "as-3", name: "신상품 상세페이지 v2",       type: "상세페이지", size: "860×4200",  usedIn: "상품 상세",        views: 5120,  updatedAt: "2026-07-08" },
  { id: "as-4", name: "프로모션 숏폼 영상 (15초)",  type: "영상",       size: "1080×1920", usedIn: "SNS 광고",         views: 21600, updatedAt: "2026-07-05" },
  { id: "as-5", name: "쿠폰 안내 팝업 배너",        type: "배너",       size: "800×800",   usedIn: "이벤트 팝업",      views: 3900,  updatedAt: "2026-06-28" },
  { id: "as-6", name: "6월 감사제 썸네일 세트",     type: "썸네일",     size: "1280×720",  usedIn: "이벤트 페이지",    views: 2750,  updatedAt: "2026-06-20" },
];

const TYPE_META: Record<AssetType, { tone: "brand" | "blue" | "purple" | "yellow"; icon: typeof ImageIcon }> = {
  배너:       { tone: "brand",  icon: LayoutTemplate },
  썸네일:     { tone: "blue",   icon: ImageIcon },
  상세페이지: { tone: "purple", icon: FolderOpen },
  영상:       { tone: "yellow", icon: Film },
};

const FILTERS: ("전체" | AssetType)[] = ["전체", "배너", "썸네일", "상세페이지", "영상"];

export default function SellerMarketingAssetsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const assets = DUMMY_ASSETS.filter((a) => filter === "전체" || a.type === filter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="광고 소재 관리"
        description="배너·썸네일·상세페이지 등 광고 소재를 한곳에서 관리하세요."
        action={
          <Button onClick={() => alert("소재 업로드 기능은 준비 중입니다.")}>
            <Upload className="h-4 w-4 mr-1.5" />소재 업로드
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="전체 소재"  value={`${DUMMY_ASSETS.length}개`} sub="등록된 소재"       icon={FolderOpen} />
        <StatCard label="배너"       value={`${DUMMY_ASSETS.filter((a) => a.type === "배너").length}개`}   sub="메인·팝업 배너" icon={LayoutTemplate} />
        <StatCard label="썸네일"     value={`${DUMMY_ASSETS.filter((a) => a.type === "썸네일").length}개`} sub="라이브·이벤트"  icon={ImageIcon} />
        <StatCard label="총 노출"    value="54,070회"                    sub="최근 30일 합산"     icon={Eye} />
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((a) => {
          const meta = TYPE_META[a.type];
          const Icon = meta.icon;
          return (
            <Card key={a.id} className="hover:shadow-md transition">
              <CardContent className="pt-4 pb-4">
                <div className="flex h-24 items-center justify-center rounded-lg bg-muted/50 border border-border mb-3">
                  <Icon className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-navy text-sm truncate">{a.name}</p>
                  <Badge tone={meta.tone}>{a.type}</Badge>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>크기: {a.size} · 사용처: {a.usedIn}</p>
                  <p>노출 {a.views.toLocaleString()}회 · 수정 {a.updatedAt}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => alert("미리보기 기능은 준비 중입니다.")}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />미리보기
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => alert("다운로드 기능은 준비 중입니다.")}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />다운로드
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {assets.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            해당 유형의 소재가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
