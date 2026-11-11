import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}
export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}
export function handleError(e: unknown) {
  if (e instanceof ZodError) return fail(e.issues[0]?.message ?? "입력값을 확인하세요.", 400, "VALIDATION");
  // DB 오류 내용(테이블·컬럼 이름 등)은 화면에 보여 주지 않는다.
  if (e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Prisma.PrismaClientUnknownRequestError
      || e instanceof Prisma.PrismaClientValidationError || e instanceof Prisma.PrismaClientInitializationError || e instanceof Prisma.PrismaClientRustPanicError) {
    console.error(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail("이미 등록된 항목입니다. 새로고침 후 다시 시도해 주세요.", 409);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return fail("대상을 찾을 수 없습니다. 새로고침해 주세요.", 404);
    return fail("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
  const msg = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
  if (msg === "UNAUTHORIZED") return fail("로그인이 필요합니다.", 401, "UNAUTHORIZED");
  if (msg === "FORBIDDEN") return fail("접근 권한이 없습니다.", 403, "FORBIDDEN");
  console.error(e);
  return fail(msg, 400);
}
