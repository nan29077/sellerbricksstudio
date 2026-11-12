import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { brandContext } from "@/lib/brand-access";
import { brandReport } from "@/lib/brand-report";
import { reportDbError } from "@/lib/db-error";
import { addDays, parseDateKey } from "@/lib/kst";
import { sp, type SP } from "@/lib/list";
import { formatKRW } from "@/lib/utils";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { DataNotice, Empty, KpiTile, Panel } from "@/components/dashboard/kit";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Download, Package, Sparkles, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const day = (d: Date) => new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);

// 브랜드 매출 리포트: 상품별 · 판매처별 · 월별 발주(공급가), 샘플 → 판매 전환
export default async function BrandReportsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["BRAND_ADMIN"]);
  if (user.id === "demo-brand") return <p>리포트를 보려면 데이터베이스 연결이 필요합니다.</p>;
  const today = parseDateKey(day(new Date()))!;
  const from = parseDateKey(sp(searchParams, "from") ?? "") ?? addDays(today, -89);
  const toDay = parseDateKey(sp(searchParams, "to") ?? "") ?? today;
  try {
    const ctx = await brandContext(user);
    if (!ctx) return <Empty icon={BarChart3} text="브랜드샵을 만들면 매출 리포트를 볼 수 있습니다." action={{ href: "/brand/shop", label: "브랜드샵 만들기" }} />;
    const r = await brandReport(ctx.shop.id, from, addDays(toDay, 1));
    const q = `from=${day(from)}&to=${day(toDay)}`;
    const maxMonth = Math.max(1, ...r.months.map((m) => m.supply));
    return (
      <div className="space-y-5">
        <PageHeader title="매출 리포트" description="취소·반품을 뺀 발주 기준(공급가)입니다. 기간을 바꿔 상품과 판매처 성과를 비교해 보세요."
          action={<a className={buttonVariants({ variant: "outline" })} href={`/api/brand-reports?${q}`}><Download className="h-4 w-4" aria-hidden />CSV 내려받기</a>} />
        <form action="/brand/reports" className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600" htmlFor="rp-from">기간</label>
          <Input id="rp-from" type="date" name="from" defaultValue={day(from)} className="w-auto" />
          <span aria-hidden>~</span>
          <Input aria-label="종료일" type="date" name="to" defaultValue={day(toDay)} className="w-auto" />
          <Button variant="outline">조회</Button>
        </form>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label="발주 공급가" value={formatKRW(r.totals.supply)} sub={`${r.totals.orders}건`} icon={BarChart3} tone="brand" emphasis />
          <KpiTile label="판매처 판매 금액" value={formatKRW(r.totals.sale)} sub="구매자 결제 기준" icon={Package} tone="sky" />
          <KpiTile label="판매처" value={String(r.partners.length)} unit="곳" icon={Users} tone="violet" />
          <KpiTile label="샘플 → 판매 전환" value={r.samples.partners ? `${Math.round((r.samples.converted / r.samples.partners) * 100)}%` : "-"} sub={`샘플 받은 ${r.samples.partners}곳 중 ${r.samples.converted}곳 발주`} icon={Sparkles} tone="green" />
        </div>
        <Panel eyebrow="MONTHLY" title="월별 발주 (공급가)">
          {!r.months.length ? <Empty text="기간 내 발주가 없습니다" /> : (
            <ul className="space-y-2">
              {r.months.map((m) => (
                <li key={m.month} className="grid grid-cols-[64px_minmax(0,1fr)_120px] items-center gap-3 text-sm">
                  <span className="font-semibold text-navy">{m.month}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-[#F1EEE8]"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${(m.supply / maxMonth) * 100}%` }} /></span>
                  <span className="text-right">{formatKRW(m.supply)} · {m.orders}건</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel eyebrow="PRODUCTS" title="상품별">
            {!r.products.length ? <Empty text="기간 내 판매된 상품이 없습니다" /> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm rtable">
                <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">상품</th><th className="text-right">수량</th><th className="text-right">공급가 합계</th><th className="text-right">판매 금액</th></tr></thead>
                <tbody>{r.products.map((p) => <tr key={p.name} className="border-b last:border-0"><td data-label="상품" className="py-2 font-semibold text-navy">{p.name}</td><td data-label="수량" className="text-right">{p.qty.toLocaleString()}</td><td data-label="공급가 합계" className="text-right">{formatKRW(p.supply)}</td><td data-label="판매 금액" className="text-right text-slate-600">{formatKRW(p.sale)}</td></tr>)}</tbody>
              </table></div>
            )}
          </Panel>
          <Panel eyebrow="PARTNERS" title="판매처별">
            {!r.partners.length ? <Empty text="기간 내 발주한 판매처가 없습니다" /> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[380px] text-sm rtable">
                <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">판매처</th><th>방식</th><th className="text-right">발주</th><th className="text-right">공급가 합계</th></tr></thead>
                <tbody>{r.partners.map((p, i) => <tr key={i} className="border-b last:border-0"><td data-label="판매처" className="py-2 font-semibold text-navy">{p.name}</td><td data-label="방식" className="text-xs text-slate-600">{p.kind}</td><td data-label="발주" className="text-right">{p.orders}건</td><td data-label="공급가 합계" className="text-right">{formatKRW(p.supply)}</td></tr>)}</tbody>
              </table></div>
            )}
          </Panel>
        </div>
        <p className="text-xs text-slate-500">정산 금액은 <Link href="/brand/settlements" className="font-semibold underline">정산 내역</Link>에서 확인하세요. (수수료·반품 차감 반영)</p>
      </div>
    );
  } catch (e) {
    return <DataNotice issue={reportDbError("brand-reports", e)} />;
  }
}
