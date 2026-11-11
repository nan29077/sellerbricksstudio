import Link from "next/link";
import { PartnerActions } from "@/components/brand/partner-actions";
import { requireRole } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import { prisma } from "@/lib/prisma";
import { reportDbError } from "@/lib/db-error";
import { FULFILLMENT_LABEL } from "@/lib/brands";
import { addMonths, kstStartOfMonth } from "@/lib/kst";
import { compactKRW, relativeTime } from "@/lib/dashboard";
import { formatKRW } from "@/lib/utils";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { DataNotice, Empty, KpiTile, Panel, Pill } from "@/components/dashboard/kit";
import { Store, Users, Video, Warehouse } from "lucide-react";

export const dynamic = "force-dynamic";

// 브랜드 계정: 내 상품을 판매 목록에 담은 셀러 · 창고(스튜디오)와 판매 성과
export default async function BrandChannelsPage() {
  const user = await requireRole(["BRAND_ADMIN"]);
  if (user.id === "demo-brand") return <p className="rounded-2xl border bg-white p-5 text-sm text-slate-700">판매처를 보려면 데이터베이스 연결이 필요합니다.</p>;
  try {
    const shop = await prisma.brandShop.findFirst({ where: brandShopWhere(user.id), select: { id: true, requireSellerApproval: true } });
    if (!shop) return <Empty icon={Store} text="브랜드샵을 만들면 판매처 현황이 여기에 표시됩니다." action={{ href: "/brand/shop", label: "브랜드샵 만들기" }} />;
    const since = addMonths(kstStartOfMonth(new Date()), -2);
    const [partners, sellerListings, facilityListings, pos] = await Promise.all([
      prisma.brandPartner.findMany({
        where: { shopId: shop.id }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], take: 300,
        select: { userId: true, status: true, note: true, updatedAt: true, user: { select: { email: true, role: true, profile: { select: { name: true, companyName: true } } } } },
      }),
      prisma.sellerBrandProduct.findMany({
        where: { brandProduct: { shopId: shop.id } }, orderBy: { createdAt: "desc" }, take: 300,
        select: { id: true, salePrice: true, isActive: true, createdAt: true, seller: { select: { id: true, email: true, profile: { select: { name: true, companyName: true } } } }, brandProduct: { select: { name: true, supplyPrice: true } } },
      }),
      prisma.facilityProduct.findMany({
        where: { brandProduct: { shopId: shop.id } }, orderBy: { createdAt: "desc" }, take: 300,
        select: { id: true, salePrice: true, stock: true, fulfillment: true, createdAt: true, facility: { select: { id: true, name: true, region: true, ownerId: true } }, brandProduct: { select: { name: true, supplyPrice: true } } },
      }),
      prisma.purchaseOrder.findMany({
        where: { brandShopId: shop.id, createdAt: { gte: since }, status: { notIn: ["CANCELLED", "RETURNED"] } },
        select: { sellerId: true, facilityId: true, supplyAmount: true },
      }),
    ]);
    const bySeller = new Map<string, { n: number; amt: number }>();
    const byFacility = new Map<string, { n: number; amt: number }>();
    for (const p of pos) {
      const s = bySeller.get(p.sellerId) ?? { n: 0, amt: 0 }; s.n += 1; s.amt += p.supplyAmount; bySeller.set(p.sellerId, s);
      if (p.facilityId) { const f = byFacility.get(p.facilityId) ?? { n: 0, amt: 0 }; f.n += 1; f.amt += p.supplyAmount; byFacility.set(p.facilityId, f); }
    }
    const sellers = new Set(sellerListings.filter((l) => l.isActive).map((l) => l.seller.id));
    const facilities = new Set(facilityListings.map((l) => l.facility.id));
    const sellerName = (s: { email: string; profile: { name: string | null; companyName: string | null } | null }) => s.profile?.companyName || s.profile?.name || s.email.split("@")[0];
    const statusOf = new Map(partners.map((p) => [p.userId, p.status as "PENDING" | "APPROVED" | "BLOCKED"]));
    const pending = partners.filter((p) => p.status === "PENDING");
    const blocked = partners.filter((p) => p.status === "BLOCKED");
    const STATUS_LABEL = { PENDING: "신청", APPROVED: "승인", BLOCKED: "차단", NONE: "자동 허용" } as const;

    return (
      <div className="space-y-5">
        <PageHeader title="판매처 관리" description="내 상품을 판매하는 셀러와 창고(스튜디오)를 승인하거나 차단하고, 최근 3개월 발주 실적을 봅니다." />
        <Panel eyebrow="PARTNERS" title={shop.requireSellerApproval ? "판매처 신청 · 승인 (승인제 운영 중)" : "판매처 차단 · 신청 관리"} action={{ href: "/brand/shop", label: "승인제 설정" }}>
          {!shop.requireSellerApproval && <p className="mb-2 text-xs text-slate-500">지금은 누구나 상품을 가져갈 수 있습니다. 샵 정보에서 &lsquo;승인한 판매처만&rsquo;을 켜면 신청을 받아 승인한 곳만 판매할 수 있습니다.</p>}
          {pending.length + blocked.length === 0 ? <Empty text="대기 중인 신청이나 차단한 판매처가 없습니다" /> : (
            <ul className="divide-y divide-[#F0ECE6]">
              {[...pending, ...blocked].map((p) => (
                <li key={p.userId} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-navy">{sellerName(p.user)} <span className="text-xs font-normal text-slate-400">{p.user.role === "SELLER" ? "셀러" : "창고(스튜디오)"}</span></span>
                    <span className="block truncate text-xs text-slate-500">{STATUS_LABEL[p.status as keyof typeof STATUS_LABEL]}{p.note ? ` · ${p.note}` : ""}</span></span>
                  <PartnerActions userId={p.userId} status={p.status as "PENDING" | "BLOCKED"} name={sellerName(p.user)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label="전체 판매처" value={String(sellers.size + facilities.size)} unit="곳" icon={Users} tone="brand" emphasis />
          <KpiTile label="셀러(직배송)" value={String(sellers.size)} unit="명" sub={`등록 상품 ${sellerListings.length}건`} icon={Video} tone="violet" />
          <KpiTile label="창고(스튜디오)" value={String(facilities.size)} unit="곳" sub={`등록 상품 ${facilityListings.length}건`} icon={Warehouse} tone="sky" />
          <KpiTile label="최근 3개월 발주" value={compactKRW(pos.reduce((s, p) => s + p.supplyAmount, 0))} sub={`${pos.length}건 · 공급가 기준`} icon={Store} tone="green" />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel eyebrow="SELLERS" title="셀러 판매처" action={{ href: "/brand/orders", label: "발주서" }}>
            {sellerListings.length === 0 ? <Empty text="아직 내 상품을 담은 셀러가 없습니다" /> : (
              <ul className="divide-y divide-[#F0ECE6]">
                {sellerListings.map((l) => {
                  const perf = bySeller.get(l.seller.id);
                  return (
                    <li key={l.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-navy">{sellerName(l.seller)}</span><span className="block truncate text-xs text-slate-500">{l.brandProduct.name} · 판매가 {formatKRW(l.salePrice)} · 마진 {formatKRW(l.salePrice - l.brandProduct.supplyPrice)}</span></span>
                      <Link href={`/brand/messages?to=${l.seller.id}`} className="shrink-0 text-xs font-semibold text-brand-700 underline underline-offset-2">메시지</Link>
                      <PartnerActions userId={l.seller.id} status={statusOf.get(l.seller.id) ?? "NONE"} name={sellerName(l.seller)} />
                      <span className="shrink-0 text-right text-xs"><Pill tone={l.isActive ? "green" : "slate"}>{l.isActive ? "판매 중" : "중지"}</Pill><span className="mt-1 block text-slate-400">{perf ? `발주 ${perf.n}건 · ${compactKRW(perf.amt)}` : relativeTime(l.createdAt)}</span></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel eyebrow="SPACES" title="창고(스튜디오) 판매처" action={{ href: "/brand/requests?kind=SUPPLY", label: "입고 신청" }}>
            {facilityListings.length === 0 ? <Empty text="아직 내 상품을 담은 창고(스튜디오)가 없습니다" /> : (
              <ul className="divide-y divide-[#F0ECE6]">
                {facilityListings.map((l) => {
                  const perf = byFacility.get(l.facility.id);
                  return (
                    <li key={l.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-navy">{l.facility.name} <span className="text-xs font-normal text-slate-400">{l.facility.region}</span></span><span className="block truncate text-xs text-slate-500">{l.brandProduct?.name} · 판매가 {formatKRW(l.salePrice)}</span></span>
                      <PartnerActions userId={l.facility.ownerId} status={statusOf.get(l.facility.ownerId) ?? "NONE"} name={l.facility.name} />
                      <span className="shrink-0 text-right text-xs"><Pill tone={l.fulfillment === "WAREHOUSE" ? "sky" : "violet"}>{FULFILLMENT_LABEL[l.fulfillment ?? "DROPSHIP"]}</Pill><span className="mt-1 block text-slate-400">{l.fulfillment === "WAREHOUSE" ? `위탁 재고 ${l.stock}개` : perf ? `발주 ${perf.n}건` : "발주 없음"}</span></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
        <p className="text-xs text-slate-500">판매처를 늘리려면 <Link href="/brand/products?filter=sample" className="font-semibold underline">샘플 가능한 상품</Link>을 늘리고 샘플 신청에 빠르게 응답하세요.</p>
      </div>
    );
  } catch (e) {
    return <DataNotice issue={reportDbError("brand-channels", e)} />;
  }
}
