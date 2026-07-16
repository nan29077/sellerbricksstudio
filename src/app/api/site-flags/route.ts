import { getSettings } from "@/lib/settings";
import { ok, handleError } from "@/lib/http";

export const dynamic = "force-dynamic";

// 로그인/회원가입 화면 등에서 역할 노출 여부를 판단하기 위한 공개 플래그.
// 민감 정보 없이 boolean 플래그만 반환한다.
export async function GET() {
  try {
    const { managerDisabled, facilityDisabled, liveEnabled } = await getSettings();
    return ok({ managerDisabled, facilityDisabled, liveEnabled });
  } catch (e) {
    return handleError(e);
  }
}
