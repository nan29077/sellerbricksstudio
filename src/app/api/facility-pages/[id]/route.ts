import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handleError, ok } from "@/lib/http";
import {
  FACILITY_PAGE_THEMES,
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
  profileImageUrl: z.string().trim().min(1).max(500).refine(
    (value) => value.startsWith("/images/profiles/") || value.startsWith("https://") || value.startsWith("http://"),
    "프로필 이미지는 기본 이미지 경로 또는 http(s) URL이어야 합니다.",
  ),
  theme: z.enum(Object.keys(FACILITY_PAGE_THEMES) as ["gold", "blue", "green", "coral"]),
  ctaLabel: z.string().trim().min(2).max(30),
  showEquipment: z.boolean(),
  showSchedule: z.boolean(),
  showProducts: z.boolean(),
});

async function ownedFacility(id: string, ownerId: string) {
  return prisma.facility.findFirst({
    where: { id, ownerId },
    select: { id: true, name: true, type: true, description: true },
  });
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["FACILITY_ADMIN"]);
    const facility = await ownedFacility(params.id, user.id);
    if (!facility) return fail("내 시설만 편집할 수 있습니다.", 403);
    const setting = await prisma.setting.findUnique({ where: { key: facilityPageSettingKey(params.id) } });
    return ok(parseFacilityPageConfig(facility, setting?.value));
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["FACILITY_ADMIN"]);
    const facility = await ownedFacility(params.id, user.id);
    if (!facility) return fail("내 시설만 편집할 수 있습니다.", 403);
    const data = pageSchema.parse(await req.json());
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
      meta: { theme: data.theme, bannerUrl: data.bannerUrl },
    });
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
