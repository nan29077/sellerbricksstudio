import { requireRole } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { PUBLIC_BRAND_SHOP, brandArtworkFor, parseOptions } from "@/lib/brands";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";

export const dynamic = "force-dynamic";

// GET — 셀러가 고른 위탁배송 브랜드 상품 (예약할 때 '방송할 브랜드 상품'으로 담는다)
export async function GET() {
  try {
    const user = await requireRole(["SELLER"]);
    const rows = await prisma.sellerBrandProduct.findMany({
      where: { sellerId: user.id, isActive: true, brandProduct: { isActive: true, shop: { ...PUBLIC_BRAND_SHOP, partners: { none: { userId: user.id, status: "BLOCKED" } } } } },
      orderBy: { createdAt: "desc" },
      include: { brandProduct: { select: { id: true, name: true, imageUrl: true, supplyPrice: true, consumerPrice: true, options: true, leadDays: true, category: true, shop: { select: { name: true } } } } },
      take: 200,
    });
    return ok(rows.map(({ brandProduct: bp, salePrice }) => ({
      brandProductId: bp.id, name: bp.name, brandName: bp.shop.name, imageUrl: bp.imageUrl || generatedBrandProductArtwork(bp.shop.name, bp)?.cover || brandArtworkFor(bp.category), supplyPrice: bp.supplyPrice,
      salePrice, category: bp.category, leadDays: bp.leadDays, options: parseOptions(bp.options),
    })));
  } catch (e) { return handleError(e); }
}
