# 체험판 대시보드 "한눈에 보기" 기능 분석 보고서

> 작성일: 2025-12-24
> 분석 대상: wks0968@gmail.com (이철희) 체험판 유저

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              프론트엔드                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  AppDashboardPage.tsx (lines 113-126)                                       │
│       │                                                                      │
│       ├─ workspaceId = userWorkspaces?.[0]?.id                              │
│       │                                                                      │
│       └─ useTrialDashboardStats({ workspaceId, startDate, endDate })        │
│              │                                                               │
│              └─ dashboardApi.getTrialDashboardStats(params)                 │
│                      │                                                       │
│                      └─ GET /api/v1/dashboard/trial?workspaceId=xxx         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              백엔드                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  dashboard.routes.ts:8 - GET /trial                                         │
│       │                                                                      │
│       └─ dashboardService.getTrialDashboardStats(params)                    │
│              │                                                               │
│              ├─ getTrialSubscriptionInfo(workspaceId)                       │
│              ├─ getTrialSequenceInfo(workspaceId, sequenceId)               │
│              ├─ getTrialFunnelData(workspaceId, ...)                        │
│              ├─ getTrialHotLeads(workspaceId, ...)                          │
│              ├─ getTrialRecentActivity(workspaceId, ...)                    │
│              ├─ getTrialDailyStats(workspaceId, ...)                        │
│              └─ getTrialCountryStats(workspaceId, ...)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              데이터베이스                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  subscriptions    → 구독 상태 (trialing, active, ...)                       │
│  emails           → 이메일 (workspace_id, sequence_id, sent_at, ...)        │
│  leads            → 리드 정보 (workspace_id, company_name, ...)             │
│  sequences        → 시퀀스 (workspace_id, name, status, ...)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 프론트엔드-백엔드 API 연결 분석

### 2.1 프론트엔드 요청 구조

| 파일 | 위치 | 역할 |
|------|------|------|ㅇ
| `AppDashboardPage.tsx` | lines 113-126 | 대시보드 페이지, API 호출 |
| `dashboard.ts` (hooks) | lines 108-118 | `useTrialDashboardStats` React Query 훅 |
| `dashboard.ts` (services) | lines 281-295 | `getTrialDashboardStats` API 클라이언트 |

#### 요청 파라미터
```typescript
// admin/src/lib/api/services/dashboard.ts:66-71
export type TrialDashboardParams = {
  workspaceId: string       // 필수
  sequenceId?: string       // 선택 (미전달 시 워크스페이스 전체 조회)
  startDate?: string        // 선택 (ISO 8601, e.g., "2024-01-01")
  endDate?: string          // 선택 (ISO 8601)
}
```

#### API 호출
```typescript
// admin/src/lib/api/services/dashboard.ts:281-295
getTrialDashboardStats: async (params: TrialDashboardParams) => {
  const searchParams = new URLSearchParams()
  searchParams.append("workspaceId", params.workspaceId)
  // ... optional params
  return apiFetch<TrialDashboardStats>(`/api/v1/dashboard/trial?${searchParams.toString()}`)
}
```

### 2.2 백엔드 응답 구조

| 파일 | 위치 | 역할 |
|------|------|------|
| `dashboard.routes.ts` | lines 8-50 | API 라우터 (GET /trial) |
| `dashboard.service.ts` | lines 610-680 | `getTrialDashboardStats` 비즈니스 로직 |

#### 응답 타입
```typescript
// admin/src/lib/api/services/dashboard.ts:125-144
export type TrialDashboardStats = {
  subscription: TrialSubscriptionInfo    // 구독 상태
  funnel: TrialFunnelData                // 퍼널 데이터 (발송/오픈/클릭/답장)
  hotLeads: TrialHotLead[]               // 관심 리드 (2+ 오픈)
  recentActivity: TrialRecentActivity[]  // 최근 활동
  dailyStats: TrialDailyStats[]          // 일별 통계
  countryStats: TrialCountryStats[]      // 국가별 분포
  sequence: { ... } | null               // 시퀀스 정보
  industryBenchmark: { ... }             // 산업 벤치마크
}
```

---

## 3. 적용 상태 체크리스트

### 3.1 프론트엔드 ✅

| 항목 | 상태 | 설명 |
|------|------|------|
| API 호출 | ✅ 정상 | `useTrialDashboardStats` 훅 사용 |
| 타입 정의 | ✅ 정상 | 프론트/백엔드 타입 일치 |
| 파라미터 전달 | ✅ 정상 | workspaceId, startDate, endDate 전달 |
| 에러 핸들링 | ✅ 정상 | React Query 에러 처리 |
| 캐싱 | ✅ 정상 | staleTime: 30s, gcTime: 5m |
| 자동 새로고침 | ✅ 정상 | refetchInterval: 30s |

### 3.2 백엔드 ✅

| 항목 | 상태 | 설명 |
|------|------|------|
| 라우터 정의 | ✅ 정상 | GET /api/v1/dashboard/trial |
| 파라미터 검증 | ✅ 정상 | workspaceId 필수, 나머지 선택 |
| 서비스 로직 | ✅ 정상 | 8개 서브쿼리 병렬 실행 |
| 날짜 필터링 | ✅ 정상 | startDate, endDate 적용 |
| 에러 응답 | ✅ 정상 | ResponseCode.INTERNAL_ERROR |

### 3.3 데이터베이스 ✅

| 항목 | 상태 | 설명 |
|------|------|------|
| workspace_id 정합성 | ✅ 정상 | 36,092건 모두 OK (NULL/MISMATCH 0건) |
| 인덱스 | ✅ 정상 | workspace_id, sequence_id, sent_at |
| 조인 | ✅ 정상 | emails ↔ leads ↔ sequences |

---

## 4. 문제점 분석

### 4.1 wks0968@gmail.com 유저 현황

```sql
-- 프로덕션 DB 조회 결과
유저 ID:        aefb8d5f-130b-4abf-9f27-46fc1a18ad5e
이메일:         wks0968@gmail.com
이름:           이철희
워크스페이스:    그린다에이아이 (3c0b1831-96af-490b-8a96-70420e9b2cab)
멤버십 상태:     active
구독 상태:       trialing (2025-12-24 ~ 2025-12-31)

시퀀스:         0개 ❌
리드:           0개 ❌
이메일:         0개 ❌
```

### 4.2 문제 원인

| 원인 | 해당 여부 | 설명 |
|------|----------|------|
| 권한 문제 | ❌ 아님 | 멤버십 active, 구독 trialing |
| workspace_id 불일치 | ❌ 아님 | 전체 시스템 정합성 100% |
| API 오류 | ❌ 아님 | 프론트/백엔드 연결 정상 |
| **데이터 없음** | ✅ **원인** | 시퀀스/리드/이메일 0개 |

---

## 5. "한눈에 보기" vs "바이어 목록" 차이점

### 5.1 데이터 소스 비교

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  "한눈에 보기" (Overview) 탭                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  useTrialDashboardStats({ workspaceId })                                    │
│       │                                                                      │
│       └─ emails 테이블에서 workspace_id로 조회                              │
│          (sequenceId 미전달 시 워크스페이스 전체)                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  "바이어 목록" / "이메일 캠페인" 탭                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  useSequenceEnrollments(firstSequenceId)                                    │
│       │                                                                      │
│       └─ sequence_enrollments 테이블에서 sequence_id로 조회                 │
│          (시퀀스 기반)                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 시퀀스 없을 때 동작

```typescript
// AppDashboardPage.tsx:841-863
// 바이어 목록 탭
{firstSequenceId ? (
  <SequenceEnrollmentsTable sequenceId={firstSequenceId} />
) : (
  <div>이메일 캠페인을 생성하면 바이어 목록이 표시됩니다</div>
)}

// 이메일 캠페인 탭
{firstSequenceId ? (
  <SequenceStepsList ... />
) : (
  <div>이메일 캠페인을 생성하면 여기에 표시됩니다</div>
)}
```

---

## 6. 개선 권장사항

### 6.1 체험판 샘플 데이터 자동 생성 (권장)

```typescript
// 체험판 가입 시 자동 실행
async function createTrialSampleData(workspaceId: string) {
  // 1. 샘플 시퀀스 생성
  const sequence = await db.insert(sequences).values({
    workspaceId,
    name: "샘플 이메일 캠페인",
    status: "active"
  }).returning()

  // 2. 샘플 리드 5~10개 생성
  const sampleLeads = await createSampleLeads(workspaceId, 10)

  // 3. 샘플 이메일 생성 (발송/오픈/클릭 시뮬레이션)
  await createSampleEmails(workspaceId, sequence[0].id, sampleLeads)
}
```

### 6.2 빈 상태 UI 개선

```typescript
// 현재: placeholder 데이터가 실제 데이터처럼 보임
// 개선: 명확한 빈 상태 안내

if (!stats?.funnel?.sent) {
  return (
    <EmptyState
      icon={<MailIcon />}
      title="아직 발송된 이메일이 없습니다"
      description="첫 이메일 캠페인을 시작하면 여기서 성과를 확인할 수 있습니다."
      action={
        <Button onClick={handleCreateCampaign}>
          첫 캠페인 시작하기
        </Button>
      }
    />
  )
}
```

### 6.3 데모 모드 추가

```typescript
// 체험판 유저에게 데모 데이터 보여주기 옵션
const { data: stats } = useTrialDashboardStats(params)

const displayStats = useMemo(() => {
  if (stats && hasRealData(stats)) {
    return stats
  }
  // 실제 데이터 없으면 데모 데이터 표시
  return getDemoStats()
}, [stats])
```

---

## 7. 결론

### 7.1 개발 적용 상태

| 구분 | 상태 | 비고 |
|------|------|------|
| **프론트엔드 → 백엔드 연결** | ✅ 정상 | 타입, API 호출 모두 일치 |
| **백엔드 → DB 연결** | ✅ 정상 | 쿼리, 조인 정상 동작 |
| **데이터 정합성** | ✅ 정상 | workspace_id 100% 일치 |
| **권한 체크** | ✅ 정상 | 인증된 사용자 접근 가능 |

### 7.2 데이터 표시 안 되는 이유

```
❌ 권한 문제 아님
❌ API 오류 아님
❌ workspace_id 불일치 아님

✅ 원인: 해당 워크스페이스에 데이터가 없음
   - 시퀀스: 0개
   - 리드: 0개
   - 이메일: 0개
```

### 7.3 권장 조치

1. **단기**: 빈 상태 UI 개선 (명확한 안내 메시지)
2. **중기**: 체험판 가입 시 샘플 데이터 자동 생성
3. **장기**: 데모 모드 추가 (실제 데이터 없어도 기능 체험 가능)

---

## 부록: 핵심 파일 경로

```
프론트엔드
├── admin/src/pages/app/AppDashboardPage.tsx      # 대시보드 페이지
├── admin/src/lib/api/hooks/dashboard.ts          # React Query 훅
└── admin/src/lib/api/services/dashboard.ts       # API 클라이언트

백엔드
├── elysia-server/src/routes/dashboard.routes.ts  # API 라우터
└── elysia-server/src/services/dashboard.service.ts # 비즈니스 로직

DB 스키마
├── elysia-server/src/db/schema/emails.ts         # emails 테이블
├── elysia-server/src/db/schema/sequences.ts      # sequences 테이블
└── elysia-server/src/db/schema/billing.ts        # subscriptions 테이블
```
