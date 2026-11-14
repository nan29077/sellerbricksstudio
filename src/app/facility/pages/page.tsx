import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { operableFacilityIds } from "@/lib/facility-owner";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getFacilityPageConfig } from "@/lib/facility-page";
import { cn } from "@/lib/utils";
import { ArrowRight, ExternalLink, LayoutTemplate, MapPin, Sparkles } from "lucide-react";
import { facilityTypeLabel, facilityTypeTone } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function FacilityPages() {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  let facilities: any[] = [];
  try {
    const ids = await operableFacilityIds(user);
    facilities = await prisma.facility.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "asc" } });
  } catch {
    facilities = [];
  }

  const pages = await Promise.all(facilities.map(async (facility) => ({
    facility,
    config: await getFacilityPageConfig(facility),
  })));

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader title="공간 페이지 관리" description="공간별 샵의 배너, PC 여백, 소개와 상품 노출을 설정합니다."
        action={user.role === "SUPER_ADMIN" ? <Link href="/facility/register" className={buttonVariants({ variant: "outline" })}>새 공간 등록</Link> : undefined} />

      {pages.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-10 w-10" />}
          title="꾸밀 수 있는 공간이 없습니다"
          description="공간을 등록하면 샵을 꾸밀 수 있습니다. 최고관리자가 공간을 승인하면 샵이 공개됩니다."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {pages.map(({ facility, config }) => (
            <article key={facility.id} className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="relative aspect-[16/6] overflow-hidden bg-navy">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.bannerUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/55 to-transparent" />
                <div className="absolute inset-0 flex items-center gap-4 p-5 text-white">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-white/90 bg-white shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={config.profileImageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge tone={facilityTypeTone(facility.type)}>{facilityTypeLabel(facility.type)}</Badge>
                      <span className="inline-flex items-center gap-1 text-[11px] text-white/70"><MapPin className="h-3 w-3" />{facility.region}</span>
                    </div>
                    <h2 className="truncate text-xl font-black">{config.pageTitle}</h2>
                    <p className="mt-1 truncate text-xs text-white/70">{config.tagline}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-brand-500" /> 프로필·AI 배너 적용됨
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/facilities/${facility.id}`} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
                    보기 <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <Link href={`/facility/pages/${facility.id}`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                    꾸미기 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
