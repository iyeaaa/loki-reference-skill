import type { ThreadEmail } from "@/lib/api/types/email"

/**
 * 답장 제목 생성
 */
export function generateReplySubject(originalSubject: string | null | undefined): string {
  const subject = originalSubject || "(제목 없음)"
  const normalized = subject.trim().toLowerCase()

  // 이미 Re:로 시작하면 그대로 반환
  if (normalized.startsWith("re:")) {
    return subject.trim()
  }

  return `Re: ${subject.trim()}`
}

/**
 * 원본 이메일 인용문 생성 (Plain Text)
 */
export function generateQuotedText(email: ThreadEmail): string {
  const date = new Date(email.createdAt).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const content = email.bodyText || stripHtmlTags(email.bodyHtml) || ""

  return `


────────────────────────────────────────
${date}에 ${email.fromEmail}님이 작성:

${content
  .split("\n")
  .map((line) => `> ${line}`)
  .join("\n")}`
}

/**
 * 원본 이메일 인용문 생성 (HTML)
 */
export function generateQuotedHtml(email: ThreadEmail): string {
  const date = new Date(email.createdAt).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const content = email.bodyHtml || email.bodyText || ""

  return `
<br><br>
<div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 0; color: #666;">
  <div style="margin-bottom: 10px; font-size: 13px; color: #666;">
    <strong>${date}</strong>에 <strong>${email.fromEmail}</strong>님이 작성:
  </div>
  ${content}
</div>`
}

/**
 * HTML 태그 제거
 */
export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, "").trim()
}

/**
 * 기본 수신자 결정 (답장 시)
 */
export function getReplyRecipient(originalEmail: ThreadEmail): string {
  // 인바운드 이메일의 경우 발신자에게 답장
  if (originalEmail.direction === "inbound") {
    return originalEmail.fromEmail
  }

  // 아웃바운드 이메일의 경우 수신자에게 답장
  return originalEmail.toEmail
}

/**
 * 이메일 주소 유효성 검사
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return regex.test(email.trim())
}

/**
 * 쉼표/세미콜론으로 구분된 이메일 목록 파싱
 */
export function parseEmailList(input: string): string[] {
  return input
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter((e) => e && isValidEmail(e))
}

/**
 * 이메일 주소에서 이름 추출
 */
export function extractNameFromEmail(email: string): string {
  return email.split("@")[0]
}
