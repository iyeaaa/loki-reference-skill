# BullMQ Architecture

## Overview

| Item | Value |
|------|-------|
| Package | `bullmq@^5.66.0` + `ioredis@^5.8.2` |
| Location | `/elysia-server/` |
| Queues | 6 (2 active, 4 not implemented) |
| Workers | 2 (TestWorker, OnboardingWorker) |

---

## Queue List

| Queue Name | Purpose | Retry | Status |
|------------|---------|-------|--------|
| `test-queue` | BullMQ testing | 3 | Active |
| `onboarding-generation` | Onboarding auto-generation | 3 | Active |
| `campaign-email` | Campaign email sending | 3 | Not implemented |
| `scheduled-email` | Scheduled email | 2 | Not implemented |
| `workflow-step` | Workflow automation | 3 | Not implemented |
| `metrics-sync` | Metrics synchronization | 2 | Not implemented |

---

## Workers

### Test Worker

**File**: `elysia-server/src/workers/bullmq/test.worker.ts`

| Setting | Value |
|---------|-------|
| concurrency | 20 |
| limiter | 50/sec |
| backoff | exponential, 1s |

**Flow**:
1. Job start -> DB logging (job_logs)
2. Delay simulation (processingDelay)
3. Failure simulation (shouldFail)
4. Complete -> DB update

### Onboarding Worker

**File**: `elysia-server/src/workers/bullmq/onboarding-auto-generate.worker.ts`

| Setting | Value |
|---------|-------|
| concurrency | 1 (API rate limit) |
| lockDuration | 10 min |
| backoff | exponential, 2 min |

**Phase-based Processing**:

| Phase | Task | Progress |
|-------|------|----------|
| 1 | Discovery - Lead search/enrichment | 30% |
| 2 | Group - Customer group creation | 50% |
| 3 | Templates - Email template generation | 65% |
| 4 | Sequence - Email sequence creation | 80% |
| 5 | Previews - Preview generation | 95% |
| 6 | Complete - Finalization | 100% |

**Checkpoint System**: Resumes from last completed phase on server restart

---

## Data Flow

### Test Job

```
[API] POST /api/v1/bullmq-test/jobs
    |
    v
[addTestJob()] -> Redis Queue
    |
    v
[TestWorker] processTestJob()
    |
    v
[DB] job_logs table update
```

### Onboarding Job

```
[Frontend] POST /api/v1/onboarding/.../start-discovery
    |
    v
[addOnboardingJob()] -> Redis Queue (deduplication)
    |
    v
[OnboardingWorker] 6 Phases sequential execution
    | (SSE real-time)
    v
[Frontend] Progress display
    |
    v
[DB] leads, customer_groups, sequences, emails created
```

---

## File Locations

| Function | Path |
|----------|------|
| Queue definitions | `elysia-server/src/lib/queue/queues.ts` |
| Type definitions | `elysia-server/src/lib/queue/types.ts` |
| Redis connection | `elysia-server/src/lib/redis/connection.ts` |
| Worker entry | `elysia-server/src/worker.ts` |
| Test Worker | `elysia-server/src/workers/bullmq/test.worker.ts` |
| Onboarding Worker | `elysia-server/src/workers/bullmq/onboarding-auto-generate.worker.ts` |
| BullMQ Routes | `elysia-server/src/routes/bullmq-test.routes.ts` |
| Onboarding Routes | `elysia-server/src/routes/onboarding.routes.ts` |
| Job Log Service | `elysia-server/src/services/job-log.service.ts` |
| Job Log Schema | `elysia-server/src/db/schema/job-logs.ts` |

---

## API Endpoints

### BullMQ Test (`/api/v1/bullmq-test`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Redis connection check |
| GET | `/queues` | All queue status |
| GET | `/queues/test` | Test queue details |
| POST | `/jobs` | Add single job |
| POST | `/jobs/bulk` | Add bulk jobs |
| GET | `/jobs/:jobId` | Get job details |
| POST | `/jobs/:jobId/retry` | Retry failed job |
| DELETE | `/jobs/:jobId` | Delete job |
| GET | `/stream` | SSE stream |

### Onboarding (`/api/v1/onboarding`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workspace/:id/start-discovery` | Start job |
| GET | `/workspace/:id/stream` | Progress SSE |
| GET | `/workspace/:id` | Get status |

---

## Key Features

| Feature | Description |
|---------|-------------|
| DB Logging | All job lifecycle recorded in `job_logs` table |
| Checkpoint/Recovery | Resumes from last phase on server restart |
| SSE Streaming | Redis PubSub -> API -> Frontend real-time progress |
| Deduplication | `onboarding-{workspaceId}` job ID prevents duplicates |
| Graceful Shutdown | Safely completes in-progress jobs before shutdown |
| Health Monitoring | `/healthz`, `/readyz`, `/metrics` endpoints |

---

## Retry Strategy

| Queue | Attempts | Backoff | Initial Delay |
|-------|----------|---------|---------------|
| campaign-email | 3 | exponential | 60s |
| scheduled-email | 2 | exponential | 60s |
| workflow-step | 3 | exponential | 60s |
| metrics-sync | 2 | exponential | 60s |
| onboarding-generation | 3 | exponential | 120s |
| test-queue | 3 | exponential | 1s |

**Exponential Backoff Example**:
```
Attempt 1 fail -> wait 60s
Attempt 2 fail -> wait 120s
Attempt 3 fail -> wait 240s
Job final failure
```

---

## Running

### Development

```bash
# API + Worker concurrent
bun run dev

# Worker only
bun run dev:worker
```

### Production

```bash
# Start worker
bun run start:worker
```

### Docker Compose

```yaml
api:
  ports: [3000:3000]

bullmq-worker:
  ports: [3010:3010]  # Health server

redis:
  ports: [6379:6379]
```
