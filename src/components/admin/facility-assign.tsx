"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/client-api";

export function FacilityAssign({ managerId, managerName, all, assigned }: {
  managerId: string; managerName: string; all: { id: string; name: string; region: string; taken: string | null }[]; assigned: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(assigned));
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState(false);
  const list = all.filter((f) => !kw || `${f.name} ${f.region}`.includes(kw));
  async function save() {
    setBusy(true);
    try { await api(`/api/admin/managers/${managerId}/facilities`, "PUT", { facilityIds: [...sel] }); setOpen(false); router.refresh(); }
    catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setSel(new Set(assigned)); setOpen(true); }}><Building2 className="h-4 w-4" />담당 배정</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${managerName} · 담당 창고(스튜디오)`}
        footer={<><span className="mr-auto text-xs text-muted-foreground">{sel.size}곳 선택</span><Button size="sm" variant="outline" onClick={() => setOpen(false)}>취소</Button><Button size="sm" disabled={busy} onClick={save}>{busy ? "저장중..." : "저장"}</Button></>}>
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="이름 · 지역 검색" className="mb-3 h-10 w-full rounded-lg border border-border px-3 text-sm" />
        <div className="space-y-1">
          {list.map((f) => (
            <label key={f.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={sel.has(f.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; })} />
              <span className="flex-1 text-sm text-navy">{f.name} <span className="text-xs text-muted-foreground">· {f.region}</span></span>
              {f.taken && <span className="text-[10px] text-slate-400">현재 {f.taken}</span>}
            </label>
          ))}
        </div>
      </Dialog>
    </>
  );
}
