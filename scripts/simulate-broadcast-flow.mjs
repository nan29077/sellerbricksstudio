// 셀러 방송 흐름 · 대시보드 메뉴 · 브랜드샵 영상 · 문의하기 E2E 시뮬레이션 (2026-11-14)
//  [1] 메뉴 · 화면 연결: 셀러 · 브랜드 대시보드 메뉴, 예전 주소 → 대시보드 안 화면, 공개 화면은 메인 화면 틀
//  [2] 브랜드샵 라이브 커머스 영상: 브랜드 계정이 링크 입력 → 브랜드샵 화면 왼쪽 플레이어
//  [3] 상품 선택 → 공간 예약 → 승인 시 방송 시연품 자동 요청(D-2) → 브랜드 발송 → 공간 도착 확인 · 일정 변경 · 취소
//  [4] 문의하기: 챗봇 · 비회원 1:1 문의 · 최고관리자 답변/템플릿/상태 · 추가 문의
// 실행: 개발 서버 + 시드 DB. SIM_BASE=http://localhost:3008 node scripts/simulate-broadcast-flow.mjs
//  (PC 작업본의 플레이어까지 확인하려면 메인 플레이어 파일이 있는 작업본 서버에서 SIM_PLAYER=1)
// ⚠ 테스트 데이터를 만듭니다. 운영 DB에서는 실행하지 마세요.
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
const BASE = process.env.SIM_BASE ?? "http://localhost:3007";
const PLAYER = process.env.SIM_PLAYER === "1";
let pass = 0, failN = 0; const fails = [];
const ok = (cond, name, extra) => { if (cond) { pass++; console.log("  ✔", name); } else { failN++; fails.push(name); console.log("  ✘", name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); } };

class Client {
  constructor() { this.jar = {}; }
  cookie() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.jar[kv.slice(0, i)] = kv.slice(i + 1); } }
  async req(method, path, body) {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { cookie: this.cookie(), ...(body !== undefined && { "content-type": "application/json" }) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    this.store(res);
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, ...json };
  }
  async login(email, password = "password1234") {
    const csrf = await this.req("GET", "/api/auth/csrf");
    const res = await fetch(BASE + "/api/auth/callback/credentials", { method: "POST", redirect: "manual", headers: { cookie: this.cookie(), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, json: "true" }) });
    this.store(res);
    return this.req("GET", "/api/me");
  }
  async page(path) { const r = await fetch(BASE + path, { headers: { cookie: this.cookie() }, redirect: "manual" }); return { status: r.status, location: r.headers.get("location") ?? "", text: await r.text() }; }
}
const weekday = (n) => { const d = new Date(Date.now() + 9 * 3600000); d.setUTCDate(d.getUTCDate() + n); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const kst = (day, hm) => new Date(`${day}T${hm}:00+09:00`);
const redirectTo = (p, re) => (p.status >= 300 && p.status < 400 && re.test(p.location)) || new RegExp(`NEXT_REDIRECT[^"]*${re.source}`).test(p.text);

async function main() {
  await db.rateLimit.deleteMany({}).catch(() => {});
  const stamp = Date.now();
  const admin = new Client(), seller = new Client(), brand = new Client(), guest = new Client();
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  ok((await seller.login("seller@sellerbricks.kr")).data?.user?.role === "SELLER", "셀러 로그인");
  ok((await brand.login("brand@sellerbricks.kr")).data?.user?.role === "BRAND_ADMIN", "브랜드 로그인");
  const sellerUser = await db.user.findUnique({ where: { email: "seller@sellerbricks.kr" } });
  const brandUser = await db.user.findUnique({ where: { email: "brand@sellerbricks.kr" } });
  const myShop = await db.brandShop.findFirst({ where: { OR: [{ ownerId: brandUser.id }, { members: { some: { userId: brandUser.id } } }] } });

  console.log("\n[1] 대시보드 메뉴 · 화면 연결");
  let pg = await seller.page("/seller/dashboard");
  ok(pg.status === 200 && ["① 방송 상품 고르기", "② 공간 예약 · 방송", "③ 판매 · 주문서", "④ 정산"].every((t) => pg.text.includes(t)), "셀러 메뉴: 상품 고르기 → 공간 예약 → 주문서 → 정산 순서");
  ok(!pg.text.includes("창고(스튜디오) 예약 현황") && !pg.text.includes("스토리지마켓 창고 상품"), "셀러 메뉴: 예전 창고 운영식 메뉴 없음");
  ok(pg.text.includes("방송 준비 흐름") && pg.text.includes("시연품 준비"), "셀러 대시보드: 방송 준비 흐름 4단계");
  for (const [path, title] of [["/seller/brands", "브랜드샵"], ["/seller/brand-products", "내 방송 상품"], ["/seller/brand-messages", "브랜드 문의"], ["/seller/brand-requests", "샘플 · 시연품 신청 내역"], ["/seller/brand-favorites", "찜한 브랜드 상품"], ["/seller/bookings/new", "방송 예약하기"], ["/seller/farm-reservations", "찜 · 문의한 공간"]]) {
    pg = await seller.page(path);
    ok(pg.status === 200 && pg.text.includes(title), `셀러 대시보드 안 화면: ${path}`, { status: pg.status });
  }
  for (const [old, now] of [["/brand-messages?t=x", /\/seller\/brand-messages\?t=x/], ["/brand-requests?kind=DISPLAY", /\/seller\/brand-requests\?kind=DISPLAY/], ["/brand-favorites", /\/seller\/brand-favorites/]]) {
    pg = await seller.page(old);
    ok(redirectTo(pg, now), `예전 주소 ${old} → 셀러 대시보드 안`, { status: pg.status, loc: pg.location });
  }
  pg = await admin.page("/brand-messages");
  ok(redirectTo(pg, /\/facility\/brand-messages/), "최고관리자: 예전 브랜드 문의 주소 → 창고 운영 화면 안", { status: pg.status, loc: pg.location });
  pg = await seller.page(`/seller/brands/${myShop.id}`);
  ok(pg.status === 200 && pg.text.includes(myShop.name) && pg.text.includes(`/seller/brands/${myShop.id}?product=`), "셀러 대시보드 안 브랜드샵 (상품 링크도 대시보드 안)");
  pg = await brand.page("/brand/dashboard");
  ok(pg.status === 200 && !pg.text.includes("/brand/explore") && !pg.text.includes(">브랜드샵 둘러보기<"), "브랜드 메뉴: 브랜드샵 둘러보기 없음");
  ok(["① 내 브랜드샵", "② 셀러 요청", "③ 발주 · 출고", "④ 정산 · 분석", "방송 시연품 요청"].every((t) => pg.text.includes(t)), "브랜드 메뉴: 샵 → 셀러 요청 → 발주 · 출고 → 정산");
  ok((await brand.page("/brand/explore")).status === 404, "브랜드: 예전 브랜드샵 둘러보기 주소 없음");
  pg = await brand.page("/brand/preview");
  ok(redirectTo(pg, new RegExp(`/brands/${myShop.id}`)), "브랜드: 샵 미리보기 주소 → 내 브랜드샵 (메뉴에서는 뺌)", { status: pg.status, loc: pg.location });
  pg = await guest.page("/login");
  ok(pg.status === 200 && pg.text.includes("테스트 계정으로 바로 로그인") && pg.text.includes("셀러로 로그인"), "로그인: 테스트 계정 버튼이 처음부터 함께 그려짐 (늦게 뜨지 않음)");
  for (const p of ["/facilities", "/intro", "/notices", "/terms", "/privacy", `/brands/${myShop.id}`]) {
    pg = await guest.page(p);
    ok(pg.status === 200 && pg.text.includes("studio-content"), `공개 화면 ${p}: 메인과 같은 화면 틀`, { status: pg.status });
  }
  const fac = await db.facility.findFirst({ where: { status: "APPROVED" } });
  pg = await guest.page(`/facilities/${fac.id}`);
  ok(pg.status === 200 && pg.text.includes("studio-content") && pg.text.includes(fac.name), "공간 상세: 메인과 같은 화면 틀");
  if (PLAYER) {
    pg = await guest.page("/support");
    ok(pg.text.includes("home-broadcast-heading"), "문의 화면에도 왼쪽 라이브 커머스 플레이어");
    pg = await guest.page("/facilities");
    ok(pg.text.includes("home-broadcast-heading"), "공간 찾기 화면에도 왼쪽 플레이어");
  }

  console.log("\n[2] 브랜드샵 라이브 커머스 영상 (브랜드 계정 입력)");
  await db.brandShopVideo.deleteMany({ where: { title: { startsWith: "시뮬" } } });
  const V = "/api/brand/videos";
  let r = await seller.req("POST", V, { title: "시뮬 셀러", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 403, "셀러는 브랜드 영상 입력 불가", r);
  r = await brand.req("POST", V, { title: "시뮬 위험", url: "javascript:alert(1)" });
  ok(r.status === 400, "위험한 주소 거절", r);
  r = await brand.req("POST", V, { title: "", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 400, "제목 없으면 거절", r);
  r = await brand.req("POST", V, { title: `시뮬 브랜드 라이브 다시보기 ${stamp}`, caption: "그립 라이브", url: "https://www.youtube.com/watch?v=abcdefghijk", sortOrder: -5 });
  const v1 = r.data?.id; ok(r.status === 201 && v1, "브랜드: 라이브 커머스 영상 넣기", r);
  r = await brand.req("POST", V, { title: `시뮬 브랜드 숨김 ${stamp}`, url: "https://vimeo.com/76979871", isVisible: false });
  const v2 = r.data?.id; ok(r.status === 201, "브랜드: 숨긴 영상 넣기", r);
  r = await brand.req("POST", V, { shopId: "someone-else", title: "시뮬 남의 샵", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 404, "브랜드: 다른 브랜드샵에는 넣을 수 없음", r);
  r = await brand.req("GET", V);
  ok(r.ok && r.data.some((x) => x.id === v1 && x.kind === "youtube"), "브랜드: 영상 목록 · 재생 방식 판별", r);
  pg = await brand.page("/brand/shop");
  ok(pg.status === 200 && pg.text.includes("브랜드샵 라이브 커머스 영상"), "샵 꾸미기 화면에 영상 입력란");
  pg = await admin.page(`/admin/brands/${myShop.id}`);
  ok(pg.status === 200 && pg.text.includes("브랜드샵 라이브 커머스 영상"), "최고관리자 브랜드 관리 화면에서도 영상 관리");
  if (PLAYER) {
    pg = await guest.page(`/brands/${myShop.id}`);
    ok(pg.text.includes(`시뮬 브랜드 라이브 다시보기 ${stamp}`) && pg.text.includes(`${myShop.name} 라이브 커머스`), "브랜드샵 왼쪽 플레이어: 그 브랜드의 영상");
    ok(pg.text.includes("data-studio-background") && /\[data-studio-background\]\{background:/.test(pg.text), "브랜드샵: 양옆 여백을 샵 꾸미기 배경으로");
    ok(pg.text.includes(`"name":"${myShop.name}"`) || pg.text.includes(myShop.name), "브랜드샵: 위쪽 머리글에 브랜드 로고 · 이름");
    ok(!pg.text.includes(`시뮬 브랜드 숨김 ${stamp}`), "숨긴 영상은 안 보임");
  }
  const other = await db.brandShop.findFirst({ where: { status: "APPROVED", id: { not: myShop.id }, videos: { none: {} } } });
  if (PLAYER && other) {
    pg = await guest.page(`/brands/${other.id}`);
    ok(pg.text.includes("라이브 커머스 영상이 곧 올라와요") && !pg.text.includes(`시뮬 브랜드 라이브 다시보기 ${stamp}`), "영상이 없는 브랜드샵: 메인 영상 대신 안내 (다른 브랜드 영상 안 섞임)");
  }
  r = await brand.req("PATCH", V, { id: v2, isVisible: true });
  ok(r.ok && r.data.isVisible, "숨김 해제", r);
  r = await seller.req("DELETE", `${V}?id=${v2}`);
  ok(r.status === 403, "셀러는 영상 삭제 불가", r);
  r = await brand.req("DELETE", `${V}?id=${v2}`);
  ok(r.ok && !(await db.brandShopVideo.findUnique({ where: { id: v2 } })), "영상 삭제", r);

  console.log("\n[3] 상품 선택 → 공간 예약 → 방송 시연품 (D-2)");
  // 셀러가 고른 판매 가능한 브랜드 상품 하나 준비
  const product = await db.brandProduct.findFirst({ where: { isActive: true, allowDropship: true, shop: { status: "APPROVED", ownerId: brandUser.id } }, orderBy: { createdAt: "asc" } })
    ?? await db.brandProduct.findFirst({ where: { isActive: true, allowDropship: true, shop: { status: "APPROVED" } } });
  await db.brandPartner.deleteMany({ where: { shopId: product.shopId, userId: sellerUser.id, status: "BLOCKED" } });
  await db.sellerBrandProduct.upsert({ where: { sellerId_brandProductId: { sellerId: sellerUser.id, brandProductId: product.id } }, update: { isActive: true }, create: { sellerId: sellerUser.id, brandProductId: product.id, salePrice: product.supplyPrice + 5000 } });
  await db.brandProduct.update({ where: { id: product.id }, data: { options: "", optionVariants: [], leadDays: 2, stock: { increment: 50 } } });
  r = await seller.req("GET", "/api/seller/brand-listings");
  ok(r.ok && r.data.some((x) => x.brandProductId === product.id && x.imageUrl), "예약 화면: 내 방송 상품 목록 (사진 포함)", r.data?.slice?.(0, 1));
  const space = await db.facility.findFirst({ where: { status: "APPROVED", autoApprove: false }, orderBy: { createdAt: "asc" } }) ?? fac;
  // 빈 날짜를 찾아 예약 (다시 돌려도 겹치지 않게)
  const book = async (hm, extra, from = 8) => {
    let res, d;
    for (let n = from + (stamp % 7); n < 58; n++) {
      d = weekday(n);
      res = await seller.req("POST", "/api/bookings", { facilityId: space.id, startAt: `${d}T${hm[0]}`, endAt: `${d}T${hm[1]}`, ...extra });
      if (res.status !== 409 || /운영 시간|60일/.test(res.error ?? "")) break;
    }
    return { res, d };
  };
  r = await seller.req("POST", "/api/bookings", { facilityId: space.id, startAt: `${weekday(1)}T10:00`, endAt: `${weekday(1)}T12:00`, brandItems: [{ brandProductId: product.id, quantity: 1 }] });
  ok(r.status >= 400 && /이후 방송/.test(r.error ?? ""), "방송이 너무 가까우면 시연품을 담을 수 없음 (출고 + 2일 전 도착)", r);
  let made = await book(["10:00", "12:00"], { purpose: "방송 시뮬", brandItems: [{ brandProductId: product.id, quantity: 2 }] });
  const day = made.d; r = made.res;
  ok(r.status === 201, "셀러: 브랜드 상품을 담아 공간 예약", r);
  const bookingId = r.data?.bookings?.[0]?.id;
  let item = await db.bookingBrandItem.findFirst({ where: { bookingId } });
  ok(item && item.quantity === 2 && !item.brandRequestId, "예약에 방송 상품 저장 (승인 전에는 브랜드 요청 없음)", item);
  r = await seller.req("POST", "/api/bookings", { facilityId: space.id, startAt: `${weekday(20)}T10:00`, endAt: `${weekday(20)}T12:00`, brandItems: [{ brandProductId: "not-mine", quantity: 1 }] });
  ok(r.status >= 400, "고르지 않은 상품은 담을 수 없음", r);
  r = await admin.req("PATCH", `/api/bookings/${bookingId}`, { status: "APPROVED" });
  ok(r.ok || r.status === 200, "공간 운영(최고관리자): 예약 승인", r);
  item = await db.bookingBrandItem.findFirst({ where: { bookingId }, include: { brandRequest: true } });
  const due = kst(day, "10:00").getTime() - 48 * 3600000;
  ok(item?.brandRequest?.kind === "DISPLAY" && item.brandRequest.unitPrice === 0 && item.brandRequest.status === "PENDING", "승인 → 브랜드에 방송 시연품 무료 요청 자동 생성", item?.brandRequest);
  ok(item?.dueAt && Math.abs(item.dueAt.getTime() - due) < 60000, "도착 기한 = 방송 2일 전", { dueAt: item?.dueAt, due: new Date(due) });
  pg = await brand.page("/brand/requests?kind=DISPLAY");
  ok(pg.status === 200 && pg.text.includes("방송 장소") && pg.text.includes(space.name), "브랜드: 시연품 요청에 방송 장소 · 일시 · 도착 기한", { status: pg.status });
  const reqId = item.brandRequestId;
  r = await brand.req("POST", "/api/brands", { action: "transition", requestId: reqId, status: "APPROVED" });
  ok(r.ok, "브랜드: 시연품 요청 수락", r);
  const stockBefore = (await db.brandProduct.findUnique({ where: { id: product.id } })).stock;
  r = await brand.req("POST", "/api/brands", { action: "transition", requestId: reqId, status: "SHIPPED", carrier: "CJ대한통운", trackingNumber: "123456789012" });
  ok(r.ok, "브랜드: 시연품 발송 (운송장)", r);
  ok((await db.brandProduct.findUnique({ where: { id: product.id } })).stock === stockBefore - 2, "시연품 발송 → 브랜드 재고에서 2개 차감", { stockBefore });
  pg = await brand.page("/brand/dashboard");
  ok(pg.status === 200 && pg.text.includes("다가오는 방송 시연품"), "브랜드 대시보드: 다가오는 방송 시연품 카드");
  pg = await admin.page("/admin/displays");
  ok(pg.status === 200 && pg.text.includes("방송 시연품 현황") && pg.text.includes(space.name), "최고관리자: 방송 시연품 현황판");
  r = await brand.req("PATCH", `/api/booking-brand-items/${item.id}`, { action: "arrived" });
  ok(r.status === 403, "브랜드는 도착 확인 불가 (받는 공간에서 확인)", r);
  r = await admin.req("PATCH", `/api/booking-brand-items/${item.id}`, { action: "arrived" });
  ok(r.ok && (await db.brandRequest.findUnique({ where: { id: reqId } })).status === "COMPLETED", "공간 운영: 시연품 도착 확인 → 완료", r);
  pg = await seller.page("/seller/bookings");
  ok(pg.status === 200 && pg.text.includes("도착"), "셀러 예약 화면: 시연품 도착 표시");

  // 두 번째 예약: 일정 변경 → 기한 갱신, 취소 → 요청 취소
  made = await book(["14:00", "16:00"], { brandItems: [{ brandProductId: product.id, quantity: 1 }] });
  r = made.res;
  const b2 = r.data?.bookings?.[0]?.id;
  ok(r.status === 201, "두 번째 예약 (일정 변경 · 취소 시험)", r);
  await admin.req("PATCH", `/api/bookings/${b2}`, { status: "APPROVED" });
  r = await seller.req("PATCH", `/api/bookings/${b2}`, { action: "reschedule", startAt: `${weekday(1)}T14:00`, endAt: `${weekday(1)}T16:00` });
  ok(r.status >= 400 && /도착할 시간/.test(r.error ?? ""), "아직 안 보낸 시연품이 있으면 너무 가까운 날로 일정 변경 불가", r);
  let day3 = made.d;
  for (let n = 1; n < 30; n++) { const d = weekday(8 + ((stamp + n * 3) % 48)); if (d !== made.d && !(await db.booking.findFirst({ where: { facilityId: space.id, status: { in: ["PENDING", "APPROVED"] }, startAt: { lt: kst(d, "16:00") }, endAt: { gt: kst(d, "14:00") } } }))) { day3 = d; break; } }
  r = await seller.req("PATCH", `/api/bookings/${b2}`, { action: "reschedule", startAt: `${day3}T14:00`, endAt: `${day3}T16:00` });
  const item2 = await db.bookingBrandItem.findFirst({ where: { bookingId: b2 } });
  ok(r.ok && item2?.dueAt && Math.abs(item2.dueAt.getTime() - (kst(day3, "14:00").getTime() - 48 * 3600000)) < 60000, "일정 변경 → 시연품 도착 기한도 바뀜", { r: r.error, dueAt: item2?.dueAt });
  r = await admin.req("PATCH", `/api/bookings/${b2}`, { status: "CANCELLED", reason: "시뮬 공간 점검" });
  const req2 = item2?.brandRequestId ? await db.brandRequest.findUnique({ where: { id: item2.brandRequestId } }) : null;
  ok(req2?.status === "CANCELLED", "예약 취소 → 시연품 요청도 취소", { r, status: req2?.status });

  console.log("\n[5] 브랜드 상품 등록 — 공급가 · 판매가 · 판매가 정책 · 옵션 조합별 추가금");
  const P = { action: "product", shopId: myShop.id, description: "", imageUrl: "", isActive: true, category: "코스메틱", stock: 200, samplePrice: null, sampleStock: 0, sampleLimitPerBuyer: 1, allowDropship: true, allowWarehouse: false, options: "색상:블랙,화이트|사이즈:S,M" };
  const nm = `시뮬 가격상품 ${stamp}`;
  r = await brand.req("POST", "/api/brands", { ...P, name: nm, supplyPrice: 10000, salePrice: 9000, consumerPrice: 20000 });
  ok(r.status === 400 && /공급가/.test(r.error ?? ""), "판매가 < 공급가 거절", r);
  r = await brand.req("POST", "/api/brands", { ...P, name: nm, supplyPrice: 10000, salePrice: 25000, consumerPrice: 20000 });
  ok(r.status === 400 && /정가/.test(r.error ?? ""), "판매가 > 정가 거절", r);
  r = await brand.req("POST", "/api/brands", { ...P, name: nm, supplyPrice: 10000, consumerPrice: 20000, priceRule: "FIXED" });
  ok(r.status === 400 && /고정/.test(r.error ?? ""), "판매가 고정인데 판매가가 없으면 거절", r);
  r = await brand.req("POST", "/api/brands", { ...P, name: nm, supplyPrice: 10000, salePrice: 15000, consumerPrice: 20000, minSalePrice: 16000 });
  ok(r.status === 400 && /최저 판매가/.test(r.error ?? ""), "판매가 < 최저 판매가 거절", r);
  r = await brand.req("POST", "/api/brands", { ...P, name: nm, supplyPrice: 10000, salePrice: 15000, consumerPrice: 20000, optionVariants: [{ key: "레드 / S", extra: 1000 }] });
  ok(r.status === 400 && /옵션 조합/.test(r.error ?? ""), "옵션에 없는 조합 거절", r);
  r = await brand.req("POST", "/api/brands", { ...P, name: nm, supplyPrice: 10000, salePrice: 15900, consumerPrice: 20000, minSalePrice: 12000, priceRule: "FIXED", taxType: "TAXABLE", manufacturer: "시뮬제조", origin: "대한민국", returnShippingFee: 3000, exchangeShippingFee: 6000,
    optionVariants: [{ key: "화이트 / M", extra: 2000, saleExtra: 3000 }, { key: "블랙 / M", soldOut: true }, { key: "블랙 / S" }] });
  ok(r.status === 201, "공급가 · 판매가 · 정가 · 최저가 · 판매가 고정 · 옵션 조합 · 고시 정보로 등록", r);
  const gp = await db.brandProduct.findUnique({ where: { id: r.data?.id } });
  ok(gp?.salePrice === 15900 && gp.priceRule === "FIXED" && gp.manufacturer === "시뮬제조" && gp.returnShippingFee === 3000, "가격 · 정책 · 고시 정보 저장", gp && { sale: gp.salePrice, rule: gp.priceRule });
  ok(Array.isArray(gp?.optionVariants) && gp.optionVariants.length === 2 && gp.optionVariants.some((v) => v.key === "블랙 / M" && v.soldOut), "옵션 조합: 값 없는 조합은 빼고 저장 (추가금 · 품절만)", gp?.optionVariants);
  pg = await brand.page("/brand/products");
  ok(pg.status === 200 && pg.text.includes("판매가 정책") && pg.text.includes("셀러 마진"), "상품 등록 화면: 가격 섹션 · 마진 계산");
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: gp.id, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 17000 });
  ok(r.status === 400 && /고정/.test(r.error ?? ""), "판매가 고정 상품은 다른 가격으로 가져올 수 없음", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: gp.id, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 15900 });
  ok(r.ok, "고정 판매가로 가져오기", r);
  const lst = await db.sellerBrandProduct.findUnique({ where: { sellerId_brandProductId: { sellerId: sellerUser.id, brandProductId: gp.id } } });
  r = await seller.req("POST", "/api/brand-imports", { action: "seller-update", listingId: lst.id, salePrice: 18000, isActive: true });
  ok(r.status === 400 && /고정/.test(r.error ?? ""), "셀러가 고정 판매가를 바꿀 수 없음", r);
  pg = await guest.page(`/brands/${myShop.id}?product=${gp.id}`);
  ok(pg.status === 200 && pg.text.includes("시뮬제조") && pg.text.includes("반품 배송비"), "상품 화면: 제조사 · 반품 배송비 고시");
  pg = await seller.page(`/seller/brands/${myShop.id}?product=${gp.id}`);
  ok(pg.text.includes("판매가 고정") && pg.text.includes("마진"), "셀러 화면: 판매가 · 할인율 · 마진 · 고정 표시");
  const fresh = await db.brandProduct.findUnique({ where: { id: gp.id } });
  r = await brand.req("POST", "/api/brands", { ...P, name: nm, productId: gp.id, revision: fresh.updatedAt.toISOString(), supplyPrice: 10000, salePrice: 16900, consumerPrice: 20000, minSalePrice: 12000, priceRule: "FIXED",
    optionVariants: [{ key: "화이트 / M", extra: 2000, saleExtra: 3000 }, { key: "블랙 / M", soldOut: true }] });
  ok(r.ok && (await db.sellerBrandProduct.findUnique({ where: { id: lst.id } })).salePrice === 16900, "브랜드가 고정 판매가를 바꾸면 셀러 판매가도 맞춰짐", r);
  const sheetBase = { platform: "GRIP", recipient: "가격시뮬", phone: "010-7000-0001", address: "서울 성동구 왕십리로 2" };
  r = await seller.req("POST", "/api/seller/order-sheets", { method: "EASY_PAY", sheets: [{ ...sheetBase, externalOrderNo: `PX-${stamp}-1`, lines: [{ code: `B-${gp.id}`, optionLabel: "색상:화이트 / 사이즈:M", quantity: 2 }] }] });
  const ord = r.data?.results?.[0]?.orders?.[0];
  ok(r.status === 201 && ord?.total === (10000 + 2000) * 2, "주문서: 옵션 추가 공급가까지 결제 (12,000원 × 2)", r.data?.results?.[0] ?? r);
  r = await seller.req("POST", "/api/seller/order-sheets", { method: "EASY_PAY", sheets: [{ ...sheetBase, externalOrderNo: `PX-${stamp}-2`, lines: [{ code: `B-${gp.id}`, optionLabel: "블랙 / M", quantity: 1 }] }] });
  ok(!r.data?.results?.[0]?.ok && /품절/.test(r.data?.results?.[0]?.error ?? r.error ?? ""), "주문서: 품절 옵션은 낼 수 없음", r.data?.results?.[0] ?? r);
  r = await seller.req("POST", "/api/bookings", { facilityId: space.id, startAt: `${weekday(25)}T19:00`, endAt: `${weekday(25)}T21:00`, brandItems: [{ brandProductId: gp.id, optionLabel: "블랙 / M" }] });
  ok(r.status >= 400 && /품절/.test(r.error ?? ""), "방송 예약: 품절 옵션은 시연품으로 고를 수 없음", r);
  r = await seller.req("POST", "/api/bookings", { facilityId: space.id, startAt: `${weekday(25)}T19:00`, endAt: `${weekday(25)}T21:00`, brandItems: [{ brandProductId: gp.id }] });
  ok(r.status >= 400 && /옵션/.test(r.error ?? ""), "방송 예약: 옵션 상품은 옵션을 골라야 함", r);
  const fixedFp = await db.facilityProduct.findFirst({ where: { brandProductId: gp.id } });
  ok(!fixedFp || fixedFp.salePrice === 16900, "판매가 고정: 스토리지마켓 입고 상품 판매가도 맞춰짐", fixedFp && { sale: fixedFp.salePrice });
  r = await admin.req("POST", "/api/brand-imports", { action: "import", brandProductId: gp.id, target: "FACILITY", fulfillment: "DROPSHIP", salePrice: 18000, facilityId: space.id });
  ok(r.status >= 400 && /고정/.test(r.error ?? ""), "판매가 고정: 입고 상품으로 가져올 때도 고정가만 가능", r);

  console.log("\n[4] 문의하기 (챗봇 · 1:1 · 관리)");
  r = await guest.req("POST", "/api/support/chat", { message: "시연품은 언제 도착해요?" });
  ok(r.ok && /2일|시연품/.test(JSON.stringify(r.data)), "챗봇: 시연품 질문에 답변", r.data);
  r = await guest.req("POST", "/api/support/chat", { message: "상담원 연결해 주세요" });
  ok(r.ok && /문의|상담|연결/.test(JSON.stringify(r.data)), "챗봇: 상담원 연결 안내", r.data);
  const gid = randomUUID();
  r = await guest.req("POST", "/api/support/inquiries", { id: gid, category: "PARTNERSHIP", subject: `시뮬 비회원 문의 ${stamp}`, message: "브랜드 입점 문의드립니다. 연락 부탁드려요.", guestName: "비회원", guestEmail: `sim${stamp}@example.com` });
  ok(r.status === 400, "비회원: 개인정보 동의 없으면 거절", r);
  r = await guest.req("POST", "/api/support/inquiries", { id: gid, category: "PARTNERSHIP", subject: `시뮬 비회원 문의 ${stamp}`, message: "브랜드 입점 문의드립니다. 연락 부탁드려요.", guestName: "비회원", guestEmail: `sim${stamp}@example.com`, agreePrivacy: true, source: "POPUP" });
  const token = r.data?.guestToken;
  ok(r.status === 201 && token, "비회원 1:1 문의 접수 (확인 링크 발급)", r);
  pg = await admin.page("/admin/support");
  ok(pg.status === 200 && pg.text.includes(`시뮬 비회원 문의 ${stamp}`), "최고관리자 문의 관리에 표시");
  r = await admin.req("POST", "/api/admin/support/templates", { title: `시뮬 템플릿 ${stamp}`, body: "안녕하세요, 스토리지마켓입니다.", category: "PARTNERSHIP" });
  const tpl = r.data?.id; ok(r.status === 201, "답변 템플릿 저장", r);
  r = await admin.req("PATCH", `/api/admin/support/${gid}`, { status: "IN_PROGRESS", priority: "HIGH", adminMemo: "시뮬 메모" });
  ok(r.ok, "상태 · 우선순위 · 내부 메모", r);
  r = await admin.req("PATCH", `/api/admin/support/${gid}`, { reply: "안녕하세요, 입점 안내 메일을 보내 드렸습니다." });
  ok(r.ok && (await db.supportInquiry.findUnique({ where: { id: gid } })).status === "ANSWERED", "답변 → 답변 완료", r);
  pg = await guest.page(`/support/guest/${token}`);
  ok(pg.status === 200 && pg.text.includes("입점 안내 메일"), "비회원: 확인 링크에서 답변 보기");
  r = await guest.req("POST", `/api/support/inquiries/${gid}/messages`, { body: "감사합니다. 추가로 수수료도 궁금해요.", token });
  ok(r.ok && (await db.supportInquiry.findUnique({ where: { id: gid } })).status === "OPEN", "비회원 추가 문의 → 다시 새 문의", r);
  r = await guest.req("POST", `/api/support/inquiries/${gid}/messages`, { body: "토큰 없이 보내기 시도", token: "wrong" });
  ok(r.status === 403 || r.status === 404, "확인 링크가 틀리면 추가 문의 불가", r);
  // 채팅형 1:1 상담: 대화 불러오기 · 안 읽은 답변 · 읽음 · 만족도 · 종료
  r = await guest.req("POST", "/api/support/unread", { tokens: [token] });
  ok(r.ok && r.data.count === 0 && r.data.threads?.[0]?.id === gid, "비회원: 이 기기에 저장한 상담 목록 불러오기 (읽은 상태)", r.data);
  await admin.req("PATCH", `/api/admin/support/${gid}`, { reply: "수수료는 판매가의 5%예요." });
  r = await guest.req("POST", "/api/support/unread", { tokens: [token] });
  ok(r.ok && r.data.count === 1 && r.data.threads?.[0]?.unread, "운영팀 답변 → 비회원 안 읽은 답변 1개 (문의하기 버튼 빨간 숫자)", r.data);
  r = await guest.req("GET", `/api/support/inquiries/${gid}?token=${token}`);
  ok(r.ok && r.data.items.some((m) => m.author === "ADMIN" && /5%/.test(m.body)) && r.data.items.filter((m) => m.author === "USER").length >= 2, "채팅 대화 불러오기 (고객 · 운영팀 말풍선)", r.data?.items?.length);
  r = await guest.req("POST", "/api/support/unread", { tokens: [token] });
  ok(r.data?.count === 0, "대화를 열면 읽음 처리", r.data);
  r = await guest.req("GET", `/api/support/inquiries/${gid}?token=wrongtoken12345`);
  ok(r.status === 404, "토큰이 틀리면 대화를 볼 수 없음", r);
  r = await guest.req("PATCH", `/api/support/inquiries/${gid}`, { action: "rate", rating: 5, token });
  ok(r.ok && (await db.supportInquiry.findUnique({ where: { id: gid } })).rating === 5, "상담 만족도 평가 (5점)", r);
  r = await guest.req("PATCH", `/api/support/inquiries/${gid}`, { action: "close", token });
  ok(r.ok && (await db.supportInquiry.findUnique({ where: { id: gid } })).status === "CLOSED", "고객이 '해결됐어요'로 상담 종료", r);
  r = await guest.req("POST", `/api/support/inquiries/${gid}/messages`, { body: "하나만 더 여쭤볼게요, 정산 주기는요?", token });
  ok(r.ok && (await db.supportInquiry.findUnique({ where: { id: gid } })).status === "OPEN", "종료된 상담에 다시 보내면 다시 열림", r);
  r = await admin.req("PATCH", `/api/admin/support/${gid}`, { read: true });
  ok(r.ok && !!(await db.supportInquiry.findUnique({ where: { id: gid } })).adminReadAt, "운영팀이 펼쳐 보면 읽음 표시", r);
  pg = await admin.page("/admin/support?status=rated");
  ok(pg.status === 200 && pg.text.includes("만족도"), "관리 화면: 만족도 평가 탭 · 만족도 KPI");
  // 회원 채팅
  const mid = randomUUID();
  r = await seller.req("POST", "/api/support/inquiries", { id: mid, category: "SPACE_BOOKING", subject: `시뮬 회원 채팅 ${stamp}`, message: "방송 예약 날짜를 바꾸고 싶어요. 어떻게 하나요?", source: "POPUP" });
  ok(r.status === 201, "회원: 1:1 상담 시작", r);
  await admin.req("PATCH", `/api/admin/support/${mid}`, { reply: "예약 · 방송 일정에서 '일정 변경'을 눌러 주세요." });
  r = await seller.req("GET", "/api/support/unread");
  ok(r.ok && r.data.ids.includes(mid), "회원: 안 읽은 답변 표시", r.data);
  r = await seller.req("GET", "/api/support/inquiries");
  ok(r.ok && r.data.some((x) => x.id === mid && x.unread && x.lastFrom === "ADMIN"), "회원 상담 목록: 마지막 메시지 · 안 읽음 표시", r.data?.[0]);
  r = await seller.req("GET", `/api/support/inquiries/${mid}`);
  ok(r.ok && (await seller.req("GET", "/api/support/unread")).data.ids.includes(mid) === false, "회원: 대화를 열면 읽음", r);
  r = await brand.req("GET", `/api/support/inquiries/${mid}`);
  ok(r.status === 404, "다른 회원의 상담은 볼 수 없음", r);
  r = await brand.req("POST", "/api/support/chat", { message: "공간 예약은 어떻게 해요?" });
  ok(r.ok && !(r.data.links ?? []).some((l) => l.href.startsWith("/seller/")), "챗봇: 다른 역할 전용 링크는 숨김 (브랜드에게 셀러 화면 링크 안 보임)", r.data?.links);
  pg = await brand.page("/support");
  ok(pg.status === 200 && !pg.text.includes('href="/seller/bookings/new"'), "고객센터 FAQ: 브랜드 계정에는 셀러 전용 링크 숨김");
  if (tpl) await admin.req("DELETE", `/api/admin/support/templates?id=${tpl}`);
  pg = await admin.page("/api/admin/support/export");
  ok(pg.status === 200 && pg.text.includes(`시뮬 비회원 문의 ${stamp}`), "문의 CSV 내려받기");

  console.log(`\n결과: ${pass} 통과 / ${failN} 실패`);
  if (failN) { console.log("실패:", fails); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
