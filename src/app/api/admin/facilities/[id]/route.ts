import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["SUPER_ADMIN"]);
    const { status } = await req.json();
    const updated = await prisma.facility.update({ where: { id: params.id }, data: { status } });
    await audit({ actorId: user.id, action: `FACILITY_${status}`, entity: "Facility", entityId: params.id });
    return ok(updated);
  } catch (e) { return handleError(e); }
}
