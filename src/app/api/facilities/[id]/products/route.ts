import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/http";

const DUMMY_PRODUCTS = [
  { id: "fp1", salePrice: 45000, consumerPrice: 65000, stock: 200, commissionType: "PERCENT", commissionValue: 15, isSellable: true, product: { id: "p1", name: "퀄리티 뷰티 세럼 A", category: "뷰티", thumbnailUrl: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&q=70" } },
  { id: "fp2", salePrice: 28000, consumerPrice: 42000, stock: 350, commissionType: "PERCENT", commissionValue: 12, isSellable: true, product: { id: "p2", name: "선크림 SPF50+ PA++++", category: "뷰티", thumbnailUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=300&q=70" } },
  { id: "fp3", salePrice: 89000, consumerPrice: 120000, stock: 80, commissionType: "PERCENT", commissionValue: 18, isSellable: true, product: { id: "p3", name: "홍삼 진액 선물세트", category: "건강식품", thumbnailUrl: "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=300&q=70" } },
  { id: "fp4", salePrice: 35000, consumerPrice: 52000, stock: 150, commissionType: "PERCENT", commissionValue: 14, isSellable: true, product: { id: "p4", name: "캐시미어 니트 가디건", category: "패션", thumbnailUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=300&q=70" } },
  { id: "fp5", salePrice: 12000, consumerPrice: 18000, stock: 500, commissionType: "PERCENT", commissionValue: 10, isSellable: true, product: { id: "p5", name: "제주 감귤 2kg 박스", category: "식품", thumbnailUrl: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=300&q=70" } },
  { id: "fp6", salePrice: 199000, consumerPrice: 280000, stock: 30, commissionType: "PERCENT", commissionValue: 20, isSellable: true, product: { id: "p6", name: "에어프라이어 5.5L", category: "주방용품", thumbnailUrl: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=300&q=70" } },
];

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fps = await prisma.facilityProduct.findMany({
      where: { facilityId: params.id, isSellable: true },
      include: {
        product: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (fps.length === 0) return ok(DUMMY_PRODUCTS);

    const result = fps.map((fp) => ({
      id: fp.id,
      salePrice: fp.salePrice,
      consumerPrice: fp.consumerPrice,
      stock: fp.stock,
      commissionType: fp.commissionType,
      commissionValue: fp.commissionValue,
      isSellable: fp.isSellable,
      product: {
        id: fp.product.id,
        name: fp.product.name,
        category: fp.product.category,
        thumbnailUrl: fp.product.thumbnailUrl ?? fp.product.images?.[0]?.url ?? null,
      },
    }));

    return ok(result);
  } catch {
    return ok(DUMMY_PRODUCTS);
  }
}
