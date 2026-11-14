"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// 관리 화면 자동 새로고침 — 새 문의 · 고객 메시지가 오면 화면을 다시 그린다 (답변을 쓰는 중에는 기다린다)
export function SupportLive({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const el = document.activeElement;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT")) return;
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

// 문의를 펼쳐 보면 '운영팀 읽음'으로 표시한다
export function SupportReadMarker({ id, unread }: { id: string; unread: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const details = ref.current?.closest("details");
    if (!details || !unread) return;
    const mark = () => { if (details.open) void fetch(`/api/admin/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) }).catch(() => undefined); };
    if (details.open) mark();
    details.addEventListener("toggle", mark);
    return () => details.removeEventListener("toggle", mark);
  }, [id, unread]);
  return <span ref={ref} hidden />;
}
