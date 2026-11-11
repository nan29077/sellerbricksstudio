import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckoutForm } from "@/components/checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: { sessionSlug: string } }) {
  const session = await prisma.liveSession.findUnique({
    where: { slug: params.sessionSlug },
    include: { products: { where: { isActive: true } } },
  });
  if (!session) notFound();
  const products = session.products.map((p) => ({ id: p.id, displayNumber: p.displayNumber, name: p.nameSnapshot, price: p.priceSnapshot, stock: p.stockSnapshot }));
  // 브랜드 직배송 상품이 있으면 배송지가 꼭 필요하다.
  const needsAddress = session.products.some((p) => p.fulfillment === "DROPSHIP");
  return <CheckoutForm slug={session.slug} title={session.title} products={products} needsAddress={needsAddress} />;
}
