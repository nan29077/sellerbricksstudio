// 구매자 기능 · 운영 기반 E2E 시뮬레이션 (2026-11-12 밤 추가분)
//  늦은 방송 시작 차단 · 외부 송출 채널 · 쿠폰 결제 · 주문 알림(판매자 · 구매자) · 취소/반품/교환 요청
//  · 알림 설정 · 회원 탈퇴 · 개인정보 파기 · 헬스체크 · 사이트맵/로봇
// 실행: 개발 서버(npm run dev) + DB(시드 완료) 상태에서 `node scripts/simulate-buyer-features.mjs`
// ⚠ 테스트 데이터를 만듭니다. 운영 DB에서는 실행하지 마세요.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const BASE = process.env.SIM_BASE ?? "http://localhost:3007";
let pass = 0, failN = 0; const fails = [];
const ok = (cond, name, extra) => { if (cond) { pass++; console.log("  ✔", name); } else { failN++; fails.push(name); console.log("  ✘", name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); } };

class Client {
  constructor() { this.jar = {}; }
  cookie() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.jar[kv.slice(0, i)] = kv.slice(i + 1); } }
  async req(method, path, body, raw = false) {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { cookie: this.cookie(), ...(body !== undefined && { "content-type": "application/json" }) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    this.store(res);
    if (raw) return res;
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, ...json };
  }
  async login(email, password = "password1234") {
    const csrf = await this.req("GET", "/api/auth/csrf");
    const res = await fetch(BASE + "/api/auth/callback/credentials", { method: "POST", redirect: "manual", headers: { cookie: this.cookie(), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, json: "true" }) });
    this.store(res);
    return this.req("GET", "/api/me");
  }
  // React 가 서버 렌더링 때 글자 사이에 넣는 <!-- --> 표시는 지우고 비교한다
  async page(path) { const r = await this.req("GET", path, undefined, true); return { status: r.status, text: (await r.text()).replace(/<!-- -->/g, "") }; }
}

const stamp = Date.now().toString(36);
async function liveSessionFor(sellerId, title, extra = {}) {
  const s = await db.liveSession.create({
    data: { slug: `sim-${stamp}-${Math.random().toString(36).slice(2, 7)}`, sellerId, title, status: "LIVE", ...extra },
  });
  const mk = (n, price, stock = 50) => db.liveSessionProduct.create({ data: { liveSessionId: s.id, displayNumber: n, nameSnapshot: `${title} 상품${n}`, priceSnapshot: price, stockSnapshot: stock, source: "TEMP_PRODUCT" } });
  const p1 = await mk(1, 10000), p2 = await mk(2, 20000);
  return { s, p1, p2 };
}
const buyer = (phone, slug) => ({ sessionSlug: slug, buyerName: "시뮬구매자", buyerPhone: phone, buyerAddress: "(06236) 서울 강남구 테헤란로 152 101호", method: "CARD", agreePrivacy: true });

async function main() {
  const admin = new Client(), seller = new Client(), guest = new Client(), other = new Client();
  await db.rateLimit.deleteMany({}).catch(() => {});
  console.log("\n[0] 로그인");
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  const me = await seller.login("seller@sellerbricks.kr");
  ok(me.data?.user?.role === "SELLER", "셀러 로그인");
  const sellerUser = await db.user.findUnique({ where: { email: "seller@sellerbricks.kr" } });
  let liveRestore = null;
  if ((await admin.req("GET", "/api/admin/settings")).data?.liveEnabled === false) {
    await admin.req("PATCH", "/api/admin/settings", { liveEnabled: true });
    liveRestore = () => admin.req("PATCH", "/api/admin/settings", { liveEnabled: false });
  }
  try {
    console.log("\n[1] 늦게 시작한 방송 차단");
    const late = await db.liveSession.create({ data: { slug: `sim-late-${stamp}`, sellerId: sellerUser.id, title: "예정 시간 지난 방송", status: "READY", scheduledStart: new Date(Date.now() - 5 * 3600000), scheduledEnd: new Date(Date.now() - 3 * 3600000) } });
    let r = await seller.req("PATCH", `/api/live-sessions/${late.id}/status`, { status: "LIVE" });
    ok(r.status === 409 && /예정 시간/.test(r.error ?? ""), "예정 종료 시각이 지난 방송은 시작 거절", r);
    const onTime = await db.liveSession.create({ data: { slug: `sim-ontime-${stamp}`, sellerId: sellerUser.id, title: "제시간 방송", status: "READY", scheduledEnd: new Date(Date.now() + 2 * 3600000) } });
    r = await seller.req("PATCH", `/api/live-sessions/${onTime.id}/status`, { status: "LIVE" });
    ok(r.ok && r.data?.status === "LIVE", "예정 시간 안의 방송은 정상 시작", r);

    console.log("\n[2] 외부 송출 채널 → 구매자 방송 화면");
    r = await seller.req("POST", "/api/live-sessions", { title: `채널 주소로 만드는 방송 ${stamp}`, snsChannels: [{ type: "YOUTUBE", url: "https://youtu.be/dQw4w9WgXcQ" }, { type: "TIKTOK", url: "" }] });
    const made = r.data;
    const madeCh = made ? await db.streamChannel.findMany({ where: { liveSessionId: made.id } }) : [];
    ok(r.status === 201 && madeCh.length === 1 && madeCh[0].type === "YOUTUBE", "방송 만들 때 채널 주소 저장 (빈 칸은 무시, 자체 송출 채널 없음)", madeCh);
    ok(made && !("selfStreamUrl" in made) && !("catenoidStreamId" in made), "방송 기록에 자체 송출 항목 없음", made && Object.keys(made));
    r = await seller.req("POST", "/api/live-sessions", { title: `잘못된 채널 ${stamp}`, snsChannels: [{ type: "YOUTUBE", url: "https://example.com/x" }] });
    ok(r.status === 400, "방송 만들 때 잘못된 채널 주소 거절", r);
    r = await seller.req("PUT", `/api/live-sessions/${onTime.id}/channels`, { channels: [{ type: "YOUTUBE", url: "https://www.instagram.com/abc" }] });
    ok(r.status === 400, "유튜브 칸에 다른 주소는 거절", r);
    r = await seller.req("PUT", `/api/live-sessions/${onTime.id}/channels`, { channels: [{ type: "ETC", url: "javascript:alert(1)" }] });
    ok(r.status === 400, "javascript: 주소 거절", r);
    r = await seller.req("PUT", `/api/live-sessions/${onTime.id}/channels`, { channels: [{ type: "YOUTUBE", url: "https://www.youtube.com/live/dQw4w9WgXcQ" }, { type: "INSTAGRAM", url: "https://www.instagram.com/sb_live" }] });
    ok(r.ok && r.data.length === 2, "유튜브 · 인스타그램 주소 저장", r);
    r = await other.req("PUT", `/api/live-sessions/${onTime.id}/channels`, { channels: [] });
    ok(r.status === 401 || r.status === 403, "다른 사람은 채널 수정 불가", r.status);
    const lp = await guest.page(`/live/${onTime.slug}`);
    ok(lp.text.includes("youtube-nocookie.com/embed/dQw4w9WgXcQ"), "구매자 화면에 유튜브 영상 표시");
    ok(lp.text.includes("인스타그램에서 보기"), "인스타그램 '앱에서 보기' 버튼 표시");
    ok(!/catenoid|rtmp:\/\//i.test(lp.text), "자체 송출 흔적(송출 주소) 없음");
    ok(/<title>\[LIVE\] 제시간 방송/.test(lp.text), "방송 링크 제목(공유 카드)에 방송 제목 표시");
    r = await seller.req("PUT", `/api/live-sessions/${onTime.id}/channels`, { channels: [{ type: "YOUTUBE", url: "https://www.youtube.com/live/dQw4w9WgXcQ" }, { type: "INSTAGRAM", url: "" }] });
    ok(r.ok && r.data.length === 1 && r.data[0].type === "YOUTUBE", "칸을 비우면 그 채널은 지워짐", r.data);

    console.log("\n[3] 쿠폰 결제 (셀러 부담 · 줄마다 셀러 몫 비례)");
    const { s: S, p1, p2 } = await liveSessionFor(sellerUser.id, `쿠폰 방송 ${stamp}`);
    const code = `SIM${stamp.toUpperCase().slice(-8)}`.slice(0, 20);
    r = await seller.req("POST", "/api/seller/marketing/coupons", { name: "시뮬 10%", code, discountType: "PERCENT", discountValue: 10, minAmount: 10000, maxDiscount: 5000, totalQty: 2, startAt: new Date(Date.now() - 3600000).toISOString(), endAt: new Date(Date.now() + 86400000).toISOString(), isActive: true });
    ok(r.ok, "셀러 쿠폰 만들기", r);
    const items = [{ liveSessionProductId: p1.id, quantity: 1 }, { liveSessionProductId: p2.id, quantity: 1 }];
    r = await guest.req("POST", "/api/coupons/check", { sessionSlug: S.slug, code: code.toLowerCase(), items });
    ok(r.ok && r.data.discount === 3000, "쿠폰 미리 보기: 30,000원의 10% = 3,000원 (소문자 입력도 인식)", r);
    r = await guest.req("POST", "/api/coupons/check", { sessionSlug: S.slug, code: "NOPE-0000", items });
    ok(r.status === 409, "없는 쿠폰 거절", r);
    r = await guest.req("POST", "/api/coupons/check", { sessionSlug: S.slug, code, items: [{ liveSessionProductId: p1.id, quantity: 1 }] });
    ok(r.ok && r.data.discount === 1000, "10,000원 주문 → 1,000원 할인 (최소 금액 딱 맞음)", r);
    const coupon = await db.sellerCoupon.findUnique({ where: { code } });
    await db.userNotification.deleteMany({ where: { userId: sellerUser.id, type: "ORDER" } });
    r = await guest.req("POST", "/api/orders", { ...buyer("010-8800-0001", S.slug), couponCode: code, items });
    ok(r.status === 201, "쿠폰 적용 주문 결제", r);
    const o1 = await db.order.findUnique({ where: { id: r.data?.orderId }, include: { items: { orderBy: { displayNumber: "asc" } } } });
    ok(o1?.discountAmount === 3000 && o1.totalAmount === 27000 && o1.couponCode === code, "주문 할인 3,000원 · 결제 27,000원 저장", o1 && [o1.discountAmount, o1.totalAmount]);
    ok(o1 && o1.items.reduce((s, i) => s + i.discountAmount, 0) === 3000, "줄마다 나눈 할인 합계 = 3,000원", o1?.items.map((i) => i.discountAmount));
    ok(o1 && o1.items.every((i) => i.sellerAmount >= 0 && i.discountAmount <= i.lineTotal), "할인 후 셀러 몫이 음수가 되지 않음", o1?.items.map((i) => [i.sellerAmount, i.discountAmount]));
    ok((await db.sellerCoupon.findUnique({ where: { id: coupon.id } })).usedQty === 1, "쿠폰 사용 수량 1");
    const pay1 = await db.payment.findUnique({ where: { orderId: o1.id } });
    ok(pay1?.amount === 27000 && pay1.status === "PAID", "결제 금액 27,000원", pay1 && [pay1.amount, pay1.status]);

    console.log("\n[4] 주문 알림 (판매자 앱 알림 · 구매자 알림톡)");
    const n1 = await db.userNotification.findFirst({ where: { userId: sellerUser.id, type: "ORDER", title: { contains: o1.orderNo } } });
    ok(!!n1 && /새 주문/.test(n1.title), "셀러에게 새 주문 알림", n1?.title);
    const log1 = await db.notificationLog.findFirst({ where: { templateCode: "ORDER_PAID", recipient: "010-8800-0001" }, orderBy: { createdAt: "desc" } });
    ok(!!log1 && log1.content.includes(o1.orderNo) && log1.content.includes("27,000"), "구매자 주문 완료 알림톡 (주문번호 · 결제금액)", log1?.content);

    console.log("\n[5] 부분 취소 → 실제 낸 금액만 환불 → 전체 취소 → 쿠폰 되돌림");
    const line1 = o1.items[0];
    r = await seller.req("PATCH", `/api/orders/${o1.id}`, { action: "cancel-items", itemIds: [line1.id], reason: "시뮬 부분 취소" });
    ok(r.ok && r.data.refunded === line1.lineTotal - line1.discountAmount, `부분 취소 환불 = ${line1.lineTotal - line1.discountAmount}원 (상품가 - 나눈 할인)`, r);
    const logP = await db.notificationLog.findFirst({ where: { templateCode: "ORDER_CANCELLED", recipient: "010-8800-0001" }, orderBy: { createdAt: "desc" } });
    ok(!!logP && /일부 취소/.test(logP.content), "구매자 부분 취소 알림톡", logP?.content);
    r = await seller.req("PATCH", `/api/orders/${o1.id}`, { action: "cancel-items", itemIds: [o1.items[1].id], reason: "시뮬 전체 취소" });
    const o1b = await db.order.findUnique({ where: { id: o1.id } });
    ok(r.ok && o1b.status === "CANCELLED" && o1b.refundedAmount === o1b.totalAmount, "남은 상품 취소 → 주문 취소 · 환불 합계 = 결제금액", [o1b.status, o1b.refundedAmount, o1b.totalAmount]);
    ok((await db.sellerCoupon.findUnique({ where: { id: coupon.id } })).usedQty === 0, "출고 전 전체 취소 → 쿠폰 사용 수량 되돌림");
    r = await seller.req("PATCH", `/api/orders/${o1.id}`, { status: "CANCELLED", reason: "다시" });
    ok((await db.sellerCoupon.findUnique({ where: { id: coupon.id } })).usedQty === 0, "이미 취소된 주문은 쿠폰을 두 번 되돌리지 않음");

    console.log("\n[6] 쿠폰 수량 · 다른 셀러 방송");
    await db.sellerCoupon.update({ where: { id: coupon.id }, data: { usedQty: 2 } });
    r = await guest.req("POST", "/api/orders", { ...buyer("010-8800-0002", S.slug), couponCode: code, items });
    ok(r.status === 409 && /모두 사용/.test(r.error ?? ""), "수량을 다 쓴 쿠폰 거절", r);
    await db.sellerCoupon.update({ where: { id: coupon.id }, data: { usedQty: 0 } });
    const otherSeller = await db.user.create({ data: { email: `sim-seller-${stamp}@example.com`, passwordHash: await bcrypt.hash("password1234", 10), role: "SELLER", profile: { create: { name: "다른셀러" } } } });
    const { s: S2, p1: q1 } = await liveSessionFor(otherSeller.id, `다른 셀러 방송 ${stamp}`);
    r = await guest.req("POST", "/api/orders", { ...buyer("010-8800-0003", S2.slug), couponCode: code, items: [{ liveSessionProductId: q1.id, quantity: 2 }] });
    ok(r.status === 409, "다른 셀러 방송에서는 쿠폰 사용 불가", r);

    console.log("\n[7] 구매자 취소 · 반품 · 교환 요청");
    r = await guest.req("POST", "/api/orders", { ...buyer("010-8800-0004", S.slug), items: [{ liveSessionProductId: p1.id, quantity: 1 }] });
    const o2 = r.data?.orderId; ok(r.status === 201, "요청 시험용 주문", r);
    r = await guest.req("POST", `/api/orders/${o2}/claims`, { phone: "010-0000-0000", type: "CANCEL", reason: "단순 변심" });
    ok(r.status === 403, "연락처가 다르면 요청 불가", r);
    r = await guest.req("POST", `/api/orders/${o2}/claims`, { phone: "01088000004", type: "RETURN", reason: "단순 변심" });
    ok(r.status === 409, "출고 전 주문은 반품 요청 불가 (취소만)", r);
    r = await guest.req("POST", `/api/orders/${o2}/claims`, { phone: "010-8800-0004", type: "CANCEL", reason: "없는 사유" });
    ok(r.status === 400, "목록에 없는 사유 거절", r);
    r = await guest.req("POST", `/api/orders/${o2}/claims`, { phone: "010-8800-0004", type: "CANCEL", reason: "기타" });
    ok(r.status === 400, "'기타'는 내용 필수", r);
    r = await guest.req("POST", `/api/orders/${o2}/claims`, { phone: "010-8800-0004", type: "CANCEL", reason: "주문 실수 (상품 · 옵션 · 수량)", detail: "수량을 잘못 골랐어요" });
    const c1 = r.data?.id; ok(r.status === 201, "취소 요청 접수", r);
    r = await guest.req("POST", `/api/orders/${o2}/claims`, { phone: "010-8800-0004", type: "CANCEL", reason: "단순 변심" });
    ok(r.status === 409, "확인 중인 요청이 있으면 또 요청 불가", r);
    ok(!!(await db.userNotification.findFirst({ where: { userId: sellerUser.id, title: { contains: "취소 요청" } } })), "셀러에게 요청 알림");
    ok(!!(await db.notificationLog.findFirst({ where: { templateCode: "ORDER_CLAIM_RECEIVED", recipient: "010-8800-0004" } })), "구매자에게 접수 알림톡");
    const sp = await seller.page("/seller/orders?status=claim");
    const o2row = await db.order.findUnique({ where: { id: o2 } });
    ok(sp.status === 200 && sp.text.includes(o2row.orderNo) && sp.text.includes("구매자 주문 취소 요청"), "셀러 주문 화면 '구매자 요청' 탭에 표시");
    const oc = await guest.page(`/order-complete/${o2}`);
    ok(oc.text.includes("판매자 확인 중") && oc.text.includes("판매자 정보") && oc.text.includes("통신판매중개자"), "구매자 주문 화면: 요청 상태 · 판매자 정보 · 중개자 고지");
    r = await other.req("PATCH", `/api/order-claims/${c1}`, { status: "RESOLVED" });
    ok(r.status === 401 || r.status === 403, "관계없는 사람은 답변 불가", r.status);
    r = await seller.req("PATCH", `/api/order-claims/${c1}`, { status: "REJECTED" });
    ok(r.status === 400, "처리 불가는 답변 필수", r);
    r = await seller.req("PATCH", `/api/orders/${o2}`, { status: "CANCELLED", reason: "구매자 요청" });
    ok(r.ok, "셀러가 주문 취소", r);
    r = await seller.req("PATCH", `/api/order-claims/${c1}`, { status: "RESOLVED", answer: "취소해 드렸어요" });
    ok(r.ok, "요청 처리 완료", r);
    ok(!!(await db.notificationLog.findFirst({ where: { templateCode: "ORDER_CLAIM_ANSWERED", recipient: "010-8800-0004" } })), "구매자에게 답변 알림톡");
    r = await seller.req("PATCH", `/api/order-claims/${c1}`, { status: "RESOLVED" });
    ok(r.status === 409, "이미 처리한 요청은 다시 처리 불가", r);

    r = await guest.req("POST", "/api/orders", { ...buyer("010-8800-0005", S.slug), items: [{ liveSessionProductId: p2.id, quantity: 1 }] });
    const o3 = r.data?.orderId;
    r = await seller.req("PATCH", `/api/orders/${o3}`, { status: "SHIPPED", carrier: "CJ대한통운", trackingNumber: "123456789012" });
    ok(r.ok, "셀러 출고(운송장)", r);
    const logS = await db.notificationLog.findFirst({ where: { templateCode: "ORDER_SHIPPED", recipient: "010-8800-0005" } });
    ok(!!logS && logS.content.includes("123456789012"), "구매자 출고 알림톡 (운송장)", logS?.content);
    r = await guest.req("POST", `/api/orders/${o3}/claims`, { phone: "010-8800-0005", type: "CANCEL", reason: "단순 변심" });
    ok(r.status === 409, "출고 후에는 취소 요청 불가", r);
    r = await guest.req("POST", `/api/orders/${o3}/claims`, { phone: "010-8800-0005", type: "EXCHANGE", reason: "사이즈 · 색상 변경", detail: "L로 바꿔 주세요" });
    const c3 = r.data?.id; ok(r.status === 201, "출고 후 교환 요청", r);
    r = await guest.req("DELETE", `/api/orders/${o3}/claims`, { phone: "010-8800-0005", claimId: c3 });
    ok(r.ok && (await db.orderClaim.findUnique({ where: { id: c3 } })).status === "WITHDRAWN", "구매자가 요청 거두기", r);

    console.log("\n[8] 알림 설정 (서버 저장 · 끄면 안 옴)");
    r = await seller.req("PATCH", "/api/me/notification-prefs", { order: false, settlement: true, live: true });
    ok(r.ok, "주문 알림 끄기 저장", r);
    await db.userNotification.deleteMany({ where: { userId: sellerUser.id, type: "ORDER" } });
    r = await guest.req("POST", "/api/orders", { ...buyer("010-8800-0006", S.slug), items: [{ liveSessionProductId: p1.id, quantity: 1 }] });
    ok(r.status === 201 && (await db.userNotification.count({ where: { userId: sellerUser.id, type: "ORDER" } })) === 0, "끈 상태에서는 주문 알림 없음", r.status);
    await seller.req("PATCH", "/api/me/notification-prefs", { order: true, settlement: true, live: true });
    r = await seller.req("PATCH", "/api/me/profile", { sns: { instagram: "@sb_seller", youtube: "https://youtube.com/@sb", tiktok: "" } });
    const prof = await db.profile.findUnique({ where: { userId: sellerUser.id } });
    ok(r.ok && prof.snsLinks?.instagram === "@sb_seller", "SNS 주소 서버 저장", prof?.snsLinks);

    console.log("\n[9] 회원 탈퇴");
    r = await seller.req("GET", "/api/me/withdraw");
    ok(r.ok && r.data.blockers.length > 0, "진행 중 주문이 있는 셀러는 탈퇴 전 정리 안내", r.data?.blockers);
    const wEmail = `sim-wd-${stamp}@example.com`;
    await db.user.create({ data: { email: wEmail, passwordHash: await bcrypt.hash("password1234", 10), role: "SELLER", profile: { create: { name: "탈퇴예정", phone: "010-9999-0000", bankAccount: "1234" } } } });
    const wd = new Client();
    ok((await wd.login(wEmail)).data?.user?.email === wEmail, "새 셀러 로그인");
    r = await wd.req("POST", "/api/me/withdraw", { password: "password1234" });
    ok(r.status === 400, "'탈퇴' 확인 문구 없으면 거절", r);
    r = await wd.req("POST", "/api/me/withdraw", { password: "wrong-pass", confirm: "탈퇴" });
    ok(r.status === 400, "비밀번호 틀리면 거절", r);
    r = await wd.req("POST", "/api/me/withdraw", { password: "password1234", confirm: "탈퇴" });
    ok(r.ok, "탈퇴 완료", r);
    const wUser = await db.user.findFirst({ where: { withdrawnAt: { not: null }, email: { startsWith: "withdrawn-" } }, orderBy: { withdrawnAt: "desc" }, include: { profile: true } });
    ok(!!wUser && !wUser.isActive && wUser.profile?.phone === null && wUser.profile?.bankAccount === null && wUser.profile?.name === "탈퇴한 회원", "이메일 · 이름 · 연락처 · 계좌 지움", wUser && [wUser.email, wUser.profile]);
    ok(!(await db.user.findUnique({ where: { email: wEmail } })), "같은 이메일로 다시 가입 가능 (원래 이메일 비움)");
    r = await wd.req("GET", "/api/me/withdraw");
    ok(r.status === 401, "탈퇴 후 기존 로그인 끊김", r.status);
    const wd2 = new Client();
    ok(!(await wd2.login(wEmail)).data?.user, "탈퇴한 계정으로 로그인 불가");
    r = await admin.req("GET", "/api/me/withdraw");
    ok(r.ok && r.data.blockers.some((b) => /최고관리자/.test(b)), "최고관리자는 탈퇴 불가", r.data);

    console.log("\n[10] 개인정보 파기 · 정기 실행");
    const old = await db.order.create({ data: { orderNo: `SIMOLD${stamp}`.toUpperCase().slice(0, 30), liveSessionId: S.id, sellerId: sellerUser.id, buyerName: "오래된구매자", buyerPhone: "010-1234-5678", buyerAddress: "서울 어딘가", status: "DELIVERED", totalAmount: 1000, deliveredAt: new Date(Date.now() - 6 * 365 * 86400000) } });
    const recent = await db.order.create({ data: { orderNo: `SIMNEW${stamp}`.toUpperCase().slice(0, 30), liveSessionId: S.id, sellerId: sellerUser.id, buyerName: "최근구매자", buyerPhone: "010-1234-0000", buyerAddress: "서울 어딘가", status: "DELIVERED", totalAmount: 1000, deliveredAt: new Date(Date.now() - 30 * 86400000) } });
    r = await admin.req("POST", "/api/cron/bookings?privacy=force");
    ok(r.ok && r.data.privacy && r.data.privacy.skipped === false, "정기 실행에 개인정보 파기 포함", r.data?.privacy);
    const oldAfter = await db.order.findUnique({ where: { id: old.id } }), recentAfter = await db.order.findUnique({ where: { id: recent.id } });
    ok(oldAfter.buyerName === "(파기됨)" && oldAfter.buyerPhone === "" && oldAfter.buyerAddress === null, "거래 후 5년 지난 구매자 정보 파기");
    ok(recentAfter.buyerName === "최근구매자", "보관 기간 안의 주문은 그대로");
    ok((await guest.req("GET", "/api/cron/bookings")).status === 401, "로그인 없이 정기 실행 호출 불가");

    console.log("\n[11] 헬스체크 · 검색 노출 · 연동 표시 · 결제 화면");
    r = await guest.req("GET", "/api/health");
    ok(r.status === 200 && r.ok === true && r.db === true, "헬스체크 200 · DB 정상", r);
    const sm = await guest.page("/sitemap.xml");
    ok(sm.text.includes("/brands") && sm.text.includes("/notices"), "사이트맵에 브랜드샵 · 공지사항 포함");
    const rb = await guest.page("/robots.txt");
    ok(rb.text.includes("Disallow: /facility/") && !/Disallow: \/facility\s*$/m.test(rb.text), "robots: /facility/ 만 막고 /facilities 는 허용");
    const ig = await admin.page("/admin/integrations");
    ok(ig.status === 200 && ig.text.includes("테스트 모드"), "연동 설정: 테스트(Mock) 결제는 '테스트 모드'로 표시");
    const co = await guest.page(`/checkout/${S.slug}`);
    ok(co.text.includes("주소 검색") && co.text.includes("쿠폰 코드") && co.text.includes("통신판매중개자") && co.text.includes("<h1"), "결제 화면: 주소 검색 · 쿠폰 · 판매자 고지 · 제목");
  } finally {
    if (liveRestore) await liveRestore().catch(() => null);
  }
}

main()
  .catch((e) => { failN++; fails.push("SIM CRASH"); console.error("SIM CRASH", e); })
  .finally(async () => {
    console.log(`\n결과: 통과 ${pass} · 실패 ${failN}`);
    if (fails.length) console.log(fails);
    await db.$disconnect();
    process.exit(failN ? 1 : 0);
  });
