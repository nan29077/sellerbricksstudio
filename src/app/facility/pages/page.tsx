import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getFacilityPageConfig } from "@/lib/facility-page";
import { cn } from "@/lib/utils";
import { ArrowRight, ExternalLink, LayoutTemplate, MapPin, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FacilityPages() {
  const user = await requireRole(["FACILITY_ADMIN"]);
  let facilities: any[] = [];
  try {
    const ids = await ownedFacilityIds(user.id);
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
      <PageHeader title="시설 페이지 꾸미기" description="시설마다 독립된 소개 페이지를 만들고 배너와 노출 내용을 관리하세요." />

      {pages.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-10 w-10" />}
          title="꾸밀 수 있는 시설이 없습니다"
          description="시설이 등록되고 승인되면 전용 페이지를 꾸밀 수 있습니다."
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
                      <Badge tone={facility.type === "WAREHOUSE" ? "blue" : "purple"}>{facility.type === "WAREHOUSE" ? "창고" : "스튜디오"}</Badge>
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
