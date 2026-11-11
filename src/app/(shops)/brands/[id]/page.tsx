import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, ClipboardList, Headset, House, LayoutTemplate, LogIn, MessageSquare, Package, ShoppingBag } from "lucide-react";
import { PartnerApply } from "@/components/brand/partner-apply";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BRAND_BUYER_ROLES, BRAND_CATEGORIES, brandArtworkFor, brandProductHref, parseOptions } from "@/lib/brands";
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

export const dynamic = "force-dynamic";

export default async function BrandStorefront({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const [shop, user] = await Promise.all([
    prisma.brandShop.findUnique({
      where: { id: params.id },
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

  const buyer = !!user && BRAND_BUYER_ROLES.includes(user.role)
    && (user.role !== "FACILITY_ADMIN" || !(await getSettings()).facilityDisabled);
  const category = BRAND_CATEGORIES.find((value) => value === sp(searchParams, "category"));
  const selectedProduct = sp(searchParams, "product")?.slice(0, 64);
  const { page, size, skip, take } = pageOf(searchParams, 12);
  const where = {
    shopId: shop.id, isActive: true,
    ...(selectedProduct ? { id: selectedProduct } : category ? { category: { in: categoryFilterValues(category) } } : {}),
  };
  const [products, total, policy, facilities] = await Promise.all([
    prisma.brandProduct.findMany({ where, skip: selectedProduct ? 0 : skip, take: selectedProduct ? 1 : take, orderBy: { createdAt: "desc" } }),
    prisma.brandProduct.count({ where }),
    getPolicy(),
    buyer && user?.role === "FACILITY_ADMIN"
      ? prisma.facility.findMany({ where: { ownerId: user.id, status: { not: "SUSPENDED" } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } })
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
    : await prisma.facilityProduct.findMany({ where: { facility: { ownerId: user.id }, brandProductId: { in: products.map((p) => p.id) } }, select: { brandProductId: true } })
  ).map((x) => x.brandProductId!)) : new Set<string>();
  // 판매처 관계: 차단되면 신청·가져오기 불가, 승인제 브랜드는 승인 후 가져오기
  const partner = buyer && user ? await prisma.brandPartner.findUnique({ where: { shopId_userId: { shopId: shop.id, userId: user.id } }, select: { status: true } }) : null;
  const blocked = partner?.status === "BLOCKED";
  const canImport = !blocked && (!shop.requireSellerApproval || partner?.status === "APPROVED");
  const path = `/brands/${shop.id}`;
  const login = `/login?callbackUrl=${encodeURIComponent(selectedProduct ? brandProductHref(shop.id, selectedProduct) : path)}`;
  const shopAvatar = defaultProfileImage(`brand:${shop.id}`);
  const management = user?.role === "SUPER_ADMIN" ? `/admin/brands/${shop.id}` : isMine ? "/brand/shop" : null;
  const links = [
    { href: "#shop-home", label: "샵 홈", icon: House },
    { href: "#shop-products", label: "상품", icon: Boxes },
    ...(buyer ? [{ href: "/brand-requests", label: "내 신청", icon: ClipboardList }] : []),
    ...(buyer && !blocked ? [{ href: `/brand-messages?shop=${shop.id}`, label: "브랜드 문의", icon: MessageSquare }] : []),
    ...(management ? [{ href: management, label: "샵 관리", icon: LayoutTemplate }] : []),
    ...(!user ? [{ href: login, label: "로그인", icon: LogIn }] : []),
    { href: "/brands", label: "브랜드샵", icon: ShoppingBag },
    { href: "/support", label: "문의", icon: Headset },
  ];

  return (
    <ShopShell background={shop.backgroundUrl} fallback={BRAND_ARTWORK[4].url} links={links}>
      <header id="shop-home" className="flex min-h-16 items-center justify-between gap-4 border-b bg-white px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <ShopImage src={shop.logoUrl} fallback={shopAvatar} className="h-9 w-9 shrink-0 rounded-full border bg-white object-cover" />
          <span className="truncate text-sm font-black text-navy">{shop.name}</span>
        </div>
        <Link href="/brands" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-slate-600 hover:text-navy"><ArrowLeft className="h-4 w-4" /> 브랜드 목록</Link>
      </header>
      <main className="px-3 py-4 sm:px-6 sm:py-6">
        <div className="relative aspect-[16/8] overflow-hidden rounded-[26px] bg-navy sm:aspect-[16/7]">
          <ShopImage src={shop.bannerUrl} fallback={BRAND_ARTWORK[0].url} eager className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/45 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-5 pb-5 text-white sm:px-9">
            <p className="mb-2 text-xs font-bold text-brand-200">스토리지마켓 브랜드샵</p>
            <h1 className="line-clamp-2 break-words text-2xl font-black sm:text-4xl">{shop.name}</h1>
            {shop.tagline && <p className="mt-2 line-clamp-2 max-w-sm text-sm">{shop.tagline}</p>}
          </div>
        </div>
        <section className="relative mx-3 -mt-7 rounded-[24px] border border-white bg-white p-4 shadow-[0_10px_30px_#1A1A2E15] sm:mx-6 sm:-mt-10 sm:p-6">
          <div className="flex items-center gap-3">
            <ShopImage src={shop.logoUrl} fallback={shopAvatar} className="h-14 w-14 rounded-full border bg-white object-cover" />
            <div><h2 className="font-black text-navy">{shop.name}</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">{published ? "스토리지마켓 파트너 브랜드" : "비공개 미리보기"}</p></div>
          </div>
          {shop.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{shop.description}</p>}
          {!user && <Link href={login} className={`${buttonVariants({ size: "sm" })} mt-4`}>로그인하고 신청하기</Link>}
          {shop.categories.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{shop.categories.map((c) => <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold">{c}</span>)}</div>}
          {(shop.csPhone || shop.returnAddress) && <p className="mt-2 text-xs text-slate-600">{shop.csPhone && <>문의 {shop.csPhone}</>}{shop.csPhone && shop.returnAddress && " · "}{shop.returnAddress && <>반품지 {shop.returnAddress}</>}</p>}
          {buyer && published && blocked && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">이 브랜드와의 거래가 중지된 계정입니다. 샘플 신청과 상품 가져오기를 할 수 없습니다.</p>}
          {buyer && published && !blocked && !canImport && <PartnerApply shopId={shop.id} status={partner?.status === "PENDING" ? "PENDING" : "NONE"} />}
          {user && !buyer && published && <p className="mt-3 text-xs text-slate-600">샘플 신청과 판매 상품 가져오기는 셀러와 창고(스튜디오) 관리자 계정으로 이용할 수 있습니다.</p>}
        </section>

        <section id="shop-products" className="mt-7 scroll-mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-black text-navy">브랜드 상품</h2>
            {selectedProduct ? (
              <Link href={`${path}#shop-products`} className={buttonVariants({ size: "sm", variant: "outline" })}>전체 상품 보기</Link>
            ) : (
              <form action={path} className="flex items-center gap-2">
                <Select name="category" aria-label="상품 카테고리" defaultValue={category ?? ""} className="w-auto">
                  <option value="">전체 카테고리</option>
                  {BRAND_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
                </Select>
                <Button size="sm" variant="outline">조회</Button>
              </form>
            )}
          </div>
          {products.length === 0 && <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">{selectedProduct ? "선택한 상품을 현재 볼 수 없습니다." : "공개된 상품이 없습니다."}</p>}
          <div className={cn("grid grid-cols-1 gap-3", !selectedProduct && "min-[390px]:grid-cols-2")}>
            {products.map((product) => {
              const artwork = generatedBrandProductArtwork(shop.name, product);
              const uploadedImages = [...new Set([product.imageUrl, ...product.images].filter(Boolean))];
              const generatedDetail = selectedProduct && uploadedImages.length === 0 ? artwork?.detail : undefined;
              const imageSrc = selectedProduct ? uploadedImages[0] ?? generatedDetail : product.imageUrl;
              const fallback = artwork?.cover ?? brandArtworkFor(product.category);
              const image = (
                <ShopImage src={imageSrc} fallback={fallback} alt={product.name} eager={!!selectedProduct}
                  className={cn("w-full", selectedProduct ? "aspect-[4/3] object-contain" : "aspect-square object-cover")} />
              );

              return (
                <article key={product.id} className={cn(
                  "grid min-w-0 overflow-hidden rounded-2xl border bg-white",
                  selectedProduct ? "items-start sm:grid-cols-2" : "grid-rows-[auto_1fr]",
                )}>
                  <div>
                    <div className="relative bg-[#F4F0E9]">
                      {selectedProduct ? image : (
                        <Link href={brandProductHref(shop.id, product.id)} className="block focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-700">{image}</Link>
                      )}
                      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-white px-2 py-1 text-[11px] font-bold">{product.category}</span>
                    </div>
                    {generatedDetail && <p className="px-3 py-2 text-[11px] text-slate-600">AI로 생성한 상품 예시 이미지</p>}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                    <h3 className="break-words font-extrabold text-navy">{product.name}</h3>
                    {product.description && <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{product.description}</p>}
                    {product.subCategory && <p className="text-[11px] font-semibold text-slate-500">{product.category} › {product.subCategory}</p>}
                    {parseOptions(product.options).map((g) => <p key={g.name} className="text-[11px] text-slate-600">{g.name}: {g.values.join(", ")}</p>)}
                    <p className="mt-auto text-sm font-black">공급 {formatKRW(product.supplyPrice)}<span className="ml-1 text-xs font-medium text-slate-600">· {product.stock}개</span></p>
                    {product.consumerPrice > 0 && <p className="text-xs text-slate-600">권장 소비자가 {formatKRW(product.consumerPrice)} · 차액 {formatKRW(product.consumerPrice - product.supplyPrice)}</p>}
                    <p className="text-[11px] text-slate-600">{[product.allowDropship && "직배송", product.allowWarehouse && "창고 입고"].filter(Boolean).join(" · ")} · 출고 {product.leadDays}일</p>
                    {product.samplePrice !== null && <p className="text-xs font-semibold text-slate-600"><Package className="mr-1 inline h-3.5 w-3.5" />샘플 {product.samplePrice === 0 ? "무료" : formatKRW(product.samplePrice)} · {product.sampleStock}개{product.sampleLimitPerBuyer > 0 && ` · 계정당 ${product.sampleLimitPerBuyer}회`}</p>}
                    {product.minSalePrice != null && <p className="text-[11px] font-semibold text-rose-700">최저 판매가 {formatKRW(product.minSalePrice)}</p>}
                    {buyer && published && !blocked && <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {imported.has(product.id) ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">판매 목록에 있음</span> : null}
                      {user && canImport && <BrandImportButton target={user.role === "SELLER" ? "SELLER" : "FACILITY"} facilities={facilities}
                        product={{ id: product.id, name: product.name, supplyPrice: product.supplyPrice, consumerPrice: product.consumerPrice, stock: product.stock, allowDropship: product.allowDropship, allowWarehouse: product.allowWarehouse }} />}
                      {product.samplePrice !== null && (() => {
                        const left = product.sampleLimitPerBuyer > 0 ? product.sampleLimitPerBuyer - (used.get(product.id) ?? 0) : Infinity;
                        return left > 0
                          ? <BrandOrderButton productId={product.id} name={product.name} kind="SAMPLE" unitPrice={product.samplePrice} stock={product.sampleStock} maxQuantity={policy.sampleMaxPerOrder}
                              limitNote={Number.isFinite(left) ? `이 상품 샘플은 ${left}회 더 신청할 수 있습니다.` : undefined} />
                          : <span className="text-[11px] font-semibold text-slate-500">샘플 신청 한도 사용</span>;
                      })()}
                    </div>}
                  </div>
                  {!!selectedProduct && uploadedImages.length > 1 && (
                    <div className="grid gap-3 border-t p-3 sm:col-span-2 sm:grid-cols-2 sm:p-4">
                      {uploadedImages.slice(1).map((url, index) => (
                        <ShopImage key={url} src={url} fallback={imageSrc ?? fallback} alt={`${product.name} 추가 이미지 ${index + 1}`}
                          className="aspect-[4/3] w-full rounded-xl bg-[#F4F0E9] object-contain" />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!selectedProduct && <Pagination base={path} params={searchParams} page={page} size={size} total={total} />}
        </section>
      </main>
    </ShopShell>
  );
}
