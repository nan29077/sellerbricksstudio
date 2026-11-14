import Link from "next/link";
import { SignupRoleCards } from "@/components/signup/signup-role-cards";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-navy">회원가입</h1>
      <h2 className="mt-2 text-base font-bold text-slate-700">어떤 회원으로 시작할까요?</h2>
      <div className="mt-5"><SignupRoleCards variant="page" /></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">이미 계정이 있으신가요?</p>
        <Link href="/login" className={buttonVariants({ variant: "outline", className: "rounded-xl px-3" })}>로그인</Link>
      </div>
    </div>
  );
}
