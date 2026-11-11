import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify, notifyAdmins } from "@/lib/notify";

// 셀러 · 중간관리자 정산 계좌 (판매 정산 · 영업 수수료 지급용)
//  - 이미 등록된 계좌를 바꿀 때는 현재 비밀번호로 본인 확인하고, 최고관리자에게 알린다.
const mask = (v: string) => (v.length <= 4 ? "****" : `${"*".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`);
const schema = z.object({
  bankName: z.string().trim().min(2, "은행명을 입력하세요.").max(30),
  bankAccount: z.string().trim().min(6, "계좌번호를 확인하세요.").max(40).regex(/^[0-9-]+$/, "계좌번호는 숫자와 - 만 입력하세요."),
  accountHolder: z.string().trim().min(1, "예금주를 입력하세요.").max(40),
  currentPassword: z.string().max(100).optional(),
});

export async function GET() {
  try {
    const user = await requireRole(["SELLER", "MANAGER"]);
    const p = await prisma.profile.findUnique({ where: { userId: user.id }, select: { bankName: true, bankAccount: true, accountHolder: true, bankChangedAt: true } });
    return ok({ bankName: p?.bankName ?? "", bankAccount: p?.bankAccount ? mask(p.bankAccount) : "", accountHolder: p?.accountHolder ?? "", registered: !!p?.bankAccount, changedAt: p?.bankChangedAt ?? null });
  } catch (e) { return handleError(e); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER", "MANAGER"]);
    if (user.id.startsWith("demo-")) return fail("데모 계정은 정산 계좌를 저장할 수 없습니다. 회원가입 후 이용해 주세요.");
    const data = schema.parse(await req.json().catch(() => ({})));
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, email: true, profile: { select: { id: true, name: true, bankAccount: true, bankName: true, accountHolder: true } } } });
    if (!row) return fail("계정을 찾을 수 없습니다.", 404);
    const before = row.profile;
    const replacing = !!before?.bankAccount;
    const same = before?.bankAccount === data.bankAccount && before?.bankName === data.bankName && before?.accountHolder === data.accountHolder;
    if (same) return ok({ saved: true, unchanged: true });
    if (replacing && (!data.currentPassword || !(await bcrypt.compare(data.currentPassword, row.passwordHash)))) {
      return fail("등록된 정산 계좌를 바꾸려면 현재 비밀번호를 정확히 입력해 주세요.", 403);
    }
    const values = { bankName: data.bankName, bankAccount: data.bankAccount, accountHolder: data.accountHolder, bankChangedAt: new Date() };
    await prisma.profile.upsert({ where: { userId: user.id }, update: values, create: { userId: user.id, name: user.name ?? row.email, ...values } });
    await audit({ actorId: user.id, action: "PAYOUT_ACCOUNT_SAVE", entity: "Profile", entityId: user.id, meta: { bankAccount: `${before?.bankAccount ? mask(before.bankAccount) : "(없음)"} → ${mask(data.bankAccount)}` } });
    if (replacing) {
      await notifyAdmins({ type: "SYSTEM", title: `정산 계좌 변경 · ${before?.name ?? row.email}`, body: "지급 전에 변경 내용을 확인해 주세요.", link: "/admin/payouts" });
      await notify({ userId: user.id, type: "SYSTEM", title: "정산 계좌가 변경되었습니다", body: "본인이 변경하지 않았다면 즉시 비밀번호를 바꾸고 고객센터에 알려 주세요." });
    }
    return ok({ saved: true });
  } catch (e) { return handleError(e); }
}
