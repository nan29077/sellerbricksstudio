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
  // 모든 주문은 배송지가 필요하고, 배송비는 셀러가 방송마다 정한다.
  return <CheckoutForm slug={session.slug} title={session.title} products={products} shipping={{ shippingFee: session.shippingFee, freeShippingOver: session.freeShippingOver }} />;
}
