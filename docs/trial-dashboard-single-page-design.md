# 체험판 대시보드 - 원페이지 디자인

## 개요

체험판 유저는 일반적으로:
- **1개의 시퀀스** (온보딩 시 생성된 데모 시퀀스)
- **~30명의 리드** (자동 발견된 바이어)
- **3개의 이메일 스텝**

모든 정보를 한 페이지에서 직관적으로 확인할 수 있도록 설계.

---

## UI/UX 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 시퀀스 현황                                    [활성화됨 ●]  │
│  ─────────────────────────────────────────────────────────────  │
│  데모 이메일 시퀀스                                              │
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                      │
│  │ Step 1  │───▶│ Step 2  │───▶│ Step 3  │                      │
│  │ 2분 뒤  │    │ 1일 후  │    │ 2일 후  │                      │
│  │ 30/30   │    │ 0/30    │    │ 0/30    │                      │
│  └─────────┘    └─────────┘    └─────────┘                      │
│                                                                 │
│  📧 발송: 0  📬 예약: 90  👁️ 열람: 0  💬 답장: 0                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  👥 리드별 이메일 현황                    🔍 검색... [필터 ▼]    │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 회사명              │ Step 1     │ Step 2     │ Step 3  │   │
│  ├─────────────────────┼────────────┼────────────┼─────────┤   │
│  │ BJ Accountants Ltd  │ 📧 예약    │ ⏳ 대기    │ ⏳ 대기 │   │
│  │ info@bjaccoun...    │            │            │         │   │
│  ├─────────────────────┼────────────┼────────────┼─────────┤   │
│  │ CMI Planners Ltd    │ 👁️ 열람(3) │ ⏳ 대기    │ ⏳ 대기 │   │
│  │ info@cmiplann...    │ 2분 전     │            │         │   │
│  ├─────────────────────┼────────────┼────────────┼─────────┤   │
│  │ Primary Numbers     │ 📧 발송됨  │ 📧 예약    │ ⏳ 대기 │   │
│  │ info@primaryn...    │            │ 내일 09:00 │         │   │
│  └─────────────────────┴────────────┴────────────┴─────────┘   │
│                                                                 │
│  ◀ 이전  1 / 5  다음 ▶                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ⚡ 실시간 활동                                      [새로고침]  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  🟢 방금 전     CMI Planners Ltd가 Step 1 이메일을 열람했습니다   │
│  🟢 2분 전     Primary Numbers가 Step 1 이메일을 열람했습니다    │
│  📧 5분 전     BJ Accountants Ltd에게 Step 1 발송 완료           │
│  📧 5분 전     CMI Planners Ltd에게 Step 1 발송 완료             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 컴포넌트 구조

```
TrialDashboardPage
├── SequenceOverviewCard
│   ├── SequenceHeader (이름, 상태)
│   ├── StepProgressFlow (3개 스텝 시각화)
│   └── QuickStats (발송/예약/열람/답장 카운트)
│
├── LeadEmailStatusTable
│   ├── SearchAndFilter
│   ├── LeadRowWithStepStatus (리드별 스텝 상태)
│   └── Pagination
│
└── RealtimeActivityFeed
    └── ActivityItem (시간순 활동 목록)
```

---

## 필요한 API 데이터

### 1. 시퀀스 정보
```typescript
GET /api/v1/sequences/{id}
{
  id: string
  name: string
  status: "active" | "paused" | "draft"
  selectedLeadIds: string[]
  steps: [
    { id, stepOrder, delayDays, emailSubject }
  ]
}
```

### 2. 시퀀스 등록(Enrollment) 현황
```typescript
GET /api/v1/sequences/{id}/enrollments/summary
{
  totalLeads: 30
  byStep: [
    { stepOrder: 1, sent: 30, opened: 12, clicked: 3 }
    { stepOrder: 2, sent: 0, scheduled: 30 }
    { stepOrder: 3, sent: 0, scheduled: 30 }
  ]
  totals: { sent: 30, scheduled: 60, opened: 12, clicked: 3, replied: 1 }
}
```

### 3. 리드별 이메일 상태
```typescript
GET /api/v1/sequences/{id}/enrollments?page=1&limit=10
{
  enrollments: [
    {
      leadId: string
      leadName: string
      companyName: string
      email: string
      steps: [
        { stepOrder: 1, status: "opened", openCount: 3, sentAt, openedAt }
        { stepOrder: 2, status: "scheduled", scheduledAt }
        { stepOrder: 3, status: "pending" }
      ]
    }
  ]
  total: 30
}
```

### 4. 실시간 활동
```typescript
GET /api/v1/sequences/{id}/activity?limit=20
{
  activities: [
    { type: "opened", leadName, companyName, stepOrder, timestamp }
    { type: "sent", leadName, companyName, stepOrder, timestamp }
    { type: "clicked", leadName, companyName, stepOrder, timestamp }
  ]
}
```

---

## 상태 아이콘 범례

| 상태 | 아이콘 | 색상 | 설명 |
|------|--------|------|------|
| 대기 | ⏳ | Gray | 이전 스텝 완료 대기 |
| 예약 | 📧 | Blue | 발송 예약됨 |
| 발송됨 | ✉️ | Green | 발송 완료 |
| 열람 | 👁️ | Purple | 이메일 열람 (횟수 표시) |
| 클릭 | 🔗 | Orange | 링크 클릭 |
| 답장 | 💬 | Green+ | 답장 받음 |
| 바운스 | ❌ | Red | 발송 실패 |

---

## 구현 우선순위

### Phase 1: MVP (즉시 구현)
- [x] 기존 API 활용하여 기본 UI 구현
- [ ] 시퀀스 현황 카드
- [ ] 리드별 이메일 테이블
- [ ] 페이지네이션

### Phase 2: 향상
- [ ] 실시간 활동 피드
- [ ] 검색/필터 기능
- [ ] 오픈율 그래프

### Phase 3: 최적화
- [ ] 백엔드 전용 API 추가 (`/enrollments/summary`)
- [ ] WebSocket 실시간 업데이트
- [ ] 이메일 미리보기 모달

---

## 기존 API 활용 방안

현재 존재하는 API:
- `useSequenceSteps(sequenceId)` - 스텝 정보
- `useSequenceEnrollments(sequenceId)` - 등록 현황
- `useEmails({ workspaceId })` - 이메일 목록

이를 조합하여 MVP 구현 가능.
