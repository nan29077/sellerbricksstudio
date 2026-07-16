// KakaoAlimtalkAdapter: 알림톡 발송. 키 없으면 notification_logs 에 mock 로그만 저장.
import { prisma } from "../prisma";

export interface SendAlimtalkInput {
  liveSessionId?: string; channelId?: string; templateCode: string;
  recipients: { name?: string | null; phone: string }[];
  content: string; // 변수 치환 완료된 본문
}
export interface SendResult { total: number; sent: number; failed: number; provider: string; }

export interface KakaoAlimtalkAdapter {
  readonly provider: string;
  sendAlimtalk(input: SendAlimtalkInput): Promise<SendResult>;
  getSendResult(logId: string): Promise<{ status: string } | null>;
  validateTemplate(content: string): { valid: boolean; error?: string };
  uploadSubscribersCsv(channelId: string, csv: string): Promise<{ inserted: number }>;
}

export class MockKakaoAlimtalkAdapter implements KakaoAlimtalkAdapter {
  readonly provider = "mock";

  async sendAlimtalk(input: SendAlimtalkInput): Promise<SendResult> {
    let sent = 0;
    for (const r of input.recipients) {
      await prisma.notificationLog.create({
        data: {
          liveSessionId: input.liveSessionId, channelId: input.channelId,
          templateCode: input.templateCode, recipient: r.phone,
          content: input.content, status: "SENT", provider: this.provider,
        },
      });
      sent++;
    }
    return { total: input.recipients.length, sent, failed: 0, provider: this.provider };
  }

  async getSendResult(logId: string) {
    const log = await prisma.notificationLog.findUnique({ where: { id: logId } });
    return log ? { status: log.status } : null;
  }

  validateTemplate(content: string) {
    if (!content || content.length < 5) return { valid: false, error: "템플릿 내용이 너무 짧습니다." };
    if (content.length > 1000) return { valid: false, error: "템플릿이 1000자를 초과합니다." };
    return { valid: true };
  }

  async uploadSubscribersCsv(channelId: string, csv: string) {
    // CSV 형식: name,phone (헤더 허용)
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let inserted = 0;
    for (const line of lines) {
      const [a, b] = line.split(",").map((s) => s.trim());
      if (!a && !b) continue;
      const phone = (b ?? a).replace(/[^0-9-]/g, "");
      if (!/\d{9,}/.test(phone.replace(/-/g, ""))) continue; // 헤더/잘못된 행 skip
      const name = b ? a : null;
      await prisma.kakaoSubscriber.create({ data: { channelId, name, phone } });
      inserted++;
    }
    return { inserted };
  }
}

export function getKakaoAdapter(): KakaoAlimtalkAdapter {
  const provider = process.env.KAKAO_ALIMTALK_PROVIDER ?? "mock";
  const hasKeys = process.env.KAKAO_API_KEY && process.env.KAKAO_SENDER_KEY;
  if (provider === "mock" || !hasKeys) return new MockKakaoAlimtalkAdapter();
  return new MockKakaoAlimtalkAdapter(); // TODO: 실제 어댑터 교체
}
