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
    subject: "[Rinda] Your campaign is ready!",
    title: "Onboarding Complete!",
    greeting: (name: string) => `Hi ${name},`,
    intro: "Rinda AI has prepared your buyer list and email drafts.",
    leadsFound: "Leads Found",
    emailsGenerated: "Emails Generated",
    ctaButton: "View Dashboard →",
    nextStepsTitle: "NEXT STEPS",
    nextSteps: ["Review your generated email drafts", "Start your campaign!"],
    footer: "This email is a notification for completing Rinda AI onboarding.",
    footerContact: "For inquiries, please contact admin@grinda.ai",
    defaultName: "there",
  },
  ko: {
    subject: "[Rinda] 당신의 캠페인이 준비되었습니다!",
    title: "온보딩이 완료되었습니다!",
    greeting: (name: string) => `안녕하세요 ${name}님,`,
    intro: "린다(Rinda) AI가 바이어 리스트와 이메일 초안을 준비했습니다.",
    leadsFound: "발견된 리드",
    emailsGenerated: "생성된 이메일",
    ctaButton: "대시보드에서 확인하기 →",
    nextStepsTitle: "다음 단계",
    nextSteps: ["생성된 이메일 초안을 검토하세요", "캠페인을 시작하세요!"],
    footer: "이 이메일은 린다 AI 온보딩 완료 알림입니다.",
    footerContact: "문의사항이 있으시면 admin@grinda.ai로 연락해주세요.",
    defaultName: "고객",
  },
} as const

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

    // Filter out non-ASCII characters from subject
    const sanitizedSubject = params.subject.replace(/[^\x20-\x7E]/g, "")

    // Parse body to get content
    const parsedBody = JSON.parse(params.body)

    const dataVariables = {
      senderName,
      subject: sanitizedSubject,
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
 */
function createOnboardingCompleteEmailHTML(data: OnboardingCompleteEmailData): string {
  const { firstName, leadCount, emailCount, dashboardUrl, language = "ko" } = data
  const t = EMAIL_TEXTS[language]
  const name = firstName || t.defaultName

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Outer container -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Inner container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px;">
          <tr>
            <td style="padding: 40px;">
              
              <!-- Header -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <div style="font-size: 48px; line-height: 1;">🎉</div>
                    <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin: 16px 0 0 0;">
                      ${t.title}
                    </h1>
                  </td>
                </tr>
              </table>
              
              <!-- Greeting -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 24px;">
                    <p style="font-size: 16px; color: #475569; line-height: 1.6; margin: 0;">
                      ${t.greeting(name)}<br/>
                      ${t.intro}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Stats Cards -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td width="48%" style="padding-right: 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #6366f1; border-radius: 12px;">
                      <tr>
                        <td align="center" style="padding: 24px;">
                          <div style="font-size: 32px; font-weight: 700; color: #ffffff;">${leadCount}</div>
                          <div style="font-size: 14px; color: rgba(255,255,255,0.9); margin-top: 4px;">${t.leadsFound}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="48%" style="padding-left: 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #10b981; border-radius: 12px;">
                      <tr>
                        <td align="center" style="padding: 24px;">
                          <div style="font-size: 32px; font-weight: 700; color: #ffffff;">${emailCount}</div>
                          <div style="font-size: 14px; color: rgba(255,255,255,0.9); margin-top: 4px;">${t.emailsGenerated}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color: #6366f1; border-radius: 12px;">
                          <a href="${dashboardUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                            ${t.ctaButton}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Next Steps -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="font-size: 14px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">
                      ${t.nextStepsTitle}
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      ${t.nextSteps.map((step) => `<tr><td style="color: #475569; font-size: 14px; padding: 4px 0;">• ${step}</td></tr>`).join("")}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Footer -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-top: 24px; border-top: 1px solid #e2e8f0;">
                    <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.6;">
                      ${t.footer}<br/>
                      ${t.footerContact}
                    </p>
                  </td>
                </tr>
              </table>
              
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
 */
export async function sendOnboardingCompleteEmail(
  data: OnboardingCompleteEmailData,
): Promise<boolean> {
  const language = data.language || "ko"
  const t = EMAIL_TEXTS[language]

  logger.info(`[Loops] Preparing onboarding complete email for ${data.email} (lang: ${language})`)

  try {
    const content = createOnboardingCompleteEmailHTML(data)

    const response = await sendTransactionalEmail({
      senderName: "Rinda",
      to: data.email,
      subject: t.subject,
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
