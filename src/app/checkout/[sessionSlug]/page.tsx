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
  // 주문은 방송 중에만 받는다 (시작 전 · 취소된 방송은 안내만)
  if (session.status === "DRAFT" || session.status === "READY" || session.status === "CANCELLED") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-black text-navy">{session.title}</h1>
        <p className="mt-3 text-sm text-slate-600">{session.status === "CANCELLED" ? "취소된 방송입니다." : "방송 시작 전입니다. 방송이 시작되면 주문할 수 있습니다."}</p>
        <a href={`/live/${session.slug}`} className="mt-6 inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-bold text-white">방송 화면으로</a>
      </main>
    );
  }
  const products = session.products.map((p) => ({ id: p.id, displayNumber: p.displayNumber, name: p.nameSnapshot, price: p.priceSnapshot, stock: p.stockSnapshot }));
  // 모든 주문은 배송지가 필요하고, 배송비는 셀러가 방송마다 정한다.
  return <CheckoutForm slug={session.slug} title={session.title} products={products} shipping={{ shippingFee: session.shippingFee, freeShippingOver: session.freeShippingOver }} />;
}
