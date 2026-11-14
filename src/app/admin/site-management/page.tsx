import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";
import { HomeBackgroundForm } from "@/components/admin/home-background-form";
import { SiteNoticeManager } from "@/components/admin/site-notices";
import { RoleAccessToggles } from "@/components/admin/role-access-toggles";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { HomeVideoManager } from "@/components/admin/home-video-manager";
import { isVideoShown } from "@/lib/home-videos";

export const dynamic = "force-dynamic";

// 사이트 관리 (2026-11-14): 예전 '사이트 설정 · 메인 여백 관리 · 사이트 관리(공지) · 메뉴 권한 설정'을 한 화면의 탭으로 합쳤다.
const TABS = [
  { key: "basic", label: "기본 정보 · 배너" },
  { key: "videos", label: "홈 영상" },
  { key: "background", label: "메인 여백" },
  { key: "notices", label: "공지사항" },
  { key: "access", label: "메뉴 권한" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function SiteManagementPage({ searchParams }: { searchParams: { tab?: string | string[] } }) {
  await requireRole(["SUPER_ADMIN"]);
  const raw = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
  const want = raw === "broadcasts" ? "videos" : raw; // 예전 '방송 링크' 탭 주소
  const tab: TabKey = TABS.some((t) => t.key === want) ? (want as TabKey) : "basic";
  const settings = await getSettings();
  const videos = tab === "videos" ? await prisma.homeVideo.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }], take: 300 }) : [];

  return (
    <div className="space-y-5">
      <PageHeader title="사이트 관리" description="사이트 기본 정보 · 상단 배너, 메인 영상(라이브 커머스 · 캠페인/행사), 메인 여백 배경, 공지사항, 메뉴 권한을 탭으로 나누어 관리합니다." />
      <nav aria-label="사이트 관리 탭" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/site-management?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={cn("hit inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-bold transition",
              tab === t.key ? "border-brand-500 text-navy" : "border-transparent text-slate-500 hover:text-navy")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "basic" && <SiteSettingsForm initial={settings} />}
      {tab === "videos" && (
        <HomeVideoManager initial={videos.map((v) => ({ ...v, startsAt: v.startsAt?.toISOString() ?? null, endsAt: v.endsAt?.toISOString() ?? null, shown: isVideoShown(v) }))} />
      )}
      {tab === "background" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">메인페이지 양옆(PC)의 배경을 골라 저장합니다. 미니어처 일러스트와 인물, 공간 배경을 고르고 플레이어와 메뉴 옆에 어떻게 보이는지 확인하세요.</p>
          <HomeBackgroundForm initial={settings.homeBackground} />
        </div>
      )}
      {tab === "notices" && <SiteNoticeManager />}
      {tab === "access" && (
        <div className="space-y-3">
          <RoleAccessToggles managerDisabled={settings.managerDisabled} />
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            창고(스튜디오)는 스토리지마켓 본사가 직접 운영하거나 직접 관리하는 곳만 쓰므로 창고 관리자 회원은 없습니다. 창고 운영 매니저 계정은 매니저 관리에서 만들고 담당 창고를 지정합니다.
            판매는 셀러가 외부 라이브 플랫폼에서 하고, 스토리지마켓에는 주문서로 들어옵니다.
          </div>
        </div>
      )}
    </div>
  );
}
