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
    // Subject: personalized + specific number (50% higher open rate)
    subject: (firstName: string, leadCount: number) =>
      `${firstName}, ${leadCount} buyers ready for outreach`,
    subjectFallback: "Your buyer list is ready",
    greeting: (name: string) => `Hello ${name},`,
    // Industry-specific intro (professional, value-focused)
    intro: (industry?: string) =>
      industry
        ? `We've identified ${industry} buyers and prepared personalized emails for your review.`
        : "We've identified potential buyers and prepared personalized emails for your review.",
    // Stats (concise, scannable)
    buyersFound: (count: number) => `<b>${count}</b> potential buyers identified`,
    emailsReady: (count: number) => `<b>${count}</b> personalized emails drafted`,
    sequenceInfo: "3-step sequence over 3 days",
    trialRemaining: (days: number) => `<b>${days} days</b> remaining in trial`,
    // Company personalization
    forCompany: (name: string) => `Prepared for ${name}`,
    // CTA: specific and action-oriented
    ctaButton: (count: number) => `Review ${count} leads`,
    ctaButtonFallback: "Review your leads",
    // Next step: single focused action (not overwhelming)
    nextStep: "Review leads → Edit emails → Launch campaign",
    // Footer (professional sign-off)
    footer: "Best regards,\nThe Rinda Team",
    footerContact: "Questions? Contact us at admin@grinda.ai",
    footerBusiness: "© 2025 Rinda AI · TIPS Town, Daejeon, South Korea",
    defaultName: "there",
  },
  ko: {
    // 제목: 개인화 + 구체적 숫자 (오픈율 50% 향상)
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, 바이어 ${leadCount}명 발굴 완료`,
    subjectFallback: "바이어 리스트가 준비되었습니다",
    greeting: (name: string) => `${name}님, 안녕하세요.`,
    // 산업별 맞춤 인트로 (전문적, 가치 중심)
    intro: (industry?: string) =>
      industry
        ? `${industry} 업계 잠재 바이어를 발굴하고, 맞춤 이메일을 작성했습니다.`
        : "잠재 바이어를 발굴하고, 맞춤 이메일을 작성했습니다.",
    // 통계 (간결, 스캔 가능)
    buyersFound: (count: number) => `잠재 바이어 <b>${count}명</b> 발굴`,
    emailsReady: (count: number) => `맞춤 이메일 <b>${count}개</b> 작성`,
    sequenceInfo: "3일간 3단계 시퀀스",
    trialRemaining: (days: number) => `체험 기간 <b>${days}일</b> 남음`,
    // 회사 개인화 (받침에 따라 을/를 선택)
    forCompany: (name: string) => `${name}${hasKoreanBatchim(name) ? "을" : "를"} 위해 준비`,
    // CTA: 구체적이고 행동 지향적
    ctaButton: (count: number) => `리드 ${count}명 확인하기`,
    ctaButtonFallback: "리드 확인하기",
    // 다음 단계: 한 줄로 간결하게 (압도감 없이)
    nextStep: "리드 확인 → 이메일 수정 → 캠페인 시작",
    // Footer (전문적 마무리)
    footer: "감사합니다.\nRinda 팀 드림",
    footerContact: "문의사항이 있으시면 admin@grinda.ai로 연락주세요",
    footerBusiness: "© 2025 Rinda AI · 대전 팁스타운, 대한민국",
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
 * Create plain text-based HTML email content
 * Optimized for B2B: professional, concise, single CTA focus
 * Mobile-first: 67% of B2B emails opened on mobile
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

  // Company personalization line
  const companyLine = companyName ? `${t.forCompany(companyName)}\n\n` : ""

  // Dynamic CTA with lead count
  const ctaText = typeof t.ctaButton === "function" ? t.ctaButton(leadCount) : t.ctaButtonFallback

  return `<div style="text-align:left; line-height:1.8">
${t.greeting(name)}

${companyLine}${t.intro(industry)}

• ${t.buyersFound(leadCount)}
• ${t.emailsReady(emailCount)}
• ${t.sequenceInfo}
${trialDaysRemaining !== undefined ? `• ${t.trialRemaining(trialDaysRemaining)}` : ""}

<a href="${dashboardUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:600">${ctaText}</a>

<span style="color:#666">${t.nextStep}</span>

${t.footer}

<span style="color:#888">${t.footerContact}</span>
<span style="color:#aaa; font-size:12px">${t.footerBusiness}</span>
</div>`
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
