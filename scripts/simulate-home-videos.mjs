// 메인 영상 플레이어 E2E 시뮬레이션 — 최고관리자 홈 영상(라이브 커머스 한 목록: 라이브 다시보기 · 홍보 · 캠페인 · 행사) · 셀러브릭스 방송 수신(준비 기능)
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
// 그래서 웹훅 시험([2])과 피드 시험([3])은 개발 서버 설정을 바꿔 따로 돌린다: SIM_FEED=1 이면 [3]만.
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
  await db.homeVideo.deleteMany({ where: { title: { startsWith: "시뮬" } } });
  await db.externalBroadcast.deleteMany({ where: { OR: [{ title: { startsWith: "시뮬" } }, { source: "SELLERBRICKS", externalId: { startsWith: "sim-" } }] } });
  let r, list;
  const admin = new Client("admin"), seller = new Client("seller"), guest = new Client("guest");
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  ok((await seller.login("seller@sellerbricks.kr")).data?.user?.role === "SELLER", "셀러 로그인");
  const V = "/api/admin/home-videos";

  if (!FEED_MODE) {
  console.log("\n[1] 최고관리자 — 홈 영상 (라이브 커머스 한 목록)");
  r = await seller.req("POST", V, { category: "LIVE_COMMERCE", title: "시뮬 셀러", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 403, "셀러는 홈 영상 넣기 불가", r);
  r = await guest.req("GET", V);
  ok(r.status === 401, "비로그인 관리 API 차단", r);
  r = await admin.req("POST", V, { category: "NOPE", title: "시뮬 x", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 400 && /탭/.test(r.error ?? ""), "없는 탭 거절", r);
  r = await admin.req("POST", V, { category: "LIVE_COMMERCE", title: "", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 400 && /제목/.test(r.error ?? ""), "제목 없으면 거절", r);
  r = await admin.req("POST", V, { category: "LIVE_COMMERCE", title: "시뮬 위험", url: "javascript:alert(1)" });
  ok(r.status === 400, "javascript: 주소 거절", r);
  r = await admin.req("POST", V, { category: "LIVE_COMMERCE", title: "시뮬 경로", url: "/not-a-video" });
  ok(r.status === 400, "영상 파일이 아닌 사이트 안 경로 거절", r);
  r = await admin.req("POST", V, { category: "LIVE_COMMERCE", title: "시뮬 길이", url: "https://youtu.be/abcdefghijk", duration: "30초" });
  ok(r.status === 400 && /길이/.test(r.error ?? ""), "길이 형식 검사", r);
  r = await admin.req("POST", V, { category: "CAMPAIGN", title: "시뮬 옛 탭", url: "https://youtu.be/abcdefghijk" });
  ok(r.status === 400, "예전 캠페인 탭으로는 넣을 수 없음 (라이브 커머스 하나로 합침)", r);
  r = await admin.req("POST", V, { category: "LIVE_COMMERCE", title: "시뮬 기간", url: "https://vimeo.com/76979871", startsAt: new Date(Date.now() + 7200000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() });
  ok(r.status === 400 && /노출 종료/.test(r.error ?? ""), "노출 종료가 시작보다 앞이면 거절", r);

  const add = async (b) => (await admin.req("POST", V, { duration: "", ...b })).data?.id;
  const yt = await add({ category: "LIVE_COMMERCE", title: `시뮬 니트 라이브 다시보기 ${stamp}`, caption: "뷰티 스튜디오", url: "https://www.youtube.com/watch?v=abcdefghijk", duration: "12:05", sortOrder: -10 });
  const shorts = await add({ category: "LIVE_COMMERCE", title: `시뮬 숏폼 ${stamp}`, caption: "숏폼", url: "https://youtube.com/shorts/bbbbbbbbbbb" });
  const mp4 = await add({ category: "LIVE_COMMERCE", title: `시뮬 mp4 ${stamp}`, url: "/media/broadcasts/beauty-studio.mp4", thumbnailUrl: "/media/broadcasts/beauty-studio.webp", duration: "0:30" });
  const vimeo = await add({ category: "LIVE_COMMERCE", title: `시뮬 브랜드 캠페인 ${stamp}`, caption: "온유 브랜드", url: "https://vimeo.com/76979871" });
  const insta = await add({ category: "LIVE_COMMERCE", title: `시뮬 팝업 행사 ${stamp}`, caption: "성수 팝업", url: "https://www.instagram.com/reel/abc/" });
  const future = await add({ category: "LIVE_COMMERCE", title: `시뮬 예정 행사 ${stamp}`, url: "https://youtu.be/ccccccccccc", startsAt: new Date(Date.now() + 3600000).toISOString() });
  const hidden = await add({ category: "LIVE_COMMERCE", title: `시뮬 숨김 ${stamp}`, url: "https://youtu.be/ddddddddddd", isVisible: false });
  ok([yt, shorts, mp4, vimeo, insta, future, hidden].every(Boolean), "영상 7개 넣기 (유튜브 · 쇼츠 · mp4 · 비메오 · 인스타 · 예정 · 숨김)");
  r = await admin.req("GET", V);
  const row = (id) => r.data.find((x) => x.id === id);
  ok(r.ok && row(yt).kind === "youtube" && row(shorts).kind === "youtube" && row(mp4).kind === "file" && row(vimeo).kind === "vimeo" && row(insta).kind === "link", "주소별 재생 방식 판별", r.data?.map?.((x) => x.kind));
  ok(row(yt).shown && !row(future).shown && !row(hidden).shown, "관리 목록에 메인 노출 여부 (예정 · 숨김은 안 보임)");

  let home = await guest.page("/");
  ok(home.status === 200 && home.text.includes("라이브 커머스") && !/>\s*온에어|ON AIR/.test(home.text), "메인 플레이어: 제목 '라이브 커머스' · 온에어 없음");
  ok(!home.text.includes("캠페인 · 행사") && !/role="tab"[^>]*>[^<]*라이브 커머스/.test(home.text), "메인 플레이어: 탭 없이 한 목록 (캠페인 · 행사 탭 없음)");
  ok(home.text.includes(`시뮬 브랜드 캠페인 ${stamp}`), "캠페인 영상도 라이브 커머스 목록에 함께 보임");
  ok(home.text.includes(`시뮬 니트 라이브 다시보기 ${stamp}`), "라이브 커머스 탭에 넣은 영상 표시");
  ok(home.text.indexOf(`시뮬 니트 라이브 다시보기 ${stamp}`) < home.text.indexOf(`시뮬 숏폼 ${stamp}`), "순서(작을수록 앞) 반영");
  ok(home.text.includes("i.ytimg.com/vi/abcdefghijk"), "유튜브는 썸네일 자동");
  ok(!home.text.includes(`시뮬 예정 행사 ${stamp}`) && !home.text.includes(`시뮬 숨김 ${stamp}`), "노출 기간 전 · 숨긴 영상은 메인에 없음");
  await db.homeVideo.update({ where: { id: future }, data: { startsAt: new Date(Date.now() - 60000) } });
  r = await admin.req("PATCH", V, { id: hidden, isVisible: true });
  ok(r.ok, "숨김 해제", r);
  home = await guest.page("/");
  ok(home.text.includes(`시뮬 예정 행사 ${stamp}`) && home.text.includes(`시뮬 숨김 ${stamp}`), "노출 시작 시각이 되면 · 숨김 해제하면 메인에 보임");
  r = await admin.req("PATCH", V, { id: yt, url: "notaurl" });
  ok(r.status === 400, "수정할 때도 주소 검사", r);
  r = await admin.req("PATCH", V, { id: yt, title: `시뮬 탭 이동 ${stamp}` });
  ok(r.ok && r.data.category === "LIVE_COMMERCE", "제목 수정 (분류는 라이브 커머스 유지)", r);
  r = await admin.req("PATCH", V, { id: yt, endsAt: new Date(Date.now() - 1000).toISOString(), startsAt: null });
  home = await guest.page("/");
  ok(r.ok && !home.text.includes(`시뮬 탭 이동 ${stamp}`), "노출 종료 시각이 지나면 내려감", r);
  r = await admin.req("DELETE", `${V}?id=${insta}`);
  ok(r.ok && !(await db.homeVideo.findUnique({ where: { id: insta } })), "영상 삭제", r);
  r = await admin.req("DELETE", `${V}?id=nope`);
  ok(r.status === 404, "없는 영상 삭제 404", r);
  const pg = await admin.page("/admin/site-management?tab=videos");
  ok(pg.status === 200 && pg.text.includes("영상 넣기") && pg.text.includes("라이브 커머스") && !pg.text.includes("캠페인 · 행사 탭"), "사이트 관리 → 홈 영상 화면 (한 목록)");
  const old = await admin.page("/admin/site-management?tab=broadcasts");
  ok(old.status === 200 && old.text.includes("영상 넣기"), "예전 '방송 링크' 탭 주소 → 홈 영상 탭");

  console.log("\n[2] 셀러브릭스 방송 수신 (준비 기능 — 메인에는 표시 안 함)");
  const live1 = { id: `sim-${stamp}-1`, title: `시뮬 셀러브릭스 자체 송출 ${stamp}`, sellerName: "브릭스셀러", watchUrl: "https://sellerbricks.co.kr/live/1", embedUrl: "https://player.sellerbricks.co.kr/embed/1", hlsUrl: "https://cdn.sellerbricks.co.kr/live/1/index.m3u8", startedAt: new Date().toISOString() };
  if (SECRET) {
    r = await hook({ event: "live.started", broadcast: live1 }, { secret: "wrong-secret" });
    ok(r.status === 401, "서명이 틀리면 거절", r);
    r = await hook({ event: "live.started", broadcast: live1 }, { ts: Math.floor(Date.now() / 1000) - 3600 });
    ok(r.status === 401, "오래된(5분 넘은) 요청 거절", r);
    r = await hook({ event: "live.started", broadcast: live1 }, { secret: "", sig: "" });
    ok(r.status === 401, "서명 없으면 거절", r);
  } else console.log("  (SELLERBRICKS_WEBHOOK_SECRET 없이 실행 — 서명 시험 생략)");
  r = await hook({ event: "live.started", broadcast: { ...live1, watchUrl: "javascript:x" } });
  ok(r.status === 400, "시청 주소가 http(s) 가 아니면 거절", r);
  r = await hook({ event: "live.unknown", broadcast: live1 });
  ok(r.status === 400, "알 수 없는 이벤트 거절", r);
  r = await hook({ event: "live.started", broadcast: live1 });
  list = await onAir();
  const sb1 = list.find((b) => b.title === live1.title);
  ok(r.ok && !!sb1 && sb1.embedUrl === live1.embedUrl && sb1.hlsUrl === live1.hlsUrl, "방송 시작 웹훅 → 수신 목록(on-air API)에 저장", sb1);
  r = await hook({ event: "live.started", broadcast: { ...live1, id: `sim-${stamp}-x`, title: `시뮬 외부 iframe ${stamp}`, embedUrl: "https://evil.example/embed" } });
  ok(r.ok && (await onAir()).find((b) => b.title.startsWith("시뮬 외부 iframe"))?.embedUrl === null, "허용되지 않은 호스트의 플레이어 주소는 버림");
  r = await hook({ event: "live.updated", broadcast: { ...live1, title: `시뮬 셀러브릭스 제목 변경 ${stamp}` } });
  ok(r.ok && (await db.externalBroadcast.count({ where: { source: "SELLERBRICKS", externalId: live1.id } })) === 1, "정보 변경 웹훅 → 같은 방송 갱신 (중복 없음)", r);
  const sbRow = await db.externalBroadcast.findFirst({ where: { source: "SELLERBRICKS", externalId: live1.id } });
  await db.externalBroadcast.update({ where: { id: sbRow.id }, data: { lastSyncedAt: new Date(Date.now() - 60 * 60000) } });
  ok(!(await onAir()).some((b) => b.id === sbRow.id), "오래 소식이 없는 방송은 방송 중으로 보지 않음");
  r = await hook({ event: "live.ended", broadcast: { id: live1.id } });
  ok(r.ok && r.data.ended === 1, "방송 종료 웹훅", r);
  const a = { id: `sim-${stamp}-a`, title: `시뮬 스냅샷 A ${stamp}`, watchUrl: "https://sellerbricks.co.kr/live/a", status: "live" };
  const b = { id: `sim-${stamp}-b`, title: `시뮬 스냅샷 B ${stamp}`, watchUrl: "https://sellerbricks.co.kr/live/b", status: "live" };
  await hook({ event: "live.snapshot", broadcasts: [a, b] });
  r = await hook({ event: "live.snapshot", broadcasts: [a] });
  list = await onAir();
  ok(r.ok && list.some((x) => x.title === a.title) && !list.some((x) => x.title === b.title), "전체 목록(스냅샷) → 빠진 방송은 종료", r);
  home = await guest.page("/");
  ok(!home.text.includes(a.title), "셀러브릭스 방송은 메인 플레이어에 나오지 않음 (최고관리자가 넣은 영상만)");
  }
  if (FEED_MODE) {
  console.log("\n[3] 셀러브릭스 피드 (스토리지마켓이 읽어 오기)");
  feedBody = { broadcasts: [{ id: `sim-${stamp}-feed`, title: `시뮬 피드 방송 ${stamp}`, sellerName: "피드셀러", watchUrl: "https://sellerbricks.co.kr/live/feed", status: "onair" }] };
  list = await onAir(); // 처음 부를 때 피드를 읽는다 (1분에 한 번까지)
  ok(list.some((x) => x.title === `시뮬 피드 방송 ${stamp}`), "피드 방송 반영", list.map((x) => x.title));
  }
  console.log("\n[4] 화면");
  { const res = await fetch(BASE + "/api/broadcasts/on-air"); ok(res.status === 200 && Array.isArray(await res.json()), "수신 방송 API 응답", res.status); }

  // 정리
  await db.homeVideo.deleteMany({ where: { title: { startsWith: "시뮬" } } });
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
