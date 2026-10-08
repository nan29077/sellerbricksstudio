"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const ROLE_LABEL: Record<string, string> = { SELLER: "셀러", FACILITY_ADMIN: "창고(스튜디오) 관리자" };

export function SignupForm({ role }: { role: "SELLER" | "FACILITY_ADMIN" }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", companyName: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const res = await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, role }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error ?? "회원가입에 실패했습니다."); setLoading(false); return; }
    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    setLoading(false);
    const me = await fetch("/api/me").then((r) => r.json()).catch(() => null);
    router.push(me?.data?.home ?? "/");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">{ROLE_LABEL[role]} 회원가입</h1>
      <p className="mt-1 text-sm text-muted-foreground">셀러 브릭스에 오신 것을 환영합니다.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div><Label>이름 / 담당자명</Label><Input value={form.name} onChange={set("name")} required /></div>
        <div><Label>이메일</Label><Input type="email" value={form.email} onChange={set("email")} required /></div>
        <div><Label>비밀번호 (8자 이상)</Label><Input type="password" value={form.password} onChange={set("password")} required /></div>
        <div><Label>연락처</Label><Input value={form.phone} onChange={set("phone")} placeholder="010-0000-0000" /></div>
        <div><Label>회사/상호명</Label><Input value={form.companyName} onChange={set("companyName")} /></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" size="lg" disabled={loading}>{loading ? "가입 중..." : "가입하기"}</Button>
      </form>
    </div>
  );
}
