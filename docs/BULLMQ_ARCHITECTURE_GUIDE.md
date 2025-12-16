# BullMQ 아키텍처 및 동작 원리 가이드

## 목차
1. [BullMQ란?](#bullmq란)
2. [핵심 개념](#핵심-개념)
3. [아키텍처 구조](#아키텍처-구조)
4. [동작 원리](#동작-원리)
5. [Job 생명주기](#job-생명주기)
6. [Redis 데이터 구조](#redis-데이터-구조)
7. [고급 기능](#고급-기능)
8. [성능 최적화](#성능-최적화)
9. [장애 처리](#장애-처리)
10. [다른 큐 시스템 비교](#다른-큐-시스템-비교)

---

## BullMQ란?

### 정의
BullMQ는 **Redis 기반의 Node.js/TypeScript 메시지 큐 라이브러리**입니다. 백그라운드 작업 처리, 스케줄링, 분산 처리를 위한 강력한 기능을 제공합니다.

### 왜 BullMQ인가?

| 특징 | 설명 |
|------|------|
| **Redis 기반** | 고성능, 영속성, 클러스터링 지원 |
| **TypeScript** | 완벽한 타입 지원 |
| **신뢰성** | Job 손실 방지, 정확히 한 번 실행 보장 |
| **확장성** | 다중 워커, 수평 확장 용이 |
| **유연성** | 우선순위, 지연, 반복, Rate Limiting |

### Bull vs BullMQ

```
Bull (v3)          →     BullMQ (v5+)
────────────────────────────────────────
콜백 기반                Promise/async 기반
단일 연결                다중 연결 (성능 향상)
제한적 기능              Flow, Rate Limiter 등 추가
레거시                   활발한 개발
```

---

## 핵심 개념

### 1. Queue (큐)

```typescript
import { Queue } from 'bullmq'

// 큐 = Job들이 대기하는 저장소
const emailQueue = new Queue('email', {
  connection: redisConnection
})
```

**역할:**
- Job 저장 및 관리
- Job 추가 (add)
- Job 조회 (getJob, getJobs)
- 큐 상태 관리 (pause, resume, clean)

### 2. Job (작업)

```typescript
// Job = 실행해야 할 작업 단위
const job = await emailQueue.add('send-email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'World'
}, {
  delay: 5000,      // 5초 후 실행
  priority: 1,      // 우선순위 (낮을수록 높음)
  attempts: 3,      // 최대 재시도 횟수
})

console.log(job.id)  // 고유 Job ID
```

**Job 속성:**
| 속성 | 설명 |
|------|------|
| `id` | 고유 식별자 |
| `name` | Job 타입 구분용 이름 |
| `data` | 실제 작업 데이터 |
| `opts` | 옵션 (delay, priority 등) |
| `progress` | 진행률 (0-100) |
| `returnvalue` | 완료 후 반환값 |
| `failedReason` | 실패 이유 |

### 3. Worker (워커)

```typescript
import { Worker } from 'bullmq'

// Worker = Job을 실제로 처리하는 프로세서
const worker = new Worker('email', async (job) => {
  // 이메일 발송 로직
  await sendEmail(job.data)

  // 진행률 업데이트
  await job.updateProgress(50)

  // 결과 반환 (returnvalue에 저장)
  return { sent: true, messageId: 'msg_123' }
}, {
  connection: redisConnection,
  concurrency: 5  // 동시 처리 개수
})
```

**Worker 특징:**
- 독립 프로세스로 실행 가능
- 다중 인스턴스 지원 (수평 확장)
- 자동 재연결
- 에러 핸들링

### 4. QueueEvents (이벤트)

```typescript
import { QueueEvents } from 'bullmq'

// 큐 이벤트 리스너
const queueEvents = new QueueEvents('email', {
  connection: redisConnection
})

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} 완료:`, returnvalue)
})

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} 실패:`, failedReason)
})

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId} 진행률:`, data)
})
```

---

## 아키텍처 구조

### 전체 구조도

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Producer (생산자)                            │
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
│   │                        Queue (큐)                                │ │
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
│                           Consumer (소비자)                             │
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

### 구성 요소 상세

#### Producer (생산자)
- Job을 큐에 추가하는 역할
- 여러 소스에서 Job 생성 가능
- `queue.add()` 메서드 사용

#### Redis
- 모든 데이터의 중앙 저장소
- Job 상태, 데이터, 메타데이터 저장
- 분산 락 및 동기화 제공

#### Consumer (소비자/워커)
- Job을 가져와 실행
- 동시성(concurrency) 제어
- 다중 인스턴스 수평 확장

---

## 동작 원리

### Job 처리 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Job 처리 상세 흐름                           │
└─────────────────────────────────────────────────────────────────────┘

1. Job 추가 (Producer)
   │
   │  queue.add('send-email', { to: 'user@test.com' })
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Redis 저장                                                         │
│  ─────────────                                                      │
│  HMSET bull:email:job:123 data {...} opts {...}                     │
│  ZADD  bull:email:wait 123  (우선순위 정렬)                          │
└─────────────────────────────────────────────────────────────────────┘
   │
   ▼
2. Job 대기 (Waiting)
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
3. Job 실행 (Active)
   │
   │  Worker가 Job 데이터를 읽고 처리 시작
   │  Redis: bull:email:active → [123]
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Job 처리 (Worker)                                                  │
│  ──────────────────                                                 │
│  const result = await processor(job)                                │
│                                                                     │
│  try {                                                              │
│    await sendEmail(job.data)                                        │
│    return { success: true }     // → Completed                      │
│  } catch (error) {                                                  │
│    throw error                  // → Failed (재시도 또는 실패)       │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
   │
   ├─── 성공 ───►  4a. Completed
   │                   │
   │                   │  ZADD bull:email:completed 123
   │                   │  HMSET bull:email:job:123 returnvalue {...}
   │                   │
   │                   ▼
   │              이벤트 발행: 'completed'
   │
   └─── 실패 ───►  4b. Failed 또는 재시도
                       │
                       ├─── attempts 남음 ───► 재시도 (wait로 복귀)
                       │                       delay: exponential backoff
                       │
                       └─── attempts 소진 ───► Failed
                                               ZADD bull:email:failed 123
                                               이벤트 발행: 'failed'
```

### Delayed Job 처리

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Delayed Job 처리 흐름                            │
└─────────────────────────────────────────────────────────────────────┘

1. Delayed Job 추가
   │
   │  queue.add('task', data, { delay: 60000 })  // 1분 후 실행
   │
   ▼
2. Redis Sorted Set에 저장
   │
   │  ZADD bull:email:delayed {score: timestamp+60000} 123
   │  (score = 실행 예정 시간)
   │
   ▼
3. Delayed Job 감시 루프 (Worker 내부)
   │
   │  while (true) {
   │    // 현재 시간보다 score가 작은 Job 조회
   │    jobs = ZRANGEBYSCORE bull:email:delayed -inf {now}
   │
   │    for (job of jobs) {
   │      // delayed → wait 이동
   │      ZREM bull:email:delayed {jobId}
   │      ZADD bull:email:wait {priority} {jobId}
   │    }
   │
   │    sleep(1000)  // 1초 대기
   │  }
   │
   ▼
4. Wait 상태로 전환
   │
   │  이제 일반 Job처럼 처리됨
   │
   ▼
5. Worker가 처리
```

### Rate Limiting 동작

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Rate Limiter 동작 원리                           │
└─────────────────────────────────────────────────────────────────────┘

설정:
  limiter: {
    max: 10,           // 최대 10개
    duration: 60000    // 1분(60초) 동안
  }

동작:
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   시간 ─────────────────────────────────────────────────────────►   │
│                                                                     │
│   0초        10초       20초       30초       40초       50초       │
│   │          │          │          │          │          │          │
│   ▼          ▼          ▼          ▼          ▼          ▼          │
│   ████       ████       ░░░░       ░░░░       ████       ████       │
│   10개       10개       대기       대기       10개       10개        │
│   처리       처리       (한도      (한도      처리       처리        │
│                        도달)      도달)                              │
│                                                                     │
│   Rate Limit Window (Sliding Window)                                │
│   └──────────── 60초 ────────────┘                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

구현 (Redis Lua 스크립트):

  -- Token Bucket 알고리즘
  local key = 'bull:email:limiter'
  local now = tonumber(ARGV[1])
  local duration = tonumber(ARGV[2])
  local max = tonumber(ARGV[3])

  -- 오래된 토큰 제거
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - duration)

  -- 현재 토큰 수 확인
  local count = redis.call('ZCARD', key)

  if count < max then
    -- 토큰 추가 (처리 허용)
    redis.call('ZADD', key, now, job_id)
    return 1  -- allowed
  else
    return 0  -- blocked
  end
```

---

## Job 생명주기

### 상태 다이어그램

```
                                    ┌─────────────┐
                                    │   Created   │
                                    │  (메모리)    │
                                    └──────┬──────┘
                                           │
                      ┌────────────────────┼────────────────────┐
                      │                    │                    │
                      ▼                    ▼                    ▼
               ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
               │   Delayed   │     │   Waiting   │     │  Prioritized│
               │  (예약됨)    │     │   (대기)    │     │   (우선)    │
               └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
                      │                    │                    │
                      │   예약 시간 도달    │                    │
                      └─────────┬─────────┘────────────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │   Active    │
                         │   (처리중)   │
                         └──────┬──────┘
                                │
                   ┌────────────┼────────────┐
                   │            │            │
                   ▼            ▼            ▼
            ┌─────────────┐ ┌─────────┐ ┌─────────────┐
            │  Completed  │ │ Stalled │ │   Failed    │
            │   (완료)    │ │ (멈춤)  │ │   (실패)    │
            └─────────────┘ └────┬────┘ └──────┬──────┘
                                 │             │
                                 │   재시도    │  재시도
                                 │   가능?     │  가능?
                                 │             │
                                 ▼             ▼
                          ┌─────────────────────────┐
                          │        Waiting          │
                          │     (재시도 대기)        │
                          └─────────────────────────┘
```

### 상태별 설명

| 상태 | Redis 구조 | 설명 |
|------|-----------|------|
| **waiting** | List | 처리 대기 중인 Job |
| **active** | List | 현재 처리 중인 Job |
| **delayed** | Sorted Set | 예약된 Job (score = 실행시간) |
| **completed** | Set | 성공적으로 완료된 Job |
| **failed** | Set | 실패한 Job |
| **paused** | List | 큐 일시정지 시 대기 |
| **stalled** | - | 워커 중단으로 멈춘 Job |

### Stalled Job 처리

```typescript
// Worker가 예기치 않게 종료되면 Job이 "stalled" 상태가 됨
// BullMQ는 자동으로 감지하고 재처리

// 설정
const worker = new Worker('email', processor, {
  stalledInterval: 30000,  // 30초마다 체크
  maxStalledCount: 1,      // 1번 stalled 후 실패 처리
})

// Stalled 이벤트 리스닝
worker.on('stalled', (jobId, prev) => {
  console.log(`Job ${jobId} has stalled`)
})
```

---

## Redis 데이터 구조

### Key 네이밍 규칙

```
bull:{queueName}:{type}:{id}

예시:
bull:email:id              → 다음 Job ID (Counter)
bull:email:waiting         → 대기 중인 Job ID 목록 (List)
bull:email:active          → 처리 중인 Job ID 목록 (List)
bull:email:delayed         → 예약된 Job (Sorted Set)
bull:email:completed       → 완료된 Job (Set)
bull:email:failed          → 실패한 Job (Set)
bull:email:paused          → 일시정지된 Job (List)
bull:email:{jobId}         → Job 데이터 (Hash)
bull:email:meta            → 큐 메타데이터 (Hash)
```

### Job Hash 구조

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

### Redis 명령어 예시

```bash
# Job 데이터 조회
HGETALL bull:email:123

# 대기 중인 Job 목록
LRANGE bull:email:waiting 0 -1

# 예약된 Job (시간순)
ZRANGE bull:email:delayed 0 -1 WITHSCORES

# 큐 통계
LLEN bull:email:waiting       # 대기 중
LLEN bull:email:active        # 처리 중
SCARD bull:email:completed    # 완료
SCARD bull:email:failed       # 실패
ZCARD bull:email:delayed      # 예약됨
```

---

## 고급 기능

### 1. Job 우선순위

```typescript
// 낮은 숫자 = 높은 우선순위
await queue.add('urgent', data, { priority: 1 })   // 먼저 처리
await queue.add('normal', data, { priority: 5 })   // 보통
await queue.add('low', data, { priority: 10 })     // 나중에

// 우선순위 큐 내부 동작
// Redis: ZADD bull:email:priority-wait {score} {jobId}
// score = priority * timestamp → 우선순위 + 시간 순
```

### 2. 반복 Job (Repeatable)

```typescript
// 매일 오전 9시 실행
await queue.add('daily-report', { type: 'daily' }, {
  repeat: {
    pattern: '0 9 * * *',  // cron 표현식
    tz: 'Asia/Seoul'
  }
})

// 5분마다 실행
await queue.add('health-check', {}, {
  repeat: {
    every: 5 * 60 * 1000  // 5분 (밀리초)
  }
})

// 반복 Job 관리
const repeatableJobs = await queue.getRepeatableJobs()
await queue.removeRepeatableByKey(repeatableJobs[0].key)
```

### 3. Job Flow (부모-자식 관계)

```typescript
import { FlowProducer } from 'bullmq'

const flowProducer = new FlowProducer({ connection: redisConnection })

// 의존성 있는 Job 체인 생성
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

// 처리 순서:
// 1. step-1, step-2 병렬 실행
// 2. 둘 다 완료되면 final-step 실행
```

### 4. 이벤트 및 진행률

```typescript
// Worker에서 진행률 업데이트
const worker = new Worker('email', async (job) => {
  for (let i = 0; i <= 100; i += 10) {
    await someWork()
    await job.updateProgress(i)  // 0, 10, 20, ... 100
  }
  return { done: true }
})

// 진행률 모니터링
const queueEvents = new QueueEvents('email')

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId}: ${data}% complete`)
})
```

### 5. 백프레셔 (Backpressure)

```typescript
// 메모리 보호를 위한 백프레셔
const worker = new Worker('email', processor, {
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000,  // 분당 100개로 제한
  }
})

// 동적 concurrency 조절
worker.concurrency = 10  // 런타임에 변경 가능
```

---

## 성능 최적화

### 1. 연결 풀링

```typescript
// 올바른 방법: 연결 재사용
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// 모든 큐/워커에서 같은 연결 사용
const queue1 = new Queue('q1', { connection })
const queue2 = new Queue('q2', { connection })
const worker = new Worker('q1', processor, { connection })
```

### 2. 배치 처리

```typescript
// 여러 Job을 한 번에 추가
await queue.addBulk([
  { name: 'email', data: { to: 'a@test.com' } },
  { name: 'email', data: { to: 'b@test.com' } },
  { name: 'email', data: { to: 'c@test.com' } },
])
```

### 3. 메모리 관리

```typescript
// 완료/실패 Job 자동 삭제
const queue = new Queue('email', {
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600,     // 1시간 후 삭제
      count: 1000,   // 최대 1000개 유지
    },
    removeOnFail: {
      age: 86400,    // 24시간 후 삭제
    }
  }
})
```

### 4. Concurrency 튜닝

```
┌─────────────────────────────────────────────────────────────────┐
│                    Concurrency 가이드라인                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  작업 유형           권장 Concurrency      이유                  │
│  ─────────────────────────────────────────────────────────────  │
│  CPU 집약적          = CPU 코어 수         병렬 처리 최대화      │
│  I/O 집약적 (API)    10-50                 대기 시간 활용        │
│  이메일 발송         5-10                  Rate Limit 고려       │
│  파일 처리           2-5                   디스크 I/O 병목       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 장애 처리

### 1. 재시도 전략

```typescript
// Exponential Backoff
queue.add('task', data, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,  // 1초, 2초, 4초, 8초, 16초
  }
})

// 고정 지연
queue.add('task', data, {
  attempts: 3,
  backoff: {
    type: 'fixed',
    delay: 5000,  // 항상 5초 후 재시도
  }
})

// 커스텀 백오프
queue.add('task', data, {
  attempts: 3,
  backoff: {
    type: 'custom',
  }
})

// Worker에서 커스텀 지연 계산
const worker = new Worker('task', processor, {
  settings: {
    backoffStrategy: (attemptsMade) => {
      return attemptsMade * 10000  // 10초, 20초, 30초...
    }
  }
})
```

### 2. 에러 핸들링

```typescript
const worker = new Worker('email', async (job) => {
  try {
    await sendEmail(job.data)
  } catch (error) {
    // 재시도 가능한 에러
    if (error.code === 'RATE_LIMIT') {
      throw new Error('Rate limited, will retry')
    }

    // 재시도 불가능한 에러 (바로 실패 처리)
    if (error.code === 'INVALID_EMAIL') {
      throw new UnrecoverableError('Invalid email address')
    }

    throw error
  }
})

// 특정 에러는 재시도하지 않음
import { UnrecoverableError } from 'bullmq'

throw new UnrecoverableError('This will not be retried')
```

### 3. 장애 복구

```typescript
// Worker 재시작 시 stalled Job 자동 복구
const worker = new Worker('email', processor, {
  stalledInterval: 30000,  // 30초마다 체크
  maxStalledCount: 1,      // 1번 stall 허용
})

// 수동 복구
async function recoverStalledJobs() {
  const stalledJobs = await queue.getJobs(['stalled'])
  for (const job of stalledJobs) {
    await job.retry()
  }
}
```

### 4. 데드 레터 큐 (DLQ)

```typescript
// 최종 실패한 Job을 별도 큐로 이동
worker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= job.opts.attempts) {
    // 데드 레터 큐로 이동
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

## 다른 큐 시스템 비교

### 비교표

| 기능 | BullMQ | RabbitMQ | AWS SQS | Kafka |
|------|--------|----------|---------|-------|
| **저장소** | Redis | 자체 | AWS | 자체 |
| **프로토콜** | Redis | AMQP | HTTP | 자체 |
| **지연 Job** | O | O (플러그인) | O | X |
| **우선순위** | O | O | X | X |
| **Rate Limit** | O | X | X | X |
| **반복 Job** | O | X | X | X |
| **Job Flow** | O | X | X | X |
| **설정 복잡도** | 낮음 | 중간 | 낮음 | 높음 |
| **확장성** | 중간 | 높음 | 높음 | 매우 높음 |
| **순서 보장** | FIFO | FIFO | X | 파티션 내 |
| **용도** | 작업 큐 | 메시징 | 메시징 | 스트리밍 |

### 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                       언제 무엇을 선택?                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BullMQ                                                         │
│  └── Node.js 환경                                               │
│  └── 작업 스케줄링 필요                                          │
│  └── Rate Limiting 필요                                         │
│  └── Redis 이미 사용 중                                          │
│  └── 중소 규모 (초당 수천 Job)                                   │
│                                                                 │
│  RabbitMQ                                                       │
│  └── 다양한 언어/플랫폼 통합                                     │
│  └── 복잡한 라우팅 필요                                          │
│  └── 메시지 브로커 패턴                                          │
│  └── 높은 가용성 필요                                            │
│                                                                 │
│  AWS SQS                                                        │
│  └── AWS 생태계                                                  │
│  └── 관리형 서비스 선호                                          │
│  └── 서버리스 아키텍처                                           │
│  └── 간단한 큐 기능만 필요                                       │
│                                                                 │
│  Kafka                                                          │
│  └── 대용량 이벤트 스트리밍                                      │
│  └── 실시간 분석                                                 │
│  └── 이벤트 소싱                                                 │
│  └── 초당 수십만 메시지                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 요약

### BullMQ 핵심 포인트

1. **Redis 기반**: 빠르고 안정적인 메시지 큐
2. **Job 생명주기**: waiting → active → completed/failed
3. **Rate Limiting**: Token Bucket 알고리즘으로 처리량 제어
4. **Delayed Jobs**: Sorted Set으로 예약 실행 관리
5. **Worker Concurrency**: 동시 처리량 조절 가능
6. **재시도 전략**: Exponential Backoff로 안정적 복구
7. **모니터링**: Bull Board로 실시간 상태 확인

### 이 프로젝트에서의 활용

```
┌─────────────────────────────────────────────────────────────────┐
│                    이메일 스케줄링 시스템                         │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ 계정별      │    │ 업무시간    │    │ 자동       │         │
│  │ 일 20개    │───►│ 분산 발송   │───►│ 재시도     │         │
│  │ 제한       │    │ (9-18시)    │    │            │         │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│        │                  │                  │                 │
│        ▼                  ▼                  ▼                 │
│  Rate Limiter       Delayed Jobs      Backoff Strategy         │
│  (Redis Counter)    (Sorted Set)      (Exponential)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 참고 자료

- [BullMQ 공식 문서](https://docs.bullmq.io/)
- [Redis 공식 문서](https://redis.io/documentation)
- [Bull Board GitHub](https://github.com/felixmosh/bull-board)
- [Node.js Event Loop](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick)
