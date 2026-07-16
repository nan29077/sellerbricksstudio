import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { ActionButton } from "@/components/action-button";
import { formatKRW } from "@/lib/utils";
import { Package, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_PRODUCTS: any[] = [
  {
    id:"fp1", isSellable:true, salePrice:35000, stock:120, commissionType:"PERCENT", commissionValue:10, createdAt:new Date("2026-05-01"),
    facility:{ name:"강남 프리미엄 라이브 스튜디오" },
    product:{ name:"수분 크림 세트 (3종)", category:"뷰티", thumbnailUrl:"https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&q=70&auto=format&fit=crop" },
  },
  {
    id:"fp2", isSellable:true, salePrice:89000, stock:45, commissionType:"PERCENT", commissionValue:8, createdAt:new Date("2026-05-10"),
    facility:{ name:"강남 프리미엄 라이브 스튜디오" },
    product:{ name:"에어팟 케이스 패션 컬렉션", category:"패션잡화", thumbnailUrl:"https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=200&q=70&auto=format&fit=crop" },
  },
  {
    id:"fp3", isSellable:false, salePrice:22000, stock:0, commissionType:"PERCENT", commissionValue:12, createdAt:new Date("2026-04-15"),
    facility:{ name:"강남 프리미엄 라이브 스튜디오" },
    product:{ name:"수제 반찬 세트 (5종)", category:"식품", thumbnailUrl:"https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=70&auto=format&fit=crop" },
  },
];

export default async function FacilityProducts() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let products: any[] = [];
  try {
    const facIds = await ownedFacilityIds(user.id);
    products = await prisma.facilityProduct.findMany({
      where: { facilityId: { in: facIds } },
      include: { product: true, facility: true },
      orderBy: { createdAt: "desc" },
    });
    if (products.length === 0) products = DUMMY_PRODUCTS;
  } catch {
    products = DUMMY_PRODUCTS;
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader
        title="상품 관리"
        description="시설에서 판매 가능한 상품과 셀러 수수료를 관리하세요."
        action={
          <Link href="/facility/products/new">
            <Button><Plus className="h-5 w-5 mr-1" />상품 등록</Button>
          </Link>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="등록된 상품이 없습니다"
          action={<Link href="/facility/products/new"><Button>첫 상품 등록</Button></Link>}
        />
      ) : (
        <div className="space-y-3 mt-4">
          {products.map((fp: any) => {
            const sellerPct = fp.commissionType === "PERCENT"
              ? 100 - fp.commissionValue
              : Math.round(((fp.salePrice - fp.commissionValue) / fp.salePrice) * 100);
            return (
              <Card key={fp.id}>
                <CardContent className="flex gap-4 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fp.product.thumbnailUrl ?? ""} alt="" className="h-16 w-16 rounded-lg object-cover bg-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge tone={fp.isSellable ? "green" : "gray"}>{fp.isSellable ? "판매중" : "중단"}</Badge>
                      <span className="text-xs text-muted-foreground">{fp.product.category}</span>
                    </div>
                    <p className="font-bold text-navy truncate">{fp.product.name}</p>
                    <p className="text-sm text-muted-foreground">{fp.facility?.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>판매가 <span className="font-semibold text-navy">{formatKRW(fp.salePrice)}</span></span>
                      <span>재고 {fp.stock}개</span>
                      <span>셀러 수령 {sellerPct}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <ActionButton
                      url={`/api/facility-products/${fp.id}/toggle`}
                      method="PATCH"
                      body={{ isSellable: !fp.isSellable }}
                      size="sm"
                      variant="outline"
                    >{fp.isSellable ? "중단" : "활성화"}</ActionButton>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
