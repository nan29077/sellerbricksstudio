import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// 요청 횟수 제한 (DB 기준 — 서버가 여러 대이거나 재시작돼도 유지된다)
//  - hit(): 횟수를 1 올리고 현재 횟수를 돌려준다. 기간이 지나면 1부터 다시 센다.
//  - DB에 닿지 않으면 이 서버 메모리로 대신 센다(서비스는 멈추지 않게).
// ---------------------------------------------------------------------------
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, windowMs: number) {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

// timestamp(3) 칸은 UTC 로 저장되므로, 비교 값도 UTC 문자열을 ::timestamp 로 바꿔 넘긴다 (DB 시간대 설정과 무관하게 동작)
const utc = (d: Date) => d.toISOString().replace("T", " ").replace("Z", "");

export async function hit(key: string, windowMs: number): Promise<number> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${utc(resetAt)}::timestamp)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" < ${utc(now)}::timestamp THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${utc(now)}::timestamp THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count"`;
    return Number(rows[0]?.count ?? 1);
  } catch {
    return memoryHit(key, windowMs);
  }
}

/** 지금까지 센 횟수가 max 이상이면 true (횟수는 올리지 않는다) */
export async function isLimited(key: string, max: number): Promise<boolean> {
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    return !!row && row.resetAt > new Date() && row.count >= max;
  } catch {
    const entry = memory.get(key);
    return !!entry && entry.resetAt > Date.now() && entry.count >= max;
  }
}

export async function clearLimit(key: string) {
  memory.delete(key);
  await prisma.rateLimit.deleteMany({ where: { key } }).catch(() => {}); // 없는 키여도 오류 로그가 남지 않게
}

/** 횟수를 올리고, 허용 범위 안이면 true */
export async function consume(key: string, max: number, windowMs: number): Promise<boolean> {
  return (await hit(key, windowMs)) <= max;
}

// 접속자 IP. 프록시(CloudFront·로드밸런서) 뒤라면 TRUSTED_PROXY_COUNT 에 프록시 단계 수를 넣는다.
// 그러면 구매자가 임의로 넣은 X-Forwarded-For 앞부분이 아니라, 신뢰하는 프록시가 붙인 값을 쓴다.
export function clientIp(req: Request): string {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const hops = Number(process.env.TRUSTED_PROXY_COUNT ?? "");
  if (xff.length && Number.isInteger(hops) && hops > 0) return xff[Math.max(0, xff.length - hops)];
  return req.headers.get("x-real-ip")?.trim() || xff[0] || "unknown";
}

export const MINUTE = 60_000;
