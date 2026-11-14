// 메인 온에어 방송 E2E 시뮬레이션 — 최고관리자 방송 링크 입력 · 셀러브릭스 연동(웹훅 · 피드)
// 실행: 개발 서버(http://localhost:3007) + 시드된 DB. 서명 · 피드까지 시험하려면 개발 서버를 이렇게 띄운다:
//   SELLERBRICKS_WEBHOOK_SECRET=sim-secret SELLERBRICKS_LIVE_FEED_URL=http://127.0.0.1:4599/feed npm run dev
//   그리고 같은 SELLERBRICKS_WEBHOOK_SECRET 로 `node scripts/simulate-broadcasts.mjs`
// ⚠ 테스트 데이터를 만듭니다. 운영 DB에서는 실행하지 마세요.
import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import http from "node:http";

const db = new PrismaClient();
const BASE = process.env.SIM_BASE ?? "http://localhost:3007";
const SECRET = process.env.SELLERBRICKS_WEBHOOK_SECRET ?? "";
// 피드가 켜져 있으면 피드가 '지금 방송 전체 목록'의 기준이 되어 웹훅으로 받은 방송을 덮어쓴다.
// 그래서 웹훅 시험([1][2])과 피드 시험([3])은 개발 서버 설정을 바꿔 따로 돌린다: SIM_FEED=1 이면 [3]만.
const FEED_MODE = process.env.SIM_FEED === "1";
let pass = 0, failN = 0; const fails = [];
const ok = (cond, name, extra) => { if (cond) { pass++; console.log("  ✔", name); } else { failN++; fails.push(name); console.log("  ✘", name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); } };

class Client {
  constructor(name) { this.name = name; this.jar = {}; }
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
  async page(path) { const r = await fetch(BASE + path, { headers: { cookie: this.cookie() }, redirect: "manual" }); return { status: r.status, text: await r.text() }; }
}
const hook = async (payload, { secret = SECRET, ts = Math.floor(Date.now() / 1000), sig } = {}) => {
  const body = JSON.stringify(payload);
  const headers = { "content-type": "application/json", "x-sellerbricks-timestamp": String(ts) };
  if (secret || sig) headers["x-sellerbricks-signature"] = sig ?? createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(BASE + "/api/integrations/sellerbricks/broadcasts", { method: "POST", headers, body });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
};
const onAir = async () => { const r = await fetch(BASE + "/api/broadcasts/on-air", { cache: "no-store" }); return r.ok ? r.json() : []; };

// 셀러브릭스 피드 흉내 (개발 서버가 SELLERBRICKS_LIVE_FEED_URL 로 읽어 간다)
let feedBody = { broadcasts: [] };
const feedServer = http.createServer((req, res) => {
  if (req.url !== "/feed") { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(feedBody));
});

async function main() {
  await new Promise((r) => feedServer.listen(4599, "127.0.0.1", r));
  await db.rateLimit.deleteMany({}).catch(() => {});
  const stamp = Date.now();
  await db.externalBroadcast.deleteMany({ where: { OR: [{ title: { startsWith: "시뮬" } }, { source: "SELLERBRICKS", externalId: { startsWith: "sim-" } }] } });
  let r, list;
  const admin = new Client("admin"), seller = new Client("seller"), guest = new Client("guest");
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  ok((await seller.login("seller@sellerbricks.kr")).data?.user?.role === "SELLER", "셀러 로그인");

  if (!FEED_MODE) {
  console.log("\n[1] 최고관리자 — 외부 방송 링크 입력");
  r = await seller.req("POST", "/api/admin/broadcasts", { title: "시뮬 셀러", platform: "YOUTUBE", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 403, "셀러는 방송 링크 입력 불가", r);
  r = await guest.req("GET", "/api/admin/broadcasts");
  ok(r.status === 401, "비로그인 관리 API 차단", r);
  r = await admin.req("POST", "/api/admin/broadcasts", { title: "", platform: "YOUTUBE", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 400 && /제목/.test(r.error ?? ""), "제목 없으면 거절", r);
  r = await admin.req("POST", "/api/admin/broadcasts", { title: "시뮬 위험", platform: "YOUTUBE", url: "javascript:alert(1)" });
  ok(r.status === 400, "javascript: 주소 거절", r);
  r = await admin.req("POST", "/api/admin/broadcasts", { title: "시뮬 플랫폼", platform: "NOPE", url: "https://a.com" });
  ok(r.status === 400, "없는 플랫폼 거절", r);
  r = await admin.req("POST", "/api/admin/broadcasts", { title: "시뮬 iframe", platform: "ETC", url: "https://evil.example/live", embedUrl: "https://evil.example/embed" });
  ok(r.status === 400 && /허용된 호스트/.test(r.error ?? ""), "허용되지 않은 끼워 넣기 주소 거절", r);
  r = await admin.req("POST", "/api/admin/broadcasts", { title: "시뮬 예정", platform: "GRIP", url: "https://grip.show/x", status: "SCHEDULED" });
  ok(r.status === 400 && /시작 시각/.test(r.error ?? ""), "예정 방송은 시작 시각 필수", r);
  r = await admin.req("POST", "/api/admin/broadcasts", { title: "시뮬 거꾸로", platform: "GRIP", url: "https://grip.show/x", startsAt: new Date(Date.now() + 7200000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() });
  ok(r.status === 400 && /종료 시각/.test(r.error ?? ""), "종료가 시작보다 앞이면 거절", r);

  r = await admin.req("POST", "/api/admin/broadcasts", { title: `시뮬 유튜브 라이브 ${stamp}`, sellerName: "테스트셀러", platform: "YOUTUBE", url: "https://www.youtube.com/live/abcdefghijk", thumbnailUrl: "/images/home/banner-live-prep.webp", sortOrder: -5 });
  ok(r.status === 201, "유튜브 방송 링크 등록 (바로 방송 중)", r);
  const yt = r.data?.id;
  r = await admin.req("POST", "/api/admin/broadcasts", { title: `시뮬 그립 라이브 ${stamp}`, platform: "GRIP", url: "https://www.grip.show/live/123" });
  const grip = r.data?.id; ok(r.status === 201, "그립 방송 링크 등록", r);
  r = await admin.req("POST", "/api/admin/broadcasts", { title: `시뮬 예정 방송 ${stamp}`, platform: "CLICKMATE", url: "https://clickmate.example/live/9", status: "SCHEDULED", startsAt: new Date(Date.now() + 3600000).toISOString() });
  const sched = r.data?.id; ok(r.status === 201, "예정 방송 등록 (1시간 뒤 시작)", r);
  r = await admin.req("POST", "/api/admin/broadcasts", { title: `시뮬 종료 지난 방송 ${stamp}`, platform: "VIBE", url: "https://vibe.example/live/1", startsAt: new Date(Date.now() - 7200000).toISOString(), endsAt: new Date(Date.now() - 60000).toISOString() });
  const past = r.data?.id; ok(r.status === 201, "종료 시각이 지난 방송 등록", r);

  list = await onAir();
  const ytRow = list.find((b) => b.id === yt);
  ok(!!ytRow && ytRow.youtubeId === "abcdefghijk" && ytRow.channel.startsWith("유튜브") && ytRow.seller === "테스트셀러" && ytRow.slug === yt, "온에어: 유튜브 방송 (바로 재생할 영상 ID)", ytRow);
  ok(list.some((b) => b.id === grip && b.youtubeId === null && b.channelUrl.includes("grip")), "온에어: 그립 방송 (새 창 링크)");
  ok(!list.some((b) => b.id === sched) && !list.some((b) => b.id === past), "예정 전 방송 · 종료 시각 지난 방송은 안 보임");
  ok(list.findIndex((b) => b.id === yt) < list.findIndex((b) => b.id === grip), "표시 순서(작을수록 앞) 반영");
  await db.externalBroadcast.update({ where: { id: sched }, data: { startsAt: new Date(Date.now() - 60000) } });
  ok((await onAir()).some((b) => b.id === sched), "예정 방송은 시작 시각이 되면 자동으로 보임");
  r = await admin.req("PATCH", "/api/admin/broadcasts", { id: grip, isVisible: false });
  ok(r.ok && !(await onAir()).some((b) => b.id === grip), "메인에서 숨김", r);
  r = await admin.req("PATCH", "/api/admin/broadcasts", { id: grip, isVisible: true });
  r = await admin.req("PATCH", "/api/admin/broadcasts", { id: grip, status: "ENDED" });
  ok(r.ok && !!r.data.endsAt && !(await onAir()).some((b) => b.id === grip), "종료 → 메인에서 내림 (종료 시각 기록)", r);
  r = await admin.req("PATCH", "/api/admin/broadcasts", { id: past, status: "LIVE" });
  ok(r.ok && (await onAir()).some((b) => b.id === past), "지난 방송을 다시 '방송 중'으로 켜면 지난 종료 시각을 지우고 보임", r);
  r = await admin.req("PATCH", "/api/admin/broadcasts", { id: yt, title: "시뮬 제목 수정", url: "notaurl" });
  ok(r.status === 400, "수정할 때도 주소 검사", r);
  r = await admin.req("PATCH", "/api/admin/broadcasts", { id: yt, title: `시뮬 유튜브 라이브(수정) ${stamp}` });
  ok(r.ok && r.data.title.includes("수정"), "방송 제목 수정", r);
  r = await admin.req("GET", "/api/admin/broadcasts");
  ok(r.ok && r.data.rows.some((x) => x.id === yt && x.onAir), "관리 목록에 메인 노출 여부 표시", r.status);
  r = await admin.req("DELETE", `/api/admin/broadcasts?id=${past}`);
  ok(r.ok && !(await db.externalBroadcast.findUnique({ where: { id: past } })), "직접 입력 방송 삭제", r);
  const pg = await admin.page("/admin/site-management?tab=broadcasts");
  ok(pg.status === 200 && pg.text.includes("방송 링크 추가") && pg.text.includes("셀러브릭스 연동 방송") && pg.text.includes("유튜브 라이브(수정)"), "사이트 관리 → 방송 링크 탭 화면");

  console.log("\n[2] 셀러브릭스 웹훅");
  const live1 = { id: `sim-${stamp}-1`, title: `시뮬 셀러브릭스 자체 송출 ${stamp}`, sellerName: "브릭스셀러", watchUrl: "https://sellerbricks.co.kr/live/1", embedUrl: "https://player.sellerbricks.co.kr/embed/1", hlsUrl: "https://cdn.sellerbricks.co.kr/live/1/index.m3u8", thumbnailUrl: "https://sellerbricks.co.kr/t/1.jpg", startedAt: new Date().toISOString() };
  if (SECRET) {
    r = await hook({ event: "live.started", broadcast: live1 }, { secret: "wrong-secret" });
    ok(r.status === 401, "서명이 틀리면 거절", r);
    r = await hook({ event: "live.started", broadcast: live1 }, { ts: Math.floor(Date.now() / 1000) - 3600 });
    ok(r.status === 401, "오래된(5분 넘은) 요청 거절 — 재전송 공격 방지", r);
    r = await hook({ event: "live.started", broadcast: live1 }, { secret: "", sig: "" });
    ok(r.status === 401, "서명 없으면 거절", r);
  } else console.log("  (SELLERBRICKS_WEBHOOK_SECRET 없이 실행 — 서명 시험 생략)");
  r = await hook({ event: "live.started", broadcast: { ...live1, watchUrl: "javascript:x" } });
  ok(r.status === 400, "시청 주소가 http(s) 가 아니면 거절", r);
  r = await hook({ event: "live.unknown", broadcast: live1 });
  ok(r.status === 400, "알 수 없는 이벤트 거절", r);
  r = await hook({ event: "live.started", broadcast: live1 });
  ok(r.ok, "방송 시작 웹훅 수신", r);
  list = await onAir();
  const sb1 = list.find((b) => b.title === live1.title);
  ok(!!sb1 && sb1.source === "SELLERBRICKS" && sb1.channel === "셀러브릭스" && sb1.embedUrl === live1.embedUrl && sb1.hlsUrl === live1.hlsUrl, "온에어에 셀러브릭스 자체 송출 방송 (끼워 넣기 · HLS 주소 포함)", sb1);
  r = await hook({ event: "live.started", broadcast: { ...live1, id: `sim-${stamp}-x`, title: `시뮬 외부 iframe ${stamp}`, embedUrl: "https://evil.example/embed", hlsUrl: "https://evil.example/a.m3u8" } });
  const evil = (await onAir()).find((b) => b.title.startsWith("시뮬 외부 iframe"));
  ok(r.ok && evil && evil.embedUrl === null && evil.hlsUrl === null, "허용되지 않은 호스트의 플레이어 주소는 버림 (링크로만)", evil);
  r = await hook({ event: "live.updated", broadcast: { ...live1, title: `시뮬 셀러브릭스 제목 변경 ${stamp}` } });
  ok(r.ok && (await onAir()).some((b) => b.title === `시뮬 셀러브릭스 제목 변경 ${stamp}`), "정보 변경 웹훅 → 제목 반영 (중복 생성 없음)", r);
  ok((await db.externalBroadcast.count({ where: { source: "SELLERBRICKS", externalId: live1.id } })) === 1, "같은 방송 id 는 한 건");
  const sbRow = await db.externalBroadcast.findFirst({ where: { source: "SELLERBRICKS", externalId: live1.id } });
  r = await admin.req("PATCH", "/api/admin/broadcasts", { id: sbRow.id, title: "관리자가 바꾼 제목" });
  ok(r.status === 400, "셀러브릭스 방송 내용은 관리자가 못 바꿈", r);
  r = await admin.req("PATCH", "/api/admin/broadcasts", { id: sbRow.id, isVisible: false });
  ok(r.ok && !(await onAir()).some((b) => b.id === sbRow.id), "셀러브릭스 방송도 메인에서 숨길 수 있음", r);
  await hook({ event: "live.updated", broadcast: live1 });
  ok(!(await db.externalBroadcast.findUnique({ where: { id: sbRow.id } })).isVisible, "연동으로 내용이 바뀌어도 관리자 숨김은 유지");
  await admin.req("PATCH", "/api/admin/broadcasts", { id: sbRow.id, isVisible: true });
  r = await admin.req("DELETE", `/api/admin/broadcasts?id=${sbRow.id}`);
  ok(r.status === 409, "셀러브릭스 방송은 삭제 대신 숨김", r);
  await db.externalBroadcast.update({ where: { id: sbRow.id }, data: { lastSyncedAt: new Date(Date.now() - 60 * 60000) } });
  ok(!(await onAir()).some((b) => b.id === sbRow.id), "오래 소식이 없는 셀러브릭스 방송은 자동으로 내림 (종료 알림 유실 대비)");
  await hook({ event: "live.updated", broadcast: live1 });
  ok((await onAir()).some((b) => b.id === sbRow.id), "다시 소식이 오면 다시 보임");
  r = await hook({ event: "live.ended", broadcast: { id: live1.id } });
  ok(r.ok && r.data.ended === 1 && !(await onAir()).some((b) => b.id === sbRow.id), "방송 종료 웹훅 → 메인에서 내림", r);
  r = await hook({ event: "live.ended", broadcast: { id: "sim-never" } });
  ok(r.ok && r.data.ended === 0, "받은 적 없는 방송의 종료는 무시", r);
  const a = { id: `sim-${stamp}-a`, title: `시뮬 스냅샷 A ${stamp}`, watchUrl: "https://sellerbricks.co.kr/live/a", status: "live" };
  const b = { id: `sim-${stamp}-b`, title: `시뮬 스냅샷 B ${stamp}`, watchUrl: "https://sellerbricks.co.kr/live/b", status: "live" };
  await hook({ event: "live.snapshot", broadcasts: [a, b] });
  r = await hook({ event: "live.snapshot", broadcasts: [a] });
  list = await onAir();
  ok(r.ok && list.some((x) => x.title === a.title) && !list.some((x) => x.title === b.title), "전체 목록(스냅샷) 웹훅 → 목록에서 빠진 방송은 종료", r);

  }
  if (FEED_MODE) {
  const a = { title: "-" };
  console.log("\n[3] 셀러브릭스 피드 (스토리지마켓이 읽어 오기)");
  feedBody = { broadcasts: [{ id: `sim-${stamp}-feed`, title: `시뮬 피드 방송 ${stamp}`, sellerName: "피드셀러", watchUrl: "https://sellerbricks.co.kr/live/feed", status: "onair" }] };
  r = await admin.req("POST", "/api/admin/broadcasts", { action: "sync-sellerbricks" });
  if (r.status === 409 && /피드 주소/.test(r.error ?? "")) {
    console.log("  (개발 서버에 SELLERBRICKS_LIVE_FEED_URL 이 없어 피드 시험 생략)");
  } else {
    ok(r.ok && r.data.saved === 1, "지금 동기화 → 피드 방송 반영", r);
    list = await onAir();
    ok(list.some((x) => x.title === `시뮬 피드 방송 ${stamp}`) && !list.some((x) => x.title === a.title), "피드에 없는 셀러브릭스 방송은 종료 처리", list.map((x) => x.title));
    r = await seller.req("POST", "/api/admin/broadcasts", { action: "sync-sellerbricks" });
    ok(r.status === 403, "셀러는 동기화 불가", r);
    feedBody = { broadcasts: [] };
    await admin.req("POST", "/api/admin/broadcasts", { action: "sync-sellerbricks" });
    ok(!(await onAir()).some((x) => x.title === `시뮬 피드 방송 ${stamp}`), "피드에서 사라지면 메인에서도 내림");
  }

  }
  console.log("\n[4] 화면");
  const home = await guest.page("/");
  ok(home.status === 200, "메인 화면 정상", home.status);
  { const res = await fetch(BASE + "/api/broadcasts/on-air"); ok(res.status === 200 && Array.isArray(await res.json()), "온에어 API 공개 (로그인 불필요)", res.status); }

  // 정리
  await db.externalBroadcast.deleteMany({ where: { OR: [{ title: { startsWith: "시뮬" } }, { source: "SELLERBRICKS", externalId: { startsWith: "sim-" } }] } });
}

main()
  .catch((e) => { failN++; fails.push("SIM CRASH"); console.error("SIM CRASH", e); })
  .finally(async () => {
    console.log(`\n결과: 통과 ${pass} · 실패 ${failN}`);
    if (fails.length) console.log("실패 항목:", fails);
    feedServer.close();
    await db.$disconnect();
    process.exit(failN ? 1 : 0);
  });
