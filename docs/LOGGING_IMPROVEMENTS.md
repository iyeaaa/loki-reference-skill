# 로그 출력 개선 완료

## 🎯 개선 사항

### 1. **개발 환경 로그 포맷 단순화**

**Before:**
```
[17:42:40 UTC] INFO: Starting email processing
    env: "development"
    service: "elysia-server"
```

**After:**
```
17:42:40 INFO Starting email processing
```

**변경 내용:**
- `singleLine: true` - 한 줄로 출력
- `ignore: "pid,hostname,env,service"` - 불필요한 메타데이터 숨김
- `messageFormat: "{msg}"` - 메시지만 출력

---

### 2. **불필요한 DEBUG 로그 제거**

**제거된 로그:**
```typescript
// ❌ Before - 매 30초마다 출력
logger.debug("No pending emails to send")
logger.debug("No pending workflows to execute")
logger.debug("No replies found")
logger.debug("No scheduled emails to send")
logger.debug("New database connection established")
logger.debug("Database connection removed from pool")
```

**개선:**
```typescript
// ✅ After - trace 레벨로 변경 (기본적으로 출력 안됨)
logger.trace("No pending emails to send")

// DB 커넥션 로그는 TRACE 레벨에서만 출력
if (isDevelopment && process.env.LOG_LEVEL === "trace") {
  pool.on("connect", () => logger.trace("New database connection"))
}
```

---

### 3. **워커 시작 로그 통합**

**Before:**
```
INFO: Starting email sequence worker...
INFO: Starting email sequence worker
INFO: Starting workflow execution worker...
INFO: Starting workflow execution worker
INFO: Starting scheduled email worker...
INFO: Starting scheduled email worker
```

**After:**
```
DEBUG: Starting background workers...
DEBUG: ✅ Email sequence worker started
DEBUG: ✅ Workflow execution worker started
DEBUG: ✅ Scheduled email worker started
```

---

### 4. **중복 로그 제거**

**Before:**
```
INFO: Starting email processing
INFO: Finished processing emails
INFO: Starting workflow processing
INFO: Finished processing workflows
```

**After:**
```
INFO: Processing pending emails (count: 5)  // 실제 작업이 있을 때만
DEBUG: Finished processing emails           // 완료 로그는 debug로
```

---

### 5. **프로덕션 환경 최적화**

```typescript
// 개발: 깔끔한 출력
base: undefined  // env, service 제거

// 프로덕션: 구조화된 JSON
base: {
  env: config.nodeEnv,
  service: "elysia-server",
}
```

---

## 📊 개선 효과

### Before (34줄)
```
✅ Configuration loaded successfully
   - Environment: development
   - Port: 3001
   - Database: 15.165.2.108:5432/postgres
   - SendGrid: rinda@partners.grinda.ai
[17:42:40 UTC] INFO: Initializing database...
    env: "development"
    service: "elysia-server"
[17:42:40 UTC] INFO: Starting database migration
    env: "development"
    service: "elysia-server"
[17:42:40 UTC] INFO: Starting email sequence worker...
    env: "development"
    service: "elysia-server"
[17:42:40 UTC] INFO: Starting email sequence worker
    env: "development"
    service: "elysia-server"
[17:42:40 UTC] INFO: Starting email processing
    env: "development"
    service: "elysia-server"
[17:42:40 UTC] INFO: Starting workflow execution worker...
    env: "development"
    service: "elysia-server"
... (34줄 더)
```

### After (10줄)
```
✅ Configuration loaded successfully
   - Environment: development
   - Port: 3001
   - Database: 15.165.2.108:5432/postgres
   - SendGrid: rinda@partners.grinda.ai
17:42:40 INFO 🔄 Initializing database...
17:42:40 DEBUG Starting background workers...
17:42:40 DEBUG ✅ Email sequence worker started
17:42:40 DEBUG ✅ Workflow execution worker started
17:42:40 DEBUG ✅ Scheduled email worker started
17:42:40 INFO 🚀 Server ready at http://localhost:3001
```

**줄 수 감소: 70% ↓ (34줄 → 10줄)**

---

## 🎨 새로운 로그 레벨 정책

### **TRACE** (매우 상세)
- DB 커넥션 이벤트
- 활성화: `LOG_LEVEL=trace`

### **DEBUG** (개발용)
- 워커 시작/종료
- 작업 완료 로그
- 빈 결과 (아무것도 없을 때)

### **INFO** (중요 정보)
- 실제 작업 수행 (이메일 발송 등)
- 서버 시작/종료
- DB 마이그레이션

### **WARN** (경고)
- 느린 요청 (1초 이상)
- 설정 누락

### **ERROR** (에러)
- 예외 발생
- 작업 실패

---

## 🔧 로그 레벨 변경 방법

### 개발 환경
```bash
# 기본 (INFO + DEBUG)
bun dev

# 모든 로그 보기 (TRACE 포함)
LOG_LEVEL=trace bun dev

# 중요한 것만 (INFO 이상)
LOG_LEVEL=info bun dev

# 에러만
LOG_LEVEL=error bun dev
```

### 프로덕션 환경
```bash
# .env.production
LOG_LEVEL=info  # 기본값 (권장)
# LOG_LEVEL=warn  # 경고 이상만
# LOG_LEVEL=error # 에러만
```

---

## 📝 커스터마이징

### 더 많은 정보가 필요한 경우
```typescript
// src/utils/logger.ts
export const logger = pino({
  // ...
  transport: !isProduction ? {
    target: "pino-pretty",
    options: {
      ignore: "pid,hostname", // env, service 다시 표시
      singleLine: false,      // 여러 줄 출력
    }
  } : undefined,
})
```

### 특정 워커만 DEBUG 보기
```typescript
// src/workers/email-sequence-worker.ts
const workerLogger = logger.child({ worker: 'email-sequence' })
workerLogger.setLevel('debug')
```

---

## ✅ 체크리스트

- [x] 개발 환경 로그 포맷 단순화 (singleLine, ignore)
- [x] 불필요한 DEBUG 로그 TRACE로 변경
- [x] 워커 시작 로그 통합 및 단순화
- [x] 중복 로그 제거 (Starting/Finished)
- [x] DB 커넥션 로그 TRACE 레벨로 이동
- [x] 서버 시작 로그 단순화
- [x] 이모지 추가로 가독성 향상
- [x] 프로덕션 환경에서만 base 메타데이터 포함

---

## 🎓 베스트 프랙티스

### 1. **로그 레벨 선택 기준**

```typescript
// ❌ 잘못된 예
logger.info("Function started")  // 너무 상세
logger.error("User not found")   // 에러가 아님

// ✅ 올바른 예
logger.debug("Function started")      // 디버깅용
logger.warn("User not found")         // 경고
logger.info("Email sent", { count })  // 중요 이벤트
logger.error({ err }, "Failed")       // 실제 에러
```

### 2. **구조화된 로깅**

```typescript
// ❌ 문자열 결합
logger.info(`Processing ${count} emails`)

// ✅ 구조화된 데이터
logger.info({ count }, "Processing emails")
```

### 3. **에러 로깅**

```typescript
// ❌ 에러 메시지만
logger.error(error.message)

// ✅ 에러 객체 전체 (스택 트레이스 포함)
logger.error({ err: error }, "Operation failed")
```

---

## 🚀 다음 단계

1. **파일 로깅 추가** (LOGGING_GUIDE.md 참고)
2. **Request ID 추적** (LOGGING_ANALYSIS.md 참고)
3. **성능 메트릭 추가** (요청 처리 시간)
4. **중앙 로그 관리** (Grafana Loki / Datadog)

---

## 📚 참고 문서

- [LOGGING_GUIDE.md](./LOGGING_GUIDE.md) - 로그 저장 및 관리
- [LOGGING_ANALYSIS.md](./LOGGING_ANALYSIS.md) - 로그 구현 분석
- [Pino Documentation](https://getpino.io/)
