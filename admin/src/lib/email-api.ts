import type { EmailRecipient } from "./email-service";

type SendBulkParams = {
  recipients: EmailRecipient[];
  subject?: string;
  text?: string;
  delayMs?: number;
};

export async function sendBulkEmails({ recipients, subject, text, delayMs = 500 }: SendBulkParams) {
  // Stub: simulate async bulk send
  await new Promise((r) => setTimeout(r, Math.min(Math.max(delayMs, 100), 2000)));

  if (!recipients || recipients.length === 0) {
    return { ok: false, error: "수신자 목록이 비어 있습니다." } as const;
  }

  return {
    ok: true,
    message: `${recipients.length}개의 이메일 발송이 시작되었습니다.`,
    result: {
      sent: recipients.length,
      subject: subject ?? null,
      text: text ?? null,
    },
  } as const;
}


