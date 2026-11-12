"use client";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

// 설정 > 계정 정보 > 회원 탈퇴
export function WithdrawSection() {
  const [open, setOpen] = useState(false);
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open || blockers) return;
    fetch("/api/me/withdraw").then((r) => r.json()).then((j) => setBlockers(j.ok ? j.data.blockers : [j.error ?? "확인하지 못했습니다."])).catch(() => setBlockers(["네트워크 오류로 확인하지 못했습니다."]));
  }, [open, blockers]);

  async function submit() {
    setBusy(true); setMsg("");
    const res = await fetch("/api/me/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirm }) });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setMsg(json.error ?? "탈퇴하지 못했습니다."); return; }
    setMsg("탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
    setTimeout(() => { void signOut({ callbackUrl: "/" }); }, 1200);
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[40px] items-center text-sm font-semibold text-slate-500 underline underline-offset-2">회원 탈퇴</button>
      ) : (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm">
          <p className="font-bold text-red-700">회원 탈퇴</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
            <li>로그인 정보와 이름 · 연락처 · 사진 · 정산 계좌 · SNS 주소가 지워지고 다시 되돌릴 수 없습니다.</li>
            <li>주문 · 정산 · 세금 관련 기록은 관련 법에 따라 정해진 기간 동안 보관됩니다.</li>
            <li>같은 이메일로 다시 가입할 수 있습니다.</li>
          </ul>
          {blockers === null && <p className="text-xs text-slate-500">탈퇴할 수 있는지 확인하는 중...</p>}
          {blockers && blockers.length > 0 && (
            <div className="rounded-lg bg-white p-3 text-xs text-red-700">
              <p className="mb-1 font-semibold">아래를 먼저 정리해야 탈퇴할 수 있습니다.</p>
              <ul className="list-disc space-y-0.5 pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
          {blockers && blockers.length === 0 && (
            <>
              <div><Label htmlFor="wd-pw">비밀번호</Label><Input id="wd-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div><Label htmlFor="wd-confirm">확인을 위해 &apos;탈퇴&apos;를 입력하세요</Label><Input id="wd-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            </>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); setMsg(""); }} disabled={busy}>닫기</Button>
            {blockers && blockers.length === 0 && (
              <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={busy || !password || confirm !== "탈퇴"} onClick={submit}>{busy ? "처리 중..." : "탈퇴하기"}</Button>
            )}
          </div>
          {msg && <p role="status" className="text-xs text-navy">{msg}</p>}
        </div>
      )}
    </div>
  );
}
