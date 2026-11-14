import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarPlus, Heart, House, Info, LayoutGrid, MapPin, MessageCircle, Phone } from "lucide-react";
import { BrandFavoriteButton } from "@/components/shop/brand-favorite-button";
import { PartnerApply } from "@/components/brand/partner-apply";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { BRAND_BUYER_ROLES, BRAND_CATEGORIES, brandArtworkFor, brandProductHref, parseOptions, canSeeSupplyPrice, SUPPLY_PRICE_HIDDEN_NOTE } from "@/lib/brands";
import { priceBreakdown, readVariants } from "@/lib/brand-pricing";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import { categoryFilterValues } from "@/lib/categories";
import { getPolicy } from "@/lib/policy";
import { BrandImportButton } from "@/components/shop/brand-import-button";
import { BRAND_ARTWORK } from "@/lib/shop-artwork";
import { cn, formatKRW } from "@/lib/utils";
import { defaultProfileImage } from "@/lib/profile";
import { pageOf, sp, type SP } from "@/lib/list";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Pagination } from "@/components/list/pagination";
import { BrandOrderButton } from "@/components/shop/brand-order-button";
import { ShopImage } from "@/components/shop/shop-image";
import { ShopShell } from "@/components/shop/shop-shell";
import { buyerHome } from "@/components/shop/buyer-brand-pages";
import { StudioBrandMark } from "@/components/home/studio-brand";
import { PriceLine, ProductCard, ProductChip, ProductGrid, ViewToggle, viewOf } from "@/components/shop/product-card";
import { ProductGallery } from "@/components/shop/product-gallery";

// 브랜드샵 화면 — 메인(/brands/[id])과 각 대시보드 안(셀러 /seller/brands/[id] 등)에서 같은 내용을 보여 준다 (2026-11-14)
export async function BrandStorefront({ id, searchParams, base = "/brands", frame = "shop", studio = false }: { id: string; searchParams: SP; base?: string; frame?: "shop" | "inline"; studio?: boolean }) {
  const [shop, user] = await Promise.all([
    prisma.brandShop.findUnique({
      where: { id },
      select: {
        id: true, ownerId: true, owner: { select: { isActive: true, role: true } }, status: true,
        name: true, tagline: true, description: true, logoUrl: true, bannerUrl: true, backgroundUrl: true,
        paymentInstructions: true, categories: true, csPhone: true, returnAddress: true, requireSellerApproval: true,
      },
    }),
    getSessionUser(),
  ]);
  if (!shop) notFound();
  const published = shop.status === "APPROVED" && shop.owner.isActive && shop.owner.role === "BRAND_ADMIN";
  const isMine = user?.id === shop.ownerId || (user?.role === "BRAND_ADMIN" && !!(await prisma.brandMember.findFirst({ where: { shopId: shop.id, userId: user.id }, select: { id: true } })));
  if (!published && !isMine && user?.role !== "SUPER_ADMIN") notFound();

  const buyer = !!user && BRAND_BUYER_ROLES.includes(user.role);
  // 공급가·재고·최저 판매가는 거래 파트너·최고관리자·자기 브랜드에만 보여 준다
  const showSupply = isMine || canSeeSupplyPrice(user?.role);
  const category = BRAND_CATEGORIES.find((value) => value === sp(searchParams, "category"));
  const selectedProduct = sp(searchParams, "product")?.slice(0, 64);
  const { page, size, skip, take } = pageOf(searchParams, 12);
  const where = {
    // 숨긴 상품도 자기 브랜드 · 최고관리자는 상세를 볼 수 있다
    shopId: shop.id, ...(!(selectedProduct && (isMine || user?.role === "SUPER_ADMIN")) && { isActive: true }),
    ...(selectedProduct ? { id: selectedProduct } : category ? { category: { in: categoryFilterValues(category) } } : {}),
  };
  const [products, total, policy, facilities] = await Promise.all([
    prisma.brandProduct.findMany({ where, skip: selectedProduct ? 0 : skip, take: selectedProduct ? 1 : take, orderBy: { createdAt: "desc" } }),
    prisma.brandProduct.count({ where }),
    getPolicy(),
    buyer && user?.role === "SUPER_ADMIN"
      ? prisma.facility.findMany({ where: { status: { not: "SUSPENDED" } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  // 계정당 샘플 신청 한도 안내용
  const usedSamples = buyer && user ? await prisma.brandRequest.groupBy({
    by: ["productId"], where: { buyerId: user.id, kind: "SAMPLE", productId: { in: products.map((p) => p.id) }, status: { notIn: ["REJECTED", "CANCELLED", "REFUNDED"] } },
    _count: true,
  }) : [];
  const used = new Map(usedSamples.map((u) => [u.productId, u._count]));
  const imported = buyer && user ? new Set((user.role === "SELLER"
    ? await prisma.sellerBrandProduct.findMany({ where: { sellerId: user.id, brandProductId: { in: products.map((p) => p.id) } }, select: { brandProductId: true } })
    : await prisma.facilityProduct.findMany({ where: { brandProductId: { in: products.map((p) => p.id) } }, select: { brandProductId: true } })
  ).map((x) => x.brandProductId!)) : new Set<string>();
  // 찜 조회가 실패해도(예: Prisma Client 미갱신) 샵 화면은 열리게 한다
  // 판매처 관계: 차단되면 신청·가져오기 불가, 승인제 브랜드는 승인 후 가져오기
  let favorites = new Set<string>();
  if (buyer && user && !user.id.startsWith("demo-")) {
    try {
      favorites = new Set((await prisma.brandProductFavorite.findMany({ where: { userId: user.id, brandProductId: { in: products.map((p) => p.id) } }, select: { brandProductId: true } })).map((f) => f.brandProductId));
    } catch { /* 찜 테이블을 못 읽어도 샵 화면은 그대로 보여 준다 */ }
  }
  const partner = buyer && user ? await prisma.brandPartner.findUnique({ where: { shopId_userId: { shopId: shop.id, userId: user.id } }, select: { status: true } }) : null;
  const blocked = partner?.status === "BLOCKED";
  const canImport = !blocked && (!shop.requireSellerApproval || partner?.status === "APPROVED");
  const path = `${base}/${shop.id}`;
  const login = `/login?callbackUrl=${encodeURIComponent(selectedProduct ? brandProductHref(shop.id, selectedProduct, base) : path)}`;
  const shopAvatar = defaultProfileImage(`brand:${shop.id}`);
  const management = user?.role === "SUPER_ADMIN" ? `/admin/brands/${shop.id}` : isMine ? "/brand/shop" : null;
  // 메뉴는 이 브랜드샵 안의 섹션으로만 구성
  const detail = selectedProduct ? products[0] : undefined;
  const view = viewOf(searchParams);
  const notices = <>
    {buyer && published && blocked && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">이 브랜드와의 거래가 중지된 계정입니다. 샘플 신청과 상품 가져오기를 할 수 없습니다.</p>}
    {buyer && published && !blocked && !canImport && <PartnerApply shopId={shop.id} status={partner?.status === "PENDING" ? "PENDING" : "NONE"} />}
    {!detail && user && !buyer && published && <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500"><Info aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />찜 · 샘플 신청 · 판매 상품 가져오기는 셀러와 공간 계정에서 이용할 수 있습니다.</p>}
  </>;
  const links = [
    { href: "#shop-home", label: "홈", icon: House },
    { href: `${detail ? path : ""}#shop-products`, label: "상품", icon: LayoutGrid },
    { href: `${detail ? path : ""}#shop-info`, label: "브랜드 정보", icon: Info },
    { href: "#shop-contact", label: "문의", icon: MessageCircle },
  ];

  return (
    <ShopShell background={shop.backgroundUrl} fallback={BRAND_ARTWORK[4].url} links={links} frame={frame}>
      <header id="shop-home" className={studio ? "flex min-h-11 items-center justify-end gap-4 border-b bg-white px-4 sm:px-6" : "flex min-h-16 items-center justify-between gap-4 border-b bg-white px-4 sm:px-6"}>
        {studio ? <StudioBrandMark id={shop.id} name={shop.name} logo={shop.logoUrl} /> : (
          <div className="flex min-w-0 items-center gap-2">
            <ShopImage src={shop.logoUrl} fallback={shopAvatar} className="h-9 w-9 shrink-0 rounded-full border bg-white object-cover" />
            <span className="truncate text-sm font-black text-navy">{shop.name}</span>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-3">
          {management && <Link href={management} className="text-xs font-bold text-slate-600 hover:text-navy">샵 관리</Link>}
          <Link href={base} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-navy"><ArrowLeft className="h-4 w-4" /> 브랜드 목록</Link>
        </div>
      </header>
      <main className="px-3 py-4 sm:px-6 sm:py-6">
        {detail ? (
          <Link href={path} className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm font-bold text-slate-600 hover:text-navy">
            <ArrowLeft className="h-4 w-4" aria-hidden />{shop.name} 전체 상품
          </Link>
        ) : <>
        <div className="relative aspect-[16/8] overflow-hidden rounded-[26px] bg-navy sm:aspect-[16/7]">
          <ShopImage src={shop.bannerUrl} fallback={BRAND_ARTWORK[0].url} eager className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/45 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-5 pb-5 text-white sm:px-9">
            <p className="mb-2 text-xs font-bold text-brand-200">스토리지마켓 브랜드샵</p>
            <h1 className="line-clamp-2 break-words text-2xl font-black sm:text-4xl">{shop.name}</h1>
            {shop.tagline && <p className="mt-2 line-clamp-2 max-w-sm text-sm">{shop.tagline}</p>}
          </div>
        </div>
        <section id="shop-info" className="relative mx-3 -mt-7 scroll-mt-4 rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_10px_30px_#1A1A2E12] sm:mx-6 sm:-mt-10 sm:p-6">
          <div className="flex items-center gap-3.5">
            <ShopImage src={shop.logoUrl} fallback={shopAvatar} className="h-14 w-14 shrink-0 rounded-2xl border border-slate-100 bg-white object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="truncate text-lg font-black text-navy">{shop.name}</h2>
                <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold", published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                  {published && <BadgeCheck aria-hidden="true" className="h-3 w-3" />}{published ? "파트너 브랜드" : "비공개 미리보기"}
                </span>
              </div>
              {shop.categories.length > 0 && <p className="mt-1 truncate text-xs text-slate-500">{shop.categories.join(" · ")}</p>}
            </div>
          </div>
          {shop.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{shop.description}</p>}
          {!user && <Link href={login} className={`${buttonVariants({ size: "sm" })} mt-4 w-full sm:w-auto`}>로그인하고 샘플 신청하기</Link>}
          {notices}
        </section>
        </>}

        <section id="shop-products" className={cn("scroll-mt-4 space-y-4", !detail && "mt-7")}>
          {!detail && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-black text-navy">브랜드 상품 <span className="text-base text-brand-700">{total.toLocaleString("ko-KR")}</span></h2>
              <div className="flex flex-wrap items-center gap-2">
                <form action={path} className="flex items-center gap-2">
                  {view === "list" && <input type="hidden" name="view" value="list" />}
                  <Select name="category" aria-label="상품 카테고리" defaultValue={category ?? ""} className="h-9 w-auto">
                    <option value="">전체 카테고리</option>
                    {BRAND_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
                  </Select>
                  <Button size="sm" variant="outline">조회</Button>
                </form>
                <ViewToggle base={path} params={searchParams} view={view} />
              </div>
            </div>
          )}
          {products.length === 0 && <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">{selectedProduct ? "선택한 상품을 현재 볼 수 없습니다." : "공개된 상품이 없습니다."}</p>}
          {detail ? (() => {
            const product = detail;
            const artwork = generatedBrandProductArtwork(shop.name, product);
            const fallback = artwork?.cover ?? brandArtworkFor(product.category);
            const uploaded = [...new Set([product.imageUrl, ...product.images].filter((v): v is string => !!v))];
            const gallery = uploaded.length ? uploaded : [artwork?.detail ?? fallback];
            const pb = priceBreakdown(product);
            const groups = parseOptions(product.options);
            const variants = readVariants(product.optionVariants, groups);
            const notice = ([["용량·중량", product.volume], ["유통기한", product.expiryInfo], ["인증·신고", product.certification], ["제조 · 수입", product.manufacturer], ["원산지", product.origin], ["과세", product.taxType === "TAX_FREE" ? "면세" : ""], ["반품 배송비", product.returnShippingFee ? formatKRW(product.returnShippingFee) : ""], ["교환 배송비", product.exchangeShippingFee ? formatKRW(product.exchangeShippingFee) : ""], ["전성분·원재료", product.ingredients]] as const).filter(([, v]) => v);
            const delivery = [product.allowDropship && "위탁배송", product.allowWarehouse && (product.minOrderQty > 1 ? `창고 입고(최소 ${product.minOrderQty.toLocaleString("ko-KR")}개)` : "창고 입고")].filter(Boolean).join(" · ") || "배송 방식 준비 중";
            const left = product.sampleLimitPerBuyer > 0 ? product.sampleLimitPerBuyer - (used.get(product.id) ?? 0) : Infinity;
            const onList = imported.has(product.id);
            return (
              <article className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-5 p-3 sm:p-5 md:grid-cols-2 md:gap-7">
                  <ProductGallery images={gallery} fallback={fallback} alt={product.name} />
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <ShopImage src={shop.logoUrl} fallback={shopAvatar} alt="" className="h-6 w-6 shrink-0 rounded-full border bg-white object-cover" />
                      <Link href={path} className="truncate text-xs font-bold text-slate-600 hover:text-navy hover:underline">{shop.name}</Link>
                      <span className="text-[11px] text-slate-400">· {product.category}{product.subCategory ? ` › ${product.subCategory}` : ""}</span>
                    </div>
                    <h1 className="break-keep text-xl font-black leading-snug tracking-tight text-navy sm:text-2xl">{product.name}</h1>
                    <div className="flex flex-wrap gap-1">
                      {[!product.isActive && { label: "숨김 상품(비공개)", tone: "gray" as const }, onList && { label: user?.role === "SELLER" ? "내 방송 상품" : "판매 목록에 있음", tone: "green" as const },
                        favorites.has(product.id) && { label: "찜한 상품", tone: "red" as const },
                        product.stock <= 0 ? { label: "품절", tone: "gray" as const } : product.stock <= 10 && { label: "재고 적음", tone: "amber" as const },
                        product.samplePrice !== null && product.sampleStock > 0 && { label: product.samplePrice === 0 ? "무료 샘플" : "유료 샘플", tone: "brand" as const },
                        product.priceRule === "FIXED" && pb.sale > 0 && { label: "판매가 고정", tone: "navy" as const },
                      ].filter(Boolean).map((c) => c && <ProductChip key={c.label} chip={c} />)}
                    </div>
                    <div className="rounded-2xl bg-[#F9F7F2] p-3.5 sm:p-4">
                      {showSupply ? (
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
                          <div><dt className="text-[11px] font-semibold text-slate-500">공급가</dt><dd className="text-lg font-black text-navy">{formatKRW(product.supplyPrice)}</dd></div>
                          <div><dt className="text-[11px] font-semibold text-slate-500">{pb.sale > 0 ? "판매가" : "권장 소비자가"}</dt>
                            <dd className="flex flex-wrap items-baseline gap-x-1">{pb.discountRate > 0 && <b className="text-sm text-rose-600">{pb.discountRate}%</b>}<span className="text-lg font-black text-navy">{formatKRW(pb.sale || product.consumerPrice)}</span></dd></div>
                          {pb.list > 0 && pb.sale > 0 && <div><dt className="text-[11px] font-semibold text-slate-500">정가</dt><dd className="font-bold text-slate-500 line-through">{formatKRW(pb.list)}</dd></div>}
                          {(pb.sale > 0 || product.consumerPrice > 0) && <div><dt className="text-[11px] font-semibold text-slate-500">1개당 마진</dt><dd className="font-black text-emerald-700">{formatKRW(pb.sale > 0 ? pb.sellerMargin : product.consumerPrice - product.supplyPrice)}{pb.sale > 0 && <span className="ml-1 text-xs font-bold">({pb.sellerMarginRate}%)</span>}</dd></div>}
                          {product.minSalePrice != null && <div className="col-span-2 text-[11px] font-semibold text-rose-700">최저 판매가 {formatKRW(product.minSalePrice)} 아래로는 팔 수 없어요</div>}
                        </dl>
                      ) : (
                        <div className="space-y-1">
                          {pb.sale > 0 ? <p className="flex flex-wrap items-baseline gap-x-1.5"><span className="text-[11px] font-semibold text-slate-500">판매가</span>{pb.discountRate > 0 && <b className="text-rose-600">{pb.discountRate}%</b>}<span className="text-lg font-black text-navy">{formatKRW(pb.sale)}</span>{pb.list > 0 && <s className="text-xs text-slate-400">{formatKRW(pb.list)}</s>}</p>
                            : product.consumerPrice > 0 && <p><span className="text-[11px] font-semibold text-slate-500">권장 소비자가 </span><span className="text-lg font-black text-navy">{formatKRW(product.consumerPrice)}</span></p>}
                          <p className="text-xs font-semibold text-slate-600">{SUPPLY_PRICE_HIDDEN_NOTE}</p>
                        </div>
                      )}
                    </div>
                    <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-100 text-[13px]">
                      {([
                        ["배송", delivery],
                        ["출고", `주문 후 ${product.leadDays}일 안에 출고${product.shippingFee ? ` · 배송비 ${formatKRW(product.shippingFee)}` : " · 무료 배송"}`],
                        showSupply ? ["재고", `${product.stock.toLocaleString("ko-KR")}개`] : null,
                        ["샘플", product.samplePrice === null ? "샘플 미제공" : `${product.samplePrice === 0 ? "무료" : formatKRW(product.samplePrice)} · 남은 ${product.sampleStock.toLocaleString("ko-KR")}개${product.sampleLimitPerBuyer > 0 ? ` · 계정당 ${product.sampleLimitPerBuyer}회` : ""}`],
                        ...groups.map((g) => [g.name, g.values.join(", ")]),
                      ].filter(Boolean) as string[][]).map(([k, v]) => (
                        <div key={k} className="flex gap-3 px-3 py-2"><dt className="w-14 shrink-0 font-semibold text-slate-500">{k}</dt><dd className="min-w-0 break-words font-medium text-slate-700">{v}</dd></div>
                      ))}
                    </dl>
                    {showSupply && variants.length > 0 && (
                      <details className="rounded-2xl border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs text-violet-900" open={variants.length <= 6}>
                        <summary className="cursor-pointer py-1 font-bold">옵션별 가격 · 품절 ({variants.length})</summary>
                        <ul className="mt-1 divide-y divide-violet-100">
                          {variants.map((v) => (
                            <li key={v.key} className={cn("flex flex-wrap justify-between gap-x-2 py-1.5", v.soldOut && "text-slate-400 line-through")}>
                              <span className="font-semibold">{v.key}</span>
                              <span>{v.soldOut ? "품절" : `공급 ${formatKRW(product.supplyPrice + v.extra)}${pb.sale > 0 ? ` · 판매 ${formatKRW(pb.sale + v.saleExtra)}` : ""}`}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {published && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 [&>*]:min-h-10">
                        {buyer && !blocked && <BrandFavoriteButton productId={product.id} initial={favorites.has(product.id)} className="rounded-xl px-3 text-xs" />}
                        {!user && <Link href={login} className={buttonVariants({ variant: "outline", className: "rounded-xl px-3 text-xs" })}><Heart aria-hidden="true" className="h-3.5 w-3.5" />찜하기</Link>}
                        {buyer && !blocked && user && canImport && !(onList && user.role === "SELLER") && <BrandImportButton target={user.role === "SELLER" ? "SELLER" : "FACILITY"} facilities={facilities}
                          product={{ id: product.id, name: product.name, supplyPrice: product.supplyPrice, consumerPrice: product.consumerPrice, stock: product.stock, allowDropship: product.allowDropship, allowWarehouse: product.allowWarehouse, salePrice: product.salePrice, priceRule: product.priceRule, minSalePrice: product.minSalePrice }} />}
                        {product.samplePrice !== null && (!user
                          ? <Link href={login} className={buttonVariants({ variant: "outline", className: "rounded-xl border-brand-200 bg-brand-50 px-3 text-xs font-bold" })}>{product.samplePrice === 0 ? "무료 샘플 신청" : "샘플 구매"}</Link>
                          : buyer && !blocked ? (left > 0
                            ? <BrandOrderButton productId={product.id} name={product.name} kind="SAMPLE" unitPrice={product.samplePrice} stock={product.sampleStock} maxQuantity={policy.sampleMaxPerOrder}
                                limitNote={Number.isFinite(left) ? `이 상품 샘플은 ${left}회 더 신청할 수 있습니다.` : undefined} />
                            : <span className="inline-flex items-center text-[11px] font-semibold text-slate-500">샘플 신청 한도 사용</span>) : null)}
                        {user?.role === "SELLER" && onList && product.allowDropship && <Link href={`/seller/bookings/new?brand=${product.id}`} className={buttonVariants({ size: "sm", className: "rounded-xl px-3 text-xs" })}><CalendarPlus className="h-4 w-4" aria-hidden />이 상품으로 방송 예약</Link>}
                        {buyer && !blocked && user && <Link href={`${buyerHome(user.role)}/brand-messages?shop=${shop.id}`} className={buttonVariants({ variant: "ghost", className: "rounded-xl px-3 text-xs" })}><MessageCircle className="h-4 w-4" aria-hidden />브랜드 문의</Link>}
                        {user && !buyer && <p className="basis-full text-[11px] text-slate-500">찜 · 샘플 신청 · 판매 상품 가져오기는 셀러와 스토리지마켓 계정에서 이용할 수 있습니다.</p>}
                      </div>
                    )}
                    {notices}
                  </div>
                </div>
                {product.description && (
                  <section className="border-t border-slate-100 p-4 sm:p-6">
                    <h2 className="mb-2 text-sm font-black text-navy">상품 설명</h2>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{product.description}</p>
                  </section>
                )}
                {notice.length > 0 && (
                  <section className="border-t border-slate-100 p-4 sm:p-6">
                    <h2 className="mb-2 text-sm font-black text-navy">상품 정보 고시</h2>
                    <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 text-xs">
                      {notice.map(([k, v]) => <div key={k} className="flex"><dt className="w-24 shrink-0 bg-slate-50 px-3 py-2 font-semibold text-slate-500 sm:w-32">{k}</dt><dd className="min-w-0 whitespace-pre-wrap break-words px-3 py-2 text-slate-700">{v}</dd></div>)}
                    </dl>
                  </section>
                )}
              </article>
            );
          })() : (
            <ProductGrid view={view} narrow className={frame === "inline" ? "xl:grid-cols-4" : undefined}>
              {products.map((product) => {
                const artwork = generatedBrandProductArtwork(shop.name, product);
                const pb = priceBreakdown(product);
                const sample = product.samplePrice !== null && product.sampleStock > 0;
                return (
                  <ProductCard key={product.id} view={view} href={brandProductHref(shop.id, product.id, base)}
                    image={product.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(product.category)} title={product.name}
                    subtitle={product.category}
                    status={imported.has(product.id) ? { label: user?.role === "SELLER" ? "내 방송 상품" : "판매 중", tone: "green" } : undefined}
                    cover={product.stock <= 0 ? "품절" : undefined}
                    price={showSupply
                      ? <PriceLine label="공급" value={formatKRW(product.supplyPrice)} note={pb.sale > 0 ? `판매가 ${formatKRW(pb.sale)} · 마진 ${formatKRW(pb.sellerMargin)}` : product.consumerPrice > 0 ? `소비자가 ${formatKRW(product.consumerPrice)}` : undefined} />
                      : <PriceLine value={pb.sale > 0 ? formatKRW(pb.sale) : product.consumerPrice > 0 ? formatKRW(product.consumerPrice) : "가격 문의"} rate={pb.discountRate} strike={pb.discountRate ? formatKRW(pb.list) : undefined} note={!user ? "공급가는 로그인하면 볼 수 있습니다" : undefined} />}
                    chips={[sample && { label: product.samplePrice === 0 ? "무료 샘플" : "유료 샘플", tone: "brand" }, product.allowWarehouse && { label: "창고 입고", tone: "violet" }]}
                    actions={buyer && !blocked && published ? <BrandFavoriteButton productId={product.id} initial={favorites.has(product.id)} className="h-9 w-full justify-center rounded-xl text-xs" /> : undefined} />
                );
              })}
            </ProductGrid>
          )}
          {!detail && <Pagination base={path} params={searchParams} page={page} size={size} total={total} />}
        </section>
        <section id="shop-contact" className="mt-7 scroll-mt-4 rounded-[24px] border border-slate-100 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-black text-navy">문의 · 교환/반품</h2>
          <dl className="mt-3 grid gap-2.5 text-sm">
            <div className="flex min-w-0 items-start gap-3"><dt className="flex w-20 shrink-0 items-center gap-1.5 text-xs text-slate-400"><Phone aria-hidden="true" className="h-3.5 w-3.5" />고객 문의</dt>
              <dd className="min-w-0 font-semibold text-slate-700">{shop.csPhone ? <a href={`tel:${shop.csPhone}`} className="hover:underline">{shop.csPhone}</a> : <span className="font-normal text-slate-400">등록된 번호가 없습니다</span>}</dd></div>
            <div className="flex min-w-0 items-start gap-3"><dt className="flex w-20 shrink-0 items-center gap-1.5 text-xs text-slate-400"><MapPin aria-hidden="true" className="h-3.5 w-3.5" />반품지</dt>
              <dd className="min-w-0 break-words font-semibold text-slate-700">{shop.returnAddress || <span className="font-normal text-slate-400">등록된 주소가 없습니다</span>}</dd></div>
          </dl>
          {buyer && !blocked && published && <Link href={`${user ? buyerHome(user.role) : ""}/brand-messages?shop=${shop.id}`} className={`${buttonVariants({ size: "sm", variant: "outline" })} mt-4`}><MessageCircle className="h-4 w-4" />브랜드에 문의하기</Link>}
          {!user && <Link href={login} className={`${buttonVariants({ size: "sm", variant: "outline" })} mt-4`}>로그인하고 브랜드에 문의하기</Link>}
        </section>
      </main>
    </ShopShell>
  );
}
