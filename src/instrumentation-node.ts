// 서버 내장 스케줄러 본체 (Node.js 서버에서만 불러온다 — src/instrumentation.ts 참고)
import { runAllMaintenance } from "./lib/maintenance";

const g = globalThis as typeof globalThis & { __sbCron?: ReturnType<typeof setInterval> };
if (process.env.INTERNAL_CRON === "1" && !g.__sbCron) {
  const minutes = Math.max(1, Number(process.env.INTERNAL_CRON_MINUTES ?? 5) || 5);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runAllMaintenance(); } catch (e) { console.error("[internal-cron]", e); } finally { running = false; }
  };
  g.__sbCron = setInterval(tick, minutes * 60_000);
  setTimeout(tick, 30_000); // 서버가 뜨고 30초 뒤 한 번
  console.info(`[internal-cron] 정기 자동 처리를 ${minutes}분마다 실행합니다.`);
}
