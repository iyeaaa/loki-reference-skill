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

  // Dynamic CTA with lead count
  const ctaText = typeof t.ctaButton === "function" ? t.ctaButton(leadCount) : t.ctaButtonFallback

  // Company line integrated naturally into intro
  const introText = companyName
    ? `${t.forCompany(companyName)}\n${t.intro(industry)}`
    : t.intro(industry)

  // Trial info only if available
  const trialLine =
    trialDaysRemaining !== undefined ? `\n${t.trialRemaining(trialDaysRemaining)}` : ""

  return `<div style="text-align:left; line-height:1.8">
${t.greeting(name)}

${introText}

${t.buyersFound(leadCount)}
${t.emailsReady(emailCount)}
${t.sequenceInfo}${trialLine}

<a href="${dashboardUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:600; margin:8px 0">${ctaText}</a>

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
