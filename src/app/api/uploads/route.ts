import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { consume, MINUTE } from "@/lib/rate-limit";
import { MAX_IMAGE_BYTES, saveImage, sniffImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const FOLDERS = new Set(["brand", "product", "shop", "facility", "profile", "misc"]);

// POST /api/uploads (multipart: file, folder) — 로그인한 회원의 이미지 업로드 (JPG · PNG · WebP · GIF, 5MB 이하)
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role === "BUYER") return fail("업로드 권한이 없습니다.", 403);
    if (!(await consume(`upload:${user.id}`, 60, 10 * MINUTE))) return fail("업로드가 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_IMAGE_BYTES + 64 * 1024) return fail("이미지는 5MB 이하만 올릴 수 있습니다.", 413);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return fail("이미지 파일을 선택해 주세요.");
    if (file.size > MAX_IMAGE_BYTES) return fail("이미지는 5MB 이하만 올릴 수 있습니다.", 413);
    const buf = Buffer.from(await file.arrayBuffer());
    const type = sniffImage(buf);
    if (!type) return fail("JPG · PNG · WebP · GIF 이미지 파일만 올릴 수 있습니다.");
    const folderRaw = String(form?.get("folder") ?? "misc");
    const folder = FOLDERS.has(folderRaw) ? folderRaw : "misc";
    const url = await saveImage(buf, type, folder);
    await audit({ actorId: user.id, action: "UPLOAD_IMAGE", entity: "Upload", meta: { url, bytes: buf.length, type } });
    return ok({ url }, 201);
  } catch (e) { return handleError(e); }
}
