# BullMQ Architecture and Working Principles Guide

## Table of Contents
1. [What is BullMQ?](#what-is-bullmq)
2. [Core Concepts](#core-concepts)
3. [Architecture Structure](#architecture-structure)
4. [Working Principles](#working-principles)
5. [Job Lifecycle](#job-lifecycle)
6. [Redis Data Structures](#redis-data-structures)
7. [Advanced Features](#advanced-features)
8. [Performance Optimization](#performance-optimization)
9. [Failure Handling](#failure-handling)
10. [Comparison with Other Queue Systems](#comparison-with-other-queue-systems)

---

## What is BullMQ?

### Definition
BullMQ is a **Redis-based Node.js/TypeScript message queue library**. It provides powerful features for background job processing, scheduling, and distributed processing.

### Why BullMQ?

| Feature | Description |
|---------|-------------|
| **Redis-based** | High performance, persistence, clustering support |
| **TypeScript** | Full type support |
| **Reliability** | Job loss prevention, exactly-once execution guarantee |
| **Scalability** | Multi-worker, easy horizontal scaling |
| **Flexibility** | Priority, delay, repeat, Rate Limiting |

### Bull vs BullMQ

```
Bull (v3)          →     BullMQ (v5+)
────────────────────────────────────────
Callback-based           Promise/async-based
Single connection        Multiple connections (improved performance)
Limited features         Added Flow, Rate Limiter, etc.
Legacy                   Active development
```

---

## Core Concepts

### 1. Queue

```typescript
import { Queue } from 'bullmq'

// Queue = Storage where Jobs wait
const emailQueue = new Queue('email', {
  connection: redisConnection
})
```

**Roles:**
- Job storage and management
- Add jobs (add)
- Query jobs (getJob, getJobs)
- Queue state management (pause, resume, clean)

### 2. Job

```typescript
// Job = Unit of work to be executed
const job = await emailQueue.add('send-email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'World'
}, {
  delay: 5000,      // Execute after 5 seconds
  priority: 1,      // Priority (lower = higher)
  attempts: 3,      // Max retry count
})

console.log(job.id)  // Unique Job ID
```

**Job Properties:**
| Property | Description |
|----------|-------------|
| `id` | Unique identifier |
| `name` | Job type name |
| `data` | Actual work data |
| `opts` | Options (delay, priority, etc.) |
| `progress` | Progress (0-100) |
| `returnvalue` | Return value after completion |
| `failedReason` | Failure reason |

### 3. Worker

```typescript
import { Worker } from 'bullmq'

// Worker = Processor that actually processes Jobs
const worker = new Worker('email', async (job) => {
  // Email sending logic
  await sendEmail(job.data)

  // Update progress
  await job.updateProgress(50)

  // Return result (stored in returnvalue)
  return { sent: true, messageId: 'msg_123' }
}, {
  connection: redisConnection,
  concurrency: 5  // Concurrent processing count
})
```

**Worker Characteristics:**
- Can run as independent process
- Multi-instance support (horizontal scaling)
- Auto-reconnect
- Error handling

### 4. QueueEvents

```typescript
import { QueueEvents } from 'bullmq'

// Queue event listener
const queueEvents = new QueueEvents('email', {
  connection: redisConnection
})

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed:`, returnvalue)
})

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason)
})

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId} progress:`, data)
})
```

---

## Architecture Structure

### Overall Structure Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Producer                                     │
│                                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│   │   API       │    │   Cron      │    │   Event     │               │
│   │   Server    │    │   Scheduler │    │   Handler   │               │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘               │
│          │                  │                  │                       │
│          └─────────────────┬┴──────────────────┘                       │
│                            │                                           │
│                            ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────┐ │
│   │                        Queue                                     │ │
│   │                     queue.add(job)                               │ │
│   └─────────────────────────────┬───────────────────────────────────┘ │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Redis                                      │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────────┐│
│   │                         Queue Data                                 ││
│   │                                                                    ││
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ ││
│   │  │ waiting │  │ active  │  │completed│  │ failed  │  │ delayed │ ││
│   │  │  List   │  │  List   │  │   Set   │  │   Set   │  │  ZSet   │ ││
│   │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ ││
│   │                                                                    ││
│   │  ┌─────────────────────────────────────────────────────────────┐  ││
│   │  │                      Job Data (Hash)                        │  ││
│   │  │  bull:email:123 → { data, opts, progress, returnvalue }     │  ││
│   │  └─────────────────────────────────────────────────────────────┘  ││
│   └───────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Consumer                                      │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐ │
│   │                        Worker Pool                               │ │
│   │                                                                  │ │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│   │  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │  │ Worker N │        │ │
│   │  │ (con=5)  │  │ (con=5)  │  │ (con=5)  │  │ (con=5)  │        │ │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │ │
│   │       │             │             │             │               │ │
│   │       └─────────────┴─────────────┴─────────────┘               │ │
│   │                            │                                     │ │
│   │                            ▼                                     │ │
│   │                   Process Job & Return Result                    │ │
│   └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### Producer
- Role of adding Jobs to queue
- Jobs can be created from multiple sources
- Uses `queue.add()` method

#### Redis
- Central storage for all data
- Stores Job state, data, metadata
- Provides distributed locks and synchronization

#### Consumer (Worker)
- Fetches and executes Jobs
- Concurrency control
- Horizontal scaling with multiple instances

---

## Working Principles

### Job Processing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Job Processing Flow                          │
└─────────────────────────────────────────────────────────────────────┘

1. Job Addition (Producer)
   │
   │  queue.add('send-email', { to: 'user@test.com' })
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Redis Storage                                                      │
│  ─────────────                                                      │
│  HMSET bull:email:job:123 data {...} opts {...}                     │
│  ZADD  bull:email:wait 123  (priority sorted)                       │
└─────────────────────────────────────────────────────────────────────┘
   │
   ▼
2. Job Waiting
   │
   │  Redis List: bull:email:wait → [123, 124, 125, ...]
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Worker Polling (BRPOPLPUSH)                                        │
│  ─────────────────────────────                                      │
│  BRPOPLPUSH bull:email:wait bull:email:active 5                     │
│  (blocking pop → atomic move to active)                             │
└─────────────────────────────────────────────────────────────────────┘
   │
   ▼
3. Job Execution (Active)
   │
   │  Worker reads Job data and starts processing
   │  Redis: bull:email:active → [123]
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Job Processing (Worker)                                            │
│  ──────────────────                                                 │
│  const result = await processor(job)                                │
│                                                                     │
│  try {                                                              │
│    await sendEmail(job.data)                                        │
│    return { success: true }     // → Completed                      │
│  } catch (error) {                                                  │
│    throw error                  // → Failed (retry or fail)         │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
   │
   ├─── Success ───►  4a. Completed
   │                      │
   │                      │  ZADD bull:email:completed 123
   │                      │  HMSET bull:email:job:123 returnvalue {...}
   │                      │
   │                      ▼
   │                 Event emitted: 'completed'
   │
   └─── Failure ───►  4b. Failed or Retry
                          │
                          ├─── attempts remaining ───► Retry (back to wait)
                          │                            delay: exponential backoff
                          │
                          └─── attempts exhausted ───► Failed
                                                       ZADD bull:email:failed 123
                                                       Event emitted: 'failed'
```

### Delayed Job Processing

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Delayed Job Processing Flow                      │
└─────────────────────────────────────────────────────────────────────┘

1. Delayed Job Addition
   │
   │  queue.add('task', data, { delay: 60000 })  // Execute after 1 min
   │
   ▼
2. Store in Redis Sorted Set
   │
   │  ZADD bull:email:delayed {score: timestamp+60000} 123
   │  (score = scheduled execution time)
   │
   ▼
3. Delayed Job Watch Loop (inside Worker)
   │
   │  while (true) {
   │    // Query Jobs with score less than current time
   │    jobs = ZRANGEBYSCORE bull:email:delayed -inf {now}
   │
   │    for (job of jobs) {
   │      // Move delayed → wait
   │      ZREM bull:email:delayed {jobId}
   │      ZADD bull:email:wait {priority} {jobId}
   │    }
   │
   │    sleep(1000)  // Wait 1 second
   │  }
   │
   ▼
4. Transition to Wait State
   │
   │  Now processed like normal Job
   │
   ▼
5. Worker Processes
```

### Rate Limiting Operation

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Rate Limiter Principles                          │
└─────────────────────────────────────────────────────────────────────┘

Configuration:
  limiter: {
    max: 10,           // Max 10
    duration: 60000    // During 1 minute (60 seconds)
  }

Operation:
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Time ─────────────────────────────────────────────────────────►   │
│                                                                     │
│   0s         10s        20s        30s        40s        50s        │
│   │          │          │          │          │          │          │
│   ▼          ▼          ▼          ▼          ▼          ▼          │
│   ████       ████       ░░░░       ░░░░       ████       ████       │
│   10 jobs    10 jobs    waiting    waiting    10 jobs    10 jobs    │
│   processed  processed  (limit     (limit     processed  processed  │
│                        reached)   reached)                          │
│                                                                     │
│   Rate Limit Window (Sliding Window)                                │
│   └──────────── 60 seconds ────────────┘                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Implementation (Redis Lua Script):

  -- Token Bucket Algorithm
  local key = 'bull:email:limiter'
  local now = tonumber(ARGV[1])
  local duration = tonumber(ARGV[2])
  local max = tonumber(ARGV[3])

  -- Remove old tokens
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - duration)

  -- Check current token count
  local count = redis.call('ZCARD', key)

  if count < max then
    -- Add token (allow processing)
    redis.call('ZADD', key, now, job_id)
    return 1  -- allowed
  else
    return 0  -- blocked
  end
```

---

## Job Lifecycle

### State Diagram

```
                                    ┌─────────────┐
                                    │   Created   │
                                    │  (memory)   │
                                    └──────┬──────┘
                                           │
                      ┌────────────────────┼────────────────────┐
                      │                    │                    │
                      ▼                    ▼                    ▼
               ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
               │   Delayed   │     │   Waiting   │     │  Prioritized│
               │ (scheduled) │     │  (waiting)  │     │  (priority) │
               └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
                      │                    │                    │
                      │   schedule time    │                    │
                      └─────────┬─────────┘────────────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │   Active    │
                         │ (processing)│
                         └──────┬──────┘
                                │
                   ┌────────────┼────────────┐
                   │            │            │
                   ▼            ▼            ▼
            ┌─────────────┐ ┌─────────┐ ┌─────────────┐
            │  Completed  │ │ Stalled │ │   Failed    │
            │  (done)     │ │ (stuck) │ │  (failed)   │
            └─────────────┘ └────┬────┘ └──────┬──────┘
                                 │             │
                                 │   retryable │  retryable
                                 │   ?         │  ?
                                 │             │
                                 ▼             ▼
                          ┌─────────────────────────┐
                          │        Waiting          │
                          │     (retry waiting)     │
                          └─────────────────────────┘
```

### State Descriptions

| State | Redis Structure | Description |
|-------|-----------------|-------------|
| **waiting** | List | Jobs waiting to be processed |
| **active** | List | Jobs currently being processed |
| **delayed** | Sorted Set | Scheduled jobs (score = execution time) |
| **completed** | Set | Successfully completed jobs |
| **failed** | Set | Failed jobs |
| **paused** | List | Jobs waiting when queue is paused |
| **stalled** | - | Jobs stuck due to worker crash |

### Stalled Job Handling

```typescript
// Jobs become "stalled" when Worker unexpectedly terminates
// BullMQ automatically detects and reprocesses

// Configuration
const worker = new Worker('email', processor, {
  stalledInterval: 30000,  // Check every 30 seconds
  maxStalledCount: 1,      // Fail after 1 stall
})

// Stalled event listening
worker.on('stalled', (jobId, prev) => {
  console.log(`Job ${jobId} has stalled`)
})
```

---

## Redis Data Structures

### Key Naming Convention

```
bull:{queueName}:{type}:{id}

Examples:
bull:email:id              → Next Job ID (Counter)
bull:email:waiting         → Waiting Job ID list (List)
bull:email:active          → Processing Job ID list (List)
bull:email:delayed         → Scheduled Jobs (Sorted Set)
bull:email:completed       → Completed Jobs (Set)
bull:email:failed          → Failed Jobs (Set)
bull:email:paused          → Paused Jobs (List)
bull:email:{jobId}         → Job data (Hash)
bull:email:meta            → Queue metadata (Hash)
```

### Job Hash Structure

```
bull:email:123
├── name           : "send-email"
├── data           : '{"to":"user@test.com","subject":"Hello"}'
├── opts           : '{"delay":0,"attempts":3,"priority":5}'
├── progress       : 0
├── delay          : 0
├── priority       : 5
├── timestamp      : 1702723200000
├── attemptsMade   : 0
├── stacktrace     : '[]'
├── returnvalue    : '{"success":true}'
├── finishedOn     : 1702723205000
└── processedOn    : 1702723201000
```

### Redis Command Examples

```bash
# Query Job data
HGETALL bull:email:123

# Waiting Jobs list
LRANGE bull:email:waiting 0 -1

# Scheduled Jobs (time sorted)
ZRANGE bull:email:delayed 0 -1 WITHSCORES

# Queue statistics
LLEN bull:email:waiting       # Waiting
LLEN bull:email:active        # Processing
SCARD bull:email:completed    # Completed
SCARD bull:email:failed       # Failed
ZCARD bull:email:delayed      # Scheduled
```

---

## Advanced Features

### 1. Job Priority

```typescript
// Lower number = Higher priority
await queue.add('urgent', data, { priority: 1 })   // Process first
await queue.add('normal', data, { priority: 5 })   // Normal
await queue.add('low', data, { priority: 10 })     // Process later

// Priority queue internal operation
// Redis: ZADD bull:email:priority-wait {score} {jobId}
// score = priority * timestamp → priority + time order
```

### 2. Repeatable Jobs

```typescript
// Execute daily at 9 AM
await queue.add('daily-report', { type: 'daily' }, {
  repeat: {
    pattern: '0 9 * * *',  // cron expression
    tz: 'Asia/Seoul'
  }
})

// Execute every 5 minutes
await queue.add('health-check', {}, {
  repeat: {
    every: 5 * 60 * 1000  // 5 minutes (milliseconds)
  }
})

// Manage repeatable jobs
const repeatableJobs = await queue.getRepeatableJobs()
await queue.removeRepeatableByKey(repeatableJobs[0].key)
```

### 3. Job Flow (Parent-Child Relationship)

```typescript
import { FlowProducer } from 'bullmq'

const flowProducer = new FlowProducer({ connection: redisConnection })

// Create Job chain with dependencies
const flow = await flowProducer.add({
  name: 'final-step',
  queueName: 'email',
  data: { type: 'complete' },
  children: [
    {
      name: 'step-1',
      queueName: 'email',
      data: { type: 'prepare' },
    },
    {
      name: 'step-2',
      queueName: 'email',
      data: { type: 'validate' },
    },
  ]
})

// Processing order:
// 1. step-1, step-2 run in parallel
// 2. When both complete, final-step runs
```

### 4. Events and Progress

```typescript
// Update progress in Worker
const worker = new Worker('email', async (job) => {
  for (let i = 0; i <= 100; i += 10) {
    await someWork()
    await job.updateProgress(i)  // 0, 10, 20, ... 100
  }
  return { done: true }
})

// Monitor progress
const queueEvents = new QueueEvents('email')

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId}: ${data}% complete`)
})
```

### 5. Backpressure

```typescript
// Backpressure for memory protection
const worker = new Worker('email', processor, {
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000,  // Limit to 100 per minute
  }
})

// Dynamic concurrency adjustment
worker.concurrency = 10  // Can be changed at runtime
```

---

## Performance Optimization

### 1. Connection Pooling

```typescript
// Correct way: Reuse connection
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Use same connection for all queues/workers
const queue1 = new Queue('q1', { connection })
const queue2 = new Queue('q2', { connection })
const worker = new Worker('q1', processor, { connection })
```

### 2. Batch Processing

```typescript
// Add multiple Jobs at once
await queue.addBulk([
  { name: 'email', data: { to: 'a@test.com' } },
  { name: 'email', data: { to: 'b@test.com' } },
  { name: 'email', data: { to: 'c@test.com' } },
])
```

### 3. Memory Management

```typescript
// Auto-delete completed/failed Jobs
const queue = new Queue('email', {
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600,     // Delete after 1 hour
      count: 1000,   // Keep max 1000
    },
    removeOnFail: {
      age: 86400,    // Delete after 24 hours
    }
  }
})
```

### 4. Concurrency Tuning

```
┌─────────────────────────────────────────────────────────────────┐
│                    Concurrency Guidelines                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Task Type          Recommended Concurrency    Reason           │
│  ─────────────────────────────────────────────────────────────  │
│  CPU-intensive      = CPU core count           Maximize parallel│
│  I/O-intensive(API) 10-50                      Utilize wait time│
│  Email sending      5-10                       Consider rate    │
│  File processing    2-5                        Disk I/O bottleneck│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Failure Handling

### 1. Retry Strategy

```typescript
// Exponential Backoff
queue.add('task', data, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,  // 1s, 2s, 4s, 8s, 16s
  }
})

// Fixed Delay
queue.add('task', data, {
  attempts: 3,
  backoff: {
    type: 'fixed',
    delay: 5000,  // Always retry after 5 seconds
  }
})

// Custom Backoff
queue.add('task', data, {
  attempts: 3,
  backoff: {
    type: 'custom',
  }
})

// Calculate custom delay in Worker
const worker = new Worker('task', processor, {
  settings: {
    backoffStrategy: (attemptsMade) => {
      return attemptsMade * 10000  // 10s, 20s, 30s...
    }
  }
})
```

### 2. Error Handling

```typescript
const worker = new Worker('email', async (job) => {
  try {
    await sendEmail(job.data)
  } catch (error) {
    // Retryable error
    if (error.code === 'RATE_LIMIT') {
      throw new Error('Rate limited, will retry')
    }

    // Non-retryable error (fail immediately)
    if (error.code === 'INVALID_EMAIL') {
      throw new UnrecoverableError('Invalid email address')
    }

    throw error
  }
})

// Certain errors should not retry
import { UnrecoverableError } from 'bullmq'

throw new UnrecoverableError('This will not be retried')
```

### 3. Failure Recovery

```typescript
// Stalled Job auto-recovery on Worker restart
const worker = new Worker('email', processor, {
  stalledInterval: 30000,  // Check every 30 seconds
  maxStalledCount: 1,      // Allow 1 stall
})

// Manual recovery
async function recoverStalledJobs() {
  const stalledJobs = await queue.getJobs(['stalled'])
  for (const job of stalledJobs) {
    await job.retry()
  }
}
```

### 4. Dead Letter Queue (DLQ)

```typescript
// Move finally failed Jobs to separate queue
worker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= job.opts.attempts) {
    // Move to dead letter queue
    const dlq = new Queue('email:dlq', { connection })
    await dlq.add('failed-email', {
      originalJob: job.data,
      error: err.message,
      failedAt: new Date(),
    })
  }
})
```

---

## Comparison with Other Queue Systems

### Comparison Table

| Feature | BullMQ | RabbitMQ | AWS SQS | Kafka |
|---------|--------|----------|---------|-------|
| **Storage** | Redis | Self | AWS | Self |
| **Protocol** | Redis | AMQP | HTTP | Custom |
| **Delayed Jobs** | Yes | Yes (plugin) | Yes | No |
| **Priority** | Yes | Yes | No | No |
| **Rate Limit** | Yes | No | No | No |
| **Repeatable** | Yes | No | No | No |
| **Job Flow** | Yes | No | No | No |
| **Setup Complexity** | Low | Medium | Low | High |
| **Scalability** | Medium | High | High | Very High |
| **Order Guarantee** | FIFO | FIFO | No | Within partition |
| **Use Case** | Job Queue | Messaging | Messaging | Streaming |

### Selection Guide

```
┌─────────────────────────────────────────────────────────────────┐
│                       When to Choose What?                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BullMQ                                                         │
│  └── Node.js environment                                        │
│  └── Job scheduling needed                                      │
│  └── Rate Limiting needed                                       │
│  └── Already using Redis                                        │
│  └── Medium scale (thousands of jobs/sec)                       │
│                                                                 │
│  RabbitMQ                                                       │
│  └── Multi-language/platform integration                        │
│  └── Complex routing needed                                     │
│  └── Message broker patterns                                    │
│  └── High availability needed                                   │
│                                                                 │
│  AWS SQS                                                        │
│  └── AWS ecosystem                                              │
│  └── Prefer managed service                                     │
│  └── Serverless architecture                                    │
│  └── Simple queue features only                                 │
│                                                                 │
│  Kafka                                                          │
│  └── High-volume event streaming                                │
│  └── Real-time analytics                                        │
│  └── Event sourcing                                             │
│  └── Hundreds of thousands messages/sec                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

### BullMQ Key Points

1. **Redis-based**: Fast and reliable message queue
2. **Job Lifecycle**: waiting → active → completed/failed
3. **Rate Limiting**: Token Bucket algorithm for throughput control
4. **Delayed Jobs**: Sorted Set for scheduled execution management
5. **Worker Concurrency**: Adjustable concurrent processing
6. **Retry Strategy**: Exponential Backoff for stable recovery
7. **Monitoring**: Real-time status check with Bull Board

### Usage in This Project

```
┌─────────────────────────────────────────────────────────────────┐
│                    Email Scheduling System                       │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ Per-account │    │ Business    │    │ Auto       │         │
│  │ 20/day      │───►│ hours       │───►│ retry      │         │
│  │ limit       │    │ (9-18)      │    │            │         │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│        │                  │                  │                 │
│        ▼                  ▼                  ▼                 │
│  Rate Limiter       Delayed Jobs      Backoff Strategy         │
│  (Redis Counter)    (Sorted Set)      (Exponential)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## References

- [BullMQ Official Documentation](https://docs.bullmq.io/)
- [Redis Official Documentation](https://redis.io/documentation)
- [Bull Board GitHub](https://github.com/felixmosh/bull-board)
- [Node.js Event Loop](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick)
