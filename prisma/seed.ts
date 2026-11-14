import { PrismaClient, Role, FacilityType, FacilityStatus, CommissionType, FacilityOperation } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 운영 DB 보호: 시드는 알려진 비밀번호(password1234)의 관리자 계정을 만들기 때문에 배포 환경에서는 막는다.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    console.error("배포 환경(NODE_ENV=production)에서는 시드를 실행할 수 없습니다. 꼭 필요하면 ALLOW_SEED=true 를 지정하세요.");
    process.exit(1);
  }
  const pw = await bcrypt.hash("password1234", 10);

  // ---------------- 계정 ----------------
  const admin = await prisma.user.upsert({
    where: { email: "admin@sellerbricks.kr" },
    update: {},
    create: {
      email: "admin@sellerbricks.kr", passwordHash: pw, role: Role.SUPER_ADMIN, profileImageIndex: 1,
      profile: { create: { name: "최고관리자", companyName: "스토리지마켓" } },
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@sellerbricks.kr" },
    update: {},
    create: {
      email: "manager@sellerbricks.kr", passwordHash: pw, role: Role.MANAGER, profileImageIndex: 13,
      profile: { create: { name: "창고 운영 매니저", companyName: "스토리지마켓" } },
    },
  });

  // 창고(스튜디오) 관리자 계정은 없다 (2026-11-14) — 창고는 본사(최고관리자 · 담당 매니저)가 운영한다.

  const seller = await prisma.user.upsert({
    where: { email: "seller@sellerbricks.kr" },
    update: {},
    create: {
      email: "seller@sellerbricks.kr", passwordHash: pw, role: Role.SELLER, profileImageIndex: 16,
      profile: { create: { name: "테스트셀러", companyName: "셀러스토어", phone: "010-1234-5678", livePlatforms: ["SELLERBRICKS", "CLICKMATE", "GRIP"] } },
    },
  });
  // 셀러가 쓰는 판매 플랫폼 (가입 시 필수) — 예전 시드로 만든 계정도 채운다
  await prisma.profile.updateMany({ where: { userId: seller.id, livePlatforms: { isEmpty: true } }, data: { livePlatforms: ["SELLERBRICKS", "CLICKMATE", "GRIP"] } });

  // 창고 운영 매니저 수수료 5%
  await prisma.managerCommissionRule.upsert({
    where: { managerId: manager.id },
    update: {},
    create: { managerId: manager.id, commissionType: CommissionType.PERCENT, commissionValue: 5 },
  });

  // ---------------- 창고(스튜디오) ----------------
  // 이용료는 무료 (basePrice 0). 직영 2곳 + 제휴 1곳
  const facData = [
    { name: "서울 성수 라이브 창고", type: FacilityType.WAREHOUSE, region: "서울", address: "서울 성동구 성수일로 77", equipment: "조명, 짐벌, 마이크, 무대", basePrice: 0, rating: 4.8, operationType: FacilityOperation.DIRECT },
    { name: "남양주 패션 스튜디오", type: FacilityType.STUDIO, region: "경기", address: "경기 남양주시 다산순환로 20", equipment: "행거, 전신거울, 조명세트, 배경지", basePrice: 0, rating: 4.6, operationType: FacilityOperation.DIRECT },
    {
      name: "부산 식품 전문 창고", type: FacilityType.WAREHOUSE, region: "부산", address: "부산 해운대구 센텀중앙로 90", equipment: "냉장쇼케이스, 조리대, 조명", basePrice: 0, rating: 4.5,
      operationType: FacilityOperation.PARTNER, partnerName: "센텀콜드체인", partnerContactName: "김제휴", partnerContactPhone: "051-000-0000",
      bankName: "부산은행", bankAccount: "1012020303", accountHolder: "센텀콜드체인",
    },
  ];

  // 예시 사진은 저장소 안의 이미지를 쓴다 (외부 사진 사이트가 느리거나 막혀도 화면이 깨지지 않게)
  const FAC_IMAGES = ["/images/facility-banners/warehouse-premium.webp", "/images/facility-banners/creator-studio.webp", "/images/facility-banners/smart-fulfillment.webp", "/images/facility-banners/live-studio.webp", "/images/facility-banners/beauty-live.webp"];
  const facImg = (n: number) => FAC_IMAGES[n % FAC_IMAGES.length];
  const PRODUCT_IMAGE = "/images/placeholder/product.svg";
  const facilities: Awaited<ReturnType<typeof prisma.facility.create>>[] = [];
  for (const [fi, f] of facData.entries()) {
    const fac = await prisma.facility.create({
      data: {
        ...f, ownerId: admin.id, status: FacilityStatus.APPROVED,
        description: `${f.name} 입니다. 라이브 커머스에 최적화된 공간과 장비를 제공합니다.`,
        openTime: "09:00", closeTime: "22:00",
        thumbnailUrl: facImg(fi),
        images: { create: [0, 1, 2].map((i) => ({ url: facImg(fi + i), sortOrder: i })) },
        slots: { create: [1, 2, 3, 4, 5].flatMap((wd) => [
          { weekday: wd, startTime: "10:00", endTime: "12:00" },
          { weekday: wd, startTime: "14:00", endTime: "16:00" },
          { weekday: wd, startTime: "19:00", endTime: "21:00" },
        ]) },
      },
    });
    facilities.push(fac);
    // 창고 운영 매니저 연결: 첫번째/세번째 창고(스튜디오)를 manager 가 운영
    if (f.region !== "경기") {
      await prisma.managerFacility.create({ data: { managerId: manager.id, facilityId: fac.id } });
    }
  }

  // ---------------- 상품 ----------------
  const products = [
    { name: "제주 감귤 3kg", category: "식품", sku: "FD-001", salePrice: 19900, consumerPrice: 25000, stock: 200, commissionType: CommissionType.PERCENT, commissionValue: 12 },
    { name: "프리미엄 한우 세트", category: "식품", sku: "FD-002", salePrice: 159000, consumerPrice: 200000, stock: 50, commissionType: CommissionType.PERCENT, commissionValue: 8 },
    { name: "여성 니트 가디건", category: "의류", sku: "FS-001", salePrice: 39000, consumerPrice: 59000, stock: 120, commissionType: CommissionType.PERCENT, commissionValue: 20 },
    { name: "홈트레이닝 밴드", category: "스포츠·레저", sku: "SP-001", salePrice: 12900, consumerPrice: 19000, stock: 300, commissionType: CommissionType.FIXED, commissionValue: 3000 },
    { name: "캠핑 테이블", category: "스포츠·레저", sku: "LS-001", salePrice: 49000, consumerPrice: 79000, stock: 80, commissionType: CommissionType.PERCENT, commissionValue: 15 },
  ];

  // 식품→부산창고+성수창고, 패션→남양주, 그 외→성수
  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, category: p.category,
        description: `${p.name} 상품입니다.`,
        thumbnailUrl: PRODUCT_IMAGE,
        images: { create: [{ url: PRODUCT_IMAGE, sortOrder: 0 }] },
        options: p.category === "의류"
          ? { create: [
              { name: "사이즈", value: "S", stock: 40 },
              { name: "사이즈", value: "M", stock: 50 },
              { name: "사이즈", value: "L", stock: 30 },
            ] }
          : undefined,
      },
    });

    const targetFacilities =
      p.category === "식품" ? facilities.filter((f) => f.region === "부산" || f.region === "서울")
      : p.category === "의류" ? facilities.filter((f) => f.region === "경기")
      : facilities.filter((f) => f.region === "서울");

    for (const fac of targetFacilities) {
      await prisma.facilityProduct.create({
        data: {
          facilityId: fac.id, productId: product.id,
          salePrice: p.salePrice, consumerPrice: p.consumerPrice, stock: p.stock,
          commissionType: p.commissionType, commissionValue: p.commissionValue,
          shippingInfo: "3,000원 (5만원 이상 무료)",
        },
      });
    }
  }

  // ---------------- 브랜드사 · 브랜드샵 (발주 · 샘플 체험용) ----------------
  const brandUser = await prisma.user.upsert({
    where: { email: "brand@sellerbricks.kr" },
    update: {},
    create: {
      email: "brand@sellerbricks.kr", passwordHash: pw, role: Role.BRAND_ADMIN, profileImageIndex: 7,
      profile: { create: { name: "브랜드 담당자", companyName: "온유 브랜드", phone: "010-2222-3333", categories: ["코스메틱", "식품"] } },
    },
  });
  const shop = await prisma.brandShop.upsert({
    where: { ownerId: brandUser.id },
    update: {},
    create: {
      ownerId: brandUser.id, name: "온유 브랜드", tagline: "피부와 식탁을 위한 정직한 브랜드", status: "APPROVED",
      description: "라이브 판매에 어울리는 스킨케어와 건강 간식을 공급합니다.", categories: ["코스메틱", "식품"],
      businessNumber: "123-45-67890", ceoName: "브랜드 담당자", csPhone: "1588-0000", returnAddress: "서울 마포구 월드컵북로 1",
      bankName: "국민은행", bankAccount: "123456-01-000000", accountHolder: "온유브랜드",
    },
  });
  if (!(await prisma.brandProduct.count({ where: { shopId: shop.id } }))) {
    await prisma.brandProduct.createMany({ data: [
      { shopId: shop.id, name: "온유 수분 진정 크림 50ml", category: "코스메틱", subCategory: "스킨케어", supplyPrice: 14000, consumerPrice: 32000, stock: 500, samplePrice: 0, sampleStock: 50, sampleLimitPerBuyer: 1, options: "용량:50ml,100ml", allowDropship: true, allowWarehouse: false, leadDays: 2 },
      { shopId: shop.id, name: "온유 비건 선크림", category: "코스메틱", subCategory: "스킨케어", supplyPrice: 11000, consumerPrice: 25000, stock: 300, samplePrice: 3000, sampleStock: 30, sampleLimitPerBuyer: 2, allowDropship: true, allowWarehouse: true, leadDays: 1 },
      { shopId: shop.id, name: "그래놀라 바 12입", category: "식품", subCategory: "과자·간식", supplyPrice: 9000, consumerPrice: 19800, stock: 800, samplePrice: null, sampleStock: 0, allowDropship: false, allowWarehouse: true, leadDays: 2 },
    ] });
  }
  // 셀러가 고른 위탁배송 상품 (주문서에 바로 담을 수 있다)
  const cream = await prisma.brandProduct.findFirst({ where: { shopId: shop.id, name: "온유 수분 진정 크림 50ml" }, select: { id: true } });
  if (cream) {
    await prisma.sellerBrandProduct.upsert({
      where: { sellerId_brandProductId: { sellerId: seller.id, brandProductId: cream.id } },
      update: {},
      create: { sellerId: seller.id, brandProductId: cream.id, salePrice: 29000 },
    });
  }

  // ---------------- 플랫폼 기본 수수료율 (창고(스튜디오) 예약 정산용) ----------------
  if (!(await prisma.commissionRule.findFirst({ where: { scope: "PLATFORM" } }))) {
    await prisma.commissionRule.create({ data: { scope: "PLATFORM", commissionType: "PERCENT", commissionValue: 10 } });
  }

  console.log("Seed 완료:", { brand: brandUser.email, admin: admin.email, manager: manager.email, seller: seller.email, facilities: facilities.length });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
