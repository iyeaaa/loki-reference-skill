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
    // Subject
    subject: (firstName: string, leadCount: number) =>
      `${firstName}, we found ${leadCount} buyers for you`,
    subjectFallback: "Good news — your buyers are ready",
    greeting: (name: string) => `Hi, ${name}!`,
    // Intro
    intro: (industry?: string) =>
      industry
        ? `We found potential buyers in the ${industry} industry and drafted personalized emails for you.`
        : "We found potential buyers and drafted personalized emails for you.",
    // Stats: bullet point format
    buyersFound: (count: number) => `• Buyers: ${count}`,
    emailsReady: (count: number) => `• Personalized emails: ${count}`,
    sequenceInfo: "• Schedule: 3 steps over 3 days",
    // CTA
    ctaButton: (count: number) => `See ${count} leads`,
    ctaButtonFallback: "See your leads",
    // Next step
    nextStep: "Review, edit if needed, and launch when ready.",
    // Footer
    footer: "Rinda Team",
    footerContact: "Questions? Contact us at admin@grinda.ai",
    footerBusiness: "© 2025 Rinda AI · Daejeon, South Korea",
    defaultName: "there",
  },
  ko: {
    // 제목
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, 바이어 ${leadCount}명 찾았어요`,
    subjectFallback: "바이어를 찾았어요",
    greeting: (name: string) => `안녕하세요, ${name}님!`,
    // 인트로
    intro: (industry?: string) =>
      industry
        ? `${industry} 업계의 잠재 바이어를 찾고, 맞춤 이메일을 작성해뒀어요.`
        : "잠재 바이어를 찾고, 맞춤 이메일을 작성해뒀어요.",
    // 통계: bullet point 형식
    buyersFound: (count: number) => `• 바이어: ${count}명`,
    emailsReady: (count: number) => `• 맞춤 이메일: ${count}개`,
    sequenceInfo: "• 발송 일정: 3일간 3단계",
    // CTA
    ctaButton: (count: number) => `${count}명 확인하기`,
    ctaButtonFallback: "확인하기",
    // 다음 단계
    nextStep: "확인하고, 필요하면 수정한 뒤 바로 시작해 보세요.",
    // Footer
    footer: "Rinda 팀",
    footerContact: "궁금한 점은 admin@grinda.ai로 문의해 주세요",
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
 * Create simple HTML email content
 * Minimal styling for better email client compatibility
 */
function createOnboardingCompleteEmailHTML(data: OnboardingCompleteEmailData): string {
  const {
    firstName,
    leadCount,
    emailCount,
    dashboardUrl,
    language = "ko",
    industry,
    companyName,
  } = data
  const t = EMAIL_TEXTS[language]
  const name = firstName || t.defaultName
  const isKorean = language === "ko"

  // Dynamic CTA with lead count
  const ctaText = typeof t.ctaButton === "function" ? t.ctaButton(leadCount) : t.ctaButtonFallback

  // Headline (with proper Korean particle 을/를)
  const companyParticle = companyName && hasKoreanBatchim(companyName) ? "을" : "를"
  const headline = companyName
    ? isKorean
      ? `${companyName}${companyParticle} 위한 바이어를 찾았어요`
      : `We found buyers for ${companyName}`
    : isKorean
      ? `${name}님을 위한 바이어를 찾았어요`
      : `We found buyers for you`

  return `<div style="line-height:1.8">
${t.greeting(name)}

<b>${headline}</b>

${t.intro(industry)}

${t.buyersFound(leadCount)}
${t.emailsReady(emailCount)}
${t.sequenceInfo}

<a href="${dashboardUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:600">${ctaText}</a>

<span style="color:#666">${t.nextStep}</span>

${t.footer}
<span style="color:#888">${t.footerContact}</span>
<span style="color:#aaa">${t.footerBusiness}</span>
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

// ====================================
// WELCOME EMAIL
// ====================================

interface WelcomeEmailData {
  email: string
  firstName?: string
  managerName: string
  kakaoLink: string
  phoneNumber: string
  language?: "en" | "ko"
}

const DIVIDER = "━━━━━━━━━━━━━━━━"

function createWelcomeEmailHTML(data: WelcomeEmailData): string {
  const { firstName, managerName, kakaoLink, phoneNumber, language = "ko" } = data
  const name = firstName || (language === "ko" ? "고객" : "there")

  if (language === "en") {
    return createWelcomeEmailHTMLEnglish(data)
  }

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 600px;">
${name} 대표님, 안녕하세요.<br/>
${managerName}입니다.<br/>
대표님이 RINDA 가입하신 걸 보고<br/>
지금 이 메일 쓰고 있어요.<br/>
<span style="color:#888">${DIVIDER}</span><br/>
먼저 이것부터 말씀드릴게요.<br/>
저희도 지금 RINDA로 일본 진출하고 있습니다.<br/>
우리가 만든 도구로<br/>
우리가 직접 해외에 나가고 있어요.<br/>
일본 바이어한테 메일 쓸 때,<br/>
제품 소개서 만들 때,<br/>
영어로 답장할 때,<br/>
저희도 RINDA 씁니다. 매일.<br/>
그래서 대표님이 겪으실 어려움을<br/>
저는 지금도 같이 겪고 있어요.<br/>
<span style="color:#888">${DIVIDER}</span><br/>
처음이시면 이것만 해보세요.<br/>
<b>회사 이름 + 주력 제품 하나만 입력</b><br/>
5분이면 돼요.<br/>
그럼 RINDA가 뭘 할 수 있는지 보여드릴게요.<br/>
<span style="color:#888">${DIVIDER}</span><br/>
써보시다가 막히시면 언제든 연락 주세요.<br/>
<b>카톡:</b> <a href="${kakaoLink}" style="color: #2563eb;">${kakaoLink}</a> (10분 안에 답장)<br/>
<b>전화:</b> ${phoneNumber} (평일 거의 항상 받아요)<br/>
"이런 거 물어봐도 되나?" 싶은 것도 다 괜찮아요.<br/>
<span style="color:#888">${DIVIDER}</span><br/>
대표님이 해외에서 성공하시는 게<br/>
저한테는 정말 중요해요.<br/>
왜냐하면 그게 모이면<br/>
대한민국 GDP가 바뀔 수 있거든요.<br/>
대표님 제품이 해외에서 통하는 그날까지<br/>
제가 옆에 있겠습니다.<br/>
오늘부터 함께해요.<br/>
${managerName}<br/>
RINDA<br/>
<span style="color:#666"><b>P.S.</b><br/>
며칠간 대표님 계정 자주 볼게요.<br/>
안 쓰고 계시면 제가 먼저 연락드릴게요 😊</span>
</div>`
}

function createWelcomeEmailHTMLEnglish(data: WelcomeEmailData): string {
  const { firstName, managerName, kakaoLink, phoneNumber } = data
  const name = firstName || "there"

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 600px;">
Hi ${name},<br/>
This is ${managerName}.<br/>
I'm writing this email because I just saw you signed up for RINDA.<br/>
<span style="color:#888">${DIVIDER}</span><br/>
Let me tell you this first.<br/>
We're also using RINDA to expand into Japan right now.<br/>
We're going global with the very tool we built.<br/>
When we email Japanese buyers,<br/>
when we create product brochures,<br/>
when we reply in English,<br/>
we use RINDA too. Every day.<br/>
So the challenges you'll face—<br/>
I'm going through them with you.<br/>
<span style="color:#888">${DIVIDER}</span><br/>
If you're new, just try this.<br/>
<b>Enter your company name + one main product</b><br/>
Takes 5 minutes.<br/>
Then I'll show you what RINDA can do.<br/>
<span style="color:#888">${DIVIDER}</span><br/>
If you get stuck, reach out anytime.<br/>
<b>KakaoTalk:</b> <a href="${kakaoLink}" style="color: #2563eb;">${kakaoLink}</a> (reply within 10 min)<br/>
<b>Phone:</b> ${phoneNumber} (available most weekdays)<br/>
Even "Can I ask this?" questions are totally fine.<br/>
<span style="color:#888">${DIVIDER}</span><br/>
Your success overseas<br/>
really matters to me.<br/>
Because when enough of you succeed,<br/>
it changes Korea's GDP.<br/>
Until your product makes it overseas,<br/>
I'll be right here with you.<br/>
Let's start today.<br/>
${managerName}<br/>
RINDA<br/>
<span style="color:#666"><b>P.S.</b><br/>
I'll check your account over the next few days.<br/>
If you're not using it, I'll reach out first 😊</span>
</div>`
}

/**
 * Send welcome email to new users
 * Called when a new user signs up via Google OAuth
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
  if (!isLoopsConfigured()) {
    logger.warn("[Loops] Not configured, skipping welcome email")
    return false
  }

  const language = data.language || "ko"
  const name = data.firstName || (language === "ko" ? "고객" : "there")
  const subject =
    language === "ko"
      ? `${name} 대표님, 당신의 해외진출을 응원합니다`
      : `${name}, we're rooting for your global success`

  logger.info(`[Loops] Preparing welcome email for ${data.email}`)

  try {
    const content = createWelcomeEmailHTML(data)

    const response = await sendTransactionalEmail({
      senderName: data.managerName,
      to: data.email,
      subject,
      body: JSON.stringify({ content }),
    })

    if (response.success) {
      logger.info(`[Loops] Welcome email sent successfully to ${data.email}`)
    }

    return response.success
  } catch (error) {
    logger.error(`[Loops] Failed to send welcome email: ${error}`)
    return false
  }
}
