import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site-brand";

export const metadata: Metadata = { title: `주문 조회 | ${SITE_NAME}` };

export default function OrderLookupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
