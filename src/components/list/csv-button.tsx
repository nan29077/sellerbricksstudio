"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// 엑셀에서 한글이 깨지지 않도록 BOM을 붙인 CSV를 내려받는다.
export function CsvButton({ filename, headers, rows, label = "엑셀(CSV) 다운로드" }: {
  filename: string; headers: string[]; rows: (string | number | null | undefined)[][]; label?: string;
}) {
  function download() {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      <Download className="h-4 w-4" />{label}
    </Button>
  );
}
