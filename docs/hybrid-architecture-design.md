# 하이브리드 아키텍처 설계: RDBMS + Graph DB

## 📊 현재 시스템 분석

**현재 구조:**
- PostgreSQL + Drizzle ORM (CRM/마케팅 데이터)
- LangGraph: SQL 쿼리 생성/실행 워크플로우
- 테이블: users, departments, leads, emails, sequences, workflows 등

**목표 시스템:**
- IT 회사 조직 전체 모방 (팀, 프로젝트, 의사결정, 지식)
- 멀티에이전트 + 복합 네트워크 + 관계/추론

---

## 🎯 최적 아키텍처: **하이브리드 접근 (RDBMS + Graph DB)**

### ✅ 권장 이유

1. **데이터 특성의 이중성**
   - **정형 데이터** (RDBMS에 적합): 사용자 인증, 급여, 계약, 트랜잭션 로그
   - **관계 중심 데이터** (그래프 DB에 적합): 조직 구조, 프로젝트 의존성, 지식 그래프, 의사결정 흐름

2. **마이그레이션 리스크 최소화**
   - 기존 CRM/마케팅 시스템 유지
   - 점진적으로 그래프 기반 기능 추가 가능

3. **성능 최적화**
   - 복잡한 관계 쿼리는 그래프 DB에서 처리 (depth 5+ 순회)
   - 집계/분석/트랜잭션은 RDBMS에서 처리

---

## 🏗️ 구체적 아키텍처 설계

### **레이어 1: RDBMS (PostgreSQL) - 기존 유지**
```
[사용 케이스]
✓ 사용자 인증/권한 (users, departments)
✓ 트랜잭션 데이터 (leads, emails, sequences)
✓ 감사 로그 (activity_logs)
✓ 시계열 데이터 (workflow_executions)
✓ 재무/급여 데이터 (향후 추가)

[장점]
- ACID 보장
- 성숙한 도구/모니터링
- 현재 시스템 호환성 100%
```

### **레이어 2: Graph DB (Neo4j/ArangoDB) - 신규 추가**
```
[사용 케이스]
✓ 조직 관계 (보고 체계, 협업 네트워크)
✓ 프로젝트 의존성 (작업 간 관계, 리소스 흐름)
✓ 지식 그래프 (문서-개념-전문가 연결)
✓ 의사결정 추론 (영향력 분석, 병목 탐지)
✓ 멀티에이전트 통신 경로

[장점]
- O(1) 관계 순회
- 패턴 매칭 (Cypher/AQL)
- 실시간 영향 분석
```

### **레이어 3: 통합 레이어**
```typescript
// 예시: elysia-server/src/services/graph-integration/

// 1. 데이터 동기화 (CDC - Change Data Capture)
PostgreSQL → Debezium → Kafka → Neo4j

// 2. 하이브리드 쿼리 엔진
class HybridQueryEngine {
  async getEmployeeInfluence(userId: string) {
    // RDBMS: 기본 정보
    const user = await db.query.users.findFirst(...)

    // Graph DB: 영향력 네트워크
    const influence = await neo4j.run(`
      MATCH (u:User {id: $userId})-[r:REPORTS_TO|COLLABORATES*1..3]-(connected)
      RETURN connected, r, count(*) as strength
    `, { userId })

    return { user, influence }
  }
}
```

---

## 🔄 구현 로드맵

### **Phase 1: 하이브리드 인프라 구축 (2-3주)**
```bash
1. Neo4j 설치 및 설정
2. 데이터 동기화 파이프라인 구축
3. 기본 노드/관계 스키마 정의
   - (User)-[:REPORTS_TO]->(User)
   - (User)-[:MEMBER_OF]->(Team)
   - (Project)-[:DEPENDS_ON]->(Project)
```

### **Phase 2: LangGraph 멀티에이전트 개선 (3-4주)**
```typescript
// 현재: 단순 SQL 워크플로우
// 개선: 에이전트 기반 추론

const agents = {
  OrgAnalystAgent: {
    tools: [neo4jQuery, postgresQuery],
    graph: createOrgAnalysisGraph()
  },
  ProjectManagerAgent: {
    tools: [dependencyAnalyzer, resourceOptimizer],
    graph: createProjectGraph()
  },
  KnowledgeAgent: {
    tools: [vectorSearch, graphRAG],
    graph: createKnowledgeGraph()
  }
}
```

### **Phase 3: 실시간 추론 엔진 (4-6주)**
```
[기능]
- 조직 변화 시뮬레이션 (팀원 이동 시 영향 분석)
- 병목/단일 장애점 자동 탐지
- 프로젝트 리스크 예측
- 지식 공백 식별
```

---

## 📦 기술 스택 권장

### **그래프 DB 선택 기준**

| DB | 장점 | 단점 | 추천 시나리오 |
|---|---|---|---|
| **Neo4j** | 성숙한 생태계, Cypher 쿼리, GDS 라이브러리 | 비용 (엔터프라이즈), 수평 확장 제한 | **추천**: 복잡한 그래프 알고리즘 필요 시 |
| **ArangoDB** | 멀티모델 (문서+그래프), 수평 확장, 무료 | 커뮤니티 작음 | 유연성 우선 시 |
| **Memgraph** | 매우 빠름, Neo4j 호환 | 생태계 작음 | 실시간 성능 우선 시 |

**최종 권장: Neo4j Community Edition → 엔터프라이즈 필요 시 전환**

### **동기화 방식**

```typescript
// Option A: 실시간 CDC (프로덕션 권장)
PostgreSQL WAL → Debezium → Kafka → Neo4j Sink

// Option B: 배치 동기화 (개발 초기)
setInterval(async () => {
  const changedUsers = await getChangedUsers()
  await neo4j.syncUsers(changedUsers)
}, 5000)
```

---

## 💡 데이터 모델링 예시

### **RDBMS 스키마 (현재 유지)**
```sql
-- 변경 없음
users, departments, leads, emails, sequences...
```

### **그래프 스키마 (신규)**
```cypher
// 노드 타입
(:User {id, name, email, department_id})
(:Department {id, name, code})
(:Team {id, name, mission})
(:Project {id, name, status, deadline})
(:Skill {name, level})
(:Document {id, title, vector_embedding})

// 관계 타입
(User)-[:REPORTS_TO {since, strength}]->(User)
(User)-[:MEMBER_OF {role, joined_at}]->(Team)
(User)-[:HAS_SKILL {proficiency, years}]->(Skill)
(Team)-[:OWNS]->(Project)
(Project)-[:DEPENDS_ON {type, criticality}]->(Project)
(User)-[:CONTRIBUTED_TO {commits, lines}]->(Project)
(Document)-[:RELATED_TO {similarity}]->(Document)
```

---

## ⚠️ 안티패턴 피하기

### **❌ 하지 말아야 할 것**
```typescript
// 1. 모든 데이터를 그래프로 이동
// → 트랜잭션 데이터는 RDBMS에 유지

// 2. 양방향 동기화
// → 단방향 (RDBMS → Graph) 권장

// 3. 그래프에 대용량 속성 저장
// → 큰 텍스트/바이너리는 RDBMS에, 참조만 그래프에
```

### **✅ 해야 할 것**
```typescript
// 1. 명확한 책임 분리
if (query.involves("complex relationships")) {
  return graphDB.query(...)
} else if (query.involves("aggregation")) {
  return postgres.query(...)
}

// 2. 캐싱 레이어
const cache = new Redis()
const result = await cache.getOrSet(
  `org:${userId}:influence`,
  () => hybridQuery.getInfluence(userId),
  3600
)
```

---

## 📈 예상 성능 비교

### **복잡한 조직 관계 쿼리**
```sql
-- RDBMS: 5+ JOIN (1.2초)
SELECT u.*, COUNT(DISTINCT p.id) as influence
FROM users u
JOIN users r1 ON u.id = r1.reports_to
JOIN users r2 ON r1.id = r2.reports_to
JOIN users r3 ON r2.id = r3.reports_to
...

-- Graph DB: Cypher (45ms)
MATCH (u:User {id: $userId})-[:REPORTS_TO*1..5]-(connected)
RETURN u, count(connected) as influence
```

### **리소스 사용량**
- RDBMS 유지: +0% (기존 그대로)
- Neo4j 추가: +2GB RAM, +10GB 스토리지 (초기)

---

## 🎯 결론 및 Next Steps

### **최종 권장사항**
```
✅ 하이브리드 아키텍처 (PostgreSQL + Neo4j)
✅ 점진적 마이그레이션 (기존 시스템 유지)
✅ LangGraph를 멀티에이전트 오케스트레이터로 진화
```

### **즉시 시작 가능한 작업**
```bash
# 1. Neo4j 로컬 설치 및 테스트
docker run -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.15

# 2. 간단한 조직 그래프 구현
# elysia-server/src/services/org-graph/

# 3. 하이브리드 쿼리 POC
```

### **구현 우선순위**

1. **Neo4j 통합 코드 작성** (연결, 스키마, 쿼리 헬퍼)
2. **멀티에이전트 LangGraph 재설계** (현재 단순 SQL 워크플로우 → 에이전트 기반)
3. **데이터 동기화 파이프라인 구현** (PostgreSQL → Neo4j)
4. **조직 시뮬레이션 POC** (팀원 이동 시 영향 분석)

---

## 📚 참고 자료

### **Neo4j 학습 자료**
- [Neo4j 공식 문서](https://neo4j.com/docs/)
- [Cypher 쿼리 언어](https://neo4j.com/developer/cypher/)
- [Graph Data Science Library](https://neo4j.com/docs/graph-data-science/current/)

### **LangGraph 멀티에이전트**
- [LangGraph 공식 문서](https://langchain-ai.github.io/langgraph/)
- [Multi-Agent 패턴](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/)

### **하이브리드 아키텍처 사례**
- LinkedIn (MySQL + Neo4j)
- Airbnb (PostgreSQL + Neo4j)
- eBay (Oracle + Neo4j)
