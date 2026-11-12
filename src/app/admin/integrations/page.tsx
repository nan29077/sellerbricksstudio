import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kpi } from "@/components/list/charts";
import { formatDateTime } from "@/lib/utils";
import { addDays } from "@/lib/kst";
import { getPaymentAdapter, IMPLEMENTED_PROVIDERS } from "@/lib/adapters/payment";
import { getKakaoAdapter } from "@/lib/adapters/kakao";
import { getCatenoidAdapter } from "@/lib/adapters/catenoid";
import { Database, Mail, CreditCard, MessageCircle, Radio, HardDrive, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

// 환경변수 존재 여부만 확인한다. (값은 절대 화면에 노출하지 않음)
const has = (k: string) => !!process.env[k]?.trim();
const GROUPS = [
  { key: "db", name: "데이터베이스 (PostgreSQL)", icon: Database, required: ["DATABASE_URL"], optional: [], note: "필수. 연결 실패 시 대부분 기능이 동작하지 않습니다." },
  { key: "auth", name: "로그인 (NextAuth)", icon: ShieldCheck, required: ["NEXTAUTH_SECRET", "NEXTAUTH_URL"], optional: ["DEMO_LOGIN"], note: "배포 환경에서는 NEXTAUTH_SECRET을 길고 무작위한 값으로 설정하세요." },
  { key: "pay", name: "결제 PG", icon: CreditCard, required: ["PAYMENT_PROVIDER"], optional: ["TOSS_SECRET_KEY", "TOSS_CLIENT_KEY", "PORTONE_API_KEY", "PORTONE_API_SECRET", "PAYMENT_WEBHOOK_SECRET"], note: "미설정 시 Mock 결제로 동작합니다." },
  { key: "kakao", name: "카카오 알림톡", icon: MessageCircle, required: ["KAKAO_API_KEY", "KAKAO_SENDER_KEY"], optional: ["KAKAO_ALIMTALK_PROVIDER", "KAKAO_API_SECRET", "KAKAO_PLUS_FRIEND_ID"], note: "미설정 시 발송 로그만 저장합니다(Mock)." },
  { key: "stream", name: "카테노이드 송출", icon: Radio, required: ["CATENOID_API_BASE", "CATENOID_API_KEY"], optional: ["CATENOID_TENANT_ID"], note: "미설정 시 Mock 송출 URL을 만듭니다." },
  { key: "s3", name: "파일 저장소 (S3 호환)", icon: HardDrive, required: ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"], optional: ["S3_ENDPOINT", "S3_PUBLIC_URL", "IMAGE_HOSTS"], note: "이미지 파일 업로드. 미설정 시 개발 환경은 public/uploads 에 저장하고, 배포 환경은 업로드를 막습니다(이미지 주소 직접 입력)." },
  { key: "mail", name: "메일 발송 (Resend)", icon: Mail, required: ["RESEND_API_KEY", "MAIL_FROM"], optional: [], note: "비밀번호 재설정 · 이메일 인증 메일. 없으면 개발 환경에서는 서버 로그로만 보내고, 배포 환경에서는 발송되지 않습니다." },
];

export default async function AdminIntegrations() {
  await requireRole(["SUPER_ADMIN"]);
  let dbOk = true, dbMs = 0;
  const t = Date.now();
  try { await prisma.$queryRaw`SELECT 1`; dbMs = Date.now() - t; } catch { dbOk = false; }
  const since = addDays(new Date(), -7);
  const [notiByStatus, lastNoti, payByStatus, lastWebhook] = dbOk ? await Promise.all([
    prisma.notificationLog.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }),
    prisma.notificationLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, provider: true, status: true, error: true } }),
    prisma.payment.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }),
    prisma.paymentEvent.findFirst({ where: { type: "WEBHOOK" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]) : [[], null, [], null];
  // 키가 있어도 실제로 쓰이는 어댑터가 테스트(Mock)이면 '연동됨'으로 보이지 않게 한다.
  const provider: Record<string, string> = {
    pay: getPaymentAdapter().provider, kakao: getKakaoAdapter().provider, stream: getCatenoidAdapter().provider,
  };
  const states = GROUPS.map((g) => {
    const keys = g.key === "db" ? dbOk : g.required.every(has);
    const p = provider[g.key];
    const mock = p === "mock";
    const unsupported = g.key === "pay" && !mock && !(IMPLEMENTED_PROVIDERS as readonly string[]).includes(p);
    const ok = keys && !mock && !unsupported;
    const partial = !keys && g.required.some(has);
    const label = ok ? "연동됨" : unsupported ? "연동 준비 안 됨" : partial ? "일부 설정" : "테스트 모드";
    const tone: "green" | "yellow" | "gray" | "red" = ok ? "green" : unsupported ? "red" : partial ? "yellow" : "gray";
    const hint = g.key === "pay" && mock && process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENT !== "true" ? "배포 환경에서 테스트 결제는 막혀 있어 지금은 주문을 받을 수 없습니다. PG 연동이 필요합니다."
      : mock && keys ? "키는 입력됐지만 실제 연동 코드가 아직 없어 테스트 모드로 동작합니다." : unsupported ? `결제사 '${p}' 연동이 아직 구현되지 않아 모든 결제가 실패합니다. PAYMENT_PROVIDER=mock 으로 두거나 연동을 먼저 구현하세요.` : "";
    return { ...g, ok, partial, label, tone, hint };
  });
  const live = states.filter((s) => s.ok).length;
  const notiFail = notiByStatus.find((n) => n.status === "FAILED")?._count ?? 0;
  const notiAll = notiByStatus.reduce((s, n) => s + n._count, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="연동 설정" description="외부 서비스 연동 상태를 점검합니다. 키 값은 서버 환경변수(.env)로만 관리되며 화면에 표시하지 않습니다." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="실제 연동" value={`${live} / ${states.length}`} icon={CheckCircle2} tone="green" />
        <Kpi label="DB 응답" value={dbOk ? `${dbMs}ms` : "연결 실패"} icon={Database} tone={dbOk ? "blue" : "red"} />
        <Kpi label="알림 발송 (7일)" value={`${notiAll}건`} sub={notiFail ? `실패 ${notiFail}건` : "실패 없음"} icon={MessageCircle} tone={notiFail ? "red" : "brand"} />
        <Kpi label="결제 (7일)" value={`${payByStatus.reduce((s, p) => s + p._count, 0)}건`} sub={lastWebhook ? `마지막 웹훅 ${formatDateTime(lastWebhook.createdAt)}` : "웹훅 수신 없음"} icon={CreditCard} tone="navy" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {states.map((s) => (
          <Card key={s.key}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base"><s.icon className="h-5 w-5 text-brand-600" />{s.name}</CardTitle>
              <Badge tone={s.tone}>{s.label}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-slate-500">{s.note}</p>
              {s.hint && <p className="text-xs font-semibold text-amber-700">{s.hint}</p>}
              <div className="flex flex-wrap gap-1.5">
                {[...s.required.map((k) => ({ k, req: true })), ...s.optional.map((k) => ({ k, req: false }))].map(({ k, req }) => (
                  <span key={k} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] ${has(k) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : req ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                    {has(k) ? "✓" : req ? "!" : "–"} {k}
                  </span>
                ))}
              </div>
              {s.key === "kakao" && lastNoti && <p className="text-[11px] text-slate-500">마지막 발송 {formatDateTime(lastNoti.createdAt)} · {lastNoti.provider} · {lastNoti.status}{lastNoti.error ? ` · ${lastNoti.error}` : ""}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      {!has("NEXTAUTH_SECRET") || process.env.NEXTAUTH_SECRET === "change-me" ? (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />NEXTAUTH_SECRET이 비어 있거나 기본값입니다. 배포 전에 반드시 변경하세요.</p>
      ) : null}
    </div>
  );
}
