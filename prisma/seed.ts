import { PrismaClient, Role, FacilityType, FacilityStatus, CommissionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pw = await bcrypt.hash("password1234", 10);

  // ---------------- 계정 ----------------
  const admin = await prisma.user.upsert({
    where: { email: "admin@sellerbricks.kr" },
    update: {},
    create: {
      email: "admin@sellerbricks.kr", passwordHash: pw, role: Role.SUPER_ADMIN, profileImageIndex: 1,
      profile: { create: { name: "최고관리자", companyName: "셀러브릭스" } },
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@sellerbricks.kr" },
    update: {},
    create: {
      email: "manager@sellerbricks.kr", passwordHash: pw, role: Role.MANAGER, profileImageIndex: 13,
      profile: { create: { name: "중간관리자", companyName: "브릭스파트너스" } },
    },
  });

  const facilityAdmin = await prisma.user.upsert({
    where: { email: "facility@sellerbricks.kr" },
    update: {},
    create: {
      email: "facility@sellerbricks.kr", passwordHash: pw, role: Role.FACILITY_ADMIN, profileImageIndex: 4,
      profile: { create: { name: "시설 운영자", companyName: "성수라이브" } },
    },
  });

  const seller = await prisma.user.upsert({
    where: { email: "seller@sellerbricks.kr" },
    update: {},
    create: {
      email: "seller@sellerbricks.kr", passwordHash: pw, role: Role.SELLER, profileImageIndex: 16,
      profile: { create: { name: "테스트셀러", companyName: "셀러스토어", phone: "010-1234-5678" } },
    },
  });

  // 중간관리자 수수료 5%
  await prisma.managerCommissionRule.upsert({
    where: { managerId: manager.id },
    update: {},
    create: { managerId: manager.id, commissionType: CommissionType.PERCENT, commissionValue: 5 },
  });

  // ---------------- 시설 ----------------
  const facData = [
    { name: "서울 성수 라이브 창고", type: FacilityType.WAREHOUSE, region: "서울", address: "서울 성동구 성수일로 77", equipment: "조명, 짐벌, 마이크, 무대", basePrice: 150000, rating: 4.8 },
    { name: "남양주 패션 스튜디오", type: FacilityType.STUDIO, region: "경기", address: "경기 남양주시 다산순환로 20", equipment: "행거, 전신거울, 조명세트, 배경지", basePrice: 120000, rating: 4.6 },
    { name: "부산 식품 전문 창고", type: FacilityType.WAREHOUSE, region: "부산", address: "부산 해운대구 센텀중앙로 90", equipment: "냉장쇼케이스, 조리대, 조명", basePrice: 100000, rating: 4.5 },
  ];

  const facilities: Awaited<ReturnType<typeof prisma.facility.create>>[] = [];
  for (const f of facData) {
    const fac = await prisma.facility.create({
      data: {
        ...f, ownerId: facilityAdmin.id, status: FacilityStatus.APPROVED,
        description: `${f.name} 입니다. 라이브 커머스에 최적화된 공간과 장비를 제공합니다.`,
        openTime: "09:00", closeTime: "22:00",
        thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(f.name)}/800/500`,
        images: { create: [0, 1, 2].map((i) => ({ url: `https://picsum.photos/seed/${encodeURIComponent(f.name)}${i}/1000/600`, sortOrder: i })) },
        slots: { create: [1, 2, 3, 4, 5].flatMap((wd) => [
          { weekday: wd, startTime: "10:00", endTime: "12:00" },
          { weekday: wd, startTime: "14:00", endTime: "16:00" },
          { weekday: wd, startTime: "19:00", endTime: "21:00" },
        ]) },
      },
    });
    facilities.push(fac);
    // 중간관리자 연결: 첫번째/세번째 시설을 manager 가 영업
    if (f.region !== "경기") {
      await prisma.managerFacility.create({ data: { managerId: manager.id, facilityId: fac.id } });
    }
  }

  // ---------------- 상품 ----------------
  const products = [
    { name: "제주 감귤 3kg", category: "식품", sku: "FD-001", salePrice: 19900, consumerPrice: 25000, stock: 200, commissionType: CommissionType.PERCENT, commissionValue: 12 },
    { name: "프리미엄 한우 세트", category: "식품", sku: "FD-002", salePrice: 159000, consumerPrice: 200000, stock: 50, commissionType: CommissionType.PERCENT, commissionValue: 8 },
    { name: "여성 니트 가디건", category: "패션", sku: "FS-001", salePrice: 39000, consumerPrice: 59000, stock: 120, commissionType: CommissionType.PERCENT, commissionValue: 20 },
    { name: "홈트레이닝 밴드", category: "스포츠", sku: "SP-001", salePrice: 12900, consumerPrice: 19000, stock: 300, commissionType: CommissionType.FIXED, commissionValue: 3000 },
    { name: "캠핑 테이블", category: "레저", sku: "LS-001", salePrice: 49000, consumerPrice: 79000, stock: 80, commissionType: CommissionType.PERCENT, commissionValue: 15 },
  ];

  // 식품→부산창고+성수창고, 패션→남양주, 그 외→성수
  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, category: p.category,
        description: `${p.name} 상품입니다.`,
        thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(p.name)}/600/600`,
        images: { create: [{ url: `https://picsum.photos/seed/${encodeURIComponent(p.name)}d/800/800`, sortOrder: 0 }] },
        options: p.category === "패션"
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
      : p.category === "패션" ? facilities.filter((f) => f.region === "경기")
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

  // ---------------- 알림톡 템플릿 ----------------
  await prisma.notificationTemplate.upsert({
    where: { code: "LIVE_OPEN" },
    update: {},
    create: {
      code: "LIVE_OPEN", name: "라이브 시작 안내",
      content: "[셀러 브릭스] 오늘 오후 8시 라이브 방송이 시작됩니다. 아래 링크에서 상품번호로 간편하게 구매하세요. {방송링크}",
    },
  });

  // ---------------- 카카오 채널 (셀러) ----------------
  const channel = await prisma.kakaoChannel.create({
    data: {
      sellerId: seller.id, channelName: "셀러스토어 채널", plusFriendId: "@sellerstore",
      subscribers: { create: [
        { name: "구매자A", phone: "010-1111-2222" },
        { name: "구매자B", phone: "010-3333-4444" },
        { name: "구매자C", phone: "010-5555-6666" },
      ] },
    },
  });

  console.log("Seed 완료:", { admin: admin.email, manager: manager.email, facilityAdmin: facilityAdmin.email, seller: seller.email, facilities: facilities.length, channel: channel.channelName });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
