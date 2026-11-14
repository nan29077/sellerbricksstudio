import { ShoppingBag, Store, type LucideIcon } from "lucide-react";

// 회원가입 유형 (메인페이지 · 가입 선택 화면 · 가입 폼 상단 전환 탭에서 함께 사용)
// 창고(스튜디오)는 본사가 직접 운영하므로 가입 유형이 없다 (2026-11-14)
export type SignupRole = "SELLER" | "BRAND_ADMIN";

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
    title: "브랜드사", summary: "셀러와 스토리지마켓 창고에 상품을 공급해요",
    points: ["내 브랜드샵 개설", "무료 · 유료 샘플 제공", "판매되면 발주서 자동 접수"],
    cta: "브랜드사로 가입",
  },
];

