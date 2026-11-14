"use client";
import { appAlert } from "@/components/ui/app-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function RegisterManagerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [facility, setFacility] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setName(""); setEmail(""); setPassword(""); setFacility(""); setError("");
  }

  function handleClose() {
    reset();
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, facility }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error ?? "등록에 실패했습니다.");
        return;
      }
      const linked = json.data?.facility ? `\n담당 창고(스튜디오): ${json.data.facility}` : "";
      const note = json.data?.note ? `\n${json.data.note}` : "";
      void appAlert(`창고 운영 매니저가 등록되었습니다.${linked}${note}\n임시 비밀번호를 본인에게 안전하게 전달하세요.`);
      handleClose();
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" className="flex items-center gap-2">
        <UserPlus className="h-4 w-4" />
        창고 운영 매니저 등록
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-brand-500" />
                창고 운영 매니저 등록
              </h2>
              <button aria-label="닫기" type="button" onClick={handleClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
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
                <Label>담당 창고(스튜디오) (선택)</Label>
                <Input aria-label="담당 창고(스튜디오) (선택)" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="강남 프리미엄 스튜디오" />
              </div>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
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
