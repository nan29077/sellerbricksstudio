import { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { BRAND_BUYER_ROLES, BRAND_CATEGORIES, BRAND_REQUEST_KIND, BRAND_REQUEST_STATUS, BRAND_SHOP_STATUS, brandRequestActions } from "@/lib/brands";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { notify, notifyAdmins } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { isShopImageUrl } from "@/lib/shop-artwork";

const id = z.string().min(1).max(64);
const line = (max: number) => z.string().trim().max(max);
const image = line(500).refine((value) => !value || isShopImageUrl(value), "이미지는 HTTPS 주소를 사용해 주세요.");
const stock = z.number().int().min(0).max(1_000_000);
const price = z.number().int().min(0).max(100_000_000);

const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("shop"), shopId: id.optional(), name: line(60).min(2), tagline: line(100),
    description: line(1500), logoUrl: image, bannerUrl: image, backgroundUrl: image, paymentInstructions: line(600),
  }),
  z.object({
    action: z.literal("moderate"), shopId: id, status: z.enum(["PENDING", "APPROVED", "SUSPENDED"]), moderationNote: line(500),
  }),
  z.object({
    action: z.literal("product"), shopId: id, productId: id.optional(), revision: z.string().datetime().optional(),
    name: line(100).min(2), category: z.enum(BRAND_CATEGORIES), description: line(2000), imageUrl: image,
    supplyPrice: price, stock, samplePrice: price.nullable(), sampleStock: stock, isActive: z.boolean(),
  }),
  z.object({
    action: z.literal("request"), productId: id, requestKey: z.string().regex(/^[0-9a-f]{32}$/), kind: z.enum(["SUPPLY", "SAMPLE"]),
    quantity: z.number().int().min(1).max(1000), expectedUnitPrice: price,
    recipient: line(60).min(2),
    phone: line(30).regex(/^[+\d ()-]{8,30}$/, "연락처를 확인해 주세요.")
      .refine((value) => value.replace(/\D/g, "").length >= 8, "연락처를 확인해 주세요."),
    address: line(300).min(5), message: line(1000),
  }),
  z.object({
    action: z.literal("transition"), requestId: id,
    status: z.enum(["APPROVED", "SHIPPED", "COMPLETED", "REJECTED", "CANCELLED", "REFUNDED"]),
    trackingNumber: line(100).optional(),
  }),
]);

class BrandConflict extends Error {}

async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
    const ownerScope = admin ? {} : { ownerId: user.id };

    if (command.action === "shop") {
      if (!admin && user.role !== "BRAND_ADMIN") return fail("브랜드사 계정이 필요합니다.", 403);
      const { action, shopId, ...data } = command;
      const shop = shopId
        ? await prisma.brandShop.findFirst({ where: { id: shopId, ...ownerScope } })
        : admin ? null : await prisma.brandShop.findUnique({ where: { ownerId: user.id } });
      if (!shop && (shopId || admin)) return fail("편집할 수 있는 브랜드샵을 찾지 못했습니다.", 404);
      const saved = shop
        ? await prisma.brandShop.update({ where: { id: shop.id }, data })
        : await prisma.brandShop.create({ data: { ...data, ownerId: user.id } });
      await audit({ actorId: user.id, action: "BRAND_SHOP_SAVE", entity: "BrandShop", entityId: saved.id });
      if (!shop) await notifyAdmins({ type: "SYSTEM", title: "브랜드샵 공개 승인 요청", body: saved.name, link: `/admin/brands/${saved.id}` });
      return ok({ id: saved.id }, shop ? 200 : 201);
    }

    if (command.action === "moderate") {
      if (!admin) return fail("최고관리자 권한이 필요합니다.", 403);
      const shop = await prisma.brandShop.findUnique({ where: { id: command.shopId }, select: { ownerId: true, name: true, status: true } });
      if (!shop) return fail("브랜드샵을 찾지 못했습니다.", 404);
      await prisma.brandShop.update({
        where: { id: command.shopId },
        data: { status: command.status, moderationNote: command.moderationNote },
      });
      await audit({ actorId: user.id, action: "BRAND_SHOP_MODERATE", entity: "BrandShop", entityId: command.shopId, meta: { status: command.status } });
      if (shop.status !== command.status) await notify({
        userId: shop.ownerId, type: "SYSTEM", title: `${shop.name} · ${BRAND_SHOP_STATUS[command.status]}`,
        body: command.moderationNote, link: "/brand/dashboard",
      });
      return ok({ id: command.shopId });
    }

    if (command.action === "product") {
      if (!admin && user.role !== "BRAND_ADMIN") return fail("브랜드사 계정이 필요합니다.", 403);
      const { action, shopId, productId, revision, ...data } = command;
      const shop = await prisma.brandShop.findFirst({ where: { id: shopId, ...ownerScope }, select: { id: true } });
      if (!shop) return fail("편집할 수 있는 브랜드샵을 찾지 못했습니다.", 404);
      if (productId) {
        if (!revision) return fail("상품을 다시 불러와 주세요.", 409);
        const updated = await prisma.brandProduct.updateMany({
          where: { id: productId, shopId, updatedAt: new Date(revision) },
          data,
        });
        if (!updated.count) return fail("상품 또는 재고가 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.", 409);
        await audit({ actorId: user.id, action: "BRAND_PRODUCT_SAVE", entity: "BrandProduct", entityId: productId });
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
      const requestWhere = { buyerId_requestKey: { buyerId: user.id, requestKey: command.requestKey } };
      const existingResult = (existing: { id: string; productId: string; kind: string; quantity: number; unitPrice: number }) => {
        if (existing.productId !== command.productId || existing.kind !== command.kind
            || existing.quantity !== command.quantity || existing.unitPrice !== command.expectedUnitPrice) {
          throw new BrandConflict("이미 접수된 요청입니다. 새 주문을 시작해 주세요.");
        }
        return { id: existing.id, ownerId: null, productName: "" };
      };
      const saved = await transaction(async (tx) => {
        const existing = await tx.brandRequest.findUnique({ where: requestWhere });
        if (existing) return existingResult(existing);
        const product = await tx.brandProduct.findFirst({
          where: { id: command.productId, isActive: true, shop: { status: "APPROVED", owner: { isActive: true, role: "BRAND_ADMIN" } } },
          include: { shop: { select: { ownerId: true, paymentInstructions: true } } },
        });
        if (!product) throw new BrandConflict("신청할 수 있는 상품을 찾지 못했습니다.");
        const sample = command.kind === "SAMPLE";
        if (sample && command.quantity > 20) throw new BrandConflict("샘플은 주문당 최대 20개까지 신청할 수 있습니다.");
        const unitPrice = sample ? product.samplePrice : product.supplyPrice;
        if (unitPrice === null) throw new BrandConflict("샘플을 제공하지 않는 상품입니다.");
        if (unitPrice !== command.expectedUnitPrice) throw new BrandConflict("단가가 변경되었습니다. 상품을 새로고침해 주세요.");
        const paid = sample && unitPrice > 0;
        if (paid && !product.shop.paymentInstructions) throw new BrandConflict("브랜드사가 입금 안내를 등록하면 주문할 수 있습니다.");
        if ((sample ? product.sampleStock : product.stock) < command.quantity) throw new BrandConflict("재고가 부족합니다.");

        if (sample) await tx.brandProduct.update({
          where: { id: product.id }, data: { sampleStock: { decrement: command.quantity } },
        });
        const created = await tx.brandRequest.create({
          data: {
            buyerId: user.id, productId: product.id, requestKey: command.requestKey, kind: command.kind,
            status: paid ? "AWAITING_PAYMENT" : "PENDING",
            productName: product.name, quantity: command.quantity, unitPrice,
            recipient: command.recipient, phone: command.phone, address: command.address, message: command.message,
            paymentInstructions: paid ? product.shop.paymentInstructions : "",
          },
          select: { id: true },
        });
        return { id: created.id, ownerId: product.shop.ownerId, productName: product.name };
      }).catch(async (error: unknown) => {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        const existing = await prisma.brandRequest.findUnique({ where: requestWhere });
        if (!existing) throw error;
        return existingResult(existing);
      });
      if (saved.ownerId) await notify({
        userId: saved.ownerId, type: "SYSTEM", title: `새 ${BRAND_REQUEST_KIND[command.kind]}`,
        body: saved.productName, link: `/brand/requests?request=${saved.id}`,
      });
      return ok({ id: saved.id }, saved.ownerId ? 201 : 200);
    }

    if (!buyerEnabled && !admin && user.role !== "BRAND_ADMIN") return fail("접근 권한이 없습니다.", 403);
    const saved = await transaction(async (tx) => {
      const request = await tx.brandRequest.findFirst({
        where: {
          id: command.requestId,
          ...(admin ? {} : user.role === "BRAND_ADMIN" ? { product: { shop: { ownerId: user.id } } } : { buyerId: user.id }),
        },
        include: { product: { select: { stock: true, shop: { select: { ownerId: true } } } } },
      });
      if (!request) return null;
      const manager = admin || user.role === "BRAND_ADMIN";
      if (!brandRequestActions(request, manager).includes(command.status)) {
        throw new BrandConflict("현재 상태에서 실행할 수 없는 작업입니다.");
      }
      const shipping = command.status === "SHIPPED";
      if (shipping && !command.trackingNumber) throw new BrandConflict("택배사와 운송장 번호를 입력해 주세요.");

      if (request.kind === "SUPPLY" && command.status === "APPROVED") {
        if (request.product.stock < request.quantity) throw new BrandConflict("공급 재고가 부족합니다.");
        await tx.brandProduct.update({ where: { id: request.productId }, data: { stock: { decrement: request.quantity } } });
      }
      const release = command.status === "REJECTED" || command.status === "CANCELLED" || command.status === "REFUNDED";
      if (release && (request.kind === "SAMPLE" || request.status === "APPROVED")) {
        const change = { increment: request.quantity };
        await tx.brandProduct.update({
          where: { id: request.productId },
          data: request.kind === "SAMPLE" ? { sampleStock: change } : { stock: change },
        });
      }
      await tx.brandRequest.update({
        where: { id: request.id },
        data: { status: command.status, ...(shipping ? { trackingNumber: command.trackingNumber } : {}) },
        select: { id: true },
      });
      return { id: request.id, buyerId: request.buyerId, ownerId: request.product.shop.ownerId, productName: request.productName };
    });
    if (!saved) return fail("신청 내역을 찾지 못했습니다.", 404);
    await audit({ actorId: user.id, action: "BRAND_REQUEST_UPDATE", entity: "BrandRequest", entityId: saved.id, meta: { status: command.status } });
    const manager = admin || user.role === "BRAND_ADMIN";
    await notify({
      userId: manager ? saved.buyerId : saved.ownerId, type: "SYSTEM",
      title: `브랜드 신청 · ${BRAND_REQUEST_STATUS[command.status]}`, body: saved.productName,
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
