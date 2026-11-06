"use client";
import { useEffect } from "react";
import Link from "next/link";

// 페이지 렌더링 중 예상치 못한 오류가 났을 때 보여주는 화면
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-bold tracking-[0.2em] text-red-500">ERROR</p>
      <h1 className="mt-2 text-2xl font-extrabold text-navy">일시적인 오류가 발생했습니다</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 아래 오류 코드를 알려주세요.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">오류 코드: {error.digest}</p>}
      <div className="mt-8 flex gap-2">
        <button onClick={reset} className="inline-flex h-11 items-center rounded-full bg-navy px-6 text-sm font-semibold text-white hover:bg-navy-700">다시 시도</button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-navy hover:bg-slate-50">홈으로</Link>
      </div>
    </main>
  );
}
