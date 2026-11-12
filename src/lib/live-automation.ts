import { prisma } from "./prisma";
import { getPolicy } from "./policy";
import { notify } from "./notify";
import { audit } from "./audit";

// 방송 자동 종료
//  - 셀러가 '방송 종료'를 누르지 않아도, 방송 예정 종료 시각(예약 종료)이 지나고 정책의 n시간이 더 지나면 종료한다.
//  - 종료 시각이 없는 방송(셀러 공간 방송 등)은 12시간 동안 아무 변화(상품 · 주문 · 상태)가 없으면 종료한다.
//  - 종료되면 endedAt 이 기록되어 '종료 후 주문 허용 시간' 규칙이 그대로 적용된다.
// 화면을 열 때 1분에 한 번만 실제로 돌고, /api/cron/bookings 에서도 실행된다.
const IDLE_HOURS_WITHOUT_SCHEDULE = 12;
let lastRun = 0;

export async function endOverdueLiveSessions(opts: { force?: boolean; now?: Date } = {}) {
  const nowMs = (opts.now ?? new Date()).getTime();
  if (!opts.force && nowMs - lastRun < 60_000) return { skipped: true, ended: 0 };
  lastRun = nowMs;
  let ended = 0;
  try {
    const { liveAutoEndHours } = await getPolicy();
    if (liveAutoEndHours <= 0) return { skipped: false, ended };
    const scheduledBefore = new Date(nowMs - liveAutoEndHours * 3600000);
    const idleBefore = new Date(nowMs - IDLE_HOURS_WITHOUT_SCHEDULE * 3600000);
    const overdue = await prisma.liveSession.findMany({
      where: {
        status: "LIVE",
        OR: [
          { scheduledEnd: { lt: scheduledBefore } },
          { scheduledEnd: null, updatedAt: { lt: idleBefore } },
        ],
      },
      select: { id: true, title: true, sellerId: true, facility: { select: { ownerId: true } } },
      take: 100,
    });
    for (const s of overdue) {
      const r = await prisma.liveSession.updateMany({ where: { id: s.id, status: "LIVE" }, data: { status: "ENDED", endedAt: new Date(nowMs) } });
      if (!r.count) continue;
      ended += 1;
      await audit({ actorId: null, action: "LIVE_AUTO_END", entity: "LiveSession", entityId: s.id });
      await notify({ userId: s.sellerId, type: "SYSTEM", category: "live", title: "방송이 자동 종료되었습니다", body: `${s.title} · 방송 예정 시간이 지나 종료했습니다.`, link: `/seller/live-sessions/${s.id}` });
      if (s.facility?.ownerId && s.facility.ownerId !== s.sellerId) {
        await notify({ userId: s.facility.ownerId, type: "SYSTEM", category: "live", title: "방송이 자동 종료되었습니다", body: s.title, link: "/facility/live-sessions" });
      }
    }
  } catch (e) {
    console.error("[live-automation]", e);
  }
  return { skipped: false, ended };
}
