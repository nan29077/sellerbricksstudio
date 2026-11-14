import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import { prisma } from "@/lib/prisma";
import { reportDbError, type DbIssue } from "@/lib/db-error";
import { getPolicy } from "@/lib/policy";
import { brandSalesSummary } from "@/lib/purchase-orders";
import { BRAND_SHOP_STATUS, FULFILLMENT_LABEL, PO_STATUS } from "@/lib/brands";
import { addDays, addMonths, kstStartOfMonth } from "@/lib/kst";
import { compactKRW, dailySeries, deltaPct, greeting, monthlySeries, relativeTime, todayLabel, zipSeries } from "@/lib/dashboard";
import { LOW_STOCK, shopChecklist } from "@/components/shop/brand-workspace";
import { DisplayRequestsPanel } from "@/components/dashboard/display-requests-panel";
import {
  DashHero, DataNotice, Donut, Empty, Feed, HeroButton, HeroPanel, KpiTile, Panel, RankList, ShortcutGrid, TodoList, TrendChart,
} from "@/components/dashboard/kit";
import {
  AlertTriangle, Banknote, BadgeAlert, Boxes, ClipboardList, CreditCard, FileText, Gift, LayoutTemplate, Package, PackageX,
  PackagePlus, Settings, ShoppingBag, Store, Truck, Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function load(userId: string) {
  const shop = await prisma.brandShop.findFirst({ where: brandShopWhere(userId) });
  if (!shop) return { shop: null };
  const now = new Date();
  const monthStart = kstStartOfMonth(now);
  const lastMonthStart = addMonths(monthStart, -1);
  const lastMonthSameDay = new Date(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()));
  const sixStart = addMonths(monthStart, -5);
  const policy = await getPolicy();
  const lateBefore = new Date(now.getTime() - policy.poConfirmHours * 3600000);
  const sid = shop.id;

  const [
    summary, pos, newPos, latePos, toShip, samplePending, awaitingPayment, supplyPending,
    productTotal, productActive, soldout, lowStock, sampleReady, sellerListings, facilityListings, topItems, recentPos,
    cancelRequested, returnsWaiting, unreadThreads, partnerPending,
  ] = await Promise.all([
    brandSalesSummary(sid),
    prisma.purchaseOrder.findMany({ where: { brandShopId: sid, createdAt: { gte: sixStart }, status: { notIn: ["CANCELLED", "RETURNED"] } }, select: { createdAt: true, supplyAmount: true, fulfillment: true, sellerId: true } }),
    prisma.purchaseOrder.count({ where: { brandShopId: sid, status: "NEW" } }),
    prisma.purchaseOrder.count({ where: { brandShopId: sid, status: "NEW", createdAt: { lt: lateBefore } } }),
    prisma.purchaseOrder.count({ where: { brandShopId: sid, status: "CONFIRMED", fulfillment: "DROPSHIP" } }),
    prisma.brandRequest.count({ where: { product: { shopId: sid }, kind: { in: ["SAMPLE", "DISPLAY"] }, status: "PENDING" } }),
    prisma.brandRequest.count({ where: { product: { shopId: sid }, status: "AWAITING_PAYMENT" } }),
    prisma.brandRequest.count({ where: { product: { shopId: sid }, kind: "SUPPLY", status: "PENDING" } }),
    prisma.brandProduct.count({ where: { shopId: sid } }),
    prisma.brandProduct.count({ where: { shopId: sid, isActive: true } }),
    prisma.brandProduct.count({ where: { shopId: sid, isActive: true, stock: 0 } }),
    prisma.brandProduct.findMany({ where: { shopId: sid, isActive: true, stock: { lte: LOW_STOCK } }, orderBy: { stock: "asc" }, take: 5, select: { id: true, name: true, stock: true } }),
    prisma.brandProduct.count({ where: { shopId: sid, isActive: true, sampleStock: { gt: 0 } } }),
    prisma.sellerBrandProduct.findMany({ where: { brandProduct: { shopId: sid }, isActive: true }, select: { sellerId: true } }),
    prisma.facilityProduct.findMany({ where: { brandProduct: { shopId: sid } }, select: { facilityId: true } }),
    prisma.purchaseOrderItem.groupBy({
      by: ["brandProductId", "productName"], where: { purchaseOrder: { brandShopId: sid, createdAt: { gte: addDays(now, -90) }, status: { notIn: ["CANCELLED", "RETURNED"] } } },
      _sum: { quantity: true, supplyPrice: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5,
    }),
    prisma.purchaseOrder.findMany({
      where: { brandShopId: sid }, orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, poNo: true, status: true, fulfillment: true, supplyAmount: true, createdAt: true, facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true, companyName: true } } } } },
    }),
    prisma.purchaseOrder.count({ where: { brandShopId: sid, cancelRequestedAt: { not: null }, status: { in: ["NEW", "CONFIRMED"] } } }),
    prisma.purchaseOrder.count({ where: { brandShopId: sid, status: "RETURNED", returnReceivedAt: null } }),
    prisma.brandThread.count({ where: { shopId: sid, brandUnread: { gt: 0 } } }),
    prisma.brandPartner.count({ where: { shopId: sid, status: "PENDING" } }),
  ]);

  const mPos = pos.filter((p) => p.createdAt >= monthStart);
  const pPos = pos.filter((p) => p.createdAt >= lastMonthStart && p.createdAt < lastMonthSameDay);
  const supply = mPos.reduce((s, p) => s + p.supplyAmount, 0);
  const bySeller = new Map<string, { n: number; amt: number }>();
  for (const p of pos) { const x = bySeller.get(p.sellerId) ?? { n: 0, amt: 0 }; x.n += 1; x.amt += p.supplyAmount; bySeller.set(p.sellerId, x); }
  const topSellerIds = [...bySeller.entries()].sort((a, b) => b[1].amt - a[1].amt).slice(0, 5);
  const sellerUsers = await prisma.user.findMany({ where: { id: { in: topSellerIds.map(([id]) => id) } }, select: { id: true, email: true, profile: { select: { name: true, companyName: true } } } });

  return {
    shop, policy, summary,
    supply, supplyDelta: deltaPct(supply, pPos.reduce((s, p) => s + p.supplyAmount, 0)), poCount: mPos.length,
    spark: dailySeries(pos.filter((p) => p.createdAt >= addDays(now, -29)), 30, (p) => p.createdAt, (p) => p.supplyAmount).map((x) => x.value),
    trend: zipSeries(monthlySeries(pos, 6, (p) => p.createdAt, (p) => p.supplyAmount), monthlySeries(pos, 6, (p) => p.createdAt)),
    mix: { dropship: pos.filter((p) => p.fulfillment === "DROPSHIP").reduce((s, p) => s + p.supplyAmount, 0), warehouse: pos.filter((p) => p.fulfillment === "WAREHOUSE").reduce((s, p) => s + p.supplyAmount, 0) },
    todo: { newPos, latePos, toShip, samplePending, awaitingPayment, supplyPending, soldout, cancelRequested, returnsWaiting, unreadThreads, partnerPending },
    products: { total: productTotal, active: productActive, sampleReady, lowStock },
    channels: { sellers: new Set(sellerListings.map((s) => s.sellerId)).size, facilities: new Set(facilityListings.map((f) => f.facilityId)).size },
    topItems, recentPos,
    topSellers: topSellerIds.map(([id, v]) => { const u = sellerUsers.find((x) => x.id === id); return { key: id, name: u?.profile?.companyName || u?.profile?.name || u?.email || "셀러", sub: `발주 ${v.n}건`, value: v.amt, valueLabel: compactKRW(v.amt) }; }),
    checklist: shopChecklist(shop),
  };
}

export default async function BrandDashboard() {
  const user = await requireRole(["BRAND_ADMIN"]);
  const hello = `${greeting()}, ${user.name ?? "브랜드"}님`;
  if (user.id === "demo-brand") {
    return <div className="space-y-6"><DashHero eyebrow={`BRAND · ${todayLabel()}`} title={hello} description="데모 계정에서 샵을 만들고 저장하려면 데이터베이스 연결이 필요합니다." /></div>;
  }
  let d: Awaited<ReturnType<typeof load>> | null = null;
  let issue: DbIssue = "unknown";
  try { d = await load(user.id); } catch (e) { issue = reportDbError("brand-dashboard", e); }
  if (!d) return <div className="space-y-6"><DashHero eyebrow={`BRAND · ${todayLabel()}`} title={hello} /><DataNotice issue={issue} /></div>;

  if (!d.shop) {
    const steps = [
      { n: 1, title: "브랜드샵 만들기", desc: "샵 이름 · 소개 · 취급 카테고리와 정산 계좌를 입력합니다.", href: "/brand/shop", cta: "샵 만들기" },
      { n: 2, title: "상품 등록", desc: "공급가 · 권장 소비자가 · 배송 방식(위탁배송 · 스토리지마켓 입고) · 샘플 조건을 정합니다.", href: "/brand/products?new=1", cta: "상품 등록" },
      { n: 3, title: "승인 후 공개", desc: "최고관리자 승인 후 셀러가 브랜드샵에서 상품을 골라 방송하고 판매해요.", href: "/brand/shop", cta: "샵 꾸미기" },
    ];
    return (
      <div className="space-y-6 pb-6">
        <DashHero eyebrow={`BRAND · ${todayLabel()}`} title={hello} description="브랜드샵을 열면 라이브 셀러가 상품을 골라 방송하고, 판매될 때마다 발주서가 자동으로 들어와요."
          actions={<HeroButton href="/brand/shop" primary><Store className="h-4 w-4" />브랜드샵 만들기</HeroButton>} />
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((s) => (
            <Link key={s.n} href={s.href} className="rounded-[22px] border border-[#E9E5DC] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-sm font-extrabold text-brand-300">{s.n}</span>
              <p className="mt-3 font-extrabold text-navy">{s.title}</p>
              <p className="mt-1 break-keep text-sm text-slate-500">{s.desc}</p>
              <p className="mt-3 text-xs font-bold text-brand-700">{s.cta} →</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const shop = d.shop;
  const missing = d.checklist.filter((c) => !c.done);
  const total = d.mix.dropship + d.mix.warehouse;

  return (
    <div className="space-y-6 pb-6">
      <DashHero
        eyebrow={`BRAND · ${todayLabel()}`}
        title={hello}
        description={`${shop.name} · 발주 확인과 출고, 샘플 · 방송 시연품 응답, 재고를 챙기고 판매처를 늘려 보세요.`}
        chips={[
          { label: BRAND_SHOP_STATUS[shop.status], tone: shop.status === "APPROVED" ? "default" : "warn" },
          ...(d.todo.latePos ? [{ label: `확인 지연 발주 ${d.todo.latePos}건`, tone: "warn" as const }] : []),
          { label: `판매처 ${d.channels.sellers + d.channels.facilities}곳` },
          { label: `공개 상품 ${d.products.active}개` },
        ]}
        actions={<><HeroButton href="/brand/orders?status=NEW" primary><FileText className="h-4 w-4" />신규 발주 확인</HeroButton><HeroButton href="/brand/products?new=1"><PackagePlus className="h-4 w-4" />상품 등록</HeroButton><HeroButton href={`/brands/${shop.id}`} newTab><Store className="h-4 w-4" />샵 바로가기</HeroButton></>}
        aside={
          <HeroPanel title="정산 현황" href="/brand/settlements" cta="정산 내역">
            <p className="text-[11px] text-white/60">정산 예정 (배송 완료)</p>
            <p className="text-3xl font-extrabold">{compactKRW(d.summary.unsettledAmount)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/[0.06] px-2.5 py-2"><p className="text-white/55">진행 중 발주</p><p className="font-bold">{compactKRW(d.summary.openAmount)}</p></div>
              <div className="rounded-xl bg-white/[0.06] px-2.5 py-2"><p className="text-white/55">누적 지급</p><p className="font-bold">{compactKRW(d.summary.paidOut)}</p></div>
            </div>
            {!shop.bankAccount && <p className="mt-2 rounded-lg bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-100">정산 계좌가 아직 없습니다</p>}
          </HeroPanel>
        }
      />

      {shop.status !== "APPROVED" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="break-keep">{shop.moderationNote || (shop.status === "PENDING" ? "최고관리자 승인 전이라 브랜드샵 목록에 아직 보이지 않습니다. 샵 정보와 상품을 미리 채워 두면 승인이 빨라집니다." : "샵 공개가 중지된 상태입니다. 고객센터로 문의해 주세요.")}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile emphasis label="이번 달 발주 (공급가)" value={compactKRW(d.supply)} delta={d.supplyDelta} sub={`${d.poCount}건 · 전월 동기 대비`} icon={Banknote} tone="brand" spark={d.spark} href="/brand/orders" />
        <KpiTile label="신규 발주" value={String(d.todo.newPos)} unit="건" sub={d.todo.latePos ? `확인 지연 ${d.todo.latePos}건` : `${d.policy.poConfirmHours}시간 안에 확인`} icon={ClipboardList} tone={d.todo.latePos ? "red" : "amber"} href="/brand/orders?status=NEW" />
        <KpiTile label="출고 대기 (위탁배송)" value={String(d.todo.toShip)} unit="건" sub="운송장 입력 필요" icon={Truck} tone="blue" href="/brand/orders?status=CONFIRMED" />
        <KpiTile label="샘플 · 입고 신청" value={String(d.todo.samplePending + d.todo.supplyPending)} unit="건" sub={`샘플 ${d.todo.samplePending} · 입고 ${d.todo.supplyPending}`} icon={Gift} tone="violet" href="/brand/requests?status=PENDING" />
        <KpiTile label="판매처" value={String(d.channels.sellers + d.channels.facilities)} unit="곳" sub={`셀러 ${d.channels.sellers} · 스토리지마켓 ${d.channels.facilities}`} icon={Users} tone="green" href="/brand/channels" />
        <KpiTile label="공개 상품" value={String(d.products.active)} unit="개" sub={`전체 ${d.products.total} · 샘플 가능 ${d.products.sampleReady}`} icon={Boxes} tone="sky" href="/brand/products" />
      </div>

      <DisplayRequestsPanel shopId={shop.id} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel eyebrow="6 MONTHS" title="월별 발주 금액 · 건수" action={{ href: "/brand/orders", label: "발주서" }}>
          <TrendChart data={d.trend} a={{ name: "공급가 합계", format: compactKRW }} b={{ name: "발주", format: (n) => `${n}건` }} />
        </Panel>
        <Panel eyebrow="TO DO" title="지금 처리할 일">
          <TodoList items={[
            { label: "확인이 늦어진 발주", desc: `${d.policy.poConfirmHours}시간 넘게 확인하지 않았어요`, n: d.todo.latePos, href: "/brand/orders?status=NEW", icon: BadgeAlert, tone: "red", urgent: true },
            { label: "신규 발주 확인", n: d.todo.newPos - d.todo.latePos, href: "/brand/orders?status=NEW", icon: FileText, tone: "amber" },
            { label: "운송장 입력 대기 (위탁배송)", n: d.todo.toShip, href: "/brand/orders?status=CONFIRMED", icon: Truck, tone: "blue" },
            { label: "출고 불가 요청 중", desc: "판매처가 부분 취소하면 정리돼요", n: d.todo.cancelRequested, href: "/brand/claims", icon: BadgeAlert, tone: "red" },
            { label: "반품 상품 수령 대기", n: d.todo.returnsWaiting, href: "/brand/claims?status=RETURNED", icon: PackageX, tone: "amber" },
            { label: "안 읽은 판매처 문의", n: d.todo.unreadThreads, href: "/brand/messages", icon: FileText, tone: "violet" },
            { label: "판매처 신청 승인", n: d.todo.partnerPending, href: "/brand/channels", icon: Package, tone: "sky" },
            { label: "샘플 · 방송 시연품 요청 검토", desc: "시연품은 방송 2일 전까지 공간에 도착해야 해요", n: d.todo.samplePending, href: "/brand/requests?status=PENDING", icon: Gift, tone: "violet" },
            { label: "스토리지마켓 입고 요청 검토", n: d.todo.supplyPending, href: "/brand/requests?kind=SUPPLY", icon: Package, tone: "sky" },
            { label: "결제 대기 샘플", n: d.todo.awaitingPayment, href: "/brand/requests?status=AWAITING_PAYMENT", icon: CreditCard, tone: "slate" },
            { label: "품절된 공개 상품", desc: "재고를 채우거나 숨김 처리하세요", n: d.todo.soldout, href: "/brand/products?filter=soldout", icon: PackageX, tone: "red" },
            { label: "샵 정보 미입력 항목", desc: missing.map((m) => m.label).slice(0, 3).join(" · "), n: missing.length, href: "/brand/shop", icon: LayoutTemplate, tone: "slate" },
          ]} emptyText="모두 처리했어요. 새 상품이나 샘플로 판매처를 늘려 보세요." />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel eyebrow="BEST · 90 DAYS" title="많이 팔린 상품" action={{ href: "/brand/products", label: "상품 관리" }}>
          <RankList empty="최근 90일 발주된 상품이 없습니다" items={d.topItems.map((t) => ({ key: t.brandProductId, name: t.productName, sub: `공급가 합계 ${compactKRW(t._sum.supplyPrice ?? 0)}`, value: t._sum.quantity ?? 0, valueLabel: `${(t._sum.quantity ?? 0).toLocaleString("ko-KR")}개` }))} />
        </Panel>
        <Panel eyebrow="TOP CHANNELS" title="발주가 많은 셀러" action={{ href: "/brand/channels", label: "판매처 현황" }}>
          <RankList empty="최근 6개월 발주가 없습니다" items={d.topSellers} />
        </Panel>
        <Panel eyebrow="FULFILLMENT" title="배송 방식 비중" className="lg:col-span-2 2xl:col-span-1">
          {total === 0 ? <Empty text="발주가 생기면 위탁배송 / 스토리지마켓 입고 비중이 표시됩니다" /> : (
            <Donut centerValue={compactKRW(total)} centerLabel="6개월 공급가" segments={[
              { label: FULFILLMENT_LABEL.DROPSHIP, value: d.mix.dropship, tone: "violet" },
              { label: FULFILLMENT_LABEL.WAREHOUSE, value: d.mix.warehouse, tone: "sky" },
            ]} />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel eyebrow="RECENT" title="최근 발주서" action={{ href: "/brand/orders", label: "전체 보기" }}>
          <Feed empty="아직 들어온 발주서가 없습니다" items={d.recentPos.map((p) => ({
            key: p.id, title: `${p.poNo} · ${compactKRW(p.supplyAmount)}`,
            sub: `${p.seller.profile?.companyName || p.seller.profile?.name || p.seller.email} · ${(p.facility?.name ?? "셀러 공간")} · ${FULFILLMENT_LABEL[p.fulfillment]} · ${PO_STATUS[p.status].label}`,
            time: relativeTime(p.createdAt), icon: FileText, tone: p.status === "NEW" ? "amber" as const : p.status === "DELIVERED" ? "green" as const : "blue" as const, href: `/brand/orders?q=${p.poNo}`,
          }))} />
        </Panel>
        <Panel eyebrow="STOCK" title={`재고 부족 (${LOW_STOCK}개 이하)`} action={{ href: "/brand/products?filter=low", label: "재고 수정" }}>
          {d.products.lowStock.length === 0 ? <Empty icon={Package} text="재고가 충분합니다" /> : (
            <ul className="space-y-2">
              {d.products.lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/brand/products?q=${encodeURIComponent(p.name)}`} className="flex items-center justify-between gap-2 rounded-xl border border-[#EEEAE2] px-3 py-2.5 hover:border-brand-300">
                    <span className="truncate text-sm font-semibold text-navy">{p.name}</span>
                    <span className={`shrink-0 text-sm font-extrabold ${p.stock === 0 ? "text-rose-600" : "text-amber-600"}`}>{p.stock === 0 ? "품절" : `${p.stock}개`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel eyebrow="SHORTCUTS" title="바로가기">
        <ShortcutGrid cols="sm:grid-cols-2 xl:grid-cols-4" items={[
          { title: "상품 · 재고 관리", desc: "상품 등록 · 수정 · 숨김", href: "/brand/products", icon: Boxes, tone: "brand" },
          { title: "샵 꾸미기 · 라이브 영상", desc: "디자인 · 소개 · 라이브 커머스 영상", href: "/brand/shop", icon: LayoutTemplate, tone: "navy", badge: missing.length },
          { title: "발주서 · 출고", desc: "확인 · 운송장 입력", href: "/brand/orders", icon: FileText, tone: "amber", badge: d.todo.newPos },
          { title: "셀러 요청", desc: "샘플 · 방송 시연품 · 입고", href: "/brand/requests", icon: Gift, tone: "violet", badge: d.todo.samplePending + d.todo.supplyPending },
          { title: "판매처 현황", desc: "내 상품을 파는 곳", href: "/brand/channels", icon: Users, tone: "green" },
          { title: "정산 내역", desc: "지급·수수료 확인", href: "/brand/settlements", icon: Banknote, tone: "sky" },
          { title: "판매처 문의함", desc: "셀러와 1:1 대화", href: "/brand/messages", icon: ShoppingBag, tone: "slate", badge: d.todo.unreadThreads },
          { title: "설정", desc: "계정·알림", href: "/brand/settings", icon: Settings, tone: "slate" },
        ]} />
      </Panel>
    </div>
  );
}
