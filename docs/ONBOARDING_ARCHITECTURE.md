# 온보딩 시스템 아키텍처

> 2025년 12월 기준 최적화된 온보딩 로직

## 목차
- [개요](#개요)
- [전체 플로우](#전체-플로우)
- [데이터 모델](#데이터-모델)
- [API 엔드포인트](#api-엔드포인트)
- [프론트엔드 컴포넌트](#프론트엔드-컴포넌트)
- [검증 로직](#검증-로직)
- [엣지케이스 처리](#엣지케이스-처리)

---

## 개요

온보딩 시스템은 신규 사용자가 서비스를 처음 사용할 때 필요한 정보를 수집하고,
맞춤형 세일즈 전략을 제공하는 프로세스입니다.

### 핵심 원칙
1. **데이터 일관성**: `survey_data`와 `workspace_sales_strategies`는 항상 동시에 저장
2. **단계별 검증**: 각 스텝 완료 시 이전 스텝 및 필수 데이터 검증
3. **엣지케이스 처리**: 설문 데이터 없이 진입 시 자동 리다이렉트

---

## 전체 플로우

### PlantUML 다이어그램

```plantuml
@startuml onboarding-flow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam activityBorderColor #3B82F6
skinparam activityBackgroundColor #EFF6FF

title 온보딩 전체 플로우

|사용자|
start
:랜딩 페이지 접근;

|설문 단계|
:설문 Step 1 - 산업군 선택;
:설문 Step 2 - 타겟 고객 선택;
:설문 Step 3 - 희망 국가 선택;
:설문 Step 4 - 수출 경험 선택;

|Trial 결과|
:AI 분석 결과 표시;
:시작하기 버튼 클릭;

|회원가입|
:이메일 입력;
:계정 생성;
note right
  - workspace 생성
  - workspace_sales_strategies 생성
end note

|온보딩 Step 1-4|
:Step 1 - 회사 정보 확인;
note right
  검증: survey_data 필수
  검증: sales_strategy 자동 생성
end note

:Step 2 - 리드 검색;
note right
  검증: Step 1 완료 필수
end note

:Step 3 - 이메일 시퀀스 생성;
:Step 4 - 이메일 연동;

|완료|
:온보딩 완료;
note right
  검증: survey_data 필수
  검증: sales_strategy 존재 확인
end note

:대시보드 이동;
stop

@enduml
```

### 시퀀스 다이어그램

```plantuml
@startuml onboarding-sequence
!theme plain
skinparam backgroundColor #FFFFFF

title 온보딩 API 호출 시퀀스

actor User
participant "Frontend\n(React)" as FE
participant "Backend\n(Elysia)" as BE
database "PostgreSQL" as DB

== 설문 완료 후 회원가입 ==
User -> FE: 회원가입 클릭
FE -> BE: POST /auth/register-email\n{industry, target, country, experience}
BE -> DB: INSERT users
BE -> DB: INSERT workspaces
BE -> DB: INSERT onboarding_progress
BE -> DB: INSERT workspace_sales_strategies\n(findOrCreateAndLinkSalesStrategy)
BE --> FE: {token, user}

== 온보딩 Step 1 ==
User -> FE: /company?step=1 접근
FE -> BE: GET /onboarding/workspace/{id}
BE -> DB: SELECT onboarding_progress
alt surveyData 없음
  FE -> FE: /onboarding으로 리다이렉트
else surveyData 있음
  FE -> BE: GET /workspace-sales-strategies/{id}
  alt 데이터 없음
    FE -> FE: 입력 폼 표시 (수정 모드)
  else 데이터 있음
    FE -> FE: 정보 표시 (읽기 모드)
  end
end

User -> FE: 다음 단계 클릭
FE -> BE: POST /onboarding/workspace/{id}/step1/complete
BE -> DB: 검증: surveyData 존재?
BE -> DB: 검증: sales_strategy 존재?
alt 없으면 자동 생성
  BE -> DB: INSERT workspace_sales_strategies
end
BE -> DB: UPDATE onboarding_progress\n{status, currentStep}
BE --> FE: {progress}

== 온보딩 완료 ==
User -> FE: 완료 버튼 클릭
FE -> BE: POST /onboarding/workspace/{id}/complete
BE -> DB: 검증: surveyData 필수
BE -> DB: 검증/생성: sales_strategy
BE -> DB: UPDATE onboarding_progress\n{status: completed, completedAt}
BE --> FE: {progress}
FE -> FE: 대시보드로 이동

@enduml
```

---

## 데이터 모델

### ERD

```plantuml
@startuml onboarding-erd
!theme plain
skinparam backgroundColor #FFFFFF

entity "workspaces" as workspace {
  * id : uuid <<PK>>
  --
  name : varchar
  owner_id : uuid <<FK>>
  company_website : varchar
  created_at : timestamp
  updated_at : timestamp
}

entity "onboarding_progress" as onboarding {
  * id : uuid <<PK>>
  --
  * workspace_id : uuid <<FK>> <<UNIQUE>>
  * status : onboarding_status_enum
  * current_step : integer
  survey_data : jsonb
  company_info_completed_at : timestamp
  selected_lead_ids : jsonb
  customer_group_id : uuid
  lead_search_completed_at : timestamp
  generated_sequence_id : uuid
  email_generation_completed_at : timestamp
  email_link_completed_at : timestamp
  completed_at : timestamp
  created_at : timestamp
  updated_at : timestamp
}

entity "sales_strategies" as strategy {
  * id : uuid <<PK>>
  --
  * industry : industry_enum
  * target : target_enum
  * country : country_enum
  * experience : experience_enum
  rinda_solution : jsonb
  strategies : jsonb
  created_at : timestamp
}

entity "workspace_sales_strategies" as ws_strategy {
  * id : uuid <<PK>>
  --
  * workspace_id : uuid <<FK>>
  * sales_strategy_id : uuid <<FK>>
  created_at : timestamp
}

workspace ||--|| onboarding : "1:1"
workspace ||--o{ ws_strategy : "1:N"
strategy ||--o{ ws_strategy : "1:N"

@enduml
```

### 온보딩 상태 (Status Enum)

| Status | 설명 | currentStep |
|--------|------|-------------|
| `not_started` | 시작 안함 | 0 |
| `survey_completed` | 설문 완료 | 1 |
| `company_info` | 회사 정보 입력 완료 | 2 |
| `lead_search` | 리드 검색 완료 | 3 |
| `email_generation` | 이메일 생성 완료 | 4 |
| `email_link` | 이메일 연동 완료 | 5 |
| `completed` | 온보딩 완료 | - |

### survey_data 구조

```typescript
interface OnboardingSurveyData {
  industry: "manufacturing" | "it_saas" | "beauty" | "food" |
            "fashion" | "electronics" | "healthcare" | "guitar"
  target: "b2b" | "b2c" | "both"
  country: "jp" | "us" | "sea" | "eu" | "cn" | "ae"
  experience: "none" | "some" | "experienced"
  lang?: "ko" | "en"
}
```

---

## API 엔드포인트

### 온보딩 API (`/api/v1/onboarding`)

| Method | Endpoint | 설명 | 검증 |
|--------|----------|------|------|
| GET | `/workspace/:workspaceId` | 온보딩 진행 상태 조회 | - |
| POST | `/workspace/:workspaceId/survey` | 설문 데이터 저장 | 필수 필드 검증 |
| POST | `/workspace/:workspaceId/step1/complete` | Step 1 완료 | surveyData, salesStrategy |
| POST | `/workspace/:workspaceId/step2/complete` | Step 2 완료 | Step 1 완료 |
| POST | `/workspace/:workspaceId/step3/complete` | Step 3 완료 | Step 1 완료 |
| POST | `/workspace/:workspaceId/step4/complete` | Step 4 완료 | - |
| POST | `/workspace/:workspaceId/complete` | 온보딩 완료 | surveyData 필수 |
| POST | `/workspace/:workspaceId/reset` | 온보딩 리셋 (개발용) | - |

### Sales Strategy API (`/api/v1/workspace-sales-strategies`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/:workspaceId` | 워크스페이스의 세일즈 전략 조회 |
| PUT | `/:workspaceId` | 세일즈 전략 업데이트 (없으면 생성) |
| POST | `/:workspaceId/find-and-link` | 세일즈 전략 찾아서 연결 |

---

## 프론트엔드 컴포넌트

### 컴포넌트 구조

```plantuml
@startuml component-structure
!theme plain
skinparam backgroundColor #FFFFFF
skinparam componentStyle rectangle

package "Pages" {
  [OnboardingPage] as OP
  note right of OP
    /trial/survey/1-4
    설문 4단계
  end note

  [TrialResultPage] as TRP
  note right of TRP
    /trial
    AI 분석 결과
  end note

  [CompanyInformation] as CI
  note right of CI
    /company?step=1-4
    온보딩 Step 1-4
  end note

  [UnifiedDashboardPage] as UDP
  note right of UDP
    /
    대시보드
  end note
}

package "Components" {
  [OnboardingStepper] as OS
  [StepCompanyInfo] as SC1
  [StepEmailGeneration] as SC2
  [StepEmailLink] as SC3
  [StepConfirmation] as SC4
}

package "Hooks (TanStack Query)" {
  [useOnboardingProgress] as HOP
  [useSaveSurvey] as HSS
  [useCompleteStep1] as HCS1
  [useCompleteStep2] as HCS2
  [useCompleteStep3] as HCS3
  [useCompleteStep4] as HCS4
  [useCompleteOnboarding] as HCO
}

OP --> TRP : "설문 완료"
TRP --> CI : "시작하기"
CI --> UDP : "온보딩 완료"

CI --> OS
CI --> SC1
CI --> SC2
CI --> SC3
CI --> SC4

SC1 --> HOP
SC1 --> HSS
SC1 --> HCS1

@enduml
```

### 라우팅 플로우

```
/trial/survey/1 → /trial/survey/2 → /trial/survey/3 → /trial/survey/4
                                                            ↓
                                                        /trial
                                                            ↓
                                                   회원가입 (모달)
                                                            ↓
/company?step=1 → /company?step=2 → /company?step=3 → /company?step=4
                                                            ↓
                                                    / (대시보드)
```

---

## 검증 로직

### 백엔드 검증 (onboarding.service.ts)

```typescript
// saveSurveyData - 필수 필드 검증
if (!surveyData.industry || !surveyData.target ||
    !surveyData.country || !surveyData.experience) {
  throw new OnboardingValidationError(
    "설문 데이터가 불완전합니다",
    "INCOMPLETE_SURVEY_DATA"
  )
}

// completeStep1CompanyInfo - surveyData + salesStrategy 검증
if (!progress.surveyData) {
  throw new OnboardingValidationError(
    "설문 데이터가 없습니다",
    "MISSING_SURVEY_DATA"
  )
}
// salesStrategy 없으면 자동 생성

// completeStep2LeadSearch - Step 1 완료 검증
if (!progress.companyInfoCompleted) {
  throw new OnboardingValidationError(
    "Step 1을 먼저 완료해주세요",
    "STEP1_NOT_COMPLETED"
  )
}

// completeOnboarding - surveyData 필수 + salesStrategy 자동 생성
if (!progress.surveyData) {
  throw new OnboardingValidationError(
    "온보딩을 완료할 수 없습니다. 설문 데이터가 없습니다.",
    "MISSING_SURVEY_DATA"
  )
}
```

### 프론트엔드 검증

```typescript
// CompanyInformation.tsx - surveyData 없으면 리다이렉트
useEffect(() => {
  if (workspaceId && !hasSurveyData) {
    navigate("/onboarding", { replace: true })
  }
}, [workspaceId, hasSurveyData])

// StepCompanyInfo.tsx - 데이터 없으면 수정 모드
useEffect(() => {
  // fetch 실패 시 자동 수정 모드
  if (error) setIsEditing(true)
}, [])

// handleSave - 필수 필드 검증
if (!editedData.industry || !editedData.target ||
    !editedData.country || !editedData.experience) {
  toast.error("모든 필드를 입력해주세요")
  return
}
```

---

## 엣지케이스 처리

### 1. 기존 유저가 설문 없이 온보딩 진입

**문제**: `onboarding_progress.survey_data`가 NULL인 상태로 `/company` 접근

**해결**:
1. `CompanyInformation.tsx`에서 `hasSurveyData` 체크
2. 없으면 `/onboarding`으로 리다이렉트
3. `StepCompanyInfo.tsx`에서 백업으로 수정 모드 자동 활성화

### 2. survey_data는 있지만 workspace_sales_strategies 없음

**문제**: 데이터 동기화 실패로 sales_strategy만 없는 경우

**해결**:
1. `completeStep1CompanyInfo()`에서 자동 생성
2. `completeOnboarding()`에서 자동 생성
3. `saveSurveyData()`에서 동시 저장

### 3. 온보딩 중간 이탈 후 재진입

**문제**: 일부 스텝만 완료된 상태에서 재진입

**해결**:
1. `onboarding_progress.currentStep` 기반으로 마지막 스텝 복원
2. 각 스텝 완료 함수에서 이전 스텝 검증

### 4. 설문 데이터 수정

**문제**: 사용자가 설문 데이터를 수정하고 싶은 경우

**해결**:
1. `StepCompanyInfo.tsx`에서 "수정" 버튼 제공
2. `handleSave()`에서 `onboarding/survey` + `workspace-sales-strategies` 동시 업데이트

---

## 파일 구조

```
admin/src/
├── pages/
│   ├── onboarding/
│   │   ├── index.tsx           # 설문 페이지 (Step 1-4)
│   │   └── types.ts            # 온보딩 타입 정의
│   ├── app/
│   │   ├── CompanyInformation.tsx  # 온보딩 Step 1-4 메인
│   │   └── components/
│   │       ├── OnboardingStepper.tsx
│   │       ├── StepCompanyInfo.tsx
│   │       ├── StepEmailGeneration.tsx
│   │       ├── StepEmailLink.tsx
│   │       └── StepConfirmation.tsx
│   ├── TrialResultPage.tsx     # AI 분석 결과
│   └── UnifiedDashboardPage.tsx # 대시보드
└── lib/api/
    ├── hooks/
    │   └── onboarding.ts       # TanStack Query hooks
    └── services/
        └── onboarding.ts       # API 서비스

elysia-server/src/
├── db/schema/
│   └── onboarding.ts           # DB 스키마
├── services/
│   ├── onboarding.service.ts   # 온보딩 비즈니스 로직
│   └── sales-strategy.service.ts
└── routes/
    ├── onboarding.routes.ts    # 온보딩 API 라우트
    └── sales-strategies.routes.ts
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-15 | 초기 문서 작성 |
| 2025-12-15 | 데이터 동기화 로직 추가 (survey_data + sales_strategy) |
| 2025-12-15 | 검증 로직 강화 (각 스텝별 검증) |
| 2025-12-15 | 엣지케이스 처리 로직 추가 |
