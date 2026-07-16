"use client";
import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function RegisterManagerButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [facility, setFacility] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setName(""); setEmail(""); setPassword(""); setFacility("");
  }

  function handleClose() {
    reset();
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, facility }),
      });
      if (res.ok) {
        alert("중간 관리자가 등록되었습니다.");
        handleClose();
      } else {
        alert("등록 기능 준비 중입니다.");
        handleClose();
      }
    } catch {
      alert("등록 기능 준비 중입니다.");
      handleClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" className="flex items-center gap-2">
        <UserPlus className="h-4 w-4" />
        중간 관리자 등록
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-brand-500" />
                중간 관리자 등록
              </h2>
              <button type="button" onClick={handleClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>이름 <span className="text-red-500">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" required />
              </div>
              <div>
                <Label>이메일 <span className="text-red-500">*</span></Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@example.com" required />
              </div>
              <div>
                <Label>임시 비밀번호 <span className="text-red-500">*</span></Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" required minLength={8} />
              </div>
              <div>
                <Label>담당 시설 (선택)</Label>
                <Input value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="강남 프리미엄 스튜디오" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>취소</Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "등록 중..." : "등록하기"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
