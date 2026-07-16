import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { ok } from "@/lib/http";

export async function GET() {
  const u = await getSessionUser();
  if (!u) return ok({ user: null, home: "/login" });
  return ok({ user: u, home: ROLE_HOME[u.role] });
}
