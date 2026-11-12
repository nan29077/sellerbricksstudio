import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3007";

// 공개 페이지만 검색에 노출하고, 대시보드·주문·결제 화면은 수집하지 않는다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/intro", "/facilities", "/brands", "/notices"],
      // 끝에 / 를 붙여 /facility/(대시보드)만 막고 /facilities(공개 목록)는 막지 않는다.
      disallow: ["/admin/", "/seller/", "/facility/", "/manager/", "/brand/", "/api/", "/checkout/", "/order-complete/", "/live/"],
    }],
    sitemap: `${SITE.replace(/\/$/, "")}/sitemap.xml`,
  };
}
