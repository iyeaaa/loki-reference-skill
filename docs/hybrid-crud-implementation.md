# 하이브리드 DB CRUD 구현 가이드

## 🤔 핵심 질문: CRUD 시 그래프 DB 로직을 어떻게 추가하는가?

**답변: 단계별 진화 전략을 권장합니다.**

---

## 📊 4가지 동기화 패턴 비교

### 1. **동기식 이중 쓰기 (Synchronous Dual Write)** ⚠️
```typescript
// ❌ 안티패턴: 비즈니스 로직에 직접 결합
async function updateUser(userId: string, data: UpdateUserDTO) {
  // RDBMS 업데이트
  await db.update(users).set(data).where(eq(users.id, userId))

  // Graph DB 업데이트 (동기식)
  await neo4j.run(`
    MATCH (u:User {id: $userId})
    SET u.name = $name, u.email = $email
  `, { userId, ...data })
}

// 문제점:
// 1. 두 DB 중 하나 실패 시 일관성 깨짐
// 2. 성능 저하 (2배 레이턴시)
// 3. 비즈니스 로직과 인프라 결합
// 4. 테스트 어려움
```

### 2. **이벤트 기반 (Event-Driven)** ✅ 권장 (Phase 1-2)
```typescript
// ✅ 비즈니스 로직과 분리
async function updateUser(userId: string, data: UpdateUserDTO) {
  // 1. RDBMS 업데이트
  await db.update(users).set(data).where(eq(users.id, userId))

  // 2. 이벤트 발행 (비동기)
  await eventBus.publish('user.updated', {
    userId,
    data,
    timestamp: new Date()
  })
}

// 별도 이벤트 핸들러
eventBus.subscribe('user.updated', async (event) => {
  await graphSyncService.syncUser(event.userId, event.data)
})
```

### 3. **CDC (Change Data Capture)** ✅ 권장 (Phase 3)
```bash
# 비즈니스 로직 변경 없음!
PostgreSQL WAL → Debezium → Kafka → Neo4j Sink Connector

# 장점: 코드 수정 없이 자동 동기화
# 단점: 인프라 복잡도
```

### 4. **Repository 패턴 + Adapter** ✅ 권장 (장기)
```typescript
// 깔끔한 추상화
interface IUserRepository {
  create(data: NewUser): Promise<User>
  update(id: string, data: UpdateUserDTO): Promise<User>
  findById(id: string): Promise<User | null>
  // ... 그래프 특화 메서드
  findInfluenceNetwork(id: string): Promise<InfluenceGraph>
}

// 하이브리드 구현체
class HybridUserRepository implements IUserRepository {
  constructor(
    private postgres: PostgresAdapter,
    private neo4j: Neo4jAdapter,
    private sync: SyncStrategy
  ) {}

  async update(id: string, data: UpdateUserDTO) {
    const user = await this.postgres.update(id, data)
    await this.sync.scheduleSync('user', id) // 전략 패턴
    return user
  }
}
```

---

## 🏗️ 단계별 구현 전략

### **Phase 1: 읽기 전용 그래프 (1-2주)** 🟢 시작 추천

```typescript
// 목표: 비즈니스 로직 변경 최소화
// 전략: 배치 동기화 + 읽기 전용 그래프

// 1. 기존 CRUD는 그대로 유지
async function updateUser(userId: string, data: UpdateUserDTO) {
  return await db.update(users).set(data).where(eq(users.id, userId))
  // 그래프 로직 없음!
}

// 2. 별도 배치 동기화 작업
// elysia-server/src/jobs/sync-to-graph.ts
import cron from 'node-cron'

cron.schedule('*/5 * * * *', async () => {
  const changedUsers = await getChangedUsersSince(lastSyncTime)

  for (const user of changedUsers) {
    await neo4j.run(`
      MERGE (u:User {id: $id})
      SET u.name = $name,
          u.email = $email,
          u.department_id = $departmentId,
          u.updated_at = $updatedAt
    `, user)
  }

  await updateSyncTimestamp()
})

// 3. 그래프는 분석/조회만 사용
async function getUserInfluence(userId: string) {
  const influence = await neo4j.run(`
    MATCH (u:User {id: $userId})-[:REPORTS_TO*1..3]-(team)
    RETURN count(team) as influence_score
  `, { userId })

  return influence
}
```

**장점:**
- 기존 코드 변경 최소화
- 안전한 실험 가능
- 롤백 쉬움

**단점:**
- 5분 지연 (최종 일관성)
- 실시간 그래프 쿼리 불가

---

### **Phase 2: 이벤트 기반 실시간 동기화 (2-3주)** 🟡

```typescript
// 목표: 실시간 동기화 + 비즈니스 로직 분리
// 전략: 이벤트 버스 + 비동기 핸들러

// 1. 이벤트 버스 설정
// elysia-server/src/events/event-bus.ts
import { EventEmitter } from 'events'

type DomainEvent =
  | { type: 'user.created', payload: User }
  | { type: 'user.updated', payload: { id: string, changes: Partial<User> } }
  | { type: 'user.deleted', payload: { id: string } }
  | { type: 'team.member.added', payload: { teamId: string, userId: string } }

class DomainEventBus extends EventEmitter {
  async publish(event: DomainEvent) {
    this.emit(event.type, event.payload)

    // 선택: Redis Pub/Sub for multi-instance
    await redis.publish('domain-events', JSON.stringify(event))
  }
}

export const eventBus = new DomainEventBus()

// 2. Service 레이어에 이벤트 발행 추가
// elysia-server/src/services/user.service.ts
export class UserService {
  async updateUser(userId: string, data: UpdateUserDTO) {
    // RDBMS 업데이트
    const user = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning()

    // 이벤트 발행 (비차단)
    eventBus.publish({
      type: 'user.updated',
      payload: { id: userId, changes: data }
    }).catch(err => {
      logger.error('Failed to publish event', err)
      // RDBMS는 이미 성공했으므로 계속 진행
    })

    return user
  }

  async createUser(data: NewUser) {
    const user = await db.insert(users).values(data).returning()

    eventBus.publish({
      type: 'user.created',
      payload: user[0]
    })

    return user[0]
  }
}

// 3. 그래프 동기화 핸들러 (별도 파일)
// elysia-server/src/services/graph-sync/handlers.ts
import { eventBus } from '../../events/event-bus'
import { neo4jService } from './neo4j.service'

export function registerGraphSyncHandlers() {
  eventBus.on('user.created', async (user: User) => {
    try {
      await neo4jService.createUserNode(user)
      logger.info(`User node created in graph: ${user.id}`)
    } catch (err) {
      logger.error('Graph sync failed', err)
      // TODO: 재시도 큐에 추가
    }
  })

  eventBus.on('user.updated', async ({ id, changes }) => {
    try {
      await neo4jService.updateUserNode(id, changes)
    } catch (err) {
      logger.error('Graph sync failed', err)
    }
  })

  eventBus.on('team.member.added', async ({ teamId, userId }) => {
    try {
      await neo4jService.createRelationship(userId, teamId, 'MEMBER_OF')
    } catch (err) {
      logger.error('Graph relationship creation failed', err)
    }
  })
}

// 4. 서버 시작 시 핸들러 등록
// elysia-server/src/index.ts
import { registerGraphSyncHandlers } from './services/graph-sync/handlers'

registerGraphSyncHandlers()
```

**장점:**
- 비즈니스 로직과 분리
- 비동기 처리로 성능 영향 최소화
- 확장 가능 (다른 핸들러 추가 가능)

**단점:**
- 이벤트 손실 가능성 (재시도 메커니즘 필요)
- 최종 일관성 (즉시 반영 아님)

---

### **Phase 3: CDC 기반 완전 자동화 (3-4주)** 🔵

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: sendgrid
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    command:
      - "postgres"
      - "-c"
      - "wal_level=logical" # CDC 활성화

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092

  debezium:
    image: debezium/connect:2.4
    depends_on:
      - kafka
      - postgres
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: 1
      CONFIG_STORAGE_TOPIC: debezium_configs
      OFFSET_STORAGE_TOPIC: debezium_offsets

  neo4j:
    image: neo4j:5.15
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_kafka_bootstrap_servers: kafka:9092
```

```json
// Debezium Connector 설정
// POST http://localhost:8083/connectors
{
  "name": "postgres-source-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "postgres",
    "database.password": "password",
    "database.dbname": "sendgrid",
    "table.include.list": "public.users,public.departments",
    "topic.prefix": "sendgrid",
    "plugin.name": "pgoutput"
  }
}
```

```typescript
// Neo4j Kafka Consumer (별도 서비스)
// elysia-server/src/services/graph-sync/kafka-consumer.ts
import { Kafka } from 'kafkajs'
import { neo4jService } from './neo4j.service'

const kafka = new Kafka({
  clientId: 'graph-sync',
  brokers: ['kafka:9092']
})

const consumer = kafka.consumer({ groupId: 'neo4j-sync' })

export async function startCDCConsumer() {
  await consumer.connect()
  await consumer.subscribe({
    topics: ['sendgrid.public.users', 'sendgrid.public.departments']
  })

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value.toString())

      switch (topic) {
        case 'sendgrid.public.users':
          await handleUserChange(event)
          break
        case 'sendgrid.public.departments':
          await handleDepartmentChange(event)
          break
      }
    }
  })
}

async function handleUserChange(event: any) {
  const { op, after, before } = event.payload

  switch (op) {
    case 'c': // CREATE
      await neo4jService.createUserNode(after)
      break
    case 'u': // UPDATE
      await neo4jService.updateUserNode(after.id, after)
      break
    case 'd': // DELETE
      await neo4jService.deleteUserNode(before.id)
      break
  }
}
```

**장점:**
- 비즈니스 로직 완전 분리 (코드 수정 없음!)
- 모든 변경 자동 캡처
- 순서 보장

**단점:**
- 인프라 복잡도 증가
- 운영 오버헤드

---

## 🎯 실전 구현: Repository 패턴 (권장)

```typescript
// elysia-server/src/repositories/interfaces.ts
export interface IUserRepository {
  // CRUD (RDBMS)
  create(data: NewUser): Promise<User>
  update(id: string, data: Partial<User>): Promise<User>
  delete(id: string): Promise<void>
  findById(id: string): Promise<User | null>

  // 그래프 쿼리
  findReportingChain(id: string): Promise<User[]>
  findTeamMembers(id: string): Promise<User[]>
  getInfluenceScore(id: string): Promise<number>
}

// elysia-server/src/repositories/user.repository.ts
import { EventEmitter } from 'events'

export class UserRepository implements IUserRepository {
  constructor(
    private db: DrizzleDB,
    private events: EventEmitter,
    private neo4j?: Neo4jService // Optional!
  ) {}

  async create(data: NewUser): Promise<User> {
    const user = await this.db.insert(users).values(data).returning()

    // 이벤트 발행
    this.events.emit('user.created', user[0])

    return user[0]
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning()

    this.events.emit('user.updated', { id, changes: data })

    return user[0]
  }

  // 그래프 쿼리: 보고 체계
  async findReportingChain(id: string): Promise<User[]> {
    if (!this.neo4j) {
      // Fallback: RDBMS로 재귀 쿼리
      return this.findReportingChainSQL(id)
    }

    const result = await this.neo4j.run(`
      MATCH path = (u:User {id: $id})-[:REPORTS_TO*]->(manager)
      RETURN manager
      ORDER BY length(path)
    `, { id })

    return result.records.map(r => r.get('manager').properties)
  }

  // 그래프 쿼리: 영향력 점수
  async getInfluenceScore(id: string): Promise<number> {
    if (!this.neo4j) return 0

    const result = await this.neo4j.run(`
      MATCH (u:User {id: $id})-[:REPORTS_TO|COLLABORATES*1..3]-(connected)
      RETURN count(DISTINCT connected) as score
    `, { id })

    return result.records[0]?.get('score').toNumber() ?? 0
  }

  // Fallback: RDBMS로 재귀 쿼리 (성능 낮음)
  private async findReportingChainSQL(id: string): Promise<User[]> {
    // WITH RECURSIVE 사용
    const result = await this.db.execute(sql`
      WITH RECURSIVE reporting_chain AS (
        SELECT * FROM users WHERE id = ${id}
        UNION ALL
        SELECT u.* FROM users u
        INNER JOIN reporting_chain rc ON u.id = rc.reports_to
      )
      SELECT * FROM reporting_chain
    `)

    return result.rows as User[]
  }
}

// elysia-server/src/services/user.service.ts
export class UserService {
  constructor(private userRepo: IUserRepository) {}

  async updateUserProfile(userId: string, data: UpdateUserDTO) {
    // Repository가 동기화 처리
    return await this.userRepo.update(userId, data)
  }

  async getTeamInsights(userId: string) {
    const user = await this.userRepo.findById(userId)
    const chain = await this.userRepo.findReportingChain(userId)
    const influence = await this.userRepo.getInfluenceScore(userId)

    return { user, chain, influence }
  }
}
```

---

## 🔀 언제 어떤 패턴을 사용할까?

### **시나리오별 권장사항**

| 상황 | 권장 패턴 | 이유 |
|---|---|---|
| **프로젝트 초기** | Phase 1 (배치) | 안전, 간단, 실험 용이 |
| **MVP/프로토타입** | Phase 1 (배치) | 빠른 검증 |
| **프로덕션 준비** | Phase 2 (이벤트) | 비즈니스 로직 분리, 확장성 |
| **대규모 운영** | Phase 3 (CDC) | 자동화, 안정성 |
| **레거시 마이그레이션** | Phase 1 → Phase 3 | 점진적 전환 |

### **복잡도 vs 기능**

```
낮음                                높음
│                                   │
Phase 1 ────→ Phase 2 ────→ Phase 3
배치 동기화    이벤트 기반    CDC 자동화
│              │              │
5분 지연        1초 지연        즉시
코드 수정 없음  Service 수정    인프라 추가
```

---

## 💼 비즈니스 로직 수정 범위

### **Phase 1: 배치 동기화**
```typescript
// ✅ 기존 코드 변경 없음!
async function updateUser(id: string, data: UpdateUserDTO) {
  return await db.update(users).set(data).where(eq(users.id, id))
}
// 동기화는 별도 크론 작업이 처리
```

### **Phase 2: 이벤트 기반**
```typescript
// ⚠️ Service 레이어만 수정
async function updateUser(id: string, data: UpdateUserDTO) {
  const user = await db.update(users).set(data).where(eq(users.id, id))

  // +++ 추가된 부분 +++
  eventBus.publish('user.updated', { id, data })

  return user
}
```

### **Phase 3: CDC**
```typescript
// ✅ 기존 코드 변경 없음!
async function updateUser(id: string, data: UpdateUserDTO) {
  return await db.update(users).set(data).where(eq(users.id, id))
}
// Debezium이 WAL을 자동으로 캡처
```

---

## 🎬 실전 예제: 팀원 추가 시나리오

```typescript
// 시나리오: 사용자를 새 팀에 추가

// === Phase 1 방식 ===
async function addUserToTeam(userId: string, teamId: string) {
  // 1. RDBMS 업데이트
  await db
    .update(users)
    .set({ teamId })
    .where(eq(users.id, userId))

  // 2. 그래프는 다음 배치 동기화 때 반영 (5분 후)
}

// === Phase 2 방식 ===
async function addUserToTeam(userId: string, teamId: string) {
  // 1. RDBMS 업데이트
  await db
    .update(users)
    .set({ teamId })
    .where(eq(users.id, userId))

  // 2. 이벤트 발행
  await eventBus.publish({
    type: 'team.member.added',
    payload: { userId, teamId }
  })
}

// 이벤트 핸들러 (별도 파일)
eventBus.on('team.member.added', async ({ userId, teamId }) => {
  await neo4j.run(`
    MATCH (u:User {id: $userId})
    MATCH (t:Team {id: $teamId})
    MERGE (u)-[:MEMBER_OF {joined_at: datetime()}]->(t)
  `, { userId, teamId })
})

// === Phase 3 방식 ===
async function addUserToTeam(userId: string, teamId: string) {
  // RDBMS 업데이트만 하면 끝!
  await db
    .update(users)
    .set({ teamId })
    .where(eq(users.id, userId))

  // Debezium이 자동으로 캡처하여 Kafka로 발행
  // Kafka Consumer가 Neo4j에 반영
}
```

---

## 🛡️ 에러 처리 및 재시도

```typescript
// elysia-server/src/services/graph-sync/retry-queue.ts
import Bull from 'bull'

interface SyncJob {
  entity: 'user' | 'department' | 'team'
  operation: 'create' | 'update' | 'delete'
  data: any
}

const syncQueue = new Bull<SyncJob>('graph-sync', {
  redis: { host: 'localhost', port: 6379 }
})

// 재시도 설정
syncQueue.process(async (job) => {
  const { entity, operation, data } = job.data

  try {
    switch (entity) {
      case 'user':
        await graphSyncService.syncUser(operation, data)
        break
      case 'department':
        await graphSyncService.syncDepartment(operation, data)
        break
    }
  } catch (error) {
    logger.error('Graph sync failed', { job: job.data, error })

    // 5회 재시도 후 실패
    if (job.attemptsMade >= 5) {
      await deadLetterQueue.add(job.data)
    }

    throw error // Bull이 자동 재시도
  }
})

// 이벤트 핸들러에서 큐 사용
eventBus.on('user.updated', async ({ id, changes }) => {
  await syncQueue.add({
    entity: 'user',
    operation: 'update',
    data: { id, changes }
  }, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  })
})
```

---

## 📊 모니터링 및 일관성 검증

```typescript
// elysia-server/src/services/graph-sync/validator.ts
export class DataConsistencyValidator {
  async validateUserSync(userId: string) {
    // RDBMS에서 가져오기
    const pgUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    })

    // Neo4j에서 가져오기
    const result = await neo4j.run(`
      MATCH (u:User {id: $userId})
      RETURN u
    `, { userId })

    const neo4jUser = result.records[0]?.get('u').properties

    // 비교
    if (!neo4jUser) {
      logger.warn('User missing in Neo4j', { userId })
      return { consistent: false, reason: 'missing' }
    }

    if (pgUser.name !== neo4jUser.name ||
        pgUser.email !== neo4jUser.email) {
      logger.warn('User data mismatch', {
        userId,
        postgres: pgUser,
        neo4j: neo4jUser
      })
      return { consistent: false, reason: 'mismatch' }
    }

    return { consistent: true }
  }

  // 정기 검증 작업
  async runConsistencyCheck() {
    const users = await db.select({ id: users.id }).from(users)

    for (const user of users) {
      const result = await this.validateUserSync(user.id)

      if (!result.consistent) {
        // 자동 재동기화
        await syncQueue.add({
          entity: 'user',
          operation: 'update',
          data: user
        })
      }
    }
  }
}

// 크론 작업
cron.schedule('0 2 * * *', async () => {
  const validator = new DataConsistencyValidator()
  await validator.runConsistencyCheck()
})
```

---

## 🎯 최종 권장사항

### **프로젝트 규모별 선택**

```typescript
// 소규모 (팀 5-10명)
const strategy = 'Phase 1: 배치 동기화'
const implementation = '크론 작업 + 읽기 전용 그래프'
const effort = '1주'

// 중규모 (팀 10-50명)
const strategy = 'Phase 2: 이벤트 기반'
const implementation = 'EventEmitter + 재시도 큐'
const effort = '2-3주'

// 대규모 (팀 50명+)
const strategy = 'Phase 3: CDC'
const implementation = 'Debezium + Kafka + Neo4j'
const effort = '4-6주'
```

### **구현 체크리스트**

```markdown
Phase 1 (시작)
- [ ] Neo4j Docker 설치
- [ ] 기본 노드/관계 스키마 정의
- [ ] 배치 동기화 크론 작업 구현
- [ ] 읽기 전용 그래프 쿼리 API 추가

Phase 2 (확장)
- [ ] EventEmitter/EventBus 구현
- [ ] Service 레이어에 이벤트 발행 추가
- [ ] 그래프 동기화 핸들러 구현
- [ ] Bull 재시도 큐 설정
- [ ] 일관성 검증 스크립트 작성

Phase 3 (자동화)
- [ ] Kafka + Zookeeper 설정
- [ ] Debezium Connector 설정
- [ ] Kafka Consumer 구현
- [ ] 모니터링 대시보드 설정
- [ ] 백업/복구 전략 수립
```

---

## 📚 다음 단계

1. **POC 구현**: Phase 1로 시작하여 그래프 쿼리 효과 검증
2. **성능 측정**: RDBMS vs Graph DB 쿼리 속도 비교
3. **점진적 마이그레이션**: Phase 2로 전환
4. **프로덕션 준비**: 모니터링, 에러 처리, 백업 전략 수립
