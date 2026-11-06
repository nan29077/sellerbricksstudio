"use client";

// 클라이언트에서 API 호출 공통 처리. 실패 시 메시지를 담은 Error를 던진다.
export async function api<T = any>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error ?? "처리에 실패했습니다.");
  return (json.data ?? json) as T;
}
