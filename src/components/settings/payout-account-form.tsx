"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Landmark } from "lucide-react";

// 셀러 · 중간관리자 정산 계좌 등록/변경
export function PayoutAccountForm({ description }: { description: string }) {
  const [info, setInfo] = useState<{ bankName: string; bankAccount: string; accountHolder: string; registered: boolean } | null>(null);
  const [f, setF] = useState({ bankName: "", bankAccount: "", accountHolder: "", currentPassword: "" });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const r = await fetch("/api/me/payout").then((x) => x.json()).catch(() => null);
    if (r?.ok) { setInfo(r.data); setF((v) => ({ ...v, bankName: r.data.bankName, accountHolder: r.data.accountHolder, bankAccount: "" })); setEditing(!r.data.registered); }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/me/payout", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error ?? "저장하지 못했습니다." }); return; }
    setMsg({ ok: true, text: "정산 계좌를 저장했습니다." }); setF((v) => ({ ...v, currentPassword: "" })); await load();
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-5 w-5 text-brand-500" />정산 계좌</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-slate-500">{description}</p>
        {info?.registered && !editing ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 px-4 py-3">
            <p><b className="text-navy">{info.bankName}</b> {info.bankAccount} · 예금주 {info.accountHolder}</p>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>계좌 변경</Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor="pa-bank">은행</Label><Input id="pa-bank" value={f.bankName} onChange={set("bankName")} placeholder="예: 국민은행" maxLength={30} /></div>
            <div><Label htmlFor="pa-acc">계좌번호</Label><Input id="pa-acc" value={f.bankAccount} onChange={set("bankAccount")} inputMode="numeric" placeholder="숫자와 - 만" maxLength={40} /></div>
            <div><Label htmlFor="pa-holder">예금주</Label><Input id="pa-holder" value={f.accountHolder} onChange={set("accountHolder")} maxLength={40} /></div>
            {info?.registered && <div className="sm:col-span-3"><Label htmlFor="pa-pw">현재 비밀번호 (계좌 변경 본인 확인)</Label><Input id="pa-pw" type="password" autoComplete="current-password" value={f.currentPassword} onChange={set("currentPassword")} /></div>}
            <div className="flex gap-2 sm:col-span-3">
              <Button size="sm" onClick={save} disabled={busy}>{busy ? "저장 중..." : "계좌 저장"}</Button>
              {info?.registered && <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setMsg(null); }}>취소</Button>}
            </div>
          </div>
        )}
        {msg && <p className={msg.ok ? "text-emerald-700" : "text-red-600"}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}
