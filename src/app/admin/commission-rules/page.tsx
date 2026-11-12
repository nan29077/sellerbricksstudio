import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 예전 '수수료 정책' 화면은 예시(더미) 데이터만 보여 줬다.
// 중간관리자 수수료는 '중간관리자 관리', 판매 · 브랜드 수수료는 '수수료 · 운영 정책'에서 실제 값으로 관리한다.
export default async function AdminCommissionRules() {
  await requireRole(["SUPER_ADMIN"]);
  redirect("/admin/managers");
}
