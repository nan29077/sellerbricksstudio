import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { StatusTabs } from "@/components/list/status-tabs";
import { CsvButton } from "@/components/list/csv-button";
import { ResourceForm, DeleteButton, PatchButton, type Field } from "@/components/resource-form";
import { CopyText } from "@/components/copy-text";
import { discountLabel, periodStatus } from "@/lib/marketing-labels";
import { formatDate, formatKRW } from "@/lib/utils";
import { toKstInput } from "@/lib/kst";
import { sp, type SP } from "@/lib/list";
import { Ticket, CheckCircle2, Percent, Users } from "lucide-react";

export const dynamic = "force-dynamic";
const API = "/api/seller/marketing/coupons";

const fields: Field[] = [
  { name: "name", label: "쿠폰명", required: true, placeholder: "예: 첫 구매 10% 할인" },
  { name: "code", label: "쿠폰 코드", required: true, half: true, help: "영문 대문자·숫자 4~20자" },
  { name: "discountType", label: "할인 방식", type: "select", half: true, options: [{ value: "PERCENT", label: "정률(%)" }, { value: "FIXED", label: "정액(원)" }] },
  { name: "discountValue", label: "할인 값", type: "number", min: 0, half: true, required: true },
  { name: "maxDiscount", label: "최대 할인액(원)", type: "number", min: 0, half: true, help: "정률 할인일 때 상한" },
  { name: "minAmount", label: "최소 주문 금액(원)", type: "number", min: 0, half: true },
  { name: "totalQty", label: "발행 수량", type: "number", min: 0, half: true, help: "비우면 무제한" },
  { name: "startAt", label: "사용 시작", type: "datetime", required: true, half: true },
  { name: "endAt", label: "사용 종료", type: "datetime", required: true, half: true },
  { name: "usedQty", label: "사용된 수량", type: "number", min: 0, half: true, help: "외부 쇼핑몰 사용 수를 직접 갱신" },
  { name: "isActive", label: "사용 가능 (끄면 일시 중지)", type: "checkbox" },
];

function randomCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "SB" + Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

export default async function SellerCoupons({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  const filter = sp(searchParams, "status");
  const all = await prisma.sellerCoupon.findMany({ where: { sellerId: user.id }, orderBy: { createdAt: "desc" } });
  const withSt = all.map((c) => {
    const p = periodStatus(c.startAt, c.endAt);
    const soldOut = c.totalQty !== null && c.usedQty >= c.totalQty;
    const st = !c.isActive ? { key: "PAUSED", label: "일시 중지", tone: "gray" as const }
      : soldOut ? { key: "SOLDOUT", label: "소진", tone: "red" as const } : p;
    return { ...c, st };
  });
  const rows = filter ? withSt.filter((c) => c.st.key === filter) : withSt;
  const count = (k: string) => withSt.filter((c) => c.st.key === k).length;
  const used = all.reduce((s, c) => s + c.usedQty, 0);
  const issued = all.reduce((s, c) => s + (c.totalQty ?? 0), 0);
  const now = new Date();

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="쿠폰 관리" description="라이브 방송에서 안내할 할인 쿠폰을 발급하고 사용 현황을 관리합니다."
        action={<div className="flex gap-2">
          <CsvButton filename="쿠폰목록" headers={["쿠폰명", "코드", "할인", "최소주문", "발행", "사용", "시작", "종료", "상태"]}
            rows={withSt.map((c) => [c.name, c.code, discountLabel(c.discountType, c.discountValue), c.minAmount, c.totalQty ?? "무제한", c.usedQty, formatDate(c.startAt), formatDate(c.endAt), c.st.label])} label="CSV" />
          <ResourceForm url={API} fields={fields} title="쿠폰 발급" initial={{ code: randomCode(), discountType: "PERCENT", discountValue: 10, minAmount: 0, usedQty: 0, isActive: true, startAt: toKstInput(now), endAt: toKstInput(new Date(now.getTime() + 30 * 86400000)) }} />
        </div>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="사용 가능 쿠폰" value={`${count("ACTIVE")}개`} icon={Ticket} tone="green" />
        <Kpi label="전체 쿠폰" value={`${all.length}개`} icon={Percent} tone="brand" />
        <Kpi label="누적 사용" value={`${used.toLocaleString()}회`} icon={CheckCircle2} tone="blue" />
        <Kpi label="사용률" value={issued ? `${Math.round((used / issued) * 100)}%` : "-"} sub="수량 제한 쿠폰 기준" icon={Users} tone="navy" />
      </div>

      <StatusTabs base="/seller/marketing/coupons" params={searchParams} tabs={[
        { value: "", label: "전체", count: all.length }, { value: "ACTIVE", label: "사용 가능", count: count("ACTIVE") },
        { value: "UPCOMING", label: "예정", count: count("UPCOMING") }, { value: "ENDED", label: "기간 만료", count: count("ENDED") },
        { value: "SOLDOUT", label: "소진", count: count("SOLDOUT") }, { value: "PAUSED", label: "일시 중지", count: count("PAUSED") },
      ]} />

      {rows.length === 0 ? <EmptyState icon={<Ticket className="h-10 w-10" />} title="쿠폰이 없습니다" description="방송 시청자에게 줄 쿠폰을 발급해 보세요." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => {
            const pct = c.totalQty ? Math.min(100, Math.round((c.usedQty / c.totalQty) * 100)) : null;
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
                  <span className="text-2xl font-black text-brand-400">{discountLabel(c.discountType, c.discountValue)}</span>
                  <Badge tone={c.st.tone}>{c.st.label}</Badge>
                </div>
                <CardContent className="space-y-2 pt-4">
                  <p className="font-bold text-navy">{c.name}</p>
                  <CopyText text={c.code} />
                  <p className="text-xs text-muted-foreground">
                    {c.minAmount > 0 ? `${formatKRW(c.minAmount)} 이상 구매 시` : "최소 금액 없음"}{c.maxDiscount ? ` · 최대 ${formatKRW(c.maxDiscount)}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(c.startAt)} ~ {formatDate(c.endAt)}</p>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>사용 {c.usedQty.toLocaleString()}회</span><span>{c.totalQty ? `발행 ${c.totalQty.toLocaleString()}` : "무제한"}</span></div>
                    {pct !== null && <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <PatchButton url={`${API}/${c.id}`} body={{ usedQty: c.usedQty + 1 }} variant="outline" className="h-8 px-2.5 text-xs" disabled={c.totalQty !== null && c.usedQty >= c.totalQty}>사용 +1</PatchButton>
                    <PatchButton url={`${API}/${c.id}`} body={{ isActive: !c.isActive }} variant="outline" className="h-8 px-2.5 text-xs">{c.isActive ? "일시 중지" : "다시 사용"}</PatchButton>
                    <ResourceForm url={API} id={c.id} fields={fields} title="쿠폰 수정" iconOnly triggerVariant="ghost" initial={{ ...c, startAt: toKstInput(c.startAt), endAt: toKstInput(c.endAt), maxDiscount: c.maxDiscount ?? "", totalQty: c.totalQty ?? "" }} />
                    <DeleteButton url={`${API}/${c.id}`} />
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
