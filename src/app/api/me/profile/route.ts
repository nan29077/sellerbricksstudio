import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { isProfileImageIndex } from "@/lib/profile";

const MAX_PHOTO_BYTES = 128 * 1024;
const JPEG_PREFIX = "data:image/jpeg;base64,";

function isProfilePhoto(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith(JPEG_PREFIX) ||
      value.length > JPEG_PREFIX.length + Math.ceil(MAX_PHOTO_BYTES / 3) * 4) return false;
  const encoded = value.slice(JPEG_PREFIX.length);
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
  const bytes = Buffer.from(encoded, "base64");
  return bytes.length > 4 && bytes.length <= MAX_PHOTO_BYTES &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

export async function PATCH(req: NextRequest) {
  try {
    const u = await requireUser();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("프로필 설정 형식이 올바르지 않습니다.");
    const { name, phone, profileImageIndex, avatarUrl } = body;
    if ((name != null && typeof name !== "string") || (phone != null && typeof phone !== "string")) {
      return fail("이름과 연락처를 확인해 주세요.");
    }
    if ((typeof name === "string" && (name.trim().length < 1 || name.length > 40)) || (typeof phone === "string" && phone.length > 30)) {
      return fail("이름은 1~40자, 연락처는 30자 이하로 입력해 주세요.");
    }
    if (profileImageIndex !== undefined && !isProfileImageIndex(profileImageIndex)) {
      return fail("제공된 동물 캐릭터를 선택해 주세요.");
    }
    if (avatarUrl !== undefined && avatarUrl !== null && !isProfilePhoto(avatarUrl)) {
      return fail("프로필 사진 형식이 올바르지 않습니다. 사진을 다시 선택해 주세요.");
    }

    // 데모 계정(admin@/manager@/facility@/seller@)은 DB 레코드가 없으므로 저장하지 않음
    if (u.id.startsWith("demo-")) {
      return ok({ demo: true, message: "데모 계정은 변경 내용이 저장되지 않습니다." });
    }

    await prisma.user.update({
      where: { id: u.id },
      data: {
        ...(profileImageIndex !== undefined ? { profileImageIndex } : {}),
        profile: {
          upsert: {
            create: { name: (name ?? u.email) as string, phone: phone ?? null, avatarUrl: avatarUrl ?? null },
            update: {
              ...(name != null ? { name: name as string } : {}),
              ...(phone !== undefined ? { phone: phone ?? null } : {}),
              ...(avatarUrl !== undefined ? { avatarUrl } : {}),
            },
          },
        },
      },
    });

    return ok({ saved: true });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) return handleError(e);
    console.error("Profile update failed", e instanceof Error ? e.name : "UnknownError");
    return fail("프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503);
  }
}
