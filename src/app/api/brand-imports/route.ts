import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { FULFILLMENT_LABEL } from "@/lib/brands";
import { brandRecipients, partnerAccess } from "@/lib/brand-access";

const id = z.string().min(1).max(64);
const price = z.number().int().min(0).max(100_000_000);

const schema = z.discriminatedUnion("action", [
  // 브랜드 상품을 내 판매 상품으로 가져오기
  z.object({
    action: z.literal("import"), brandProductId: id,
    target: z.enum(["FACILITY", "SELLER"]), facilityId: id.optional(),
    fulfillment: z.enum(["DROPSHIP", "WAREHOUSE"]),
    salePrice: price, consumerPrice: price.optional(),
    commissionType: z.enum(["PERCENT", "FIXED"]).default("PERCENT"), commissionValue: z.number().min(0).max(100_000_000).default(10),
    stock: z.number().int().min(0).max(1_000_000).optional(), // 직배송 판매 한도(비우면 브랜드 재고)
  }),
  z.object({ action: z.literal("seller-update"), listingId: id, salePrice: price, isActive: z.boolean() }),
  z.object({ action: z.literal("seller-remove"), listingId: id }),
  // 판매처 신청 (승인제 브랜드)
  z.object({ action: z.literal("apply"), shopId: id, note: z.string().trim().max(300).default("") }),
]);

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!["SELLER", "FACILITY_ADMIN", "SUPER_ADMIN"].includes(user.role)) return fail("셀러 또는 창고(스튜디오) 관리자 계정이 필요합니다.", 403);
    if (user.role === "FACILITY_ADMIN" && (await getSettings()).facilityDisabled) return fail("현재 창고(스튜디오) 기능을 사용할 수 없습니다.", 403);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    const cmd = parsed.data;

    if (cmd.action === "apply") {
      if (user.role === "SUPER_ADMIN") return fail("판매처 신청은 셀러·창고(스튜디오) 계정으로 해 주세요.", 403);
      const shop = await prisma.brandShop.findFirst({ where: { id: cmd.shopId, status: "APPROVED" }, select: { id: true, name: true } });
      if (!shop) return fail("브랜드샵을 찾지 못했습니다.", 404);
      const existing = await prisma.brandPartner.findUnique({ where: { shopId_userId: { shopId: shop.id, userId: user.id } } });
      if (existing?.status === "BLOCKED") return fail("이 브랜드와의 거래가 중지된 계정입니다.", 403);
      if (existing?.status === "APPROVED") return ok({ status: "APPROVED" });
      await prisma.brandPartner.upsert({
        where: { shopId_userId: { shopId: shop.id, userId: user.id } },
        update: { status: "PENDING", note: cmd.note }, create: { shopId: shop.id, userId: user.id, status: "PENDING", note: cmd.note },
      });
      await notify({ userId: await brandRecipients(shop.id), type: "SYSTEM", title: "새 판매처 신청", body: cmd.note || "판매처 관리에서 승인해 주세요.", link: "/brand/channels?tab=partners" });
      return ok({ status: "PENDING" }, 201);
    }

    if (cmd.action === "seller-update" || cmd.action === "seller-remove") {
      const listing = await prisma.sellerBrandProduct.findUnique({ where: { id: cmd.listingId }, include: { brandProduct: { select: { supplyPrice: true, minSalePrice: true, shopId: true, isActive: true, allowDropship: true, shop: { select: { status: true } } } } } });
      if (!listing || (listing.sellerId !== user.id && user.role !== "SUPER_ADMIN")) return fail("판매 상품을 찾지 못했습니다.", 404);
      if (cmd.action === "seller-remove") {
        await prisma.sellerBrandProduct.delete({ where: { id: listing.id } });
        await audit({ actorId: user.id, action: "SELLER_BRAND_REMOVE", entity: "SellerBrandProduct", entityId: listing.id });
        return ok({ id: listing.id });
      }
      const floor = Math.max(listing.brandProduct.supplyPrice, listing.brandProduct.minSalePrice ?? 0);
      if (cmd.salePrice < floor) return fail(`판매가는 ${listing.brandProduct.minSalePrice ? "브랜드 최저 판매가" : "공급가"}(${floor.toLocaleString()}원)보다 낮을 수 없습니다.`);
      if (cmd.isActive) {
        const bp = listing.brandProduct;
        if (!bp.isActive || !bp.allowDropship || bp.shop.status !== "APPROVED") return fail("브랜드가 판매를 중단한 상품이라 다시 켤 수 없습니다.");
        const access = await partnerAccess(bp.shopId, user.id, false);
        if (!access.ok) return fail(access.message, 403);
      }
      await prisma.sellerBrandProduct.update({ where: { id: listing.id }, data: { salePrice: cmd.salePrice, isActive: cmd.isActive } });
      return ok({ id: listing.id });
    }

    const bp = await prisma.brandProduct.findFirst({
      where: { id: cmd.brandProductId, isActive: true, shop: { status: "APPROVED", owner: { isActive: true, role: "BRAND_ADMIN" } } },
      include: { shop: { select: { ownerId: true, name: true, requireSellerApproval: true } } },
    });
    if (!bp) return fail("가져올 수 있는 브랜드 상품을 찾지 못했습니다.", 404);
    if (user.role !== "SUPER_ADMIN") {
      const access = await partnerAccess(bp.shopId, user.id, bp.shop.requireSellerApproval);
      if (!access.ok) return fail(access.message, 403);
    }
    if (cmd.fulfillment === "DROPSHIP" && !bp.allowDropship) return fail("이 상품은 브랜드 직배송을 지원하지 않습니다.");
    if (cmd.fulfillment === "WAREHOUSE" && !bp.allowWarehouse) return fail("이 상품은 창고 입고(위탁)를 지원하지 않습니다.");
    if (cmd.salePrice < bp.supplyPrice) return fail(`판매가는 공급가(${bp.supplyPrice.toLocaleString()}원)보다 낮을 수 없습니다.`);
    if (bp.minSalePrice != null && cmd.salePrice < bp.minSalePrice) return fail(`판매가는 브랜드 최저 판매가(${bp.minSalePrice.toLocaleString()}원)보다 낮을 수 없습니다.`);

    if (cmd.target === "SELLER") {
      if (user.role !== "SELLER") return fail("셀러 계정만 내 판매 상품으로 가져올 수 있습니다.", 403);
      if (cmd.fulfillment !== "DROPSHIP") return fail("셀러는 브랜드 직배송 방식으로만 가져올 수 있습니다. 창고 입고는 창고(스튜디오)가 진행합니다.");
      const listing = await prisma.sellerBrandProduct.upsert({
        where: { sellerId_brandProductId: { sellerId: user.id, brandProductId: bp.id } },
        update: { salePrice: cmd.salePrice, isActive: true },
        create: { sellerId: user.id, brandProductId: bp.id, salePrice: cmd.salePrice },
      });
      await audit({ actorId: user.id, action: "SELLER_BRAND_IMPORT", entity: "SellerBrandProduct", entityId: listing.id });
      await notify({ userId: await brandRecipients(bp.shopId), type: "SYSTEM", title: "셀러가 상품을 판매 목록에 담았습니다", body: `${bp.name} · 직배송`, link: "/brand/channels" });
      return ok({ id: listing.id, kind: "SELLER" }, 201);
    }

    // 창고(스튜디오) 판매 상품으로 가져오기
    if (user.role !== "FACILITY_ADMIN" && user.role !== "SUPER_ADMIN") return fail("창고(스튜디오) 관리자 계정이 필요합니다.", 403);
    if (!cmd.facilityId) return fail("상품을 등록할 창고(스튜디오)를 선택하세요.");
    const facility = await prisma.facility.findFirst({
      where: { id: cmd.facilityId, ...(user.role !== "SUPER_ADMIN" && { ownerId: user.id }) }, select: { id: true, name: true },
    });
    if (!facility) return fail("상품을 등록할 수 있는 창고(스튜디오)를 찾지 못했습니다.", 403);
    const dup = await prisma.facilityProduct.findFirst({ where: { facilityId: facility.id, brandProductId: bp.id, fulfillment: cmd.fulfillment }, select: { id: true } });
    if (dup) return fail("이미 같은 방식으로 가져온 상품입니다. 상품 관리에서 수정하세요.", 409);
    const dropship = cmd.fulfillment === "DROPSHIP";
    const stock = dropship ? Math.min(cmd.stock ?? bp.stock, bp.stock) : 0;
    const product = await prisma.product.create({
      data: {
        name: bp.name, sku: bp.sku || null, category: bp.category, description: bp.description || null, thumbnailUrl: bp.imageUrl || null,
        images: bp.images.length ? { create: bp.images.map((url, i) => ({ url, sortOrder: i })) } : undefined,
        facilityProducts: {
          create: {
            facilityId: facility.id, salePrice: cmd.salePrice, consumerPrice: cmd.consumerPrice ?? (bp.consumerPrice || cmd.salePrice), stock,
            shippingInfo: dropship ? `브랜드 직배송 (${bp.shop.name}) · 발주 후 ${bp.leadDays}일 내 출고` : `창고 출고 (${facility.name})`,
            commissionType: cmd.commissionType, commissionValue: cmd.commissionValue,
            isSellable: dropship, source: "CATALOG", brandProductId: bp.id, fulfillment: cmd.fulfillment,
          },
        },
      },
      include: { facilityProducts: { select: { id: true } } },
    });
    const fpId = product.facilityProducts[0].id;
    await audit({ actorId: user.id, action: "FACILITY_BRAND_IMPORT", entity: "FacilityProduct", entityId: fpId, meta: { brandProductId: bp.id, fulfillment: cmd.fulfillment } });
    await notify({ userId: await brandRecipients(bp.shopId), type: "SYSTEM", title: "창고(스튜디오)가 상품을 판매 목록에 담았습니다", body: `${bp.name} · ${facility.name} · ${FULFILLMENT_LABEL[cmd.fulfillment]}`, link: "/brand/channels" });
    return ok({ id: fpId, kind: "FACILITY", needsStock: !dropship }, 201);
  } catch (e) { return handleError(e); }
}
