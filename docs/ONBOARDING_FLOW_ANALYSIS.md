# 온보딩 플로우 종합 분석 리포트

> 분석일: 2025-12-22
> 분석 범위: Frontend, Backend, Database, Infrastructure

## 목차

- [1. 전체 플로우 구조](#1-전체-플로우-구조)
- [2. 아키텍처 분석](#2-아키텍처-분석)
- [3. 발견된 문제점](#3-발견된-문제점)
- [4. 플로우 품질 평가](#4-플로우-품질-평가)
- [5. 데이터베이스 스키마 관계도](#5-데이터베이스-스키마-관계도)
- [6. 권장 수정 사항](#6-권장-수정-사항)
- [7. 인프라 평가](#7-인프라-평가)
- [8. 종합 결론](#8-종합-결론)

---

## 1. 전체 플로우 구조

```
[미인증 사용자]
    │
    ├─ /trial/survey/1~4 ─── 설문조사 (Industry → Target → Country → Experience)
    │       │
    │       ▼
    ├─ /trial ────────────── Google OAuth 로그인
    │       │
    │       ▼
    └─ /trial/result ─────── AI 분석 결과 & 시장 추천
            │
            ▼
[인증된 사용자 - 4단계 온보딩]
    │
    ├─ Step 1: /company?step=1 ─── 회사 정보 입력
    │       │
    │       ├─ 워크스페이스 정보 저장
    │       ├─ 설문 데이터 DB 저장
    │       └─ Discovery Job 트리거 (BullMQ)
    │       │
    │       ▼
    ├─ Step 2: /company?step=2 ─── 리드 생성 & 이메일 작성
    │       │
    │       ├─ Phase 1: BigQuery 리드 탐색
    │       ├─ Phase 2: 고객 그룹 생성
    │       ├─ Phase 3: 이메일 템플릿 생성 (AI)
    │       ├─ Phase 4: 시퀀스 생성
    │       └─ Phase 5: 프리뷰 이메일 생성
    │       │  (SSE 실시간 진행률)
    │       ▼
    ├─ Step 3: /company?step=3 ─── 이메일 계정 연결 (Nylas)
    │       │
    │       ▼
    └─ Step 4: /company?step=4 ─── 확인 & 캠페인 실행
            │
            ▼
    /dashboard ─────────── 메인 대시보드
```

### 데이터 플로우

```
Step 1 → Step 2:
- StepCompanyInfo → 3개 API 저장
- Discovery Job 트리거 (BullMQ)
- jobId를 onboarding_progress에 저장

Step 2 → Step 3:
- SSE로 실시간 리드/이메일 업데이트
- onboarding_progress.selectedLeadIds 업데이트
- Sequence + Emails 생성

Step 3 → Step 4:
- Email Account를 Workspace에 연결
- 캠페인 발송 준비 완료

Step 4 → Dashboard:
- 캠페인 완료 마킹
- onboarding status = "completed"
- /dashboard로 리다이렉트
```

---

## 2. 아키텍처 분석

### 2.1 인프라 구성 (docker-compose.yml)

| 서비스 | 역할 | 리소스 |
|--------|------|--------|
| nginx | 리버스 프록시, SSL | - |
| admin | React 프론트엔드 | - |
| elysia-server | Bun + Elysia API 서버 | 2CPU, 4GB |
| bullmq-worker | 비동기 작업 처리 | 2CPU, 2GB |
| postgres | PostgreSQL 17.2 | 2CPU, 1GB |
| redis | BullMQ 큐 + SSE PubSub | 1CPU, 768MB |
| postgres-backup | 자동 백업 | 0.5CPU, 256MB |

### 2.2 기술 스택

```
Frontend: React + TypeScript + Vite + Jotai (상태관리) + React Query
Backend:  Bun + Elysia + Drizzle ORM
Queue:    BullMQ + Redis
DB:       PostgreSQL 17.2
외부 API: BigQuery, Hunter.io, Gemini, Nylas
```

### 2.3 주요 파일 위치

**Frontend:**
```
admin/src/
├── pages/
│   ├── onboarding/index.tsx           # 설문 페이지 (Step 1-4)
│   ├── NewTrialPage.tsx               # Trial 로그인
│   ├── TrialResultPage.tsx            # AI 분석 결과
│   └── app/
│       ├── CompanyInformation.tsx     # 온보딩 Step 1-4 메인
│       └── components/
│           ├── OnboardingStepper.tsx
│           ├── StepCompanyInfo.tsx
│           ├── StepLeadGeneration/
│           ├── StepEmailLink.tsx
│           └── StepConfirmation.tsx
├── lib/api/
│   ├── hooks/onboarding.ts            # TanStack Query hooks
│   └── services/onboarding.ts         # API 서비스
└── store/survey.ts                    # Jotai 상태 관리
```

**Backend:**
```
elysia-server/src/
├── routes/
│   ├── onboarding.routes.ts           # 온보딩 API (460 lines)
│   └── auth.routes.ts                 # 인증 API
├── services/
│   ├── onboarding.service.ts          # 비즈니스 로직 (1874 lines)
│   └── onboarding-worker.service.ts   # BullMQ Worker (1250 lines)
├── db/schema/
│   ├── onboarding.ts                  # 온보딩 스키마
│   ├── users.ts                       # 사용자 스키마
│   ├── workspaces.ts                  # 워크스페이스 스키마
│   └── billing.ts                     # 빌링 스키마
└── lib/queue/queues.ts                # BullMQ 큐 설정
```

---

## 3. 발견된 문제점

### 3.1 Critical Issues (즉시 수정 필요)

#### 🔴 C-01: JWT 인증 보안 취약점

| 항목 | 내용 |
|------|------|
| **위치** | `elysia-server/src/services/auth.service.ts` |
| **문제** | JWT가 암호화 서명 없이 Base64 인코딩만 사용 |
| **코드** | `Buffer.from(JSON.stringify(payload)).toString('base64')` |
| **위험** | 토큰 위조 가능, 서명 검증 없음 |
| **해결** | jsonwebtoken 라이브러리로 HS256/RS256 서명 적용 |

#### 🔴 C-02: 외래키 누락으로 데이터 무결성 문제

| 항목 | 내용 |
|------|------|
| **위치** | `onboarding_progress` 테이블 |
| **문제** | 3개 필드에 FK 제약조건 없음 |

| 필드 | 문제 | 위험 |
|------|------|------|
| `customerGroupId` | FK 없음 | 그룹 삭제 시 orphan 발생 |
| `generatedSequenceId` | FK 없음 | 시퀀스 삭제 시 orphan 발생 |
| `selectedLeadIds` | JSONB 배열 | 관계형 무결성 없음 |

**해결:**
```sql
ALTER TABLE onboarding_progress
  ADD CONSTRAINT fk_customer_group
    FOREIGN KEY (customer_group_id)
    REFERENCES customer_groups(id) ON DELETE SET NULL;

ALTER TABLE onboarding_progress
  ADD CONSTRAINT fk_generated_sequence
    FOREIGN KEY (generated_sequence_id)
    REFERENCES sequences(id) ON DELETE SET NULL;
```

#### 🔴 C-03: Trial 데이터 3중 복제

| 항목 | 내용 |
|------|------|
| **문제** | Trial 날짜가 3곳에 중복 저장 |
| **위치 1** | `users.trialStartDate/trialEndDate` |
| **위치 2** | `subscriptions.trialStart/trialEnd` |
| **위치 3** | `billingPlans.trialDays` |
| **위험** | 동기화 실패 시 데이터 불일치 |
| **해결** | `subscriptions` 테이블을 단일 진실 소스로 지정 |

#### 🔴 C-04: 트랜잭션 없는 다중 테이블 업데이트

| 항목 | 내용 |
|------|------|
| **위치** | `onboarding.service.ts` - `saveSurveyData()` |
| **문제** | Survey 저장 → Sales Strategy 연결이 트랜잭션 없이 순차 실행 |
| **위험** | Sales Strategy 연결 실패 시 불완전 상태 |
| **해결** | `db.transaction()` 래핑 |

---

### 3.2 High Priority Issues

#### 🟡 H-01: 온보딩 상태 동기화 문제

| 항목 | 내용 |
|------|------|
| **위치** | `onboarding_progress` 테이블 |
| **문제** | `status`와 `currentStep` 필드가 분리되어 불일치 가능 |
| **예시** | `status = 'lead_search'` 인데 `currentStep = 1` |
| **해결** | CHECK 제약조건 추가 |

```sql
ALTER TABLE onboarding_progress
  ADD CONSTRAINT check_status_step_match
  CHECK (
    (status = 'not_started' AND current_step = 0) OR
    (status = 'survey_completed' AND current_step >= 1) OR
    (status = 'company_info' AND current_step >= 1) OR
    (status = 'lead_search' AND current_step >= 2) OR
    (status = 'email_generation' AND current_step >= 3) OR
    (status = 'email_link' AND current_step >= 4) OR
    (status = 'completed' AND current_step = 5)
  );
```

#### 🟡 H-02: SSE 연결 재시도 로직 부재

| 항목 | 내용 |
|------|------|
| **위치** | `admin/src/pages/app/components/StepLeadGeneration/index.tsx` |
| **문제** | SSE 스트림 실패 시 자동 재연결 없음 |
| **해결** | Exponential backoff 재연결 구현 |

#### 🟡 H-03: 설문 데이터 이중 저장

| 항목 | 내용 |
|------|------|
| **위치 1** | `users.onboardingSurvey` (JSONB) |
| **위치 2** | `onboardingProgress.surveyData` (JSONB) |
| **문제** | 동일 데이터 중복 저장 |
| **해결** | `onboardingProgress`로 통합 |

#### 🟡 H-04: 하드코딩된 타임존

| 항목 | 내용 |
|------|------|
| **위치** | `onboarding.service.ts` |
| **코드** | `const KST_OFFSET_MS = 9 * 60 * 60 * 1000` |
| **문제** | 다른 타임존 배포 시 문제 발생 |
| **해결** | date-fns-tz 또는 moment-timezone 사용 |

#### 🟡 H-05: Email Account 생성 Race Condition

| 항목 | 내용 |
|------|------|
| **위치** | `nylas.routes.ts` |
| **문제** | TRIAL_PREVIEW 계정이 Nylas callback에 의해 삭제되는 race condition |
| **현재** | 존재 체크 + 생성 workaround 적용 |
| **해결** | DB 제약조건 또는 retry with exponential backoff |

#### 🟡 H-06: Audit Trail 부재

| 항목 | 내용 |
|------|------|
| **문제** | 온보딩 상태 변경 이력 테이블 없음 |
| **영향** | 디버깅 어려움, 고객 지원 시 재현 불가 |
| **해결** | `onboarding_progress_history` 테이블 생성 |

---

### 3.3 Medium Priority Issues

#### 🟢 M-01: Auto-save 경쟁 조건

| 항목 | 내용 |
|------|------|
| **위치** | `CompanyInformation.tsx` |
| **문제** | useEffect 의존성 배열이 복잡하여 다중 API 호출 가능 |
| **의존성** | `[workspacesLoading, onboardingLoading, hasSurveyDataInDb, jotaiSurveyData]` |
| **해결** | React Query의 built-in cache invalidation 사용 |

#### 🟢 M-02: Discovery Job 실패 시 진행 허용

| 항목 | 내용 |
|------|------|
| **위치** | `StepCompanyInfo.tsx:311-314` |
| **문제** | 실패해도 다음 단계로 진행 (리드 없이) |
| **영향** | UX 혼란 가능 |
| **해결** | 경고 토스트 표시 후 진행 허용 (현재 구현과 동일) |

#### 🟢 M-03: Error Boundary 부재

| 항목 | 내용 |
|------|------|
| **위치** | 온보딩 Step 컴포넌트 |
| **문제** | SSE 치명적 실패 시 fallback UI 없음 |
| **해결** | `CompanyInformation`에 Error Boundary 추가 |

#### 🟢 M-04: Rate Limiting 미적용

| 항목 | 내용 |
|------|------|
| **위치** | 온보딩 API 엔드포인트 |
| **문제** | 사용자가 discovery job을 빠르게 여러 번 트리거 가능 |
| **해결** | Rate limiting 미들웨어 추가 |

#### 🟢 M-05: Magic Numbers

| 항목 | 내용 |
|------|------|
| **위치** | `onboarding-worker.service.ts` |
| **문제** | `TARGET_LEADS = 20`, `MAX_SEARCH_ITERATIONS = 2` 등 하드코딩 |
| **해결** | 환경 변수로 이동 |

#### 🟢 M-06: 인덱스 누락

| 항목 | 내용 |
|------|------|
| **문제** | 분석 쿼리에 필요한 인덱스 부재 |

```sql
-- 필요한 인덱스
CREATE INDEX idx_onboarding_completed_at ON onboarding_progress(completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX idx_users_onboarding_completed ON users(onboarding_completed_at DESC)
  WHERE onboarding_completed_at IS NOT NULL;

CREATE INDEX idx_subscriptions_primary ON subscriptions(workspace_id)
  WHERE is_primary = true;
```

#### 🟢 M-07: Checkpoint 데이터 DB 미저장

| 항목 | 내용 |
|------|------|
| **위치** | BullMQ Worker |
| **문제** | Checkpoint가 Redis job.data에만 저장 (재시작 시 손실 가능) |
| **해결** | PostgreSQL onboarding_progress에 스냅샷 저장 |

#### 🟢 M-08: 불완전한 폼 검증 피드백

| 항목 | 내용 |
|------|------|
| **위치** | `StepCompanyInfo.tsx:407-412` |
| **문제** | companyName/Description만 하이라이트, select 필드는 미표시 |
| **해결** | 모든 검증 에러 동시 표시 |

#### 🟢 M-09: Privacy Policy URL 하드코딩

| 항목 | 내용 |
|------|------|
| **위치** | `TrialResultPage.tsx:268` |
| **문제** | `https://rinda.ai/privacy-policy` 하드코딩 |
| **해결** | 환경 변수로 이동 |

#### 🟢 M-10: 네트워크 연결 체크 없음

| 항목 | 내용 |
|------|------|
| **위치** | `StepLeadGeneration.tsx:157` |
| **문제** | SSE 시작 전 네트워크 연결 확인 없음 |
| **해결** | navigator.onLine 체크 추가 |

---

### 3.4 문제점 요약 테이블

| 우선순위 | ID | 문제 | 영역 | 위험도 |
|----------|-----|------|------|--------|
| Critical | C-01 | JWT 보안 취약점 | Backend | 🔴 높음 |
| Critical | C-02 | FK 제약조건 누락 | Database | 🔴 높음 |
| Critical | C-03 | Trial 데이터 3중 복제 | Database | 🔴 높음 |
| Critical | C-04 | 트랜잭션 미적용 | Backend | 🔴 높음 |
| High | H-01 | 상태/스텝 불일치 가능 | Database | 🟡 중간 |
| High | H-02 | SSE 재연결 없음 | Frontend | 🟡 중간 |
| High | H-03 | 설문 데이터 중복 | Database | 🟡 중간 |
| High | H-04 | 타임존 하드코딩 | Backend | 🟡 중간 |
| High | H-05 | Race Condition | Backend | 🟡 중간 |
| High | H-06 | Audit Trail 없음 | Database | 🟡 중간 |
| Medium | M-01 | Auto-save 경쟁 | Frontend | 🟢 낮음 |
| Medium | M-02 | Job 실패 허용 | Frontend | 🟢 낮음 |
| Medium | M-03 | Error Boundary 없음 | Frontend | 🟢 낮음 |
| Medium | M-04 | Rate Limiting 없음 | Backend | 🟢 낮음 |
| Medium | M-05 | Magic Numbers | Backend | 🟢 낮음 |
| Medium | M-06 | 인덱스 누락 | Database | 🟢 낮음 |
| Medium | M-07 | Checkpoint 미저장 | Backend | 🟢 낮음 |
| Medium | M-08 | 폼 검증 미흡 | Frontend | 🟢 낮음 |
| Medium | M-09 | URL 하드코딩 | Frontend | 🟢 낮음 |
| Medium | M-10 | 네트워크 체크 없음 | Frontend | 🟢 낮음 |

---

## 4. 플로우 품질 평가

### 4.1 잘된 점

| 항목 | 평가 |
|------|------|
| **단계별 분리** | 4단계 명확한 구분, 이전/다음 네비게이션 |
| **실시간 피드백** | SSE로 리드 생성 진행률 표시 |
| **상태 복구** | BullMQ checkpoint로 중간 실패 복구 가능 |
| **다국어 지원** | 한국어/영어 템플릿 자동 생성 |
| **Fake Progress** | Nielsen 휴리스틱 적용 (체감 속도 향상) |
| **관심사 분리** | Routes → Services → Workers 분리 |
| **문서화** | PlantUML 다이어그램, API 목록 정리 |

### 4.2 개선 필요

| 항목 | 현재 상태 |
|------|----------|
| Error Boundary | Step 컴포넌트에 없음 |
| Rate Limiting | 온보딩 API에 미적용 |
| 폼 검증 피드백 | 일부 필드만 하이라이트 |
| Offline 지원 | 네트워크 체크 없음 |
| 로딩 상태 | Step 2 초기 로딩 UX 미흡 |

---

## 5. 데이터베이스 스키마 관계도

```
users (1)
  │
  ├─ workspaces (1) ← ownerId
  │   │
  │   ├─ onboarding_progress (1:1)
  │   │   ├─ surveyData (JSONB)
  │   │   ├─ selectedLeadIds (JSONB) ─── [FK 누락!]
  │   │   ├─ customerGroupId ─────────── [FK 누락!]
  │   │   └─ generatedSequenceId ─────── [FK 누락!]
  │   │
  │   ├─ subscriptions (N)
  │   │   └─ billingPlans → billingProducts
  │   │
  │   ├─ customerGroups (N)
  │   │   └─ customerGroupMembers → leads
  │   │
  │   └─ sequences (N)
  │       └─ emails (N)
  │
  └─ billingCustomers (1:1)
```

---

## 6. 권장 수정 사항

### Phase 1 (즉시 - 1-2일)

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | JWT 서명 적용 | `auth.service.ts` |
| 2 | FK 제약조건 추가 | `onboarding.ts` (schema) |
| 3 | Trial 데이터 단일화 | `users.ts`, `billing.ts` |
| 4 | 트랜잭션 래핑 | `onboarding.service.ts` |

### Phase 2 (1주 내)

| 순서 | 작업 | 파일 |
|------|------|------|
| 5 | SSE 재연결 로직 추가 | `useOnboardingSSE.ts` |
| 6 | Audit History 테이블 생성 | `onboarding.ts` (schema) |
| 7 | 누락된 인덱스 추가 | Migration file |
| 8 | Error Boundary 추가 | `CompanyInformation.tsx` |

### Phase 3 (2주 내)

| 순서 | 작업 | 파일 |
|------|------|------|
| 9 | selectedLeadIds → Junction Table | `onboarding.ts` (schema) |
| 10 | 타임존 라이브러리 적용 | `onboarding-worker.service.ts` |
| 11 | Rate Limiting 적용 | `onboarding.routes.ts` |
| 12 | 폼 검증 UX 개선 | `StepCompanyInfo.tsx` |

---

## 7. 인프라 평가

### Docker Compose 구성

| 평가 항목 | 상태 | 의견 |
|----------|------|------|
| 서비스 분리 | ✅ 우수 | API/Worker/DB 분리 |
| 리소스 제한 | ✅ 적절 | OOM 방지 설정 |
| Health Check | ✅ 적용 | Worker에 readyz 엔드포인트 |
| 백업 | ✅ 자동화 | 하루 2회 + 보관 정책 |
| 네트워크 | ✅ 격리 | bridge 네트워크 |
| 볼륨 | ✅ 영속성 | 데이터 손실 방지 |

### 개선 제안

| 항목 | 현재 | 권장 |
|------|------|------|
| Redis maxmemory-policy | noeviction | allkeys-lru (메모리 풀 시 에러 방지) |
| Worker 수평 확장 | 단일 인스턴스 | replica 설정 필요 |
| 로그 수집 | 없음 | ELK/Grafana 추가 |
| 모니터링 | Uptime Kuma만 | Prometheus + Grafana 권장 |

---

## 8. 종합 결론

### 전체 평가: B+ (양호하나 보안/데이터 무결성 개선 필요)

| 영역 | 점수 | 요약 |
|------|------|------|
| **프론트엔드** | 85/100 | 잘 구조화된 Step 플로우, SSE 실시간 업데이트 |
| **백엔드** | 70/100 | 좋은 서비스 분리, 그러나 JWT 보안 취약 |
| **데이터베이스** | 65/100 | FK 누락, 데이터 중복 문제 |
| **인프라** | 90/100 | 적절한 컨테이너화, 백업 자동화 |
| **플로우 설계** | 85/100 | 직관적인 4단계 진행, 복구 가능한 Job 구조 |
| **문서화** | 88/100 | PlantUML 다이어그램, API 정리 우수 |

### 핵심 개선 포인트

1. 🔐 **JWT 암호화 서명** (보안)
2. 🔗 **FK 제약조건 추가** (무결성)
3. 📊 **Trial 데이터 단일화** (일관성)
4. 🔄 **트랜잭션 적용** (원자성)

---

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2025-12-22 | 초기 분석 문서 작성 | Claude Code |

---

## 관련 문서

- [ONBOARDING.md](./ONBOARDING.md) - BullMQ Worker 구현 명세
- [ONBOARDING_ARCHITECTURE.md](./ONBOARDING_ARCHITECTURE.md) - 아키텍처 다이어그램
- [ONBOARDING_TRIAL_NYLAS_GUIDE.md](./ONBOARDING_TRIAL_NYLAS_GUIDE.md) - 전체 가이드
