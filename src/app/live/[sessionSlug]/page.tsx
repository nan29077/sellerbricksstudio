import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BuyerLive } from "@/components/buyer-live";
import { shippingLabel } from "@/lib/utils";
import { isMockStreamUrl, safeHttpUrl } from "@/lib/stream-embed";
import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site-brand";

// 카카오톡 등에 방송 링크를 보내면 방송 제목이 카드에 보이게 한다.
export async function generateMetadata({ params }: { params: { sessionSlug: string } }): Promise<Metadata> {
  const s = await prisma.liveSession.findUnique({ where: { slug: params.sessionSlug }, select: { title: true, status: true, seller: { select: { profile: { select: { name: true } } } } } }).catch(() => null);
  if (!s) return { title: `라이브 방송 | ${SITE_NAME}` };
  const who = s.seller.profile?.name ? `${s.seller.profile.name}의 ` : "";
  const t = `${s.status === "LIVE" ? "[LIVE] " : ""}${s.title} | ${SITE_NAME}`;
  return { title: t, description: `${who}라이브 방송 — 방송을 보면서 상품번호로 바로 주문하세요.`, openGraph: { title: t }, robots: { index: false } };
}

export const dynamic = "force-dynamic";

export default async function LivePage({ params }: { params: { sessionSlug: string } }) {
  const session = await prisma.liveSession.findUnique({
    where: { slug: params.sessionSlug },
    include: {
      facility: true, seller: { include: { profile: true } },
      products: { where: { isActive: true }, orderBy: { displayNumber: "asc" } },
      streamChannels: { select: { type: true, url: true } },
    },
  });
  if (!session) notFound();

  return (
    <BuyerLive
      slug={session.slug}
      title={session.title}
      sellerName={session.seller.profile?.name ?? "셀러"}
      facilityName={session.facility?.name ?? "셀러 라이브"}
      status={session.status}
      // 테스트용(Mock) 송출 주소는 구매자에게 내보내지 않는다.
      playbackUrl={isMockStreamUrl(session.catenoidPlaybackUrl) ? null : safeHttpUrl(session.catenoidPlaybackUrl)}
      channels={session.streamChannels.filter((c) => c.type !== "CATENOID" && safeHttpUrl(c.url)).map((c) => ({ type: c.type, url: safeHttpUrl(c.url)! }))}
      initial={session.products.map((p) => ({ id: p.id, displayNumber: p.displayNumber, name: p.nameSnapshot, price: p.priceSnapshot, stock: p.stockSnapshot, image: p.imageSnapshot, option: p.optionSnapshot }))}
      sessionId={session.id}
      shippingText={shippingLabel(session)}
    />
  );
}
