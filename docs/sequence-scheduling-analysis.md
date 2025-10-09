# 시퀀스 이메일 스케줄링 로직 분석 보고서

## 📋 개요
본 문서는 현재 구현된 시퀀스 이메일 스케줄링 시스템을 분석하고, 한국시간(KST) 기반 스케줄링 개선을 위한 방안을 제시합니다.

작성일: 2025-10-10

---

## 🔍 현재 구현 상태

### 1. 프론트엔드 (admin/src/pages/sequences/)

#### 1.1 SequenceStepForm.tsx
- **위치**: `/admin/src/pages/sequences/SequenceStepForm.tsx`
- **현재 입력 필드**:
  - `stepOrder`: 스텝 순서 (정수)
  - `delayDays`: 발송 지연 일수 (정수, 0 이상)
  - `emailSubject`: 이메일 제목
  - `emailBodyText/Html`: 이메일 본문

```typescript
// 현재 구현 (SequenceStepForm.tsx:63-82)
<div className="space-y-2">
  <Label htmlFor={delayDaysId}>
    발송 지연 일수 <span className="text-red-500">*</span>
  </Label>
  <Input
    id={delayDaysId}
    type="number"
    min="0"
    value={formData.delayDays}
    onChange={(e) => setFormData({
      ...formData,
      delayDays: parseInt(e.target.value, 10) || 0,
    })}
    required
    placeholder="예: 3"
  />
  <p className="text-xs text-muted-foreground">이전 스텝 후 며칠 뒤 발송</p>
</div>
```

**문제점**:
- ❌ 단순히 "며칠 뒤"만 지정 가능
- ❌ 구체적인 발송 시간을 지정할 수 없음
- ❌ 타임존 설정 불가능

---

### 2. 백엔드 데이터베이스 스키마

#### 2.1 sequences.ts (DB Schema)
- **위치**: `/elysia-server/src/db/schema/sequences.ts`

```typescript
// sequence_steps 테이블 (lines 72-92)
export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sequenceId: uuid("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    delayDays: integer("delay_days").notNull().default(0), // ⚠️ 일수만 저장
    emailSubject: varchar("email_subject", { length: 500 }).notNull(),
    emailBodyText: text("email_body_text"),
    emailBodyHtml: text("email_body_html"),
    emailTemplateId: uuid("email_template_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
)
```

**문제점**:
- ❌ `delayDays`만 저장 (시간 정보 없음)
- ❌ 타임존 정보 없음
- ❌ 특정 시각 지정 불가능

---

### 3. 백엔드 스케줄링 로직

#### 3.1 sequence.service.ts - 스케줄링 계산
- **위치**: `/elysia-server/src/services/sequence.service.ts`

**주요 스케줄링 로직**:

##### A. 초기 등록 시 (bulkEnrollWithScheduling, line 662)
```typescript
// line 657-672
const now = new Date()
const stepExecutionValues = []

for (const enrollment of enrollments) {
  for (const step of steps) {
    const scheduledAt = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000)
    // ⚠️ 단순히 현재시간 + (일수 * 밀리초)

    stepExecutionValues.push({
      enrollmentId: enrollment.id,
      stepId: step.id,
      stepOrder: step.stepOrder,
      status: "pending" as const,
      scheduledAt,
    })
  }
}
```

##### B. 다음 스텝 스케줄링 (updateEnrollmentProgress, line 835)
```typescript
// line 833-836
const nextStep = steps.find((s) => s.stepOrder === stepOrder + 1)
if (nextStep) {
  const nextScheduledAt = new Date(Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000)
  // ⚠️ 현재시간 + (일수 * 밀리초)
  updateData.nextStepScheduledAt = nextScheduledAt
}
```

**문제점**:
- ❌ 단순히 "현재시간 + N일"로 계산
- ❌ 특정 시각 (예: 오전 9시)을 지정할 수 없음
- ❌ 타임존 처리가 없음
- ❌ 등록 시점에 따라 발송 시간이 달라짐

**예시 문제 상황**:
```
리드 A: 오전 10:00에 등록 → 3일 후 오전 10:00에 발송
리드 B: 오후 15:00에 등록 → 3일 후 오후 15:00에 발송
리드 C: 밤 23:00에 등록 → 3일 후 밤 23:00에 발송 ❌
```

#### 3.2 email-sequence-worker.ts - 이메일 발송 Worker
- **위치**: `/elysia-server/src/workers/email-sequence-worker.ts`

```typescript
// line 722-759
export async function getPendingStepExecutions(limit: number = 100) {
  const now = new Date() // ⚠️ 서버의 현재시간 (UTC 기준일 가능성)

  const result = await db
    .select({...})
    .from(sequenceStepExecutions)
    .where(
      and(
        eq(sequenceStepExecutions.status, "pending"),
        lte(sequenceStepExecutions.scheduledAt, now), // scheduledAt <= now
        eq(sequenceEnrollments.status, "active"),
        eq(sequences.status, "active"),
      ),
    )
    .orderBy(sequenceStepExecutions.scheduledAt)
    .limit(limit)

  return result
}

// line 186-200: Worker 실행 주기
export function startEmailSequenceWorker() {
  logger.debug("✅ Email sequence worker started")

  // 즉시 실행
  processSequenceEmails()

  // 1분마다 실행
  const intervalId = setInterval(processSequenceEmails, 60 * 1000)

  return () => {
    logger.info("Stopping email sequence worker")
    clearInterval(intervalId)
  }
}
```

**현재 동작 방식**:
1. ✅ 매 1분마다 pending 상태의 실행 확인
2. ✅ `scheduledAt <= 현재시간` 인 항목 조회
3. ✅ SendGrid API로 이메일 발송
4. ✅ 상태를 'sent' 또는 'failed'로 업데이트

**문제점**:
- ❌ 타임존 처리 없음
- ❌ 데이터베이스의 timestamp는 `withTimezone: true`이지만, 한국시간 기준 스케줄링 없음

---

## 🎯 개선 방안

### 1. 데이터베이스 스키마 변경

#### 1.1 sequence_steps 테이블에 필드 추가

```typescript
// elysia-server/src/db/schema/sequences.ts 수정
export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sequenceId: uuid("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    delayDays: integer("delay_days").notNull().default(0),

    // ✨ 새로 추가할 필드들
    scheduledHour: integer("scheduled_hour").default(9), // 0-23 (기본값: 오전 9시)
    scheduledMinute: integer("scheduled_minute").default(0), // 0-59 (기본값: 0분)
    timezone: varchar("timezone", { length: 50 }).default("Asia/Seoul"), // 타임존 (기본값: 한국시간)

    emailSubject: varchar("email_subject", { length: 500 }).notNull(),
    emailBodyText: text("email_body_text"),
    emailBodyHtml: text("email_body_html"),
    emailTemplateId: uuid("email_template_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
)
```

#### 1.2 마이그레이션 SQL

```sql
-- 새 컬럼 추가
ALTER TABLE sequence_steps
ADD COLUMN scheduled_hour INTEGER DEFAULT 9,
ADD COLUMN scheduled_minute INTEGER DEFAULT 0,
ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Seoul';

-- 제약 조건 추가
ALTER TABLE sequence_steps
ADD CONSTRAINT check_scheduled_hour CHECK (scheduled_hour >= 0 AND scheduled_hour <= 23),
ADD CONSTRAINT check_scheduled_minute CHECK (scheduled_minute >= 0 AND scheduled_minute <= 59);
```

---

### 2. 프론트엔드 UI 개선

#### 2.1 SequenceStepForm.tsx 수정

```typescript
// admin/src/pages/sequences/SequenceStepForm.tsx

const [formData, setFormData] = useState({
  stepOrder: step?.stepOrder ?? stepOrder,
  delayDays: step?.delayDays ?? 0,

  // ✨ 새로 추가
  scheduledHour: step?.scheduledHour ?? 9,
  scheduledMinute: step?.scheduledMinute ?? 0,
  timezone: step?.timezone ?? "Asia/Seoul",

  emailSubject: step?.emailSubject || "",
  emailBodyText: step?.emailBodyText || "",
})

// JSX 부분
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label htmlFor={delayDaysId}>
      발송 지연 일수 <span className="text-red-500">*</span>
    </Label>
    <Input
      id={delayDaysId}
      type="number"
      min="0"
      value={formData.delayDays}
      onChange={(e) => setFormData({
        ...formData,
        delayDays: parseInt(e.target.value, 10) || 0,
      })}
      required
      placeholder="예: 3"
    />
    <p className="text-xs text-muted-foreground">이전 스텝 후 며칠 뒤 발송</p>
  </div>

  {/* ✨ 새로 추가: 발송 시간 선택 */}
  <div className="space-y-2">
    <Label htmlFor={scheduledTimeId}>
      발송 시간 (한국시간) <span className="text-red-500">*</span>
    </Label>
    <div className="flex gap-2">
      <Select
        value={formData.scheduledHour.toString()}
        onValueChange={(value) => setFormData({
          ...formData,
          scheduledHour: parseInt(value, 10),
        })}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="시" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 24 }, (_, i) => (
            <SelectItem key={i} value={i.toString()}>
              {i.toString().padStart(2, '0')}시
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={formData.scheduledMinute.toString()}
        onValueChange={(value) => setFormData({
          ...formData,
          scheduledMinute: parseInt(value, 10),
        })}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="분" />
        </SelectTrigger>
        <SelectContent>
          {[0, 15, 30, 45].map((minute) => (
            <SelectItem key={minute} value={minute.toString()}>
              {minute.toString().padStart(2, '0')}분
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <p className="text-xs text-muted-foreground">
      예: 3일 후 오전 09:00 (KST)에 발송
    </p>
  </div>
</div>
```

---

### 3. 백엔드 스케줄링 로직 개선

#### 3.1 타임존 처리 유틸리티 함수

```typescript
// elysia-server/src/utils/timezone.ts (새 파일)

/**
 * 한국시간 기준으로 N일 후의 특정 시각을 계산
 * @param fromDate 기준 날짜
 * @param delayDays 지연 일수
 * @param hour 시 (0-23)
 * @param minute 분 (0-59)
 * @param timezone 타임존 (기본값: Asia/Seoul)
 * @returns UTC 기준 Date 객체
 */
export function calculateScheduledTime(
  fromDate: Date,
  delayDays: number,
  hour: number,
  minute: number,
  timezone: string = "Asia/Seoul"
): Date {
  // 1. 기준 날짜를 한국시간으로 변환
  const kstDate = new Date(fromDate.toLocaleString("en-US", { timeZone: timezone }))

  // 2. N일 후 계산
  const targetDate = new Date(kstDate)
  targetDate.setDate(targetDate.getDate() + delayDays)

  // 3. 특정 시각으로 설정
  targetDate.setHours(hour, minute, 0, 0)

  // 4. 한국시간을 UTC로 변환
  const kstOffset = 9 * 60 * 60 * 1000 // KST = UTC+9
  const utcDate = new Date(targetDate.getTime() - kstOffset)

  return utcDate
}

/**
 * 한국시간으로 포맷팅
 */
export function formatKST(date: Date): string {
  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
}
```

#### 3.2 sequence.service.ts 수정

```typescript
// elysia-server/src/services/sequence.service.ts

import { calculateScheduledTime } from "../utils/timezone"

// bulkEnrollWithScheduling 함수 수정 (line 604-698)
export async function bulkEnrollWithScheduling(data: {
  sequenceId: string
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}) {
  const steps = await getSequenceSteps(data.sequenceId)

  if (steps.length === 0) {
    throw new Error("시퀀스에 스텝이 없습니다.")
  }

  // ... (리드 필터링 로직)

  const enrollments = await db.insert(sequenceEnrollments).values(enrollmentValues).returning({
    id: sequenceEnrollments.id,
    leadId: sequenceEnrollments.leadId,
    enrolledAt: sequenceEnrollments.enrolledAt,
  })

  // ✨ 개선된 스케줄링 로직
  const stepExecutionValues = []

  for (const enrollment of enrollments) {
    let baseDate = new Date(enrollment.enrolledAt)

    for (const step of steps) {
      // ✨ 한국시간 기준으로 스케줄링 계산
      const scheduledAt = calculateScheduledTime(
        baseDate,
        step.delayDays,
        step.scheduledHour ?? 9,  // 기본값: 오전 9시
        step.scheduledMinute ?? 0, // 기본값: 0분
        step.timezone ?? "Asia/Seoul"
      )

      stepExecutionValues.push({
        enrollmentId: enrollment.id,
        stepId: step.id,
        stepOrder: step.stepOrder,
        status: "pending" as const,
        scheduledAt,
      })

      // 다음 스텝 계산을 위한 기준 시간 업데이트
      baseDate = scheduledAt
    }
  }

  if (stepExecutionValues.length > 0) {
    await db.insert(sequenceStepExecutions).values(stepExecutionValues)
  }

  // ... (나머지 로직)
}

// updateEnrollmentProgress 함수 수정 (line 787-851)
export async function updateEnrollmentProgress(enrollmentId: string, stepOrder: number) {
  const enrollment = await db
    .select({
      sequenceId: sequenceEnrollments.sequenceId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
      lastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
    })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (!enrollment[0]) return null

  const steps = await getSequenceSteps(enrollment[0].sequenceId)
  const isLastStep = stepOrder >= steps.length

  const updateData = {
    currentStepOrder: stepOrder,
    lastEmailSentAt: new Date(),
  }

  if (!isLastStep) {
    const nextStep = steps.find((s) => s.stepOrder === stepOrder + 1)
    if (nextStep) {
      // ✨ 한국시간 기준으로 다음 스텝 스케줄링
      const baseDate = enrollment[0].lastEmailSentAt || new Date()
      const nextScheduledAt = calculateScheduledTime(
        baseDate,
        nextStep.delayDays,
        nextStep.scheduledHour ?? 9,
        nextStep.scheduledMinute ?? 0,
        nextStep.timezone ?? "Asia/Seoul"
      )
      updateData.nextStepScheduledAt = nextScheduledAt
    }
  } else {
    updateData.status = "completed"
    updateData.completedAt = new Date()
    updateData.nextStepScheduledAt = null
  }

  const [updated] = await db
    .update(sequenceEnrollments)
    .set(updateData)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .returning({
      id: sequenceEnrollments.id,
      status: sequenceEnrollments.status,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
    })

  return updated
}
```

---

## 📊 개선 후 예상 동작

### 시나리오: 3단계 이메일 시퀀스

**설정**:
- Step 1: 등록 즉시, 09:00 KST 발송
- Step 2: 3일 후, 09:00 KST 발송
- Step 3: 7일 후, 09:00 KST 발송

**등록 시점별 발송 시간**:

| 리드 등록 시간 (KST) | Step 1 발송 (KST) | Step 2 발송 (KST) | Step 3 발송 (KST) |
|---------------------|------------------|------------------|------------------|
| 2025-10-10 08:30 | 2025-10-10 09:00 | 2025-10-13 09:00 | 2025-10-17 09:00 |
| 2025-10-10 15:00 | 2025-10-11 09:00 | 2025-10-14 09:00 | 2025-10-18 09:00 |
| 2025-10-10 23:00 | 2025-10-11 09:00 | 2025-10-14 09:00 | 2025-10-18 09:00 |

✅ **모든 이메일이 오전 9시에 발송됩니다!**

---

## 🚀 구현 우선순위

### Phase 1: 기본 구현 (필수)
1. ✅ DB 스키마에 `scheduledHour`, `scheduledMinute`, `timezone` 필드 추가
2. ✅ 프론트엔드 UI에 시간 선택 기능 추가
3. ✅ 백엔드 스케줄링 로직에 타임존 처리 적용

### Phase 2: 고급 기능 (선택)
1. 타임존 선택 옵션 추가 (현재는 한국시간 고정)
2. 주말/공휴일 제외 옵션
3. 발송 시간대 제한 (예: 오전 9시~오후 6시만 허용)
4. 대량 발송 시 시간 분산 (Throttling)

### Phase 3: 모니터링 & 최적화
1. 스케줄링 로그 개선
2. 발송 통계 대시보드
3. 타임존별 발송 성공률 분석

---

## ⚠️ 주의사항

### 1. 데이터베이스 타임존 처리
- PostgreSQL의 `timestamp with time zone`은 내부적으로 UTC로 저장
- 애플리케이션 레벨에서 타임존 변환 필요

### 2. Worker 실행 환경
- 서버의 시스템 타임존과 무관하게 동작하도록 구현
- Docker 컨테이너 환경에서는 `TZ` 환경변수 설정 권장

### 3. 마이그레이션 전략
- 기존 데이터에 대한 기본값 설정 (09:00 KST)
- 점진적 마이그레이션 권장

### 4. 테스트
- 다양한 타임존에서 테스트 필요
- 서머타임(DST) 전환 시점 고려

---

## 📚 참고 자료

### 관련 파일
- 프론트엔드: `/admin/src/pages/sequences/SequenceStepForm.tsx`
- DB 스키마: `/elysia-server/src/db/schema/sequences.ts`
- 서비스 로직: `/elysia-server/src/services/sequence.service.ts`
- Worker: `/elysia-server/src/workers/email-sequence-worker.ts`

### 라이브러리
- PostgreSQL timestamp: https://www.postgresql.org/docs/current/datatype-datetime.html
- JavaScript Date API: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
- Temporal API (미래): https://tc39.es/proposal-temporal/docs/

---

## ✅ 체크리스트

- [ ] DB 마이그레이션 파일 작성
- [ ] 프론트엔드 UI 구현
- [ ] 타임존 유틸리티 함수 작성
- [ ] 백엔드 스케줄링 로직 수정
- [ ] 단위 테스트 작성
- [ ] 통합 테스트
- [ ] 문서 업데이트

---

**마지막 업데이트**: 2025-10-10
**작성자**: Claude Code Assistant
