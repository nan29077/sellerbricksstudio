"use client";
import { appAlert, appConfirm, appPrompt } from "@/components/ui/app-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";

export function ActionButton({
  url, method = "PATCH", body, confirmText, prompt, children, ...props
}: { url: string; method?: string; body?: Record<string, unknown>; confirmText?: string; prompt?: string } & ButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    if (confirmText && !(await appConfirm(confirmText))) return;
    let finalBody = body ?? {};
    if (prompt) {
      const v = (await appPrompt(prompt));
      if (v === null) return;
      finalBody = { ...finalBody, rejectReason: v };
    }
    setLoading(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(finalBody) });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!json.ok) { void appAlert(json.error ?? "처리에 실패했습니다."); return; }
    router.refresh();
  }
  return <Button onClick={run} disabled={loading} {...props}>{loading ? "처리중..." : children}</Button>;
}
