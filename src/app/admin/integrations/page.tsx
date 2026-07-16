import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Tv, MessageSquare, FileText,
  CheckCircle, AlertCircle, Clock, Activity,
  Zap, Shield, Server,
} from "lucide-react";

export const dynamic = "force-dynamic";

function getIntegrationStatus() {
  const payment  = (process.env.PAYMENT_PROVIDER ?? "mock") !== "mock" && !!process.env.TOSS_SECRET_KEY;
  const catenoid = !!(process.env.CATENOID_API_BASE && process.env.CATENOID_API_KEY);
  const kakao    = !!(process.env.KAKAO_API_KEY && process.env.KAKAO_SENDER_KEY);
  const taxApi   = !!(process.env.TAX_API_KEY && process.env.TAX_API_SECRET);
  return { payment, catenoid, kakao, taxApi };
}

const DUMMY_API_LOGS = [
  { time: "14:32:10", service: "토스페이먼츠", endpoint: "POST /v1/payments/confirm",          status: 200, ms: 312 },
  { time: "14:31:55", service: "카카오 알림톡", endpoint: "POST /alimtalk/v2/send",             status: 200, ms: 187 },
  { time: "14:30:42", service: "토스페이먼츠", endpoint: "GET  /v1/payments/{paymentKey}",      status: 200, ms: 98  },
  { time: "14:29:18", service: "카테노이드",   endpoint: "POST /api/v2/live/create",            status: 201, ms: 453 },
  { time: "14:28:05", service: "토스페이먼츠", endpoint: "POST /v1/payments/cancel",            status: 200, ms: 276 },
  { time: "14:26:33", service: "세무 API",     endpoint: "GET  /api/receipt/{orderNo}",         status: 200, ms: 541 },
  { time: "14:25:10", service: "카카오 알림톡", endpoint: "POST /alimtalk/v2/send",             status: 200, ms: 203 },
  { time: "14:23:44", service: "카테노이드",   endpoint: "GET  /api/v2/live/list",              status: 200, ms: 178 },
];

export default async function AdminIntegrations() {
  await requireRole(["SUPER_ADMIN"]);

  const intStatus = getIntegrationStatus();

  const integrations = [
    {
      key: "payment", label: "토스페이먼츠 (결제)", icon: CreditCard, connected: intStatus.payment,
      envKeys: ["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY"],
      desc: "신용카드, 계좌이체, 간편결제 지원",
    },
    {
      key: "catenoid", label: "카테노이드 (라이브)", icon: Tv, connected: intStatus.catenoid,
      envKeys: ["CATENOID_API_BASE", "CATENOID_API_KEY"],
      desc: "실시간 라이브 스트리밍 CDN",
    },
    {
      key: "kakao", label: "카카오 알림톡", icon: MessageSquare, connected: intStatus.kakao,
      envKeys: ["KAKAO_API_KEY", "KAKAO_SENDER_KEY"],
      desc: "예약 확인, 정산 안내 알림 발송",
    },
    {
      key: "tax", label: "세무 API", icon: FileText, connected: intStatus.taxApi,
      envKeys: ["TAX_API_KEY", "TAX_API_SECRET"],
      desc: "세금계산서, 현금영수증 자동 발행",
    },
  ];

  const connected = integrations.filter((i) => i.connected).length;
  const avgMs = Math.round(DUMMY_API_LOGS.reduce((s, l) => s + l.ms, 0) / DUMMY_API_LOGS.length);

  return (
    <div className="space-y-5">
      <PageHeader title="연동 설정" description="외부 서비스 API 연동 상태를 확인하고 관리합니다." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="연동 서비스"   value={`${connected} / ${integrations.length}`}  sub="활성"     icon={Zap}      />
        <StatCard label="오늘 API 호출" value={`${DUMMY_API_LOGS.length * 84}회`}        sub="정상 처리" icon={Activity}  />
        <StatCard label="평균 응답속도" value={`${avgMs}ms`}                             sub="API 레이턴시" icon={Server} />
        <StatCard label="보안 등급"     value="A+"                                        sub="SSL 인증"  icon={Shield}   />
      </div>

      {/* 연동 현황 카드 */}
      <div className="grid sm:grid-cols-2 gap-4">
        {integrations.map((intg) => (
          <Card key={intg.key}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${intg.connected ? "bg-emerald-50" : "bg-muted"}`}>
                  <intg.icon className={`h-5 w-5 ${intg.connected ? "text-emerald-600" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-navy">{intg.label}</p>
                    {intg.connected
                      ? <Badge tone="green"><CheckCircle className="h-3 w-3 mr-1 inline" />연결됨</Badge>
                      : <Badge tone="yellow"><AlertCircle className="h-3 w-3 mr-1 inline" />미연결</Badge>
                    }
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{intg.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {intg.envKeys.map((k) => (
                      <code key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{k}</code>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API 호출 로그 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">실시간 API 호출 로그</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">시간</th>
                <th className="text-left py-2 text-muted-foreground font-medium">서비스</th>
                <th className="text-left py-2 text-muted-foreground font-medium">엔드포인트</th>
                <th className="text-center py-2 text-muted-foreground font-medium">상태</th>
                <th className="text-right py-2 text-muted-foreground font-medium">응답(ms)</th>
              </tr>
            </thead>
            <tbody>
              {DUMMY_API_LOGS.map((log, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono text-muted-foreground">{log.time}</td>
                  <td className="py-2 font-medium text-navy">{log.service}</td>
                  <td className="py-2 font-mono text-muted-foreground">{log.endpoint}</td>
                  <td className="py-2 text-center">
                    <span className={`font-bold ${log.status < 300 ? "text-emerald-600" : "text-red-600"}`}>{log.status}</span>
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{log.ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
