# 체험판 대시보드 최적화 제안

## 현재 구조 분석

### 페이지 흐름
```
/dashboard (UnifiedDashboardPage)
    └── AppDashboardPage
        ├── 날짜 표시
        ├── 통계 요약 (발송 X개, 예약 X개, 열람 X개)
        └── Tabs
            ├── 이메일 (SentEmailsTab)
            └── 열린 이메일 (OpenedEmailsTab)
```

### 현재 API 호출 문제점

| 문제 | 설명 | 영향 |
|------|------|------|
| **과다 데이터 호출** | 카운트 계산을 위해 `limit: 500` 사용 | 불필요한 네트워크 비용, 느린 로딩 |
| **중복 API 호출** | `useEmails` 2번 호출 (outbound, opened) | 서버 부하 증가 |
| **프론트엔드 필터링** | `.filter()` 로 상태별 카운트 계산 | 비효율적 |

```typescript
// 현재 비효율적인 코드
const { data: allEmailsData } = useEmails({ limit: 500 })
const sentCount = allEmails.filter(e => e.status === "sent").length
const scheduledCount = allEmails.filter(e => ["scheduled", "draft", "queued"].includes(e.status)).length
```

---

## 최적 구조 제안

### 1. 백엔드: 카운트 전용 API 추가

```typescript
// GET /api/v1/emails/stats?workspaceId={id}
// Response:
{
  "sentCount": 0,
  "scheduledCount": 90,
  "openedCount": 0,
  "totalCount": 90
}
```

### 2. 프론트엔드: 새로운 Hook 구조

```typescript
// hooks/emails.ts
export function useEmailStats(workspaceId: string) {
  return useQuery({
    queryKey: emailKeys.stats(workspaceId),
    queryFn: () => emailsApi.getStats(workspaceId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
  })
}
```

### 3. 컴포넌트 최적화

```typescript
// AppDashboardPage.tsx (최적화 후)
export default function AppDashboardPage() {
  const { data: stats, isLoading } = useEmailStats(workspaceId)

  return (
    <div className="space-y-6">
      <div>
        <p className="font-medium text-lg">{formattedDate}</p>
        <p className="text-muted-foreground text-sm">
          {isLoading ? (
            <Skeleton className="h-4 w-64" />
          ) : (
            `발송 ${stats.sentCount}개, 예약 ${stats.scheduledCount}개, 열람 ${stats.openedCount}개의 이메일이 있어요.`
          )}
        </p>
      </div>

      <Tabs>
        <TabsList>
          <TabsTrigger value="sent">이메일</TabsTrigger>
          <TabsTrigger value="opened">열린 이메일</TabsTrigger>
        </TabsList>
        {/* ... */}
      </Tabs>
    </div>
  )
}
```

---

## API 설계 상세

### 새로운 엔드포인트

#### `GET /api/v1/emails/stats`

**Query Parameters:**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| workspaceId | uuid | Yes | 워크스페이스 ID |
| startDate | ISO8601 | No | 시작 날짜 |
| endDate | ISO8601 | No | 종료 날짜 |

**Response:**
```json
{
  "sentCount": 0,
  "scheduledCount": 90,
  "queuedCount": 0,
  "draftCount": 0,
  "openedCount": 0,
  "clickedCount": 0,
  "repliedCount": 0,
  "bouncedCount": 0,
  "totalCount": 90
}
```

---

## 구현 우선순위

### Phase 1: 즉시 적용 (프론트엔드만)
- [x] 영업 전략 탭 제거
- [ ] 로딩 스켈레톤 추가
- [ ] limit 500 → limit 100 축소

### Phase 2: 백엔드 API 추가
- [ ] `GET /api/v1/emails/stats` 엔드포인트 생성
- [ ] `useEmailStats` hook 생성
- [ ] AppDashboardPage에서 새 hook 사용

### Phase 3: 성능 최적화
- [ ] React Query의 `refetchInterval` 활용
- [ ] 탭 전환 시 prefetch 적용
- [ ] 가상 스크롤링 (이메일 목록 100개 이상 시)

---

## 예상 성능 개선

| 지표 | 현재 | 최적화 후 |
|------|------|----------|
| API 호출 수 | 2회 | 1회 |
| 데이터 전송량 | ~500KB | ~1KB |
| 초기 로딩 시간 | ~800ms | ~100ms |
| 서버 부하 | 높음 | 낮음 |
