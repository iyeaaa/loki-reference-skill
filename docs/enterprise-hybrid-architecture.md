# 엔터프라이즈급 하이브리드 아키텍처 설계

## 🏢 대규모 엔터프라이즈 요구사항

### 핵심 요구사항
- **확장성**: 10,000+ 동시 사용자, 1M+ TPS 처리
- **고가용성**: 99.99% 가동률 (연간 52분 이하 다운타임)
- **데이터 일관성**: 강한 일관성 + 최종 일관성 하이브리드
- **실시간성**: < 100ms 응답 시간, < 1초 동기화 지연
- **감사 가능성**: 모든 변경사항 추적 및 복구 가능
- **다중 리전**: 글로벌 배포 지원
- **제로 다운타임**: 배포 및 마이그레이션 시 서비스 중단 없음

---

## 🏗️ 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
│  Web App  │  Mobile App  │  Desktop App  │  3rd Party API           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  API Gateway    │ (Kong, AWS API Gateway)
                    │  - Rate Limit   │
                    │  - Auth         │
                    │  - Load Balance │
                    └────────┬────────┘
                             │
        ┏━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━┓
        ▼                                           ▼
┌───────────────────┐                    ┌──────────────────┐
│  Service Mesh     │                    │  GraphQL Gateway │
│  (Istio/Linkerd)  │                    │  (Federation)    │
└────────┬──────────┘                    └─────────┬────────┘
         │                                          │
    ┌────┴────┬────────┬──────────┬────────────┐  │
    ▼         ▼        ▼          ▼            ▼  │
┌───────┐ ┌──────┐ ┌──────┐  ┌────────┐  ┌────────┐
│ User  │ │ Lead │ │ Email│  │Workflow│  │Analytics│
│Service│ │Service│ │Service  │Service │  │Service │
└───┬───┘ └───┬──┘ └───┬──┘  └───┬────┘  └───┬────┘
    │         │        │         │           │
    │    ┌────▼────────▼─────────▼───────────▼─────┐
    │    │      Event Bus (Kafka Cluster)          │
    │    │  - 3 Brokers (Replication Factor: 3)    │
    │    │  - Topics: commands, events, analytics   │
    │    └────┬────────┬─────────┬──────────┬──────┘
    │         │        │         │          │
    │         │        │         │          │
┌───▼─────────▼────────┴─┐   ┌───▼──────────▼───────────┐
│  RDBMS Cluster         │   │  Graph DB Cluster        │
│  (PostgreSQL)          │   │  (Neo4j Enterprise)      │
│  - Primary/Replica     │   │  - Causal Cluster (3+)   │
│  - WAL Replication     │   │  - Read Replicas         │
│  - Debezium CDC        │   │  - Fabric Sharding       │
└────────┬───────────────┘   └──────────┬───────────────┘
         │                              │
         │    ┌─────────────────────────┤
         │    │                         │
    ┌────▼────▼────┐              ┌────▼──────────┐
    │  Redis        │              │  Object Store │
    │  Cluster      │              │  (S3/MinIO)   │
    │  - Cache      │              │  - Backups    │
    │  - Session    │              │  - Archives   │
    │  - Queue      │              │  - Snapshots  │
    └───────────────┘              └───────────────┘
         │
    ┌────▼──────────────────────────────┐
    │  Observability Stack              │
    │  - Prometheus (Metrics)           │
    │  - Grafana (Visualization)        │
    │  - Jaeger (Distributed Tracing)   │
    │  - ELK Stack (Logging)            │
    │  - PagerDuty (Alerting)           │
    └───────────────────────────────────┘
```

---

## 🎯 핵심 아키텍처 패턴

### 1. **Event Sourcing + CQRS**

#### Event Sourcing 구조
```typescript
// 모든 변경사항을 이벤트로 저장
interface DomainEvent {
  id: string
  aggregateId: string
  aggregateType: 'User' | 'Lead' | 'Department'
  eventType: string
  version: number
  timestamp: Date
  userId: string
  metadata: Record<string, any>
  payload: any
}

// 이벤트 스토어 (PostgreSQL)
CREATE TABLE event_store (
  id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  version INT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  user_id UUID,
  metadata JSONB,
  payload JSONB NOT NULL,

  -- 동시성 제어
  CONSTRAINT version_unique UNIQUE (aggregate_id, version)
);

-- 인덱스
CREATE INDEX idx_aggregate ON event_store(aggregate_id, version);
CREATE INDEX idx_event_type ON event_store(event_type, timestamp);
CREATE INDEX idx_timestamp ON event_store(timestamp DESC);
```

#### CQRS 구현
```typescript
// Command Side (쓰기)
class UserCommandService {
  async createUser(command: CreateUserCommand): Promise<void> {
    // 1. 비즈니스 로직 검증
    await this.validator.validate(command)

    // 2. 이벤트 생성
    const event: UserCreatedEvent = {
      id: uuid(),
      aggregateId: command.userId,
      aggregateType: 'User',
      eventType: 'UserCreated',
      version: 1,
      timestamp: new Date(),
      userId: command.createdBy,
      payload: command.data
    }

    // 3. 이벤트 저장 (트랜잭션)
    await db.transaction(async (tx) => {
      // Event Store에 저장
      await tx.insert(eventStore).values(event)

      // Outbox 패턴: Kafka 발행 보장
      await tx.insert(outbox).values({
        eventId: event.id,
        topic: 'user-events',
        payload: event,
        status: 'pending'
      })
    })

    // 4. 비동기로 Kafka 발행 (별도 프로세스)
    // Outbox Poller가 처리
  }
}

// Query Side (읽기)
class UserQueryService {
  constructor(
    private pgReadReplica: Database,
    private neo4j: Neo4jService,
    private cache: RedisService
  ) {}

  async getUserProfile(userId: string): Promise<UserProfile> {
    // 1. 캐시 확인
    const cached = await this.cache.get(`user:${userId}`)
    if (cached) return cached

    // 2. Read Replica에서 조회
    const user = await this.pgReadReplica
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    // 3. 캐시 저장 (5분)
    await this.cache.set(`user:${userId}`, user, 300)

    return user
  }

  async getUserInfluenceGraph(userId: string): Promise<InfluenceGraph> {
    // 그래프 DB에서 조회
    return await this.neo4j.getInfluenceNetwork(userId)
  }
}
```

---

### 2. **Transactional Outbox 패턴**

```typescript
// Outbox 테이블 (PostgreSQL)
CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES event_store(id),
  topic VARCHAR(100) NOT NULL,
  partition_key VARCHAR(255),
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  INDEX idx_status (status, created_at)
);

// Outbox Poller (별도 서비스)
class OutboxPoller {
  private kafka: Kafka
  private db: Database

  async poll(): Promise<void> {
    // 1. Pending 메시지 조회 (배치)
    const messages = await this.db
      .select()
      .from(outbox)
      .where(eq(outbox.status, 'pending'))
      .orderBy(outbox.createdAt)
      .limit(100)

    for (const msg of messages) {
      try {
        // 2. Kafka 발행
        await this.kafka.send({
          topic: msg.topic,
          key: msg.partitionKey,
          value: JSON.stringify(msg.payload)
        })

        // 3. 상태 업데이트
        await this.db
          .update(outbox)
          .set({
            status: 'processed',
            processedAt: new Date()
          })
          .where(eq(outbox.id, msg.id))

      } catch (error) {
        // 4. 재시도 로직
        await this.handleRetry(msg, error)
      }
    }
  }

  private async handleRetry(msg: OutboxMessage, error: Error) {
    const retryCount = msg.retryCount + 1

    if (retryCount >= 5) {
      // Dead Letter Queue로 이동
      await this.db
        .update(outbox)
        .set({
          status: 'failed',
          retryCount,
          errorMessage: error.message
        })
        .where(eq(outbox.id, msg.id))

      await this.alerting.send({
        severity: 'critical',
        message: `Outbox message failed after 5 retries: ${msg.id}`
      })
    } else {
      // 지수 백오프로 재시도
      await this.db
        .update(outbox)
        .set({
          retryCount,
          errorMessage: error.message
        })
        .where(eq(outbox.id, msg.id))
    }
  }
}

// 크론으로 실행 (1초마다)
setInterval(() => outboxPoller.poll(), 1000)
```

---

### 3. **CDC (Change Data Capture) 기반 동기화**

#### Debezium 설정 (프로덕션급)

```yaml
# docker-compose-production.yml
version: '3.8'

services:
  # PostgreSQL (Primary)
  postgres-primary:
    image: postgres:15
    environment:
      POSTGRES_DB: enterprise_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    command:
      - "postgres"
      - "-c"
      - "wal_level=logical"
      - "-c"
      - "max_replication_slots=10"
      - "-c"
      - "max_wal_senders=10"
    volumes:
      - postgres-primary-data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '4'
          memory: 8G

  # PostgreSQL (Read Replica)
  postgres-replica:
    image: postgres:15
    environment:
      POSTGRES_PRIMARY_CONNINFO: host=postgres-primary user=replicator password=${REPL_PASSWORD}
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G

  # Kafka Cluster (3 brokers)
  kafka-1:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 2
      KAFKA_MIN_INSYNC_REPLICAS: 2
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  kafka-2:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_BROKER_ID: 2
      # ... 동일 설정

  kafka-3:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_BROKER_ID: 3
      # ... 동일 설정

  # Debezium Connect Cluster
  debezium-1:
    image: debezium/connect:2.4
    environment:
      BOOTSTRAP_SERVERS: kafka-1:9092,kafka-2:9092,kafka-3:9092
      GROUP_ID: debezium-cluster
      CONFIG_STORAGE_TOPIC: debezium_configs
      OFFSET_STORAGE_TOPIC: debezium_offsets
      STATUS_STORAGE_TOPIC: debezium_status
      CONFIG_STORAGE_REPLICATION_FACTOR: 3
      OFFSET_STORAGE_REPLICATION_FACTOR: 3
      STATUS_STORAGE_REPLICATION_FACTOR: 3
    deploy:
      replicas: 3

  # Neo4j Causal Cluster
  neo4j-core-1:
    image: neo4j:5.15-enterprise
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
      NEO4J_dbms_mode: CORE
      NEO4J_causal__clustering_initial__discovery__members: >-
        neo4j-core-1:5000,neo4j-core-2:5000,neo4j-core-3:5000
      NEO4J_dbms_memory_heap_max__size: 4G
      NEO4J_dbms_memory_pagecache_size: 2G
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G

  neo4j-core-2:
    image: neo4j:5.15-enterprise
    # ... 동일 설정

  neo4j-core-3:
    image: neo4j:5.15-enterprise
    # ... 동일 설정

  # Neo4j Read Replica
  neo4j-replica-1:
    image: neo4j:5.15-enterprise
    environment:
      NEO4J_dbms_mode: READ_REPLICA
      NEO4J_causal__clustering_initial__discovery__members: >-
        neo4j-core-1:5000,neo4j-core-2:5000,neo4j-core-3:5000
    deploy:
      replicas: 2

  # Redis Cluster
  redis-1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
    deploy:
      replicas: 6  # 3 masters + 3 replicas
```

#### Debezium Connector 설정

```json
{
  "name": "postgres-enterprise-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres-primary",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "${DB_PASSWORD}",
    "database.dbname": "enterprise_db",
    "topic.prefix": "enterprise",

    "table.include.list": "public.users,public.departments,public.leads,public.event_store",

    "plugin.name": "pgoutput",
    "slot.name": "debezium_slot",
    "publication.name": "debezium_publication",

    "snapshot.mode": "initial",
    "snapshot.locking.mode": "minimal",

    "heartbeat.interval.ms": 10000,
    "heartbeat.action.query": "INSERT INTO heartbeat (ts) VALUES (NOW())",

    "transforms": "unwrap,route",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.drop.tombstones": false,
    "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
    "transforms.route.regex": "([^.]+)\\.([^.]+)\\.([^.]+)",
    "transforms.route.replacement": "$3-changes",

    "errors.tolerance": "all",
    "errors.log.enable": true,
    "errors.log.include.messages": true,
    "errors.deadletterqueue.topic.name": "dlq-postgres-connector",
    "errors.deadletterqueue.context.headers.enable": true,

    "max.batch.size": 2048,
    "max.queue.size": 8192,
    "poll.interval.ms": 1000
  }
}
```

---

### 4. **다층 캐싱 전략**

```typescript
// 3-Tier 캐싱 아키텍처
class CacheStrategy {
  constructor(
    private l1Cache: NodeCache,        // L1: 로컬 메모리 (100ms TTL)
    private l2Cache: RedisService,     // L2: Redis (5분 TTL)
    private l3Source: DatabaseService  // L3: Database
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // L1: 로컬 캐시
    let value = this.l1Cache.get<T>(key)
    if (value) {
      this.metrics.increment('cache.l1.hit')
      return value
    }

    // L2: Redis 캐시
    value = await this.l2Cache.get<T>(key)
    if (value) {
      this.metrics.increment('cache.l2.hit')
      // L1 캐시에 저장
      this.l1Cache.set(key, value, 0.1) // 100ms
      return value
    }

    // L3: Database
    value = await this.l3Source.query<T>(key)
    if (value) {
      this.metrics.increment('cache.miss')
      // L2 캐시에 저장
      await this.l2Cache.set(key, value, 300) // 5분
      // L1 캐시에 저장
      this.l1Cache.set(key, value, 0.1)
      return value
    }

    return null
  }

  async invalidate(pattern: string): Promise<void> {
    // L1 캐시 무효화
    this.l1Cache.flushAll()

    // L2 캐시 무효화 (패턴 매칭)
    const keys = await this.l2Cache.keys(pattern)
    if (keys.length > 0) {
      await this.l2Cache.del(...keys)
    }
  }
}

// Cache-Aside 패턴 + Write-Through
class UserService {
  async getUser(userId: string): Promise<User> {
    return await this.cache.get(`user:${userId}`) ||
           await this.loadAndCacheUser(userId)
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    // 1. DB 업데이트
    const user = await this.db.update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning()

    // 2. Write-Through: 캐시 즉시 업데이트
    await this.cache.set(`user:${userId}`, user, 300)

    // 3. 관련 캐시 무효화
    await this.cache.invalidate(`user:${userId}:*`)

    return user
  }
}
```

---

### 5. **Circuit Breaker 패턴**

```typescript
import CircuitBreaker from 'opossum'

class ResilientNeo4jService {
  private breaker: CircuitBreaker

  constructor(private neo4j: Neo4jService) {
    // Circuit Breaker 설정
    this.breaker = new CircuitBreaker(
      async (query: string, params: any) => {
        return await this.neo4j.run(query, params)
      },
      {
        timeout: 3000,        // 3초 타임아웃
        errorThresholdPercentage: 50,  // 50% 실패 시 Open
        resetTimeout: 30000,  // 30초 후 Half-Open
        rollingCountTimeout: 10000,    // 10초 윈도우
        volumeThreshold: 10,  // 최소 10개 요청

        // Fallback
        fallback: () => {
          this.metrics.increment('neo4j.circuit.open')
          throw new ServiceUnavailableError('Graph service temporarily unavailable')
        }
      }
    )

    // 이벤트 핸들러
    this.breaker.on('open', () => {
      this.logger.error('[CircuitBreaker] Neo4j circuit opened')
      this.alerting.send({
        severity: 'critical',
        message: 'Neo4j circuit breaker opened'
      })
    })

    this.breaker.on('halfOpen', () => {
      this.logger.warn('[CircuitBreaker] Neo4j circuit half-open (testing)')
    })

    this.breaker.on('close', () => {
      this.logger.info('[CircuitBreaker] Neo4j circuit closed (recovered)')
    })
  }

  async query(cypher: string, params: any) {
    try {
      return await this.breaker.fire(cypher, params)
    } catch (error) {
      // Graceful degradation
      return this.fallbackQuery(cypher, params)
    }
  }

  private async fallbackQuery(cypher: string, params: any) {
    // PostgreSQL로 폴백 (제한된 기능)
    this.logger.warn('[Neo4j] Using PostgreSQL fallback')
    return await this.postgresAdapter.executeCypher(cypher, params)
  }
}
```

---

## 📊 성능 최적화

### 1. **Connection Pooling**

```typescript
// PostgreSQL Connection Pool
import { Pool } from 'pg'

const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // 풀 설정
  min: 20,              // 최소 연결
  max: 100,             // 최대 연결
  idleTimeoutMillis: 30000,     // 30초 유휴 시 반환
  connectionTimeoutMillis: 5000, // 5초 연결 타임아웃

  // Statement timeout
  statement_timeout: 10000, // 10초

  // Application name (모니터링용)
  application_name: 'enterprise-app'
})

// Neo4j Connection Pool
const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 60000,
    maxTransactionRetryTime: 30000,

    // Load balancing
    connectionLivenessCheckTimeout: 30000,

    // Logging
    logging: {
      level: 'info',
      logger: (level, message) => winston.log(level, message)
    }
  }
)
```

### 2. **Query Optimization**

```typescript
// PostgreSQL 최적화
class OptimizedUserRepository {
  async getUsersWithDepartments(filters: Filters) {
    // N+1 문제 방지: JOIN 사용
    return await db
      .select({
        user: users,
        department: departments
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(this.buildFilters(filters))
      .limit(100)
  }

  async bulkInsert(userData: NewUser[]) {
    // 배치 인서트 (1000개씩)
    const batchSize = 1000
    for (let i = 0; i < userData.length; i += batchSize) {
      const batch = userData.slice(i, i + batchSize)
      await db.insert(users).values(batch)
    }
  }
}

// Neo4j 최적화
class OptimizedGraphRepository {
  async getOrgChart() {
    // 1. 인덱스 활용
    // 2. LIMIT 사용
    // 3. 필요한 속성만 반환
    return await neo4j.run(`
      MATCH (u:User)-[:REPORTS_TO*..3]->(manager)
      WHERE u.isActive = true
      RETURN
        u.id,
        u.username,
        collect(DISTINCT manager.id) as managers
      ORDER BY u.username
      LIMIT 1000
    `)
  }

  async findInfluenceWithCache(userId: string) {
    // Cypher 쿼리 캐시 활용
    return await neo4j.run(`
      // CYPHER runtime=slotted
      MATCH (u:User {id: $userId})-[:REPORTS_TO|COLLABORATES*1..3]-(connected)
      RETURN count(DISTINCT connected) as score
    `, { userId })
  }
}
```

### 3. **인덱스 전략**

```sql
-- PostgreSQL 인덱스
-- 1. 기본 키 (자동 생성)
-- 2. 외래 키
CREATE INDEX idx_users_department_id ON users(department_id);

-- 3. 자주 조회되는 컬럼
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);

-- 4. 복합 인덱스 (자주 함께 사용)
CREATE INDEX idx_users_active_dept ON users(is_active, department_id)
  WHERE is_active = true;

-- 5. 부분 인덱스
CREATE INDEX idx_active_users ON users(id)
  WHERE is_active = true;

-- 6. GIN 인덱스 (JSONB)
CREATE INDEX idx_users_metadata ON users USING GIN(metadata);

-- 7. 전문 검색
CREATE INDEX idx_users_search ON users USING GIN(
  to_tsvector('english', username || ' ' || email)
);
```

```cypher
// Neo4j 인덱스
// 1. 노드 속성 인덱스
CREATE INDEX user_id_index FOR (u:User) ON (u.id);
CREATE INDEX user_email_index FOR (u:User) ON (u.email);

// 2. 복합 인덱스
CREATE INDEX user_active_dept_index FOR (u:User) ON (u.isActive, u.departmentId);

// 3. 전문 검색 인덱스
CREATE FULLTEXT INDEX user_search_index
FOR (u:User)
ON EACH [u.username, u.email];

// 4. 관계 속성 인덱스
CREATE INDEX reports_since_index FOR ()-[r:REPORTS_TO]-() ON (r.since);

// 5. 제약조건 (자동으로 인덱스 생성)
CREATE CONSTRAINT user_id_unique FOR (u:User) REQUIRE u.id IS UNIQUE;
```

---

## 🔒 보안 및 권한 관리

### 1. **Row-Level Security (RLS)**

```sql
-- PostgreSQL RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 정책: 같은 부서만 조회
CREATE POLICY users_department_isolation ON users
  FOR SELECT
  USING (
    department_id = current_setting('app.current_department_id')::UUID
    OR
    current_setting('app.user_role') = 'admin'
  );

-- 정책: 자기 자신만 수정
CREATE POLICY users_self_update ON users
  FOR UPDATE
  USING (id = current_setting('app.current_user_id')::UUID);
```

### 2. **Neo4j 보안**

```cypher
// 역할 기반 접근 제어 (RBAC)
CREATE ROLE analyst;
GRANT READ {*} ON GRAPH * TO analyst;

CREATE ROLE manager;
GRANT READ, WRITE {*} ON GRAPH * TO manager;

CREATE ROLE admin;
GRANT ALL ON GRAPH * TO admin;

// 사용자 생성
CREATE USER john SET PASSWORD 'secure_password';
GRANT ROLE manager TO john;
```

### 3. **API 레벨 인증/인가**

```typescript
// JWT 기반 인증
import jwt from 'jsonwebtoken'

interface JWTPayload {
  userId: string
  email: string
  role: 'admin' | 'manager' | 'user'
  departmentId: string
  permissions: string[]
}

class AuthMiddleware {
  async authenticate(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload

      // Redis에서 세션 확인 (Logout 처리)
      const isValid = await redis.get(`session:${payload.userId}`)
      if (!isValid) {
        throw new UnauthorizedError('Session expired')
      }

      return payload
    } catch (error) {
      throw new UnauthorizedError('Invalid token')
    }
  }

  authorize(requiredPermissions: string[]) {
    return async (req: Request) => {
      const user = req.user as JWTPayload

      const hasPermission = requiredPermissions.every(perm =>
        user.permissions.includes(perm)
      )

      if (!hasPermission) {
        throw new ForbiddenError('Insufficient permissions')
      }
    }
  }
}

// 사용 예시
app.get('/api/users',
  authMiddleware.authenticate,
  authMiddleware.authorize(['users:read']),
  async (req, res) => {
    // 핸들러
  }
)
```

---

## 📈 모니터링 및 관찰성

### 1. **메트릭 수집 (Prometheus)**

```typescript
import { Counter, Histogram, Gauge } from 'prom-client'

// 메트릭 정의
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
})

const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['database', 'operation']
})

const cacheHitRate = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_layer']
})

const activeConnections = new Gauge({
  name: 'db_active_connections',
  help: 'Number of active database connections',
  labelNames: ['database']
})

// 미들웨어
class MetricsMiddleware {
  async recordRequest(req: Request, res: Response, next: NextFunction) {
    const start = Date.now()

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000
      httpRequestDuration
        .labels(req.method, req.route.path, res.statusCode.toString())
        .observe(duration)
    })

    next()
  }
}

// 데이터베이스 메트릭
class MetricsRepository {
  async query(sql: string) {
    const start = Date.now()
    try {
      const result = await this.db.query(sql)
      const duration = (Date.now() - start) / 1000
      dbQueryDuration.labels('postgres', 'select').observe(duration)
      return result
    } catch (error) {
      dbQueryDuration.labels('postgres', 'error').observe(0)
      throw error
    }
  }
}
```

### 2. **분산 추적 (Jaeger)**

```typescript
import { initTracer } from 'jaeger-client'
import opentracing from 'opentracing'

// Tracer 초기화
const tracer = initTracer(
  {
    serviceName: 'enterprise-app',
    sampler: {
      type: 'probabilistic',
      param: 0.1  // 10% 샘플링
    },
    reporter: {
      agentHost: process.env.JAEGER_AGENT_HOST,
      agentPort: 6831
    }
  },
  {
    logger: winston
  }
)

// 미들웨어
class TracingMiddleware {
  async trace(req: Request, res: Response, next: NextFunction) {
    const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`)
    span.setTag(opentracing.Tags.HTTP_METHOD, req.method)
    span.setTag(opentracing.Tags.HTTP_URL, req.url)

    req.span = span

    res.on('finish', () => {
      span.setTag(opentracing.Tags.HTTP_STATUS_CODE, res.statusCode)
      span.finish()
    })

    next()
  }
}

// 서비스에서 사용
class UserService {
  async getUser(userId: string, parentSpan?: Span) {
    const span = tracer.startSpan('UserService.getUser', {
      childOf: parentSpan
    })
    span.setTag('userId', userId)

    try {
      // 캐시 조회
      const cacheSpan = tracer.startSpan('cache.get', { childOf: span })
      const cached = await cache.get(`user:${userId}`)
      cacheSpan.finish()

      if (cached) return cached

      // DB 조회
      const dbSpan = tracer.startSpan('postgres.query', { childOf: span })
      const user = await db.query.users.findFirst(...)
      dbSpan.finish()

      return user
    } finally {
      span.finish()
    }
  }
}
```

### 3. **로깅 (ELK Stack)**

```typescript
import winston from 'winston'
import { ElasticsearchTransport } from 'winston-elasticsearch'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'enterprise-app',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console (개발)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    // Elasticsearch (프로덕션)
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL,
        auth: {
          username: process.env.ES_USERNAME,
          password: process.env.ES_PASSWORD
        }
      },
      index: 'app-logs',
      bufferLimit: 100
    })
  ]
})

// 구조화된 로깅
logger.info('User created', {
  userId: user.id,
  email: user.email,
  departmentId: user.departmentId,
  traceId: span.context().toTraceId()
})

// 에러 로깅
logger.error('Database query failed', {
  error: error.message,
  stack: error.stack,
  query: sql,
  userId: req.user.id
})
```

### 4. **알림 (PagerDuty)**

```typescript
import { PagerDuty } from 'pagerduty'

class AlertingService {
  private pagerduty: PagerDuty

  async sendCriticalAlert(message: string, context: any) {
    await this.pagerduty.createIncident({
      title: message,
      service: {
        id: process.env.PAGERDUTY_SERVICE_ID,
        type: 'service_reference'
      },
      urgency: 'high',
      body: {
        type: 'incident_body',
        details: JSON.stringify(context, null, 2)
      }
    })

    // 동시에 Slack 알림
    await this.slack.send({
      channel: '#critical-alerts',
      text: `:rotating_light: ${message}`,
      attachments: [{
        color: 'danger',
        fields: Object.entries(context).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true
        }))
      }]
    })
  }
}

// 사용 예시
if (errorRate > 0.05) {
  await alerting.sendCriticalAlert('Error rate exceeded 5%', {
    currentRate: errorRate,
    threshold: 0.05,
    service: 'user-service',
    timestamp: new Date()
  })
}
```

---

## 🔄 배포 전략

### 1. **Blue-Green Deployment**

```yaml
# kubernetes/deployment-blue.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-blue
  labels:
    app: enterprise-app
    version: blue
spec:
  replicas: 5
  selector:
    matchLabels:
      app: enterprise-app
      version: blue
  template:
    metadata:
      labels:
        app: enterprise-app
        version: blue
    spec:
      containers:
      - name: app
        image: enterprise-app:v1.0.0
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"

---
# kubernetes/deployment-green.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-green
  labels:
    app: enterprise-app
    version: green
spec:
  replicas: 5
  selector:
    matchLabels:
      app: enterprise-app
      version: green
  template:
    metadata:
      labels:
        app: enterprise-app
        version: green
    spec:
      containers:
      - name: app
        image: enterprise-app:v1.1.0  # 새 버전

---
# kubernetes/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: app-service
spec:
  selector:
    app: enterprise-app
    version: blue  # 트래픽은 blue로
  ports:
  - port: 80
    targetPort: 3000
```

```bash
# 배포 스크립트
#!/bin/bash

# 1. Green 배포
kubectl apply -f deployment-green.yaml

# 2. Health check 대기
kubectl rollout status deployment/app-green

# 3. 트래픽 전환 (Blue → Green)
kubectl patch service app-service -p '{"spec":{"selector":{"version":"green"}}}'

# 4. 모니터링 (5분)
sleep 300

# 5. 에러율 확인
ERROR_RATE=$(curl -s http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m]))

if [ "$ERROR_RATE" -gt "0.01" ]; then
  echo "Rollback due to high error rate"
  kubectl patch service app-service -p '{"spec":{"selector":{"version":"blue"}}}'
  exit 1
fi

# 6. Blue 제거
kubectl delete deployment app-blue
```

### 2. **Canary Deployment**

```yaml
# Istio VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: app-canary
spec:
  hosts:
  - app.example.com
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: app-service
        subset: v2
  - route:
    - destination:
        host: app-service
        subset: v1
      weight: 90
    - destination:
        host: app-service
        subset: v2
      weight: 10  # 10% 트래픽만 v2로
```

---

## 💾 백업 및 재해 복구

### 1. **PostgreSQL 백업**

```bash
#!/bin/bash
# backup.sh

# 1. 전체 백업 (매일 00:00)
pg_dump -h $DB_HOST -U postgres -Fc enterprise_db > \
  /backups/full_$(date +%Y%m%d).dump

# 2. WAL 아카이빙 (실시간)
archive_command = 'cp %p /archive/%f'

# 3. S3 업로드
aws s3 cp /backups/full_$(date +%Y%m%d).dump \
  s3://backups/postgres/full_$(date +%Y%m%d).dump

# 4. 오래된 백업 삭제 (30일 이상)
find /backups -name "full_*.dump" -mtime +30 -delete

# 5. 백업 검증
pg_restore -l /backups/full_$(date +%Y%m%d).dump > /dev/null
if [ $? -ne 0 ]; then
  echo "Backup validation failed!" | mail -s "Backup Alert" ops@example.com
fi
```

### 2. **Neo4j 백업**

```bash
#!/bin/bash
# neo4j-backup.sh

# 1. Online backup (엔터프라이즈 기능)
neo4j-admin backup \
  --from=neo4j://neo4j-core-1:6362 \
  --backup-dir=/backups \
  --database=neo4j \
  --include-metadata=all

# 2. Export (Cypher Shell)
cypher-shell -u neo4j -p $NEO4J_PASSWORD \
  "CALL apoc.export.cypher.all('/backups/export_$(date +%Y%m%d).cypher', {})"

# 3. S3 업로드
aws s3 sync /backups s3://backups/neo4j/
```

### 3. **재해 복구 절차**

```bash
#!/bin/bash
# disaster-recovery.sh

echo "=== Disaster Recovery Started ==="

# 1. PostgreSQL 복구
echo "Restoring PostgreSQL..."
pg_restore -h $DB_HOST -U postgres -d enterprise_db \
  /backups/latest.dump

# 2. Neo4j 복구
echo "Restoring Neo4j..."
neo4j-admin restore \
  --from=/backups/latest \
  --database=neo4j \
  --force

# 3. 서비스 재시작
kubectl rollout restart deployment/app-deployment

# 4. Health check
for i in {1..30}; do
  STATUS=$(curl -s http://app-service/health | jq -r '.status')
  if [ "$STATUS" = "healthy" ]; then
    echo "Service recovered successfully"
    exit 0
  fi
  sleep 10
done

echo "Recovery failed!"
exit 1
```

---

## 📊 용량 계획 (Capacity Planning)

### 예상 트래픽 (10,000 동시 사용자 기준)

| 컴포넌트 | 사양 | 개수 | 비고 |
|---------|------|------|------|
| **API Server** | 4 CPU, 8GB RAM | 10 | Auto-scaling |
| **PostgreSQL** | 16 CPU, 32GB RAM | 1 Primary + 2 Replica | |
| **Neo4j** | 8 CPU, 16GB RAM | 3 Core + 2 Replica | Causal Cluster |
| **Redis** | 4 CPU, 8GB RAM | 6 | 3 Master + 3 Replica |
| **Kafka** | 8 CPU, 16GB RAM | 3 | Replication Factor 3 |
| **Elasticsearch** | 16 CPU, 32GB RAM | 3 | Log storage |

### 비용 추정 (AWS 기준, 월간)

```
API Server (c6i.xlarge × 10):     $1,460
PostgreSQL (r6i.2xlarge × 3):     $2,737
Neo4j (c6i.2xlarge × 5):          $3,650
Redis (r6i.xlarge × 6):           $1,642
Kafka (r6i.2xlarge × 3):          $1,825
Elasticsearch (r6i.2xlarge × 3):  $1,825
Load Balancer:                    $50
Data Transfer (5TB):              $450
S3 Storage (10TB):                $235

총계: ~$13,874/월 (~₩18,500,000/월)
```

---

## 🎯 성능 벤치마크 목표

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| **응답 시간 (P95)** | < 100ms | Prometheus |
| **처리량 (TPS)** | > 10,000 | Load testing |
| **가동률** | 99.99% | Uptime monitoring |
| **에러율** | < 0.1% | Error tracking |
| **캐시 히트율** | > 90% | Redis metrics |
| **DB 쿼리 시간** | < 50ms | APM |

---

## 📚 다음 단계

1. **POC 구축** (2-3주)
   - Docker Compose로 로컬 클러스터 구성
   - 기본 CRUD + 이벤트 소싱 구현
   - 성능 테스트

2. **Staging 환경** (4-6주)
   - Kubernetes 클러스터 구축
   - CI/CD 파이프라인 설정
   - 모니터링 스택 구성

3. **프로덕션 전환** (8-12주)
   - 데이터 마이그레이션
   - 로드 테스트
   - 재해 복구 훈련
   - 보안 감사

4. **최적화** (지속적)
   - 성능 튜닝
   - 비용 최적화
   - 기능 추가

---

## 🔗 참고 자료

- [Debezium 문서](https://debezium.io/documentation/)
- [Neo4j Enterprise 문서](https://neo4j.com/docs/operations-manual/current/clustering/)
- [Kafka 운영 가이드](https://kafka.apache.org/documentation/#operations)
- [Kubernetes 베스트 프랙티스](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Event Sourcing 패턴](https://martinfowler.com/eaaDev/EventSourcing.html)
