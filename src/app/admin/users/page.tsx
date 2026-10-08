import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { Users, ShieldCheck, Store, Warehouse, Briefcase } from "lucide-react";
import { RegisterManagerButton } from "./RegisterManagerModal";

export const dynamic = "force-dynamic";

const ROLE_ICONS: Record<string, React.ElementType> = {
  SUPER_ADMIN:    ShieldCheck,
  SELLER:         Store,
  FACILITY_ADMIN: Warehouse,
  MANAGER:        Briefcase,
};

const ROLE_COLORS: Record<string, "navy" | "default" | "green" | "blue" | "gray"> = {
  SUPER_ADMIN:    "navy",
  SELLER:         "default",
  FACILITY_ADMIN: "green",
  MANAGER:        "blue",
  BUYER:          "gray",
};

const DUMMY_USERS: any[] = [
  { id:"u1",  email:"admin@sellerbricks.kr",    role:"SUPER_ADMIN",    isActive:true,  createdAt:new Date("2026-01-01"), profile:{ name:"최고관리자" } },
  { id:"u2",  email:"manager@sellerbricks.kr",  role:"MANAGER",        isActive:true,  createdAt:new Date("2026-01-15"), profile:{ name:"중간관리자 (영업담당)" } },
  { id:"u3",  email:"facility@sellerbricks.kr", role:"FACILITY_ADMIN", isActive:true,  createdAt:new Date("2026-02-01"), profile:{ name:"창고(스튜디오) 관리자 (김대영)" } },
  { id:"u4",  email:"seller@sellerbricks.kr",   role:"SELLER",         isActive:true,  createdAt:new Date("2026-02-10"), profile:{ name:"셀러 (박지현)" } },
  { id:"u5",  email:"seller2@example.com",       role:"SELLER",         isActive:true,  createdAt:new Date("2026-03-05"), profile:{ name:"홍길동" } },
  { id:"u6",  email:"seller3@example.com",       role:"SELLER",         isActive:false, createdAt:new Date("2026-03-20"), profile:{ name:"이수민" } },
  { id:"u7",  email:"facility2@example.com",     role:"FACILITY_ADMIN", isActive:true,  createdAt:new Date("2026-04-01"), profile:{ name:"창고(스튜디오) 관리자 (최정호)" } },
  { id:"u8",  email:"manager2@example.com",      role:"MANAGER",        isActive:true,  createdAt:new Date("2026-04-15"), profile:{ name:"영업팀장 (권도현)" } },
  { id:"u9",  email:"seller4@example.com",       role:"SELLER",         isActive:true,  createdAt:new Date("2026-05-01"), profile:{ name:"김미래" } },
  { id:"u10", email:"seller5@example.com",       role:"SELLER",         isActive:true,  createdAt:new Date("2026-05-20"), profile:{ name:"정유나" } },
];

export default async function AdminUsers() {
  await requireRole(["SUPER_ADMIN"]);

  let users: any[] = [];
  let counts = { total: 0, sellers: 0, facilityAdmins: 0, managers: 0, active: 0 };

  try {
    users = await prisma.user.findMany({ include: { profile: true }, orderBy: { createdAt: "desc" } });
    if (users.length === 0) users = DUMMY_USERS;
  } catch {
    users = DUMMY_USERS;
  }

  counts = {
    total:         users.length,
    sellers:       users.filter((u) => u.role === "SELLER").length,
    facilityAdmins:users.filter((u) => u.role === "FACILITY_ADMIN").length,
    managers:      users.filter((u) => u.role === "MANAGER").length,
    active:        users.filter((u) => u.isActive).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <PageHeader title="회원 관리" description="전체 회원 목록 및 상태 관리" />
        <RegisterManagerButton />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "전체 회원",  value: counts.total,         icon: Users,     color: "text-blue-600 bg-blue-50"     },
          { label: "셀러",       value: counts.sellers,       icon: Store,     color: "text-brand-600 bg-brand-50"   },
          { label: "창고(스튜디오) 관리자", value: counts.facilityAdmins, icon: Warehouse, color: "text-emerald-600 bg-emerald-50"},
          { label: "중간관리자", value: counts.managers,      icon: Briefcase, color: "text-purple-600 bg-purple-50" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.color} shrink-0`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-extrabold text-navy">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <Table
            headers={["이름", "이메일", "역할", "상태", "가입일"]}
            rows={users.map((u) => {
              const Icon = ROLE_ICONS[u.role] ?? Users;
              const tone = ROLE_COLORS[u.role] ?? "gray";
              return [
                <span key="name" className="font-semibold text-navy">{u.profile?.name ?? "-"}</span>,
                <Td key="email">{u.email}</Td>,
                <Badge key="role" tone={tone}>
                  <Icon className="h-3 w-3 mr-1 inline" />
                  {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                </Badge>,
                <Badge key="active" tone={u.isActive ? "green" : "gray"}>{u.isActive ? "활성" : "비활성"}</Badge>,
                <Td key="date">{formatDate(u.createdAt)}</Td>,
              ];
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
