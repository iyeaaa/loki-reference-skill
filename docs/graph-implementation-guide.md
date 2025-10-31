# Neo4j 하이브리드 아키텍처 구현 가이드

## 🚀 빠른 시작

### 1. Neo4j 설치 (Docker)

```bash
# Neo4j 컨테이너 실행
docker run -d \
  --name neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  -e NEO4J_PLUGINS='["apoc"]' \
  -v $PWD/neo4j-data:/data \
  neo4j:5.15

# 브라우저에서 접속
open http://localhost:7474

# 로그인: neo4j / password
```

### 2. 패키지 설치

```bash
cd elysia-server

# Neo4j 드라이버 설치
bun add neo4j-driver

# 크론 작업용
bun add node-cron
bun add -D @types/node-cron
```

### 3. 환경 변수 설정

```bash
# elysia-server/.env
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
NEO4J_ENABLED=true  # 개발 중 비활성화 가능
```

---

## 📂 생성된 파일 구조

```
elysia-server/src/
├── events/
│   └── domain-event-bus.ts          # 이벤트 버스 (핵심)
├── services/
│   └── graph/
│       ├── neo4j.service.ts         # Neo4j 연결 및 쿼리
│       ├── sync-handlers.ts         # 이벤트 → 그래프 동기화
│       └── batch-sync.ts            # 배치 동기화 (Phase 1)
└── jobs/
    └── graph-sync-cron.ts           # 크론 작업
```

---

## 🔧 서버 통합 (3단계)

### Step 1: Neo4j 연결 초기화

```typescript
// elysia-server/src/index.ts
import { neo4jService } from "./services/graph/neo4j.service"
import { registerGraphSyncHandlers } from "./services/graph/sync-handlers"
import { startGraphSyncCronJobs } from "./jobs/graph-sync-cron"

const app = new Elysia()
  // ... 기존 코드 ...

// 서버 시작 시 Neo4j 연결
app.onStart(async () => {
  console.log("🚀 Server starting...")

  // Neo4j 연결 (실패해도 서버는 계속 실행)
  try {
    await neo4jService.connect()

    // Phase 2: 이벤트 핸들러 등록 (선택)
    // registerGraphSyncHandlers()

    // Phase 1: 크론 작업 시작
    startGraphSyncCronJobs()
  } catch (error) {
    console.error("Neo4j initialization failed:", error)
  }
})

// 서버 종료 시 Neo4j 연결 해제
app.onStop(async () => {
  console.log("👋 Server stopping...")
  await neo4jService.close()
})
```

### Step 2: 기존 서비스에 이벤트 발행 추가

```typescript
// elysia-server/src/services/user.service.ts (예시)
import { eventBus } from "../events/domain-event-bus"
import { db } from "../db"
import { users } from "../db/schema/users"
import { eq } from "drizzle-orm"

export class UserService {
  /**
   * 사용자 생성
   */
  async createUser(data: NewUser) {
    // 1. RDBMS에 저장 (기존 로직)
    const [user] = await db.insert(users).values(data).returning()

    // 2. 이벤트 발행 (신규 추가)
    await eventBus.publish({
      type: "user.created",
      payload: user,
    })

    return user
  }

  /**
   * 사용자 업데이트
   */
  async updateUser(userId: string, data: Partial<User>) {
    // 1. RDBMS 업데이트
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning()

    // 2. 이벤트 발행
    await eventBus.publish({
      type: "user.updated",
      payload: {
        id: userId,
        changes: data,
        timestamp: new Date(),
      },
    })

    return user
  }

  /**
   * 사용자 삭제
   */
  async deleteUser(userId: string) {
    // 1. RDBMS 삭제
    await db.delete(users).where(eq(users.id, userId))

    // 2. 이벤트 발행
    await eventBus.publish({
      type: "user.deleted",
      payload: {
        id: userId,
        timestamp: new Date(),
      },
    })
  }

  /**
   * 부서 변경
   */
  async changeDepartment(userId: string, newDepartmentId: string) {
    // 1. RDBMS 업데이트
    const [user] = await db
      .update(users)
      .set({ departmentId: newDepartmentId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning()

    // 2. 이벤트 발행
    await eventBus.publish({
      type: "user.updated",
      payload: {
        id: userId,
        changes: { departmentId: newDepartmentId },
        timestamp: new Date(),
      },
    })

    // 3. 팀 관계 이벤트 발행
    await eventBus.publish({
      type: "team.member.added",
      payload: {
        teamId: newDepartmentId,
        userId,
        timestamp: new Date(),
      },
    })

    return user
  }
}
```

### Step 3: 그래프 전용 API 추가

```typescript
// elysia-server/src/routes/graph.routes.ts (신규)
import { Elysia } from "elysia"
import { neo4jService } from "../services/graph/neo4j.service"
import { batchSyncService } from "../services/graph/batch-sync"

export const graphRoutes = new Elysia({ prefix: "/api/graph" })
  /**
   * 조직도 조회
   */
  .get("/org-chart", async () => {
    const graph = await neo4jService.getOrganizationGraph()
    return graph
  })

  /**
   * 사용자 보고 체계 조회
   */
  .get("/users/:userId/reporting-chain", async ({ params }) => {
    const chain = await neo4jService.getReportingChain(params.userId)
    return { chain }
  })

  /**
   * 사용자 영향력 점수
   */
  .get("/users/:userId/influence", async ({ params }) => {
    const score = await neo4jService.getInfluenceScore(params.userId)
    return { userId: params.userId, influenceScore: score }
  })

  /**
   * 팀 멤버 조회
   */
  .get("/departments/:departmentId/members", async ({ params }) => {
    const members = await neo4jService.getTeamMembers(params.departmentId)
    return { members }
  })

  /**
   * 협업 네트워크 조회
   */
  .get("/users/:userId/collaborators", async ({ params, query }) => {
    const maxDepth = parseInt(query.depth || "2")
    const collaborators = await neo4jService.findCollaborators(params.userId, maxDepth)
    return { collaborators }
  })

  /**
   * [관리자] 전체 동기화 트리거
   */
  .post("/admin/sync-all", async () => {
    await batchSyncService.syncAll()
    return { success: true, message: "Full sync completed" }
  })

  /**
   * [관리자] 일관성 검증
   */
  .get("/admin/validate", async () => {
    const validation = await batchSyncService.validateConsistency()
    return validation
  })

  /**
   * 헬스체크
   */
  .get("/health", async () => {
    const isHealthy = await neo4jService.healthCheck()
    return {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date(),
    }
  })

// 메인 앱에 등록
// app.use(graphRoutes)
```

---

## 🎯 동작 방식

### Phase 1: 배치 동기화 (현재 구현)

```
[사용자 액션]
    ↓
[RDBMS 업데이트] ← 즉시 반영
    ↓
[이벤트 발행] (선택)
    ↓
[5분마다 크론 작업]
    ↓
[Neo4j 동기화] ← 5분 지연
```

**장점:**
- 비즈니스 로직 변경 최소화
- 안전한 실험 가능
- 롤백 쉬움

**단점:**
- 5분 지연 (최종 일관성)

### Phase 2: 이벤트 기반 (선택적 활성화)

```typescript
// src/index.ts에 추가
registerGraphSyncHandlers() // 주석 해제

// 동작 방식:
[사용자 액션]
    ↓
[RDBMS 업데이트] ← 즉시 반영
    ↓
[이벤트 발행]
    ↓
[이벤트 핸들러] (비동기)
    ↓
[Neo4j 동기화] ← 1-2초 지연
```

**장점:**
- 거의 실시간 동기화
- 비즈니스 로직 분리

**단점:**
- Service 레이어 수정 필요

---

## 🧪 테스트

### 1. Neo4j 연결 테스트

```bash
# Neo4j 브라우저에서 실행
http://localhost:7474

# Cypher 쿼리
MATCH (n) RETURN count(n)
```

### 2. 초기 데이터 동기화

```typescript
// 스크립트 실행 또는 API 호출
curl -X POST http://localhost:3000/api/graph/admin/sync-all
```

### 3. 실시간 동기화 테스트

```bash
# 1. 사용자 생성
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "departmentId": "dept-uuid"
  }'

# 2. Neo4j에서 확인 (5분 후 또는 즉시)
MATCH (u:User {email: 'test@example.com'}) RETURN u
```

### 4. 조직도 조회

```bash
curl http://localhost:3000/api/graph/org-chart
```

### 5. 영향력 점수 조회

```bash
curl http://localhost:3000/api/graph/users/{userId}/influence
```

---

## 🔍 Neo4j 쿼리 예제

### 보고 체계 시각화

```cypher
// 특정 사용자의 보고 체계 (상위 3레벨)
MATCH path = (u:User {email: 'john@example.com'})-[:REPORTS_TO*1..3]->(manager)
RETURN path
```

### 부서별 인원수

```cypher
MATCH (d:Department)<-[:MEMBER_OF]-(u:User)
WHERE u.isActive = true
RETURN d.name as department, count(u) as member_count
ORDER BY member_count DESC
```

### 협업 네트워크 찾기

```cypher
MATCH (u1:User {email: 'alice@example.com'})
      -[:COLLABORATES_WITH*1..2]-(u2:User)
RETURN DISTINCT u2.username, u2.email
LIMIT 10
```

### 단일 장애점 찾기 (많은 사람이 의존하는 사람)

```cypher
MATCH (manager:User)<-[:REPORTS_TO]-(subordinate:User)
WITH manager, count(subordinate) as team_size
WHERE team_size > 5
RETURN manager.username, manager.email, team_size
ORDER BY team_size DESC
```

### 부서 간 협업 강도

```cypher
MATCH (u1:User)-[:MEMBER_OF]->(d1:Department)
MATCH (u2:User)-[:MEMBER_OF]->(d2:Department)
MATCH (u1)-[:COLLABORATES_WITH]-(u2)
WHERE d1 <> d2
RETURN d1.name, d2.name, count(*) as collaboration_count
ORDER BY collaboration_count DESC
```

---

## 🚨 문제 해결

### Neo4j 연결 실패

```bash
# 1. Docker 컨테이너 상태 확인
docker ps | grep neo4j

# 2. 로그 확인
docker logs neo4j

# 3. 재시작
docker restart neo4j

# 4. 환경 변수 확인
echo $NEO4J_URI
```

### 동기화 안 됨

```bash
# 1. 크론 작업 로그 확인
# 서버 콘솔에서 [GraphSyncCron] 메시지 확인

# 2. 수동 동기화 실행
curl -X POST http://localhost:3000/api/graph/admin/sync-all

# 3. 일관성 검증
curl http://localhost:3000/api/graph/admin/validate
```

### 성능 느림

```cypher
// 인덱스 확인
SHOW INDEXES

// 인덱스 생성 (자동으로 생성되지만 확인)
CREATE INDEX user_id_index IF NOT EXISTS
FOR (u:User) ON (u.id)
```

---

## 📊 모니터링

### 1. 동기화 상태 확인

```typescript
// 크론 작업이 로그로 출력
// [GraphSyncCron] Incremental sync completed: 5 synced, 0 failed
```

### 2. Neo4j 메트릭

```cypher
// 전체 노드 수
MATCH (n) RETURN count(n)

// 레이블별 노드 수
MATCH (n)
RETURN labels(n), count(*)

// 관계 수
MATCH ()-[r]->()
RETURN type(r), count(r)
```

### 3. 데이터 일관성

```bash
# 정기 검증 (매일 02:00 자동 실행)
curl http://localhost:3000/api/graph/admin/validate
```

---

## 🎓 다음 단계

### 1. LangGraph 통합

```typescript
// 기존 챗봇에 그래프 쿼리 추가
const tools = [
  postgresQueryTool,
  neo4jQueryTool, // ← 추가
]

// 예: "팀 영향력이 높은 사람은?"
// → Neo4j 쿼리로 처리
```

### 2. 시각화 UI 추가

```typescript
// admin/src/pages/OrgChartPage.tsx
import { useQuery } from '@tanstack/react-query'

const { data } = useQuery({
  queryKey: ['orgChart'],
  queryFn: () => api.get('/graph/org-chart')
})

// D3.js 또는 vis.js로 시각화
```

### 3. Phase 2로 전환 (이벤트 기반)

```typescript
// src/index.ts에서 활성화
registerGraphSyncHandlers()

// 크론 작업 비활성화 (선택)
// startGraphSyncCronJobs()
```

### 4. 고급 그래프 알고리즘

```cypher
// PageRank로 영향력 계산
CALL gds.pageRank.stream('org-graph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).username AS user, score
ORDER BY score DESC
```

---

## 📚 참고 자료

- [Neo4j Cypher 매뉴얼](https://neo4j.com/docs/cypher-manual/current/)
- [Graph Data Science 라이브러리](https://neo4j.com/docs/graph-data-science/current/)
- [Neo4j 드라이버 문서](https://neo4j.com/docs/javascript-manual/current/)
