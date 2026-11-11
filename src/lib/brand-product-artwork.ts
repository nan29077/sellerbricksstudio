const generatedProducts = new Map([
  ["온유 브랜드/코스메틱/온유 수분 진정 크림 50ml", "onyou-moisture-cream"],
  ["온유 브랜드/코스메틱/온유 비건 선크림", "onyou-vegan-sunscreen"],
  ["온유 브랜드/식품/그래놀라 바 12입", "granola-bar-12-pack"],
  ["하루 코스메틱/코스메틱/하루 마스크팩", "haru-sheet-mask"],
  ["하루 코스메틱/코스메틱/하루 앰플", "haru-ampoule"],
  ["하루 코스메틱/코스메틱/한정 수량 세럼", "haru-limited-serum"],
]);

export function generatedBrandProductArtwork(shopName: string, product: { name: string; category: string }) {
  const filename = generatedProducts.get(`${shopName}/${product.category}/${product.name}`);
  if (!filename) return undefined;

  return {
    cover: `/images/brand-products/${filename}-cover.webp`,
    detail: `/images/brand-products/${filename}-detail.webp`,
  };
}
