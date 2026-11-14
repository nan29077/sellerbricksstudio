import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cardActionClassName, cardLinkClassName } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { ShopImage } from "@/components/shop/shop-image";
import { registeredSpaceThumbnail } from "@/lib/showcase";
import { cn } from "@/lib/utils";
import { Star, MapPin, Search, Warehouse } from "lucide-react";
import { facilityTypeLabel, facilityTypeTone } from "@/lib/status";

export const dynamic = "force-dynamic";

const REGIONS = ["전체", "서울", "경기", "부산", "인천", "대구", "광주", "대전"];


export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; region?: string; sort?: string };
}) {
  const { q, type, region, sort } = searchParams;

  const where: Prisma.FacilityWhereInput = { status: "APPROVED" };
  if (type === "WAREHOUSE" || type === "STUDIO" || type === "SHOWROOM") where.type = type;
  if (region && region !== "전체") where.region = region;
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } },
    { region: { contains: q, mode: "insensitive" } }, { specialty: { contains: q, mode: "insensitive" } }, { equipment: { contains: q, mode: "insensitive" } },
  ];

  const orderBy: Prisma.FacilityOrderByWithRelationInput =
    sort === "price" ? { products: { _count: "desc" } } : { rating: "desc" };

  let facilities: any[] = [];
  try {
    const db = await prisma.facility.findMany({
      where, orderBy, include: { _count: { select: { products: true } } },
    });
    // 스토리지마켓이 직접 운영하거나 직접 관리하는 승인된 공간만 보여 준다 (예시 · 데모 공간은 넣지 않는다, 2026-11-14)
    facilities = db;
  } catch {
    facilities = [];
  }

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(q && { q }),
      ...(type && { type }),
      ...(region && { region }),
      ...(sort && { sort }),
      ...patch,
    });
    return "/facilities?" + p.toString();
  };

  return (
    <div className="container pb-24 pt-8 sm:pt-10 md:pb-10">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800"><Warehouse aria-hidden="true" className="h-6 w-6" /></span>
        <div>
          <h1 className="break-keep text-2xl font-black tracking-tight text-navy sm:text-3xl">창고 · 스튜디오 · 쇼룸 찾기</h1>
          <p className="mt-1 text-sm leading-5 text-slate-600">방송할 공간을 검색하고 예약하세요.</p>
        </div>
      </div>

      <form className="mt-6 flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4" action="/facilities" method="get">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          <Input type="search" name="q" aria-label="공간명 또는 지역 검색" defaultValue={q} placeholder="공간 이름 또는 지역 검색" className="pl-9" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select name="type" aria-label="창고 종류" defaultValue={type ?? ""}>
            <option value="">전체 구분</option>
            <option value="WAREHOUSE">창고</option>
            <option value="STUDIO">스튜디오</option>
            <option value="SHOWROOM">쇼룸</option>
          </Select>
          <Select name="region" aria-label="지역" defaultValue={region ?? ""}>
            {REGIONS.map((r) => <option key={r} value={r === "전체" ? "" : r}>{r}</option>)}
          </Select>
          <Select name="sort" aria-label="정렬" defaultValue={sort ?? ""}>
            <option value="">인기순</option>
            <option value="price">상품 많은 순</option>
          </Select>
          <Button type="submit" variant="secondary" className="rounded-xl">
            검색
          </Button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {["전체", "WAREHOUSE", "STUDIO", "SHOWROOM"].map((t) => (
          <Link
            key={t}
            href={qs({ type: t === "전체" ? "" : t })}
            aria-current={(type ?? "") === (t === "전체" ? "" : t) ? "true" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-bold transition-colors",
              (type ?? "") === (t === "전체" ? "" : t)
                ? "border-navy bg-navy text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"
            )}
          >
            {t === "전체" ? "전체" : facilityTypeLabel(t)}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">총 {facilities.length}개 공간</p>

      {facilities.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Warehouse className="h-10 w-10" />}
            title="검색 결과가 없습니다"
            description="다른 키워드나 필터로 검색해보세요."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f) => (
            <Link key={f.id} href={`/facilities/${f.id}`} aria-label={`${f.name} 공간 보기`} className={cardLinkClassName}>
              <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                <ShopImage src={f.thumbnailUrl} fallback={registeredSpaceThumbnail(f.id, f.type)}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={facilityTypeTone(f.type)}>{facilityTypeLabel(f.type)}</Badge>
                  <span className="flex items-center gap-1 text-xs font-bold text-navy">
                    <Star aria-hidden="true" className="h-3.5 w-3.5 fill-brand-400 text-brand-400" />
                    <span className="sr-only">평점 </span>{(f.rating ?? 0).toFixed(1)}
                  </span>
                </div>
                <h2 className="mt-2 break-words text-lg font-extrabold tracking-tight text-navy">{f.name}</h2>
                <p className="mb-3 mt-1 flex items-center gap-1 text-xs text-slate-600"><MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{f.region}</p>
                <div className="mt-auto border-t border-slate-100 pt-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-slate-600">
                    <span>상품 {f._count?.products ?? 0}개</span>
                    <span className="font-bold">이용료 <strong className="text-sm font-extrabold text-emerald-800">무료</strong></span>
                  </div>
                  <span className={cardActionClassName}>공간 보기</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
       )}
    </div>
  );
}
