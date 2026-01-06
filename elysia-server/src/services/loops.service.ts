/**
 * Loops.so Service
 *
 * Transactional email service using Loops.so API
 * https://loops.so/docs/api-reference/transactional
 *
 * Uses {subject} and {content} dataVariables to pass HTML content
 */

import { config } from "../config"
import logger from "../utils/logger"

// ====================================
// TYPES
// ====================================

interface LoopsTransactionalEmailResponse {
  success: boolean
  id?: string
  error?: string
}

interface SendTransactionalEmailParams {
  senderName: string
  to: string
  subject: string
  body: string // JSON stringified object with content
}

interface OnboardingCompleteEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"
  // Extended fields for optimized template
  trialDaysRemaining?: number
  industry?: string
  topCompanies?: string[]
  // Company info for personalization
  companyName?: string
  companyDescription?: string
}

// ====================================
// CONSTANTS
// ====================================

const LOOPS_API_BASE = "https://app.loops.so/api/v1"

// ====================================
// LOCALIZATION
// ====================================

/**
 * Email texts optimized for B2B SaaS (2025 best practices):
 * - Professional yet approachable tone (no excessive exclamation marks)
 * - Value-focused messaging (80% value, 20% promotion)
 * - Single clear CTA with specific numbers
 * - Concise structure for mobile (67% B2B emails opened on mobile)
 * - Trust-building language
 *
 * @see https://www.allegrow.co/knowledge-base/b2b-email-marketing-best-practices-strategies
 * @see https://www.mailgun.com/blog/email/b2b-vs-b2c-email-engagement/
 */
/**
 * Helper: 받침 유무에 따른 조사 선택
 * - 받침 있으면: 을, 이, 은
 * - 받침 없으면: 를, 가, 는
 */
function hasKoreanBatchim(text: string): boolean {
  if (!text || text.length === 0) return false
  const lastChar = text.charCodeAt(text.length - 1)
  // 한글 유니코드 범위: 0xAC00 ~ 0xD7A3
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return false
  // 받침 = (charCode - 0xAC00) % 28
  return (lastChar - 0xac00) % 28 !== 0
}

const EMAIL_TEXTS = {
  en: {
    // Subject: conversational, personalized (50% higher open rate)
    subject: (firstName: string, leadCount: number) =>
      `${firstName}, we found ${leadCount} buyers for you`,
    subjectFallback: "Good news — your buyers are ready",
    greeting: (name: string) => `Hi ${name},`,
    // Industry-specific intro (friendly, value-focused)
    intro: (industry?: string) =>
      industry
        ? `Great news! We found ${industry} buyers and drafted your emails.`
        : "Great news! We found your buyers and drafted the emails.",
    // Stats (natural language, not bullet points)
    buyersFound: (count: number) => `<b>${count}</b> potential buyers`,
    emailsReady: (count: number) => `<b>${count}</b> personalized emails ready`,
    sequenceInfo: "3 emails over 3 days",
    trialRemaining: (days: number) => `<b>${days} days</b> left in your trial`,
    // Company personalization
    forCompany: (name: string) => `For ${name}`,
    // CTA: specific and inviting
    ctaButton: (count: number) => `See ${count} leads`,
    ctaButtonFallback: "See your leads",
    // Next step: suggestive, not commanding
    nextStep: "Take a look, tweak if needed, and launch when ready",
    // Footer (warm sign-off)
    footer: "Rinda Team",
    footerContact: "Questions? Just reply to this email",
    footerBusiness: "© 2025 Rinda AI · Daejeon, South Korea",
    defaultName: "there",
  },
  ko: {
    // 제목: 해요체, 자연스럽게 (토스 스타일)
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, 바이어 ${leadCount}명 찾았어요`,
    subjectFallback: "바이어를 찾았어요",
    greeting: (name: string) => `${name}님, 좋은 소식이에요!`,
    // 인트로: 해요체, 능동형, 공감
    intro: (industry?: string) =>
      industry
        ? `${industry} 업계 바이어를 찾았고, 이메일도 다 써뒀어요.`
        : "바이어를 찾았고, 이메일도 다 써뒀어요.",
    // 통계: 자연스러운 문장 (명사형 종결 X)
    buyersFound: (count: number) => `바이어 <b>${count}명</b> 찾았어요`,
    emailsReady: (count: number) => `이메일 <b>${count}개</b> 써뒀어요`,
    sequenceInfo: "3일에 걸쳐 3통씩 보내요",
    trialRemaining: (days: number) => `체험 기간 <b>${days}일</b> 남았어요`,
    // 회사 개인화
    forCompany: (name: string) => `${name}${hasKoreanBatchim(name) ? "을" : "를"} 위해 준비했어요`,
    // CTA: 부드럽게 권유
    ctaButton: (count: number) => `${count}명 확인하기`,
    ctaButtonFallback: "확인하기",
    // 다음 단계: 제안하듯 (Suggest over force)
    nextStep: "확인하고, 마음에 들면 바로 시작해 보세요",
    // Footer: 간결하게
    footer: "Rinda 팀",
    footerContact: "궁금한 점은 이 메일에 답장해 주세요",
    footerBusiness: "© 2025 Rinda AI · 대전, 대한민국",
    defaultName: "고객",
  },
}

// ====================================
// CORE EMAIL FUNCTION
// ====================================

/**
 * Send transactional email via Loops.so
 * Uses {subject} and {content} dataVariables to pass HTML content
 */
export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<LoopsTransactionalEmailResponse> {
  const apiKey = config.loops.apiKey
  const transactionalId = config.loops.transactionalIds.onboardingComplete

  if (!apiKey) {
    logger.warn("[Loops] API key not configured, skipping email")
    return { success: false, error: "API key not configured" }
  }

  if (!transactionalId) {
    logger.warn("[Loops] Transactional ID not configured, skipping email")
    return { success: false, error: "Transactional ID not configured" }
  }

  try {
    // Fixed sender name for consistency
    const senderName = "Rinda"

    // Sanitize recipient email
    const sanitizedTo = params.to.trim()

    // Parse body to get content
    const parsedBody = JSON.parse(params.body)

    const dataVariables = {
      senderName,
      subject: params.subject,
      ...parsedBody,
    }

    logger.info(`[Loops] Sending transactional email to ${sanitizedTo}`)

    const response = await fetch(`${LOOPS_API_BASE}/transactional`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: sanitizedTo,
        transactionalId,
        dataVariables,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[Loops] API error ${response.status}: ${errorText}`)
      return { success: false, error: `API error: ${response.status}` }
    }

    const result = (await response.json()) as { success: boolean; id?: string }
    logger.info(`[Loops] Transactional email sent successfully: ${result.id}`)

    return { success: true, id: result.id }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`[Loops] Failed to send email: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ====================================
// EMAIL TEMPLATES
// ====================================

/**
 * Create conversational HTML email content
 * Follows Toss UX Writing principles:
 * - Easy to speak (해요체)
 * - Weed cutting (군더더기 제거)
 * - Find hidden emotion (공감)
 * - Suggest over force (제안)
 *
 * Design: Card-based layout matching email-open-notification.service.ts
 *
 * @see https://toss.tech/article/8-writing-principles-of-toss
 */
function createOnboardingCompleteEmailHTML(data: OnboardingCompleteEmailData): string {
  const {
    firstName,
    leadCount,
    emailCount,
    dashboardUrl,
    language = "ko",
    trialDaysRemaining,
    industry,
    companyName,
  } = data
  const t = EMAIL_TEXTS[language]
  const name = firstName || t.defaultName
  const isKorean = language === "ko"

  // Dynamic CTA with lead count
  const ctaText = typeof t.ctaButton === "function" ? t.ctaButton(leadCount) : t.ctaButtonFallback

  // Current date for header
  const now = new Date()
  const dateStr = now.toLocaleDateString(isKorean ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Status badge text
  const badgeText = isKorean ? "바이어 발굴 완료" : "Buyers Found"

  // Headline (with proper Korean particle 을/를)
  const companyParticle = companyName && hasKoreanBatchim(companyName) ? "을" : "를"
  const headline = companyName
    ? isKorean
      ? `${companyName}${companyParticle} 위한 바이어를 찾았어요`
      : `We found buyers for ${companyName}`
    : isKorean
      ? `${name}님을 위한 바이어를 찾았어요`
      : `We found buyers for you`

  // Intro message
  const introMessage = industry
    ? isKorean
      ? `${industry} 업계의 잠재 바이어를 찾고, 맞춤 이메일을 작성해뒀어요.`
      : `We found potential buyers in the ${industry} industry and drafted personalized emails for you.`
    : isKorean
      ? `잠재 바이어를 찾고, 맞춤 이메일을 작성해뒀어요.`
      : `We found potential buyers and drafted personalized emails for you.`

  // Stats labels
  const statsLabels = isKorean
    ? { buyers: "바이어", emails: "맞춤 이메일", sequence: "발송 일정", trial: "체험 기간" }
    : { buyers: "Buyers", emails: "Emails", sequence: "Schedule", trial: "Trial" }

  // Sequence info
  const sequenceValue = isKorean ? "3일간 3단계" : "3 steps over 3 days"

  // Trial row (only if available)
  const trialRow =
    trialDaysRemaining !== undefined
      ? `
                      <tr>
                        <td style="padding: 14px 16px;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">${statsLabels.trial}</span>
                        </td>
                        <td style="padding: 14px 16px;">
                          <span style="font-size: 14px; color: #f59e0b; font-weight: 600;">${trialDaysRemaining}${isKorean ? "일 남음" : " days left"}</span>
                        </td>
                      </tr>`
      : ""

  // Next steps
  const nextStepsTitle = isKorean ? "다음 단계" : "Next Steps"
  const nextSteps = isKorean
    ? [
        "리드 목록을 확인하고 우선순위를 정하세요",
        "필요하면 이메일 내용을 수정하세요",
        "준비가 되면 캠페인을 시작하세요",
      ]
    : [
        "Review your leads and prioritize them",
        "Edit email content if needed",
        "Launch your campaign when ready",
      ]

  // Footer texts
  const footerNote = isKorean
    ? "이 리포트는 RINDA AI SDR이 자동으로 생성했습니다."
    : "This report was automatically generated by RINDA AI SDR."
  const footerBusiness = isKorean
    ? "Grinda AI · 대전, 대한민국"
    : "Grinda AI · Daejeon, South Korea"

  return `
<!DOCTYPE html>
<html lang="${isKorean ? "ko" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RINDA ${badgeText}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 48px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: 700; color: #111827;">RINDA</span>
                    <span style="font-size: 13px; color: #6b7280; margin-left: 8px;">AI SDR Agent</span>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-size: 12px; color: #9ca3af;">${dateStr}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">

                <!-- Status Header -->
                <tr>
                  <td style="padding: 24px 32px; border-bottom: 1px solid #f0f0f0;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td>
                          <span style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 600; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.5px;">${badgeText}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px;">
                          <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">
                            ${headline}
                          </h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Agent Message -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #fafafa; border-bottom: 1px solid #f0f0f0;">
                    <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.7;">
                      ${isKorean ? "안녕하세요" : "Hi"}, ${name}${isKorean ? "님" : ""}.<br><br>
                      ${introMessage}
                    </p>
                  </td>
                </tr>

                <!-- Stats Details -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">${isKorean ? "발굴 현황" : "Discovery Summary"}</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px;">
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; width: 120px;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">${statsLabels.buyers}</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #111827; font-weight: 600;">${leadCount}${isKorean ? "명" : ""}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">${statsLabels.emails}</span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                          <span style="font-size: 14px; color: #111827; font-weight: 600;">${emailCount}${isKorean ? "개" : ""}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 16px;${trialRow ? " border-bottom: 1px solid #f0f0f0;" : ""}">
                          <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">${statsLabels.sequence}</span>
                        </td>
                        <td style="padding: 14px 16px;${trialRow ? " border-bottom: 1px solid #f0f0f0;" : ""}">
                          <span style="font-size: 14px; color: #111827;">${sequenceValue}</span>
                        </td>
                      </tr>${trialRow}
                    </table>
                  </td>
                </tr>

                <!-- Next Steps Section -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px;">
                      <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">${nextStepsTitle}</p>
                      <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; color: #1e3a8a; line-height: 1.8;">
                        <li style="margin-bottom: 6px;">${nextSteps[0]}</li>
                        <li style="margin-bottom: 6px;">${nextSteps[1]}</li>
                        <li>${nextSteps[2]}</li>
                      </ul>
                    </div>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding: 0 32px 32px; text-align: center;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 0; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
                ${footerNote}
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                ${footerBusiness}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

// ====================================
// PUBLIC FUNCTIONS
// ====================================

/**
 * Send onboarding complete notification email
 *
 * Sent when lead discovery + email generation is finished
 * Helps reduce user drop-off during long onboarding process
 *
 * Subject line optimization (2025 best practices):
 * - Dynamic personalization: "{name}님, {count}명 바이어 발견"
 * - Mobile truncation safe: Important info first (35-50 chars)
 * - 46% higher open rate with personalization
 */
export async function sendOnboardingCompleteEmail(
  data: OnboardingCompleteEmailData,
): Promise<boolean> {
  const language = data.language || "ko"
  const t = EMAIL_TEXTS[language]
  const name = data.firstName || t.defaultName

  // Dynamic subject line generation
  const subject = t.subject(name, data.leadCount)

  logger.info(
    `[Loops] Preparing onboarding complete email for ${data.email} (lang: ${language}, subject: ${subject})`,
  )

  try {
    const content = createOnboardingCompleteEmailHTML(data)

    const response = await sendTransactionalEmail({
      senderName: "Rinda",
      to: data.email,
      subject,
      body: JSON.stringify({ content }),
    })

    return response.success
  } catch (error) {
    logger.error(`[Loops] Failed to send onboarding complete email: ${error}`)
    return false
  }
}

/**
 * Check if Loops.so is configured
 */
export function isLoopsConfigured(): boolean {
  return !!config.loops.apiKey && !!config.loops.transactionalIds.onboardingComplete
}
