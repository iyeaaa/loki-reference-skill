# Mixpanel Event Taxonomy

> 린다 서비스의 Mixpanel 이벤트 택소노미 정의서
>
> - **랜딩페이지**: rinda.ai (ai-show-agent 레포)
> - **앱**: app.rinda.ai (send-grid-test 레포)

## 목차

- [설정 개요](#설정-개요)
- [Super Properties](#super-properties)
- [User Properties](#user-properties)
- [이벤트 목록](#이벤트-목록)
- [대시보드 구현 가이드](#대시보드-구현-가이드)
  - [1. 랜딩 대시보드](#1-랜딩-대시보드)
  - [2. 앱 대시보드](#2-앱-대시보드)
  - [3. 전환 대시보드](#3-전환-대시보드)
  - [4. 리텐션/드롭오프 대시보드](#4-리텐션드롭오프-대시보드)
- [코드 구현 가이드](#코드-구현-가이드)

---

## 설정 개요

두 플랫폼 간 크로스 서브도메인 추적을 위한 Mixpanel 설정:

```typescript
mixpanel.init(TOKEN, {
  persistence: "cookie",           // 필수: 쿠키 기반 persistence
  cross_subdomain_cookie: true,    // 필수: 서브도메인 간 쿠키 공유
  track_pageview: false,           // 자동 페이지뷰 비활성화 (수동 이벤트만 사용)
});
```

> ⚠️ **중요**: `track_pageview`와 `autocapture.pageview`를 비활성화해야 합니다.
> 자동 페이지뷰 이벤트에는 `mixpanel.register()`로 설정한 Super Property가 포함되지 않을 수 있어서,
> 수동 이벤트만 사용하여 `platform` 속성의 일관성을 확보합니다.

---

## Super Properties

> 모든 이벤트에 자동으로 첨부되는 속성 (`mixpanel.register()`)

### 플랫폼 구분 (필수)

| Property | 랜딩 (rinda.ai) | 앱 (app.rinda.ai) |
|----------|-----------------|-------------------|
| `platform` | `"landing"` | `"app"` |
| `app_domain` | `"rinda.ai"` | `"app.rinda.ai"` |

### Attribution (랜딩에서 설정, 앱까지 유지)

| Property | Type | Description |
|----------|------|-------------|
| `first_utm_source` | string | 첫 방문 UTM source |
| `first_utm_medium` | string | 첫 방문 UTM medium |
| `first_utm_campaign` | string | 첫 방문 UTM campaign |
| `first_utm_term` | string | 첫 방문 UTM term |
| `first_utm_content` | string | 첫 방문 UTM content |
| `first_traffic_source` | string | 첫 방문 트래픽 소스 |
| `first_traffic_medium` | string | 첫 방문 트래픽 매체 |
| `first_referrer` | string | 첫 방문 referrer URL |
| `first_landing_page` | string | 첫 방문 랜딩 페이지 경로 |

---

## User Properties

> 사용자 프로필에 저장되는 속성 (`mixpanel.people.set()`)

### 기본 정보

| Property | Type | Description | 설정 시점 |
|----------|------|-------------|-----------|
| `$email` | string | 사용자 이메일 | 회원가입/로그인 |
| `$name` | string | 사용자 이름 | 회원가입/로그인 |
| `$created` | datetime | 계정 생성일 | 회원가입 |
| `signup_method` | string | 가입 방법 (google, email) | 회원가입 |

### 회사/온보딩 정보

| Property | Type | Description | 설정 시점 |
|----------|------|-------------|-----------|
| `company_name` | string | 회사명 | 온보딩 Step 1 |
| `industry` | string | 산업군 | 온보딩 Step 1 |
| `target_market` | string | 타겟 시장 | 온보딩 Step 1 |
| `country` | string | 국가 | 온보딩 Step 1 |
| `email_provider` | string | 연동된 이메일 제공자 | 온보딩 Step 2 |
| `onboarding_completed` | boolean | 온보딩 완료 여부 | 온보딩 완료 시 |
| `onboarding_completed_at` | datetime | 온보딩 완료일 | 온보딩 완료 시 |

### 요금제 정보 🆕

| Property | Type | Description | 설정 시점 |
|----------|------|-------------|-----------|
| `current_plan` | string | 현재 요금제 (free, starter, pro, enterprise) | 가입/요금제 변경 |
| `plan_start_date` | datetime | 현재 요금제 시작일 | 요금제 변경 |
| `plan_changed_at` | datetime | 마지막 요금제 변경일 | 요금제 변경 |
| `total_campaigns_executed` | number | 총 실행한 캠페인 수 | 캠페인 실행 |
| `first_campaign_at` | datetime | 첫 캠페인 실행일 | 첫 캠페인 실행 |

---

## 이벤트 목록

### 랜딩페이지 이벤트 (rinda.ai)

#### Traffic Source Landing

첫 방문 시 트래픽 소스 추적

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `source` | string | ✅ | 트래픽 소스 (google, facebook, direct 등) |
| `medium` | string | ✅ | 트래픽 매체 (organic, social, referral, none) |
| `referrer` | string | ❌ | Referrer URL |
| `landing_page` | string | ✅ | 랜딩 페이지 경로 |
| `landing_url` | string | ✅ | 랜딩 페이지 전체 URL |

#### Page View

페이지 조회

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | string | ✅ | 페이지 경로 |
| `title` | string | ❌ | 페이지 제목 |
| `url` | string | ✅ | 전체 URL |

#### UTM Landing

UTM 파라미터가 있는 방문

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `utm_source` | string | ✅ | UTM source |
| `utm_medium` | string | ❌ | UTM medium |
| `utm_campaign` | string | ❌ | UTM campaign |
| `utm_term` | string | ❌ | UTM term |
| `utm_content` | string | ❌ | UTM content |
| `landing_page` | string | ✅ | 랜딩 페이지 경로 |

#### CTA Clicked 🆕

CTA 버튼 클릭 (autocapture 보완)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cta_type` | string | ✅ | CTA 유형 (`start_free_trial`, `view_pricing`, `book_demo`, `signup`) |
| `cta_location` | string | ✅ | CTA 위치 (`hero`, `header`, `pricing_section`, `footer`) |
| `cta_text` | string | ❌ | 버튼 텍스트 |
| `page` | string | ✅ | 현재 페이지 경로 |

#### Autocapture Events

Mixpanel autocapture로 자동 수집:
- `$mp_web_page_view` - 페이지뷰
- `$click` - 클릭 이벤트 (element, text 등 자동 수집)
- `$input` - 입력 이벤트
- `$scroll` - 스크롤 이벤트

---

### 앱 이벤트 (app.rinda.ai)

#### App Session Start 🆕

앱 세션 시작 (DAU 측정용)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `entry_page` | string | ✅ | 진입 페이지 경로 |
| `referrer` | string | ❌ | Referrer URL |
| `is_returning_user` | boolean | ❌ | 재방문 여부 |

#### Page View

페이지 조회

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | string | ✅ | 페이지 경로 |
| `title` | string | ❌ | 페이지 제목 |
| `url` | string | ✅ | 전체 URL |

#### Trial Page Visit

Trial 페이지 진입

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `source` | string | ✅ | 유입 소스 |
| `referrer` | string | ❌ | Referrer URL |
| `utm_source` | string | ❌ | UTM source |
| `utm_medium` | string | ❌ | UTM medium |
| `utm_campaign` | string | ❌ | UTM campaign |

#### Signup Completed

회원가입 완료

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `method` | string | ✅ | 가입 방법 (`google`, `email`) |

#### Login Completed

로그인 완료

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `method` | string | ✅ | 로그인 방법 |

#### Survey Step Completed

서베이 스텝 완료

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `step` | number | ✅ | 현재 스텝 번호 |
| `total_steps` | number | ✅ | 전체 스텝 수 |
| `is_final_step` | boolean | ✅ | 마지막 스텝 여부 |

#### Survey Completed 🆕

서베이 전체 완료

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `total_steps` | number | ✅ | 전체 스텝 수 |
| `completion_time_seconds` | number | ❌ | 완료까지 걸린 시간(초) |

#### Onboarding Step N Completed

온보딩 각 단계 완료 (N = 1, 2, 3, 4)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `step` | number | ✅ | 스텝 번호 |
| `stepName` | string | ✅ | 스텝 이름 |
| `total_steps` | number | ✅ | 전체 스텝 수 (4) |

**Step별 추가 속성:**

| Step | stepName | 추가 속성 |
|------|----------|----------|
| 1 | `"Company Info"` | `companyName`, `industry`, `target`, `country` |
| 2 | `"Email Link"` | `emailProvider`, `hasEmailConnected` |
| 3 | `"Buyer Loading"` | `leadsFound`, `emailsGenerated` |
| 4 | `"Campaign Execution"` | `leadsCount`, `emailsScheduled` |

#### Onboarding Completed

온보딩 전체 완료

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `completion_time_minutes` | number | ❌ | 완료까지 걸린 시간(분) |
| `country` | string | ❌ | 국가 (전환율 분석용) |

#### Campaign Executed

캠페인 실행

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `leadsCount` | number | ❌ | 리드 수 |
| `sequenceId` | string | ❌ | 시퀀스 ID |
| `is_first_campaign` | boolean | ✅ | 첫 캠페인 여부 🆕 |
| `campaign_number` | number | ✅ | N번째 캠페인 🆕 |

#### Plan Changed 🆕

요금제 변경

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `previous_plan` | string | ✅ | 이전 요금제 |
| `new_plan` | string | ✅ | 새 요금제 |
| `change_type` | string | ✅ | 변경 유형 (`upgrade`, `downgrade`, `cancel`) |
| `previous_plan_duration_days` | number | ❌ | 이전 요금제 사용 기간(일) |

#### Feature Used

기능 사용

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `feature` | string | ✅ | 기능 이름 |

---

## 대시보드 구현 가이드

### 1. 랜딩 대시보드

#### 1-1. 오늘 랜딩 방문 유저 수 (Insights - Number)

```
Report Type: Insights
Display: Number
Event: Traffic Source Landing
Filter: platform = "landing"
Date Range: Today
Count: Unique Users
```

**Mixpanel 설정:**
1. Insights → Create Report
2. Event: `Traffic Source Landing`
3. Measured as: `Unique Users`
4. Filter: `platform` = `landing`
5. Date: `Today`
6. Display: `Number`

---

#### 1-2. 4주간 일별 방문자 차트 (Insights - Line)

```
Report Type: Insights
Display: Line Chart
Event: Traffic Source Landing
Filter: platform = "landing"
Date Range: Last 28 days
Breakdown: Day
Count: Unique Users
```

**Mixpanel 설정:**
1. Insights → Create Report
2. Event: `Traffic Source Landing`
3. Measured as: `Unique Users`
4. Date: `Last 28 days`
5. Group by: `$time` (Day)
6. Display: `Line Chart`

---

#### 1-3. UTM Source별 유입 수 (Insights - Table)

```
Report Type: Insights
Display: Table
Event: UTM Landing
Filter: platform = "landing"
Date Range: Last 28 days
Breakdown: utm_source
Count: Total Events, Unique Users
```

**Mixpanel 설정:**
1. Insights → Create Report
2. Event: `UTM Landing`
3. Measured as: `Total Events` 및 `Unique Users`
4. Date: `Last 28 days`
5. Group by: `utm_source`
6. Display: `Table`

---

#### 1-4. CTA 클릭 → 앱 진입 퍼널 (Funnels)

```
Report Type: Funnels
Steps:
  1. Traffic Source Landing (platform = "landing")
  2. CTA Clicked (cta_type = "start_free_trial")
  3. Trial Page Visit (platform = "app")
Date Range: Last 28 days
```

**Mixpanel 설정:**
1. Funnels → Create Funnel
2. Step 1: `Traffic Source Landing` where `platform` = `landing`
3. Step 2: `CTA Clicked` where `cta_type` = `start_free_trial`
4. Step 3: `Trial Page Visit` where `platform` = `app`
5. Date: `Last 28 days`
6. Conversion Window: `7 days`

---

#### 1-5. 페이지별 조회 순위 (Insights - Bar)

```
Report Type: Insights
Display: Bar Chart
Event: Page View
Filter: platform = "landing"
Date Range: Last 28 days
Breakdown: path
Sort: Descending by Total Events
Limit: Top 10
```

**Mixpanel 설정:**
1. Insights → Create Report
2. Event: `Page View`
3. Filter: `platform` = `landing`
4. Measured as: `Total Events`
5. Group by: `path`
6. Display: `Bar Chart`
7. Sort: Descending, Limit: 10

---

#### 1-6. 가장 많이 클릭한 버튼 (Insights - Bar)

```
Report Type: Insights
Display: Bar Chart
Event: CTA Clicked (또는 autocapture $click)
Filter: platform = "landing"
Date Range: Last 28 days
Breakdown: cta_type (또는 $el_text)
Sort: Descending by Total Events
```

**Mixpanel 설정:**
1. Insights → Create Report
2. Event: `CTA Clicked` 또는 `$click`
3. Filter: `platform` = `landing`
4. Group by: `cta_type` 또는 `$el_text`
5. Display: `Bar Chart`

---

### 2. 앱 대시보드

#### 2-1. 오늘 회원가입 유저 수 (Insights - Number)

```
Report Type: Insights
Display: Number
Event: Signup Completed
Date Range: Today
Count: Unique Users
```

**Mixpanel 설정:**
1. Insights → Create Report
2. Event: `Signup Completed`
3. Measured as: `Unique Users`
4. Date: `Today`
5. Display: `Number`

---

#### 2-2. 4주간 앱 방문자 일별 차트 (Insights - Line)

```
Report Type: Insights
Display: Line Chart
Event: App Session Start
Filter: platform = "app"
Date Range: Last 28 days
Breakdown: Day
Count: Unique Users (DAU)
```

**Mixpanel 설정:**
1. Insights → Create Report
2. Event: `App Session Start`
3. Measured as: `Unique Users`
4. Date: `Last 28 days`
5. Group by: `$time` (Day)
6. Display: `Line Chart`

---

#### 2-3. 설문/온보딩/캠페인 완료 누적 차트 (Insights - Stacked Bar)

```
Report Type: Insights
Display: Stacked Bar Chart
Events (Multiple):
  - Survey Completed
  - Onboarding Step 1 Completed
  - Onboarding Step 2 Completed
  - Onboarding Step 3 Completed
  - Campaign Executed (where is_first_campaign = true)
Date Range: Last 28 days
Breakdown: Day
Count: Unique Users
```

**Mixpanel 설정:**
1. Insights → Create Report
2. Add Multiple Events:
   - `Survey Completed`
   - `Onboarding Step 1 Completed`
   - `Onboarding Step 2 Completed`
   - `Onboarding Step 3 Completed`
   - `Campaign Executed` where `is_first_campaign` = `true`
3. Measured as: `Unique Users`
4. Date: `Last 28 days`
5. Group by: `$time` (Day)
6. Display: `Stacked Bar Chart`

---

### 3. 전환 대시보드

#### 3-1. 요금제별 유저 수 변화 (Insights - Stacked Area)

```
Report Type: Insights
Display: Stacked Area Chart
Analysis: User Profiles
Breakdown: current_plan
Date Range: Last 28 days
Count: Unique Users
```

**Mixpanel 설정 (방법 1 - User Profiles):**
1. Users → Explore
2. Filter by: `current_plan` is set
3. Group by: `current_plan`
4. View over time

**Mixpanel 설정 (방법 2 - Plan Changed 이벤트):**
1. Insights → Create Report
2. Event: `Plan Changed`
3. Measured as: `Unique Users`
4. Group by: `new_plan`
5. Date: `Last 28 days`
6. Display: `Stacked Area Chart`

---

#### 3-2. 랜딩 → 첫 캠페인 전체 퍼널 (Funnels)

```
Report Type: Funnels
Steps:
  1. Traffic Source Landing (platform = "landing")
  2. CTA Clicked (cta_type = "start_free_trial")
  3. Trial Page Visit (platform = "app")
  4. Signup Completed
  5. Onboarding Step 1 Completed
  6. Onboarding Step 2 Completed
  7. Onboarding Step 3 Completed
  8. Campaign Executed (is_first_campaign = true)
Date Range: Last 28 days
Conversion Window: 14 days
```

**Mixpanel 설정:**
1. Funnels → Create Funnel
2. Add Steps:
   - `Traffic Source Landing` where `platform` = `landing`
   - `CTA Clicked` where `cta_type` = `start_free_trial`
   - `Trial Page Visit` where `platform` = `app`
   - `Signup Completed`
   - `Onboarding Step 1 Completed`
   - `Onboarding Step 2 Completed`
   - `Onboarding Step 3 Completed`
   - `Campaign Executed` where `is_first_campaign` = `true`
3. Date: `Last 28 days`
4. Conversion Window: `14 days`

---

### 4. 리텐션/드롭오프 대시보드

#### 4-1. 주간 리텐션 (Retention)

```
Report Type: Retention
First Event: Signup Completed
Return Event: App Session Start
Retention Type: N-Day (7, 14, 28)
Date Range: Last 8 weeks
```

**Mixpanel 설정:**
1. Retention → Create Report
2. First Event: `Signup Completed`
3. Return Event: `App Session Start`
4. Retention Type: `N-Day Retention`
5. Show: Day 7, Day 14, Day 28
6. Date: `Last 8 weeks`

**결과 해석:**
- Day 7: 가입 후 1주일 뒤 재방문율
- Day 14: 가입 후 2주일 뒤 재방문율
- Day 28: 가입 후 4주일 뒤 재방문율

---

#### 4-2. 국가별 전환율 (Funnels + Breakdown)

```
Report Type: Funnels
Steps:
  1. Signup Completed
  2. Onboarding Completed
  3. Campaign Executed (is_first_campaign = true)
Breakdown: country (from Onboarding Step 1)
Date Range: Last 28 days
```

**Mixpanel 설정:**
1. Funnels → Create Funnel
2. Steps:
   - `Signup Completed`
   - `Onboarding Completed`
   - `Campaign Executed` where `is_first_campaign` = `true`
3. Date: `Last 28 days`
4. **Breakdown by**: `country` (User Property)
5. View: Compare conversion rates by country

**결과 해석:**
- 어떤 국가의 사용자가 온보딩 완료율이 높은지
- 어떤 국가의 사용자가 첫 캠페인 실행까지 가는지

---

#### 4-3. 온보딩 단계별 이탈율 (Funnels)

```
Report Type: Funnels
Steps:
  1. Signup Completed
  2. Onboarding Step 1 Completed
  3. Onboarding Step 2 Completed
  4. Onboarding Step 3 Completed
  5. Onboarding Step 4 Completed / Campaign Executed
Date Range: Last 28 days
View: Drop-off rates between steps
```

**Mixpanel 설정:**
1. Funnels → Create Funnel
2. Steps:
   - `Signup Completed`
   - `Onboarding Step 1 Completed`
   - `Onboarding Step 2 Completed`
   - `Onboarding Step 3 Completed`
   - `Campaign Executed` where `is_first_campaign` = `true`
3. Date: `Last 28 days`
4. View: **Show Drop-off** (각 단계별 이탈율 표시)

**결과 해석:**
- Step 1 → Step 2 이탈율: 이메일 연동에서 이탈
- Step 2 → Step 3 이탈율: 바이어 찾기에서 이탈
- Step 3 → Campaign: 캠페인 실행에서 이탈

---

#### 4-4. 이탈이 많은 페이지/단계 식별 (Insights + Funnels)

**방법 1: 페이지별 이탈 (세션 기준)**
```
Report Type: Insights
Event: Page View (platform = "app")
Breakdown: path
Measured as: Bounce Rate (single page sessions)
```

**방법 2: 퍼널 단계별 이탈 상세**
```
Report Type: Funnels
Steps: Full onboarding funnel
View: Drop-off
Breakdown: industry (또는 country)
```

**Mixpanel 설정:**
1. 위 4-3 퍼널에서 **Breakdown by** 추가:
   - `industry`: 산업군별 이탈 패턴
   - `country`: 국가별 이탈 패턴
   - `email_provider`: 이메일 제공자별 이탈 패턴
2. 이탈율이 높은 세그먼트 식별

---

## 코드 구현 가이드

### 앱 (send-grid-test) - 추가/수정 필요

```typescript
// admin/src/lib/analytics/index.ts

// =====================================
// 🆕 앱 세션 시작 (DAU 측정용)
// =====================================
export function trackAppSessionStart() {
  trackEvent("App Session Start", {
    entry_page: window.location.pathname,
    referrer: document.referrer,
    is_returning_user: !!localStorage.getItem("has_visited"),
  })
  localStorage.setItem("has_visited", "true")
}

// =====================================
// 🆕 설문 완료 (명확화)
// =====================================
export function trackSurveyCompleted(data?: {
  totalSteps?: number
  completionTimeSeconds?: number
}) {
  trackEvent("Survey Completed", {
    total_steps: data?.totalSteps,
    completion_time_seconds: data?.completionTimeSeconds,
  })
}

// =====================================
// ✏️ Survey Step Completed 개선
// =====================================
export function trackSurveyStep(
  step: number,
  totalSteps: number,
  data?: Record<string, unknown>
) {
  trackEvent("Survey Step Completed", {
    step,
    total_steps: totalSteps,
    is_final_step: step === totalSteps,
    ...data,
  })
}

// =====================================
// ✏️ Onboarding Step 개선 (total_steps 추가)
// =====================================
export function trackOnboardingStep1Complete(data?: {
  companyName?: string
  industry?: string
  target?: string
  country?: string
}) {
  trackEvent("Onboarding Step 1 Completed", {
    step: 1,
    stepName: "Company Info",
    total_steps: 4,
    ...data,
  })
  
  // User Property에도 저장 (국가별 분석용)
  if (mixpanelInitialized && data) {
    mixpanel.people.set({
      company_name: data.companyName,
      industry: data.industry,
      target_market: data.target,
      country: data.country,
    })
  }
}

// =====================================
// ✏️ Campaign Executed 개선
// =====================================
let campaignCount = 0 // 또는 서버에서 가져오기

export function trackCampaignExecuted(data?: {
  leadsCount?: number
  sequenceId?: string
}) {
  campaignCount++
  const isFirst = campaignCount === 1
  
  trackEvent("Campaign Executed", {
    leadsCount: data?.leadsCount,
    sequenceId: data?.sequenceId,
    is_first_campaign: isFirst,
    campaign_number: campaignCount,
  })
  
  // User Property 업데이트
  if (mixpanelInitialized) {
    mixpanel.people.set({
      total_campaigns_executed: campaignCount,
    })
    if (isFirst) {
      mixpanel.people.set({
        first_campaign_at: new Date().toISOString(),
      })
    }
  }
}

// =====================================
// 🆕 요금제 변경
// =====================================
export function trackPlanChanged(data: {
  previousPlan: string
  newPlan: string
  changeType: "upgrade" | "downgrade" | "cancel"
  previousPlanDurationDays?: number
}) {
  trackEvent("Plan Changed", {
    previous_plan: data.previousPlan,
    new_plan: data.newPlan,
    change_type: data.changeType,
    previous_plan_duration_days: data.previousPlanDurationDays,
  })
  
  // User Property 업데이트
  if (mixpanelInitialized) {
    mixpanel.people.set({
      current_plan: data.newPlan,
      plan_changed_at: new Date().toISOString(),
    })
  }
}

// =====================================
// ✏️ identifyUser 개선 (plan 정보 추가)
// =====================================
export function identifyUser(
  userId: string,
  traits?: {
    email?: string
    name?: string
    plan?: string
    planStartDate?: string
  }
) {
  if (mixpanelInitialized) {
    mixpanel.identify(userId)
    if (traits) {
      mixpanel.people.set({
        $email: traits.email,
        $name: traits.name,
        current_plan: traits.plan,
        plan_start_date: traits.planStartDate,
      })
    }
  }
  // ... GA 코드
}
```

### 랜딩 (ai-show-agent) - 추가 필요

```typescript
// /apps/landing-page/src/utils/analytics/index.ts

// =====================================
// 🆕 CTA 클릭 추적
// =====================================
export const trackCTAClicked = (data: {
  ctaType: "start_free_trial" | "view_pricing" | "book_demo" | "signup" | "contact"
  ctaLocation: "hero" | "header" | "pricing_section" | "feature_section" | "footer" | "popup"
  ctaText?: string
}): void => {
  if (isMixpanelAvailable()) {
    trackEvent("CTA Clicked", {
      cta_type: data.ctaType,
      cta_location: data.ctaLocation,
      cta_text: data.ctaText,
      page: typeof window !== "undefined" ? window.location.pathname : "",
    })
  }
}
```

---

## 대시보드 체크리스트

### 구현 전 확인사항

- [ ] 앱에 `App Session Start` 이벤트 추가
- [ ] 앱에 `Survey Completed` 이벤트 추가
- [ ] 앱에 `Plan Changed` 이벤트 추가
- [ ] `Campaign Executed`에 `is_first_campaign` 속성 추가
- [ ] `Onboarding Step N`에 `total_steps` 속성 추가
- [ ] `identifyUser`에 plan 정보 추가
- [ ] 랜딩에 `CTA Clicked` 이벤트 추가

### Mixpanel 대시보드 생성

- [ ] 랜딩 대시보드 (6개 리포트)
- [ ] 앱 대시보드 (3개 리포트)
- [ ] 전환 대시보드 (2개 리포트)
- [ ] 리텐션/드롭오프 대시보드 (4개 리포트)

---

## 변경 이력

| 날짜 | 변경 내용 |
|-----|----------|
| 2025-01-09 | 초기 문서 작성 - 크로스 서브도메인 추적 설정, 이벤트 목록 정의 |
| 2025-01-09 | 대시보드 구현 가이드 추가 - 4개 대시보드별 상세 Mixpanel 설정 방법 |
| 2025-01-09 | 신규 이벤트 추가: App Session Start, Survey Completed, Plan Changed, CTA Clicked |
| 2025-01-09 | 기존 이벤트 개선: Campaign Executed, Survey Step, Onboarding Steps |
| 2025-01-09 | 리텐션/드롭오프 분석 추가: 주간 리텐션, 국가별 전환율, 단계별 이탈율 |
| 2025-01-12 | 자동 페이지뷰 비활성화: track_pageview, autocapture.pageview를 false로 설정 (Super Property 일관성) |
| 2025-01-12 | 내부 직원 필터링 로직 제거: 별도 방식(/donttrackme)으로 구현 예정 |
