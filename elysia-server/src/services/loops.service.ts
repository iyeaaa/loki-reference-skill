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
 * Modern, clean design with gradient accents
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
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Outer container -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 20px 12px;">
        <!-- Inner container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0; padding: 20px 24px; text-align: center;">
              <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Rinda</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.85); font-weight: 500; margin-top: 2px;">AI-Powered Global Sales</div>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td style="padding: 20px 24px 16px;">
              
              <!-- Success badge + Greeting combined -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <div style="display: inline-block; background-color: #ecfdf5; border-radius: 50px; padding: 6px 14px; margin-bottom: 12px;">
                      <span style="color: #059669; font-size: 12px; font-weight: 600;">✓ ${t.title}</span>
                    </div>
                    <h2 style="font-size: 18px; font-weight: 700; color: #1a202c; margin: 0 0 6px 0; line-height: 1.3;">
                      ${t.greeting(name)}
                    </h2>
                    <p style="font-size: 14px; color: #64748b; line-height: 1.4; margin: 0;">
                      ${t.intro}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Stats Cards - Compact -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <td width="50%" style="padding-right: 4px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
                      <tr>
                        <td align="center" style="padding: 14px 12px;">
                          <div style="font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1;">${leadCount}</div>
                          <div style="font-size: 11px; color: rgba(255,255,255,0.9); margin-top: 2px; font-weight: 500;">${t.leadsFound}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding-left: 4px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); border-radius: 8px;">
                      <tr>
                        <td align="center" style="padding: 14px 12px;">
                          <div style="font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1;">${emailCount}</div>
                          <div style="font-size: 11px; color: rgba(255,255,255,0.9); margin-top: 2px; font-weight: 500;">${t.emailsGenerated}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
                          <a href="${dashboardUrl}" target="_blank" style="display: block; padding: 12px 20px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; text-align: center;">
                            ${t.ctaButton}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Next Steps - Compact -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <div style="font-size: 10px; font-weight: 700; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${t.nextStepsTitle}
                    </div>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      ${t.nextSteps.map((step, i) => `<tr><td style="color: #475569; font-size: 12px; padding: 4px 0; line-height: 1.4;"><span style="display: inline-block; width: 16px; height: 16px; background-color: #667eea; color: #fff; border-radius: 50%; text-align: center; line-height: 16px; font-size: 10px; font-weight: 600; margin-right: 8px;">${i + 1}</span>${step}</td></tr>`).join("")}
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer - Compact -->
          <tr>
            <td style="padding: 12px 24px 16px; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5; text-align: center;">
                ${t.footer}<br/>${t.footerContact}
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Bottom branding -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="max-width: 480px;">
          <tr>
            <td align="center" style="padding-top: 12px;">
              <span style="font-size: 10px; color: #94a3b8;">Powered by Rinda AI</span>
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
