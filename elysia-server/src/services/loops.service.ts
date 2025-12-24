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
}

// ====================================
// CONSTANTS
// ====================================

const LOOPS_API_BASE = "https://app.loops.so/api/v1"

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
 */
function createOnboardingCompleteEmailHTML(data: OnboardingCompleteEmailData): string {
  const { firstName, leadCount, emailCount, dashboardUrl } = data
  const name = firstName || "고객"

  return `
<div style="font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc;">
  <div style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
      <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin: 0;">
        온보딩이 완료되었습니다!
      </h1>
    </div>
    
    <!-- Greeting -->
    <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
      안녕하세요 <strong>${name}</strong>님,<br/>
      그린다 AI가 바이어 리스트와 이메일 초안을 준비했습니다.
    </p>
    
    <!-- Stats Cards -->
    <div style="display: flex; gap: 16px; margin-bottom: 32px;">
      <div style="flex: 1; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px; padding: 24px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #ffffff;">${leadCount}</div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.9);">발견된 리드</div>
      </div>
      <div style="flex: 1; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 24px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #ffffff;">${emailCount}</div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.9);">생성된 이메일</div>
      </div>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; font-size: 16px; font-weight: 600; padding: 16px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);">
        대시보드에서 확인하기 →
      </a>
    </div>
    
    <!-- Next Steps -->
    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h3 style="font-size: 14px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">
        다음 단계
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 2;">
        <li>이메일 계정을 연결하세요</li>
        <li>생성된 이메일 초안을 검토하세요</li>
        <li>캠페인을 시작하세요!</li>
      </ul>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        이 이메일은 그린다 AI 온보딩 완료 알림입니다.<br/>
        문의사항이 있으시면 support@grinda.ai로 연락해주세요.
      </p>
    </div>
    
  </div>
</div>
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
  logger.info(`[Loops] Preparing onboarding complete email for ${data.email}`)

  try {
    const content = createOnboardingCompleteEmailHTML(data)

    const response = await sendTransactionalEmail({
      senderName: "Rinda",
      to: data.email,
      subject: `[Grinda] Your ${data.leadCount} Global Buyer Leads are Ready`,
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
