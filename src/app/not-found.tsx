import Link from "next/link";
import { SiteLogo } from "@/components/layout/site-logo";

export const metadata = { title: "페이지를 찾을 수 없습니다 | 스토리지마켓" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F6F2] px-4 text-center">
      <SiteLogo className="w-[230px] sm:w-[280px]" />
      <p className="mt-6 text-sm font-bold tracking-[0.2em] text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
        주소가 바뀌었거나 삭제된 페이지입니다. 종료된 방송 링크라면 셀러에게 새 링크를 요청해 주세요.
      </p>
      <div className="mt-8 flex gap-2">
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-navy px-6 text-sm font-semibold text-white hover:bg-navy-700">홈으로</Link>
        <Link href="/facilities" className="inline-flex h-11 items-center rounded-full border border-brand-300 bg-white px-6 text-sm font-semibold text-brand-700 hover:bg-brand-50">창고(스튜디오) 찾기</Link>
      </div>
    </main>
  );
}
