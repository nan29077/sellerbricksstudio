import { createHmac, timingSafeEqual } from "node:crypto";
import type { ExternalBroadcast } from "@prisma/client";
import { prisma } from "./prisma";
import { safeHttpUrl, youtubeId } from "./stream-embed";
import { livePlatformCodeOf, livePlatformLabel } from "./live-platforms";

// ---------------------------------------------------------------------------
// 메인 '라이브 커머스' 플레이어의 온에어 방송 (2026-11-14)
//  스토리지마켓은 직접 송출하지 않는다. 방송은 두 곳에서 들어온다.
//   1) 최고관리자가 직접 입력한 외부 방송 주소 (사이트 관리 → 방송 링크)
//   2) 셀러브릭스에서 자체 송출 중인 방송 — 셀러브릭스가 웹훅으로 보내거나(권장), 스토리지마켓이 피드를 읽어 온다
//  화면에는 '지금 방송 중'인 것만 보인다:
//   - 상태가 LIVE 이거나, 예약(SCHEDULED)인데 시작 시각이 지났고
//   - 종료 시각이 있으면 아직 지나지 않았고, 최고관리자가 숨기지 않은 방송
//   - 셀러브릭스 방송은 마지막 연동 후 STALE_MINUTES 동안 소식이 없으면 끝난 것으로 본다 (종료 알림을 놓쳐도 계속 떠 있지 않게)
// ---------------------------------------------------------------------------

export const BROADCAST_SOURCES = { MANUAL: "직접 입력", SELLERBRICKS: "셀러브릭스" } as const;
export const BROADCAST_STATUS = { SCHEDULED: "예정", LIVE: "방송 중", ENDED: "종료" } as const;
export type BroadcastStatus = keyof typeof BROADCAST_STATUS;

const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
export const SELLERBRICKS_STALE_MINUTES = num(process.env.SELLERBRICKS_STALE_MINUTES, 30);

/** 메인 플레이어가 쓰는 모양 (작업 중인 HomeLiveBroadcast 와 같은 필드 + 추가 필드) */
export type OnAirBroadcast = {
  slug: string; id: string; title: string; seller: string;
  channel: string; channelUrl: string; youtubeId: string | null;
  embedUrl: string | null; hlsUrl: string | null; thumbnailUrl: string | null;
  source: keyof typeof BROADCAST_SOURCES; startsAt: string | null;
};

// 끼워 넣기(iframe) 허용 호스트: 유튜브는 영상 ID 로 따로 처리. 셀러브릭스 · 운영자가 정한 호스트만 허용한다.
function embedHosts() {
  const raw = `${process.env.BROADCAST_EMBED_HOSTS ?? ""},${process.env.SELLERBRICKS_EMBED_HOSTS ?? "sellerbricks.co.kr,*.sellerbricks.co.kr"}`;
  return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}
export function allowedEmbed(raw: string | null | undefined): string | null {
  const url = safeHttpUrl(raw);
  if (!url || !url.startsWith("https://")) return null;
  const host = new URL(url).hostname.toLowerCase();
  return embedHosts().some((h) => (h.startsWith("*.") ? host.endsWith(h.slice(1)) : host === h)) ? url : null;
}
export function allowedHls(raw: string | null | undefined): string | null {
  const url = allowedEmbed(raw); // 같은 허용 호스트 규칙 + https
  return url && /\.m3u8(\?|$)/i.test(new URL(url).pathname + new URL(url).search) ? url : null;
}

/** 지금 화면에 보여 줄 방송인지 */
export function isOnAir(b: Pick<ExternalBroadcast, "status" | "isVisible" | "startsAt" | "endsAt" | "source" | "lastSyncedAt">, now = new Date()) {
  if (!b.isVisible) return false;
  if (b.endsAt && b.endsAt <= now) return false;
  const started = b.status === "LIVE" || (b.status === "SCHEDULED" && !!b.startsAt && b.startsAt <= now);
  if (!started) return false;
  if (b.source === "SELLERBRICKS" && b.lastSyncedAt && now.getTime() - b.lastSyncedAt.getTime() > SELLERBRICKS_STALE_MINUTES * 60_000) return false;
  return true;
}

export function toOnAir(b: ExternalBroadcast): OnAirBroadcast {
  return {
    slug: b.id, id: b.id, title: b.title, seller: b.sellerName || "라이브 방송",
    channel: b.source === "SELLERBRICKS" ? "셀러브릭스" : livePlatformLabel(b.platform),
    channelUrl: b.url, youtubeId: youtubeId(b.url) ?? youtubeId(b.embedUrl),
    embedUrl: allowedEmbed(b.embedUrl), hlsUrl: allowedHls(b.hlsUrl), thumbnailUrl: safeHttpUrl(b.thumbnailUrl) ?? (b.thumbnailUrl?.startsWith("/") ? b.thumbnailUrl : null),
    source: (b.source === "SELLERBRICKS" ? "SELLERBRICKS" : "MANUAL"), startsAt: b.startsAt?.toISOString() ?? null,
  };
}

/** 메인 플레이어용: 지금 방송 중인 외부 방송 (셀러브릭스 피드가 설정돼 있으면 먼저 가볍게 동기화) */
export async function getOnAirBroadcasts(): Promise<OnAirBroadcast[]> {
  await syncSellerbricksFeed({ ifStale: true }).catch(() => null);
  const now = new Date();
  const rows = await prisma.externalBroadcast.findMany({
    where: { isVisible: true, status: { in: ["LIVE", "SCHEDULED"] }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: [{ sortOrder: "asc" }, { startsAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return rows.filter((b) => isOnAir(b, now)).map(toOnAir);
}

// ---------------------------------------------------------------------------
// 셀러브릭스 연동
//  A) 웹훅(권장): 셀러브릭스가 방송 시작 · 정보 변경 · 종료 때 POST /api/integrations/sellerbricks/broadcasts 로 보낸다.
//     본문 서명: x-sellerbricks-timestamp(유닉스 초) + x-sellerbricks-signature = HMAC-SHA256(`${timestamp}.${body}`, SELLERBRICKS_WEBHOOK_SECRET) hex
//  B) 피드: SELLERBRICKS_LIVE_FEED_URL 이 있으면 스토리지마켓이 1분에 한 번까지 방송 목록을 읽어 온다. (SELLERBRICKS_API_KEY → Authorization: Bearer)
//  두 방식 모두 아래 SellerbricksLive 모양을 쓴다.
// ---------------------------------------------------------------------------
export type SellerbricksLive = {
  id: string; title: string; status?: string; sellerName?: string; watchUrl: string;
  embedUrl?: string | null; hlsUrl?: string | null; thumbnailUrl?: string | null;
  scheduledAt?: string | null; startedAt?: string | null; endedAt?: string | null;
};

const SB_STATUS: Record<string, BroadcastStatus> = { scheduled: "SCHEDULED", ready: "SCHEDULED", live: "LIVE", onair: "LIVE", on_air: "LIVE", ended: "ENDED", end: "ENDED", cancelled: "ENDED", canceled: "ENDED" };
const date = (v: unknown) => { if (typeof v !== "string" && typeof v !== "number") return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** 셀러브릭스 방송 한 건을 저장할 값으로 바꾼다. 형식이 틀리면 이유를 돌려준다. */
export function normalizeSellerbricksLive(raw: unknown, fallbackStatus?: BroadcastStatus): { ok: true; value: { externalId: string; data: Omit<ExternalBroadcast, "id" | "source" | "externalId" | "createdAt" | "updatedAt" | "createdBy" | "isVisible" | "sortOrder"> } } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const externalId = str(r.id, 100);
  if (!externalId) return { ok: false, error: "방송 id 가 없습니다." };
  const title = str(r.title, 120);
  if (!title) return { ok: false, error: `${externalId}: 방송 제목이 없습니다.` };
  const url = safeHttpUrl(str(r.watchUrl ?? r.url, 500));
  if (!url) return { ok: false, error: `${externalId}: 시청 주소(watchUrl)가 http(s) 주소가 아닙니다.` };
  const status = SB_STATUS[str(r.status, 20).toLowerCase()] ?? fallbackStatus ?? "LIVE";
  const startsAt = date(r.startedAt) ?? date(r.scheduledAt);
  const endedAt = date(r.endedAt);
  return {
    ok: true,
    value: {
      externalId,
      data: {
        title, sellerName: str(r.sellerName, 60), platform: "SELLERBRICKS", url,
        embedUrl: allowedEmbed(str(r.embedUrl, 500)), hlsUrl: allowedHls(str(r.hlsUrl, 500)), thumbnailUrl: safeHttpUrl(str(r.thumbnailUrl, 500)),
        status: endedAt && endedAt <= new Date() ? "ENDED" : status, startsAt, endsAt: endedAt, lastSyncedAt: new Date(),
      },
    },
  };
}

export async function upsertSellerbricksLive(raw: unknown, fallbackStatus?: BroadcastStatus) {
  const n = normalizeSellerbricksLive(raw, fallbackStatus);
  if (!n.ok) return n;
  const { externalId, data } = n.value;
  const row = await prisma.externalBroadcast.upsert({
    where: { source_externalId: { source: "SELLERBRICKS", externalId } },
    create: { source: "SELLERBRICKS", externalId, ...data },
    update: data, // 최고관리자가 정한 숨김(isVisible) · 순서는 유지
  });
  return { ok: true as const, row };
}

/** 지금 방송 중인 전체 목록(스냅샷)을 받았을 때: 목록에 없는 셀러브릭스 방송은 종료로 바꾼다 */
export async function applySellerbricksSnapshot(list: unknown[]) {
  const errors: string[] = [];
  const seen: string[] = [];
  for (const item of list.slice(0, 500)) {
    const r = await upsertSellerbricksLive(item);
    if (r.ok) seen.push(r.row.externalId!); else errors.push(r.error);
  }
  const ended = await prisma.externalBroadcast.updateMany({
    where: { source: "SELLERBRICKS", status: { in: ["LIVE", "SCHEDULED"] }, externalId: { notIn: seen.length ? seen : ["-"] } },
    data: { status: "ENDED", endsAt: new Date(), lastSyncedAt: new Date() },
  });
  return { saved: seen.length, ended: ended.count, errors };
}

/** 웹훅 서명 확인. 비밀키가 없으면 개발 환경에서만 통과 (배포 환경은 거절) */
export function verifySellerbricksSignature(body: string, timestamp: string | null, signature: string | null): { ok: true } | { ok: false; error: string; status: number } {
  const secret = process.env.SELLERBRICKS_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV === "production" ? { ok: false, error: "셀러브릭스 연동 키(SELLERBRICKS_WEBHOOK_SECRET)가 설정되지 않았습니다.", status: 503 } : { ok: true };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return { ok: false, error: "요청 시각이 맞지 않습니다. (5분 이내)", status: 401 };
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const got = (signature ?? "").trim().toLowerCase().replace(/^sha256=/, "");
  if (got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return { ok: false, error: "서명이 맞지 않습니다.", status: 401 };
  return { ok: true };
}

// 피드 동기화 상태 (서버 메모리 — 여러 서버로 띄우면 각자 1분에 한 번까지)
let lastFeedSync = 0;
let lastFeedResult: { at: string; ok: boolean; message: string } | null = null;
export const sellerbricksFeedStatus = () => lastFeedResult;

export async function syncSellerbricksFeed({ ifStale = false }: { ifStale?: boolean } = {}) {
  const feed = process.env.SELLERBRICKS_LIVE_FEED_URL?.trim();
  if (!feed) return { skipped: true as const, message: "피드 주소(SELLERBRICKS_LIVE_FEED_URL)가 없습니다." };
  if (ifStale && Date.now() - lastFeedSync < 60_000) return { skipped: true as const, message: "1분 안에 이미 동기화했습니다." };
  lastFeedSync = Date.now();
  try {
    const res = await fetch(feed, {
      headers: { accept: "application/json", ...(process.env.SELLERBRICKS_API_KEY ? { authorization: `Bearer ${process.env.SELLERBRICKS_API_KEY}` } : {}) },
      signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    if (!res.ok) throw new Error(`피드 응답 ${res.status}`);
    const json = (await res.json()) as { broadcasts?: unknown[]; data?: unknown[] } | unknown[];
    const list = Array.isArray(json) ? json : json.broadcasts ?? json.data;
    if (!Array.isArray(list)) throw new Error("피드 형식이 아닙니다. ({ broadcasts: [...] })");
    const r = await applySellerbricksSnapshot(list);
    lastFeedResult = { at: new Date().toISOString(), ok: true, message: `방송 ${r.saved}건 반영 · 종료 ${r.ended}건${r.errors.length ? ` · 건너뜀 ${r.errors.length}건` : ""}` };
    return { skipped: false as const, ...r };
  } catch (e) {
    lastFeedResult = { at: new Date().toISOString(), ok: false, message: e instanceof Error ? e.message : "피드를 읽지 못했습니다." };
    throw e;
  }
}

/** 최고관리자 입력값의 플랫폼: 코드 그대로 또는 이름(유튜브 · 그립 …) */
export const platformOf = (v: string | null | undefined) => livePlatformCodeOf(v ?? "") ?? "ETC";
