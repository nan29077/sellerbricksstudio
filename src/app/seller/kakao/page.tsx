import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KakaoSubscriberUpload } from "@/components/kakao-upload";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SellerKakao() {
  const user = await requireRole(["SELLER"]);
  const channels = await prisma.kakaoChannel.findMany({ where: { sellerId: user.id }, include: { subscribers: true } });
  const logs = await prisma.notificationLog.findMany({
    where: { liveSession: { sellerId: user.id } }, orderBy: { createdAt: "desc" }, take: 20,
  });

  return (
    <div>
      <PageHeader title="카카오 알림톡" description="채널 가입자를 관리하고 방송 링크를 발송하세요. (실제 키 없으면 Mock 발송)" />
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>내 카카오 채널</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {channels.length === 0 && <EmptyState title="채널이 없습니다" />}
            {channels.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-4">
                <p className="font-semibold text-navy">{c.channelName} <span className="text-sm text-muted-foreground">{c.plusFriendId}</span></p>
                <p className="text-sm text-muted-foreground mt-1">가입자 {c.subscribers.length}명</p>
                <div className="mt-3"><KakaoSubscriberUpload channelId={c.id} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>발송 로그</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? <EmptyState title="발송 내역이 없습니다" /> : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map((l) => (
                  <div key={l.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between"><span className="font-medium">{l.recipient}</span><Badge tone={l.status === "SENT" ? "green" : "red"}>{l.status}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">{l.content}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(l.createdAt)} · {l.provider}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
