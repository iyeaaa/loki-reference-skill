/**
 * Followup Email Service
 *
 * 환영 이메일 및 팔로업 이메일 발송 관리
 *
 * 이메일 타입 (온보딩 퍼널 기준):
 * - welcome: 가입 즉시 발송
 * - signup_only: 구글 로그인 후 Step 1(회사정보 입력) 미진행 (24h)
 * - before_connect: Step 1 완료 → Step 2+3 자동 완료 → Unipile 이메일 연동 미진행 (48h)
 * - no_campaign: Unipile 이메일 연동 완료 후 캠페인 미발송 (48h)
 * - inactive_7days: 7일간 접속 없음
 */

import { and, eq, isNull, lt, notExists, sql } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db"
import {
  type FollowupEmailType,
  followupEmails,
  onboardingProgress,
  sequences,
  userEmailAccounts,
  users,
  workspaceMembers,
  workspaces,
} from "../db/schema"
import logger from "../utils/logger"
import { sendTransactionalEmail } from "./loops.service"

// ====================================
// TYPES
// ====================================

interface FollowupCandidate {
  userId: string
  email: string
  firstName: string
  workspaceId: string | null
  emailType: FollowupEmailType
  language: string
  // Step 1 이후 사용 가능한 회사 정보
  companyName?: string | null
  companyDescription?: string | null
}

// ====================================
// RECORD FUNCTIONS
// ====================================

/**
 * Record welcome email sent
 */
export async function recordWelcomeEmail(
  userId: string,
  workspaceId: string | null,
  loopsMessageId?: string,
): Promise<void> {
  try {
    await db
      .insert(followupEmails)
      .values({
        userId,
        workspaceId,
        emailType: "welcome",
        loopsMessageId,
      })
      .onConflictDoNothing()

    logger.info({ userId }, "[FollowupEmail] Welcome email recorded")
  } catch (error) {
    logger.error({ error, userId }, "[FollowupEmail] Failed to record welcome email")
  }
}

/**
 * Record followup email sent
 */
export async function recordFollowupEmail(
  userId: string,
  workspaceId: string | null,
  emailType: FollowupEmailType,
  loopsMessageId?: string,
): Promise<void> {
  try {
    await db
      .insert(followupEmails)
      .values({
        userId,
        workspaceId,
        emailType,
        loopsMessageId,
      })
      .onConflictDoNothing()

    logger.info({ userId, emailType }, "[FollowupEmail] Followup email recorded")
  } catch (error) {
    logger.error({ error, userId, emailType }, "[FollowupEmail] Failed to record followup email")
  }
}

/**
 * Check if email was already sent
 */
export async function hasAlreadySent(
  userId: string,
  emailType: FollowupEmailType,
): Promise<boolean> {
  const existing = await db
    .select({ id: followupEmails.id })
    .from(followupEmails)
    .where(and(eq(followupEmails.userId, userId), eq(followupEmails.emailType, emailType)))
    .limit(1)

  return existing.length > 0
}

// ====================================
// CANDIDATE QUERIES (퍼널 단계별)
// ====================================

/**
 * 가입만 하고 Step 1 미진행 (24시간 경과)
 * → signup_only 이메일 발송 대상
 */
async function findStuckAtSignup(): Promise<FollowupCandidate[]> {
  try {
    const results = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.username,
        workspaceId: onboardingProgress.workspaceId,
        language: sql<string>`COALESCE(${onboardingProgress.surveyData}->>'lang', 'ko')`,
      })
      .from(users)
      .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
      .innerJoin(
        onboardingProgress,
        eq(onboardingProgress.workspaceId, workspaceMembers.workspaceId),
      )
      .where(
        and(
          eq(workspaceMembers.status, "active"),
          // 가입 후 24시간 경과
          lt(users.createdAt, sql`NOW() - INTERVAL '24 hours'`),
          // Step 1 미완료
          isNull(onboardingProgress.companyInfoCompleted),
          // 이미 발송 안 함
          notExists(
            db
              .select({ id: followupEmails.id })
              .from(followupEmails)
              .where(
                and(
                  eq(followupEmails.userId, users.id),
                  eq(followupEmails.emailType, "signup_only"),
                ),
              ),
          ),
        ),
      )

    return results.map((r) => ({
      ...r,
      workspaceId: r.workspaceId,
      emailType: "signup_only" as const,
    }))
  } catch (error) {
    logger.error({ error }, "[FollowupEmail] Error finding stuck at signup")
    return []
  }
}

/**
 * Step 1 완료 → Step 2+3 자동 완료 → Unipile 이메일 연동 미진행 (48시간 경과)
 * → before_connect 이메일 발송 대상
 * → 회사명 포함
 */
async function findStuckBeforeConnect(): Promise<FollowupCandidate[]> {
  try {
    const results = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.username,
        workspaceId: onboardingProgress.workspaceId,
        language: sql<string>`COALESCE(${onboardingProgress.surveyData}->>'lang', 'ko')`,
        companyName: workspaces.companyName,
        companyDescription: workspaces.companyDescription,
      })
      .from(users)
      .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
      .innerJoin(
        onboardingProgress,
        eq(onboardingProgress.workspaceId, workspaceMembers.workspaceId),
      )
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.status, "active"),
          // 자동생성 완료됨 (generatedSequenceId 존재)
          sql`${onboardingProgress.generatedSequenceId} IS NOT NULL`,
          // 48시간 경과 (leadSearchCompleted 기준 - 자동생성 시점)
          lt(onboardingProgress.leadSearchCompleted, sql`NOW() - INTERVAL '48 hours'`),
          // Unipile 이메일 연동 미완료
          isNull(onboardingProgress.emailLinkCompleted),
          // 이미 발송 안 함
          notExists(
            db
              .select({ id: followupEmails.id })
              .from(followupEmails)
              .where(
                and(
                  eq(followupEmails.userId, users.id),
                  eq(followupEmails.emailType, "before_connect"),
                ),
              ),
          ),
        ),
      )

    return results.map((r) => ({
      ...r,
      workspaceId: r.workspaceId,
      emailType: "before_connect" as const,
    }))
  } catch (error) {
    logger.error({ error }, "[FollowupEmail] Error finding stuck before connect")
    return []
  }
}

/**
 * Step 4 완료 후 캠페인 미발송 (48시간 경과)
 * → no_campaign 이메일 발송 대상
 * → 회사명, 회사 설명 포함
 */
async function findStuckNoCampaign(): Promise<FollowupCandidate[]> {
  try {
    const results = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.username,
        workspaceId: onboardingProgress.workspaceId,
        language: sql<string>`COALESCE(${onboardingProgress.surveyData}->>'lang', 'ko')`,
        companyName: workspaces.companyName,
        companyDescription: workspaces.companyDescription,
      })
      .from(users)
      .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
      .innerJoin(
        onboardingProgress,
        eq(onboardingProgress.workspaceId, workspaceMembers.workspaceId),
      )
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .innerJoin(userEmailAccounts, eq(userEmailAccounts.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.status, "active"),
          // 이메일 연동 완료
          sql`${onboardingProgress.emailLinkCompleted} IS NOT NULL`,
          // 48시간 경과
          lt(onboardingProgress.emailLinkCompleted, sql`NOW() - INTERVAL '48 hours'`),
          // 활성 캠페인 없음
          notExists(
            db
              .select({ id: sequences.id })
              .from(sequences)
              .where(
                and(
                  eq(sequences.workspaceId, onboardingProgress.workspaceId),
                  eq(sequences.status, "active"),
                ),
              ),
          ),
          // 미발송
          notExists(
            db
              .select({ id: followupEmails.id })
              .from(followupEmails)
              .where(
                and(
                  eq(followupEmails.userId, users.id),
                  eq(followupEmails.emailType, "no_campaign"),
                ),
              ),
          ),
        ),
      )

    return results.map((r) => ({
      ...r,
      workspaceId: r.workspaceId,
      emailType: "no_campaign" as const,
    }))
  } catch (error) {
    logger.error({ error }, "[FollowupEmail] Error finding stuck no campaign")
    return []
  }
}

/**
 * 7일간 접속 없음
 * → inactive_7days 이메일 발송 대상
 */
async function findInactive7Days(): Promise<FollowupCandidate[]> {
  try {
    const results = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.username,
        workspaceId: sql<string | null>`NULL`,
        language: sql<string>`'ko'`,
      })
      .from(users)
      .leftJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
      .leftJoin(
        onboardingProgress,
        eq(onboardingProgress.workspaceId, workspaceMembers.workspaceId),
      )
      .where(
        and(
          // 마지막 접속 7일 이상 경과 (lastLoginAt 또는 createdAt 기준)
          sql`COALESCE(${users.lastLoginAt}, ${users.createdAt}) < NOW() - INTERVAL '7 days'`,
          // 온보딩 미완료
          sql`${onboardingProgress.completedAt} IS NULL`,
          // 미발송
          notExists(
            db
              .select({ id: followupEmails.id })
              .from(followupEmails)
              .where(
                and(
                  eq(followupEmails.userId, users.id),
                  eq(followupEmails.emailType, "inactive_7days"),
                ),
              ),
          ),
        ),
      )

    return results.map((r) => ({
      ...r,
      workspaceId: r.workspaceId,
      emailType: "inactive_7days" as const,
    }))
  } catch (error) {
    logger.error({ error }, "[FollowupEmail] Error finding inactive 7 days")
    return []
  }
}

// ====================================
// EMAIL TEMPLATES
// ====================================

interface TemplateContext {
  name: string
  manager: string
  kakao: string
  phone: string
  companyName?: string | null
  companyDescription?: string | null
}

const FOLLOWUP_TEMPLATES: Record<
  Exclude<FollowupEmailType, "welcome">,
  {
    ko: {
      getSubject: (ctx: TemplateContext) => string
      getContent: (ctx: TemplateContext) => string
    }
    en: {
      getSubject: (ctx: TemplateContext) => string
      getContent: (ctx: TemplateContext) => string
    }
  }
> = {
  signup_only: {
    ko: {
      getSubject: ({ name }) => `${name} 대표님, 귀사를 찾는 150곳의 바이어를 아직 못 보셨나요?`,
      getContent: ({ name, manager, kakao, phone }) => `
${name} 대표님, 안녕하세요.

어제 RINDA에 가입해주셨는데
아직 시작을 안 하신 것 같아서요.

혹시 이런 생각이 드셨나요?

"나중에 해야지"
"일단 가입만 해두자"
"뭔가 복잡할 것 같아서..."

완전 이해해요.
저도 새로운 서비스 가입하면 그래요.

근데 대표님,
딱 3분만 투자하시면
해외 바이어 리스트가 눈앞에 펼쳐져요.

진짜 3분이에요.
회사 정보 몇 가지만 입력하시면
AI가 알아서 바이어 찾아드려요.

지금 바로 해보시겠어요?
→ https://app.rinda.ai

막히시면 바로 연락주세요!

${manager}
${phone}
카톡: ${kakao}
`,
    },
    en: {
      getSubject: ({ name }) =>
        `${name}, 150 buyers are looking for your company - have you seen them yet?`,
      getContent: ({ name, manager, kakao, phone }) => `
Hi ${name},

I noticed you signed up for RINDA yesterday
but haven't started yet.

Maybe you thought:
"I'll do it later"
"Just signing up for now"
"Looks complicated..."

I totally get it.
I'm the same way with new tools.

But here's the thing:
Just 3 minutes, and you'll have
a list of overseas buyers right in front of you.

Really, just 3 minutes.
Enter a few company details,
and our AI finds buyers for you.

Ready to give it a try?
→ https://app.rinda.ai

Let me know if you get stuck!

${manager}
${phone}
KakaoTalk: ${kakao}
`,
    },
  },
  before_connect: {
    ko: {
      getSubject: ({ name, companyName }) =>
        companyName
          ? `${name} 대표님, ${companyName} 맞춤 바이어 리스트가 준비됐어요!`
          : `${name} 대표님, 맞춤 바이어 리스트가 준비됐어요!`,
      getContent: ({ name, manager, kakao, phone, companyName }) => `
${name} 대표님,

${companyName ? `${companyName}에 딱 맞는` : "귀사에 딱 맞는"} 바이어 리스트가 준비됐어요.
이메일 초안도 다 만들어놨고요.

이제 딱 한 가지만 하시면 돼요.
이메일 계정 연동.

연동하시면 바로 발송할 수 있어요.
한 번의 클릭으로 Gmail과 연동되어서 해당 메일로 보낼 수 있고 받을 수 있어요.

혹시 이런 걱정 되시나요?

"내 이메일 계정 연동해도 안전할까?"
"스팸으로 안 가나?"

걱정 마세요.
저희가 안전하게 발송되도록 세팅해드려요.

지금 바로 연동해보세요!
→ https://app.rinda.ai

궁금한 거 있으시면 바로 연락주세요.

${manager}
${phone}
카톡: ${kakao}
`,
    },
    en: {
      getSubject: ({ name, companyName }) =>
        companyName
          ? `${name}, your custom buyer list for ${companyName} is ready!`
          : `${name}, your custom buyer list is ready!`,
      getContent: ({ name, manager, kakao, phone, companyName }) => `
Hi ${name},

${companyName ? `A buyer list perfectly matched for ${companyName}` : "A custom buyer list"} is ready for you.
We've also drafted all the emails.

Now you just need to do one thing:
Connect your email account.

Once connected, you can send right away.
One click to link Gmail, and you're all set to send and receive.

Worried about:
"Is it safe to connect my email?"
"Will emails go to spam?"

Don't worry.
We'll help you set everything up for safe delivery.

Connect now!
→ https://app.rinda.ai

Let me know if you have any questions.

${manager}
${phone}
KakaoTalk: ${kakao}
`,
    },
  },
  no_campaign: {
    ko: {
      getSubject: ({ name, companyName }) =>
        companyName
          ? `${name} 대표님, ${companyName}의 해외진출이 딱 한 번의 클릭 앞에 있어요.`
          : `${name} 대표님, 해외진출이 딱 한 번의 클릭 앞에 있어요.`,
      getContent: ({ name, manager, kakao, phone, companyName }) => `
${name} 대표님,

이메일 계정 연동까지 완료하셨는데
아직 캠페인을 시작 안 하신 것 같아요.

혹시 뭔가 막히는 부분이 있으신가요?

첫 발송이 불안하시다면,
제가 같이 봐드릴게요.

지금 바로 시작해보시면 어떨까요?
${companyName ? `${companyName}의` : "귀사의"} 첫 답장이 오는 순간의 짜릿함을
빨리 경험하셨으면 해요!

${manager}
${phone}
카톡: ${kakao}
`,
    },
    en: {
      getSubject: ({ name, companyName }) =>
        companyName
          ? `${name}, ${companyName}'s global expansion is just one click away.`
          : `${name}, your global expansion is just one click away.`,
      getContent: ({ name, manager, kakao, phone, companyName }) => `
Hi ${name},

You've connected your email account,
but haven't launched a campaign yet.

Is something holding you back?

If you're nervous about the first send,
I can walk you through it together.

Why not start now?
${companyName ? `I want ${companyName} to experience the thrill` : "I want you to experience the thrill"}
of getting your first reply!

${manager}
${phone}
KakaoTalk: ${kakao}
`,
    },
  },
  inactive_7days: {
    ko: {
      getSubject: ({ name }) => `${name} 대표님, 제가 뭘 잘못한 걸까요?`,
      getContent: ({ name, manager, phone }) => `
${name} 대표님,

가입하신 지 일주일이 지났는데
연락이 없으셔서 걱정됩니다.

솔직히 말씀드리면,
제가 대표님께 도움이 안 됐나 싶어서
마음이 좀 무거워요.

혹시 이런 이유였나요?

"너무 복잡해서 포기했어요"
"시간이 없어서 못 했어요"
"효과 없을 것 같아서 관뒀어요"

뭐가 됐든,
대표님 입장에서 뭔가 부족했던 거잖아요.

그게 뭔지 알고 싶어요.

전화 한 통만 주시면,
5분만 시간 내주시면
대표님 얘기 듣고 싶습니다.

혹시 관심 있으시면 이것도 드릴게요:

• 대표님 제품 맞는 바이어 리스트 (50개사)
• 해외영업 이메일 템플릿 (제가 직접 쓴 거)
• 체험판 2주 추가 연장

대가는 없어요.
그냥 대표님 피드백만 듣고 싶습니다.

괜찮으시면 전화 한 통만 주세요.
${phone}

${manager}

p.s. 혹시 정말 바쁘시거나 관심 없으시면
답장 안 하셔도 괜찮습니다. 이해합니다.
`,
    },
    en: {
      getSubject: ({ name }) => `${name}, did I do something wrong?`,
      getContent: ({ name, manager, phone }) => `
Hi ${name},

It's been a week since you signed up,
and I'm a bit worried I haven't heard from you.

Honestly, I'm wondering if I failed
to help you properly.

Was it because:
"It was too complicated"
"I didn't have time"
"I wasn't sure it would work"

Whatever the reason,
something wasn't right from your perspective.

I'd love to know what it was.

Just 5 minutes of your time on a call
would mean a lot to me.

If you're interested, I'll also give you:
• 50 buyer leads matched to your product
• Email templates I personally wrote
• 2 extra weeks of trial

No strings attached.
I just want your honest feedback.

Call me anytime: ${phone}

${manager}

p.s. If you're too busy or not interested,
that's totally fine. I understand.
`,
    },
  },
}

// ====================================
// MAIN FUNCTIONS
// ====================================

/**
 * Find all followup candidates (모든 퍼널 단계 체크)
 */
export async function findAllFollowupCandidates(): Promise<FollowupCandidate[]> {
  const [signupOnly, beforeConnect, noCampaign, inactive7d] = await Promise.all([
    findStuckAtSignup(),
    findStuckBeforeConnect(),
    findStuckNoCampaign(),
    findInactive7Days(),
  ])

  return [...signupOnly, ...beforeConnect, ...noCampaign, ...inactive7d]
}

/**
 * Send followup email to a candidate
 */
export async function sendFollowupEmail(candidate: FollowupCandidate): Promise<boolean> {
  const {
    userId,
    email,
    firstName,
    workspaceId,
    emailType,
    language,
    companyName,
    companyDescription,
  } = candidate

  if (emailType === "welcome") {
    logger.warn({ userId }, "[FollowupEmail] Welcome email should be sent via sendWelcomeEmail")
    return false
  }

  const lang = language === "en" ? "en" : "ko"
  const template = FOLLOWUP_TEMPLATES[emailType]?.[lang]

  if (!template) {
    logger.error({ emailType, language }, "[FollowupEmail] Template not found")
    return false
  }

  const templateContext: TemplateContext = {
    name: firstName,
    manager: config.cs.managerName,
    kakao: config.cs.kakaoLink,
    phone: config.cs.phoneNumber,
    companyName,
    companyDescription,
  }

  const subject = template.getSubject(templateContext)
  const content = template.getContent(templateContext)

  try {
    const response = await sendTransactionalEmail({
      senderName: config.cs.managerName,
      to: email,
      subject,
      body: JSON.stringify({
        content: `<pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap; line-height: 1.6;">${content}</pre>`,
      }),
    })

    if (response.success) {
      await recordFollowupEmail(userId, workspaceId, emailType, response.id)
      logger.info({ userId, emailType }, "[FollowupEmail] Sent successfully")
      return true
    }

    logger.error({ userId, emailType, error: response.error }, "[FollowupEmail] Failed to send")
    return false
  } catch (error) {
    logger.error({ error, userId, emailType }, "[FollowupEmail] Exception while sending")
    return false
  }
}

/**
 * Process all followup emails (Worker에서 호출)
 */
export async function processAllFollowupEmails(): Promise<{
  total: number
  sent: number
  failed: number
}> {
  const candidates = await findAllFollowupCandidates()

  logger.info({ count: candidates.length }, "[FollowupEmail] Found candidates")

  let sent = 0
  let failed = 0

  for (const candidate of candidates) {
    const success = await sendFollowupEmail(candidate)
    if (success) {
      sent++
    } else {
      failed++
    }
  }

  logger.info({ total: candidates.length, sent, failed }, "[FollowupEmail] Processing complete")

  return { total: candidates.length, sent, failed }
}
