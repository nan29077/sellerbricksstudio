import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { ShieldCheck, AlertCircle, LogIn, Edit3, PlusCircle, XCircle, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_LOGS = [
  { id:"l1",  createdAt:new Date("2026-06-18T14:32:00"), actor:"최고관리자",        role:"SUPER_ADMIN",    action:"APPROVE", entity:"Facility", detail:"강남 프리미엄 라이브 스튜디오 승인 처리",   severity:"info"    },
  { id:"l2",  createdAt:new Date("2026-06-18T14:15:00"), actor:"시설 운영자 (김대영)", role:"FACILITY_ADMIN", action:"UPDATE",  entity:"Facility", detail:"시설 프로필 정보 수정",                    severity:"info"    },
  { id:"l3",  createdAt:new Date("2026-06-18T13:55:00"), actor:"셀러 (박지현)",     role:"SELLER",         action:"CREATE",  entity:"Booking",  detail:"예약 신청 - 강남 스튜디오 6/22 14:00",    severity:"info"    },
  { id:"l4",  createdAt:new Date("2026-06-18T13:20:00"), actor:"최고관리자",        role:"SUPER_ADMIN",    action:"UPDATE",  entity:"User",     detail:"회원 비활성화 처리",                       severity:"warning" },
  { id:"l5",  createdAt:new Date("2026-06-18T12:45:00"), actor:"셀러 (홍길동)",     role:"SELLER",         action:"LOGIN",   entity:"Auth",     detail:"로그인 성공",                              severity:"info"    },
  { id:"l6",  createdAt:new Date("2026-06-17T16:30:00"), actor:"최고관리자",        role:"SUPER_ADMIN",    action:"CREATE",  entity:"User",     detail:"중간관리자 계정 생성",                     severity:"info"    },
  { id:"l7",  createdAt:new Date("2026-06-17T15:00:00"), actor:"Unknown",           role:"UNKNOWN",        action:"LOGIN",   entity:"Auth",     detail:"로그인 실패 (5회 연속)",                   severity:"error"   },
  { id:"l8",  createdAt:new Date("2026-06-17T14:10:00"), actor:"시설 운영자 (최정호)", role:"FACILITY_ADMIN", action:"CREATE",  entity:"Product",  detail:"상품 등록 - 홍삼 진액 세트",               severity:"info"    },
];

const ACTION_ICONS: Record<string, typeof Activity> = {
  APPROVE: ShieldCheck,
  UPDATE:  Edit3,
  CREATE:  PlusCircle,
  DELETE:  XCircle,
  LOGIN:   LogIn,
};

const SEVERITY_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  info:    { bg: "bg-blue-50",   text: "text-blue-700",  dot: "bg-blue-400"   },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700",dot: "bg-yellow-400" },
  error:   { bg: "bg-red-50",    text: "text-red-700",   dot: "bg-red-500"    },
};

export default async function AdminAuditLogs() {
  await requireRole(["SUPER_ADMIN"]);

  let logs = DUMMY_LOGS;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch { /* DB 없음 */ }

  const infoCount    = logs.filter((l) => l.severity === "info").length;
  const warningCount = logs.filter((l) => l.severity === "warning").length;
  const errorCount   = logs.filter((l) => l.severity === "error").length;

  return (
    <div className="space-y-5">
      <PageHeader title="감사 로그" description="시스템 내 주요 행동 이력을 조회합니다." />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="일반"    value={`${infoCount}건`}    sub="정보성"   icon={Activity}       />
        <StatCard label="경고"    value={`${warningCount}건`} sub="주의 필요" icon={AlertCircle}   />
        <StatCard label="오류"    value={`${errorCount}건`}   sub="즉시 확인" icon={XCircle}       />
      </div>

      <Card>
        <CardContent className="pt-5 space-y-2">
          {logs.map((log) => {
            const Icon = ACTION_ICONS[log.action] ?? Activity;
            const sev = SEVERITY_MAP[log.severity] ?? SEVERITY_MAP.info;
            return (
              <div key={log.id} className={`flex items-start gap-3 rounded-xl p-3 ${sev.bg}`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shrink-0 shadow-sm">
                  <Icon className={`h-4 w-4 ${sev.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${sev.text}`}>{log.actor}</span>
                    <span className="text-xs text-muted-foreground">{log.role}</span>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                    <span className="text-xs font-semibold text-navy">{log.action}</span>
                    <span className="text-xs text-muted-foreground">on {log.entity}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{formatDateTime(log.createdAt)}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
