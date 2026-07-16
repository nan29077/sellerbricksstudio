"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export function ManagerCommissionEditor({ managerId, type, value }: { managerId: string; type: string; value: number }) {
  const router = useRouter();
  const [t, setT] = useState(type); const [v, setV] = useState(String(value)); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await fetch(`/api/admin/managers/${managerId}/commission`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commissionType: t, commissionValue: Number(v) }) });
    const json = await res.json(); setBusy(false);
    if (!json.ok) { alert(json.error); return; }
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <Select value={t} onChange={(e) => setT(e.target.value)} className="w-28"><option value="PERCENT">정률(%)</option><option value="FIXED">정액(원)</option></Select>
      <Input value={v} onChange={(e) => setV(e.target.value)} className="w-24" inputMode="numeric" />
      <Button size="sm" onClick={save} disabled={busy}>{busy ? "저장중" : "저장"}</Button>
    </div>
  );
}
