import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}
export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}
export function handleError(e: unknown) {
  const msg = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
  if (msg === "UNAUTHORIZED") return fail("로그인이 필요합니다.", 401, "UNAUTHORIZED");
  if (msg === "FORBIDDEN") return fail("접근 권한이 없습니다.", 403, "FORBIDDEN");
  console.error(e);
  return fail(msg, 400);
}
