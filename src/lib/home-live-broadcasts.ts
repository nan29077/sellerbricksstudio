import { getOnAirBroadcasts } from "@/lib/external-broadcasts";
import type { HomeLiveBroadcast } from "@/lib/home-broadcasts";

// 메인 '온에어' 방송 (2026-11-14 변경)
//  스토리지마켓에서는 더 이상 방송(LiveSession)을 만들지 않는다. 대신
//   1) 최고관리자가 사이트 관리 → 방송 링크에서 입력한 외부 방송
//   2) 셀러브릭스에서 자체 송출 중인 방송(웹훅 · 피드 연동)
//  을 보여 준다. 규칙(예정 · 종료 · 숨김 · 연동 끊김)은 src/lib/external-broadcasts.ts 에 있다.
export async function getHomeLiveBroadcasts(): Promise<HomeLiveBroadcast[]> {
  return getOnAirBroadcasts();
}
