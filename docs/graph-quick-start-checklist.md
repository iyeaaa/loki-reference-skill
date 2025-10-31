# Neo4j 하이브리드 구현 빠른 시작 체크리스트

## ✅ Phase 1: 배치 동기화 (1-2일)

### 1단계: 환경 설정

```bash
# ✅ Neo4j Docker 실행
docker run -d \
  --name neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.15

# ✅ 패키지 설치
cd elysia-server
bun add neo4j-driver node-cron
bun add -D @types/node-cron

# ✅ 환경 변수 추가 (.env)
echo "NEO4J_URI=bolt://localhost:7687" >> .env
echo "NEO4J_USERNAME=neo4j" >> .env
echo "NEO4J_PASSWORD=password" >> .env
```

**완료 확인:**
- [ ] http://localhost:7474 접속 가능
- [ ] neo4j / password로 로그인 성공
- [ ] `bun install` 에러 없음

---

### 2단계: 서버 통합

```typescript
// ✅ elysia-server/src/index.ts 수정

import { neo4jService } from "./services/graph/neo4j.service"
import { startGraphSyncCronJobs } from "./jobs/graph-sync-cron"

// onStart 훅에 추가
app.onStart(async () => {
  console.log("🚀 Server starting...")

  // Neo4j 연결
  try {
    await neo4jService.connect()
    startGraphSyncCronJobs() // 크론 작업 시작
  } catch (error) {
    console.error("Neo4j initialization failed:", error)
  }
})

// onStop 훅에 추가
app.onStop(async () => {
  await neo4jService.close()
})
```

**완료 확인:**
- [ ] 서버 시작 시 `[Neo4j] Connected successfully` 로그 출력
- [ ] 서버 시작 시 `[GraphSyncCron] All cron jobs started` 로그 출력
- [ ] 에러 없이 서버 실행

---

### 3단계: 초기 데이터 동기화

```bash
# ✅ API 라우트 추가 (또는 스크립트 실행)

# 방법 1: REST API로 동기화
curl -X POST http://localhost:3000/api/graph/admin/sync-all

# 방법 2: Bun 스크립트로 동기화 (아래 코드 실행)
bun run sync-graph
```

```typescript
// ✅ elysia-server/scripts/sync-graph.ts (신규 파일)
import { neo4jService } from "../src/services/graph/neo4j.service"
import { batchSyncService } from "../src/services/graph/batch-sync"

async function main() {
  console.log("Starting initial graph sync...")

  // 연결
  await neo4jService.connect()

  // 전체 동기화
  await batchSyncService.syncAll()

  // 결과 확인
  const validation = await batchSyncService.validateConsistency()
  console.log("Validation result:", validation)

  // 종료
  await neo4jService.close()
  process.exit(0)
}

main()
```

```json
// ✅ package.json에 스크립트 추가
{
  "scripts": {
    "sync-graph": "bun run scripts/sync-graph.ts"
  }
}
```

**완료 확인:**
- [ ] `[BatchSync] Full synchronization completed` 로그 출력
- [ ] Neo4j 브라우저에서 노드 확인: `MATCH (n) RETURN count(n)`
- [ ] 사용자 노드 확인: `MATCH (u:User) RETURN u LIMIT 10`

---

### 4단계: 그래프 API 추가 (선택)

```typescript
// ✅ elysia-server/src/routes/graph.routes.ts 생성 (이미 문서에 있음)
// ✅ src/index.ts에 라우트 등록

import { graphRoutes } from "./routes/graph.routes"

app.use(graphRoutes)
```

**완료 확인:**
- [ ] `curl http://localhost:3000/api/graph/health` 응답 확인
- [ ] `curl http://localhost:3000/api/graph/org-chart` 조직도 조회

---

### 5단계: 크론 작업 확인

```bash
# ✅ 5분 대기 후 로그 확인
# 서버 콘솔에서 다음 메시지 확인:
# [GraphSyncCron] Starting incremental sync...
# [GraphSyncCron] Incremental sync completed: X synced, 0 failed
```

**완료 확인:**
- [ ] 5분마다 자동 동기화 로그 출력
- [ ] 변경된 데이터가 Neo4j에 반영됨

---

## ✅ Phase 2: 이벤트 기반 (2-3일)

### 1단계: 이벤트 핸들러 활성화

```typescript
// ✅ elysia-server/src/index.ts 수정

import { registerGraphSyncHandlers } from "./services/graph/sync-handlers"

app.onStart(async () => {
  await neo4jService.connect()

  // 이벤트 핸들러 등록 (추가)
  registerGraphSyncHandlers()

  // 크론 작업 (선택적으로 비활성화)
  // startGraphSyncCronJobs()
})
```

**완료 확인:**
- [ ] `[GraphSync] Event handlers registered successfully` 로그 출력

---

### 2단계: 서비스 레이어 수정

```typescript
// ✅ elysia-server/src/services/user.service.ts 수정 예시

import { eventBus } from "../events/domain-event-bus"

export class UserService {
  async createUser(data: NewUser) {
    // 1. DB 저장
    const [user] = await db.insert(users).values(data).returning()

    // 2. 이벤트 발행 (추가)
    await eventBus.publish({
      type: "user.created",
      payload: user,
    })

    return user
  }

  async updateUser(userId: string, data: Partial<User>) {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning()

    // 이벤트 발행 (추가)
    await eventBus.publish({
      type: "user.updated",
      payload: { id: userId, changes: data, timestamp: new Date() },
    })

    return user
  }
}
```

**완료 확인:**
- [ ] 사용자 생성 시 `[EventBus] Published: user.created` 로그
- [ ] 사용자 업데이트 시 `[GraphSync] User updated in graph` 로그
- [ ] 1-2초 내에 Neo4j에 반영됨

---

### 3단계: 재시도 메커니즘 추가 (선택)

```bash
# ✅ Bull Queue 설치
bun add bull
bun add -D @types/bull

# Redis 설치 (Docker)
docker run -d --name redis -p 6379:6379 redis:7
```

```typescript
// ✅ src/services/graph/retry-queue.ts 생성
// (문서 참조: hybrid-crud-implementation.md)
```

**완료 확인:**
- [ ] Redis 연결 확인
- [ ] 실패한 동기화 작업 재시도

---

## 🧪 테스트 시나리오

### 시나리오 1: 사용자 생성 및 동기화

```bash
# 1. 사용자 생성 (RDBMS)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "employeeId": "EMP001",
    "departmentId": "dept-uuid-here"
  }'

# 2. Neo4j에서 확인 (5분 후 또는 즉시)
# Neo4j 브라우저에서:
MATCH (u:User {email: 'john@example.com'}) RETURN u

# 3. 관계 확인
MATCH (u:User {email: 'john@example.com'})-[r:MEMBER_OF]->(d:Department)
RETURN u, r, d
```

**예상 결과:**
- [ ] 사용자 노드 생성됨
- [ ] 부서 관계 생성됨

---

### 시나리오 2: 조직도 조회

```bash
# API로 조직도 조회
curl http://localhost:3000/api/graph/org-chart

# Neo4j 브라우저에서 시각화
MATCH path = (u:User)-[:REPORTS_TO*]->(manager)
RETURN path
LIMIT 50
```

**예상 결과:**
- [ ] 조직도 그래프 시각화
- [ ] 보고 체계 확인

---

### 시나리오 3: 영향력 분석

```bash
# 특정 사용자 영향력 점수
curl http://localhost:3000/api/graph/users/{userId}/influence

# Neo4j에서 직접 계산
MATCH (u:User {id: 'user-uuid'})-[:REPORTS_TO|MEMBER_OF*1..3]-(connected)
RETURN count(DISTINCT connected) as influence_score
```

**예상 결과:**
- [ ] 영향력 점수 반환
- [ ] 숫자가 합리적 (0 ~ 100)

---

## 🚨 문제 해결

### Neo4j 연결 실패

```bash
# 1. Docker 상태 확인
docker ps | grep neo4j

# 2. 재시작
docker restart neo4j

# 3. 로그 확인
docker logs neo4j

# 4. 환경 변수 확인
cat .env | grep NEO4J
```

---

### 동기화 안 됨

```bash
# 1. 수동 동기화
curl -X POST http://localhost:3000/api/graph/admin/sync-all

# 2. 일관성 검증
curl http://localhost:3000/api/graph/admin/validate

# 3. 서버 로그 확인
# [GraphSyncCron] 또는 [GraphSync] 메시지 확인
```

---

### 데이터 불일치

```cypher
-- Neo4j에서 모든 데이터 삭제 (재동기화 전)
MATCH (n) DETACH DELETE n

-- 인덱스 재생성
CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id)
CREATE INDEX department_id_index IF NOT EXISTS FOR (d:Department) ON (d.id)
```

```bash
# 전체 재동기화
curl -X POST http://localhost:3000/api/graph/admin/sync-all
```

---

## 📊 완료 체크리스트

### Phase 1 (배치 동기화)

- [ ] Neo4j Docker 실행 중
- [ ] 패키지 설치 완료
- [ ] 환경 변수 설정
- [ ] 서버에 Neo4j 연결 코드 추가
- [ ] 크론 작업 동작 확인
- [ ] 초기 데이터 동기화 완료
- [ ] 그래프 API 동작 확인
- [ ] Neo4j 브라우저에서 데이터 확인

### Phase 2 (이벤트 기반)

- [ ] 이벤트 핸들러 등록
- [ ] 서비스 레이어에 이벤트 발행 추가
- [ ] 실시간 동기화 테스트
- [ ] 에러 핸들링 확인
- [ ] (선택) Bull Queue 재시도 메커니즘

### 고급 기능

- [ ] LangGraph 통합
- [ ] 조직도 시각화 UI
- [ ] 고급 그래프 알고리즘 (PageRank, Community Detection)
- [ ] 모니터링 대시보드

---

## 📈 성능 벤치마크

### 목표 성능

| 작업 | RDBMS (PostgreSQL) | Graph DB (Neo4j) | 개선 |
|---|---|---|---|
| 보고 체계 조회 (depth 3) | 1200ms | 45ms | 26배 빠름 |
| 협업 네트워크 조회 | 3500ms | 120ms | 29배 빠름 |
| 부서별 집계 | 80ms | 100ms | 비슷 |

### 측정 방법

```bash
# PostgreSQL 쿼리 시간 측정
\timing
SELECT * FROM users WHERE ...

# Neo4j 쿼리 시간 측정
# 브라우저 하단에 실행 시간 표시됨
MATCH (u:User {id: $userId})-[:REPORTS_TO*1..3]-(connected)
RETURN count(connected)
```

---

## 🎓 다음 단계

1. **LangGraph 통합**: 챗봇에 그래프 쿼리 도구 추가
2. **시각화**: D3.js로 조직도 UI 구현
3. **고급 분석**: 병목 탐지, 영향력 분석 자동화
4. **Phase 3**: CDC (Debezium + Kafka) 마이그레이션

---

## 📚 도움이 필요하면

- `docs/hybrid-architecture-design.md` - 전체 아키텍처 설계
- `docs/hybrid-crud-implementation.md` - 상세 구현 가이드
- `docs/graph-implementation-guide.md` - 설치 및 사용법
- [Neo4j 공식 문서](https://neo4j.com/docs/)
- [LangGraph 문서](https://langchain-ai.github.io/langgraph/)
