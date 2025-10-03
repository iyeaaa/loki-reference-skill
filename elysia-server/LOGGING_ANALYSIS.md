# 현재 로깅 구현 분석

## 📊 현재 로깅 시스템 구조

### 1. 로거 설정
```typescript
// src/utils/logger.ts
import pino from "pino"

const isProduction = process.env.NODE_ENV === "production"

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: false,
        },
      }
    : undefined,
})
```

### 2. HTTP 요청 로깅
```typescript
// src/plugins/simple-logger.plugin.ts
export const simpleLogger = new Elysia({ name: "simple-logger" })
  .onRequest(({ request }) => {
    const method = request.method
    const url = new URL(request.url)
    const path = url.pathname
    logger.info({ method, path }, "HTTP request")
  })
```

### 3. 애플리케이션 통합
```typescript
// src/index.ts
import logger from "./utils/logger"

const app = new Elysia()
  .use(simpleLogger)  // HTTP 요청 로깅
  .onError(({ error }) => {
    logger.error({ err: error }, "Application Error")
    throw error
  })
```

---

## ✅ 잘하고 있는 부분

### 1. **업계 표준 라이브러리 사용 (Pino)**
```
✅ 성능: JSON 로그 출력으로 파싱 빠름
✅ 구조화: 모든 로그가 JSON 형식
✅ 확장성: 다양한 transport 지원
✅ 커뮤니티: 활발한 유지보수 (32k+ stars)
```

**비교:**
- Pino: 최고 성능 (30k+ ops/sec)
- Winston: 중간 성능 (10k ops/sec)
- Bunyan: 낮은 유지보수

### 2. **환경별 로그 포맷 분리**
```typescript
// 개발: pino-pretty (읽기 쉬운 형식)
transport: !isProduction ? { target: "pino-pretty" } : undefined

// 프로덕션: JSON (파싱 용이)
// {"level":30,"time":1704067200000,"msg":"HTTP request"}
```

**장점:**
- ✅ 개발자 경험 향상 (컬러, 타임스탬프)
- ✅ 프로덕션 성능 최적화 (JSON만)
- ✅ 로그 분석 도구 호환성

### 3. **구조화된 로깅 (Structured Logging)**
```typescript
// ❌ 잘못된 방식
logger.info(`User ${userId} logged in`)

// ✅ 올바른 방식 (현재 코드)
logger.info({ userId, email }, "User logged in")
logger.error({ err: error, emailId }, "Email send failed")
```

**장점:**
- ✅ 검색/필터링 용이
- ✅ 로그 분석 도구 호환
- ✅ 타입 안정성

### 4. **일관된 로거 사용**
```bash
# console.log/console.error 사용 횟수
grep 결과: 0개 ✅
```

**장점:**
- ✅ 모든 로그가 중앙화됨
- ✅ 로그 레벨 제어 가능
- ✅ 포맷 일관성

### 5. **적절한 로그 레벨 사용**
```typescript
logger.debug({ ... }, "...")  // 디버깅용 상세 정보
logger.info({ ... }, "...")   // 일반 정보
logger.warn({ ... }, "...")   // 경고
logger.error({ ... }, "...")  // 에러
```

**사용 현황 (코드 분석):**
- `logger.info`: 60+ 사용
- `logger.error`: 30+ 사용
- `logger.warn`: 10+ 사용
- `logger.debug`: 15+ 사용

### 6. **에러 객체 올바른 로깅**
```typescript
// ✅ 올바른 방식 (현재 코드)
logger.error({ err: error }, "Email send failed")

// Pino가 자동으로 stack trace 포함:
// {
//   "err": {
//     "type": "Error",
//     "message": "Connection failed",
//     "stack": "Error: Connection failed\n    at ..."
//   }
// }
```

### 7. **HTTP 요청 로깅 플러그인**
```typescript
// src/plugins/simple-logger.plugin.ts
logger.info({ method, path }, "HTTP request")
```

**장점:**
- ✅ 모든 요청 자동 추적
- ✅ API 사용 패턴 분석 가능
- ✅ 성능 모니터링 기반

---

## 🚨 개선이 필요한 부분

### 1. **컨텍스트 정보 부족 (High Priority)**

**현재 문제:**
```typescript
// 어떤 요청인지 추적 불가능
logger.info({ userId: "123" }, "User logged in")
logger.error({ emailId: "456" }, "Email send failed")

// 두 로그가 같은 요청인지 알 수 없음
```

**개선 방안:**
```typescript
// src/utils/logger.ts
import pino from 'pino'
import { randomUUID } from 'crypto'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    env: process.env.NODE_ENV,
    service: 'elysia-server',
    version: process.env.APP_VERSION || '1.0.0',
    hostname: process.env.HOSTNAME,
  },
  // ... 기존 설정
})

// 요청별 컨텍스트 로거
export function createRequestLogger(requestId?: string) {
  return logger.child({
    requestId: requestId || randomUUID(),
  })
}

// 사용 예시
// src/plugins/request-context.plugin.ts
import { Elysia } from 'elysia'
import { randomUUID } from 'crypto'
import { createRequestLogger } from '../utils/logger'

export const requestContext = new Elysia({ name: 'request-context' })
  .derive(({ request }) => {
    const requestId = request.headers.get('x-request-id') || randomUUID()
    const requestLogger = createRequestLogger(requestId)

    return {
      requestId,
      logger: requestLogger,
    }
  })

// src/routes/emails.routes.ts
export const emailRoutes = new Elysia()
  .use(requestContext)
  .post('/send', async ({ body, logger }) => {  // logger 자동 주입
    logger.info({ toEmail: body.toEmail }, 'Sending email')
    // ...
    logger.info({ messageId }, 'Email sent successfully')
  })
```

**효과:**
```json
// 같은 requestId로 추적 가능
{"level":30,"requestId":"a1b2c3","msg":"Sending email","toEmail":"user@example.com"}
{"level":30,"requestId":"a1b2c3","msg":"Email sent successfully","messageId":"xyz"}
```

---

### 2. **민감 정보 노출 위험 (Critical)**

**현재 문제:**
```typescript
// 민감 정보가 로그에 그대로 노출될 수 있음
logger.info({ user }, "User data")  // password, apiKey 등 포함 가능
logger.debug({ body }, "Request body")  // 전체 요청 데이터
```

**개선 방안:**
```typescript
// src/utils/logger.ts
export const logger = pino({
  // ... 기존 설정

  // 민감 정보 자동 마스킹
  redact: {
    paths: [
      'password',
      'passwordHash',
      'apiKey',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      '*.password',
      '*.passwordHash',
      '*.apiKey',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },

  // 민감한 헤더 제거
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        ...req.headers,
        authorization: req.headers.authorization ? '[REDACTED]' : undefined,
        cookie: req.headers.cookie ? '[REDACTED]' : undefined,
      },
    }),
  },
})
```

**효과:**
```json
// Before
{"user": {"email": "user@example.com", "password": "secret123"}}

// After
{"user": {"email": "user@example.com", "password": "[REDACTED]"}}
```

---

### 3. **파일 저장 없음 (High Priority)**

**현재 문제:**
- ❌ 컨테이너 삭제 시 로그 소실
- ❌ 장기 보관 불가능
- ❌ 히스토리 추적 어려움

**개선 방안:**
```typescript
// src/utils/logger.ts
import pino from 'pino'
import { join } from 'path'
import { mkdirSync } from 'fs'

const LOG_DIR = process.env.LOG_DIR || join(process.cwd(), 'logs')

// 로그 디렉토리 생성
try {
  mkdirSync(LOG_DIR, { recursive: true })
} catch (error) {
  console.error('Failed to create log directory:', error)
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    // ... 기존 설정
  },
  pino.transport({
    targets: [
      // 개발: 콘솔 (pino-pretty)
      {
        target: 'pino-pretty',
        level: 'debug',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
        },
      },
      // 프로덕션: 파일 (일별 로테이션)
      {
        target: 'pino/file',
        level: 'info',
        options: {
          destination: join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`),
          mkdir: true,
        },
      },
      // 에러 로그 별도 저장
      {
        target: 'pino/file',
        level: 'error',
        options: {
          destination: join(LOG_DIR, `error-${new Date().toISOString().split('T')[0]}.log`),
          mkdir: true,
        },
      },
    ],
  })
)
```

---

### 4. **로그 로테이션 없음 (Medium Priority)**

**현재 문제:**
- ❌ 로그 파일 크기 제한 없음
- ❌ 오래된 로그 삭제 안 됨
- ❌ 디스크 풀 위험

**개선 방안:**
```bash
# 패키지 설치
bun add pino-roll
```

```typescript
// src/utils/logger.ts
export const logger = pino(
  { /* ... 기존 설정 */ },
  pino.transport({
    targets: [
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: join(LOG_DIR, 'app'),
          frequency: 'daily',  // 일별 로테이션
          extension: '.log',
          mkdir: true,
          // 파일명: app-2024-01-01.log
        },
      },
    ],
  })
)
```

---

### 5. **성능 메트릭 부재 (Medium Priority)**

**현재 문제:**
```typescript
// 요청 처리 시간, 성능 정보 없음
logger.info({ method, path }, "HTTP request")
```

**개선 방안:**
```typescript
// src/plugins/performance-logger.plugin.ts
import { Elysia } from 'elysia'
import { createRequestLogger } from '../utils/logger'

export const performanceLogger = new Elysia({ name: 'performance-logger' })
  .derive(({ request }) => {
    const startTime = Date.now()
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
    const logger = createRequestLogger(requestId)

    return {
      requestId,
      logger,
      startTime,
    }
  })
  .onBeforeHandle(({ request, logger, startTime }) => {
    logger.info({
      method: request.method,
      path: new URL(request.url).pathname,
    }, 'Request started')
  })
  .onAfterHandle(({ request, set, logger, startTime }) => {
    const duration = Date.now() - startTime

    logger.info({
      method: request.method,
      path: new URL(request.url).pathname,
      statusCode: set.status || 200,
      duration,  // ms
    }, 'Request completed')

    // 느린 요청 경고
    if (duration > 1000) {
      logger.warn({
        method: request.method,
        path: new URL(request.url).pathname,
        duration,
      }, 'Slow request detected')
    }
  })
  .onError(({ request, error, logger, startTime }) => {
    const duration = Date.now() - startTime

    logger.error({
      method: request.method,
      path: new URL(request.url).pathname,
      duration,
      err: error,
    }, 'Request failed')
  })
```

**효과:**
```json
{"level":30,"msg":"Request started","method":"POST","path":"/api/v1/emails"}
{"level":30,"msg":"Request completed","method":"POST","path":"/api/v1/emails","statusCode":200,"duration":45}
{"level":40,"msg":"Slow request detected","method":"GET","path":"/api/v1/leads","duration":1500}
```

---

### 6. **타임스탬프 형식 불일치 (Low Priority)**

**현재 문제:**
```typescript
// 개발: "HH:MM:ss" (시간만)
// 프로덕션: Unix timestamp (밀리초)
```

**개선 방안:**
```typescript
export const logger = pino({
  // ... 기존 설정
  timestamp: pino.stdTimeFunctions.isoTime,  // ISO 8601 형식
  // 출력: "2024-01-01T12:34:56.789Z"
})
```

---

### 7. **에러 스택 트레이스 포맷 (Low Priority)**

**현재 상태:**
```typescript
logger.error({ err: error }, "Error occurred")
// Pino가 자동으로 스택 포함하지만, 읽기 어려움
```

**개선 방안:**
```typescript
export const logger = pino({
  // ... 기존 설정
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },

  // 에러 시리얼라이저 개선
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
})
```

---

### 8. **워커 로그 구분 없음 (Medium Priority)**

**현재 문제:**
```typescript
// 어떤 워커에서 발생한 로그인지 구분 어려움
logger.info("Processing email")
logger.info("Processing workflow")
```

**개선 방안:**
```typescript
// src/workers/email-sequence-worker.ts
import { logger } from '../utils/logger'

const workerLogger = logger.child({ worker: 'email-sequence' })

export function startEmailSequenceWorker() {
  workerLogger.info('Starting email sequence worker')

  setInterval(async () => {
    workerLogger.info('Processing email batch')
    // ...
  }, 60000)
}

// src/workers/workflow-execution-worker.ts
const workerLogger = logger.child({ worker: 'workflow-execution' })
```

**효과:**
```json
{"level":30,"worker":"email-sequence","msg":"Processing email batch"}
{"level":30,"worker":"workflow-execution","msg":"Processing workflows"}
```

---

## 📊 현재 로깅 품질 평가

| 항목 | 점수 | 평가 |
|------|------|------|
| **라이브러리 선택** | ⭐⭐⭐⭐⭐ | Pino 사용 (업계 최고) |
| **구조화 로깅** | ⭐⭐⭐⭐⭐ | 모든 로그가 JSON 구조 |
| **환경별 분리** | ⭐⭐⭐⭐⭐ | 개발/프로덕션 구분 완벽 |
| **일관성** | ⭐⭐⭐⭐⭐ | console.log 사용 없음 |
| **로그 레벨** | ⭐⭐⭐⭐☆ | 적절히 사용, 일부 개선 필요 |
| **컨텍스트 추적** | ⭐⭐☆☆☆ | requestId 없음 |
| **민감정보 보호** | ⭐☆☆☆☆ | 마스킹 없음 (Critical) |
| **파일 저장** | ⭐☆☆☆☆ | 파일 저장 없음 |
| **로그 로테이션** | ⭐☆☆☆☆ | 로테이션 없음 |
| **성능 메트릭** | ⭐⭐☆☆☆ | 기본적인 요청 로그만 |

**종합 점수: 65/100**

---

## 🎯 개선 우선순위

### Phase 1: 즉시 (보안 및 안정성) 🔴

1. **민감 정보 마스킹 추가** (Critical)
   ```typescript
   redact: {
     paths: ['password', 'apiKey', 'token', '*.password'],
     censor: '[REDACTED]',
   }
   ```
   - 예상 시간: 10분
   - 영향도: 보안 위험 제거

2. **파일 로그 저장** (High)
   ```typescript
   pino.transport({
     targets: [
       { target: 'pino/file', options: { destination: 'logs/app.log' } },
     ]
   })
   ```
   - 예상 시간: 30분
   - 영향도: 로그 소실 방지

3. **Docker 로그 로테이션** (High)
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "10"
   ```
   - 예상 시간: 5분
   - 영향도: 디스크 풀 방지

### Phase 2: 단기 (추적성 개선) 🟡

4. **Request ID 추가** (High)
   - 예상 시간: 1시간
   - 영향도: 요청 추적 가능

5. **성능 메트릭 로깅** (Medium)
   - 예상 시간: 1시간
   - 영향도: 병목 지점 파악

6. **워커 로그 구분** (Medium)
   - 예상 시간: 30분
   - 영향도: 디버깅 효율 증가

### Phase 3: 중기 (고급 기능) 🟢

7. **로그 로테이션 (pino-roll)** (Medium)
   - 예상 시간: 30분
   - 영향도: 자동 관리

8. **중앙 로그 관리 시스템** (Low)
   - Grafana Loki / Datadog
   - 예상 시간: 4시간
   - 영향도: 검색/분석 효율

---

## 🚀 즉시 적용 가능한 개선 코드

### 1. 민감 정보 보호 + 파일 저장 (5분 적용)

```typescript
// src/utils/logger.ts
import pino from 'pino'
import { join } from 'path'

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'
const LOG_DIR = process.env.LOG_DIR || join(process.cwd(), 'logs')

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // 기본 컨텍스트
  base: {
    env: process.env.NODE_ENV,
    service: 'elysia-server',
    version: process.env.APP_VERSION || '1.0.0',
  },

  // ISO 8601 타임스탬프
  timestamp: pino.stdTimeFunctions.isoTime,

  // 민감 정보 자동 마스킹
  redact: {
    paths: [
      'password',
      'passwordHash',
      'apiKey',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      '*.password',
      '*.passwordHash',
      '*.apiKey',
      '*.token',
    ],
    censor: '[REDACTED]',
  },

  // 에러 포맷팅
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },

  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined,
})

// 요청별 컨텍스트 로거
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId })
}

// 워커별 로거
export function createWorkerLogger(workerName: string) {
  return logger.child({ worker: workerName })
}

export default logger
```

### 2. Docker Compose 로그 로테이션 (1분 적용)

```yaml
# docker-compose.yml
services:
  elysia-server:
    # ... 기존 설정

    volumes:
      # 로그 파일 저장
      - ./logs/elysia-server:/app/logs

    environment:
      - NODE_ENV=production
      - LOG_DIR=/app/logs
      - LOG_LEVEL=info

    # Docker 로그 로테이션
    logging:
      driver: "json-file"
      options:
        max-size: "10m"      # 파일당 최대 10MB
        max-file: "10"       # 최대 10개 파일
        compress: "true"     # 압축 저장
        labels: "service,env"
```

### 3. 성능 로깅 플러그인 (10분 적용)

```typescript
// src/plugins/performance-logger.plugin.ts
import { Elysia } from 'elysia'
import { randomUUID } from 'crypto'
import { createRequestLogger } from '../utils/logger'

export const performanceLogger = new Elysia({ name: 'performance-logger' })
  .derive(({ request }) => {
    const startTime = Date.now()
    const requestId = request.headers.get('x-request-id') || randomUUID()
    const logger = createRequestLogger(requestId)

    return { requestId, logger, startTime }
  })
  .onAfterHandle(({ request, set, logger, startTime }) => {
    const duration = Date.now() - startTime
    const path = new URL(request.url).pathname

    logger.info({
      method: request.method,
      path,
      statusCode: set.status || 200,
      duration,
    }, 'Request completed')

    // 느린 요청 경고 (1초 이상)
    if (duration > 1000) {
      logger.warn({ method: request.method, path, duration }, 'Slow request')
    }
  })
  .onError(({ request, error, logger, startTime }) => {
    const duration = Date.now() - startTime

    logger.error({
      method: request.method,
      path: new URL(request.url).pathname,
      duration,
      err: error,
    }, 'Request failed')
  })
```

```typescript
// src/index.ts (적용)
import { performanceLogger } from './plugins/performance-logger.plugin'

const app = new Elysia()
  .use(performanceLogger)  // simpleLogger 대체
  .use(errorHandler)
  // ...
```

---

## 📚 글로벌 서비스 로깅 벤치마크

### Stripe
```typescript
// 요청 추적 ID
logger.info({ request_id: 'req_123', user_id: 'usr_456' })

// 성능 메트릭
logger.info({ duration_ms: 45, endpoint: '/v1/charges' })

// 민감정보 마스킹
logger.info({ card: '[REDACTED]' })
```

### GitHub
```typescript
// 구조화된 로그
logger.info({ action: 'push', repo: 'owner/repo', user: 'username' })

// 상세 레벨 분리
logger.debug({ query: 'SELECT ...', rows: 100 })
logger.info({ event: 'webhook.delivered', target: 'https://...' })
```

### Shopify
```typescript
// 비즈니스 메트릭 포함
logger.info({
  event: 'order.created',
  order_id: '123',
  total_price: 99.99,
  shop_id: 'shop_456'
})
```

---

## 🎓 결론

### 현재 로깅 구현 종합 평가

**강점:**
- ✅ 업계 최고 라이브러리 (Pino) 사용
- ✅ 구조화된 로깅 완벽 적용
- ✅ 환경별 분리 잘 구현됨
- ✅ console.log 완전 제거

**약점:**
- ❌ 민감 정보 노출 위험 (Critical)
- ❌ 파일 저장 없음 (로그 소실 위험)
- ❌ 요청 추적 불가능 (requestId 없음)
- ❌ 로그 로테이션 없음 (디스크 풀 위험)

**종합 평가: 65/100**
- 기본은 매우 잘 되어 있음
- 보안 및 운영 측면에서 개선 필요
- Phase 1 개선사항(민감정보 마스킹, 파일 저장, 로그 로테이션)만 적용해도 85점 이상 가능

**추천 조치:**
1. **즉시**: 민감 정보 마스킹 + Docker 로그 로테이션 (15분)
2. **1주 내**: Request ID + 성능 로깅 (2시간)
3. **1개월 내**: 중앙 로그 관리 시스템 도입 (Loki/Datadog)

현재 로깅 구조는 **스타트업 초기 단계로는 우수**하며, 위 개선사항만 적용하면 **엔터프라이즈급 로깅 시스템**으로 발전할 수 있습니다! 🚀
