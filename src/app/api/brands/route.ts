import { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { BRAND_BUYER_ROLES, BRAND_REQUEST_KIND, BRAND_REQUEST_STATUS, BRAND_SHOP_STATUS, brandRequestActions, formatOptions, parseOptions } from "@/lib/brands";
import { isCategory, normalizeCategory } from "@/lib/categories";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { notify, notifyAdmins } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { isShopImageUrl } from "@/lib/shop-artwork";
import { getPolicy } from "@/lib/policy";
import { getPaymentAdapter, paymentBlockedReason } from "@/lib/adapters/payment";
import bcrypt from "bcryptjs";
import { brandRecipients, brandShopWhere, partnerAccess } from "@/lib/brand-access";
import { capDropshipLiveStockInTx, checkLowStock } from "@/lib/purchase-orders";
import { emailVerifyBlock } from "@/lib/account-guards";

const mask = (v: string) => (v.length <= 4 ? "****" : `${"*".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`);

// 브랜드 상품을 팔고 있는 판매처(셀러 · 창고 관리자) 계정
async function partnerUserIds(where: Prisma.BrandProductWhereInput) {
  const [sellers, facilities] = await Promise.all([
    prisma.sellerBrandProduct.findMany({ where: { brandProduct: where, isActive: true }, select: { sellerId: true } }),
    prisma.facilityProduct.findMany({ where: { brandProduct: where }, select: { facility: { select: { ownerId: true } } } }),
  ]);
  return Array.from(new Set([...sellers.map((s) => s.sellerId), ...facilities.map((f) => f.facility.ownerId)]));
}

// 브랜드 상품 판매를 멈춘다: 셀러 판매 목록 · 창고 판매 상품 · 진행 중 방송의 상품
async function stopBrandSales(tx: Prisma.TransactionClient, where: Prisma.BrandProductWhereInput, opts: { warehouse: boolean }) {
  await tx.sellerBrandProduct.updateMany({ where: { brandProduct: where }, data: { isActive: false } });
  await tx.facilityProduct.updateMany({ where: { brandProduct: where, ...(opts.warehouse ? {} : { fulfillment: "DROPSHIP" }) }, data: { isSellable: false } });
  const live = await tx.liveSessionProduct.findMany({
    where: { brandProduct: where, isActive: true, ...(opts.warehouse ? {} : { fulfillment: "DROPSHIP" }), liveSession: { status: { in: ["DRAFT", "READY", "LIVE"] } } },
    select: { id: true, liveSessionId: true },
  });
  if (live.length) {
    await tx.liveSessionProduct.updateMany({ where: { id: { in: live.map((l) => l.id) } }, data: { isActive: false } });
    await tx.liveSession.updateMany({ where: { id: { in: Array.from(new Set(live.map((l) => l.liveSessionId))) } }, data: { numberVersion: { increment: 1 } } });
  }
  return live.length;
}

const id = z.string().min(1).max(64);
const line = (max: number) => z.string().trim().max(max);
const image = line(500).refine((value) => !value || isShopImageUrl(value), "이미지는 HTTPS 주소를 사용해 주세요.");
const stock = z.number().int().min(0).max(1_000_000);
const price = z.number().int().min(0).max(100_000_000);
const category = z.string().trim().max(30).refine((v) => !!normalizeCategory(v), "카테고리를 선택해 주세요.").transform((v) => normalizeCategory(v)!);

const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("shop"), shopId: id.optional(), name: line(60).min(2), tagline: line(100),
    description: line(1500), logoUrl: image, bannerUrl: image, backgroundUrl: image, paymentInstructions: line(600).default(""),
    categories: z.array(z.string()).max(17).optional().transform((v) => v === undefined ? undefined : Array.from(new Set(v.filter(isCategory)))),
    businessNumber: line(20).regex(/^[0-9-]*$/, "사업자등록번호는 숫자와 - 만 입력하세요.").optional(),
    ceoName: line(40).optional(), csPhone: line(30).optional(), returnAddress: line(300).optional(),
    bankName: line(30).optional(), bankAccount: line(40).regex(/^[0-9-]*$/, "계좌번호는 숫자와 - 만 입력하세요.").optional(), accountHolder: line(40).optional(),
    currentPassword: z.string().max(100).optional(), // 정산 계좌·사업자번호를 바꿀 때 본인 확인
    requireSellerApproval: z.boolean().optional(), lowStockThreshold: z.number().int().min(0).max(100000).optional(),
  }),
  z.object({
    action: z.literal("moderate"), shopId: id, status: z.enum(["PENDING", "APPROVED", "SUSPENDED"]), moderationNote: line(500),
    feeRate: z.number().min(0).max(100).nullable().optional(),
  }),
  z.object({
    action: z.literal("product"), shopId: id, productId: id.optional(), revision: z.string().datetime().optional(),
    name: line(100).min(2), category, description: line(2000), imageUrl: image,
    supplyPrice: price, stock, samplePrice: price.nullable(), sampleStock: stock, isActive: z.boolean(),
    subCategory: line(30).default(""), sku: line(60).default(""), consumerPrice: price.default(0),
    images: z.array(image).max(8).default([]).transform((v) => v.filter(Boolean)),
    options: line(500).default("").transform((v) => formatOptions(parseOptions(v))),
    allowDropship: z.boolean().default(true), allowWarehouse: z.boolean().default(true),
    shippingFee: price.default(0), leadDays: z.number().int().min(0).max(60).default(2),
    sampleLimitPerBuyer: z.number().int().min(0).max(100).default(1),
    minSalePrice: price.nullable().optional(), // 최저 판매가 (판매처가 이보다 싸게 팔 수 없음)
  }),
  z.object({
    action: z.literal("request"), productId: id, requestKey: z.string().regex(/^[0-9a-f]{32}$/), kind: z.enum(["SUPPLY", "SAMPLE"]),
    quantity: z.number().int().min(1).max(10000), expectedUnitPrice: price,
    recipient: line(60).min(2),
    phone: line(30).regex(/^[+\d ()-]{8,30}$/, "연락처를 확인해 주세요.")
      .refine((value) => value.replace(/\D/g, "").length >= 8, "연락처를 확인해 주세요."),
    address: line(300).min(5), message: line(1000),
    facilityProductId: id.optional(), // 창고 입고 요청 대상 판매 상품
    method: z.enum(["CARD", "EASY_PAY", "BANK_TRANSFER"]).default("CARD"), // 유료 샘플 결제수단
  }),
  z.object({
    action: z.literal("transition"), requestId: id,
    status: z.enum(["APPROVED", "SHIPPED", "COMPLETED", "REJECTED", "CANCELLED", "REFUNDED"]),
    trackingNumber: line(100).optional(), carrier: line(30).optional(), reason: line(300).optional(),
  }),
]);

class BrandConflict extends Error {}

async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
      if (attempt >= 2) throw new BrandConflict("동시에 변경된 내용이 있습니다. 다시 시도해 주세요.");
    }
  }
}

export async function POST(req: Request) {
  try {
    if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return fail("JSON 요청이 필요합니다.", 415);
    const session = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: session.id }, select: { id: true, role: true, isActive: true },
    });
    if (!user?.isActive || user.role !== session.role) return fail("유효한 계정으로 다시 로그인해 주세요.", 403);
    const result = commandSchema.safeParse(await req.json().catch(() => null));
    if (!result.success) return fail(result.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    const command = result.data;
    const admin = user.role === "SUPER_ADMIN";
    const ownerScope: Prisma.BrandShopWhereInput = admin ? {} : brandShopWhere(user.id);

    if (command.action === "shop") {
      if (!admin && user.role !== "BRAND_ADMIN") return fail("브랜드사 계정이 필요합니다.", 403);
      const { action, shopId, currentPassword, ...raw } = command;
      // 보내지 않은 항목은 그대로 둔다 (예전 화면 호환)
      const data = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)) as unknown as typeof raw & { bankChangedAt?: Date };
      const shop = shopId
        ? await prisma.brandShop.findFirst({ where: { id: shopId, ...ownerScope } })
        : admin ? null : await prisma.brandShop.findFirst({ where: brandShopWhere(user.id) });
      if (!shop && (shopId || admin)) return fail("편집할 수 있는 브랜드샵을 찾지 못했습니다.", 404);
      // 정산 계좌 · 사업자번호 변경: 대표 계정만, 기존 값을 바꿀 때는 비밀번호 재확인 + 최고관리자 알림
      const SENSITIVE = ["bankName", "bankAccount", "accountHolder", "businessNumber"] as const;
      const changed = shop ? SENSITIVE.filter((k) => data[k] !== undefined && data[k] !== shop[k]) : [];
      if (shop && changed.length && !admin) {
        if (shop.ownerId !== user.id) return fail("정산 계좌와 사업자 정보는 대표 계정만 바꿀 수 있습니다.", 403);
        const replacing = changed.some((k) => (shop[k] ?? "") !== "");
        if (replacing) {
          const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
          if (!currentPassword || !row || !(await bcrypt.compare(currentPassword, row.passwordHash))) {
            return fail("정산 계좌·사업자 정보를 바꾸려면 현재 비밀번호를 정확히 입력해 주세요.", 403);
          }
        }
        if (changed.some((k) => k !== "businessNumber")) data.bankChangedAt = new Date();
      }
      if (shop && !admin && shop.ownerId !== user.id && (data.requireSellerApproval !== undefined || data.lowStockThreshold !== undefined)) {
        delete data.requireSellerApproval; delete data.lowStockThreshold;
      }
      const saved = shop
        ? await prisma.brandShop.update({ where: { id: shop.id }, data })
        : await prisma.brandShop.create({ data: { ...data, ownerId: user.id } });
      await audit({ actorId: user.id, action: "BRAND_SHOP_SAVE", entity: "BrandShop", entityId: saved.id, meta: changed.length ? { changed, bankAccount: shop?.bankAccount ? `${mask(shop.bankAccount)} → ${mask(saved.bankAccount)}` : undefined } : undefined });
      if (shop && changed.length && !admin) {
        await notifyAdmins({ type: "SYSTEM", title: `브랜드 정산 정보 변경 · ${saved.name}`, body: `${changed.join(", ")} 변경 — 지급 전에 확인해 주세요.`, link: `/admin/brands/${saved.id}` });
        await notify({ userId: shop.ownerId, type: "SYSTEM", title: "정산 정보가 변경되었습니다", body: "본인이 변경하지 않았다면 즉시 비밀번호를 바꾸고 고객센터에 알려 주세요.", link: "/brand/shop" });
      }
      if (!shop) await notifyAdmins({ type: "SYSTEM", title: "브랜드샵 공개 승인 요청", body: saved.name, link: `/admin/brands/${saved.id}` });
      return ok({ id: saved.id }, shop ? 200 : 201);
    }

    if (command.action === "moderate") {
      if (!admin) return fail("최고관리자 권한이 필요합니다.", 403);
      const shop = await prisma.brandShop.findUnique({ where: { id: command.shopId }, select: { ownerId: true, name: true, status: true, feeRate: true } });
      if (!shop) return fail("브랜드샵을 찾지 못했습니다.", 404);
      // 공개 중지(또는 승인 취소)되면 이 브랜드 상품의 판매를 모두 멈춘다 (진행 중 방송 포함)
      const stopping = shop.status === "APPROVED" && command.status !== "APPROVED";
      const partners = stopping ? await partnerUserIds({ shopId: command.shopId }) : [];
      const stopped = await prisma.$transaction(async (tx) => {
        await tx.brandShop.update({
          where: { id: command.shopId },
          data: { status: command.status, moderationNote: command.moderationNote, ...(command.feeRate !== undefined && { feeRate: command.feeRate }) },
        });
        return stopping ? stopBrandSales(tx, { shopId: command.shopId }, { warehouse: true }) : 0;
      });
      await audit({ actorId: user.id, action: "BRAND_SHOP_MODERATE", entity: "BrandShop", entityId: command.shopId, meta: { status: command.status, feeRate: command.feeRate, before: shop.feeRate, stoppedLiveProducts: stopped } });
      if (shop.status !== command.status) await notify({
        userId: await brandRecipients(command.shopId), type: "SYSTEM", title: `${shop.name} · ${BRAND_SHOP_STATUS[command.status]}`,
        body: command.moderationNote, link: "/brand/dashboard",
      });
      if (partners.length) await notify({
        userId: partners, type: "SYSTEM", title: `${shop.name} 상품 판매가 중지되었습니다`,
        body: "브랜드샵 공개가 중지되어 판매 목록과 진행 중 방송에서 이 브랜드 상품이 내려갔습니다.", link: "/brands",
      });
      return ok({ id: command.shopId });
    }

    if (command.action === "product") {
      if (!admin && user.role !== "BRAND_ADMIN") return fail("브랜드사 계정이 필요합니다.", 403);
      const { action, shopId, productId, revision, ...data } = command;
      if (!data.allowDropship && !data.allowWarehouse) return fail("직배송과 창고 입고 중 하나 이상은 허용해야 합니다.");
      if (data.minSalePrice != null && data.minSalePrice < data.supplyPrice) return fail("최저 판매가는 공급가보다 낮을 수 없습니다.");
      const shop = await prisma.brandShop.findFirst({ where: { id: shopId, ...ownerScope }, select: { id: true, lowStockThreshold: true } });
      if (!shop) return fail("편집할 수 있는 브랜드샵을 찾지 못했습니다.", 404);
      if (productId) {
        if (!revision) return fail("상품을 다시 불러와 주세요.", 409);
        const before = await prisma.brandProduct.findFirst({ where: { id: productId, shopId } });
        if (!before) return fail("상품을 찾지 못했습니다.", 404);
        const floor = Math.max(data.supplyPrice, data.minSalePrice ?? before.minSalePrice ?? 0);
        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.brandProduct.updateMany({
            where: { id: productId, shopId, updatedAt: new Date(revision) },
            data: { ...data, ...(data.stock > shop.lowStockThreshold && { lowStockNotifiedAt: null }) },
          });
          if (!updated.count) return null;
          // 숨기거나 직배송을 끄면 직배송 판매(셀러 목록 · 창고 직배송 상품 · 진행 중 방송)를 멈춘다
          const stopDropship = !data.isActive || !data.allowDropship;
          const stoppedLive = stopDropship ? await stopBrandSales(tx, { id: productId }, { warehouse: false }) : 0;
          if (!data.allowWarehouse) await tx.facilityProduct.updateMany({ where: { brandProductId: productId, fulfillment: "WAREHOUSE", stock: 0 }, data: { isSellable: false } });
          // 공급가·최저가 아래로 팔고 있던 판매 목록은 판매 중단 (판매처가 새 가격으로 다시 켜야 함)
          const underSeller = await tx.sellerBrandProduct.updateMany({ where: { brandProductId: productId, isActive: true, salePrice: { lt: floor } }, data: { isActive: false } });
          const underFacility = await tx.facilityProduct.updateMany({ where: { brandProductId: productId, isSellable: true, salePrice: { lt: floor } }, data: { isSellable: false } });
          if (data.stock !== before.stock) await capDropshipLiveStockInTx(tx, productId, data.stock);
          return { stoppedLive, under: underSeller.count + underFacility.count };
        });
        if (!result) return fail("상품 또는 재고가 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.", 409);
        if (data.stock <= shop.lowStockThreshold && data.stock < before.stock) await checkLowStock([productId]);
        // 판매처에 변경 알림
        const notes: string[] = [];
        if (before.isActive && !data.isActive) notes.push("브랜드가 상품을 내렸습니다");
        else if (before.allowDropship && !data.allowDropship) notes.push("직배송 판매가 중단되었습니다");
        if (data.supplyPrice !== before.supplyPrice) notes.push(`공급가 ${before.supplyPrice.toLocaleString()}원 → ${data.supplyPrice.toLocaleString()}원 (새로 방송에 올리는 상품부터 적용)`);
        if ((data.minSalePrice ?? null) !== before.minSalePrice && data.minSalePrice != null) notes.push(`최저 판매가 ${data.minSalePrice.toLocaleString()}원`);
        if (data.options !== before.options) notes.push("옵션이 바뀌었습니다");
        if (before.stock > 0 && data.stock === 0) notes.push("품절");
        if (result.under) notes.push(`최저 판매가 미만으로 등록된 판매 상품 ${result.under}건이 판매 중단되었습니다`);
        if (notes.length) {
          const partners = await partnerUserIds({ id: productId });
          if (partners.length) await notify({ userId: partners, type: "SYSTEM", title: `브랜드 상품 변경 · ${data.name}`, body: notes.join(" · "), link: `/brands/${shopId}` });
        }
        await audit({ actorId: user.id, action: "BRAND_PRODUCT_SAVE", entity: "BrandProduct", entityId: productId, meta: notes.length ? { notes, stoppedLive: result.stoppedLive } : undefined });
        return ok({ id: productId });
      }
      const created = await prisma.brandProduct.create({ data: { ...data, shopId }, select: { id: true } });
      await audit({ actorId: user.id, action: "BRAND_PRODUCT_CREATE", entity: "BrandProduct", entityId: created.id });
      return ok(created, 201);
    }

    const buyerEnabled = BRAND_BUYER_ROLES.includes(user.role)
      && (user.role !== "FACILITY_ADMIN" || !(await getSettings()).facilityDisabled);
    if (command.action === "request") {
      if (!buyerEnabled) return fail("셀러 또는 창고(스튜디오) 관리자 계정이 필요합니다.", 403);
      const verifyBlocked = await emailVerifyBlock(user);
      if (verifyBlocked) return fail(verifyBlocked, 403);
      if (command.kind === "SUPPLY" && user.role !== "FACILITY_ADMIN") return fail("창고 입고 요청은 창고(스튜디오) 관리자만 할 수 있습니다.", 403);
      const target = await prisma.brandProduct.findUnique({ where: { id: command.productId }, select: { shopId: true, samplePrice: true, shop: { select: { requireSellerApproval: true } } } });
      if (target) {
        const access = await partnerAccess(target.shopId, user.id, command.kind === "SUPPLY" && target.shop.requireSellerApproval);
        if (!access.ok) return fail(access.message, 403);
      }
      if (command.kind === "SAMPLE" && (target?.samplePrice ?? 0) > 0) {
        const blocked = paymentBlockedReason();
        if (blocked) return fail(blocked, 503);
      }
      const policy = await getPolicy();
      const requestWhere = { buyerId_requestKey: { buyerId: user.id, requestKey: command.requestKey } };
      const existingResult = (existing: { id: string; productId: string; kind: string; quantity: number; unitPrice: number }) => {
        if (existing.productId !== command.productId || existing.kind !== command.kind
            || existing.quantity !== command.quantity || existing.unitPrice !== command.expectedUnitPrice) {
          throw new BrandConflict("이미 접수된 요청입니다. 새 주문을 시작해 주세요.");
        }
        return { id: existing.id, ownerId: null as string | null, productName: "", paid: false, amount: 0 };
      };
      const saved = await transaction(async (tx) => {
        const existing = await tx.brandRequest.findUnique({ where: requestWhere });
        if (existing) return existingResult(existing);
        const product = await tx.brandProduct.findFirst({
          where: { id: command.productId, isActive: true, shop: { status: "APPROVED", owner: { isActive: true, role: "BRAND_ADMIN" } } },
          include: { shop: { select: { ownerId: true } } },
        });
        if (!product) throw new BrandConflict("신청할 수 있는 상품을 찾지 못했습니다.");
        const sample = command.kind === "SAMPLE";
        if (sample && command.quantity > policy.sampleMaxPerOrder) throw new BrandConflict(`샘플은 주문당 최대 ${policy.sampleMaxPerOrder}개까지 신청할 수 있습니다.`);
        const unitPrice = sample ? product.samplePrice : product.supplyPrice;
        if (unitPrice === null) throw new BrandConflict("샘플을 제공하지 않는 상품입니다.");
        if (unitPrice !== command.expectedUnitPrice) throw new BrandConflict("단가가 변경되었습니다. 상품을 새로고침해 주세요.");
        if ((sample ? product.sampleStock : product.stock) < command.quantity) throw new BrandConflict("재고가 부족합니다.");

        let facilityProductId: string | null = null;
        if (sample && product.sampleLimitPerBuyer > 0) {
          const used = await tx.brandRequest.count({
            where: { buyerId: user.id, productId: product.id, kind: "SAMPLE", status: { notIn: ["REJECTED", "CANCELLED", "REFUNDED"] } },
          });
          if (used >= product.sampleLimitPerBuyer) throw new BrandConflict(`이 상품의 샘플은 계정당 ${product.sampleLimitPerBuyer}회까지 신청할 수 있습니다.`);
        }
        if (!sample) {
          if (!product.allowWarehouse) throw new BrandConflict("이 상품은 창고 입고(위탁)를 받지 않습니다.");
          const listing = command.facilityProductId ? await tx.facilityProduct.findFirst({
            where: { id: command.facilityProductId, brandProductId: product.id, fulfillment: "WAREHOUSE", facility: { ownerId: user.id } },
            select: { id: true },
          }) : null;
          if (!listing) throw new BrandConflict("먼저 이 상품을 '창고 입고' 방식으로 판매 상품에 가져온 뒤 입고를 요청해 주세요.");
          facilityProductId = listing.id;
        }

        const paid = sample && unitPrice > 0;
        if (sample) await tx.brandProduct.update({
          where: { id: product.id }, data: { sampleStock: { decrement: command.quantity } },
        });
        const created = await tx.brandRequest.create({
          data: {
            buyerId: user.id, productId: product.id, requestKey: command.requestKey, kind: command.kind,
            status: paid ? "AWAITING_PAYMENT" : "PENDING", facilityProductId,
            productName: product.name, quantity: command.quantity, unitPrice,
            recipient: command.recipient, phone: command.phone, address: command.address, message: command.message,
          },
          select: { id: true },
        });
        return { id: created.id, ownerId: product.shop.ownerId, productName: product.name, paid, amount: unitPrice * command.quantity };
      }).catch(async (error: unknown) => {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        const existing = await prisma.brandRequest.findUnique({ where: requestWhere });
        if (!existing) throw error;
        return existingResult(existing);
      });

      // 유료 샘플: 플랫폼 결제 (실패하면 신청을 취소하고 재고를 되돌린다)
      if (saved.ownerId && saved.paid) {
        const adapter = getPaymentAdapter();
        const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { name: true, phone: true } });
        const created = await adapter.createPayment({ orderId: saved.id, amount: saved.amount, method: command.method, orderName: `샘플 · ${saved.productName}`, buyerName: profile?.name ?? command.recipient, buyerPhone: profile?.phone ?? command.phone });
        const confirmed = created.success && created.pgTransactionId ? await adapter.confirmPayment(created.pgTransactionId, saved.amount) : created;
        if (!confirmed.success) {
          await prisma.$transaction([
            prisma.brandRequest.update({ where: { id: saved.id }, data: { status: "CANCELLED", rejectReason: `결제 실패: ${confirmed.failReason ?? ""}`.slice(0, 300) } }),
            prisma.brandProduct.update({ where: { id: command.productId }, data: { sampleStock: { increment: command.quantity } } }),
          ]);
          return fail(confirmed.failReason ?? "샘플 결제에 실패했습니다.", 402);
        }
        await prisma.brandRequest.update({
          where: { id: saved.id },
          data: { status: "PENDING", paymentStatus: "PAID", paidAmount: saved.amount, pgTransactionId: created.pgTransactionId, paidAt: confirmed.approvedAt ?? new Date() },
        });
      }
      if (saved.ownerId) {
        await notify({
          userId: target ? await brandRecipients(target.shopId) : saved.ownerId, type: "SYSTEM", title: `새 ${BRAND_REQUEST_KIND[command.kind]}${saved.paid ? " (결제 완료)" : ""}`,
          body: saved.productName, link: `/brand/requests?request=${saved.id}`,
        });
        await audit({ actorId: user.id, action: "BRAND_REQUEST_CREATE", entity: "BrandRequest", entityId: saved.id, meta: { kind: command.kind, paid: saved.paid } });
      }
      return ok({ id: saved.id }, saved.ownerId ? 201 : 200);
    }

    if (!buyerEnabled && !admin && user.role !== "BRAND_ADMIN") return fail("접근 권한이 없습니다.", 403);
    const manager = admin || user.role === "BRAND_ADMIN";
    const saved = await transaction(async (tx) => {
      const request = await tx.brandRequest.findFirst({
        where: {
          id: command.requestId,
          ...(admin ? {} : user.role === "BRAND_ADMIN" ? { product: { shop: brandShopWhere(user.id) } } : { buyerId: user.id }),
        },
        include: { product: { select: { stock: true, shopId: true, shop: { select: { ownerId: true } } } } },
      });
      if (!request) return null;
      if (!brandRequestActions(request, manager).includes(command.status)) {
        throw new BrandConflict("현재 상태에서 실행할 수 없는 작업입니다.");
      }
      const shipping = command.status === "SHIPPED";
      if (shipping && !command.trackingNumber) throw new BrandConflict("택배사와 운송장 번호를 입력해 주세요.");
      if (command.status === "REJECTED" && !command.reason) throw new BrandConflict("반려 사유를 입력해 주세요.");

      if (request.kind === "SUPPLY" && command.status === "APPROVED") {
        if (request.product.stock < request.quantity) throw new BrandConflict("공급 재고가 부족합니다.");
        const left = await tx.brandProduct.update({ where: { id: request.productId }, data: { stock: { decrement: request.quantity } }, select: { stock: true } });
        await capDropshipLiveStockInTx(tx, request.productId, left.stock);
      }
      const release = command.status === "REJECTED" || command.status === "CANCELLED" || command.status === "REFUNDED";
      if (release && (request.kind === "SAMPLE" || request.status === "APPROVED")) {
        const change = { increment: request.quantity };
        await tx.brandProduct.update({
          where: { id: request.productId },
          data: request.kind === "SAMPLE" ? { sampleStock: change } : { stock: change },
        });
      }
      // 창고 입고 확인 → 창고 판매 재고 증가
      const received = request.kind === "SUPPLY" && command.status === "COMPLETED" && !!request.facilityProductId;
      if (received) {
        await tx.facilityProduct.update({ where: { id: request.facilityProductId! }, data: { stock: { increment: request.quantity }, isSellable: true } });
      }
      const refund = release && request.paymentStatus === "PAID" && !!request.pgTransactionId;
      await tx.brandRequest.update({
        where: { id: request.id },
        data: {
          status: command.status,
          ...(shipping ? { trackingNumber: command.trackingNumber, carrier: command.carrier ?? "" } : {}),
          ...(release && command.reason ? { rejectReason: command.reason } : {}),
          ...(received ? { receivedAt: new Date() } : {}),
        },
        select: { id: true },
      });
      return {
        id: request.id, buyerId: request.buyerId, ownerId: request.product.shop.ownerId, shopId: request.product.shopId, productName: request.productName,
        refund: refund ? { pgTransactionId: request.pgTransactionId!, amount: request.paidAmount } : null,
      };
    });
    if (!saved) return fail("신청 내역을 찾지 못했습니다.", 404);
    if (command.status === "APPROVED") await checkLowStock([await prisma.brandRequest.findUnique({ where: { id: saved.id }, select: { productId: true } }).then((r) => r?.productId ?? "")].filter(Boolean));
    // 유료 샘플 반려·취소 → 플랫폼 결제 환불
    if (saved.refund) {
      const adapter = getPaymentAdapter();
      const refunded = await adapter.refundPayment(saved.refund.pgTransactionId, saved.refund.amount, command.reason);
      await prisma.brandRequest.update({
        where: { id: saved.id },
        data: refunded.success ? { paymentStatus: "REFUNDED" } : { rejectReason: "환불 처리 실패 — 최고관리자가 확인합니다." },
      });
      if (!refunded.success) await notifyAdmins({ type: "SYSTEM", title: "샘플 환불 실패 확인 필요", body: saved.productName, link: `/admin/brands/requests?request=${saved.id}` });
    }
    await audit({ actorId: user.id, action: "BRAND_REQUEST_UPDATE", entity: "BrandRequest", entityId: saved.id, meta: { status: command.status } });
    await notify({
      userId: manager ? saved.buyerId : await brandRecipients(saved.shopId), type: "SYSTEM",
      title: `브랜드 신청 · ${BRAND_REQUEST_STATUS[command.status]}${saved.refund ? " (결제 환불)" : ""}`, body: command.reason ? `${saved.productName} · ${command.reason}` : saved.productName,
      link: `${manager ? "/brand-requests" : "/brand/requests"}?request=${saved.id}`,
    });
    return ok({ id: saved.id });
  } catch (error) {
    if (error instanceof BrandConflict) return fail(error.message, 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("이미 등록된 브랜드샵이 있습니다. 새로고침해 주세요.", 409);
    }
    if (error instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)) return handleError(error);
    console.error(error);
    return fail("브랜드샵 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}
