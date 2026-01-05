# 온보딩 완료 이메일 템플릿 구조

> 작성일: 2025-01-05
> 대상: 개발팀, 마케팅팀
> 버전: 1.0

---

## 5W1H 요약

| 항목 | 내용 |
|------|------|
| **What** | 체험판 온보딩 완료 시 발송되는 마케팅 이메일 |
| **Why** | 장시간 온보딩 프로세스 중 사용자 이탈 방지 및 다음 단계 유도 |
| **Who** | 체험판 온보딩을 완료한 사용자 |
| **When** | 백엔드 온보딩 워커가 모든 단계(리드 발굴, 이메일 생성)를 완료했을 때 |
| **Where** | Loops.so Transactional Email API |
| **How** | HTML 템플릿 생성 → Loops.so API 호출 → 이메일 발송 |

---

## 개요

### 이메일 목적

온보딩 자동 생성 프로세스(리드 발굴 → 그룹 생성 → 템플릿 생성 → 시퀀스 생성 → 프리뷰 생성)가 완료되면 사용자에게 결과를 알리고 대시보드로 유도하는 알림 이메일입니다.

### 이메일 미리보기

```
┌─────────────────────────────────────────┐
│            [Rinda 로고]                 │
│     AI-Powered Global Sales             │
├─────────────────────────────────────────┤
│                                         │
│     ✓ 온보딩이 완료되었습니다!           │
│                                         │
│     안녕하세요 이철희님,                 │
│     린다 AI가 바이어 리스트와            │
│     이메일 초안을 준비했습니다.          │
│                                         │
│  ┌─────────────┐  ┌─────────────┐       │
│  │     148     │  │     444     │       │
│  │ 발견된 리드 │  │ 생성된 이메일│       │
│  └─────────────┘  └─────────────┘       │
│                                         │
│     [대시보드에서 확인하기 →]            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 다음 단계                        │    │
│  │ ① 생성된 이메일 초안을 검토하세요 │    │
│  │ ② 캠페인을 시작하세요!           │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│ 이 이메일은 린다 AI 온보딩 완료 알림입니다│
│ 문의: admin@grinda.ai                   │
└─────────────────────────────────────────┘
```

---

## 아키텍처

### 시스템 흐름

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   프론트엔드      │    │     백엔드        │    │    Loops.so      │
│ TrialResultPage  │    │ onboarding-worker │    │  Transactional   │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         │ "캠페인 시작" 클릭     │                       │
         │ navigate("/company")  │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ autoGenerateOnboarding()
         │                       │ ① Discovery Phase     │
         │                       │ ② Group Phase         │
         │                       │ ③ Templates Phase     │
         │                       │ ④ Sequence Phase      │
         │                       │ ⑤ Previews Phase      │
         │                       │ ⑥ Complete Phase      │
         │                       │                       │
         │                       │ sendOnboardingCompleteEmail()
         │                       │──────────────────────>│
         │                       │                       │
         │                       │      { success: true }│
         │                       │<──────────────────────│
         │                       │                       │
         │                       │                    📧 이메일 발송
         │                       │                       │──────> 사용자
```

### 파일 구조

```
elysia-server/src/
├── services/
│   ├── loops.service.ts              # Loops.so API 연동 + HTML 템플릿 생성
│   └── onboarding-worker.service.ts  # 온보딩 완료 시 이메일 발송 트리거
└── config/
    └── index.ts                      # LOOPS_API_KEY, TRANSACTIONAL_ID 설정

admin/src/
└── pages/
    └── TrialResultPage.tsx           # 체험판 결과 페이지 (프론트엔드)
```

---

## 백엔드 코드 상세

### 1. 이메일 발송 트리거

**파일**: `elysia-server/src/services/onboarding-worker.service.ts:1139-1161`

```typescript
// 온보딩 완료 시 Loops.so로 이메일 발송
if (isLoopsConfigured()) {
  try {
    const user = await getUser(userId)
    if (user?.email) {
      const emailCount = leadIds.length * 3 // 3-touch 시퀀스

      await sendOnboardingCompleteEmail({
        email: user.email,
        firstName: user.username || undefined,
        leadCount: leadIds.length,        // 발견된 리드 수
        emailCount,                       // 리드 × 3
        dashboardUrl: `${config.frontendUrl}/company?step=4`,
        language: surveyData.lang === "en" ? "en" : "ko",
      })

      console.log(`[CompletePhase] Sent completion email to ${user.email}`)
    }
  } catch (emailError) {
    // 이메일 실패해도 온보딩은 계속 진행 (fault-tolerant)
    console.error("[CompletePhase] Failed to send completion email:", emailError)
  }
}
```

**핵심 포인트**:
- `leadCount`: 실제 발굴된 리드 수 (예: 148)
- `emailCount`: `leadCount × 3` (3-touch 시퀀스이므로 444)
- 이메일 실패해도 온보딩 전체가 실패하지 않음 (try-catch)

---

### 2. Loops.so 서비스

**파일**: `elysia-server/src/services/loops.service.ts`

#### 인터페이스 정의

```typescript
interface OnboardingCompleteEmailData {
  email: string              // 수신자 이메일
  firstName?: string         // 사용자 이름 (없으면 "고객"/"there" 사용)
  leadCount: number          // 발견된 리드 수
  emailCount: number         // 생성된 이메일 수
  dashboardUrl: string       // CTA 버튼 링크
  language?: "en" | "ko"     // 언어 설정 (기본: ko)
}
```

#### 다국어 지원 (EMAIL_TEXTS)

```typescript
const EMAIL_TEXTS = {
  ko: {
    subject: "[Rinda] 당신의 캠페인이 준비되었습니다!",
    title: "온보딩이 완료되었습니다!",
    greeting: (name: string) => `안녕하세요 ${name}님,`,
    intro: "린다(Rinda) AI가 바이어 리스트와 이메일 초안을 준비했습니다.",
    leadsFound: "발견된 리드",
    emailsGenerated: "생성된 이메일",
    ctaButton: "대시보드에서 확인하기 →",
    nextStepsTitle: "다음 단계",
    nextSteps: [
      "생성된 이메일 초안을 검토하세요",
      "캠페인을 시작하세요!"
    ],
    footer: "이 이메일은 린다 AI 온보딩 완료 알림입니다.",
    footerContact: "문의사항이 있으시면 admin@grinda.ai로 연락해주세요.",
    defaultName: "고객",
  },
  en: {
    subject: "[Rinda] Your campaign is ready!",
    title: "Onboarding Complete!",
    greeting: (name: string) => `Hi ${name},`,
    intro: "Rinda AI has prepared your buyer list and email drafts.",
    leadsFound: "Leads Found",
    emailsGenerated: "Emails Generated",
    ctaButton: "View Dashboard →",
    nextStepsTitle: "NEXT STEPS",
    nextSteps: [
      "Review your generated email drafts",
      "Start your campaign!"
    ],
    footer: "This email is a notification for completing Rinda AI onboarding.",
    footerContact: "For inquiries, please contact admin@grinda.ai",
    defaultName: "there",
  },
}
```

#### HTML 템플릿 생성 함수

```typescript
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
  </head>
  <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: ...">
    <!-- 테이블 기반 레이아웃 (이메일 클라이언트 호환성) -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <!-- 헤더: 보라색 그라데이션 + Rinda 로고 -->
      <!-- 성공 배지: ✓ 온보딩이 완료되었습니다! -->
      <!-- 인사말: 안녕하세요 {name}님 -->
      <!-- 통계 카드: 리드 수 / 이메일 수 -->
      <!-- CTA 버튼: 대시보드에서 확인하기 → -->
      <!-- 다음 단계 체크리스트 -->
      <!-- 푸터 -->
    </table>
  </body>
  </html>
  `.trim()
}
```

#### API 호출 함수

```typescript
export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<LoopsTransactionalEmailResponse> {
  const apiKey = config.loops.apiKey
  const transactionalId = config.loops.transactionalIds.onboardingComplete

  const response = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: sanitizedTo,
      transactionalId,
      dataVariables: {
        senderName: "Rinda",
        subject: params.subject,
        content: htmlContent,  // 생성된 HTML
      },
    }),
  })

  return { success: true, id: result.id }
}
```

---

## HTML 템플릿 구조

### 레이아웃 구성

| 섹션 | 설명 | 스타일 |
|------|------|--------|
| **헤더** | Rinda 로고 + 서브타이틀 | 보라색 그라데이션 (`#667eea` → `#764ba2`) |
| **성공 배지** | `✓ 온보딩이 완료되었습니다!` | 녹색 배경 (`#ecfdf5`) |
| **인사말** | `안녕하세요 {name}님,` + 소개문 | 중앙 정렬 |
| **통계 카드** | 리드 수 / 이메일 수 | 그라데이션 카드 (보라, 청록) |
| **CTA 버튼** | `대시보드에서 확인하기 →` | 보라색 그라데이션 |
| **다음 단계** | 번호가 매겨진 체크리스트 | 회색 배경 카드 |
| **푸터** | 알림 안내 + 문의처 | 테두리 상단 |

### 디자인 토큰

```css
/* 색상 팔레트 */
--primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--secondary-gradient: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
--success-bg: #ecfdf5;
--success-text: #059669;
--background: #f0f4f8;
--card-bg: #ffffff;
--text-primary: #1a202c;
--text-secondary: #64748b;
--text-muted: #94a3b8;

/* 타이포그래피 */
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
--font-size-xl: 24px;
--font-size-lg: 18px;
--font-size-base: 14px;
--font-size-sm: 12px;
--font-size-xs: 11px;

/* 레이아웃 */
--max-width: 480px;
--border-radius: 12px;
--card-radius: 8px;
--padding: 24px;
```

### 반응형 고려사항

- **max-width: 480px**: 모바일 최적화
- **테이블 기반 레이아웃**: 이메일 클라이언트 호환성 (Gmail, Outlook, Apple Mail)
- **인라인 스타일**: 외부 CSS 미지원 이메일 클라이언트 대응
- **폴백 폰트**: 시스템 폰트 스택 사용

---

## 환경 설정

### 필수 환경 변수

```bash
# Loops.so API 설정
LOOPS_API_KEY=<Bearer 토큰>
LOOPS_TRANSACTIONAL_IDS_ONBOARDING_COMPLETE=<Loops.so 템플릿 ID>

# 프론트엔드 URL (CTA 버튼 링크)
FRONTEND_URL=https://app.rinda.ai
```

### 설정 확인 함수

```typescript
export function isLoopsConfigured(): boolean {
  return !!config.loops.apiKey && !!config.loops.transactionalIds.onboardingComplete
}
```

---

## 프론트엔드 연동

### TrialResultPage.tsx

**파일**: `admin/src/pages/TrialResultPage.tsx`

#### 주요 기능

1. **분석 로딩 애니메이션**: 4단계 진행 표시
2. **Mock 데이터 생성**: 산업/경험별 맞춤 시장 추천
3. **결과 화면**: 3개 시장 카드 + RINDA 자동화 기능 설명

#### 캠페인 시작 흐름

```typescript
const handleGetStarted = () => {
  navigate("/company")  // → 백엔드 온보딩 워커 트리거
}
```

---

## 데이터 흐름

### 이메일 통계 계산

```
리드 발굴 결과: 148개 리드
    ↓
3-touch 시퀀스 적용
    ↓
이메일 수: 148 × 3 = 444개
```

### 전달 데이터

| 필드 | 값 예시 | 설명 |
|------|---------|------|
| `email` | `user@example.com` | 수신자 이메일 |
| `firstName` | `이철희` | 사용자명 (없으면 기본값) |
| `leadCount` | `148` | 발견된 리드 수 |
| `emailCount` | `444` | 생성된 이메일 수 (리드 × 3) |
| `dashboardUrl` | `https://app.rinda.ai/company?step=4` | CTA 링크 |
| `language` | `ko` | 언어 설정 |

---

## 에러 처리

### Fault-Tolerant 설계

```typescript
try {
  await sendOnboardingCompleteEmail({ ... })
} catch (emailError) {
  // 이메일 실패해도 온보딩 프로세스는 계속 진행
  console.error("[CompletePhase] Failed to send completion email:", emailError)
}
```

### 실패 시나리오

| 상황 | 동작 | 사용자 영향 |
|------|------|------------|
| API 키 미설정 | 로그 경고 후 스킵 | 이메일 미수신 (온보딩 정상 완료) |
| 템플릿 ID 미설정 | 로그 경고 후 스킵 | 이메일 미수신 (온보딩 정상 완료) |
| 네트워크 오류 | 에러 로그 후 계속 진행 | 이메일 미수신 (온보딩 정상 완료) |
| 사용자 이메일 없음 | 발송 스킵 | 이메일 미수신 |

---

## 참고 자료

- [Loops.so Transactional API 문서](https://loops.so/docs/api-reference/transactional)
- [이메일 HTML 템플릿 가이드](https://www.litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design)
- 관련 코드:
  - `elysia-server/src/services/loops.service.ts`
  - `elysia-server/src/services/onboarding-worker.service.ts`
  - `admin/src/pages/TrialResultPage.tsx`
