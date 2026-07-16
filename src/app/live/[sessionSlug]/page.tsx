import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BuyerLive } from "@/components/buyer-live";

export const dynamic = "force-dynamic";

export default async function LivePage({ params }: { params: { sessionSlug: string } }) {
  const session = await prisma.liveSession.findUnique({
    where: { slug: params.sessionSlug },
    include: {
      facility: true, seller: { include: { profile: true } },
      products: { where: { isActive: true }, orderBy: { displayNumber: "asc" } },
    },
  });
  if (!session) notFound();

  return (
    <BuyerLive
      slug={session.slug}
      title={session.title}
      sellerName={session.seller.profile?.name ?? "셀러"}
      facilityName={session.facility.name}
      status={session.status}
      playbackUrl={session.catenoidPlaybackUrl}
      initial={session.products.map((p) => ({ id: p.id, displayNumber: p.displayNumber, name: p.nameSnapshot, price: p.priceSnapshot, stock: p.stockSnapshot, image: p.imageSnapshot, option: p.optionSnapshot }))}
      sessionId={session.id}
    />
  );
}
