# 체험판 만료 및 유예기간 안내 메일 설계

> 체험판 14일 + 유예기간 3일 기준

## 1. 타임라인 개요

```
Day 0    가입           → welcome 메일
Day 1    Step1 미진행    → signup_only 메일 (24h)
Day 2-3  연동 미진행     → before_connect 메일 (48h)
Day 3-4  캠페인 미발송   → no_campaign 메일 (48h)
Day 7    미접속         → inactive_7days 메일
Day 11   만료 3일 전     → trial_expiring 메일 (NEW)
Day 14   체험판 만료     → trial_expired 메일 (NEW)
Day 16   해제 1일 전     → grace_period_warning 메일 (NEW)
Day 17   연동 해제       → unipile_disconnected 메일 (NEW)
```

---

## 2. 요금제 정보 (DB 기준 - billing_plans 테이블)

> ⚠️ 메일 발송 시 DB에서 동적으로 조회하여 최신 가격 반영

### 체험판 (Trial)
| 항목 | 값 |
|------|------|
| 기간 | 14일 |
| 가격 | ₩0 |

**기능:** 대시보드 (제한적), 인박스 (5회 열람), 설정 (개인정보만)

### Basic
| 항목 | 월간 | 연간 |
|------|------|------|
| 가격 | ₩300,000/월 | ₩250,000/월 (연 ₩3,000,000) |
| 할인 | - | 17% |

**기능:** 대시보드, 인박스 (무제한), 설정, 관리자 대행 서비스

### Pro ⭐ 추천
| 항목 | 월간 | 연간 |
|------|------|------|
| 가격 | ₩2,000,000/월 | ₩1,666,667/월 (연 ₩20,000,000) |
| 할인 | - | 17% |

**기능:** 대시보드, 고객 탐색, 고객 관리, 캠페인, 인박스, 설정

### Enterprise
- 맞춤형 가격 (영업팀 문의)
- Pro의 모든 기능 + Rinda GPT

### DB 조회 쿼리
```sql
SELECT
  bp.name as plan_name,
  bp.amount,
  bp.billing_interval,
  bprod.features
FROM billing_plans bp
JOIN billing_products bprod ON bp.product_id = bprod.id
WHERE bp.is_active = true AND bprod.tier IN ('basic', 'pro', 'enterprise')
ORDER BY bprod.tier, bp.billing_interval;
```

---

## 3. 새로 추가할 이메일 타입

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

trial_expiring - 체험판 만료 3일 전 (Day 11)

목적: 체험판 종료 임박 알림, 유료 전환 유도

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[한국어]

제목: {name}님, 체험판이 3일 후 종료됩니다

---

{name} 대표님, 안녕하세요.
RINDA 체험판이 3일 후 종료됩니다.

지금까지의 성과
• 발송한 이메일: {sentCount}건
• 평균 오픈율: {openRate}%
• 받은 답장: {replyCount}건

체험판이 종료되면:
• 진행 중인 캠페인이 일시 정지됩니다
• 3일 내 유료 전환 시 이메일 연동이 유지됩니다

---

추천 요금제

• Basic - 월 {basicMonthlyPrice}
  {basicFeatures}

• Pro (추천) - 월 {proMonthlyPrice}
  {proFeatures}

※ 연간 결제 시 17% 할인

지금 업그레이드하기 → https://app.rinda.ai

---

궁금하신 점이 있으시면 언제든 연락주세요.

전화: 010-6326-9009
카톡: https://open.kakao.com/o/gDej0jbi

{managerName}
RINDA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[English]

Subject: {name}, your trial ends in 3 days

---

Hi {name},
Your RINDA trial ends in 3 days.

Your Progress So Far
• Emails sent: {sentCount}
• Average open rate: {openRate}%
• Replies received: {replyCount}

When your trial ends:
• Active campaigns will be paused
• Upgrade within 3 days to keep your email connection

---

Recommended Plans

• Basic - {basicMonthlyPrice}/month
  {basicFeaturesEn}

• Pro (Recommended) - {proMonthlyPrice}/month
  {proFeaturesEn}

※ Save 17% with annual billing

Upgrade Now → https://app.rinda.ai

---

Questions? Reach out anytime.

Phone: 010-6326-9009
KakaoTalk: https://open.kakao.com/o/gDej0jbi

{managerName}
RINDA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

trial_expired - 체험판 만료 (Day 14)

목적: 체험판 종료 알림, 긴급 유료 전환 유도

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[한국어]

제목: {name}님, 체험판이 종료되었습니다

---

{name} 대표님,

RINDA 14일 체험판이 종료되었습니다.

현재 상태
• 캠페인: 일시 정지됨
• 이메일 연동: 3일간 유지 (이후 자동 해제)

---

지금 업그레이드하시면

• 일시 정지된 캠페인 즉시 재개
• 이메일 연동 유지 (재연동 불필요)
• 지금까지의 데이터 모두 보존

---

요금제 안내

Basic
• 월 {basicMonthlyPrice} (연간 시 {basicYearlyMonthlyPrice})
• {basicFeaturesList}

Pro (추천)
• 월 {proMonthlyPrice} (연간 시 {proYearlyMonthlyPrice})
• {proFeaturesList}

지금 업그레이드 → https://app.rinda.ai
영업팀 상담 예약 → https://rinda.ai/contact

---

3일 후 이메일 연동이 자동 해제됩니다.
해제 전 업그레이드하시면 재연동 없이 바로 사용 가능합니다.

{managerName}
RINDA

전화: 010-6326-9009
카톡: https://open.kakao.com/o/gDej0jbi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[English]

Subject: {name}, your trial has ended

---

Hi {name},

Your 14-day RINDA trial has ended.

Current Status
• Campaigns: Paused
• Email connection: Active for 3 more days (then auto-disconnected)

---

Upgrade Now and Get

• Resume paused campaigns instantly
• Keep your email connection (no re-setup needed)
• Preserve all your data

---

Pricing

Basic
• {basicMonthlyPrice}/mo ({basicYearlyMonthlyPrice} annually)
• {basicFeaturesListEn}

Pro (Recommended)
• {proMonthlyPrice}/mo ({proYearlyMonthlyPrice} annually)
• {proFeaturesListEn}

Upgrade Now → https://app.rinda.ai
Talk to Sales → https://rinda.ai/contact

---

Email connection will be disconnected in 3 days.
Upgrade before then to avoid re-setup.

{managerName}
RINDA

Phone: 010-6326-9009
KakaoTalk: https://open.kakao.com/o/gDej0jbi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

grace_period_warning - 유예기간 종료 1일 전 (Day 16)

목적: 긴급 경고, 마지막 전환 기회

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[한국어]

제목: {name}님, 내일 이메일 연동이 해제됩니다

---

{name} 대표님,

중요한 안내드립니다.
내일(24시간 후) 이메일 연동이 자동 해제됩니다.

연동 해제 시:
• 모든 캠페인 발송 중단
• 받은 답장 더 이상 추적 안 됨
• 다시 시작하려면 이메일 재연동 필요

---

지금 업그레이드하면?

• 연동 해제 없이 그대로 유지
• 캠페인 즉시 재개 가능
• 모든 기록 보존

Basic: 월 {basicMonthlyPrice}부터
Pro: 월 {proMonthlyPrice} (전담 매니저 포함)

지금 바로 업그레이드 → https://app.rinda.ai

---

망설여지시면 전화주세요.
5분 상담으로 최적의 플랜 찾아드립니다.

전화: 010-6326-9009 (평일 09:00-18:00)
카톡: https://open.kakao.com/o/gDej0jbi (10분 내 답장)

{managerName}
RINDA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[English]

Subject: {name}, your email connection will be removed tomorrow

---

Hi {name},

Important Notice
Your email connection will be automatically removed tomorrow (in 24 hours).

What happens then:
• All campaigns will stop
• Reply tracking will end
• You'll need to re-connect your email to restart

---

Upgrade now to:

• Keep your email connected
• Resume campaigns instantly
• Preserve all your data

Basic: From {basicMonthlyPrice}/month
Pro: {proMonthlyPrice}/month (includes dedicated manager)

Upgrade Now → https://app.rinda.ai

---

Not sure? Give us a call.
5-minute consultation to find your best plan.

Phone: 010-6326-9009 (Mon-Fri 09:00-18:00 KST)
KakaoTalk: https://open.kakao.com/o/gDej0jbi (reply within 10 min)

{managerName}
RINDA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

unipile_disconnected - 연동 해제 완료 (Day 17)

목적: 해제 안내, 재시작 유도

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[한국어]

제목: {name}님, 이메일 연동이 해제되었습니다

---

{name} 대표님,

체험판 유예기간이 종료되어 이메일 연동이 해제되었습니다.

현재 상태:
• 캠페인: 모두 중단됨
• 이메일 연동: 해제됨
• 데이터: 30일간 보관 후 삭제

---

다시 시작하고 싶으시다면

• RINDA 로그인 (기존 계정 유지)
• 요금제 선택 및 결제
• 캠페인 재개!

다시 시작하기 → https://app.rinda.ai

---

솔직히 여쭤볼게요.

RINDA가 기대에 못 미쳤나요?
어떤 점이 아쉬우셨는지 알려주시면
더 나은 서비스로 보답하겠습니다.

피드백 주시면 다음에 재가입 시
체험판 1주 추가 제공해드릴게요.

전화: 010-6326-9009
카톡: https://open.kakao.com/o/gDej0jbi

언제든 다시 찾아주세요.

{managerName}
RINDA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[English]

Subject: {name}, your email connection has been removed

---

Hi {name},

Your trial grace period has ended, and your email connection has been removed.

Current Status:
• Campaigns: All stopped
• Email connection: Removed
• Data: Stored for 30 days, then deleted

---

Want to Start Again?

• Log in to RINDA (your account is still active)
• Choose a plan and subscribe
• Re-connect your email (takes 1 minute)
• Resume your campaigns!

Start Again → https://app.rinda.ai

---

Honest question:

Did RINDA not meet your expectations?
We'd love to hear what we could improve.

Share your feedback and get
1 extra week of trial on your next signup.

Phone: 010-6326-9009
KakaoTalk: https://open.kakao.com/o/gDej0jbi

We hope to see you again.

{managerName}
RINDA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 4. DB 스키마 변경 필요사항

### followup_email_type enum 추가

```sql
ALTER TYPE followup_email_type ADD VALUE 'trial_expiring';
ALTER TYPE followup_email_type ADD VALUE 'trial_expired';
ALTER TYPE followup_email_type ADD VALUE 'grace_period_warning';
ALTER TYPE followup_email_type ADD VALUE 'unipile_disconnected';
```

### 새로운 쿼리 조건

| 이메일 타입 | 조건 |
|-------------|------|
| `trial_expiring` | `status='trialing'` AND `trialEnd BETWEEN now+2days AND now+3days` |
| `trial_expired` | `status='expired'` AND `updatedAt BETWEEN now-1day AND now` |
| `grace_period_warning` | `status='expired'` AND `trialEnd BETWEEN now-2days AND now-1day` |
| `unipile_disconnected` | Unipile 해제 후 즉시 (워커에서 트리거) |

---

## 5. 워커 실행 스케줄

| 이메일 | 실행 주기 | 워커 |
|--------|-----------|------|
| `trial_expiring` | 매일 09:00 KST | followup-email.worker.ts |
| `trial_expired` | 매시간 (trial-expiration.worker와 함께) | trial-expiration.worker.ts |
| `grace_period_warning` | 매일 09:00 KST | followup-email.worker.ts |
| `unipile_disconnected` | 해제 직후 | trial-expiration.worker.ts |

---

## 6. 변수 목록

### 기본 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `{name}` | 사용자 이름 | 홍길동 |
| `{managerName}` | CS 매니저 이름 | 강호진 |
| `{sentCount}` | 발송한 이메일 수 | 150 |
| `{openRate}` | 평균 오픈율 | 45.2 |
| `{replyCount}` | 받은 답장 수 | 12 |
| `{companyName}` | 회사명 | ABC Corp |
| `{daysRemaining}` | 남은 일수 | 3 |

### 요금제 변수 (DB 동적 조회)

| 변수 | 설명 | 예시 |
|------|------|------|
| `{basicMonthlyPrice}` | Basic 월간 가격 | ₩300,000 |
| `{basicYearlyMonthlyPrice}` | Basic 연간(월환산) 가격 | ₩250,000 |
| `{basicFeatures}` | Basic 기능 목록 | • 대시보드\n• 인박스... |
| `{basicFeaturesList}` | Basic 기능 (박스용) | ✓ 대시보드\n│ ✓ 인박스... |
| `{proMonthlyPrice}` | Pro 월간 가격 | ₩2,000,000 |
| `{proYearlyMonthlyPrice}` | Pro 연간(월환산) 가격 | ₩1,666,667 |
| `{proFeatures}` | Pro 기능 목록 | • 대시보드\n• 고객 탐색... |
| `{proFeaturesList}` | Pro 기능 (박스용) | ✓ 대시보드\n│ ✓ 고객 탐색... |

---

## 7. 참고: 현재 메일 시스템

### 발송 서비스
- **Loops.so** - Transactional email API
- `sendTransactionalEmail()` - 공통 발송 함수
- `sendWelcomeEmail()` - 환영 메일 전용

### 관련 파일
- `elysia-server/src/services/loops.service.ts` - 메일 발송
- `elysia-server/src/services/followup-email.service.ts` - 팔로업 메일 로직
- `elysia-server/src/db/schema/followup-emails.ts` - DB 스키마
- `elysia-server/src/workers/bullmq/trial-expiration.worker.ts` - 체험판 만료 워커

---

## 8. DB 기반 동적 요금제 조회 구현

### 8.1 요금제 조회 함수

```typescript
// elysia-server/src/services/pricing.service.ts

interface PlanInfo {
  name: string
  monthlyPrice: number
  yearlyPrice: number
  yearlyMonthlyPrice: number
  features: string[]
}

interface PricingData {
  basic: PlanInfo
  pro: PlanInfo
  enterprise: PlanInfo
}

export async function getPricingDataForEmail(): Promise<PricingData> {
  const plans = await db
    .select({
      planName: billingPlans.name,
      amount: billingPlans.amount,
      billingInterval: billingPlans.billingInterval,
      tier: billingProducts.tier,
      features: billingProducts.features,
    })
    .from(billingPlans)
    .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(
      and(
        eq(billingPlans.isActive, true),
        sql`${billingProducts.tier} IN ('basic', 'pro', 'enterprise')`
      )
    )

  const grouped = plans.reduce((acc, plan) => {
    const tier = plan.tier as 'basic' | 'pro' | 'enterprise'
    if (!acc[tier]) {
      acc[tier] = { monthly: null, yearly: null, features: plan.features }
    }
    if (plan.billingInterval === 'month') {
      acc[tier].monthly = plan.amount
    } else if (plan.billingInterval === 'year') {
      acc[tier].yearly = plan.amount
    }
    return acc
  }, {} as Record<string, any>)

  const formatPlan = (tier: string): PlanInfo => {
    const data = grouped[tier]
    return {
      name: tier.charAt(0).toUpperCase() + tier.slice(1),
      monthlyPrice: data?.monthly || 0,
      yearlyPrice: data?.yearly || 0,
      yearlyMonthlyPrice: data?.yearly ? Math.round(data.yearly / 12) : 0,
      features: data?.features || [],
    }
  }

  return {
    basic: formatPlan('basic'),
    pro: formatPlan('pro'),
    enterprise: formatPlan('enterprise'),
  }
}
```

### 8.2 템플릿 변수 매핑

```typescript
// 메일 발송 시 변수 치환
export async function getEmailTemplateVariables(): Promise<Record<string, string>> {
  const pricing = await getPricingDataForEmail()
  const formatPrice = (price: number) => `₩${new Intl.NumberFormat('ko-KR').format(price)}`

  return {
    // Basic 플랜
    basicMonthlyPrice: formatPrice(pricing.basic.monthlyPrice),
    basicYearlyMonthlyPrice: formatPrice(pricing.basic.yearlyMonthlyPrice),
    basicFeatures: pricing.basic.features.map(f => `• ${f}`).join('\n  '),
    basicFeaturesList: pricing.basic.features.map(f => `✓ ${f}`).join('\n│ '),
    basicFeaturesEn: pricing.basic.features.map(f => `• ${f}`).join('\n  '),
    basicFeaturesListEn: pricing.basic.features.map(f => `✓ ${f}`).join('\n│ '),

    // Pro 플랜
    proMonthlyPrice: formatPrice(pricing.pro.monthlyPrice),
    proYearlyMonthlyPrice: formatPrice(pricing.pro.yearlyMonthlyPrice),
    proFeatures: pricing.pro.features.map(f => `• ${f}`).join('\n  '),
    proFeaturesList: pricing.pro.features.map(f => `✓ ${f}`).join('\n│ '),
    proFeaturesEn: pricing.pro.features.map(f => `• ${f}`).join('\n  '),
    proFeaturesListEn: pricing.pro.features.map(f => `✓ ${f}`).join('\n│ '),
  }
}
```

### 8.3 메일 발송 시 적용

```typescript
// trial-email.service.ts (신규)

export async function sendTrialExpiringEmail(userId: string): Promise<boolean> {
  const user = await getUserById(userId)
  const stats = await getUserStats(userId)
  const pricing = await getEmailTemplateVariables()

  const template = TRIAL_EXPIRING_TEMPLATE.ko
  const content = template
    .replace(/{name}/g, user.name)
    .replace(/{sentCount}/g, stats.sentCount.toString())
    .replace(/{openRate}/g, stats.openRate.toFixed(1))
    .replace(/{replyCount}/g, stats.replyCount.toString())
    .replace(/{basicMonthlyPrice}/g, pricing.basicMonthlyPrice)
    .replace(/{basicFeatures}/g, pricing.basicFeatures)
    .replace(/{proMonthlyPrice}/g, pricing.proMonthlyPrice)
    .replace(/{proFeatures}/g, pricing.proFeatures)
    // ... 기타 변수

  return sendTransactionalEmail({
    to: user.email,
    subject: template.getSubject({ name: user.name }),
    body: JSON.stringify({ content }),
  })
}
```

### 8.4 가격 변경 시 자동 반영

DB의 `billing_plans.amount` 값이 변경되면:
1. **즉시 반영** - 메일 발송 시점에 DB 조회
2. **캐싱 권장** - Redis에 1시간 캐시 (가격 변경 빈도 낮음)
3. **수동 갱신 불필요** - 코드 수정 없이 가격 업데이트 가능

```typescript
// 캐싱 적용 예시
const PRICING_CACHE_KEY = 'email:pricing:data'
const PRICING_CACHE_TTL = 3600 // 1시간

export async function getCachedPricingData(): Promise<PricingData> {
  const cached = await redis.get(PRICING_CACHE_KEY)
  if (cached) return JSON.parse(cached)

  const pricing = await getPricingDataForEmail()
  await redis.setex(PRICING_CACHE_KEY, PRICING_CACHE_TTL, JSON.stringify(pricing))
  return pricing
}
```
