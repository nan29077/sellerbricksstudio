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
  return <CheckoutForm slug={session.slug} title={session.title} products={products} />;
}
