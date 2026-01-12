# PR 코드 영향도 분석

**PR:** #658 - feat: 답장/스텝완료 알림 및 B2B 메시지 개선
**변경 규모:** 8 files, +696/-42 lines

---

## 1. 변경 파일별 영향도

### 🆕 신규 파일

#### `email-reply-notification.service.ts` (+165 lines)

| 항목 | 내용 |
|-----|------|
| **역할** | 답장 수신 시 벨 알림 생성 |
| **의존성** | `notification.service.ts`, `db/schema/*`, `logger` |
| **호출자** | `webhook.service.ts` (2곳), `unipile.service.ts` (1곳), `unipile.routes.ts` (1곳) |
| **호출 방식** | 동적 import (비동기, non-blocking) |
| **DB 영향** | `notifications` 테이블 INSERT |
| **Redis 영향** | 없음 |

```
호출 체인:
SendGrid Webhook → webhook.service.ts → email-reply-notification.service.ts
                                      ↘
Unipile Webhook → unipile.routes.ts ────→ notification.service.ts → DB (notifications)
               → unipile.service.ts ──↗                          → Redis PubSub → SSE
```

---

#### `sequence-notification.service.ts` (+378 lines)

| 항목 | 내용 |
|-----|------|
| **역할** | 캠페인 시작/스텝 완료 알림 생성 |
| **의존성** | `notification.service.ts`, `db/schema/*`, `redis/connection`, `logger` |
| **호출자** | `sequences.routes.ts` (2곳), `sequence-email.worker.ts` (1곳) |
| **호출 방식** | 정적 import |
| **DB 영향** | `notifications` 테이블 INSERT, `sequence_step_executions` SELECT |
| **Redis 영향** | 분산 락 사용 (`notification:step-complete:{sequenceId}:{stepOrder}`) |

```
호출 체인:
API → sequences.routes.ts → sequence-notification.service.ts (notifyCampaignStart)
                                      ↓
Worker → sequence-email.worker.ts → sequence-notification.service.ts (checkAndNotifyStepCompletion)
                                      ↓
                           notification.service.ts → DB (notifications)
                                                  → Redis PubSub → SSE
```

**Redis 키 패턴:**
```
notification:step-complete:{sequenceId}:{stepOrder}
├── TTL: 60초
├── 목적: 스텝 완료 알림 중복 방지
└── 동시성: BullMQ 워커 10-20개 동시 실행 대응
```

---

### 📝 수정 파일

#### `sequences.routes.ts` (+58/-42 lines)

| 항목 | 내용 |
|-----|------|
| **변경 내용** | `createNotification` → `notifyCampaignStart` 교체, `/activate-step-based`에 알림 추가 |
| **영향 엔드포인트** | `POST /sequences/:id/activate-step-based`, `POST /admin/sequences/:id/bulk-with-scheduling` |
| **기존 동작** | 캠페인 시작 알림 (일부 엔드포인트만) |
| **신규 동작** | 캠페인 시작 알림 (모든 엔드포인트 통합) |

**변경 전:**
```typescript
// bulk-with-scheduling만 알림 있었음
await createNotification({
  title: "캠페인 시작됐어요! 🚀",
  message: `${result.enrolledCount}명에게...`,
})
```

**변경 후:**
```typescript
// 두 엔드포인트 모두 통합 서비스 사용
await notifyCampaignStart({
  sequenceId, sequenceName, workspaceId, userId,
  enrolledCount, scheduledExecutions, totalSteps,
})
```

---

#### `unipile.routes.ts` (+27/-1 lines)

| 항목 | 내용 |
|-----|------|
| **변경 내용** | `mail_received` 이벤트 처리 후 답장 알림 추가 |
| **영향 엔드포인트** | `POST /unipile/webhook` |
| **트리거** | Unipile에서 새 이메일 수신 시 (답장인 경우) |

**추가된 로직 위치:** Line 1021-1044

---

#### `notification.service.ts` (+10/-10 lines)

| 항목 | 내용 |
|-----|------|
| **변경 내용** | 온보딩 알림 메시지 B2B 친화적으로 개선 |
| **영향 함수** | `getOnboardingNotificationContent()` |
| **기존 동작** | 이모지 포함 캐주얼 메시지 |
| **신규 동작** | 전문적 B2B 메시지 |

**메시지 변경 내용:**
| 이전 | 이후 |
|-----|------|
| `바이어 찾기 완료! 🎉` | `바이어 검색 완료` |
| `잠깐 문제가 생겼어요` | `오류가 발생했습니다` |
| `바이어 찾는 중` | `바이어 검색 중` |
| `${N}명 찾았어요` | `현재 ${N}명 발견` |
| `이메일 작성 중` | `이메일 생성 중` |

---

#### `unipile.service.ts` (+25/-1 lines)

| 항목 | 내용 |
|-----|------|
| **변경 내용** | `handleEmailReplied()` 함수에 답장 알림 추가 |
| **트리거** | Unipile `email.replied` 이벤트 |
| **추가된 로직 위치** | Line 1590-1611 |

---

#### `webhook.service.ts` (+49/-0 lines)

| 항목 | 내용 |
|-----|------|
| **변경 내용** | SendGrid 인바운드 이메일 처리 시 답장 알림 추가 |
| **영향 메서드** | `storeInboundEmailInDB()` |
| **추가된 위치** | Line 787-808 (메인), Line 1057-1081 (fallback) |

**2곳에 추가된 이유:**
1. **메인 로직** (line 787): `In-Reply-To` 헤더로 답장 감지 시
2. **Fallback 로직** (line 1057): 최근 발신 이메일과 매칭으로 답장 감지 시

---

#### `sequence-email.worker.ts` (+16/-0 lines)

| 항목 | 내용 |
|-----|------|
| **변경 내용** | `completed` 이벤트에서 스텝 완료 체크 추가 |
| **영향 이벤트** | BullMQ `completed` 이벤트 핸들러 |
| **실행 조건** | `result.success === true` |
| **호출 방식** | 비동기 (`.catch()`로 에러 무시, 메인 플로우 영향 없음) |

**추가된 로직:**
```typescript
sequenceEmailWorker.on("completed", async (job, result) => {
  // ... 기존 로깅 ...

  if (result.success) {
    checkAndNotifyStepCompletion({
      sequenceId: job.data.sequenceId,
      stepOrder: job.data.stepOrder,
      workspaceId: job.data.workspaceId,
      userId: job.data.userId ?? undefined,
    }).catch((err) => {
      logger.warn(...) // 실패해도 메인 플로우에 영향 없음
    })
  }
})
```

---

## 2. 데이터베이스 영향

### 영향받는 테이블

| 테이블 | 작업 | 빈도 |
|-------|-----|------|
| `notifications` | INSERT | 캠페인 시작 시 1회, 스텝 완료 시 스텝당 1회, 답장 시 1회 |
| `sequence_step_executions` | SELECT (COUNT) | 스텝 완료 체크 시 |
| `sequences` | SELECT | 알림 생성 시 시퀀스명 조회 |
| `sequence_steps` | SELECT (COUNT) | 총 스텝 수 조회 |
| `emails` | SELECT | 원본 이메일 정보 조회 (답장 알림) |
| `leads` | SELECT | 리드명 조회 (답장 알림) |
| `user_email_accounts` | SELECT | userId 조회 (답장 알림) |

### 신규 notifications 레코드 예시

**캠페인 시작:**
```json
{
  "type": "success",
  "priority": "high",
  "title": "발송이 시작되었습니다",
  "message": "B2B 파트너십 · 3단계\n대상 50명, 총 150건 예약",
  "entityType": "sequence",
  "entityId": "{sequenceId}",
  "metadata": {
    "sequenceId": "...",
    "sequenceName": "...",
    "enrolledCount": 50,
    "scheduledExecutions": 150,
    "totalSteps": 3,
    "actionUrl": "/sequences/{id}",
    "actionLabel": "캠페인 확인"
  }
}
```

**스텝 완료:**
```json
{
  "type": "success", // 또는 "warning" (실패 있을 시)
  "priority": "normal",
  "title": "발송 완료", // 또는 "전체 발송 완료"
  "message": "B2B 파트너십 · 2단계\n50건 발송 완료",
  "entityType": "sequence_step_completion",
  "entityId": "{sequenceId}:step{stepOrder}",
  "metadata": {
    "sequenceId": "...",
    "stepOrder": 2,
    "totalSteps": 3,
    "sent": 45,
    "delivered": 5,
    "failed": 0,
    "skipped": 0,
    "actionUrl": "/sequences/{id}",
    "actionLabel": "발송 결과 확인"
  }
}
```

**답장 수신:**
```json
{
  "type": "success",
  "priority": "high",
  "title": "답장이 도착했습니다",
  "message": "김철수님이 회신했습니다\nB2B 파트너십",
  "entityType": "email_reply",
  "entityId": "{emailReplyId}",
  "metadata": {
    "emailReplyId": "...",
    "originalEmailId": "...",
    "replyEmailId": "...",
    "leadId": "...",
    "leadName": "김철수",
    "sequenceId": "...",
    "sequenceName": "B2B 파트너십",
    "actionUrl": "/replied-emails",
    "actionLabel": "답장 확인"
  }
}
```

---

## 3. Redis 영향

### 신규 키 패턴

| 키 패턴 | 목적 | TTL |
|--------|------|-----|
| `notification:step-complete:{sequenceId}:{stepOrder}` | 스텝 완료 알림 중복 방지 | 60초 |

### 기존 사용 중인 키 (변경 없음)

| 키 패턴 | 용도 |
|--------|------|
| `notification:{userId}` | Redis PubSub 채널 (SSE 알림 전송) |

---

## 4. 실행 흐름 다이어그램

### 캠페인 시작 알림

```
┌──────────────────┐
│ POST /sequences/ │
│ activate-step-   │
│ based            │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ sequences.       │────▶│ sequence-        │
│ routes.ts        │     │ notification.    │
│                  │     │ service.ts       │
└──────────────────┘     └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ notification.    │
                         │ service.ts       │
                         │ createNotifi-    │
                         │ cation()         │
                         └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
           ┌──────────────┐            ┌──────────────┐
           │ PostgreSQL   │            │ Redis        │
           │ notifications│            │ PubSub       │
           │ INSERT       │            │ PUBLISH      │
           └──────────────┘            └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ Frontend     │
                                       │ SSE Listener │
                                       │ Notification │
                                       │ Bell Update  │
                                       └──────────────┘
```

### 스텝 완료 알림 (중복 방지 포함)

```
┌──────────────────┐
│ BullMQ Worker    │
│ Job Completed    │
│ (10-20 동시)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ checkAndNotify-  │
│ StepCompletion() │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ pending/         │────▶│ pending > 0?     │──Yes──▶ Return (아직 진행 중)
│ processing       │     │ processing > 0?  │
│ 개수 조회        │     └──────────────────┘
└──────────────────┘              │
                                  No
                                  ▼
                         ┌──────────────────┐
                         │ Redis SET NX     │
                         │ (분산 락)        │
                         │ TTL: 60초        │
                         └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              Lock 성공                    Lock 실패
                    │                           │
                    ▼                           ▼
           ┌──────────────┐            ┌──────────────┐
           │ 발송 통계    │            │ Return       │
           │ 조회 후      │            │ (다른 워커가 │
           │ 알림 생성    │            │ 이미 처리 중) │
           └──────────────┘            └──────────────┘
```

### 답장 알림

```
┌──────────────────┐     ┌──────────────────┐
│ SendGrid         │     │ Unipile          │
│ Inbound Parse    │     │ Webhook          │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│ webhook.         │     │ unipile.         │
│ service.ts       │     │ routes.ts        │
│ storeInbound-    │     │ /webhook         │
│ EmailInDB()      │     │                  │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │         ┌──────────────┤
         │         │              │
         │         ▼              ▼
         │  ┌──────────────┐  ┌──────────────┐
         │  │ unipile.     │  │ Dynamic      │
         │  │ service.ts   │  │ Import       │
         │  │ handleEmail- │  │              │
         │  │ Replied()    │  │              │
         │  └──────┬───────┘  └──────┬───────┘
         │         │                 │
         └─────────┴─────────────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ email-reply-     │
          │ notification.    │
          │ service.ts       │
          │                  │
          │ isNewReply?      │
          │ ├─ true: 알림 O  │
          │ └─ false: 알림 X │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ notification.    │
          │ service.ts       │
          └──────────────────┘
```

---

## 5. 성능 영향

### DB 쿼리 증가

| 시나리오 | 추가 쿼리 수 |
|---------|-------------|
| 캠페인 시작 (1회) | +2 (sequence_steps COUNT, notifications INSERT) |
| 스텝 완료 (스텝당 1회) | +5 (pending COUNT, processing COUNT, stats SELECT, sequence SELECT, notifications INSERT) |
| 답장 수신 (건당 1회) | +4 (email SELECT, user_email_accounts SELECT, lead SELECT (optional), notifications INSERT) |

### Redis 작업 증가

| 시나리오 | 추가 작업 |
|---------|----------|
| 스텝 완료 체크 | SET NX (분산 락) |
| 알림 생성 | PUBLISH (SSE 이벤트) |

### 예상 부하

| 시나리오 | 알림 수 | 쿼리 증가 |
|---------|--------|----------|
| 1,000명 캠페인, 3스텝 | 4개 (시작 1 + 스텝완료 3) | ~22 쿼리 |
| 답장 100건/일 | 100개 | ~400 쿼리 |

---

## 6. 에러 핸들링

### 알림 실패 시 동작

| 위치 | 처리 방식 | 메인 플로우 영향 |
|-----|----------|----------------|
| `sequence-email.worker.ts` | `.catch()` 로깅 후 무시 | ❌ 없음 |
| `webhook.service.ts` | `.catch()` 로깅 후 무시 | ❌ 없음 |
| `unipile.routes.ts` | `.catch()` 로깅 후 무시 | ❌ 없음 |
| `unipile.service.ts` | `.catch()` 로깅 후 무시 | ❌ 없음 |
| `sequences.routes.ts` | `try/catch` 없음 (await) | ⚠️ 실패 시 API 에러 |

**주의:** `sequences.routes.ts`에서 `notifyCampaignStart()`는 `await`로 호출되므로, 알림 생성 실패 시 API 응답에 영향을 줄 수 있습니다. 하지만 `notifyCampaignStart()` 내부에서 `try/catch`로 에러를 처리하므로 실제 영향은 없습니다.

---

## 7. 롤백 계획

### 긴급 롤백 시

```bash
git revert <commit-hash>
```

### 부분 비활성화

```typescript
// 환경 변수로 비활성화 가능 (추후 구현 권장)
if (process.env.DISABLE_REPLY_NOTIFICATIONS !== "true") {
  await notifyEmailReply(...)
}
```

---

## 8. 테스트 체크리스트

### 단위 테스트

- [ ] `notifyCampaignStart()` - 정상 알림 생성
- [ ] `checkAndNotifyStepCompletion()` - pending > 0 시 스킵
- [ ] `checkAndNotifyStepCompletion()` - 중복 호출 시 락으로 스킵
- [ ] `notifyEmailReply()` - isNewReply=false 시 스킵
- [ ] `getOnboardingNotificationContent()` - 메시지 포맷 검증

### 통합 테스트

- [ ] 캠페인 시작 → 알림 생성 → SSE 전송 → 프론트엔드 표시
- [ ] 스텝 완료 → 알림 생성 (중복 없이 1회)
- [ ] SendGrid 답장 웹훅 → 알림 생성
- [ ] Unipile 답장 웹훅 → 알림 생성
- [ ] 대량 발송 (1,000건) → 스텝 완료 알림 1회만

### 부하 테스트

- [ ] BullMQ 워커 20개 동시 실행 → 스텝 완료 알림 중복 없음
- [ ] 답장 100건 동시 처리 → 알림 100개 정상 생성

---

## 9. 모니터링 포인트

### 로그 키워드

```bash
# 스텝 완료 알림
grep "SequenceNotification" logs/app.log

# 답장 알림
grep "ReplyNotification" logs/app.log

# 락 관련
grep "Lock not acquired" logs/app.log
```

### 메트릭 (추후 구현 권장)

- `notifications_created_total{type="step_completion"}`
- `notifications_created_total{type="email_reply"}`
- `notifications_created_total{type="campaign_start"}`
- `step_completion_lock_acquired_total`
- `step_completion_lock_skipped_total`
