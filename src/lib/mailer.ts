// 메일 발송 어댑터.
//  - RESEND_API_KEY + MAIL_FROM 이 있으면 Resend API 로 발송한다. (https://resend.com — 도메인 인증 후 사용)
//  - 없으면 개발 환경에서는 서버 로그에 내용을 남기고, 화면에 확인용 링크를 보여 준다.
//  - 배포 환경에서 설정이 없으면 발송하지 못한 것으로 처리한다(관리자 > 연동 설정에서 확인).
export type MailResult = { sent: boolean; provider: "resend" | "console" | "none"; error?: string };

export function mailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  if (mailConfigured()) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
      });
      if (!res.ok) return { sent: false, provider: "resend", error: `HTTP ${res.status}` };
      return { sent: true, provider: "resend" };
    } catch (e) {
      return { sent: false, provider: "resend", error: e instanceof Error ? e.message : "send failed" };
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    return { sent: true, provider: "console" };
  }
  console.error(`[mail] 메일 설정(RESEND_API_KEY, MAIL_FROM)이 없어 발송하지 못했습니다: ${subject}`);
  return { sent: false, provider: "none", error: "메일 설정 없음" };
}

export function appUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3007").replace(/\/$/, "");
  return `${base}${path}`;
}
