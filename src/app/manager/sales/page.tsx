import { redirect } from "next/navigation";

// 창고 이용료가 없어져 예약 이용료 기준 매출은 의미가 없다 — 담당 창고의 판매 매출(창고 몫)은 창고 운영 콘솔의 '창고 매출'에서 본다.
export default function ManagerSales() { redirect("/facility/settlements"); }
