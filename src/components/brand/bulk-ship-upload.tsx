"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { downloadCsv, parseCsv } from "@/lib/csv";

// 운송장 일괄 입력: 발주번호 · 택배사 · 운송장 번호 CSV
export function BulkShipUpload() {
  const router = useRouter();
  const [rows, setRows] = useState<{ poNo: string; carrier: string; trackingNumber: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; errors: string[] } | null>(null);

  async function read(file: File) {
    setResult(null);
    const parsed = parseCsv(await file.text());
    const body = /발주/.test(parsed[0]?.[0] ?? "") ? parsed.slice(1) : parsed;
    setRows(body.map((r) => ({ poNo: (r[0] ?? "").trim(), carrier: (r[1] ?? "").trim(), trackingNumber: (r[2] ?? "").trim() })).filter((r) => r.poNo && r.trackingNumber).slice(0, 300));
  }
  async function upload() {
    setBusy(true);
    const json = await fetch("/api/purchase-orders/bulk-ship", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) })
      .then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setResult({ ok: 0, errors: [json.error ?? "처리하지 못했습니다."] }); return; }
    const res = json.data.results as { poNo: string; ok: boolean; message?: string }[];
    setResult({ ok: res.filter((r) => r.ok).length, errors: res.filter((r) => !r.ok).map((r) => `${r.poNo}: ${r.message}`) });
    setRows([]);
    router.refresh();
  }
  return (
    <details className="rounded-2xl border bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-navy">운송장 일괄 입력 (CSV)</summary>
      <div className="space-y-3 border-t p-4 text-sm">
        <p className="text-slate-600">발주서 CSV를 내려받아 택배사·운송장 칸을 채우거나, 양식(발주번호 · 택배사 · 운송장 번호)에 맞춰 올려 주세요. 출고 전 직배송 발주만 &lsquo;배송 중&rsquo;으로 바뀝니다.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadCsv("운송장_일괄입력_양식.csv", [["발주번호", "택배사", "운송장번호"], ["PO-261111-ABC234", "CJ대한통운", "123456789012"]])}>양식 내려받기</Button>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-navy hover:bg-slate-50">
            CSV 파일 선택
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
          </label>
          {rows.length > 0 && <Button type="button" size="sm" disabled={busy} onClick={upload}>{busy ? "처리 중…" : `${rows.length}건 출고 처리`}</Button>}
        </div>
        {result && (
          <div role="status" className="rounded-xl bg-slate-50 p-3">
            <p className="font-bold text-navy">{result.ok}건 출고 처리{result.errors.length ? ` · ${result.errors.length}건 실패` : ""}</p>
            {result.errors.length > 0 && <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-red-700">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>
        )}
      </div>
    </details>
  );
}
