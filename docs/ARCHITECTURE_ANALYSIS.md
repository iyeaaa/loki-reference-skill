# 백엔드 아키텍처 분석 및 개선 방안

## 📊 프로젝트 개요

- **프레임워크**: Elysia.js (Bun 런타임)
- **ORM**: Drizzle ORM
- **데이터베이스**: PostgreSQL
- **주요 기능**: SendGrid 기반 이메일 마케팅 자동화 (워크플로우, 시퀀스, AI 자동 답장)
- **코드 규모**: ~15,945 라인
- **배포**: AWS EC2 + Docker Compose
- **개발팀**: 2명 (한국 AI 스타트업)

## 🎯 현재 아키텍처 특징

### ✅ 잘하고 있는 부분

1. **모듈화된 구조** - routes/services/workers 분리
2. **타입 안정성** - TypeScript + Drizzle ORM
3. **CI/CD 파이프라인** - GitHub Actions로 자동 배포
4. **에러 핸들링** - 중앙화된 에러 처리 플러그인
5. **워커 시스템** - 백그라운드 이메일 발송 처리
6. **API 문서화** - Swagger 통합

## 🚨 개선이 필요한 부분 (우선순위순)

### 1. 테스트 부재 (Critical)

**문제점:**
- 테스트 파일 0개
- 버그 발견 지연, 리팩토링 위험, 배포 불안정성

**글로벌 베스트 프랙티스:**
- **Stripe**: 80%+ 테스트 커버리지
- **Shopify**: TDD 문화, 모든 PR에 테스트 필수
- **GitHub**: 유닛/통합/E2E 테스트 3-tier 구조

**개선 방안:**

```json
// package.json에 추가
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  },
  "devDependencies": {
    "@testcontainers/postgresql": "^10.0.0",
    "bun:test": "latest"
  }
}
```

```typescript
// src/services/__tests__/email.service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { emailService } from '../email.service'

describe('EmailService', () => {
  it('should send email successfully', async () => {
    const result = await emailService.sendEmail({
      fromEmail: 'test@example.com',
      toEmail: 'user@example.com',
      subject: 'Test',
      bodyText: 'Hello'
    })
    expect(result.success).toBe(true)
  })
})
```

**우선순위 테스트 대상:**
1. `email.service.ts` - 핵심 비즈니스 로직
2. `workflow-execution.service.ts` - 복잡한 워크플로우 로직
3. `auth.service.ts` - 보안 관련 로직

---

### 2. 환경 설정 관리 (High)

**현재 문제점:**

```typescript
// src/config.ts - 너무 단순함
export const config = {
  port: process.env.PORT || 3001,
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: "rinda@send.grinda.ai", // ❌ 하드코딩
  },
}
```

**글로벌 베스트 프랙티스:**
- **Vercel**: 환경별 설정 분리 + 검증
- **Linear**: Zod를 이용한 환경변수 스키마 검증

**개선 방안:**

```bash
# 패키지 설치
bun add zod
```

```typescript
// src/config/index.ts
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),

  // Database
  DATABASE_URL: z.string().url(),
  DB_POOL_MIN: z.string().transform(Number).default('2'),
  DB_POOL_MAX: z.string().transform(Number).default('10'),

  // SendGrid
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_FROM_EMAIL: z.string().email(),
  SENDGRID_FROM_NAME: z.string(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    process.exit(1)
  }
}

export const config = validateEnv()

// 환경별 설정
export const isDevelopment = config.NODE_ENV === 'development'
export const isProduction = config.NODE_ENV === 'production'
export const isTest = config.NODE_ENV === 'test'
```

---

### 3. 로깅 및 모니터링 개선 (High)

**현재 상태:**
- 기본 pino 설정만 있음
- 민감 정보 마스킹 없음
- 요청 추적 ID 없음

**글로벌 베스트 프랙티스:**
- **Datadog**: 구조화된 로깅 + 분산 추적
- **Sentry**: 에러 추적 + 성능 모니터링
- **Vercel**: Edge 로깅 + 실시간 대시보드

**개선 방안:**

```typescript
// src/utils/logger.ts
import pino from 'pino'
import { config } from '../config'

export const logger = pino({
  level: config.LOG_LEVEL,

  // 프로덕션 환경에서 JSON으로 구조화된 로그 출력
  transport: config.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false,
    }
  },

  // 추가 컨텍스트
  base: {
    env: config.NODE_ENV,
    service: 'elysia-server',
  },

  // 로그에 요청 ID 추가
  formatters: {
    level: (label) => ({ level: label }),
  },

  // 민감 정보 마스킹
  redact: {
    paths: ['password', 'passwordHash', 'apiKey', 'token', '*.password', '*.apiKey'],
    censor: '[REDACTED]',
  },
})

// 요청 추적을 위한 컨텍스트 로거
export const createRequestLogger = (requestId: string) => {
  return logger.child({ requestId })
}

export default logger
```

**Sentry 통합:**

```bash
bun add @sentry/bun
```

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/bun'
import { config } from '../config'

export function initSentry() {
  if (!config.SENTRY_DSN) return

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
  })
}
```

**헬스체크 개선:**

```typescript
// src/routes/health.routes.ts
import { Elysia } from 'elysia'
import { db } from '../db'

async function checkDatabase() {
  try {
    await db.execute('SELECT 1')
    return true
  } catch {
    return false
  }
}

export const healthRoutes = new Elysia({ prefix: '/health' })
  .get('/', async () => {
    const dbCheck = await checkDatabase()

    return {
      status: dbCheck ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      checks: {
        database: dbCheck ? 'up' : 'down',
      }
    }
  })
  .get('/ready', async () => {
    // Kubernetes readiness probe
    const dbCheck = await checkDatabase()

    if (!dbCheck) {
      throw new Error('Service not ready')
    }

    return { ready: true }
  })
  .get('/live', () => {
    // Kubernetes liveness probe
    return { alive: true }
  })
```

---

### 4. 데이터베이스 최적화 (High)

**현재 문제점:**

```typescript
// 1. 커넥션 풀 설정이 없음
const pool = new Pool({ connectionString }) // ❌ 기본값 사용

// 2. N+1 쿼리 문제 (워커에서)
for (const execution of pendingExecutions) {
  const [leadContact] = await db.select()... // ❌ 루프 안에서 DB 호출
  const [emailAccount] = await db.select()... // ❌ 또 다른 쿼리
}
```

**글로벌 베스트 프랙티스:**
- **GitHub**: 쿼리 최적화 + 인덱싱 전략
- **Slack**: Read Replica 분리 + 캐싱 레이어
- **Notion**: CQRS 패턴 (Command/Query 분리)

**개선 방안:**

```typescript
// src/db/drizzle.ts
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"
import logger from "../utils/logger"

const connectionString =
  Bun.env.DATABASE_URL ||
  `postgres://${Bun.env.DB_USER}:${Bun.env.DB_PASSWORD}@${Bun.env.DB_HOST}:${Bun.env.DB_PORT}/${Bun.env.DB_NAME}`

const pool = new Pool({
  connectionString,
  min: Number(Bun.env.DB_POOL_MIN) || 2, // 최소 연결 수
  max: Number(Bun.env.DB_POOL_MAX) || 10, // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// 커넥션 풀 모니터링
pool.on('error', (err) => {
  logger.error({ err }, 'PostgreSQL pool error')
})

pool.on('connect', () => {
  logger.debug('New database connection established')
})

export const db = drizzle(pool, { schema })
```

**N+1 쿼리 제거:**

```typescript
// src/workers/email-sequence-worker.ts
import { inArray } from 'drizzle-orm'

async function sendSequenceEmails(executions: ExecutionType[]) {
  // 한 번에 모든 lead와 account 조회
  const leadIds = [...new Set(executions.map(e => e.leadId))]
  const accountIds = [...new Set(executions.map(e => e.emailAccountId))]

  const [contacts, accounts] = await Promise.all([
    db.select()
      .from(leadContacts)
      .where(and(
        inArray(leadContacts.leadId, leadIds),
        eq(leadContacts.contactType, 'email'),
        eq(leadContacts.isPrimary, true)
      )),
    db.select()
      .from(userEmailAccounts)
      .where(inArray(userEmailAccounts.id, accountIds))
  ])

  // Map으로 빠르게 조회
  const contactMap = new Map(contacts.map(c => [c.leadId, c]))
  const accountMap = new Map(accounts.map(a => [a.id, a]))

  // 루프에서 메모리에서 조회
  const results = []
  for (const exec of executions) {
    const contact = contactMap.get(exec.leadId)
    const account = accountMap.get(exec.emailAccountId)

    if (!contact || !account) {
      logger.warn({ executionId: exec.executionId }, 'Missing contact or account')
      continue
    }

    const result = await sendEmail(exec, contact, account)
    results.push(result)
  }

  return results
}
```

**인덱스 최적화:**

```typescript
// src/db/schema/emails.ts
import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core'

export const emails = pgTable('emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull(),
  sequenceId: uuid('sequence_id'),
  status: varchar('status', { length: 20 }).notNull(),
  sentAt: timestamp('sent_at'),
  // ... 기타 필드
}, (table) => ({
  // 단일 인덱스
  leadIdIdx: index('emails_lead_id_idx').on(table.leadId),
  sentAtIdx: index('emails_sent_at_idx').on(table.sentAt),
  statusIdx: index('emails_status_idx').on(table.status),

  // 복합 인덱스 (자주 함께 조회되는 컬럼)
  leadSequenceIdx: index('emails_lead_sequence_idx')
    .on(table.leadId, table.sequenceId),

  // 조건부 인덱스 (PostgreSQL 전용)
  pendingEmailsIdx: index('emails_pending_idx')
    .on(table.status)
    .where(sql`status = 'pending'`),
}))
```

---

### 5. 인증/인가 강화 (High)

**현재 문제점:**
- JWT 미들웨어가 없음 (매번 수동으로 검증)
- 권한 관리 시스템 부족 (admin/user 구분만)
- Rate Limiting 없음
- Refresh Token 없음

**글로벌 베스트 프랙티스:**
- **Auth0**: JWT + Refresh Token + RBAC
- **Clerk**: 세션 관리 + 권한 기반 접근 제어
- **Supabase**: Row-Level Security

**개선 방안:**

```typescript
// src/plugins/auth.plugin.ts
import jwt from 'jsonwebtoken'
import { Elysia } from 'elysia'
import { config } from '../config'
import { errorResponse, ResponseCode } from '../types/response.types'

export const auth = new Elysia({ name: 'auth' })
  .derive(async ({ headers, set }) => {
    const token = headers.authorization?.split(' ')[1]

    if (!token) {
      set.status = 401
      throw new Error('No token provided')
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as {
        userId: string
        email: string
        userRole: string
      }

      return {
        user: {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.userRole,
        }
      }
    } catch {
      set.status = 401
      throw new Error('Invalid token')
    }
  })

// 권한 기반 가드
export const requireRole = (roles: string[]) =>
  new Elysia()
    .use(auth)
    .derive(({ user, set }) => {
      if (!roles.includes(user.role)) {
        set.status = 403
        throw new Error('Insufficient permissions')
      }
      return { user }
    })

// 사용 예시
export const adminRoutes = new Elysia()
  .use(requireRole(['admin']))
  .get('/admin/users', async ({ user }) => {
    // user는 자동으로 주입됨
    return { message: 'Admin only' }
  })
```

**Rate Limiting:**

```bash
bun add @elysiajs/rate-limit
```

```typescript
// src/plugins/rate-limit.plugin.ts
import { rateLimit } from '@elysiajs/rate-limit'
import { config } from '../config'

export const rateLimitPlugin = rateLimit({
  max: config.RATE_LIMIT_MAX,
  duration: config.RATE_LIMIT_WINDOW,
  generator: (req) => {
    // IP 기반 또는 사용자 ID 기반
    return req.headers.get('x-forwarded-for') ||
           req.headers.get('x-real-ip') ||
           'anonymous'
  },
  skip: (req) => {
    // 헬스체크는 제외
    return req.url.includes('/health')
  },
})

// 사용
export const apiRoutes = new Elysia()
  .use(rateLimitPlugin)
  .get('/api/data', () => ({ data: 'protected' }))
```

**Refresh Token 패턴:**

```typescript
// src/services/auth.service.ts
import jwt from 'jsonwebtoken'
import { config } from '../config'

interface TokenPayload {
  userId: string
  email: string
  userRole: string
}

export function generateTokens(payload: TokenPayload) {
  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: '15m', // 짧은 만료 시간
  })

  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh' },
    config.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  )

  return { accessToken, refreshToken }
}

export function verifyRefreshToken(token: string) {
  try {
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as {
      userId: string
      type: string
    }

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type')
    }

    return decoded.userId
  } catch {
    throw new Error('Invalid refresh token')
  }
}

// 라우트에서 사용
export const authRoutes = new Elysia()
  .post('/login', async ({ body }) => {
    // ... 로그인 검증

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      userRole: user.userRole,
    })

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    }
  })
  .post('/refresh', async ({ body }) => {
    const userId = verifyRefreshToken(body.refreshToken)

    const user = await getUserById(userId)

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      userRole: user.userRole,
    })

    return { accessToken: tokens.accessToken }
  })
```

---

### 6. 워커 시스템 개선 (Medium)

**현재 문제점:**
- 고정된 interval (60초) - 유연성 부족
- 에러 발생 시 재시도 로직 없음
- 워커 상태 모니터링 불가능
- 워커가 중복 실행될 가능성 (분산 환경)

**글로벌 베스트 프랙티스:**
- **Stripe**: BullMQ (Redis 기반 큐)
- **GitHub**: Sidekiq (Ruby) / Temporal (Go)
- **Shopify**: Custom Job Queue with Redis

**개선 방안 (옵션 1: BullMQ - 권장):**

```bash
bun add bullmq ioredis
```

```typescript
// src/workers/email-queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq'
import Redis from 'ioredis'
import { config } from '../config'
import logger from '../utils/logger'

const connection = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  maxRetriesPerRequest: null,
})

export const emailQueue = new Queue('email-sending', { connection })

// 워커 생성
export const emailWorker = new Worker(
  'email-sending',
  async (job) => {
    const { executionId, leadId, emailData } = job.data

    logger.info({ executionId, jobId: job.id }, 'Processing email job')

    const result = await sendSequenceEmail(emailData)

    if (!result.success) {
      throw new Error(result.error)
    }

    return result
  },
  {
    connection,
    concurrency: 10, // 동시 처리 수
    limiter: {
      max: 100, // 1분에 100개까지
      duration: 60000,
    },
  }
)

// 이벤트 리스너
const queueEvents = new QueueEvents('email-sending', { connection })

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info({ jobId }, 'Job completed successfully')
})

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Job failed')
})

// 워커 시작
export function startEmailWorker() {
  logger.info('Starting email worker with BullMQ')

  // 정기적으로 pending 작업 조회하여 큐에 추가
  setInterval(async () => {
    const pendingExecutions = await getPendingStepExecutions(50)

    for (const execution of pendingExecutions) {
      await emailQueue.add('send-email', {
        executionId: execution.executionId,
        leadId: execution.leadId,
        emailData: execution,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: 100, // 실패한 작업 100개까지 보관
      })
    }
  }, 60000)
}

// 워커 정지
export async function stopEmailWorker() {
  await emailWorker.close()
  await emailQueue.close()
  await connection.quit()
}
```

**개선 방안 (옵션 2: 분산 락 - Redis 없이):**

```typescript
// src/workers/distributed-lock.ts
import { db } from '../db'
import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core'
import { eq, and, sql } from 'drizzle-orm'
import logger from '../utils/logger'

export const workerLocks = pgTable('worker_locks', {
  name: varchar('name', { length: 255 }).primaryKey(),
  lockedAt: timestamp('locked_at').notNull(),
  lockedBy: varchar('locked_by', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
})

async function acquireLock(name: string, ttlMs: number = 60000) {
  const lockId = `${process.pid}-${Date.now()}`
  const expiresAt = new Date(Date.now() + ttlMs)

  try {
    // 만료된 락 정리
    await db.delete(workerLocks)
      .where(sql`expires_at < NOW()`)

    // 락 획득 시도
    await db.insert(workerLocks).values({
      name,
      lockedAt: new Date(),
      lockedBy: lockId,
      expiresAt,
    })

    return lockId
  } catch (error) {
    // 락이 이미 존재하면 실패
    logger.debug({ name }, 'Failed to acquire lock')
    return null
  }
}

async function releaseLock(name: string, lockId: string) {
  await db.delete(workerLocks)
    .where(and(
      eq(workerLocks.name, name),
      eq(workerLocks.lockedBy, lockId)
    ))
}

// 워커에서 사용
export function startEmailSequenceWorker() {
  logger.info('Starting email sequence worker with distributed lock')

  setInterval(async () => {
    const lock = await acquireLock('email-sequence-worker', 120000)

    if (!lock) {
      logger.debug('Another worker is processing, skipping...')
      return
    }

    try {
      await processSequenceEmails()
    } catch (error) {
      logger.error({ err: error }, 'Worker error')
    } finally {
      await releaseLock('email-sequence-worker', lock)
    }
  }, 60000)
}
```

---

### 7. API 아키텍처 개선 (Medium)

**현재 문제점:**
- DTO/Validation이 라우트에 분산됨
- 비즈니스 로직이 라우트에 노출됨
- 일관성 없는 응답 포맷

**글로벌 베스트 프랙티스:**
- **NestJS**: Controller → Service → Repository 패턴
- **tRPC**: End-to-end type safety
- **GraphQL**: Schema-first approach

**개선 방안:**

```typescript
// 1. DTO 분리
// src/dto/email.dto.ts
import { t } from 'elysia'

export const SendEmailDto = t.Object({
  toEmail: t.String({ format: 'email' }),
  subject: t.String({ minLength: 1, maxLength: 200 }),
  bodyText: t.Optional(t.String()),
  bodyHtml: t.Optional(t.String()),
  ccEmails: t.Optional(t.Array(t.String({ format: 'email' }))),
  bccEmails: t.Optional(t.Array(t.String({ format: 'email' }))),
})

export type SendEmailDto = typeof SendEmailDto.static

export const CreateSequenceDto = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String()),
  steps: t.Array(t.Object({
    subject: t.String(),
    bodyText: t.String(),
    delayDays: t.Number({ minimum: 0 }),
  })),
})

export type CreateSequenceDto = typeof CreateSequenceDto.static
```

```typescript
// 2. Repository 패턴
// src/repositories/email.repository.ts
import { db } from '../db'
import { emails, type NewEmail } from '../db/schema/emails'
import { eq, and, inArray } from 'drizzle-orm'

export class EmailRepository {
  async findById(id: string) {
    return db.query.emails.findFirst({
      where: eq(emails.id, id),
    })
  }

  async findPendingEmails(limit: number) {
    return db.query.emails.findMany({
      where: eq(emails.status, 'pending'),
      limit,
      orderBy: (emails, { asc }) => [asc(emails.createdAt)],
    })
  }

  async findByLeadIds(leadIds: string[]) {
    return db.query.emails.findMany({
      where: inArray(emails.leadId, leadIds),
    })
  }

  async create(data: NewEmail) {
    const [email] = await db.insert(emails).values(data).returning()
    return email
  }

  async updateStatus(id: string, status: string) {
    const [email] = await db
      .update(emails)
      .set({ status, updatedAt: new Date() })
      .where(eq(emails.id, id))
      .returning()
    return email
  }

  async deleteById(id: string) {
    await db.delete(emails).where(eq(emails.id, id))
  }
}

export const emailRepository = new EmailRepository()
```

```typescript
// 3. Service 개선
// src/services/email-management.service.ts
import { emailRepository } from '../repositories/email.repository'
import { emailService } from './email.service'
import logger from '../utils/logger'

export class EmailManagementService {
  async sendEmail(dto: SendEmailDto, userId: string) {
    // 비즈니스 로직
    const account = await this.getDefaultEmailAccount(userId)

    const result = await emailService.sendEmail({
      fromEmail: account.emailAddress,
      fromName: account.displayName,
      toEmail: dto.toEmail,
      subject: dto.subject,
      bodyText: dto.bodyText,
      bodyHtml: dto.bodyHtml,
      ccEmails: dto.ccEmails,
      bccEmails: dto.bccEmails,
      apiKey: account.apiKey,
    })

    if (!result.success) {
      throw new Error(result.error)
    }

    // DB에 기록
    const email = await emailRepository.create({
      leadId: dto.leadId,
      subject: dto.subject,
      status: 'sent',
      sentAt: new Date(),
      messageId: result.messageId,
    })

    logger.info({ emailId: email.id }, 'Email sent successfully')

    return email
  }

  private async getDefaultEmailAccount(userId: string) {
    // ...
  }
}

export const emailManagementService = new EmailManagementService()
```

```typescript
// 4. 라우트 정리
// src/routes/emails.routes.ts
import { Elysia } from 'elysia'
import { auth } from '../plugins/auth.plugin'
import { emailManagementService } from '../services/email-management.service'
import { SendEmailDto } from '../dto/email.dto'
import { successResponse, errorResponse, ResponseCode } from '../types/response.types'

export const emailRoutes = new Elysia({ prefix: '/api/v1/emails' })
  .use(auth)
  .post('/', async ({ body, user, set }) => {
    try {
      const email = await emailManagementService.sendEmail(body, user.id)
      return successResponse(email, '이메일이 전송되었습니다.')
    } catch (error) {
      set.status = 500
      return errorResponse(
        error instanceof Error ? error.message : '이메일 전송 실패',
        ResponseCode.INTERNAL_ERROR
      )
    }
  }, {
    body: SendEmailDto,
    detail: {
      summary: 'Send email',
      description: 'Send an email to a recipient',
      tags: ['emails'],
    }
  })
  .get('/:id', async ({ params, user }) => {
    const email = await emailManagementService.getEmail(params.id, user.id)
    return successResponse(email)
  }, {
    detail: {
      summary: 'Get email by ID',
      tags: ['emails'],
    }
  })
```

---

### 8. 캐싱 전략 (Medium)

**글로벌 베스트 프랙티스:**
- **Redis**: 세션, 자주 조회되는 데이터
- **CDN**: 정적 자산
- **In-Memory Cache**: 설정 데이터

**개선 방안:**

```bash
bun add lru-cache
```

```typescript
// src/lib/cache.ts
import { LRUCache } from 'lru-cache'
import logger from '../utils/logger'

export const appCache = new LRUCache<string, unknown>({
  max: 500, // 최대 항목 수
  ttl: 1000 * 60 * 5, // 5분
  updateAgeOnGet: true, // 조회 시 TTL 갱신
  updateAgeOnHas: false,
})

// 캐시 헬퍼 함수
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = appCache.get(key) as T | undefined

  if (cached !== undefined) {
    logger.debug({ key }, 'Cache hit')
    return cached
  }

  logger.debug({ key }, 'Cache miss')
  const value = await fetcher()
  appCache.set(key, value, { ttl })

  return value
}

// 캐시 무효화
export function invalidate(pattern: string) {
  const keys = [...appCache.keys()].filter(key => key.includes(pattern))
  for (const key of keys) {
    appCache.delete(key)
  }
  logger.info({ pattern, count: keys.length }, 'Cache invalidated')
}
```

```typescript
// 사용 예시
// src/services/workspace.service.ts
import { getOrSet, invalidate } from '../lib/cache'

export async function getWorkspaceSettings(workspaceId: string) {
  return getOrSet(
    `workspace:${workspaceId}:settings`,
    async () => {
      return db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      })
    },
    1000 * 60 * 10 // 10분
  )
}

export async function updateWorkspaceSettings(workspaceId: string, data: unknown) {
  const result = await db.update(workspaces).set(data).where(eq(workspaces.id, workspaceId))

  // 캐시 무효화
  invalidate(`workspace:${workspaceId}`)

  return result
}
```

---

### 9. 보안 강화 (High)

**개선 방안:**

```bash
bun add helmet
```

```typescript
// src/index.ts
import { Elysia } from 'elysia'
import helmet from 'helmet'

const app = new Elysia()
  // 보안 헤더
  .onBeforeHandle(({ set }) => {
    // Helmet 기능을 수동으로 구현
    set.headers['X-Content-Type-Options'] = 'nosniff'
    set.headers['X-Frame-Options'] = 'DENY'
    set.headers['X-XSS-Protection'] = '1; mode=block'
    set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    set.headers['Content-Security-Policy'] = "default-src 'self'"
  })
  // CORS 강화
  .use(cors({
    origin: config.ALLOWED_ORIGINS.split(','), // ❌ origin: true는 위험
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // 24시간
  }))
```

```typescript
// API 키 로테이션
// src/services/email-account.service.ts
import crypto from 'crypto'

export async function rotateApiKey(accountId: string, userId: string) {
  // 권한 확인
  const account = await db.query.userEmailAccounts.findFirst({
    where: and(
      eq(userEmailAccounts.id, accountId),
      eq(userEmailAccounts.userId, userId)
    ),
  })

  if (!account) {
    throw new Error('Unauthorized')
  }

  // 새 키 생성
  const newKey = `sg_${crypto.randomBytes(32).toString('hex')}`

  // 업데이트
  const [updated] = await db.update(userEmailAccounts)
    .set({
      apiKey: newKey,
      keyRotatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, accountId))
    .returning()

  logger.info({ accountId }, 'API key rotated')

  return { apiKey: newKey }
}
```

```typescript
// SQL Injection 방지 체크리스트
// ❌ 절대 하지 말 것
await db.execute(`SELECT * FROM users WHERE id = ${userId}`)
await db.execute(sql`SELECT * FROM users WHERE id = ${userId}`) // sql`` 태그도 위험

// ✅ Parameterized query
await db.select().from(users).where(eq(users.id, userId))

// ✅ Raw query with parameters
await db.execute(sql`SELECT * FROM users WHERE id = ${sql.placeholder('userId')}`, { userId })
```

---

### 10. 문서화 개선 (Low)

**개선 방안:**

```typescript
// src/index.ts
.use(swagger({
  documentation: {
    info: {
      title: 'SendGrid Email Service API',
      version: '2.1.0',
      description: 'Email automation platform with AI-powered workflows',
      contact: {
        name: 'Grinda AI',
        email: 'support@grinda.ai',
      },
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local Development' },
      { url: 'https://api.grinda.ai', description: 'Production' },
    ],
    tags: [
      { name: 'auth', description: 'Authentication endpoints' },
      { name: 'emails', description: 'Email management' },
      { name: 'workflows', description: 'Workflow automation' },
      { name: 'admin', description: 'Admin-only endpoints' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/v1/auth/login',
        },
      },
    },
  },
  exclude: ['/health', '/metrics'], // 제외할 엔드포인트
}))
```

---

## 📋 우선순위별 개선 로드맵

### Phase 1: 즉시 (1주) 🔴

1. **테스트 프레임워크 구축**
   - `bun test` 설정
   - 핵심 서비스 유닛 테스트 (email, auth)
   - 목표: 30% 커버리지

2. **환경 설정 검증**
   - Zod로 env 검증 추가
   - `.env.example` 업데이트
   - 민감 정보 하드코딩 제거

3. **로깅 개선**
   - 민감 정보 마스킹
   - 요청 ID 추가
   - 구조화된 로깅

4. **Rate Limiting**
   - API 엔드포인트에 Rate Limit 적용
   - 로그인 엔드포인트 Brute Force 방어

### Phase 2: 단기 (1-2주) 🟡

5. **인증 미들웨어**
   - JWT 자동 검증 미들웨어
   - 권한 기반 가드 (requireRole)
   - Refresh Token 패턴

6. **DB 최적화**
   - 커넥션 풀 설정
   - N+1 쿼리 제거
   - 인덱스 추가

7. **에러 추적**
   - Sentry 통합
   - 에러 알림 설정

8. **헬스체크 개선**
   - `/health/ready`, `/health/live` 추가
   - DB 상태 체크

### Phase 3: 중기 (2-4주) 🟢

9. **워커 시스템 개선**
   - 분산 락 구현 또는 BullMQ 도입
   - 재시도 로직
   - 워커 모니터링

10. **캐싱 레이어**
    - LRU Cache 도입
    - 자주 조회되는 데이터 캐싱
    - 캐시 무효화 전략

11. **통합 테스트**
    - E2E 시나리오 테스트
    - Testcontainers로 DB 테스트
    - 목표: 50% 커버리지

12. **모니터링 대시보드**
    - 메트릭 수집 (Prometheus)
    - 대시보드 구축 (Grafana)
    - 알림 설정

### Phase 4: 장기 (필요시) 🔵

13. **마이크로서비스 분리**
    - Email 발송 서비스 분리
    - Workflow 실행 서비스 분리
    - API Gateway 도입

14. **Event-Driven Architecture**
    - 이벤트 버스 도입 (Kafka, RabbitMQ)
    - CQRS 패턴

15. **GraphQL API**
    - 프론트엔드 요청 시 도입

---

## 🎯 2명 팀에 맞는 실용적 조언

### 1. 테스트는 필수, 완벽함은 나중에
- 핵심 비즈니스 로직만 먼저 테스트 (80/20 법칙)
- 회귀 버그 방지에 집중
- CI에서 테스트 자동 실행

### 2. 모니터링 먼저, 최적화는 데이터 기반으로
- Sentry + Pino로 먼저 가시성 확보
- 병목 지점을 데이터로 찾기
- 추측이 아닌 측정으로 개선

### 3. 외부 서비스 활용
- **Auth**: Clerk, Supabase Auth
- **Queuing**: Upstash (Serverless Redis)
- **Monitoring**: Sentry, Datadog
- **Database**: Supabase, Neon (Serverless Postgres)

### 4. 문서화는 코드와 함께
- Swagger 주석으로 API 문서 자동 생성
- TypeScript로 타입 문서화
- ADR로 중요 결정 기록

### 5. 배포는 자동화, 디버깅에 시간 투자
- GitHub Actions는 잘 되어 있음 ✅
- Rollback 전략 추가
- Blue-Green 배포 고려

### 6. 기술 부채 관리
- 매 스프린트마다 개선 작업 포함
- "나중에" 리스트를 GitHub Issues로 관리
- 정기적인 코드 리뷰

---

## 📊 현재 vs 개선 후 비교

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| **테스트 커버리지** | 0% | 50%+ |
| **환경 설정** | 검증 없음 | Zod 스키마 검증 |
| **인증** | 수동 검증 | 미들웨어 자동 검증 |
| **Rate Limiting** | 없음 | API 보호 |
| **DB 쿼리** | N+1 문제 | 배치 조회 |
| **워커** | 단순 interval | 분산 락/큐 시스템 |
| **에러 추적** | 로그만 | Sentry 통합 |
| **모니터링** | 기본 로그 | 구조화된 로그 + 메트릭 |
| **문서화** | Swagger 기본 | 상세한 API 문서 |
| **보안** | CORS 기본 | 헤더 보호 + Rate Limit |

---

## 🚀 시작하기

### Step 1: 환경 설정 검증

```bash
# Zod 설치
bun add zod

# .env.example 업데이트
cp .env .env.backup
```

### Step 2: 테스트 환경 구축

```bash
# 테스트 도구 설치
bun add -d @testcontainers/postgresql

# 첫 테스트 작성
mkdir -p src/services/__tests__
```

### Step 3: 로깅 개선

```bash
# 현재 logger.ts 백업
cp src/utils/logger.ts src/utils/logger.ts.backup

# 새 로거 적용
# (위 코드 참고)
```

---

## 📚 참고 자료

### 글로벌 서비스 아키텍처
- [Stripe API Design Best Practices](https://stripe.com/docs/api)
- [GitHub Engineering Blog](https://github.blog/category/engineering/)
- [Shopify Engineering](https://shopify.engineering/)
- [Netflix Tech Blog](https://netflixtechblog.com/)

### Bun & Elysia
- [Elysia Documentation](https://elysiajs.com/)
- [Bun Documentation](https://bun.sh/docs)
- [Drizzle ORM Best Practices](https://orm.drizzle.team/docs/overview)

### 테스팅
- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Testing Best Practices](https://testingjavascript.com/)

### 보안
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## 🎓 결론

현재 아키텍처는 **초기 스타트업으로 잘 설계**되어 있습니다.

위 개선사항은 **스케일업 전 기술 부채 예방**을 위한 것으로, 우선순위에 따라 단계적으로 적용하시면 됩니다.

**가장 중요한 것: 테스트, 모니터링, 보안** 이 세 가지부터 시작하세요! 💪
