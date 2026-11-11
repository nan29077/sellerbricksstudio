"use client";
import { useEffect } from "react";
import Link from "next/link";
import { DB_ISSUE_HELP, classifyDbError } from "@/lib/db-error";

// 페이지 렌더링 중 예상치 못한 오류가 났을 때 보여주는 화면
// 개발 모드에서는 원인(DB 구조 불일치 · DB 연결 실패)을 판별해 해결 방법을 함께 안내한다.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const dev = process.env.NODE_ENV !== "production";
  const issue = dev ? classifyDbError(error.message) : "unknown";
  const help = issue !== "unknown" ? DB_ISSUE_HELP[issue] : null;

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-bold tracking-[0.2em] text-red-500">ERROR</p>
      <h1 className="mt-2 text-2xl font-extrabold text-navy">{help?.title ?? "일시적인 오류가 발생했습니다"}</h1>
      <p className="mt-3 max-w-md break-keep text-sm leading-6 text-slate-500">
        {help?.body ?? "잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 아래 오류 코드를 알려주세요."}
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">오류 코드: {error.digest}</p>}
      {dev && error.message && (
        <details className="mt-4 w-full max-w-xl rounded-xl border border-slate-200 bg-white p-3 text-left">
          <summary className="cursor-pointer text-xs font-bold text-slate-500">개발자용 오류 내용</summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-600">{error.message}</pre>
        </details>
      )}
      <div className="mt-8 flex gap-2">
        <button onClick={reset} className="inline-flex h-11 items-center rounded-full bg-navy px-6 text-sm font-semibold text-white hover:bg-navy-700">다시 시도</button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-navy hover:bg-slate-50">홈으로</Link>
      </div>
    </main>
  );
}
