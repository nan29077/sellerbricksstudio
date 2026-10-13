import {
  LayoutDashboard, CalendarDays, Radio, ShoppingCart, MessageSquare,
  Warehouse, Package, CalendarClock, Users, Building2,
  Settings, ScrollText, PlusCircle,
} from "lucide-react";
import type { NavItem } from "./dashboard-shell";

export const sellerNav: NavItem[] = [
  { href: "/seller/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/seller/bookings", label: "예약", icon: CalendarDays },
  { href: "/seller/live-sessions", label: "라이브", icon: Radio },
  { href: "/seller/orders", label: "주문", icon: ShoppingCart },
];

export const facilityNav: NavItem[] = [
  { href: "/facility/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/facility/profile", label: "창고(스튜디오)정보", icon: Warehouse },
  { href: "/facility/products", label: "상품", icon: Package },
  { href: "/facility/schedule", label: "일정", icon: CalendarClock },
  { href: "/facility/bookings", label: "예약", icon: CalendarDays },
  { href: "/facility/live-sessions", label: "라이브", icon: Radio },
  { href: "/facility/orders", label: "주문", icon: ShoppingCart },
];

export const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/users", label: "회원", icon: Users },
  { href: "/admin/facilities", label: "창고(스튜디오)", icon: Building2 },
  { href: "/admin/bookings", label: "예약", icon: CalendarDays },
  { href: "/admin/orders", label: "주문", icon: ShoppingCart },
  { href: "/admin/integrations", label: "연동설정", icon: Settings },
  { href: "/admin/audit-logs", label: "감사로그", icon: ScrollText },
];
