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
 * Email texts following Toss-style UX Writing principles:
 * - 해요체: Friendly, conversational tone
 * - 능동형: Active voice ("~했어요" instead of "~됐어요")
 * - 간결함: Remove unnecessary words (weed cutting)
 * - 사용자 관점: Speak from user's perspective
 * - 공감: Empathize with user's emotions
 *
 * @see https://toss.tech/article/8-writing-principles-of-toss
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
    // Natural stats
    statsIntro: "Here's what we prepared:",
    buyersFound: (count: number) => `Found <b><u>${count}</u> potential buyers</b>`,
    emailsReady: (count: number) => `Wrote <b><u>${count}</u> personalized emails</b>`,
    sequenceInfo: "A 3-step sequence that reaches out naturally over 3 days",
    trialRemaining: (days: number) => `You have <b><u>${days} days</u></b> left on your trial`,
    // Company personalization
    forCompany: (name: string) => `For ${name}`,
    // Top companies
    topCompaniesTitle: "Companies we found",
    topCompaniesMore: (count: number) => `+${count} more`,
    ctaButton: "Check it out",
    // Tip section (friendly, actionable)
    tip: {
      title: "Tip",
      text: "We wrote these emails for you. Take a quick look and hit send!",
    },
    // Next steps (suggestive, not commanding)
    nextStepsTitle: "What's next",
    nextSteps: [
      { text: "See who we found for you — select or exclude as needed", time: null },
      { text: "Review your email drafts — edit them anytime", time: null },
      { text: "Launch when you're ready", time: null },
    ],
    footer: "Sent from Rinda",
    footerContact: "Questions? Reach us at admin@grinda.ai",
    footerBusiness: "© 2025 Rinda AI · TIPS Town, Daejeon, South Korea",
    defaultName: "there",
  },
  ko: {
    // 동적 제목줄 (토스 스타일: 친근하고 대화하듯)
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, 바이어 ${leadCount}명을 찾았어요`,
    subjectFallback: "바이어를 찾았어요",
    title: "준비 끝!",
    greeting: (name: string) => `${name}님, 반가워요!`,
    // 산업별 맞춤 인트로 (능동형, 친근한 어투)
    intro: (industry?: string) =>
      industry
        ? `${industry} 업계 바이어를 찾았고, 이메일도 다 써뒀어요.`
        : "바이어를 찾았고, 이메일도 다 써뒀어요.",
    // 자연스러운 통계
    statsIntro: "이렇게 준비했어요:",
    buyersFound: (count: number) => `잠재 바이어 <b><u>${count}명</u></b>을 찾았어요`,
    emailsReady: (count: number) => `맞춤 이메일 <b><u>${count}개</u></b>를 작성했어요`,
    sequenceInfo: "3일에 걸쳐 자연스럽게 연락하는 시퀀스예요",
    trialRemaining: (days: number) => `체험판 <b><u>${days}일</u></b> 남았어요`,
    // 회사 개인화 (받침에 따라 을/를 선택)
    forCompany: (name: string) => `${name}${hasKoreanBatchim(name) ? "을" : "를"} 위해`,
    // 상위 기업 (자연스럽게)
    topCompaniesTitle: "이런 기업들을 찾았어요",
    topCompaniesMore: (count: number) => `외 ${count}곳`,
    ctaButton: "바로 확인하기",
    // Tip 섹션 (친근하게 말 걸듯)
    tip: {
      title: "잠깐",
      text: "이메일은 린다 AI가 미리 써뒀어요. 한번 훑어보고 바로 보내보세요!",
    },
    // 다음 단계 (제안하듯, 강요하지 않게)
    nextStepsTitle: "이제 뭘 하면 될까요?",
    nextSteps: [
      { text: "어떤 바이어를 찾았는지 확인해 보세요 — 선택하거나 제외할 수 있어요", time: null },
      { text: "이메일 초안을 살펴보세요 — 마음대로 수정할 수 있어요", time: null },
      { text: "준비되면 캠페인을 시작해 보세요", time: null },
    ],
    footer: "Rinda가 보낸 이메일이에요",
    footerContact: "궁금한 점이 있으면 admin@grinda.ai로 연락주세요",
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
 * No design elements - maximum compatibility
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

  const nextStepsList = t.nextSteps.map((step, i) => `${i + 1}. ${step.text}`).join("\n")

  // Company personalization line
  const companyLine = companyName ? `${t.forCompany(companyName)}\n\n` : ""

  return `<div style="text-align:left; line-height:1.6">
<b>${t.greeting(name)}</b>

${companyLine}${t.intro(industry)}

📊 ${t.buyersFound(leadCount)}
📧 ${t.emailsReady(emailCount)}
🔄 ${t.sequenceInfo}
${trialDaysRemaining !== undefined ? `⏰ ${t.trialRemaining(trialDaysRemaining)}` : ""}

👉 <a href="${dashboardUrl}"><b><u>${t.ctaButton}</u></b></a>

───────────────────────

💡 <b>${t.tip.title}</b>: ${t.tip.text}

<b>${t.nextStepsTitle}</b>
${nextStepsList}

<span style="color:#888">${t.footer}
${t.footerContact}</span>

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
