import { ShoppingBag, Store, Warehouse, type LucideIcon } from "lucide-react";

// 회원가입 유형 (메인페이지 · 가입 선택 화면 · 가입 폼 상단 전환 탭에서 함께 사용)
export type SignupRole = "SELLER" | "BRAND_ADMIN" | "FACILITY_ADMIN";

export const SIGNUP_ROLES: {
  role: SignupRole; href: string; icon: LucideIcon;
  label: string; title: string; summary: string; points: string[]; cta: string;
}[] = [
  {
    role: "SELLER", href: "/signup/seller", icon: Store, label: "셀러",
    title: "셀러", summary: "라이브 방송으로 상품을 판매해요",
    points: ["창고(스튜디오) 무료 예약", "브랜드 상품 찜 · 샘플 신청", "판매 정산 · 주문 확인"],
    cta: "셀러로 가입",
  },
  {
    role: "BRAND_ADMIN", href: "/signup/brand", icon: ShoppingBag, label: "브랜드사",
    title: "브랜드사", summary: "셀러 · 창고에 상품을 공급해요",
    points: ["내 브랜드샵 개설", "무료 · 유료 샘플 제공", "판매되면 발주서 자동 접수"],
    cta: "브랜드사로 가입",
  },
  {
    role: "FACILITY_ADMIN", href: "/signup/facility", icon: Warehouse, label: "창고(스튜디오)",
    title: "창고(스튜디오)", summary: "공간을 열고 셀러를 맞이해요",
    points: ["예약 받기 · 일정 관리", "창고 상품 등록 · 판매", "브랜드 상품 입고 · 판매"],
    cta: "창고(스튜디오)로 가입",
  },
];

export const visibleSignupRoles = (facilityDisabled: boolean) =>
  SIGNUP_ROLES.filter((r) => !(r.role === "FACILITY_ADMIN" && facilityDisabled));
