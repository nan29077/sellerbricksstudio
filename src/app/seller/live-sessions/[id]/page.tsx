import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveSessionControls } from "@/components/live-session-controls";
import { LIVE_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import { getDemoLiveSession } from "@/lib/live-demo";
import { getSettings } from "@/lib/settings";
import { Hash, Radio, ExternalLink, Tv, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LiveSessionDetail({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await getSettings()).liveEnabled) redirect(user.role === "FACILITY_ADMIN" ? "/facility/dashboard" : "/seller/dashboard");

  // 실제 DB 세션 조회. 없으면 데모(더미) 세션으로 fallback 하여
  // 목록에 표시된 샘플 카드의 "상세보기"도 정상적으로 열리게 한다.
  const dbSession = await prisma.liveSession.findUnique({
    where: { id: params.id },
    include: {
      facility: true, streamChannels: true,
      _count: { select: { products: true, orders: true } },
    },
  });

  const demo = dbSession ? null : getDemoLiveSession(params.id);
  if (!dbSession && !demo) notFound();

  const isDemo = !dbSession;
  const session: any = dbSession ?? demo;

  // 실제 세션일 때만 소유권 검증 (데모 세션은 로그인 사용자 누구나 열람 가능)
  if (
    dbSession &&
    session.sellerId !== user.id &&
    user.role !== "SUPER_ADMIN" &&
    session.facility.ownerId !== user.id
  ) {
    redirect("/seller/live-sessions");
  }

  const channels = isDemo
    ? []
    : await prisma.kakaoChannel.findMany({
        where: { sellerId: session.sellerId }, include: { _count: { select: { subscribers: true } } },
      });
  const st = LIVE_STATUS[session.status] ?? { label: session.status, tone: "gray" as const };

  return (
    <div>
      <PageHeader title={session.title} description={session.facility.name}
        action={isDemo ? undefined : <Link href={`/seller/live-sessions/${session.id}/numbering`}><Button><Hash className="h-5 w-5" />상품번호 관리</Button></Link>} />

      {isDemo && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>샘플(데모) 라이브 세션입니다. 실제 방송 제어·알림톡 발송은 승인된 예약으로 세션을 생성한 후 이용할 수 있습니다.</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5 text-brand-500" />방송 상태 <Badge tone={st.tone}>{st.label}</Badge></CardTitle></CardHeader>
            <CardContent>
              {isDemo
                ? <p className="text-sm text-muted-foreground">데모 세션은 방송 상태를 변경할 수 없습니다.</p>
                : <LiveSessionControls sessionId={session.id} status={session.status} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Tv className="h-5 w-5 text-brand-500" />송출 정보</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">구매자용 방송 링크</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{session.buyerLinkUrl}</code>
                  <Link href={`/live/${session.slug}`} target="_blank"><Button size="sm" variant="outline"><ExternalLink className="h-4 w-4" />열기</Button></Link>
                </div>
              </div>
              <div><p className="text-muted-foreground mb-1">자체 송출 URL (카테노이드 · Mock)</p><code className="block truncate rounded bg-muted px-2 py-1.5 text-xs">{session.selfStreamUrl ?? "-"}</code></div>
              <div><p className="text-muted-foreground mb-1">재생 URL</p><code className="block truncate rounded bg-muted px-2 py-1.5 text-xs">{session.catenoidPlaybackUrl ?? "-"}</code></div>
              <div>
                <p className="text-muted-foreground mb-1">연결 채널</p>
                <div className="flex flex-wrap gap-2">{session.streamChannels.map((c: any) => <Badge key={c.id} tone="navy">{c.type}</Badge>)}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>요약</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">판매 상품</span><span className="font-semibold">{session._count.products}개</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">주문</span><span className="font-semibold">{session._count.orders}건</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">예약 시작</span><span className="font-semibold">{session.scheduledStart ? formatDateTime(session.scheduledStart) : "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">알림톡</span><Badge tone={session.alimtalkStatus === "SENT" ? "green" : "gray"}>{session.alimtalkStatus === "SENT" ? "발송됨" : "미발송"}</Badge></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>카카오 알림톡 발송</CardTitle></CardHeader>
            <CardContent>
              {isDemo
                ? <p className="text-sm text-muted-foreground">데모 세션에서는 알림톡을 발송할 수 없습니다.</p>
                : <LiveSessionControls.Alimtalk sessionId={session.id}
                    channels={channels.map((c) => ({ id: c.id, name: c.channelName, count: c._count.subscribers }))} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
