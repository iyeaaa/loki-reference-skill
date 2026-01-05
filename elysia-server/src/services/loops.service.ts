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

/**
 * Email texts following Toss-style UX Writing principles:
 * - 해요체: Friendly, conversational tone
 * - 능동형: Active voice ("~했어요" instead of "~됐어요")
 * - 간결함: Remove unnecessary words (weed cutting)
 * - 사용자 관점: Speak from user's perspective
 * - 공감: Empathize with user's emotions
 *
 * @see https://toss.tech/article/8-writing-principles-of-toss
 */
const EMAIL_TEXTS = {
  en: {
    // Dynamic subject line (conversational, personalized)
    subject: (firstName: string, leadCount: number) =>
      `${firstName}, we found ${leadCount} buyers for you`,
    subjectFallback: "Your buyers are waiting",
    title: "All set!",
    greeting: (name: string) => `Hi ${name},`,
    // Industry-specific intro (active voice, friendly)
    intro: (industry?: string) =>
      industry
        ? `We found ${industry} buyers and wrote your emails.`
        : "We found your buyers and wrote your emails.",
    leadsFound: "Buyers",
    emailsGenerated: "Emails",
    ctaButton: "Check it out",
    // Trial remaining (casual)
    trialRemaining: (days: number) => `${days} days left on your trial`,
    // Top companies
    topCompaniesTitle: "Companies we found",
    topCompaniesMore: (count: number) => `+${count} more`,
    // Tip section (friendly, actionable)
    tip: {
      title: "Tip",
      text: "We wrote these emails for you. Take a quick look and hit send!",
    },
    // Next steps (suggestive, not commanding)
    nextStepsTitle: "What's next",
    nextSteps: [
      { text: "See who we found for you", time: null },
      { text: "Review your email drafts", time: null },
      { text: "Launch when you're ready", time: null },
    ],
    footer: "Sent from Rinda",
    footerContact: "Questions? Reach us at admin@grinda.ai",
    defaultName: "there",
  },
  ko: {
    // 동적 제목줄 (토스 스타일: 친근하고 대화하듯)
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, 바이어 ${leadCount}명을 찾았어요`,
    subjectFallback: "바이어를 찾았어요",
    title: "준비 끝!",
    greeting: (name: string) => `${name}님, 반가워요`,
    // 산업별 맞춤 인트로 (능동형, 친근한 어투)
    intro: (industry?: string) =>
      industry
        ? `${industry} 업계 바이어를 찾았고, 이메일도 다 써뒀어요.`
        : "바이어를 찾았고, 이메일도 다 써뒀어요.",
    leadsFound: "바이어",
    emailsGenerated: "이메일",
    ctaButton: "바로 확인하기",
    // 체험판 잔여 기간 (간결하게)
    trialRemaining: (days: number) => `체험판 ${days}일 남음`,
    // 상위 기업 (자연스럽게)
    topCompaniesTitle: "이런 기업들을 찾았어요",
    topCompaniesMore: (count: number) => `외 ${count}곳`,
    // Tip 섹션 (친근하게 말 걸듯)
    tip: {
      title: "잠깐",
      text: "이메일은 AI가 미리 써뒀어요. 한번 훑어보고 바로 보내보세요!",
    },
    // 다음 단계 (제안하듯, 강요하지 않게)
    nextStepsTitle: "이제 뭘 하면 될까요",
    nextSteps: [
      { text: "어떤 바이어를 찾았는지 확인해 보세요", time: null },
      { text: "이메일 초안이 마음에 드는지 살펴보세요", time: null },
      { text: "준비되면 캠페인을 시작해 보세요", time: null },
    ],
    footer: "Rinda가 보낸 이메일이에요",
    footerContact: "궁금한 점이 있으면 admin@grinda.ai로 연락주세요",
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
