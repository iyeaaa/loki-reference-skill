# BullMQ Email Scheduling System Implementation Plan

## Table of Contents
1. [Overview](#overview)
2. [Current System Analysis](#current-system-analysis)
3. [BullMQ Architecture Design](#bullmq-architecture-design)
4. [Implementation Phases](#implementation-phases)
5. [Detailed Implementation Code](#detailed-implementation-code)
6. [Rate Limiting Implementation](#rate-limiting-implementation)
7. [Monitoring (Bull Board)](#monitoring-bull-board)
8. [Migration Strategy](#migration-strategy)
9. [Testing Plan](#testing-plan)
10. [Operations Guide](#operations-guide)

---

## Overview

### Goals
- Implement per-account daily limit of 20 emails
- Distribute sending across business hours (9AM-6PM KST)
- Real-time queue monitoring
- Reliable retry and failure handling

### Technology Stack
| Component | Technology | Version |
|-----------|------------|---------|
| Message Queue | BullMQ | ^5.x |
| Cache/Broker | Redis | 7.4 (existing) |
| Runtime | Bun | 1.x |
| Framework | Elysia | 1.x |
| Database | PostgreSQL | 17.2 (existing) |
| Monitoring | Bull Board | ^5.x |

---

## Current System Analysis

### Existing Architecture (PostgreSQL Polling)
```
┌─────────────────┐
│   API Server    │
└────────┬────────┘
         │ INSERT (status='scheduled')
         ▼
┌─────────────────────────────────────┐
│   PostgreSQL                        │
│   emails table                      │
│   - Poll every 30 seconds           │
│   - FOR UPDATE SKIP LOCKED          │
└────────┬────────────────────────────┘
         │ SELECT (scheduledAt <= now)
         ▼
┌─────────────────────────────────────┐
│   scheduled-email-worker.ts         │
│   - setInterval 30 seconds          │
│   - Batch process 100 at a time     │
└─────────────────────────────────────┘
```

### Limitations of Current Approach
1. **No Rate Limiting**: Cannot limit per-account sending
2. **Latency**: Up to 30 second delay
3. **Limited Scalability**: Single worker, difficult concurrency control
4. **No Monitoring**: Cannot check real-time queue status

---

## BullMQ Architecture Design

### New Architecture
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
│  - addEmailJob(): Immediate send                                    │
│  - scheduleEmail(): Scheduled send (delayed)                        │
│  - scheduleDailyBatch(): Daily batch (20 per account)               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BullMQ Queues (Redis)                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  email:immediate │  │  email:scheduled │  │  email:daily     │  │
│  │  (immediate)     │  │  (scheduled)     │  │  (daily batch)   │  │
│  │  limiter: 10/min │  │  delayed jobs    │  │  repeatable      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Rate Limiter (Redis)                             │
│  Key: email:limit:{accountId}:{YYYYMMDD}                            │
│  - 20 per account per day limit                                     │
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
│  - Actual email delivery                                            │
│  - Receive results via Webhook                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL (for records)                       │
│  - Store delivery results                                           │
│  - Statistics and history                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Queue Design

| Queue Name | Purpose | Rate Limit | Retries |
|------------|---------|------------|---------|
| `email:immediate` | Immediate send | 10/min | 3 |
| `email:scheduled` | Scheduled send | 20/day per account | 3 |
| `email:daily-batch` | Daily batch | 20/day per account | 3 |
| `email:failed` | Failed retry | 1/min | 5 |

---

## Implementation Phases

### Phase 1: Basic Setup (Day 1)
- [ ] Install BullMQ packages
- [ ] Configure Redis connection
- [ ] Create basic queues
- [ ] Write basic worker structure

### Phase 2: Core Features (Days 2-3)
- [ ] Implement Email Queue Service
- [ ] Implement Rate Limiter (20 per account per day)
- [ ] Implement Email Worker
- [ ] Integrate with existing API

### Phase 3: Scheduling (Day 4)
- [ ] Implement Delayed Jobs (scheduled send)
- [ ] Business hours distribution logic
- [ ] Daily Batch scheduler

### Phase 4: Monitoring (Day 5)
- [ ] Configure Bull Board
- [ ] Add dashboard routes
- [ ] Set up alerts

### Phase 5: Migration (Day 6)
- [ ] Disable existing workers
- [ ] Data migration
- [ ] Integration testing
- [ ] Gradual rollout

---

## Detailed Implementation Code

### 1. Package Installation

```bash
cd elysia-server
bun add bullmq ioredis
bun add @bull-board/api @bull-board/hono  # for monitoring
```

### 2. Redis Connection Configuration

**File**: `/elysia-server/src/config/redis.ts`

```typescript
import Redis from 'ioredis'
import { config } from './index'

// Redis connection for BullMQ
export const redisConnection = new Redis({
  host: config.redis.host || 'localhost',
  port: config.redis.port || 6379,
  password: config.redis.password,
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: false,
})

// Redis client for Rate Limiter
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

### 3. Environment Variables

**File**: `/elysia-server/.env` (additions)

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

### 4. Config Update

**File**: `/elysia-server/src/config/index.ts` (additions)

```typescript
export const config = {
  // ... existing config

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

### 5. Email Job Type Definitions

**File**: `/elysia-server/src/queues/types.ts`

```typescript
export interface EmailJobData {
  id: string                    // Unique Job ID (UUID)
  emailId?: string              // DB emails table ID
  accountId: string             // Sending account ID
  workspaceId: string           // Workspace ID

  // Email content
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

  // Metadata
  leadId?: string
  sequenceId?: string
  stepId?: string

  // Scheduling
  scheduledAt?: Date
  priority?: number             // 1-10, higher = more priority

  // Tracking
  trackOpens?: boolean
  trackClicks?: boolean

  // Retry
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

### 6. Rate Limiter Service

**File**: `/elysia-server/src/services/rate-limiter.service.ts`

```typescript
import { rateLimiterRedis } from '../config/redis'
import { config } from '../config'

export class RateLimiterService {
  private redis = rateLimiterRedis
  private dailyLimit = config.emailLimits.dailyPerAccount

  /**
   * Check and increment per-account daily send count
   * @returns Whether sending is allowed and current count
   */
  async checkAndIncrement(accountId: string): Promise<{
    allowed: boolean
    current: number
    limit: number
    remaining: number
  }> {
    const today = this.getTodayKey()
    const key = `email:limit:${accountId}:${today}`

    // Atomic operation using Lua script
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
   * Get current send count (without incrementing)
   */
  async getCurrentCount(accountId: string): Promise<number> {
    const today = this.getTodayKey()
    const key = `email:limit:${accountId}:${today}`
    const count = await this.redis.get(key)
    return count ? parseInt(count) : 0
  }

  /**
   * Get remaining send count
   */
  async getRemainingCount(accountId: string): Promise<number> {
    const current = await this.getCurrentCount(accountId)
    return Math.max(0, this.dailyLimit - current)
  }

  /**
   * Get account daily limit status
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
   * Manual count reset (admin use)
   */
  async resetCount(accountId: string): Promise<void> {
    const today = this.getTodayKey()
    const key = `email:limit:${accountId}:${today}`
    await this.redis.del(key)
  }

  /**
   * Bulk status query for multiple accounts
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
    // Date in KST
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstDate = new Date(now.getTime() + kstOffset)
    return kstDate.toISOString().split('T')[0]
  }
}

export const rateLimiterService = new RateLimiterService()
```

### 7. Email Queue Service

**File**: `/elysia-server/src/queues/email-queue.service.ts`

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

      // Event listeners
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
        age: 24 * 3600,     // Remove after 24 hours
        count: 1000,        // Keep max 1000
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Remove after 7 days
      },
    }

    // Additional options per queue
    if (queueName === 'email:immediate') {
      return {
        ...baseOptions,
        priority: 1, // High priority
      }
    }

    return baseOptions
  }

  /**
   * Add to immediate email send queue
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
    // Rate Limit check
    const limitCheck = await rateLimiterService.checkAndIncrement(data.accountId)

    if (!limitCheck.allowed) {
      return {
        success: false,
        error: `Daily send limit exceeded (${limitCheck.current}/${limitCheck.limit})`,
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
   * Schedule email send (delayed job)
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
        error: 'Scheduled time must be in the future.',
      }
    }

    // Rate limit check will be done at execution time
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
   * Daily batch scheduling (distribute 20 per account across business hours)
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
    // Check remaining send count
    const remaining = await rateLimiterService.getRemainingCount(accountId)

    if (remaining === 0) {
      return {
        success: false,
        scheduled: 0,
        skipped: emails.length,
        schedules: [],
        error: 'Daily send limit exhausted.',
      }
    }

    // Schedule only as many as remaining limit allows
    const toSchedule = emails.slice(0, Math.min(remaining, emails.length))
    const skipped = emails.length - toSchedule.length

    // Distribute across business hours (9-18)
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
   * Evenly distribute across business hours
   */
  private distributeOverWorkHours(count: number): Date[] {
    const { workHoursStart, workHoursEnd, timezone } = config.emailLimits
    const now = new Date()

    // Current time in KST
    const kstNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const currentHour = kstNow.getHours()

    // Determine start point within today's business hours
    let startHour = workHoursStart
    if (currentHour >= workHoursStart && currentHour < workHoursEnd) {
      startHour = currentHour
    } else if (currentHour >= workHoursEnd) {
      // After business hours -> start from 9AM next day
      kstNow.setDate(kstNow.getDate() + 1)
      startHour = workHoursStart
    }

    const workMinutes = (workHoursEnd - startHour) * 60
    const interval = Math.floor(workMinutes / count)

    const schedules: Date[] = []

    for (let i = 0; i < count; i++) {
      const offsetMinutes = interval * i + Math.floor(Math.random() * 5) // slight randomness
      const scheduleTime = new Date(kstNow)
      scheduleTime.setHours(startHour, 0, 0, 0)
      scheduleTime.setMinutes(scheduleTime.getMinutes() + offsetMinutes)
      schedules.push(scheduleTime)
    }

    return schedules
  }

  /**
   * Move failed job to failed queue
   */
  async moveToFailedQueue(jobData: EmailJobData, error: string): Promise<void> {
    const queue = this.queues.get('email:failed')!

    await queue.add('retry-failed-email', {
      ...jobData,
      attempt: (jobData.attempt || 0) + 1,
      lastError: error,
      failedAt: new Date(),
    }, {
      delay: 60 * 1000, // Retry after 1 minute
    })
  }

  /**
   * Get queue status
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
   * Get all queues status
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
   * Get job status
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
   * Cancel job
   */
  async cancelJob(queueName: EmailQueueName, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName)!
    const job = await queue.getJob(jobId)

    if (!job) return false

    await job.remove()
    return true
  }

  /**
   * Get waiting jobs list
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
   * Close service
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
   * Return queue instance (for workers)
   */
  getQueue(name: EmailQueueName): Queue {
    return this.queues.get(name)!
  }
}

// Singleton instance
export const emailQueueService = new EmailQueueService()
```

### 8. Email Worker

**File**: `/elysia-server/src/workers/bullmq-email-worker.ts`

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
    // Immediate send worker
    this.createWorker('email:immediate', this.processImmediateEmail.bind(this))

    // Scheduled send worker
    this.createWorker('email:scheduled', this.processScheduledEmail.bind(this))

    // Daily batch worker
    this.createWorker('email:daily-batch', this.processDailyBatch.bind(this))

    // Failed retry worker
    this.createWorker('email:failed', this.processFailedEmail.bind(this), {
      concurrency: 1, // Slow retry for failed
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
          duration: 60000, // 10 per minute
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
   * Process immediate email send
   */
  private async processImmediateEmail(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const { data } = job
    console.log(`[email:immediate] Processing job ${job.id} to ${data.to}`)

    try {
      // Get SendGrid API Key
      const apiKey = await this.getAccountApiKey(data.accountId)

      if (!apiKey) {
        throw new Error(`Email account not found: ${data.accountId}`)
      }

      // Configure SendGrid
      sgMail.setApiKey(apiKey)

      // Build message
      const msg = this.buildSendGridMessage(data)

      // Send
      const [response] = await sgMail.send(msg)
      const messageId = response.headers['x-message-id'] as string

      // Update DB
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

      // Update DB
      if (data.emailId) {
        await this.updateEmailStatus(data.emailId, 'failed', undefined, error.message)
      }

      throw error
    }
  }

  /**
   * Process scheduled email send
   */
  private async processScheduledEmail(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const { data } = job
    console.log(`[email:scheduled] Processing scheduled job ${job.id} to ${data.to}`)

    // Rate Limit check (at send time)
    const limitCheck = await rateLimiterService.checkAndIncrement(data.accountId)

    if (!limitCheck.allowed) {
      // Reschedule to next day
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)

      await emailQueueService.scheduleEmail(data, tomorrow)

      return {
        success: false,
        error: `Rate limit exceeded. Rescheduled to ${tomorrow.toISOString()}`,
      }
    }

    // Actual send same as immediate
    return this.processImmediateEmail(job)
  }

  /**
   * Process daily batch
   */
  private async processDailyBatch(job: Job<any>): Promise<EmailJobResult> {
    const { data } = job
    console.log(`[email:daily-batch] Processing batch for account ${data.accountId}`)

    // Split into individual jobs for scheduling
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
   * Retry failed email
   */
  private async processFailedEmail(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const { data } = job
    console.log(`[email:failed] Retrying job ${job.id} (attempt ${data.attempt})`)

    if ((data.attempt || 0) >= (data.maxAttempts || 3)) {
      // Max retries exceeded
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

    // Retry
    return this.processImmediateEmail(job)
  }

  /**
   * Build SendGrid message
   */
  private buildSendGridMessage(data: EmailJobData): sgMail.MailDataRequired {
    const msg: any = {
      to: data.to,
      from: data.from,
      subject: data.subject || '(No subject)',
      trackingSettings: {
        clickTracking: { enable: data.trackClicks ?? true },
        openTracking: { enable: data.trackOpens ?? true },
      },
    }

    if (data.bodyText) msg.text = data.bodyText
    if (data.bodyHtml) msg.html = data.bodyHtml
    if (!data.bodyText && !data.bodyHtml) msg.text = '(No body)'

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
   * Get account API Key
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
   * Update email status
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
   * Post-completion handler
   */
  private async onJobCompleted(job: Job<EmailJobData>, result: EmailJobResult) {
    console.log(`[Worker] Job ${job.id} completed:`, {
      to: job.data.to,
      messageId: result.messageId,
      sentAt: result.sentAt,
    })
  }

  /**
   * Post-failure handler
   */
  private async onJobFailed(job: Job<EmailJobData>, error: Error) {
    const data = job.data

    // Move to failed queue if retryable
    if ((data.attempt || 0) < (data.maxAttempts || 3)) {
      await emailQueueService.moveToFailedQueue(data, error.message)
    }
  }

  /**
   * Close workers
   */
  async close(): Promise<void> {
    for (const [name, worker] of this.workers) {
      await worker.close()
      console.log(`[BullMQEmailWorker] Worker ${name} closed`)
    }
  }
}

// Start worker function
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

## Rate Limiting Implementation

### Algorithm: Sliding Window Counter

```
┌────────────────────────────────────────────────────────────┐
│                    Rate Limiting Flow                      │
└────────────────────────────────────────────────────────────┘

1. Request received
   │
   ▼
2. Query Redis Key: email:limit:{accountId}:{YYYYMMDD}
   │
   ▼
3. Check current count
   │
   ├─── < 20 ───► 4a. Increment count (INCR)
   │                    │
   │                    ▼
   │              5a. Allow send
   │
   └─── >= 20 ──► 4b. Reject send
                       │
                       ▼
                 5b. Reschedule to 9AM next day
```

### Redis Key Structure

```
# Daily count
email:limit:{accountId}:{YYYYMMDD}
  └─ Value: integer (send count)
  └─ TTL: 86400 seconds (24 hours)

# Example
email:limit:acc_abc123:2025-12-16 = 15
  └─ 15 sent today, 5 remaining
```

---

## Monitoring (Bull Board)

### Setup

**File**: `/elysia-server/src/routes/bull-board.routes.ts`

```typescript
import { Elysia } from 'elysia'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { HonoAdapter } from '@bull-board/hono'
import { emailQueueService } from '../queues/email-queue.service'

export const bullBoardRoutes = new Elysia({ prefix: '/admin/queues' })

// Bull Board setup
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

// Route integration
bullBoardRoutes.get('/*', async ({ request }) => {
  return serverAdapter.getRouter().fetch(request)
})
```

### Dashboard Access

```
URL: https://your-domain.com/admin/queues
```

---

## Migration Strategy

### Phase 1: Parallel Operation (1 week)

```typescript
// Keep existing worker + add BullMQ worker
if (!isDevelopment) {
  // Existing
  startScheduledEmailWorker()
  startEmailSequenceWorker()

  // New (gradual activation)
  if (config.features.useBullMQ) {
    startBullMQEmailWorker()
  }
}
```

### Phase 2: Traffic Split (1 week)

```typescript
// Only new emails go to BullMQ
async function sendEmail(data: EmailData) {
  if (config.features.useBullMQ) {
    return emailQueueService.addImmediateEmail(data)
  }

  // Legacy method
  return legacySendEmail(data)
}
```

### Phase 3: Full Migration

```typescript
// Remove existing workers
// startScheduledEmailWorker()  // Delete
// startEmailSequenceWorker()   // Delete

startBullMQEmailWorker()
```

---

## Testing Plan

### 1. Unit Tests

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
    // After sending 20...
    const result = await rateLimiterService.checkAndIncrement('test-account')
    expect(result.allowed).toBe(false)
    expect(result.current).toBe(20)
  })
})
```

### 2. Integration Tests

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

    // Verify all schedules are within business hours
    for (const schedule of result.schedules) {
      const hour = schedule.scheduledAt.getHours()
      expect(hour).toBeGreaterThanOrEqual(9)
      expect(hour).toBeLessThan(18)
    }
  })
})
```

---

## Operations Guide

### Environment Variables Checklist

```env
# Required
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

### Monitoring Checklist

- [ ] Bull Board access verified
- [ ] Queue status normal
- [ ] Failure rate < 5%
- [ ] Redis memory usage checked
- [ ] Worker response time checked

### Rollback Procedure

```bash
# 1. Stop BullMQ worker
docker-compose stop elysia-server

# 2. Disable BullMQ in environment
# USE_BULLMQ=false

# 3. Restart server (use existing workers)
docker-compose up -d elysia-server

# 4. Check and process remaining jobs in queue
# Manual processing via Bull Board or migration script
```

---

## Checklist

### Development Phase
- [ ] Install BullMQ packages
- [ ] Configure Redis connection
- [ ] Add environment variables
- [ ] Implement RateLimiterService
- [ ] Implement EmailQueueService
- [ ] Implement BullMQEmailWorker
- [ ] Configure Bull Board
- [ ] Update API routes

### Testing Phase
- [ ] Write and pass unit tests
- [ ] Write and pass integration tests
- [ ] Rate limit test (20 limit)
- [ ] Business hours distribution test
- [ ] Failure retry test
- [ ] Load test

### Deployment Phase
- [ ] Staging environment test
- [ ] Start parallel operation
- [ ] Traffic split (10% → 50% → 100%)
- [ ] Disable existing workers
- [ ] Production monitoring

### Operations Phase
- [ ] Bull Board monitoring
- [ ] Alert setup
- [ ] Documentation complete
- [ ] Team training

---

## References

### Official Documentation
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Bull Board](https://github.com/felixmosh/bull-board)
- [Redis Documentation](https://redis.io/documentation)

### Related Files
- `/elysia-server/src/workers/scheduled-email-worker.ts` (existing worker)
- `/elysia-server/src/services/email.service.ts` (email service)
- `/elysia-server/src/db/schema/emails.ts` (DB schema)

### Architecture Decision Records
- 2025-12-16: Decision to migrate from PostgreSQL polling to BullMQ
- Reason: Rate Limiting needed, improved real-time performance, scalability
