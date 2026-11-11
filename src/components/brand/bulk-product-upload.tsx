"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { submitBrandCommand } from "@/components/shop/brand-command";

const HEADERS = ["상품명", "카테고리", "세부카테고리", "SKU", "공급가", "권장소비자가", "최저판매가", "재고", "출고소요일", "옵션", "직배송(Y/N)", "창고입고(Y/N)", "샘플가(비우면 샘플 없음)", "샘플재고", "샘플한도", "대표이미지주소", "상품설명"];
const SAMPLE = ["온유 수분 크림 50ml", "코스메틱", "스킨케어", "ONU-001", 14000, 32000, "", 500, 2, "용량:50ml,100ml", "Y", "Y", 0, 20, 1, "", "민감 피부용 수분 크림"];
const yes = (v: string) => /^(y|yes|o|true|1|예|가능)$/i.test(v.trim());
const num = (v: string) => Number(String(v).replace(/[,\s원]/g, "") || 0);

// 상품 엑셀(CSV) 일괄 등록: 행마다 상품 등록 요청을 보내 같은 검증을 거친다. (최대 200행)
export function BulkProductUpload({ shopId }: { shopId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<string[][]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: number; errors: string[] } | null>(null);

  async function read(file: File) {
    setDone(null);
    const parsed = parseCsv(await file.text());
    const body = parsed[0]?.[0]?.trim() === "상품명" ? parsed.slice(1) : parsed;
    setRows(body.slice(0, 200));
  }

  async function upload() {
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      const [name, category, subCategory, sku, supply, consumer, minSale, stock, lead, options, dropship, warehouse, samplePrice, sampleStock, sampleLimit, imageUrl, description] = r.map((v) => (v ?? "").trim());
      try {
        await submitBrandCommand({
          action: "product", shopId, name, category, subCategory, sku, description: description ?? "", imageUrl: imageUrl ?? "",
          supplyPrice: num(supply), consumerPrice: num(consumer), minSalePrice: minSale ? num(minSale) : null, stock: num(stock), leadDays: num(lead || "2"),
          options: options ?? "", allowDropship: dropship ? yes(dropship) : true, allowWarehouse: warehouse ? yes(warehouse) : true,
          samplePrice: samplePrice === "" || samplePrice == null ? null : num(samplePrice), sampleStock: num(sampleStock), sampleLimitPerBuyer: sampleLimit ? num(sampleLimit) : 1,
          isActive: true, images: [], shippingFee: 0,
        });
        ok += 1;
      } catch (e) {
        errors.push(`${i + 2}행 (${name || "이름 없음"}): ${e instanceof Error ? e.message : "실패"}`);
      }
    }
    setBusy(false);
    setDone({ ok, errors });
    setRows([]);
    router.refresh();
  }

  return (
    <div className="space-y-3 p-4 text-sm sm:p-5">
      <p className="text-slate-600">엑셀에서 양식을 채운 뒤 <b>CSV UTF-8</b> 형식으로 저장해 올려 주세요. 한 번에 200개까지 등록됩니다. 카테고리는 상품 등록 화면의 대분류 이름을 그대로 적어 주세요.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => downloadCsv("브랜드상품_일괄등록_양식.csv", [HEADERS, SAMPLE])}>양식 내려받기</Button>
        <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-navy hover:bg-slate-50">
          CSV 파일 선택
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
        </label>
        {rows.length > 0 && <Button type="button" size="sm" disabled={busy} onClick={upload}>{busy ? "등록 중…" : `${rows.length}개 등록`}</Button>}
      </div>
      {rows.length > 0 && <p className="text-xs text-slate-500">미리보기: {rows.slice(0, 3).map((r) => r[0]).join(", ")}{rows.length > 3 ? ` 외 ${rows.length - 3}개` : ""}</p>}
      {done && (
        <div role="status" className="rounded-xl bg-slate-50 p-3">
          <p className="font-bold text-navy">{done.ok}개 등록{done.errors.length ? ` · ${done.errors.length}개 실패` : " 완료"}</p>
          {done.errors.length > 0 && <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-red-700">{done.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
