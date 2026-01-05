# 온보딩 이메일 구현 계획

> 작성일: 2025-01-05
> 대상: 개발팀
> 버전: 1.0

---

## 개요

### 이메일 전략

```
사용자 가입
    ↓
온보딩 프로세스 (5분)
    ↓ SSE 실시간 알림
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Email 1: 완료 알림              ← 즉시 발송
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓ 24시간 경과 + 비활성
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Email 2: 재참여 이메일           ← 조건부 발송
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Email 1: 온보딩 완료 알림

### 목적

- 앱을 떠난 사용자 재유입
- 다음 단계(이메일 연결) 유도
- 긍정적 성과 강조로 동기 부여

### 발송 조건

| 조건 | 값 |
|------|-----|
| 트리거 | 온보딩 프로세스 완료 즉시 |
| 수신자 | 온보딩 완료한 모든 사용자 |
| 발송 횟수 | 1회 |

### 제목줄 (최적화)

```
한국어: {firstName}님, {leadCount}명 바이어 발견
영어:   {firstName}, {leadCount} buyers found

예시: 철희님, 148명 바이어 발견
```

### 본문 구조

```
┌─────────────────────────────────────────┐
│ [Rinda 로고]                            │
├─────────────────────────────────────────┤
│ 진행률 60% ████████░░░░                 │
│ "3/5 완료 - 이메일 연결만 남았어요!"      │
├─────────────────────────────────────────┤
│ ⚠️ 체험판 종료까지 {N}일                 │
├─────────────────────────────────────────┤
│ ✓ 온보딩 완료                           │
│                                         │
│ 안녕하세요 {firstName}님,                │
│ {industry} 업계 바이어를 발견했습니다.   │
├─────────────────────────────────────────┤
│ ┌─────────┐  ┌─────────┐                │
│ │   148   │  │   444   │                │
│ │ 리드 수 │  │ 이메일  │                │
│ └─────────┘  └─────────┘                │
├─────────────────────────────────────────┤
│ 📋 발견된 주요 기업                      │
│ ABC Corp, XYZ Inc 외 145개              │
├─────────────────────────────────────────┤
│     [대시보드에서 확인하기 →]            │
├─────────────────────────────────────────┤
│ 💬 "Rinda로 42개 미팅을 잡았습니다"      │
│    - 김OO, ABC 무역                     │
├─────────────────────────────────────────┤
│ 📝 다음 단계                            │
│ ① 이메일 계정 연결하기 (2분)            │
│ ② 이메일 초안 검토하기                  │
│ ③ 캠페인 시작하기!                      │
├─────────────────────────────────────────┤
│ [푸터]                                  │
└─────────────────────────────────────────┘
```

### 현재 코드 위치

```
elysia-server/src/services/loops.service.ts
elysia-server/src/services/onboarding-worker.service.ts:1139-1161
```

---

## Email 2: 재참여 이메일 (24시간 비활성)

### 목적

- 이탈한 사용자 재유입
- FOMO(놓칠까 두려움) 자극
- 체험판 기한 상기

### 발송 조건

| 조건 | 값 |
|------|-----|
| 트리거 | 온보딩 완료 후 24시간 경과 |
| 수신자 | 이메일 미연결 AND 캠페인 미시작 사용자 |
| 발송 횟수 | 1회 |
| 제외 조건 | 이미 이메일 연결 또는 캠페인 시작한 사용자 |

### 비활성 판단 기준

```typescript
// 비활성 사용자 조건
const isInactive = (
  !hasConnectedEmail(workspaceId) &&    // 이메일 미연결
  !hasStartedCampaign(workspaceId) &&   // 캠페인 미시작
  onboardingCompletedAt < now - 24h     // 24시간 경과
)
```

### 제목줄

```
한국어: {firstName}님, {leadCount}명 바이어가 기다리고 있어요
영어:   {firstName}, {leadCount} buyers are waiting

예시: 철희님, 148명 바이어가 기다리고 있어요
```

### 본문 구조

```
┌─────────────────────────────────────────┐
│ [Rinda 로고]                            │
├─────────────────────────────────────────┤
│ ⏰ 체험판 종료까지 {N}일                 │
├─────────────────────────────────────────┤
│                                         │
│ 안녕하세요 {firstName}님,                │
│                                         │
│ 어제 발견한 {leadCount}명의 바이어가      │
│ 아직 연락을 기다리고 있어요.              │
│                                         │
├─────────────────────────────────────────┤
│ 📊 현재 상태                            │
│                                         │
│ ✓ 리드 발굴 완료 ({leadCount}명)         │
│ ✓ 이메일 초안 생성 완료 ({emailCount}개)  │
│ ○ 이메일 계정 연결 (대기중)              │
│ ○ 캠페인 시작 (대기중)                   │
├─────────────────────────────────────────┤
│ 💡 2분만 투자하세요                      │
│                                         │
│ 이메일 계정만 연결하면                   │
│ 바로 캠페인을 시작할 수 있어요.           │
├─────────────────────────────────────────┤
│     [지금 이메일 연결하기 →]             │
├─────────────────────────────────────────┤
│ 💬 "첫 주에 15개 답장을 받았어요"        │
│    - 박OO, XYZ 트레이딩                 │
├─────────────────────────────────────────┤
│ [푸터]                                  │
└─────────────────────────────────────────┘
```

---

## 구현 계획

### Phase 1: Email 1 최적화 (3일)

#### 1.1 인터페이스 확장

**파일:** `elysia-server/src/services/loops.service.ts`

```typescript
// 현재
interface OnboardingCompleteEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"
}

// 확장
interface OnboardingCompleteEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"

  // 🆕 추가
  trialDaysRemaining?: number
  industry?: string
  topCompanies?: string[]
}
```

#### 1.2 제목줄 동적화

**파일:** `elysia-server/src/services/loops.service.ts`

```typescript
// 현재
const EMAIL_TEXTS = {
  ko: {
    subject: "[Rinda] 당신의 캠페인이 준비되었습니다!",
    // ...
  },
}

// 변경
const EMAIL_TEXTS = {
  ko: {
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, ${leadCount}명 바이어 발견`,
    subjectFallback: "바이어 리스트가 준비되었습니다",
    // ...
  },
}
```

#### 1.3 발송 로직 수정

**파일:** `elysia-server/src/services/onboarding-worker.service.ts`

```typescript
// 현재 (라인 1146-1153)
await sendOnboardingCompleteEmail({
  email: user.email,
  firstName: user.username || undefined,
  leadCount: leadIds.length,
  emailCount,
  dashboardUrl: `${config.frontendUrl}/company?step=4`,
  language: surveyData.lang === "en" ? "en" : "ko",
})

// 변경
// 1. 체험판 잔여 기간 계산
const subscription = await db
  .select()
  .from(subscriptions)
  .where(eq(subscriptions.workspaceId, workspaceId))
  .limit(1)

const trialDaysRemaining = subscription[0]?.trialEnd
  ? Math.max(0, Math.ceil(
      (new Date(subscription[0].trialEnd).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24)
    ))
  : undefined

// 2. 상위 기업 추출
const topCompanies = await db
  .select({ companyName: leads.companyName })
  .from(leads)
  .where(inArray(leads.id, leadIds.slice(0, 3)))

// 3. 산업 매핑
const industryLabels: Record<string, { ko: string; en: string }> = {
  beauty: { ko: "뷰티/화장품", en: "Beauty" },
  fashion: { ko: "패션/의류", en: "Fashion" },
  food: { ko: "식품", en: "Food" },
  it_saas: { ko: "IT/SaaS", en: "IT/SaaS" },
  manufacturing: { ko: "제조", en: "Manufacturing" },
}

const lang = surveyData.lang === "en" ? "en" : "ko"
const industry = industryLabels[surveyData.industry]?.[lang]

// 4. 발송
await sendOnboardingCompleteEmail({
  email: user.email,
  firstName: user.username || undefined,
  leadCount: leadIds.length,
  emailCount,
  dashboardUrl: `${config.frontendUrl}/company?step=4`,
  language: lang,
  trialDaysRemaining,
  industry,
  topCompanies: topCompanies.map(c => c.companyName).filter(Boolean),
})
```

#### 1.4 HTML 템플릿 업데이트

**파일:** `elysia-server/src/services/loops.service.ts`

`createOnboardingCompleteEmailHTML` 함수를 이전 문서의 최적화 템플릿으로 교체

---

### Phase 2: Email 2 구현 (5일)

#### 2.1 새로운 이메일 타입 정의

**파일:** `elysia-server/src/services/loops.service.ts`

```typescript
// 🆕 재참여 이메일 인터페이스
interface ReengagementEmailData {
  email: string
  firstName?: string
  leadCount: number
  emailCount: number
  dashboardUrl: string
  language?: "en" | "ko"
  trialDaysRemaining?: number
  onboardingCompletedAt: Date
}

// 🆕 재참여 이메일 텍스트
const REENGAGEMENT_TEXTS = {
  ko: {
    subject: (firstName: string, leadCount: number) =>
      `${firstName}님, ${leadCount}명 바이어가 기다리고 있어요`,
    subjectFallback: "바이어들이 기다리고 있어요",
    greeting: (name: string) => `안녕하세요 ${name}님,`,
    intro: (leadCount: number) =>
      `어제 발견한 ${leadCount}명의 바이어가 아직 연락을 기다리고 있어요.`,
    statusTitle: "현재 상태",
    statusItems: (leadCount: number, emailCount: number) => [
      { text: `리드 발굴 완료 (${leadCount}명)`, done: true },
      { text: `이메일 초안 생성 완료 (${emailCount}개)`, done: true },
      { text: "이메일 계정 연결", done: false, label: "대기중" },
      { text: "캠페인 시작", done: false, label: "대기중" },
    ],
    tipTitle: "2분만 투자하세요",
    tipText: "이메일 계정만 연결하면 바로 캠페인을 시작할 수 있어요.",
    ctaButton: "지금 이메일 연결하기 →",
    trialRemaining: (days: number) => `체험판 종료까지 ${days}일`,
    testimonial: {
      quote: "첫 주에 15개 답장을 받았어요. 기대 이상이었습니다.",
      author: "박OO",
      company: "XYZ 트레이딩 대표",
    },
    footer: "이 이메일은 린다 AI 온보딩 후속 알림입니다.",
    footerContact: "문의사항이 있으시면 admin@grinda.ai로 연락해주세요.",
    defaultName: "고객",
  },
  en: {
    subject: (firstName: string, leadCount: number) =>
      `${firstName}, ${leadCount} buyers are waiting`,
    subjectFallback: "Your buyers are waiting",
    greeting: (name: string) => `Hi ${name},`,
    intro: (leadCount: number) =>
      `The ${leadCount} buyers you discovered yesterday are still waiting to hear from you.`,
    statusTitle: "Current Status",
    statusItems: (leadCount: number, emailCount: number) => [
      { text: `Lead discovery complete (${leadCount})`, done: true },
      { text: `Email drafts ready (${emailCount})`, done: true },
      { text: "Connect email account", done: false, label: "Pending" },
      { text: "Start campaign", done: false, label: "Pending" },
    ],
    tipTitle: "Just 2 minutes",
    tipText: "Connect your email account and you're ready to launch.",
    ctaButton: "Connect Email Now →",
    trialRemaining: (days: number) => `${days} days left in trial`,
    testimonial: {
      quote: "Got 15 replies in the first week. Better than expected.",
      author: "John P.",
      company: "CEO, XYZ Trading",
    },
    footer: "This is a follow-up notification from Rinda AI.",
    footerContact: "For inquiries, please contact admin@grinda.ai",
    defaultName: "there",
  },
}
```

#### 2.2 재참여 이메일 HTML 생성 함수

**파일:** `elysia-server/src/services/loops.service.ts`

```typescript
function createReengagementEmailHTML(data: ReengagementEmailData): string {
  const {
    firstName,
    leadCount,
    emailCount,
    dashboardUrl,
    language = "ko",
    trialDaysRemaining,
  } = data

  const t = REENGAGEMENT_TEXTS[language]
  const name = firstName || t.defaultName
  const statusItems = t.statusItems(leadCount, emailCount)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" width="100%" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 20px 12px;">
        <table role="presentation" width="480" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0; padding: 20px 24px; text-align: center;">
              <div style="font-size: 22px; font-weight: 800; color: #ffffff;">Rinda</div>
            </td>
          </tr>

          <!-- Trial Warning -->
          ${trialDaysRemaining ? `
          <tr>
            <td style="padding: 16px 24px 0;">
              <table role="presentation" width="100%" style="background-color: #FEF3C7; border-radius: 8px;">
                <tr>
                  <td align="center" style="padding: 12px 16px;">
                    <span style="color: #D97706; font-size: 13px; font-weight: 600;">
                      ⏰ ${t.trialRemaining(trialDaysRemaining)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Greeting -->
          <tr>
            <td style="padding: 20px 24px 12px;">
              <h2 style="font-size: 18px; font-weight: 700; color: #1a202c; margin: 0 0 8px;">
                ${t.greeting(name)}
              </h2>
              <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">
                ${t.intro(leadCount)}
              </p>
            </td>
          </tr>

          <!-- Status Checklist -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%" style="background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
                <tr>
                  <td style="padding: 16px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 12px; text-transform: uppercase;">
                      ${t.statusTitle}
                    </div>
                    ${statusItems.map(item => `
                    <div style="display: flex; align-items: center; padding: 6px 0; font-size: 13px;">
                      <span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; text-align: center; line-height: 20px; margin-right: 10px; ${
                        item.done
                          ? 'background-color: #22C55E; color: #fff;'
                          : 'background-color: #E5E7EB; color: #9CA3AF;'
                      }">
                        ${item.done ? '✓' : '○'}
                      </span>
                      <span style="color: ${item.done ? '#374151' : '#9CA3AF'};">
                        ${item.text}
                        ${item.label ? `<span style="color: #F59E0B; font-size: 11px; margin-left: 4px;">(${item.label})</span>` : ''}
                      </span>
                    </div>
                    `).join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tip -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%" style="background-color: #EFF6FF; border-radius: 8px; border-left: 3px solid #3B82F6;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <div style="font-size: 13px; font-weight: 600; color: #1E40AF; margin-bottom: 4px;">
                      💡 ${t.tipTitle}
                    </div>
                    <div style="font-size: 13px; color: #3B82F6; line-height: 1.4;">
                      ${t.tipText}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
                    <a href="${dashboardUrl}" style="display: block; padding: 14px 20px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      ${t.ctaButton}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Testimonial -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%" style="background-color: #F0FDF4; border-radius: 8px; border-left: 3px solid #22C55E;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="font-style: italic; color: #166534; font-size: 13px; margin: 0 0 6px; line-height: 1.4;">
                      "${t.testimonial.quote}"
                    </p>
                    <p style="font-size: 11px; color: #6B7280; margin: 0;">
                      - ${t.testimonial.author}, ${t.testimonial.company}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 12px 24px 16px; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center; line-height: 1.5;">
                ${t.footer}<br/>${t.footerContact}
              </p>
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

// 🆕 재참여 이메일 발송 함수
export async function sendReengagementEmail(
  data: ReengagementEmailData
): Promise<boolean> {
  const language = data.language || "ko"
  const t = REENGAGEMENT_TEXTS[language]
  const name = data.firstName || t.defaultName

  const subject = typeof t.subject === 'function'
    ? t.subject(name, data.leadCount)
    : t.subjectFallback

  logger.info(`[Loops] Preparing reengagement email for ${data.email}`)

  try {
    const content = createReengagementEmailHTML(data)

    const response = await sendTransactionalEmail({
      senderName: "Rinda",
      to: data.email,
      subject,
      body: JSON.stringify({ content }),
    })

    return response.success
  } catch (error) {
    logger.error(`[Loops] Failed to send reengagement email: ${error}`)
    return false
  }
}
```

#### 2.3 스케줄러 워커 생성

**파일:** `elysia-server/src/workers/bullmq/reengagement-email.worker.ts`

```typescript
import { Worker, Queue } from "bullmq"
import { db } from "../../db"
import { users, workspaces, subscriptions, sequences, nylasAccounts } from "../../db/schema"
import { eq, and, lt, isNull } from "drizzle-orm"
import { sendReengagementEmail, isLoopsConfigured } from "../../services/loops.service"
import { config } from "../../config"
import { redis } from "../../lib/redis"

// Queue 정의
export const reengagementQueue = new Queue("reengagement-email", {
  connection: redis,
})

// 매일 오전 10시에 실행 (한국 시간)
// cron: "0 1 * * *" (UTC 01:00 = KST 10:00)

interface ReengagementJob {
  trigger: "scheduled" | "manual"
}

// 워커 정의
const worker = new Worker<ReengagementJob>(
  "reengagement-email",
  async (job) => {
    console.log(`[ReengagementWorker] Starting job ${job.id}`)

    if (!isLoopsConfigured()) {
      console.log("[ReengagementWorker] Loops not configured, skipping")
      return { sent: 0, skipped: "not_configured" }
    }

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // 1. 비활성 사용자 찾기
    // 조건:
    // - 온보딩 완료 후 24시간 경과
    // - 이메일 계정 미연결 (nylasAccounts 없음)
    // - 캠페인 미시작 (sequences.status !== 'active')
    // - 재참여 이메일 미발송

    const inactiveUsers = await db
      .select({
        userId: users.id,
        email: users.email,
        username: users.username,
        workspaceId: workspaces.id,
        onboardingCompletedAt: workspaces.onboardingCompletedAt,
        trialEnd: subscriptions.trialEnd,
        leadCount: workspaces.leadCount,  // 저장해둔 리드 수
        language: workspaces.language,
      })
      .from(users)
      .innerJoin(workspaces, eq(workspaces.ownerId, users.id))
      .leftJoin(subscriptions, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(nylasAccounts, eq(nylasAccounts.workspaceId, workspaces.id))
      .where(
        and(
          lt(workspaces.onboardingCompletedAt, yesterday),  // 24시간 전 완료
          isNull(nylasAccounts.id),                         // 이메일 미연결
          isNull(workspaces.reengagementEmailSentAt),       // 재참여 이메일 미발송
        )
      )

    console.log(`[ReengagementWorker] Found ${inactiveUsers.length} inactive users`)

    let sentCount = 0

    for (const user of inactiveUsers) {
      try {
        // 캠페인 시작 여부 확인
        const activeSequence = await db
          .select()
          .from(sequences)
          .where(
            and(
              eq(sequences.workspaceId, user.workspaceId),
              eq(sequences.status, "active")
            )
          )
          .limit(1)

        if (activeSequence.length > 0) {
          console.log(`[ReengagementWorker] User ${user.email} has active campaign, skipping`)
          continue
        }

        // 체험판 잔여 기간 계산
        const trialDaysRemaining = user.trialEnd
          ? Math.max(0, Math.ceil(
              (new Date(user.trialEnd).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
            ))
          : undefined

        // 재참여 이메일 발송
        const success = await sendReengagementEmail({
          email: user.email,
          firstName: user.username || undefined,
          leadCount: user.leadCount || 0,
          emailCount: (user.leadCount || 0) * 3,
          dashboardUrl: `${config.frontendUrl}/company?step=4`,
          language: user.language === "en" ? "en" : "ko",
          trialDaysRemaining,
          onboardingCompletedAt: user.onboardingCompletedAt,
        })

        if (success) {
          // 발송 기록 저장
          await db
            .update(workspaces)
            .set({ reengagementEmailSentAt: now })
            .where(eq(workspaces.id, user.workspaceId))

          sentCount++
          console.log(`[ReengagementWorker] Sent to ${user.email}`)
        }
      } catch (error) {
        console.error(`[ReengagementWorker] Error for ${user.email}:`, error)
      }
    }

    console.log(`[ReengagementWorker] Completed. Sent: ${sentCount}`)

    return { sent: sentCount, total: inactiveUsers.length }
  },
  {
    connection: redis,
    concurrency: 1,
  }
)

// 스케줄 등록 (앱 시작 시)
export async function setupReengagementSchedule() {
  // 기존 스케줄 제거
  await reengagementQueue.obliterate({ force: true })

  // 매일 오전 10시 (KST) 실행
  await reengagementQueue.add(
    "daily-reengagement",
    { trigger: "scheduled" },
    {
      repeat: {
        pattern: "0 1 * * *",  // UTC 01:00 = KST 10:00
      },
    }
  )

  console.log("[ReengagementWorker] Daily schedule set for 10:00 KST")
}

export default worker
```

#### 2.4 DB 스키마 추가

**파일:** `elysia-server/src/db/schema.ts`

```typescript
// workspaces 테이블에 추가
export const workspaces = pgTable("workspaces", {
  // ... 기존 필드들

  // 🆕 추가
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  leadCount: integer("lead_count"),
  language: varchar("language", { length: 10 }),
  reengagementEmailSentAt: timestamp("reengagement_email_sent_at"),
})
```

#### 2.5 온보딩 완료 시 데이터 저장

**파일:** `elysia-server/src/services/onboarding-worker.service.ts`

```typescript
// completeOnboarding 함수에 추가

// 온보딩 완료 정보 저장 (재참여 이메일용)
await db
  .update(workspaces)
  .set({
    onboardingCompletedAt: new Date(),
    leadCount: leadIds.length,
    language: surveyData.lang,
  })
  .where(eq(workspaces.id, workspaceId))
```

---

## 파일 변경 요약

| 파일 | 변경 내용 |
|------|----------|
| `loops.service.ts` | 인터페이스 확장, 제목줄 동적화, HTML 최적화, 재참여 이메일 함수 추가 |
| `onboarding-worker.service.ts` | 발송 데이터 확장, 온보딩 완료 정보 저장 |
| `reengagement-email.worker.ts` | 🆕 신규 워커 생성 |
| `schema.ts` | workspaces 테이블 필드 추가 |
| `index.ts` (worker entry) | 재참여 스케줄러 초기화 추가 |

---

## 타임라인

| 단계 | 작업 | 소요 |
|------|------|------|
| Phase 1.1 | 인터페이스 확장 | 0.5일 |
| Phase 1.2 | 제목줄 동적화 | 0.5일 |
| Phase 1.3 | 발송 로직 수정 | 1일 |
| Phase 1.4 | HTML 템플릿 업데이트 | 1일 |
| **Phase 1 완료** | | **3일** |
| Phase 2.1 | 재참여 이메일 타입 정의 | 0.5일 |
| Phase 2.2 | HTML 생성 함수 | 1일 |
| Phase 2.3 | 스케줄러 워커 생성 | 1.5일 |
| Phase 2.4 | DB 스키마 추가 | 0.5일 |
| Phase 2.5 | 온보딩 완료 데이터 저장 | 0.5일 |
| Phase 2.6 | 테스트 및 디버깅 | 1일 |
| **Phase 2 완료** | | **5일** |
| **총 소요** | | **8일** |

---

## 테스트 체크리스트

### Email 1: 완료 알림

- [ ] 제목줄에 이름과 리드 수 표시 확인
- [ ] 체험판 잔여 기간 배너 표시 확인
- [ ] 산업별 맞춤 메시지 확인
- [ ] 상위 기업 표시 확인
- [ ] 모바일 렌더링 확인

### Email 2: 재참여 이메일

- [ ] 24시간 후 정확히 발송 확인
- [ ] 이미 이메일 연결한 사용자 제외 확인
- [ ] 이미 캠페인 시작한 사용자 제외 확인
- [ ] 중복 발송 방지 확인
- [ ] 체크리스트 상태 정확히 표시 확인
