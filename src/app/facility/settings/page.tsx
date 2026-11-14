import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 창고 운영 콘솔에는 따로 계정 설정이 없다 — 내 계정 설정으로 보낸다
export default async function FacilitySettingsPage() {
  const u = await getSessionUser();
  redirect(u?.role === "MANAGER" ? "/manager/settings" : "/admin/settings");
}
