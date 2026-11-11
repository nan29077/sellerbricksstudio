export async function submitBrandCommand(command: Record<string, unknown>) {
  const response = await fetch("/api/brands", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error ?? "요청을 처리하지 못했습니다.");
  return result.data as { id: string };
}
