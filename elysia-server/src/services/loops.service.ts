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
}

// ====================================
// CONSTANTS
// ====================================

const LOOPS_API_BASE = "https://app.loops.so/api/v1"

// ====================================
// LOCALIZATION
// ====================================

const EMAIL_TEXTS = {
  en: {
    // Dynamic subject line (mobile truncation optimized: important info first)
    subject: (firstName: string, leadCount: number) => `${firstName}, ${leadCount} buyers found`,
    subjectFallback: "Your buyer list is ready",
    title: "Everything is ready!",
    greeting: (name: string) => `Hi ${name},`,
    // Industry-specific intro
    intro: (industry?: string) =>
      industry
        ? `Your ${industry} buyer list and email drafts are ready.`
        : "Rinda AI has prepared your buyer list and email drafts.",
    leadsFound: "Buyers Found",
    emailsGenerated: "Emails Ready",
    ctaButton: "View Campaign →",
    // Trial remaining
    trialRemaining: (days: number) => `${days} days left in your trial`,
    // Top companies
    topCompaniesTitle: "Top Companies Found",
    topCompaniesMore: (count: number) => `and ${count} more`,
    // Tip section (action-oriented)
    tip: {
      title: "Tip",
      text: "Email drafts are AI-generated. Review and send right away!",
    },
    // Next steps (correct flow: already connected email)
    nextStepsTitle: "NEXT STEPS",
    nextSteps: [
      { text: "Review your buyer list", time: null },
      { text: "Check and edit email drafts", time: null },
      { text: "Start your campaign!", time: null },
    ],
    footer: "This email is a notification for completing Rinda AI onboarding.",
    footerContact: "For inquiries, please contact admin@grinda.ai",
    defaultName: "there",
  },
  ko: {
    // 동적 제목줄 (모바일 truncation 최적화: 중요 정보 먼저)
    subject: (firstName: string, leadCount: number) => `${firstName}님, ${leadCount}명 바이어 발견`,
    subjectFallback: "바이어 리스트가 준비되었습니다",
    title: "모든 준비가 완료되었습니다!",
    greeting: (name: string) => `안녕하세요 ${name}님,`,
    // 산업별 맞춤 인트로
    intro: (industry?: string) =>
      industry
        ? `${industry} 업계 바이어 리스트와 이메일 초안이 준비되었습니다.`
        : "린다(Rinda) AI가 바이어 리스트와 이메일 초안을 준비했습니다.",
    leadsFound: "발견된 바이어",
    emailsGenerated: "준비된 이메일",
    ctaButton: "캠페인 확인하러 가기 →",
    // 체험판 잔여 기간
    trialRemaining: (days: number) => `체험판 종료까지 ${days}일 남았습니다`,
    // 상위 기업
    topCompaniesTitle: "발견된 주요 기업",
    topCompaniesMore: (count: number) => `외 ${count}개`,
    // Tip 섹션 (행동 유도)
    tip: {
      title: "Tip",
      text: "이메일 초안은 AI가 작성했어요. 검토 후 바로 발송할 수 있습니다.",
    },
    // 다음 단계 (올바른 플로우: 이미 이메일 연동됨)
    nextStepsTitle: "다음 단계",
    nextSteps: [
      { text: "발견된 바이어 리스트 확인하기", time: null },
      { text: "이메일 초안 검토 및 수정하기", time: null },
      { text: "캠페인 시작하기!", time: null },
    ],
    footer: "이 이메일은 린다 AI 온보딩 완료 알림입니다.",
    footerContact: "문의사항이 있으시면 admin@grinda.ai로 연락해주세요.",
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
 * Create HTML content for onboarding complete email
 * Uses table-based layout for maximum email client compatibility
 * Professional, modern design with refined aesthetics
 *
 * Design Features:
 * - Clean, minimal header with brand identity
 * - Refined color palette (professional blues/purples)
 * - Generous whitespace and clear hierarchy
 * - Subtle shadows and refined borders
 * - Action-oriented CTA with hover states
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
    topCompanies,
  } = data
  const t = EMAIL_TEXTS[language]
  const name = firstName || t.defaultName

  // Build top companies HTML if available
  const topCompaniesHtml =
    topCompanies && topCompanies.length > 0
      ? `
              <!-- Top Companies Found -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td style="background-color: #FAFAFA; border-radius: 10px; padding: 16px 20px; border: 1px solid #F0F0F0;">
                    <div style="font-size: 11px; font-weight: 600; color: #6B7280; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
                      ${t.topCompaniesTitle}
                    </div>
                    <div style="font-size: 14px; color: #374151; font-weight: 500; line-height: 1.5;">
                      ${topCompanies.slice(0, 3).join(" · ")}${leadCount > 3 ? ` ${t.topCompaniesMore(leadCount - 3)}` : ""}
                    </div>
                  </td>
                </tr>
              </table>
      `
      : ""

  // Build trial remaining HTML if available (subtle, professional)
  const trialRemainingHtml =
    trialDaysRemaining !== undefined
      ? `
              <!-- Trial Status -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; background-color: #FEF3C7; color: #B45309; font-size: 12px; font-weight: 600; padding: 8px 16px; border-radius: 20px;">
                      ${t.trialRemaining(trialDaysRemaining)}
                    </span>
                  </td>
                </tr>
              </table>
      `
      : ""

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <!-- Outer container -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F5F5F7;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <!-- Inner container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header - Clean & Minimal -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #F0F0F0;">
              <div style="font-size: 28px; font-weight: 700; color: #5B4FD9; letter-spacing: -0.5px;">Rinda</div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">

              <!-- Success Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: linear-gradient(135deg, #5B4FD9 0%, #7C3AED 100%); border-radius: 24px; padding: 10px 20px;">
                      <span style="color: #FFFFFF; font-size: 13px; font-weight: 600; letter-spacing: 0.3px;">✓ ${t.title}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Greeting -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <h1 style="font-size: 22px; font-weight: 700; color: #1F2937; margin: 0 0 12px 0; line-height: 1.3;">
                      ${t.greeting(name)}
                    </h1>
                    <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0; max-width: 380px;">
                      ${t.intro(industry)}
                    </p>
                  </td>
                </tr>
              </table>

              ${trialRemainingHtml}

              <!-- Stats Cards - Professional -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td width="50%" style="padding-right: 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #5B4FD9 0%, #7C3AED 100%); border-radius: 12px;">
                      <tr>
                        <td align="center" style="padding: 24px 16px;">
                          <div style="font-size: 32px; font-weight: 700; color: #FFFFFF; line-height: 1; letter-spacing: -1px;">${leadCount}</div>
                          <div style="font-size: 12px; color: rgba(255,255,255,0.85); margin-top: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${t.leadsFound}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding-left: 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); border-radius: 12px;">
                      <tr>
                        <td align="center" style="padding: 24px 16px;">
                          <div style="font-size: 32px; font-weight: 700; color: #FFFFFF; line-height: 1; letter-spacing: -1px;">${emailCount}</div>
                          <div style="font-size: 12px; color: rgba(255,255,255,0.85); margin-top: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${t.emailsGenerated}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${topCompaniesHtml}

              <!-- CTA Button - Professional -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #5B4FD9 0%, #7C3AED 100%); border-radius: 10px; box-shadow: 0 4px 14px rgba(91, 79, 217, 0.35);">
                          <a href="${dashboardUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; letter-spacing: 0.3px;">
                            ${t.ctaButton}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Tip Section - Subtle -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #F8FAFC; border-radius: 10px; padding: 16px 20px; border-left: 4px solid #5B4FD9;">
                    <p style="color: #4B5563; font-size: 13px; margin: 0; line-height: 1.5;">
                      <span style="font-weight: 600; color: #5B4FD9;">💡 ${t.tip.title}</span><br/>
                      <span style="color: #6B7280;">${t.tip.text}</span>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Next Steps - Clean Design -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAFAFA; border-radius: 12px; border: 1px solid #E5E7EB;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 11px; font-weight: 700; color: #9CA3AF; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px;">
                      ${t.nextStepsTitle}
                    </div>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      ${t.nextSteps
                        .map(
                          (step, i) => `
                        <tr>
                          <td style="padding: 8px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td width="28" valign="top">
                                  <div style="width: 22px; height: 22px; background: linear-gradient(135deg, #5B4FD9 0%, #7C3AED 100%); border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700; color: #FFFFFF;">${i + 1}</div>
                                </td>
                                <td style="color: #374151; font-size: 14px; line-height: 1.4; padding-left: 12px;">
                                  ${step.text}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 32px; border-top: 1px solid #F0F0F0;">
              <p style="font-size: 12px; color: #9CA3AF; margin: 0; line-height: 1.6; text-align: center;">
                ${t.footer}<br/>
                <a href="mailto:admin@grinda.ai" style="color: #5B4FD9; text-decoration: none;">admin@grinda.ai</a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Bottom Branding -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width: 520px;">
          <tr>
            <td align="center" style="padding-top: 24px;">
              <span style="font-size: 11px; color: #9CA3AF;">Powered by <span style="color: #5B4FD9; font-weight: 600;">Rinda</span></span>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
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
