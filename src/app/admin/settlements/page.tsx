import { redirect } from "next/navigation";

// 창고 이용료 정산은 없어졌다(이용료 무료). 창고 몫은 판매 정산에 들어 있다.
export default function Page() { redirect("/admin/payouts"); }
