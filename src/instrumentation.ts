// 서버 내장 스케줄러 (선택)
//  INTERNAL_CRON=1 이면 서버가 켜져 있는 동안 5분마다(INTERNAL_CRON_MINUTES) 정기 자동 처리를 돈다.
//  서버 한 대로 운영할 때 외부 스케줄러 없이 쓰기 위한 것이다. (여러 대로 운영하면 한 대에만 켜거나 외부 스케줄러를 쓴다)
//  외부 스케줄러를 쓰는 경우: /api/cron/bookings 를 CRON_SECRET 과 함께 5분마다 호출 (vercel.json 참고)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.INTERNAL_CRON === "1") {
    await import("./instrumentation-node");
  }
}
