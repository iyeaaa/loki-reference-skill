# RINDA Campaign Architecture Development Plan
## BullMQ Queue System Implementation Guide

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Current System Analysis](#2-current-system-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Development Phases](#4-development-phases)
5. [Phase Evaluation](#5-phase-evaluation)
6. [Risk Assessment](#6-risk-assessment)
7. [Implementation Checklist](#7-implementation-checklist)

---

## 1. Executive Summary

### Project Goal
현재 DB 폴링 기반의 Worker 시스템을 **BullMQ + Redis 기반 Queue 시스템**으로 전환하여, 30일 캠페인 시나리오를 효율적으로 실행할 수 있는 아키텍처 구축

### Key Changes
| 구분 | 현재 (As-Is) | 목표 (To-Be) |
|------|-------------|--------------|
| **Queue** | p-queue (In-Memory) | BullMQ + Redis |
| **State** | PostgreSQL Only | Redis (실시간) + PostgreSQL (영구) |
| **Worker** | setInterval 폴링 | Event-driven BullMQ Worker |
| **Scheduling** | DB 기반 | Redis Delayed Jobs |
| **Persistence** | 즉시 DB 저장 | 주기적 Batch Sync |

---

## 2. Current System Analysis

### 2.1 Frontend (admin/)

```
Technology Stack:
├── Framework: React 19.2.3 + Vite
├── State: Jotai (local) + TanStack React Query (server)
├── UI: Tailwind CSS + Radix UI
├── Forms: React Hook Form + Zod
└── API: OpenAPI Generated Client
```

**Campaign 관련 페이지:**
- `pages/sequences/CreateCampaignPage.tsx` - 캠페인 생성 (3단계)
- `pages/sequences/CampaignOverview.tsx` - 캠페인 상세/메트릭
- `pages/sequences/SequenceEnrollmentsTable.tsx` - 등록 추적

**평가:** ✅ 현재 프론트엔드 구조는 새 아키텍처에 영향 최소화. API 응답 타입만 업데이트 필요.

### 2.2 Backend (elysia-server/)

```
Technology Stack:
├── Framework: Elysia 1.4.7 (Bun)
├── ORM: Drizzle 0.44.5 + PostgreSQL
├── Email: SendGrid + Nylas
├── AI: Mastra + OpenAI/Gemini
└── Worker: setInterval Polling (NOT Event-Driven)
```

**현재 Worker 구조:**
```typescript
// 문제점: DB 폴링 방식
setInterval(async () => {
  const pendingTasks = await db.query.sequenceStepExecutions.findMany({
    where: eq(status, 'pending')
  });
  // Process tasks...
}, 30000); // 30초마다 폴링
```

**제한사항:**
- ❌ Task 유실 위험 (서버 재시작 시)
- ❌ 재시도 메커니즘 없음
- ❌ 분산 처리 불가
- ❌ Dead Letter Queue 없음
- ❌ 실시간 모니터링 어려움

### 2.3 Database Schema (현재)

```
Key Tables:
├── sequences (캠페인 정보)
├── sequenceSteps (이메일 단계)
├── sequenceEnrollments (리드 등록)
├── sequenceStepExecutions (실행 상태)
├── emails (발송 기록)
└── emailEvents (이벤트 추적)
```

**평가:** ✅ 스키마 구조는 적절함. Redis 상태 캐시와 동기화 로직만 추가 필요.

### 2.4 Infrastructure (docker-compose.yml)

```yaml
현재 서비스:
├── nginx (Reverse Proxy)
├── admin (Frontend - Port 3000)
├── elysia-server (Backend - Port 3001)
├── postgres (Database - Port 5432)
├── redis (Cache - Port 6379)  # 이미 존재!
├── redisinsight (Redis GUI - Port 5540)
└── uptime-kuma (Monitoring - Port 3002)
```

**평가:** ✅ Redis 인프라 이미 구성됨. BullMQ 연결만 추가하면 됨.

---

## 3. Target Architecture

### 3.1 Architecture Diagram (PlantUML)

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Context (Workspace)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  연동된 계정 (Nylas Account)                              │   │
│  │  - 캠페인과 데이터가 Account 단위로 격리                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Elysia Backend                               │
│  ┌──────────────────┐    ┌─────────────────────┐               │
│  │ Campaign Manager │────│ Lead DB (BigQuery)  │               │
│  │ (API & Webhook)  │    │ 300 Leads 추출       │               │
│  └──────────────────┘    └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Infrastructure (Redis)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  BullMQ & State                                          │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐   │   │
│  │  │ Queue:{Nylas_ID}│  │ State:{Nylas_ID}            │   │   │
│  │  │ - 스케줄/대기열   │  │ - Status: 실행 중           │   │   │
│  │  │ - 30일치 작업     │  │ - Metrics: 오픈/클릭 수     │   │   │
│  │  └─────────────────┘  └─────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Worker Service                               │
│  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │      Email Worker        │  │    Batch Sync Worker       │  │
│  │  - 30일 시나리오 수행      │  │  - Redis → PostgreSQL      │  │
│  │  - Batch 1~5 (6일씩)      │  │  - 주기적 영구 저장         │  │
│  └──────────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Persistence)          Nylas Platform (External)    │
│  - 영구 저장소                       - 이메일 발송/수신           │
│  - 분석용 데이터                     - Webhook 이벤트            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
1. 체험판 캠페인 시작 요청 (User → Backend)
2. BigQuery에서 300 Leads 추출 (Backend → BigQuery)
3. 30일치 전체 스케줄링 Bulk Insert (Backend → Redis Queue)
4. 발송 작업 가져오기 (Queue → Email Worker)
5. 정책 확인 - 오픈 횟수/답장 여부 (Worker → Redis State)
6. 정책 충족 시 이메일 발송 (Worker → Nylas)
7. Follow-up 예약 (Worker → Queue)
8. Nylas Webhook 이벤트 수신 (Nylas → Backend)
9. 성과 지표 업데이트 (Backend → Redis State)
10a. Redis State 읽기 (Sync Worker → Redis)
10b. PostgreSQL 주기적 업데이트 (Sync Worker → PostgreSQL)
```

---

## 4. Development Phases

### Phase 1: Redis/BullMQ Infrastructure Setup
**예상 작업량:** 기반 작업

#### 1.1 Dependencies 설치

```bash
# elysia-server/
bun add bullmq ioredis @bull-board/elysia @bull-board/api
```

#### 1.2 Redis Connection 설정

```typescript
// src/lib/redis/connection.ts
import Redis from 'ioredis';
import { config } from '../../config';

export const redisConnection = new Redis({
  host: config.REDIS_HOST || 'redis',
  port: config.REDIS_PORT || 6379,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // BullMQ 필수
  enableReadyCheck: false,
});

export const createRedisConnection = () => new Redis({
  host: config.REDIS_HOST || 'redis',
  port: config.REDIS_PORT || 6379,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
```

#### 1.3 환경 변수 추가

```typescript
// src/config.ts 추가
REDIS_HOST: process.env.REDIS_HOST || 'localhost',
REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
REDIS_PASSWORD: process.env.REDIS_PASSWORD || 'sendgrid_redis_password_2024',
```

#### 1.4 평가
| 항목 | 평가 | 설명 |
|------|------|------|
| **최적성** | ✅ 최적 | BullMQ는 Redis 기반 큐의 de-facto 표준 |
| **리스크** | 🟢 낮음 | 기존 Redis 인프라 활용 |
| **대안** | Agenda.js (MongoDB), Bull (legacy) |

---

### Phase 2: Queue Architecture Implementation
**예상 작업량:** 핵심 작업

#### 2.1 Queue 정의

```typescript
// src/lib/queue/queues.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../redis/connection';

// Queue 이름 상수
export const QUEUE_NAMES = {
  CAMPAIGN_EMAIL: 'campaign-email',
  SCHEDULED_EMAIL: 'scheduled-email',
  WORKFLOW_STEP: 'workflow-step',
  METRICS_SYNC: 'metrics-sync',
} as const;

// Job 타입 정의
export interface CampaignEmailJob {
  enrollmentId: string;
  stepId: string;
  nylasAccountId: string;
  leadId: string;
  scheduledAt: Date;
  attempt: number;
}

export interface MetricsSyncJob {
  nylasAccountId: string;
  campaignId: string;
}

// Queue 인스턴스 생성
export const campaignEmailQueue = new Queue<CampaignEmailJob>(
  QUEUE_NAMES.CAMPAIGN_EMAIL,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000, // 1분 → 2분 → 4분
      },
      removeOnComplete: {
        age: 24 * 3600, // 24시간 후 삭제
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // 7일간 보관
      },
    },
  }
);

export const metricsSyncQueue = new Queue<MetricsSyncJob>(
  QUEUE_NAMES.METRICS_SYNC,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: true,
    },
  }
);
```

#### 2.2 30일 Batch 스케줄링 로직

```typescript
// src/services/campaign-scheduler.service.ts
import { campaignEmailQueue } from '../lib/queue/queues';

interface ScheduleCampaignParams {
  sequenceId: string;
  nylasAccountId: string;
  leads: Array<{ id: string; email: string }>;
  steps: Array<{
    id: string;
    order: number;
    delayDays: number;
    scheduledHour: number;
    scheduledMinute: number;
    timezone: string;
  }>;
}

export async function scheduleCampaignBatch(params: ScheduleCampaignParams) {
  const { sequenceId, nylasAccountId, leads, steps } = params;
  const jobs: Parameters<typeof campaignEmailQueue.addBulk>[0] = [];
  const now = new Date();

  for (const lead of leads) {
    // Enrollment 생성
    const enrollment = await createEnrollment({
      sequenceId,
      leadId: lead.id,
      nylasAccountId,
    });

    for (const step of steps) {
      // 스케줄 시간 계산
      const scheduledAt = calculateScheduledTime(
        now,
        step.delayDays,
        step.scheduledHour,
        step.scheduledMinute,
        step.timezone
      );

      jobs.push({
        name: `${sequenceId}:${lead.id}:step-${step.order}`,
        data: {
          enrollmentId: enrollment.id,
          stepId: step.id,
          nylasAccountId,
          leadId: lead.id,
          scheduledAt,
          attempt: 1,
        },
        opts: {
          delay: scheduledAt.getTime() - now.getTime(),
          jobId: `${sequenceId}-${lead.id}-${step.id}`,
        },
      });
    }
  }

  // Bulk Insert (30일 × 300 leads × 6 steps = ~54,000 jobs)
  await campaignEmailQueue.addBulk(jobs);

  return { jobCount: jobs.length };
}
```

#### 2.3 평가
| 항목 | 평가 | 설명 |
|------|------|------|
| **최적성** | ✅ 최적 | BullMQ의 delayed job + bulk insert 활용 |
| **리스크** | 🟡 중간 | 대량 Job 처리 시 메모리 관리 필요 |
| **대안** | 청크 단위 Insert (10,000개씩) |

---

### Phase 3: Worker Implementation
**예상 작업량:** 핵심 작업

#### 3.1 Email Worker

```typescript
// src/workers/bullmq/campaign-email.worker.ts
import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../../lib/redis/connection';
import { CampaignEmailJob, QUEUE_NAMES } from '../../lib/queue/queues';
import { nylasService } from '../../services/nylas.service';
import { campaignStateService } from '../../services/campaign-state.service';

export const campaignEmailWorker = new Worker<CampaignEmailJob>(
  QUEUE_NAMES.CAMPAIGN_EMAIL,
  async (job: Job<CampaignEmailJob>) => {
    const { enrollmentId, stepId, nylasAccountId, leadId } = job.data;

    // 1. 정책 확인 (Redis State)
    const state = await campaignStateService.getLeadState(nylasAccountId, leadId);

    // 답장 받은 경우 스킵
    if (state.hasReplied) {
      await updateExecutionStatus(enrollmentId, stepId, 'skipped', 'Lead replied');
      return { status: 'skipped', reason: 'replied' };
    }

    // 3회 이상 오픈 시 다음 단계로
    if (state.openCount >= 3 && job.data.attempt === 1) {
      // 이미 관심 있음 - 계속 진행
    }

    // 2. 이메일 콘텐츠 조회
    const emailContent = await getEmailContent(enrollmentId, stepId);

    // 3. Nylas로 이메일 발송
    const result = await nylasService.sendEmail({
      grantId: nylasAccountId,
      to: [{ email: state.leadEmail }],
      subject: emailContent.subject,
      body: emailContent.bodyHtml,
      replyToMessageId: state.firstThreadId,
    });

    // 4. 상태 업데이트 (Redis)
    await campaignStateService.updateAfterSend(nylasAccountId, leadId, {
      lastSentAt: new Date(),
      sentCount: state.sentCount + 1,
    });

    // 5. 실행 기록 (PostgreSQL - 비동기)
    await updateExecutionStatus(enrollmentId, stepId, 'sent', null, result.messageId);

    return { status: 'sent', messageId: result.messageId };
  },
  {
    connection: createRedisConnection(),
    concurrency: 10, // 동시 처리 수
    limiter: {
      max: 100,
      duration: 60000, // 분당 100건 제한
    },
  }
);

// Worker 이벤트 핸들러
campaignEmailWorker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

campaignEmailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
```

#### 3.2 Batch Sync Worker

```typescript
// src/workers/bullmq/metrics-sync.worker.ts
import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../../lib/redis/connection';
import { MetricsSyncJob, QUEUE_NAMES } from '../../lib/queue/queues';
import { campaignStateService } from '../../services/campaign-state.service';
import { db } from '../../db';

export const metricsSyncWorker = new Worker<MetricsSyncJob>(
  QUEUE_NAMES.METRICS_SYNC,
  async (job: Job<MetricsSyncJob>) => {
    const { nylasAccountId, campaignId } = job.data;

    // 1. Redis에서 최신 메트릭 조회
    const metrics = await campaignStateService.getCampaignMetrics(
      nylasAccountId,
      campaignId
    );

    // 2. PostgreSQL에 영구 저장
    await db.update(sequences)
      .set({
        metrics: {
          totalSent: metrics.sentCount,
          totalOpened: metrics.openCount,
          totalClicked: metrics.clickCount,
          totalReplied: metrics.replyCount,
          totalBounced: metrics.bounceCount,
          updatedAt: new Date(),
        },
      })
      .where(eq(sequences.id, campaignId));

    // 3. 개별 Enrollment 메트릭도 동기화
    for (const enrollment of metrics.enrollments) {
      await db.update(sequenceEnrollments)
        .set({
          openCount: enrollment.openCount,
          clickCount: enrollment.clickCount,
          lastOpenedAt: enrollment.lastOpenedAt,
        })
        .where(eq(sequenceEnrollments.id, enrollment.id));
    }

    return { synced: true, timestamp: new Date() };
  },
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
);

// 주기적 동기화 스케줄 (5분마다)
export function scheduleMetricsSync() {
  setInterval(async () => {
    const activeCampaigns = await getActiveCampaigns();

    for (const campaign of activeCampaigns) {
      await metricsSyncQueue.add(`sync-${campaign.id}`, {
        nylasAccountId: campaign.nylasAccountId,
        campaignId: campaign.id,
      });
    }
  }, 5 * 60 * 1000); // 5분
}
```

#### 3.3 평가
| 항목 | 평가 | 설명 |
|------|------|------|
| **최적성** | ✅ 최적 | Event-driven + Concurrency 제어 |
| **리스크** | 🟡 중간 | Rate Limiter 튜닝 필요 (Nylas 제한) |
| **대안** | 별도 Worker 프로세스로 분리 가능 |

---

### Phase 4: Redis State Management
**예상 작업량:** 중요 작업

#### 4.1 State Service

```typescript
// src/services/campaign-state.service.ts
import { redisConnection } from '../lib/redis/connection';

interface LeadState {
  leadEmail: string;
  firstThreadId: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
  hasReplied: boolean;
  lastSentAt: Date | null;
  lastOpenedAt: Date | null;
}

interface CampaignState {
  status: 'running' | 'paused' | 'completed';
  totalLeads: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
}

class CampaignStateService {
  private getLeadKey(nylasId: string, leadId: string) {
    return `campaign:${nylasId}:lead:${leadId}`;
  }

  private getCampaignKey(nylasId: string, campaignId: string) {
    return `campaign:${nylasId}:metrics:${campaignId}`;
  }

  async initLeadState(nylasId: string, leadId: string, email: string) {
    const key = this.getLeadKey(nylasId, leadId);
    await redisConnection.hset(key, {
      leadEmail: email,
      firstThreadId: '',
      sentCount: '0',
      openCount: '0',
      clickCount: '0',
      hasReplied: 'false',
      lastSentAt: '',
      lastOpenedAt: '',
    });
    await redisConnection.expire(key, 35 * 24 * 3600); // 35일 TTL
  }

  async getLeadState(nylasId: string, leadId: string): Promise<LeadState> {
    const key = this.getLeadKey(nylasId, leadId);
    const data = await redisConnection.hgetall(key);
    return {
      leadEmail: data.leadEmail || '',
      firstThreadId: data.firstThreadId || null,
      sentCount: parseInt(data.sentCount || '0'),
      openCount: parseInt(data.openCount || '0'),
      clickCount: parseInt(data.clickCount || '0'),
      hasReplied: data.hasReplied === 'true',
      lastSentAt: data.lastSentAt ? new Date(data.lastSentAt) : null,
      lastOpenedAt: data.lastOpenedAt ? new Date(data.lastOpenedAt) : null,
    };
  }

  async updateAfterSend(nylasId: string, leadId: string, updates: Partial<LeadState>) {
    const key = this.getLeadKey(nylasId, leadId);
    const fields: Record<string, string> = {};

    if (updates.lastSentAt) fields.lastSentAt = updates.lastSentAt.toISOString();
    if (updates.sentCount !== undefined) fields.sentCount = String(updates.sentCount);
    if (updates.firstThreadId) fields.firstThreadId = updates.firstThreadId;

    await redisConnection.hset(key, fields);
  }

  async incrementMetric(nylasId: string, leadId: string, metric: 'openCount' | 'clickCount') {
    const key = this.getLeadKey(nylasId, leadId);
    await redisConnection.hincrby(key, metric, 1);

    if (metric === 'openCount') {
      await redisConnection.hset(key, 'lastOpenedAt', new Date().toISOString());
    }
  }

  async markAsReplied(nylasId: string, leadId: string) {
    const key = this.getLeadKey(nylasId, leadId);
    await redisConnection.hset(key, 'hasReplied', 'true');
  }

  // Campaign 전체 메트릭
  async getCampaignMetrics(nylasId: string, campaignId: string): Promise<CampaignState> {
    const key = this.getCampaignKey(nylasId, campaignId);
    const data = await redisConnection.hgetall(key);
    return {
      status: (data.status as CampaignState['status']) || 'running',
      totalLeads: parseInt(data.totalLeads || '0'),
      sentCount: parseInt(data.sentCount || '0'),
      openCount: parseInt(data.openCount || '0'),
      clickCount: parseInt(data.clickCount || '0'),
      replyCount: parseInt(data.replyCount || '0'),
      bounceCount: parseInt(data.bounceCount || '0'),
    };
  }
}

export const campaignStateService = new CampaignStateService();
```

#### 4.2 평가
| 항목 | 평가 | 설명 |
|------|------|------|
| **최적성** | ✅ 최적 | Redis Hash로 빠른 조회/업데이트 |
| **리스크** | 🟢 낮음 | TTL로 메모리 관리 |
| **대안** | Redis JSON (더 복잡한 구조 시) |

---

### Phase 5: Webhook Integration Enhancement
**예상 작업량:** 핵심 작업

#### 5.1 Nylas Webhook Handler 개선

```typescript
// src/routes/webhooks/nylas-webhook.routes.ts
import { campaignStateService } from '../../services/campaign-state.service';
import { campaignEmailQueue } from '../../lib/queue/queues';

export const handleNylasWebhook = async (event: NylasWebhookEvent) => {
  const { type, data } = event;

  switch (type) {
    case 'message.opened':
      await handleEmailOpened(data);
      break;
    case 'message.link_clicked':
      await handleLinkClicked(data);
      break;
    case 'thread.replied':
      await handleThreadReplied(data);
      break;
    case 'message.bounce_detected':
      await handleBounce(data);
      break;
  }
};

async function handleEmailOpened(data: MessageOpenedData) {
  const { grantId, messageId } = data;

  // 1. 이메일에서 리드 정보 조회
  const emailRecord = await findEmailByMessageId(messageId);
  if (!emailRecord?.leadId) return;

  // 2. Redis State 업데이트 (실시간)
  await campaignStateService.incrementMetric(grantId, emailRecord.leadId, 'openCount');

  // 3. Campaign 전체 메트릭 증가
  if (emailRecord.sequenceId) {
    await redisConnection.hincrby(
      `campaign:${grantId}:metrics:${emailRecord.sequenceId}`,
      'openCount',
      1
    );
  }
}

async function handleThreadReplied(data: ThreadRepliedData) {
  const { grantId, threadId } = data;

  // 1. Thread로 Enrollment 조회
  const enrollment = await findEnrollmentByThreadId(threadId);
  if (!enrollment) return;

  // 2. Redis State에 답장 표시
  await campaignStateService.markAsReplied(grantId, enrollment.leadId);

  // 3. 해당 리드의 예약된 Job 모두 취소
  const pendingJobs = await campaignEmailQueue.getJobs(['delayed', 'waiting']);
  for (const job of pendingJobs) {
    if (job.data.leadId === enrollment.leadId) {
      await job.remove();
    }
  }

  // 4. Enrollment 상태 업데이트 (DB)
  await updateEnrollmentStatus(enrollment.id, 'completed', 'Lead replied');
}
```

#### 5.2 평가
| 항목 | 평가 | 설명 |
|------|------|------|
| **최적성** | ✅ 최적 | 답장 시 즉시 Job 취소로 불필요한 발송 방지 |
| **리스크** | 🟡 중간 | Job 제거 시 Race Condition 가능 |
| **대안** | Job에 checkReply flag 추가 후 Worker에서 확인 |

---

### Phase 6: Monitoring & Dashboard
**예상 작업량:** 보조 작업

#### 6.1 Bull Board 통합

```typescript
// src/plugins/bull-board.plugin.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ElysiaAdapter } from '@bull-board/elysia';
import {
  campaignEmailQueue,
  metricsSyncQueue
} from '../lib/queue/queues';

export function setupBullBoard(app: Elysia) {
  const serverAdapter = new ElysiaAdapter('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(campaignEmailQueue),
      new BullMQAdapter(metricsSyncQueue),
    ],
    serverAdapter,
  });

  app.use(serverAdapter.registerPlugin());

  return app;
}
```

#### 6.2 메트릭 API

```typescript
// src/routes/metrics.routes.ts
export const metricsRoutes = new Elysia({ prefix: '/metrics' })
  .get('/queues', async () => {
    const [emailWaiting, emailActive, emailDelayed, emailFailed] = await Promise.all([
      campaignEmailQueue.getWaitingCount(),
      campaignEmailQueue.getActiveCount(),
      campaignEmailQueue.getDelayedCount(),
      campaignEmailQueue.getFailedCount(),
    ]);

    return {
      campaignEmail: {
        waiting: emailWaiting,
        active: emailActive,
        delayed: emailDelayed,
        failed: emailFailed,
      },
    };
  })
  .get('/campaigns/:id/realtime', async ({ params }) => {
    // Redis에서 실시간 메트릭 조회
    const metrics = await campaignStateService.getCampaignMetrics(
      params.nylasAccountId,
      params.id
    );
    return metrics;
  });
```

#### 6.3 평가
| 항목 | 평가 | 설명 |
|------|------|------|
| **최적성** | ✅ 최적 | Bull Board는 BullMQ 공식 대시보드 |
| **리스크** | 🟢 낮음 | 인증 추가 필요 (Admin 전용) |
| **대안** | Grafana + Prometheus (더 상세한 모니터링) |

---

### Phase 7: Database Schema Updates
**예상 작업량:** 필수 작업

#### 7.1 Migration 추가

```typescript
// drizzle/migrations/add_bullmq_job_tracking.sql
ALTER TABLE sequence_step_executions
ADD COLUMN bullmq_job_id VARCHAR(255);

ALTER TABLE sequence_step_executions
ADD COLUMN job_scheduled_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_step_executions_job_id
ON sequence_step_executions(bullmq_job_id);

-- Campaign 실시간 메트릭 캐시 (PostgreSQL 백업용)
ALTER TABLE sequences
ADD COLUMN cached_metrics JSONB DEFAULT '{}';

ALTER TABLE sequences
ADD COLUMN metrics_synced_at TIMESTAMP WITH TIME ZONE;
```

#### 7.2 Schema 업데이트

```typescript
// src/db/schema/sequences.ts 추가
export const sequenceStepExecutions = pgTable('sequence_step_executions', {
  // ... 기존 필드
  bullmqJobId: varchar('bullmq_job_id', { length: 255 }),
  jobScheduledAt: timestamp('job_scheduled_at', { withTimezone: true }),
});

export const sequences = pgTable('sequences', {
  // ... 기존 필드
  cachedMetrics: jsonb('cached_metrics').$type<{
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalReplied: number;
    totalBounced: number;
    updatedAt: string;
  }>(),
  metricsSyncedAt: timestamp('metrics_synced_at', { withTimezone: true }),
});
```

#### 7.3 평가
| 항목 | 평가 | 설명 |
|------|------|------|
| **최적성** | ✅ 최적 | 최소한의 스키마 변경으로 Job 추적 가능 |
| **리스크** | 🟢 낮음 | 기존 데이터 영향 없음 |
| **대안** | 별도 job_tracking 테이블 (더 상세한 추적) |

---

### Phase 8: Frontend Updates
**예상 작업량:** 보조 작업

#### 8.1 실시간 메트릭 표시

```typescript
// admin/src/pages/sequences/CampaignOverview.tsx
import { useQuery } from '@tanstack/react-query';

export function CampaignOverview({ campaignId }: { campaignId: string }) {
  // 실시간 메트릭 (Redis → API)
  const { data: realtimeMetrics } = useQuery({
    queryKey: ['campaign-metrics-realtime', campaignId],
    queryFn: () => api.getCampaignRealtimeMetrics(campaignId),
    refetchInterval: 10000, // 10초마다 갱신
  });

  // 기존 상세 데이터 (PostgreSQL)
  const { data: campaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.getCampaign(campaignId),
  });

  return (
    <div>
      <MetricsCards metrics={realtimeMetrics} />
      <CampaignDetails campaign={campaign} />
    </div>
  );
}
```

#### 8.2 Queue 상태 표시 (Admin)

```typescript
// admin/src/pages/admin/QueueDashboard.tsx
export function QueueDashboard() {
  const { data: queueStatus } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => api.getQueueMetrics(),
    refetchInterval: 5000,
  });

  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard title="대기 중" value={queueStatus?.campaignEmail.waiting} />
      <MetricCard title="처리 중" value={queueStatus?.campaignEmail.active} />
      <MetricCard title="예약됨" value={queueStatus?.campaignEmail.delayed} />
      <MetricCard title="실패" value={queueStatus?.campaignEmail.failed} />
    </div>
  );
}
```

#### 8.3 평가
| 항목 | 평가 | 설명 |
|------|------|------|
| **최적성** | ✅ 최적 | 기존 React Query 패턴 활용 |
| **리스크** | 🟢 낮음 | UI만 추가, 기존 기능 영향 없음 |
| **대안** | WebSocket (더 실시간) |

---

## 5. Phase Evaluation Summary

| Phase | 중요도 | 복잡도 | 최적성 | 비고 |
|-------|--------|--------|--------|------|
| **1. Infrastructure** | ⭐⭐⭐ | 🔵 낮음 | ✅ 최적 | 기초 설정 |
| **2. Queue Architecture** | ⭐⭐⭐ | 🟡 중간 | ✅ 최적 | 핵심 기능 |
| **3. Worker Implementation** | ⭐⭐⭐ | 🟡 중간 | ✅ 최적 | 핵심 기능 |
| **4. State Management** | ⭐⭐⭐ | 🔵 낮음 | ✅ 최적 | 실시간 상태 |
| **5. Webhook Integration** | ⭐⭐⭐ | 🟡 중간 | ✅ 최적 | 이벤트 처리 |
| **6. Monitoring** | ⭐⭐ | 🔵 낮음 | ✅ 최적 | 운영 도구 |
| **7. DB Schema** | ⭐⭐⭐ | 🔵 낮음 | ✅ 최적 | 데이터 모델 |
| **8. Frontend** | ⭐⭐ | 🔵 낮음 | ✅ 최적 | UI 개선 |

### Recommended Order
```
1 → 7 → 2 → 3 → 4 → 5 → 6 → 8
```

Infrastructure와 DB Schema를 먼저 준비한 후, 핵심 Queue/Worker를 구현하고, 나머지 기능을 순차적으로 추가

---

## 6. Risk Assessment

### High Risk
| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| Redis 장애 | Job 처리 중단 | Redis Sentinel 또는 Cluster 구성 |
| 대량 Job 메모리 | OOM 가능 | Chunk 단위 Insert (10K씩) |

### Medium Risk
| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| Rate Limit 초과 | Nylas API 차단 | Worker limiter 설정 조정 |
| Job 중복 실행 | 이메일 중복 발송 | Job ID로 유니크 보장 |
| 동기화 지연 | 데이터 불일치 | Sync 주기 조정 (1분) |

### Low Risk
| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| Dashboard 접근 | 보안 이슈 | Admin 인증 추가 |
| TTL 만료 | 상태 유실 | PostgreSQL 백업으로 복구 |

---

## 7. Implementation Checklist

### Phase 1: Infrastructure
- [ ] `bullmq`, `ioredis` 패키지 설치
- [ ] Redis connection 설정 파일 생성
- [ ] 환경 변수 추가 (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD)
- [ ] Docker Compose에 Redis 볼륨 확인

### Phase 2: Queue Architecture
- [ ] Queue 정의 파일 생성
- [ ] Job 타입 정의
- [ ] `campaignEmailQueue` 인스턴스 생성
- [ ] `metricsSyncQueue` 인스턴스 생성
- [ ] `scheduleCampaignBatch` 함수 구현

### Phase 3: Worker Implementation
- [ ] `campaignEmailWorker` 구현
- [ ] `metricsSyncWorker` 구현
- [ ] Worker 이벤트 핸들러 추가
- [ ] Worker 시작 로직 (index.ts)

### Phase 4: State Management
- [ ] `CampaignStateService` 클래스 구현
- [ ] Lead State 관리 함수
- [ ] Campaign Metrics 관리 함수
- [ ] TTL 설정 (35일)

### Phase 5: Webhook Integration
- [ ] `handleEmailOpened` 업데이트
- [ ] `handleLinkClicked` 업데이트
- [ ] `handleThreadReplied` 업데이트 + Job 취소
- [ ] `handleBounce` 업데이트

### Phase 6: Monitoring
- [ ] Bull Board 설치 및 설정
- [ ] Queue metrics API 추가
- [ ] Admin 인증 추가

### Phase 7: Database Schema
- [ ] Migration 파일 생성
- [ ] Schema 타입 업데이트
- [ ] Migration 실행

### Phase 8: Frontend
- [ ] 실시간 메트릭 컴포넌트 추가
- [ ] Queue 상태 대시보드 추가
- [ ] API 타입 업데이트

---

## Appendix: File Structure After Implementation

```
elysia-server/src/
├── lib/
│   ├── redis/
│   │   └── connection.ts          # NEW
│   └── queue/
│       ├── queues.ts              # NEW
│       └── types.ts               # NEW
├── workers/
│   ├── bullmq/                    # NEW Directory
│   │   ├── campaign-email.worker.ts
│   │   ├── metrics-sync.worker.ts
│   │   └── index.ts
│   └── ... (기존 workers)
├── services/
│   ├── campaign-state.service.ts  # NEW
│   ├── campaign-scheduler.service.ts  # NEW
│   └── ... (기존 services)
├── routes/
│   ├── metrics.routes.ts          # NEW
│   └── ... (기존 routes)
├── plugins/
│   ├── bull-board.plugin.ts       # NEW
│   └── ... (기존 plugins)
└── db/
    └── schema/
        └── sequences.ts           # MODIFIED
```

---

*Document generated: 2024*
*Last updated: [Current Date]*
