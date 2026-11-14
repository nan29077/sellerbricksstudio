import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handleError, ok } from "@/lib/http";
import { isShopImageUrl } from "@/lib/shop-artwork";
import { canOperateFacility, FACILITY_OPERATOR_ROLES } from "@/lib/facility-owner";
import {
  FACILITY_PAGE_THEMES,
  defaultProfileFor,
  facilityPageSettingKey,
  parseFacilityPageConfig,
} from "@/lib/facility-page";

const pageSchema = z.object({
  pageTitle: z.string().trim().min(2).max(60),
  tagline: z.string().trim().min(2).max(100),
  intro: z.string().trim().min(10).max(1000),
  bannerUrl: z.string().trim().min(1).max(500).refine(
    (value) => value.startsWith("/images/") || value.startsWith("https://") || value.startsWith("http://"),
    "배너는 이미지 경로 또는 http(s) URL이어야 합니다.",
  ),
  profileImageUrl: z.string().trim().max(500).refine(
    (value) => !value || isShopImageUrl(value) || value.startsWith("http://"),
    "프로필 이미지 주소를 확인해 주세요.",
  ),
  backgroundUrl: z.string().trim().max(500).refine(isShopImageUrl, "여백 이미지는 이미지 경로 또는 HTTPS 주소를 사용해 주세요.").optional(),
  theme: z.enum(Object.keys(FACILITY_PAGE_THEMES) as ["gold", "blue", "green", "coral"]),
  ctaLabel: z.string().trim().min(2).max(30),
  showEquipment: z.boolean(),
  showSchedule: z.boolean(),
  showProducts: z.boolean(),
});

// 창고 운영자(최고관리자 · 담당 매니저)만 창고 샵을 편집한다
async function editableFacility(id: string, user: SessionUser) {
  if (!(await canOperateFacility(user, id))) return null;
  return prisma.facility.findFirst({
    where: { id },
    select: { id: true, name: true, type: true, description: true },
  });
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(FACILITY_OPERATOR_ROLES);
    const facility = await editableFacility(params.id, user);
    if (!facility) return fail("운영하는 창고(스튜디오)만 편집할 수 있습니다.", 403);
    const setting = await prisma.setting.findUnique({ where: { key: facilityPageSettingKey(params.id) } });
    return ok(parseFacilityPageConfig(facility, setting?.value));
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(FACILITY_OPERATOR_ROLES);
    const facility = await editableFacility(params.id, user);
    if (!facility) return fail("운영하는 창고(스튜디오)만 편집할 수 있습니다.", 403);
    const input = pageSchema.parse(await req.json());
    const setting = input.backgroundUrl ? null : await prisma.setting.findUnique({ where: { key: facilityPageSettingKey(params.id) } });
    const data = {
      ...input,
      profileImageUrl: input.profileImageUrl || defaultProfileFor(facility.id),
      backgroundUrl: input.backgroundUrl ?? parseFacilityPageConfig(facility, setting?.value).backgroundUrl,
    };
    await prisma.setting.upsert({
      where: { key: facilityPageSettingKey(params.id) },
      create: { key: facilityPageSettingKey(params.id), value: JSON.stringify(data) },
      update: { value: JSON.stringify(data) },
    });
    await audit({
      actorId: user.id,
      action: "FACILITY_PAGE_UPDATE",
      entity: "Facility",
      entityId: params.id,
      meta: { theme: data.theme, bannerUrl: data.bannerUrl, backgroundUrl: data.backgroundUrl },
    });
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
