import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatKRW } from "@/lib/utils";
import { Star, MapPin, Search, Warehouse } from "lucide-react";

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
  if (type === "WAREHOUSE" || type === "STUDIO") where.type = type;
  if (region && region !== "전체") where.region = region;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } }];

  const orderBy: Prisma.FacilityOrderByWithRelationInput =
    sort === "price" ? { basePrice: "asc" } : { rating: "desc" };

  let facilities: any[] = [];
  try {
    const db = await prisma.facility.findMany({
      where, orderBy, include: { _count: { select: { products: true } } },
    });
    facilities = db.length > 0 ? db : DUMMY;
  } catch {
    let filtered = DUMMY;
    if (type === "WAREHOUSE" || type === "STUDIO") filtered = filtered.filter((f) => f.type === type);
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
    <div className="container py-8 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-navy">창고 · 스튜디오 찾기</h1>
      <p className="mt-1 text-sm text-muted-foreground">방송할 공간을 검색하고 예약하세요.</p>

      <form className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-white p-4" action="/facilities" method="get">
        <div className="flex items-center gap-2 rounded-lg border border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="시설명 또는 지역 검색" className="h-11 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select name="type" defaultValue={type ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm bg-white">
            <option value="">전체 구분</option>
            <option value="WAREHOUSE">창고</option>
            <option value="STUDIO">스튜디오</option>
          </select>
          <select name="region" defaultValue={region ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm bg-white">
            {REGIONS.map((r) => <option key={r} value={r === "전체" ? "" : r}>{r}</option>)}
          </select>
          <select name="sort" defaultValue={sort ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm bg-white">
            <option value="">인기순</option>
            <option value="price">가격순</option>
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition">
            검색
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {["전체", "WAREHOUSE", "STUDIO"].map((t) => (
          <Link
            key={t}
            href={qs({ type: t === "전체" ? "" : t })}
            className={`text-xs px-3 py-1 rounded-full border transition ${
              (type ?? "") === (t === "전체" ? "" : t)
                ? "bg-brand-500 text-white border-brand-500"
                : "border-border text-muted-foreground hover:border-brand-300"
            }`}
          >
            {t === "전체" ? "전체" : t === "WAREHOUSE" ? "창고" : "스튜디오"}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">총 {facilities.length}개 시설</p>

      {facilities.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Warehouse className="h-10 w-10" />}
            title="검색 결과가 없습니다"
            description="다른 키워드나 필터로 검색해보세요."
          />
        </div>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {facilities.map((f: any) => (
            <Link key={f.id} href={`/facilities/${f.id}`}>
              <Card className="overflow-hidden hover:shadow-lg transition group cursor-pointer">
                <div className="aspect-[16/9] overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.thumbnailUrl ?? "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=70&auto=format&fit=crop"}
                    alt={f.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardContent className="pt-3 pb-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Badge tone={f.type === "WAREHOUSE" ? "blue" : "purple"}>
                      {f.type === "WAREHOUSE" ? "창고" : "스튜디오"}
                    </Badge>
                    <div className="flex items-center gap-0.5 ml-auto">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-semibold text-navy">{(f.rating ?? 0).toFixed(1)}</span>
                    </div>
                  </div>
                  <p className="font-bold text-navy line-clamp-1">{f.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />{f.region}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{f._count?.products ?? 0}개 상품 판매 가능</span>
                    <span className="font-bold text-navy text-sm">{formatKRW(f.basePrice)}<span className="text-xs font-normal text-muted-foreground">/시간</span></span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
       )}
    </div>
  );
}
