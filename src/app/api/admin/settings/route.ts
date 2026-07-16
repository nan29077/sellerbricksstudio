import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { getSettings, updateSettings, DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    return ok(await getSettings());
  } catch (e) { return handleError(e); }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole(["SUPER_ADMIN"]);
    const body = await req.json();

    // 허용된 키만 추려서 저장
    const patch: Partial<SiteSettings> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]) {
      if (key in body) (patch as any)[key] = body[key];
    }

    try {
      await updateSettings(patch);
    } catch {
      return fail("설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.", 500);
    }

    await audit({ actorId: user.id, action: "SETTINGS_UPDATE", entity: "Setting", meta: patch });
    return ok(await getSettings());
  } catch (e) { return handleError(e); }
}
