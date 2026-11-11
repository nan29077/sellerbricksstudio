"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CategoryPicker } from "@/components/category-picker";
import Link from "next/link";

const ROLE_LABEL = { SELLER: "셀러", FACILITY_ADMIN: "창고(스튜디오) 관리자", BRAND_ADMIN: "브랜드사" };
const CATEGORY_HINT = {
  SELLER: "주로 판매하는 카테고리를 고르면 맞춤 브랜드 상품과 창고(스튜디오)를 먼저 보여드립니다. (선택)",
  FACILITY_ADMIN: "창고(스튜디오)에서 주로 다루는 상품 카테고리를 골라 주세요. (선택)",
  BRAND_ADMIN: "브랜드가 취급하는 상품 카테고리를 1개 이상 골라 주세요. 브랜드샵과 상품 검색에 사용됩니다. (필수)",
};

export function SignupForm({ role }: { role: keyof typeof ROLE_LABEL }) {
  const router = useRouter();
  const brand = role === "BRAND_ADMIN";
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", companyName: "", businessNumber: "" });
  const [categories, setCategories] = useState<string[]>([]);
  const [agree, setAgree] = useState({ terms: false, privacy: false });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (brand && categories.length === 0) { setError("취급 카테고리를 1개 이상 선택하세요."); return; }
    if (!agree.terms || !agree.privacy) { setError("필수 약관에 동의해 주세요."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, businessNumber: form.businessNumber || undefined, categories, role, agreeTerms: agree.terms, agreePrivacy: agree.privacy }),
    });
    const json = await res.json().catch(() => ({ ok: false }));
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
      <p className="mt-1 text-sm text-muted-foreground">
        {brand ? "가입하면 브랜드샵이 만들어지고, 최고관리자 승인 후 셀러·창고(스튜디오)에 공개됩니다." : "스토리지마켓에 오신 것을 환영합니다."}
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div><Label htmlFor="su-name">{brand ? "담당자명" : "이름 / 담당자명"}</Label><Input id="su-name" autoComplete="name" value={form.name} onChange={set("name")} required maxLength={40} /></div>
        <div><Label htmlFor="su-email">이메일</Label><Input id="su-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required /></div>
        <div><Label htmlFor="su-pw">비밀번호 (8자 이상)</Label><Input id="su-pw" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required minLength={8} /></div>
        <div><Label htmlFor="su-phone">연락처</Label><Input id="su-phone" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="010-0000-0000" maxLength={30} inputMode="tel" /></div>
        <div><Label htmlFor="su-company">{brand ? "브랜드(회사)명 (필수)" : "회사/상호명"}</Label><Input id="su-company" autoComplete="organization" value={form.companyName} onChange={set("companyName")} required={brand} minLength={brand ? 2 : undefined} maxLength={60} /></div>
        {(brand || role === "FACILITY_ADMIN") && (
          <div><Label htmlFor="su-biz">사업자등록번호{brand ? "" : " (선택)"}</Label><Input id="su-biz" value={form.businessNumber} onChange={set("businessNumber")} placeholder="000-00-00000" maxLength={20} inputMode="numeric" /></div>
        )}
        <div>
          <Label>{brand ? "취급 카테고리" : "관심 카테고리"}</Label>
          <p className="mb-2 text-xs text-muted-foreground">{CATEGORY_HINT[role]}</p>
          <CategoryPicker value={categories} onChange={setCategories} />
        </div>
        <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2.5 font-bold text-navy">
            <input type="checkbox" className="h-5 w-5 accent-[#F5A623]" checked={agree.terms && agree.privacy} onChange={(e) => setAgree({ terms: e.target.checked, privacy: e.target.checked })} />
            전체 동의
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-slate-700">
            <input type="checkbox" className="h-5 w-5 accent-[#F5A623]" checked={agree.terms} onChange={(e) => setAgree({ ...agree, terms: e.target.checked })} />
            <span>(필수) <Link href="/terms" target="_blank" className="underline underline-offset-2">이용약관</Link>에 동의합니다</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-slate-700">
            <input type="checkbox" className="h-5 w-5 accent-[#F5A623]" checked={agree.privacy} onChange={(e) => setAgree({ ...agree, privacy: e.target.checked })} />
            <span>(필수) <Link href="/privacy" target="_blank" className="underline underline-offset-2">개인정보 수집·이용</Link>에 동의합니다</span>
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" size="lg" disabled={loading}>{loading ? "가입 중..." : "가입하기"}</Button>
      </form>
    </div>
  );
}
