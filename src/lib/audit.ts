import { prisma } from "./prisma";

export async function audit(params: {
  actorId?: string | null; action: string; entity: string; entityId?: string | null; meta?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null, action: params.action, entity: params.entity,
        entityId: params.entityId ?? null,
        meta: params.meta ? JSON.stringify(params.meta) : null,
      },
    });
  } catch (e) { /* audit 실패는 무시 */ }
}
