import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BRAND_SHOP_STATUS } from "@/lib/brands";
import { pageOf, sp, type SP } from "@/lib/list";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Pagination } from "@/components/list/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export default async function AdminBrands({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const { page, size, skip, take } = pageOf(searchParams);
  const q = sp(searchParams, "q")?.slice(0, 100) ?? "";
  const filter = sp(searchParams, "status");
  const status = Object.keys(BRAND_SHOP_STATUS).find((value) => value === filter) as keyof typeof BRAND_SHOP_STATUS | undefined;
  const match = { contains: q, mode: "insensitive" as const };
  const where = { ...(status && { status }), ...(q && { OR: [{ name: match }, { owner: { email: match } }] }) };
  const [shops, total] = await Promise.all([
    prisma.brandShop.findMany({
      where, skip, take, orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: { id: true, name: true, status: true, owner: { select: { email: true } }, _count: { select: { products: true } } },
    }),
    prisma.brandShop.count({ where }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="브랜드샵 관리" description="입점 승인, 공개 상태, 상품과 공급·샘플 신청을 관리합니다."
        action={<Link href="/admin/brands/requests" className={buttonVariants({ variant: "outline" })}>전체 신청 조회</Link>} />
      <form action="/admin/brands" className="flex flex-wrap items-center gap-2">
        <Input name="q" aria-label="브랜드샵 검색" defaultValue={q} placeholder="샵 이름 또는 브랜드사 이메일" className="max-w-sm" />
        <Select name="status" aria-label="공개 상태" defaultValue={status ?? ""} className="w-auto">
          <option value="">전체 상태</option>
          {Object.entries(BRAND_SHOP_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Button variant="outline">검색</Button>
      </form>
      <div className="space-y-2">
        {shops.map((shop) => <article key={shop.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div><div className="flex items-center gap-2"><h2 className="font-black text-navy">{shop.name}</h2>
            <Badge tone={shop.status === "APPROVED" ? "green" : "yellow"}>{BRAND_SHOP_STATUS[shop.status]}</Badge></div>
            <p className="mt-1 break-all text-xs text-slate-600">{shop.owner.email} · 상품 {shop._count.products}개</p>
          </div>
          <Link href={`/admin/brands/${shop.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>샵 관리</Link>
        </article>)}
        {!shops.length && <p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">조건에 맞는 브랜드샵이 없습니다.</p>}
      </div>
      <Pagination base="/admin/brands" params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
