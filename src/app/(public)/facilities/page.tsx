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

const DUMMY: any[] = [
  { id: "d1", name: "강남 프리미엄 라이브 스튜디오", type: "STUDIO",    region: "서울", address: "서울 강남구 테헤란로 123",   rating: 4.9, basePrice: 150000, thumbnailUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=70&auto=format&fit=crop", _count: { products: 248 } },
  { id: "d2", name: "마포구 대형 물류 창고",          type: "WAREHOUSE", region: "서울", address: "서울 마포구 홍대입구로 45",  rating: 4.8, basePrice: 80000,  thumbnailUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=70&auto=format&fit=crop", _count: { products: 512 } },
  { id: "d3", name: "성수 인더스트리얼 스튜디오",    type: "STUDIO",    region: "서울", address: "서울 성동구 성수이로 12길 34", rating: 4.7, basePrice: 120000, thumbnailUrl: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=70&auto=format&fit=crop", _count: { products: 186 } },
  { id: "d4", name: "인천 냉장-냉동 전문 창고",       type: "WAREHOUSE", region: "인천", address: "인천 남동구 인주대로 56",    rating: 4.6, basePrice: 65000,  thumbnailUrl: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=600&q=70&auto=format&fit=crop", _count: { products: 380 } },
  { id: "d5", name: "판교 IT 테크 스튜디오",         type: "STUDIO",    region: "경기", address: "경기 성남시 분당구 판교로 78", rating: 4.5, basePrice: 100000, thumbnailUrl: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=70&auto=format&fit=crop", _count: { products: 142 } },
  { id: "d6", name: "부산 해운대 뷰 라이브룸",       type: "STUDIO",    region: "부산", address: "부산 해운대구 해운대로 90",   rating: 4.4, basePrice: 90000,  thumbnailUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=70&auto=format&fit=crop", _count: { products: 203 } },
  { id: "d7", name: "광주 서구 멀티 창고",           type: "WAREHOUSE", region: "광주", address: "광주 서구 상무대로 112",      rating: 4.3, basePrice: 55000,  thumbnailUrl: "https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=600&q=70&auto=format&fit=crop", _count: { products: 290 } },
  { id: "d8", name: "대전 유성 스튜디오",            type: "STUDIO",    region: "대전", address: "대전 유성구 엑스포로 34",     rating: 4.2, basePrice: 75000,  thumbnailUrl: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=70&auto=format&fit=crop", _count: { products: 155 } },
  { id: "d9", name: "수원 영통 물류 센터",           type: "WAREHOUSE", region: "경기", address: "경기 수원시 영통구 광교로 200", rating: 4.1, basePrice: 60000, thumbnailUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&q=70&auto=format&fit=crop", _count: { products: 445 } },
];

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
    // 검색 결과가 0건이면 그대로 0건을 보여준다. (DB 자체가 비어 있을 때만 데모 데이터)
    facilities = db.length > 0 || Object.keys(where).length > 1 ? db : DUMMY;
  } catch {
    let filtered = DUMMY;
    if (type === "WAREHOUSE" || type === "STUDIO" || type === "SHOWROOM") filtered = filtered.filter((f) => f.type === type);
    if (region && region !== "전체") filtered = filtered.filter((f) => f.region.includes(region));
    if (q) filtered = filtered.filter((f) => f.name.includes(q) || f.address.includes(q));
    facilities = filtered;
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
          <h1 className="break-keep text-2xl font-black tracking-tight text-navy sm:text-3xl">창고 · 스튜디오 찾기</h1>
          <p className="mt-1 text-sm leading-5 text-slate-600">방송할 공간을 검색하고 예약하세요.</p>
        </div>
      </div>

      <form className="mt-6 flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4" action="/facilities" method="get">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          <Input type="search" name="q" aria-label="창고(스튜디오)명 또는 지역 검색" defaultValue={q} placeholder="공간 이름 또는 지역 검색" className="pl-9" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select name="type" aria-label="창고 종류" defaultValue={type ?? ""}>
            <option value="">전체 구분</option>
            <option value="WAREHOUSE">창고</option>
            <option value="STUDIO">스튜디오</option>
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

      <p className="mt-4 text-sm text-muted-foreground">총 {facilities.length}개 창고(스튜디오)</p>

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
