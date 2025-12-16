# BullMQ 이메일 스케줄링 시스템 구현 계획

## 목차
1. [개요](#개요)
2. [현재 시스템 분석](#현재-시스템-분석)
3. [BullMQ 아키텍처 설계](#bullmq-아키텍처-설계)
4. [구현 단계](#구현-단계)
5. [상세 구현 코드](#상세-구현-코드)
6. [Rate Limiting 구현](#rate-limiting-구현)
7. [모니터링 (Bull Board)](#모니터링-bull-board)
8. [마이그레이션 전략](#마이그레이션-전략)
9. [테스트 계획](#테스트-계획)
10. [운영 가이드](#운영-가이드)

---

## 개요

### 목표
- 계정별 일일 20개 이메일 발송 제한 구현
- 업무시간(9AM-6PM KST) 분산 발송
- 실시간 큐 모니터링
- 안정적인 재시도 및 실패 처리

### 기술 스택
| 구분 | 기술 | 버전 |
|------|------|------|
| 메시지 큐 | BullMQ | ^5.x |
| 캐시/브로커 | Redis | 7.4 (기존) |
| 런타임 | Bun | 1.x |
| 프레임워크 | Elysia | 1.x |
| DB | PostgreSQL | 17.2 (기존) |
| 모니터링 | Bull Board | ^5.x |

---

## 현재 시스템 분석

### 기존 아키텍처 (PostgreSQL 폴링)
```
┌─────────────────┐
│   API Server    │
└────────┬────────┘
         │ INSERT (status='scheduled')
         ▼
┌─────────────────────────────────────┐
│   PostgreSQL                        │
│   emails table                      │
│   - 30초마다 폴링                    │
│   - FOR UPDATE SKIP LOCKED          │
└────────┬────────────────────────────┘
         │ SELECT (scheduledAt <= now)
         ▼
┌─────────────────────────────────────┐
│   scheduled-email-worker.ts         │
│   - setInterval 30초                │
│   - 100개씩 배치 처리                │
└─────────────────────────────────────┘
```

### 기존 방식의 한계
1. **Rate Limiting 없음**: 계정별 발송 제한 불가
2. **지연 발생**: 최대 30초 지연
3. **확장성 제한**: 단일 워커, 동시성 제어 어려움
4. **모니터링 부재**: 실시간 큐 상태 확인 불가

---

## BullMQ 아키텍처 설계

### 신규 아키텍처
```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer (Elysia)                          │
│  POST /api/v1/emails/send                                           │
│  POST /api/v1/emails/schedule-batch                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Email Queue Service                            │
│  - addEmailJob(): 즉시 발송                                          │
│  - scheduleEmail(): 예약 발송 (delayed)                              │
│  - scheduleDailyBatch(): 일일 배치 (계정별 20개)                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BullMQ Queues (Redis)                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  email:immediate │  │  email:scheduled │  │  email:daily     │  │
│  │  (즉시 발송)      │  │  (예약 발송)      │  │  (일일 배치)     │  │
│  │  limiter: 10/min │  │  delayed jobs    │  │  repeatable      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Rate Limiter (Redis)                             │
│  Key: email:limit:{accountId}:{YYYYMMDD}                            │
│  - 계정별 일일 20개 제한                                              │
│  - Sliding Window Counter                                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Email Workers (Multi-instance)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Worker 1    │  │  Worker 2    │  │  Worker 3    │              │
│  │  concurrency │  │  concurrency │  │  concurrency │              │
│  │  = 5         │  │  = 5         │  │  = 5         │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SendGrid API                                │
│  - 실제 이메일 발송                                                   │
│  - Webhook으로 결과 수신                                              │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL (기록용)                             │
│  - 발송 결과 저장                                                     │
│  - 통계 및 히스토리                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 큐 설계

| 큐 이름 | 용도 | Rate Limit | 재시도 |
|---------|------|------------|--------|
| `email:immediate` | 즉시 발송 | 10/분 | 3회 |
| `email:scheduled` | 예약 발송 | 계정별 20/일 | 3회 |
| `email:daily-batch` | 일일 배치 | 계정별 20/일 | 3회 |
| `email:failed` | 실패 재처리 | 1/분 | 5회 |

---

## 구현 단계

### Phase 1: 기본 설정 (1일차)
- [ ] BullMQ 패키지 설치
- [ ] Redis 연결 설정
- [ ] 기본 큐 생성
- [ ] 워커 기본 구조 작성

### Phase 2: 핵심 기능 (2-3일차)
- [ ] Email Queue Service 구현
- [ ] Rate Limiter 구현 (계정별 일 20개)
- [ ] Email Worker 구현
- [ ] 기존 API 연동

### Phase 3: 스케줄링 (4일차)
- [ ] Delayed Job 구현 (예약 발송)
- [ ] 업무시간 분산 로직
- [ ] Daily Batch 스케줄러

### Phase 4: 모니터링 (5일차)
- [ ] Bull Board 설정
- [ ] 대시보드 라우트 추가
- [ ] 알림 설정

### Phase 5: 마이그레이션 (6일차)
- [ ] 기존 워커 비활성화
- [ ] 데이터 마이그레이션
- [ ] 통합 테스트
- [ ] 점진적 롤아웃

---

## 상세 구현 코드

### 1. 패키지 설치

```bash
cd elysia-server
bun add bullmq ioredis
bun add @bull-board/api @bull-board/hono  # 모니터링용
```

### 2. Redis 연결 설정

**파일**: `/elysia-server/src/config/redis.ts`

```typescript
import Redis from 'ioredis'
import { config } from './index'

// BullMQ용 Redis 연결
export const redisConnection = new Redis({
  host: config.redis.host || 'localhost',
  port: config.redis.port || 6379,
  password: config.redis.password,
  maxRetriesPerRequest: null, // BullMQ 요구사항
  enableReadyCheck: false,
})

// Rate Limiter용 Redis 클라이언트
export const rateLimiterRedis = new Redis({
  host: config.redis.host || 'localhost',
  port: config.redis.port || 6379,
  password: config.redis.password,
})

redisConnection.on('connect', () => {
  console.log('[Redis] BullMQ connection established')
})

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err)
})
```

### 3. 환경변수 추가

**파일**: `/elysia-server/.env` (추가)

```env
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=sendgrid_redis_password_2024

# BullMQ Configuration
BULLMQ_CONCURRENCY=5
BULLMQ_MAX_RETRIES=3
BULLMQ_RETRY_DELAY=60000

# Rate Limiting
DAILY_EMAIL_LIMIT_PER_ACCOUNT=20
WORK_HOURS_START=9
WORK_HOURS_END=18
TIMEZONE=Asia/Seoul
```

### 4. Config 업데이트

**파일**: `/elysia-server/src/config/index.ts` (추가)

```typescript
export const config = {
  // ... 기존 설정

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },

  bullmq: {
    concurrency: parseInt(process.env.BULLMQ_CONCURRENCY || '5'),
    maxRetries: parseInt(process.env.BULLMQ_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.BULLMQ_RETRY_DELAY || '60000'),
  },

  emailLimits: {
    dailyPerAccount: parseInt(process.env.DAILY_EMAIL_LIMIT_PER_ACCOUNT || '20'),
    workHoursStart: parseInt(process.env.WORK_HOURS_START || '9'),
    workHoursEnd: parseInt(process.env.WORK_HOURS_END || '18'),
    timezone: process.env.TIMEZONE || 'Asia/Seoul',
  },
}
```

### 5. 이메일 Job 타입 정의

**파일**: `/elysia-server/src/queues/types.ts`

```typescript
export interface EmailJobData {
  id: string                    // 고유 Job ID (UUID)
  emailId?: string              // DB emails 테이블 ID
  accountId: string             // 발송 계정 ID
  workspaceId: string           // 워크스페이스 ID

  // 이메일 내용
  from: {
    email: string
    name?: string
  }
  to: string
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyText?: string
  bodyHtml?: string
  attachments?: Array<{
    filename: string
    content: string
    type: string
  }>

  // 메타데이터
  leadId?: string
  sequenceId?: string
  stepId?: string

  // 스케줄링
  scheduledAt?: Date
  priority?: number             // 1-10, 높을수록 우선

  // 추적
  trackOpens?: boolean
  trackClicks?: boolean

  // 재시도
  attempt?: number
  maxAttempts?: number
}

export interface EmailJobResult {
  success: boolean
  messageId?: string
  sentAt?: Date
  error?: string
  statusCode?: number
}

export interface DailyBatchJobData {
  accountId: string
  workspaceId: string
  date: string                  // YYYY-MM-DD
  emails: EmailJobData[]
}

export type EmailQueueName =
  | 'email:immediate'
  | 'email:scheduled'
  | 'email:daily-batch'
  | 'email:failed'
```

### 6. Rate Limiter 서비스

**파일**: `/elysia-server/src/services/rate-limiter.service.ts`

```typescript
import { rateLimiterRedis } from '../config/redis'
import { config } from '../config'

export class RateLimiterService {
  private redis = rateLimiterRedis
  private dailyLimit = config.emailLimits.dailyPerAccount

  /**
   * 계정별 일일 발송 횟수 확인 및 증가
   * @returns 발송 가능 여부와 현재 카운트
   */
  async checkAndIncrement(accountId: string): Promise<{
    allowed: boolean
    current: number
    limit: number
    remaining: number
  }> {
    const today = this.getTodayKey()
    const key = `email:limit:${accountId}:${today}`

    // Lua 스크립트로 atomic하게 처리
    const script = `
      local current = redis.call('GET', KEYS[1])
      current = current and tonumber(current) or 0

      if current >= tonumber(ARGV[1]) then
        return {0, current}
      end

      local newCount = redis.call('INCR', KEYS[1])
      if newCount == 1 then
        redis.call('EXPIRE', KEYS[1], 86400)
      end

      return {1, newCount}
    `

    const result = await this.redis.eval(
      script,
      1,
      key,
      this.dailyLimit.toString()
    ) as [number, number]

    const [allowed, current] = result

    return {
      allowed: allowed === 1,
      current,
      limit: this.dailyLimit,
      remaining: Math.max(0, this.dailyLimit - current),
    }
  }

  /**
   * 현재 발송 카운트 조회 (증가 없이)
   */
  async getCurrentCount(accountId: string): Promise<number> {
    const today = this.getTodayKey()
    const key = `email:limit:${accountId}:${today}`
    const count = await this.redis.get(key)
    return count ? parseInt(count) : 0
  }

  /**
   * 남은 발송 가능 횟수 조회
   */
  async getRemainingCount(accountId: string): Promise<number> {
    const current = await this.getCurrentCount(accountId)
    return Math.max(0, this.dailyLimit - current)
  }

  /**
   * 계정별 일일 한도 상태 조회
   */
  async getAccountStatus(accountId: string): Promise<{
    accountId: string
    date: string
    sent: number
    limit: number
    remaining: number
    canSend: boolean
  }> {
    const current = await this.getCurrentCount(accountId)
    const remaining = Math.max(0, this.dailyLimit - current)

    return {
      accountId,
      date: this.getTodayKey(),
      sent: current,
      limit: this.dailyLimit,
      remaining,
      canSend: remaining > 0,
    }
  }

  /**
   * 수동으로 카운트 리셋 (관리자용)
   */
  async resetCount(accountId: string): Promise<void> {
    const today = this.getTodayKey()
    const key = `email:limit:${accountId}:${today}`
    await this.redis.del(key)
  }

  /**
   * 여러 계정의 상태 일괄 조회
   */
  async getMultipleAccountStatus(accountIds: string[]): Promise<Map<string, {
    sent: number
    remaining: number
  }>> {
    const today = this.getTodayKey()
    const pipeline = this.redis.pipeline()

    for (const accountId of accountIds) {
      pipeline.get(`email:limit:${accountId}:${today}`)
    }

    const results = await pipeline.exec()
    const statusMap = new Map()

    accountIds.forEach((accountId, index) => {
      const [err, count] = results![index]
      const sent = count ? parseInt(count as string) : 0
      statusMap.set(accountId, {
        sent,
        remaining: Math.max(0, this.dailyLimit - sent),
      })
    })

    return statusMap
  }

  private getTodayKey(): string {
    // KST 기준 날짜
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstDate = new Date(now.getTime() + kstOffset)
    return kstDate.toISOString().split('T')[0]
  }
}

export const rateLimiterService = new RateLimiterService()
```

### 7. Email Queue Service

**파일**: `/elysia-server/src/queues/email-queue.service.ts`

```typescript
import { Queue, QueueEvents, JobsOptions } from 'bullmq'
import { redisConnection } from '../config/redis'
import { config } from '../config'
import { rateLimiterService } from '../services/rate-limiter.service'
import { EmailJobData, EmailQueueName } from './types'
import { v4 as uuidv4 } from 'uuid'

export class EmailQueueService {
  private queues: Map<EmailQueueName, Queue> = new Map()
  private queueEvents: Map<EmailQueueName, QueueEvents> = new Map()

  constructor() {
    this.initializeQueues()
  }

  private initializeQueues() {
    const queueNames: EmailQueueName[] = [
      'email:immediate',
      'email:scheduled',
      'email:daily-batch',
      'email:failed',
    ]

    for (const name of queueNames) {
      const queue = new Queue(name, {
        connection: redisConnection,
        defaultJobOptions: this.getDefaultOptions(name),
      })

      const events = new QueueEvents(name, {
        connection: redisConnection,
      })

      this.queues.set(name, queue)
      this.queueEvents.set(name, events)

      // 이벤트 리스너
      events.on('completed', ({ jobId, returnvalue }) => {
        console.log(`[${name}] Job ${jobId} completed:`, returnvalue)
      })

      events.on('failed', ({ jobId, failedReason }) => {
        console.error(`[${name}] Job ${jobId} failed:`, failedReason)
      })
    }

    console.log('[EmailQueueService] All queues initialized')
  }

  private getDefaultOptions(queueName: EmailQueueName): JobsOptions {
    const baseOptions: JobsOptions = {
      attempts: config.bullmq.maxRetries,
      backoff: {
        type: 'exponential',
        delay: config.bullmq.retryDelay,
      },
      removeOnComplete: {
        age: 24 * 3600,     // 24시간 후 삭제
        count: 1000,        // 최대 1000개 유지
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // 7일 후 삭제
      },
    }

    // 큐별 추가 옵션
    if (queueName === 'email:immediate') {
      return {
        ...baseOptions,
        priority: 1, // 높은 우선순위
      }
    }

    return baseOptions
  }

  /**
   * 즉시 이메일 발송 큐에 추가
   */
  async addImmediateEmail(data: Omit<EmailJobData, 'id'>): Promise<{
    success: boolean
    jobId?: string
    error?: string
    rateLimitInfo?: {
      current: number
      limit: number
      remaining: number
    }
  }> {
    // Rate Limit 체크
    const limitCheck = await rateLimiterService.checkAndIncrement(data.accountId)

    if (!limitCheck.allowed) {
      return {
        success: false,
        error: `일일 발송 한도 초과 (${limitCheck.current}/${limitCheck.limit})`,
        rateLimitInfo: {
          current: limitCheck.current,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
        },
      }
    }

    const queue = this.queues.get('email:immediate')!
    const jobData: EmailJobData = {
      ...data,
      id: uuidv4(),
      attempt: 1,
      maxAttempts: config.bullmq.maxRetries,
    }

    const job = await queue.add('send-email', jobData, {
      jobId: jobData.id,
      priority: data.priority || 5,
    })

    return {
      success: true,
      jobId: job.id,
      rateLimitInfo: {
        current: limitCheck.current,
        limit: limitCheck.limit,
        remaining: limitCheck.remaining,
      },
    }
  }

  /**
   * 예약 이메일 발송 (delayed job)
   */
  async scheduleEmail(
    data: Omit<EmailJobData, 'id'>,
    scheduledAt: Date
  ): Promise<{
    success: boolean
    jobId?: string
    error?: string
    scheduledAt?: Date
  }> {
    const now = new Date()
    const delay = scheduledAt.getTime() - now.getTime()

    if (delay < 0) {
      return {
        success: false,
        error: '예약 시간은 현재 시간 이후여야 합니다.',
      }
    }

    // 예약 시점의 Rate Limit은 실행 시점에 체크
    const queue = this.queues.get('email:scheduled')!
    const jobData: EmailJobData = {
      ...data,
      id: uuidv4(),
      scheduledAt,
      attempt: 1,
      maxAttempts: config.bullmq.maxRetries,
    }

    const job = await queue.add('send-scheduled-email', jobData, {
      jobId: jobData.id,
      delay,
      priority: data.priority || 5,
    })

    return {
      success: true,
      jobId: job.id,
      scheduledAt,
    }
  }

  /**
   * 일일 배치 스케줄링 (계정별 20개를 업무시간에 분산)
   */
  async scheduleDailyBatch(
    accountId: string,
    workspaceId: string,
    emails: Omit<EmailJobData, 'id' | 'accountId' | 'workspaceId'>[]
  ): Promise<{
    success: boolean
    scheduled: number
    skipped: number
    schedules: Array<{ jobId: string; scheduledAt: Date }>
    error?: string
  }> {
    // 남은 발송 가능 횟수 확인
    const remaining = await rateLimiterService.getRemainingCount(accountId)

    if (remaining === 0) {
      return {
        success: false,
        scheduled: 0,
        skipped: emails.length,
        schedules: [],
        error: '오늘 발송 한도가 소진되었습니다.',
      }
    }

    // 발송 가능한 개수만큼만 스케줄링
    const toSchedule = emails.slice(0, Math.min(remaining, emails.length))
    const skipped = emails.length - toSchedule.length

    // 업무시간(9-18시)에 분산 스케줄링
    const schedules = this.distributeOverWorkHours(toSchedule.length)
    const results: Array<{ jobId: string; scheduledAt: Date }> = []

    const queue = this.queues.get('email:scheduled')!

    for (let i = 0; i < toSchedule.length; i++) {
      const email = toSchedule[i]
      const scheduledAt = schedules[i]

      const jobData: EmailJobData = {
        ...email,
        id: uuidv4(),
        accountId,
        workspaceId,
        scheduledAt,
        attempt: 1,
        maxAttempts: config.bullmq.maxRetries,
      }

      const delay = scheduledAt.getTime() - Date.now()

      const job = await queue.add('send-scheduled-email', jobData, {
        jobId: jobData.id,
        delay: Math.max(0, delay),
        priority: email.priority || 5,
      })

      results.push({
        jobId: job.id!,
        scheduledAt,
      })
    }

    return {
      success: true,
      scheduled: toSchedule.length,
      skipped,
      schedules: results,
    }
  }

  /**
   * 업무시간에 균등 분산
   */
  private distributeOverWorkHours(count: number): Date[] {
    const { workHoursStart, workHoursEnd, timezone } = config.emailLimits
    const now = new Date()

    // KST 기준 현재 시간
    const kstNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const currentHour = kstNow.getHours()

    // 오늘 업무시간 내 시작점 결정
    let startHour = workHoursStart
    if (currentHour >= workHoursStart && currentHour < workHoursEnd) {
      startHour = currentHour
    } else if (currentHour >= workHoursEnd) {
      // 업무시간 종료 후 -> 다음날 9시부터
      kstNow.setDate(kstNow.getDate() + 1)
      startHour = workHoursStart
    }

    const workMinutes = (workHoursEnd - startHour) * 60
    const interval = Math.floor(workMinutes / count)

    const schedules: Date[] = []

    for (let i = 0; i < count; i++) {
      const offsetMinutes = interval * i + Math.floor(Math.random() * 5) // 약간의 랜덤성
      const scheduleTime = new Date(kstNow)
      scheduleTime.setHours(startHour, 0, 0, 0)
      scheduleTime.setMinutes(scheduleTime.getMinutes() + offsetMinutes)
      schedules.push(scheduleTime)
    }

    return schedules
  }

  /**
   * 실패한 Job 재시도 큐로 이동
   */
  async moveToFailedQueue(jobData: EmailJobData, error: string): Promise<void> {
    const queue = this.queues.get('email:failed')!

    await queue.add('retry-failed-email', {
      ...jobData,
      attempt: (jobData.attempt || 0) + 1,
      lastError: error,
      failedAt: new Date(),
    }, {
      delay: 60 * 1000, // 1분 후 재시도
    })
  }

  /**
   * 큐 상태 조회
   */
  async getQueueStatus(queueName: EmailQueueName): Promise<{
    name: string
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }> {
    const queue = this.queues.get(queueName)!

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
    }
  }

  /**
   * 모든 큐 상태 조회
   */
  async getAllQueuesStatus(): Promise<Array<{
    name: string
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }>> {
    const statuses = []

    for (const [name] of this.queues) {
      const status = await this.getQueueStatus(name)
      statuses.push(status)
    }

    return statuses
  }

  /**
   * Job 상태 조회
   */
  async getJobStatus(queueName: EmailQueueName, jobId: string): Promise<{
    id: string
    status: string
    progress: number
    data: any
    returnvalue?: any
    failedReason?: string
  } | null> {
    const queue = this.queues.get(queueName)!
    const job = await queue.getJob(jobId)

    if (!job) return null

    const state = await job.getState()

    return {
      id: job.id!,
      status: state,
      progress: job.progress as number,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    }
  }

  /**
   * Job 취소
   */
  async cancelJob(queueName: EmailQueueName, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName)!
    const job = await queue.getJob(jobId)

    if (!job) return false

    await job.remove()
    return true
  }

  /**
   * 큐에서 대기 중인 Job 목록 조회
   */
  async getWaitingJobs(
    queueName: EmailQueueName,
    start = 0,
    end = 100
  ): Promise<Array<{
    id: string
    data: EmailJobData
    timestamp: number
  }>> {
    const queue = this.queues.get(queueName)!
    const jobs = await queue.getWaiting(start, end)

    return jobs.map(job => ({
      id: job.id!,
      data: job.data as EmailJobData,
      timestamp: job.timestamp,
    }))
  }

  /**
   * 서비스 종료
   */
  async close(): Promise<void> {
    for (const [name, queue] of this.queues) {
      await queue.close()
      console.log(`[EmailQueueService] Queue ${name} closed`)
    }

    for (const [name, events] of this.queueEvents) {
      await events.close()
    }
  }

  /**
   * 큐 인스턴스 반환 (워커용)
   */
  getQueue(name: EmailQueueName): Queue {
    return this.queues.get(name)!
  }
}

// 싱글톤 인스턴스
export const emailQueueService = new EmailQueueService()
```

### 8. Email Worker

**파일**: `/elysia-server/src/workers/bullmq-email-worker.ts`

```typescript
import { Worker, Job } from 'bullmq'
import sgMail from '@sendgrid/mail'
import { redisConnection } from '../config/redis'
import { config } from '../config'
import { db } from '../db/index'
import { emails } from '../db/schema/emails'
import { userEmailAccounts } from '../db/schema/email-accounts'
import { eq } from 'drizzle-orm'
import { rateLimiterService } from '../services/rate-limiter.service'
import { emailQueueService } from '../queues/email-queue.service'
import { EmailJobData, EmailJobResult, EmailQueueName } from '../queues/types'

export class BullMQEmailWorker {
  private workers: Map<EmailQueueName, Worker> = new Map()

  constructor() {
    this.initializeWorkers()
  }

  private initializeWorkers() {
    // 즉시 발송 워커
    this.createWorker('email:immediate', this.processImmediateEmail.bind(this))

    // 예약 발송 워커
    this.createWorker('email:scheduled', this.processScheduledEmail.bind(this))

    // 일일 배치 워커
    this.createWorker('email:daily-batch', this.processDailyBatch.bind(this))

    // 실패 재시도 워커
    this.createWorker('email:failed', this.processFailedEmail.bind(this), {
      concurrency: 1, // 실패 재시도는 천천히
    })

    console.log('[BullMQEmailWorker] All workers initialized')
  }

  private createWorker(
    queueName: EmailQueueName,
    processor: (job: Job<EmailJobData>) => Promise<EmailJobResult>,
    options?: { concurrency?: number }
  ) {
    const worker = new Worker(
      queueName,
      processor,
      {
        connection: redisConnection,
        concurrency: options?.concurrency || config.bullmq.concurrency,
        limiter: queueName === 'email:immediate' ? {
          max: 10,
          duration: 60000, // 분당 10개
        } : undefined,
      }
    )

    worker.on('completed', (job, result) => {
      console.log(`[${queueName}] Job ${job.id} completed successfully`)
      this.onJobCompleted(job, result)
    })

    worker.on('failed', (job, err) => {
      console.error(`[${queueName}] Job ${job?.id} failed:`, err.message)
      if (job) {
        this.onJobFailed(job, err)
      }
    })

    worker.on('error', (err) => {
      console.error(`[${queueName}] Worker error:`, err)
    })

    this.workers.set(queueName, worker)
    console.log(`[BullMQEmailWorker] Worker for ${queueName} started`)
  }

  /**
   * 즉시 이메일 발송 처리
   */
  private async processImmediateEmail(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const { data } = job
    console.log(`[email:immediate] Processing job ${job.id} to ${data.to}`)

    try {
      // SendGrid API Key 조회
      const apiKey = await this.getAccountApiKey(data.accountId)

      if (!apiKey) {
        throw new Error(`Email account not found: ${data.accountId}`)
      }

      // SendGrid 설정
      sgMail.setApiKey(apiKey)

      // 메시지 구성
      const msg = this.buildSendGridMessage(data)

      // 발송
      const [response] = await sgMail.send(msg)
      const messageId = response.headers['x-message-id'] as string

      // DB 업데이트
      if (data.emailId) {
        await this.updateEmailStatus(data.emailId, 'sent', messageId)
      }

      return {
        success: true,
        messageId,
        sentAt: new Date(),
      }
    } catch (error: any) {
      console.error(`[email:immediate] Error:`, error.response?.body || error.message)

      // DB 업데이트
      if (data.emailId) {
        await this.updateEmailStatus(data.emailId, 'failed', undefined, error.message)
      }

      throw error
    }
  }

  /**
   * 예약 이메일 발송 처리
   */
  private async processScheduledEmail(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const { data } = job
    console.log(`[email:scheduled] Processing scheduled job ${job.id} to ${data.to}`)

    // Rate Limit 체크 (발송 시점에 체크)
    const limitCheck = await rateLimiterService.checkAndIncrement(data.accountId)

    if (!limitCheck.allowed) {
      // 다음날로 재스케줄링
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)

      await emailQueueService.scheduleEmail(data, tomorrow)

      return {
        success: false,
        error: `Rate limit exceeded. Rescheduled to ${tomorrow.toISOString()}`,
      }
    }

    // 실제 발송은 즉시 발송과 동일
    return this.processImmediateEmail(job)
  }

  /**
   * 일일 배치 처리
   */
  private async processDailyBatch(job: Job<any>): Promise<EmailJobResult> {
    const { data } = job
    console.log(`[email:daily-batch] Processing batch for account ${data.accountId}`)

    // 각 이메일을 개별 Job으로 분리하여 스케줄링
    const result = await emailQueueService.scheduleDailyBatch(
      data.accountId,
      data.workspaceId,
      data.emails
    )

    return {
      success: result.success,
      error: result.error,
    }
  }

  /**
   * 실패 이메일 재시도
   */
  private async processFailedEmail(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const { data } = job
    console.log(`[email:failed] Retrying job ${job.id} (attempt ${data.attempt})`)

    if ((data.attempt || 0) >= (data.maxAttempts || 3)) {
      // 최대 재시도 초과
      if (data.emailId) {
        await this.updateEmailStatus(
          data.emailId,
          'failed',
          undefined,
          'Max retry attempts exceeded'
        )
      }

      return {
        success: false,
        error: 'Max retry attempts exceeded',
      }
    }

    // 재시도
    return this.processImmediateEmail(job)
  }

  /**
   * SendGrid 메시지 구성
   */
  private buildSendGridMessage(data: EmailJobData): sgMail.MailDataRequired {
    const msg: any = {
      to: data.to,
      from: data.from,
      subject: data.subject || '(제목 없음)',
      trackingSettings: {
        clickTracking: { enable: data.trackClicks ?? true },
        openTracking: { enable: data.trackOpens ?? true },
      },
    }

    if (data.bodyText) msg.text = data.bodyText
    if (data.bodyHtml) msg.html = data.bodyHtml
    if (!data.bodyText && !data.bodyHtml) msg.text = '(본문 없음)'

    if (data.cc?.length) msg.cc = data.cc
    if (data.bcc?.length) msg.bcc = data.bcc

    if (data.attachments?.length) {
      msg.attachments = data.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        type: att.type,
      }))
    }

    // Custom headers for tracking
    msg.headers = {
      'X-Email-Job-Id': data.id,
      'X-Lead-Id': data.leadId || '',
      'X-Sequence-Id': data.sequenceId || '',
    }

    return msg
  }

  /**
   * 계정 API Key 조회
   */
  private async getAccountApiKey(accountId: string): Promise<string | null> {
    const [account] = await db
      .select()
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.id, accountId))
      .limit(1)

    return account?.apiKey || null
  }

  /**
   * 이메일 상태 업데이트
   */
  private async updateEmailStatus(
    emailId: string,
    status: 'sent' | 'failed',
    messageId?: string,
    error?: string
  ): Promise<void> {
    await db
      .update(emails)
      .set({
        status,
        sentAt: status === 'sent' ? new Date() : undefined,
        sendgridMessageId: messageId,
        errorMessage: error,
        updatedAt: new Date(),
      })
      .where(eq(emails.id, emailId))
  }

  /**
   * Job 완료 후 처리
   */
  private async onJobCompleted(job: Job<EmailJobData>, result: EmailJobResult) {
    // 필요시 추가 로깅, 메트릭 수집 등
    console.log(`[Worker] Job ${job.id} completed:`, {
      to: job.data.to,
      messageId: result.messageId,
      sentAt: result.sentAt,
    })
  }

  /**
   * Job 실패 후 처리
   */
  private async onJobFailed(job: Job<EmailJobData>, error: Error) {
    const data = job.data

    // 재시도 가능한 경우 실패 큐로 이동
    if ((data.attempt || 0) < (data.maxAttempts || 3)) {
      await emailQueueService.moveToFailedQueue(data, error.message)
    }
  }

  /**
   * 워커 종료
   */
  async close(): Promise<void> {
    for (const [name, worker] of this.workers) {
      await worker.close()
      console.log(`[BullMQEmailWorker] Worker ${name} closed`)
    }
  }
}

// 워커 시작 함수
let workerInstance: BullMQEmailWorker | null = null

export function startBullMQEmailWorker(): BullMQEmailWorker {
  if (!workerInstance) {
    workerInstance = new BullMQEmailWorker()
  }
  return workerInstance
}

export function stopBullMQEmailWorker(): Promise<void> {
  if (workerInstance) {
    return workerInstance.close()
  }
  return Promise.resolve()
}
```

---

## Rate Limiting 구현

### 알고리즘: Sliding Window Counter

```
┌────────────────────────────────────────────────────────────┐
│                    Rate Limiting Flow                      │
└────────────────────────────────────────────────────────────┘

1. 요청 수신
   │
   ▼
2. Redis Key 조회: email:limit:{accountId}:{YYYYMMDD}
   │
   ▼
3. 현재 카운트 확인
   │
   ├─── < 20 ───► 4a. 카운트 증가 (INCR)
   │                    │
   │                    ▼
   │              5a. 발송 허용
   │
   └─── >= 20 ──► 4b. 발송 거부
                       │
                       ▼
                 5b. 다음날 9시로 재스케줄링
```

### Redis Key 구조

```
# 일일 카운트
email:limit:{accountId}:{YYYYMMDD}
  └─ 값: integer (발송 횟수)
  └─ TTL: 86400초 (24시간)

# 예시
email:limit:acc_abc123:2025-12-16 = 15
  └─ 오늘 15개 발송됨, 5개 남음
```

### Lua 스크립트 (Atomic Operation)

```lua
-- Rate Limit Check & Increment
local current = redis.call('GET', KEYS[1])
current = current and tonumber(current) or 0

-- 한도 초과 시 거부
if current >= tonumber(ARGV[1]) then
  return {0, current}  -- {allowed=false, count}
end

-- 카운트 증가
local newCount = redis.call('INCR', KEYS[1])

-- 첫 발송 시 만료 시간 설정
if newCount == 1 then
  redis.call('EXPIRE', KEYS[1], 86400)
end

return {1, newCount}  -- {allowed=true, count}
```

---

## 모니터링 (Bull Board)

### 설정

**파일**: `/elysia-server/src/routes/bull-board.routes.ts`

```typescript
import { Elysia } from 'elysia'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { HonoAdapter } from '@bull-board/hono'
import { emailQueueService } from '../queues/email-queue.service'

export const bullBoardRoutes = new Elysia({ prefix: '/admin/queues' })

// Bull Board 설정
const serverAdapter = new HonoAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueueService.getQueue('email:immediate')),
    new BullMQAdapter(emailQueueService.getQueue('email:scheduled')),
    new BullMQAdapter(emailQueueService.getQueue('email:daily-batch')),
    new BullMQAdapter(emailQueueService.getQueue('email:failed')),
  ],
  serverAdapter,
})

// 라우트 통합
bullBoardRoutes.get('/*', async ({ request }) => {
  // Hono adapter 핸들러 호출
  return serverAdapter.getRouter().fetch(request)
})
```

### 대시보드 접속

```
URL: https://your-domain.com/admin/queues
```

### 대시보드 기능

- 실시간 큐 상태 확인
- Job 상세 조회
- 실패한 Job 재시도
- Job 삭제
- 큐 일시정지/재개

---

## 마이그레이션 전략

### Phase 1: 병렬 운영 (1주)

```typescript
// 기존 워커 유지 + BullMQ 워커 추가
if (!isDevelopment) {
  // 기존
  startScheduledEmailWorker()
  startEmailSequenceWorker()

  // 신규 (점진적 활성화)
  if (config.features.useBullMQ) {
    startBullMQEmailWorker()
  }
}
```

### Phase 2: 트래픽 분리 (1주)

```typescript
// 새 이메일만 BullMQ로
async function sendEmail(data: EmailData) {
  if (config.features.useBullMQ) {
    return emailQueueService.addImmediateEmail(data)
  }

  // 기존 방식
  return legacySendEmail(data)
}
```

### Phase 3: 완전 전환

```typescript
// 기존 워커 제거
// startScheduledEmailWorker()  // 삭제
// startEmailSequenceWorker()   // 삭제

startBullMQEmailWorker()
```

### 데이터 마이그레이션

```sql
-- 기존 예약된 이메일을 BullMQ로 이전
-- (별도 마이그레이션 스크립트 실행)
SELECT * FROM emails
WHERE status = 'scheduled'
AND scheduled_at > NOW();
```

---

## 테스트 계획

### 1. 단위 테스트

```typescript
// rate-limiter.service.test.ts
describe('RateLimiterService', () => {
  it('should allow first 20 emails', async () => {
    for (let i = 0; i < 20; i++) {
      const result = await rateLimiterService.checkAndIncrement('test-account')
      expect(result.allowed).toBe(true)
    }
  })

  it('should reject 21st email', async () => {
    // ... 20개 발송 후
    const result = await rateLimiterService.checkAndIncrement('test-account')
    expect(result.allowed).toBe(false)
    expect(result.current).toBe(20)
  })
})
```

### 2. 통합 테스트

```typescript
// email-queue.service.test.ts
describe('EmailQueueService', () => {
  it('should schedule daily batch within work hours', async () => {
    const emails = Array(20).fill({
      to: 'test@example.com',
      subject: 'Test',
      bodyText: 'Test body',
    })

    const result = await emailQueueService.scheduleDailyBatch(
      'account-1',
      'workspace-1',
      emails
    )

    expect(result.scheduled).toBe(20)

    // 모든 스케줄이 업무시간 내인지 확인
    for (const schedule of result.schedules) {
      const hour = schedule.scheduledAt.getHours()
      expect(hour).toBeGreaterThanOrEqual(9)
      expect(hour).toBeLessThan(18)
    }
  })
})
```

### 3. 부하 테스트

```bash
# k6 또는 Artillery로 부하 테스트
# 100개 계정 × 20개 이메일 = 2000개 동시 스케줄링
k6 run load-test.js
```

---

## 운영 가이드

### 환경변수 체크리스트

```env
# 필수
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# BullMQ
BULLMQ_CONCURRENCY=5
BULLMQ_MAX_RETRIES=3
BULLMQ_RETRY_DELAY=60000

# Rate Limiting
DAILY_EMAIL_LIMIT_PER_ACCOUNT=20
WORK_HOURS_START=9
WORK_HOURS_END=18
TIMEZONE=Asia/Seoul
```

### 모니터링 체크리스트

- [ ] Bull Board 접속 확인
- [ ] 큐 상태 정상 확인
- [ ] 실패율 < 5% 확인
- [ ] Redis 메모리 사용량 확인
- [ ] 워커 응답 시간 확인

### 알림 설정

```typescript
// 실패율 50% 이상 시 알림
// 큐 대기 1000개 이상 시 알림
// 워커 5분 이상 무응답 시 알림
```

### 롤백 절차

```bash
# 1. BullMQ 워커 중지
docker-compose stop elysia-server

# 2. 환경변수에서 BullMQ 비활성화
# USE_BULLMQ=false

# 3. 서버 재시작 (기존 워커 사용)
docker-compose up -d elysia-server

# 4. 큐에 남은 Job 확인 및 처리
# Bull Board에서 수동 처리 또는 마이그레이션 스크립트 실행
```

---

## 체크리스트

### 개발 단계
- [ ] BullMQ 패키지 설치
- [ ] Redis 연결 설정
- [ ] 환경변수 추가
- [ ] RateLimiterService 구현
- [ ] EmailQueueService 구현
- [ ] BullMQEmailWorker 구현
- [ ] Bull Board 설정
- [ ] API 라우트 수정

### 테스트 단계
- [ ] 단위 테스트 작성 및 통과
- [ ] 통합 테스트 작성 및 통과
- [ ] Rate Limit 테스트 (20개 제한)
- [ ] 업무시간 분산 테스트
- [ ] 실패 재시도 테스트
- [ ] 부하 테스트

### 배포 단계
- [ ] 스테이징 환경 테스트
- [ ] 병렬 운영 시작
- [ ] 트래픽 분리 (10% → 50% → 100%)
- [ ] 기존 워커 비활성화
- [ ] 프로덕션 모니터링

### 운영 단계
- [ ] Bull Board 모니터링
- [ ] 알림 설정
- [ ] 문서화 완료
- [ ] 팀 교육

---

## 참고 자료

### 공식 문서
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Bull Board](https://github.com/felixmosh/bull-board)
- [Redis Documentation](https://redis.io/documentation)

### 관련 파일
- `/elysia-server/src/workers/scheduled-email-worker.ts` (기존 워커)
- `/elysia-server/src/services/email.service.ts` (이메일 서비스)
- `/elysia-server/src/db/schema/emails.ts` (DB 스키마)

### 아키텍처 결정 기록
- 2025-12-16: PostgreSQL 폴링 → BullMQ 전환 결정
- 이유: Rate Limiting 필요, 실시간성 향상, 확장성 확보
