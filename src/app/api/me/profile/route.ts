import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { isProfileImageIndex } from "@/lib/profile";
import { isLivePlatform } from "@/lib/live-platforms";

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
    const { name, phone, profileImageIndex, avatarUrl, sns, livePlatforms, livePlatformEtc } = body;
    // 셀러: 판매하는 라이브 플랫폼 (1개 이상)
    let platforms: string[] | undefined;
    let platformEtc: string | null | undefined;
    if (livePlatforms !== undefined) {
      if (u.role !== "SELLER") return fail("라이브 플랫폼은 셀러 계정만 설정합니다.");
      if (!Array.isArray(livePlatforms) || !livePlatforms.length || livePlatforms.length > 40 || !livePlatforms.every(isLivePlatform)) return fail("판매하는 라이브 플랫폼을 1개 이상 선택하세요.");
      platforms = Array.from(new Set(livePlatforms as string[]));
      platformEtc = platforms.includes("ETC") ? (typeof livePlatformEtc === "string" ? livePlatformEtc.trim().slice(0, 60) : "") || null : null;
      if (platforms.includes("ETC") && !platformEtc) return fail("기타 플랫폼 이름을 입력하세요.");
    }
    // SNS 주소: 인스타그램 · 유튜브 · 틱톡 (주소 또는 @핸들, 200자까지)
    let snsLinks: { instagram: string; youtube: string; tiktok: string } | undefined;
    if (sns !== undefined) {
      if (!sns || typeof sns !== "object" || Array.isArray(sns)) return fail("SNS 주소 형식이 올바르지 않습니다.");
      const pick = (k: string) => { const v = (sns as Record<string, unknown>)[k]; return typeof v === "string" ? v.trim().slice(0, 200) : ""; };
      snsLinks = { instagram: pick("instagram"), youtube: pick("youtube"), tiktok: pick("tiktok") };
      if (Object.values(snsLinks).some((v) => /^\s*(javascript|data):/i.test(v))) return fail("SNS 주소를 확인해 주세요.");
    }
    if ((name != null && typeof name !== "string") || (phone != null && typeof phone !== "string")) {
      return fail("이름과 연락처를 확인해 주세요.");
    }
    if ((typeof name === "string" && (name.trim().length < 1 || name.length > 40)) || (typeof phone === "string" && phone.length > 30)) {
      return fail("이름은 1~40자, 연락처는 30자 이하로 입력해 주세요.");
    }
    // 동물 캐릭터는 가입할 때 무작위로 정해지고 바꿀 수 없다 (2026-11-14)
    if (profileImageIndex !== undefined) {
      const cur = u.id.startsWith("demo-") ? null : await prisma.user.findUnique({ where: { id: u.id }, select: { profileImageIndex: true } });
      if (!isProfileImageIndex(profileImageIndex) || (cur && cur.profileImageIndex !== profileImageIndex)) {
        return fail("동물 캐릭터는 가입할 때 정해지며 바꿀 수 없습니다.", 403);
      }
    }
    if (avatarUrl !== undefined && avatarUrl !== null && !isProfilePhoto(avatarUrl)) {
      return fail("프로필 사진 형식이 올바르지 않습니다. 사진을 다시 선택해 주세요.");
    }

    // 데모 계정(admin@/manager@/seller@)은 DB 레코드가 없으므로 저장하지 않음
    if (u.id.startsWith("demo-")) {
      return ok({ demo: true, message: "데모 계정은 변경 내용이 저장되지 않습니다." });
    }

    await prisma.user.update({
      where: { id: u.id },
      data: {
        profile: {
          upsert: {
            create: { name: (name ?? u.email) as string, phone: phone ?? null, avatarUrl: avatarUrl ?? null, ...(snsLinks && { snsLinks }) },
            update: {
              ...(name != null ? { name: name as string } : {}),
              ...(phone !== undefined ? { phone: phone ?? null } : {}),
              ...(avatarUrl !== undefined ? { avatarUrl } : {}),
              ...(snsLinks ? { snsLinks } : {}),
              ...(platforms ? { livePlatforms: platforms, livePlatformEtc: platformEtc ?? null } : {}),
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
