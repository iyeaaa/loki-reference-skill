# LangGraph 아키텍처 분석

## 개요

본 문서는 `elysia-server/src/services/chatbot/` 디렉토리에 구현된 LangGraph 기반 챗봇의 아키텍처를 분석합니다.

## 디렉토리 구조

```
elysia-server/src/services/chatbot/
├── graph.ts                      # 그래프 정의 및 워크플로우
├── state.ts                      # 상태 관리
├── index.ts                      # 진입점
├── prompts.ts                    # LLM 프롬프트
├── schema-context.ts             # 데이터베이스 스키마 컨텍스트
└── nodes/
    ├── analyze.ts                # 질문 분석
    ├── sql-generator.ts          # SQL 생성
    ├── sql-validator.ts          # SQL 검증
    ├── query-executor.ts         # 쿼리 실행
    ├── result-analyzer.ts        # 결과 분석
    ├── insight-generator.ts      # 인사이트 생성
    ├── visualization-suggester.ts # 시각화 제안
    └── follow-up-generator.ts    # 후속 질문 생성
```

---

## 상태 관리 (State)

### ChatbotState 인터페이스 (`state.ts:4-46`)

전체 대화 흐름과 각 단계의 결과를 저장하는 중앙 상태 객체입니다.

#### 주요 필드

**대화 흐름**
- `messages`: 전체 대화 히스토리 (사용자/어시스턴트 메시지)
- `currentQuestion`: 현재 처리 중인 질문
- `conversationId`: 대화 세션 ID

**메타데이터**
- `metadata`: 질문 의도, 필요한 테이블, 시간 범위, 분석 유형 등

**SQL 생성**
- `generatedSQL`: 생성된 SQL 쿼리
- `sqlExplanation`: SQL 설명
- `isQuerySafe`: 쿼리 안전성 검증 결과

**실행 결과**
- `queryResult`: 쿼리 실행 결과 데이터
- `executionTime`: 쿼리 실행 시간 (ms)
- `error`: 에러 메시지
- `retryCount`: 재시도 횟수
- `affectedRows`: 영향받은 행 수 (UPDATE/DELETE/INSERT)

**분석**
- `analysis`: 결과에 대한 자연어 분석
- `insights`: 비즈니스 인사이트 목록
- `visualizationSuggestions`: 시각화 제안 목록

**컨텍스트**
- `workspaceId`: 워크스페이스 ID
- `userId`: 사용자 ID
- `schemaContext`: 데이터베이스 스키마 정보
- `previousQueries`: 이전 쿼리 히스토리

**추가 기능**
- `followUpQuestions`: 후속 질문 목록
- `needsClarification`: 명확화 필요 여부
- `clarificationQuestion`: 명확화 질문

---

## 그래프 구조 (Graph)

### 노드 구성 (`graph.ts:19-31`)

총 **11개의 노드**로 구성:

1. **analyze** - 질문 분석
2. **generateSQL** - SQL 생성
3. **validateSQL** - SQL 검증
4. **executeQuery** - 쿼리 실행
5. **analyzeResults** - 결과 분석
6. **generateInsights** - 인사이트 생성 (병렬)
7. **suggestVisualizations** - 시각화 제안 (병렬)
8. **generateFollowUps** - 후속 질문 생성 (병렬)
9. **formatResponse** - 응답 포맷팅
10. **handleError** - 에러 처리
11. **askClarification** - 명확화 질문

### 간선 구성 (Edges)

#### 1. 조건부 간선 (Conditional Edges)

**analyze 노드 이후** (`graph.ts:139-143`)
```
analyze → routeAfterAnalysis() → {
  - error 있음 → handleError
  - needsClarification → askClarification
  - 정상 → generateSQL
}
```

**validateSQL 노드 이후** (`graph.ts:151-154`)
```
validateSQL → routeAfterValidation() → {
  - error 있음 또는 isQuerySafe = false → handleError
  - 정상 → executeQuery
}
```

**executeQuery 노드 이후** (`graph.ts:157-161`)
```
executeQuery → routeAfterExecution() → {
  - error 있음 && retryCount < MAX_RETRIES → generateSQL (재시도)
  - error 있음 && retryCount >= MAX_RETRIES → handleError
  - 정상 → analyzeResults
}
```

#### 2. 순차 간선 (Sequential Edges)

- `askClarification → formatResponse` (`graph.ts:146`)
- `generateSQL → validateSQL` (`graph.ts:148`)
- `handleError → formatResponse` (`graph.ts:164`)

#### 3. 병렬 간선 (Parallel Edges)

`analyzeResults` 이후 3개 노드가 **동시에** 실행됩니다:

```
analyzeResults → generateInsights      ↘
analyzeResults → suggestVisualizations  → formatResponse
analyzeResults → generateFollowUps     ↗
```
(`graph.ts:168-180`)

모든 병렬 작업이 완료되면 `formatResponse`로 수렴합니다.

#### 4. 종료 간선

- `formatResponse → END` (`graph.ts:183`)

---

## 실행 흐름 다이어그램

```
         ┌─────────┐
         │  START  │
         └────┬────┘
              ▼
       ┌──────────────┐
       │   analyze    │ (질문 분석)
       └──────┬───────┘
              │
       ┌──────▼───────┐
       │ 조건부 라우팅 │
       └──────┬───────┘
         ┌────┼────┐
         │    │    │
    error│    │    │정상
         │    │    │
         │    │    └──────► generateSQL ────► validateSQL
         │    │                                    │
         │    │                              ┌─────▼─────┐
         │    │                              │ 조건부     │
         │    │                              └─────┬─────┘
         │    │                                    │
         │    │needsClarification            ┌────┼────┐
         │    │                             error │    │ 정상
         │    ▼                                   │    │
         │  askClarification                     │    ▼
         │    │                                   │  executeQuery
         │    │                                   │    │
         │    │                              ┌────▼────▼─────┐
         │    │                              │   조건부       │
         │    │                              └────┬────┬─────┘
         │    │                                   │    │
         │    │                          retry ◄──┘    │ 정상
         │    │                          (MAX 10회)    │
         │    │                                        ▼
         │    │                                 analyzeResults
         │    │                                        │
         │    │                          ┌─────────────┼─────────────┐
         │    │                          ▼             ▼             ▼
         │    │                    generateInsights  suggestVis  generateFollowUps
         │    │                          │             │             │
         ▼    ▼                          └─────────────┼─────────────┘
    handleError                                       ▼
         │                                      formatResponse
         │                                            │
         └────────────────────────────────────────────┘
                                                      ▼
                                                    END
```

---

## 노드 상세 설명

### 1. analyze (질문 분석)

**파일**: `nodes/analyze.ts`

**모델**: GPT-4o-mini (temperature: 0)

**역할**:
- 사용자 질문의 의도 파악
- 필요한 데이터베이스 테이블 식별
- 시간 범위 추출
- 분석 유형 결정
- 명확화 필요 여부 판단

**입력**:
- `state.currentQuestion`: 사용자 질문
- `state.workspaceId`: 워크스페이스 ID
- `state.messages`: 대화 히스토리

**출력**:
```typescript
{
  metadata: {
    intent: string
    requiredTables: string[]
    timeRange: string | null
    analysisType: string
  },
  needsClarification: boolean,
  clarificationQuestion: string,
  schemaContext: string
}
```

**구현 위치**: `analyze.ts:12-50`

---

### 2. generateSQL (SQL 생성)

**파일**: `nodes/sql-generator.ts`

**모델**: GPT-4o (temperature: 0)

**역할**:
- 질문을 SQL 쿼리로 변환
- 재시도 시 이전 에러를 참고하여 개선된 SQL 생성
- SQL 설명 제공

**입력**:
- `state.currentQuestion`: 질문
- `state.workspaceId`: 워크스페이스 ID
- `state.schemaContext`: 스키마 정보
- `state.metadata`: 분석 메타데이터
- `state.error`: (재시도 시) 이전 에러
- `state.generatedSQL`: (재시도 시) 이전 SQL

**출력**:
```typescript
{
  generatedSQL: string,
  sqlExplanation: string
}
```

**구현 위치**: `sql-generator.ts:11-56`

---

### 3. validateSQL (SQL 검증)

**파일**: `nodes/sql-validator.ts`

**모델**: GPT-4o-mini (temperature: 0) - 현재 비활성화

**역할**:
- 위험한 SQL 키워드 검증 (DROP, DELETE, TRUNCATE 등)
- workspace_id 필터 확인
- SELECT 쿼리인지 확인
- LLM을 통한 추가 검증

**주의**: 현재 테스트를 위해 모든 검증이 **비활성화** 상태입니다. (`validateSQL.ts:51-142`)

**출력**:
```typescript
{
  isQuerySafe: boolean,
  error: string | null
}
```

**구현 위치**: `sql-validator.ts:45-142`

---

### 4. executeQuery (쿼리 실행)

**파일**: `nodes/query-executor.ts`

**역할**:
- Drizzle ORM을 사용하여 SQL 실행
- 타임아웃 처리 (10초)
- 최대 행 수 제한 (1,000행)
- 에러 타입별 사용자 친화적 메시지 제공

**특징**:
- SELECT 쿼리: `queryResult`에 결과 저장
- UPDATE/DELETE/INSERT 쿼리: `affectedRows`에 영향받은 행 수 저장
- 에러 발생 시 `retryCount` 증가 → 최대 10회 재시도

**출력**:
```typescript
{
  queryResult: unknown[],
  executionTime: number,
  affectedRows: number,
  error: string | null,
  retryCount: number
}
```

**에러 처리** (`query-executor.ts:84-113`):
- Division by zero
- Timeout
- Table/Column not exists
- 기타 데이터베이스 에러

**구현 위치**: `query-executor.ts:10-133`

---

### 5. analyzeResults (결과 분석)

**파일**: `nodes/result-analyzer.ts`

**모델**: GPT-4o (temperature: 0.3)

**역할**:
- 쿼리 결과를 자연어로 분석
- 결과가 없는 경우 적절한 메시지 제공
- UPDATE/DELETE/INSERT 쿼리의 경우 영향받은 행 수 안내
- **스트리밍 지원** (`streamAnalysisResults`)

**입력**:
- `state.currentQuestion`: 질문
- `state.generatedSQL`: 실행된 SQL
- `state.queryResult`: 결과 데이터
- `state.executionTime`: 실행 시간

**출력**:
```typescript
{
  analysis: string
}
```

**스트리밍 함수**: `streamAnalysisResults()` - 실시간 텍스트 생성 지원

**구현 위치**: `result-analyzer.ts:11-129`

---

### 6. generateInsights (인사이트 생성)

**파일**: `nodes/insight-generator.ts`

**모델**: GPT-4o (temperature: 0.5)

**역할**:
- 쿼리 결과에서 비즈니스 인사이트 추출
- 각 인사이트에 대한 권장사항 제공
- 영향도(high/medium/low) 분류

**조건**:
- 결과가 0개 또는 1개인 경우 생략

**출력**:
```typescript
{
  insights: Insight[]
}

interface Insight {
  insight: string
  recommendation: string
  impact: "high" | "medium" | "low"
  category?: string
}
```

**구현 위치**: `insight-generator.ts:11-57`

---

### 7. suggestVisualizations (시각화 제안)

**파일**: `nodes/visualization-suggester.ts`

**모델**: GPT-4o-mini (temperature: 0.3)

**역할**:
- 쿼리 결과에 적합한 시각화 유형 제안
- 차트 유형: bar, line, pie, table, metric
- 축(axis) 및 설정 정보 제공

**조건**:
- 결과가 0개인 경우 생략

**출력**:
```typescript
{
  visualizationSuggestions: VisualizationSuggestion[]
}

interface VisualizationSuggestion {
  type: "bar" | "line" | "pie" | "table" | "metric"
  title: string
  xAxis?: string
  yAxis?: string
  description: string
  config?: unknown
}
```

**구현 위치**: `visualization-suggester.ts:11-61`

---

### 8. generateFollowUps (후속 질문 생성)

**파일**: `nodes/follow-up-generator.ts`

**모델**: GPT-4o-mini (temperature: 0.7)

**역할**:
- 현재 질문과 분석 결과를 바탕으로 후속 질문 생성
- 사용자의 탐색적 데이터 분석 지원

**입력**:
- `state.currentQuestion`: 현재 질문
- `state.analysis`: 분석 결과

**출력**:
```typescript
{
  followUpQuestions: string[]
}
```

**구현 위치**: `follow-up-generator.ts:11-46`

---

### 9. formatResponse (응답 포맷팅)

**파일**: `graph.ts`

**역할**:
- 최종 응답 메시지 생성
- 모든 메타데이터(SQL, 결과, 인사이트, 시각화, 후속질문) 포함
- 어시스턴트 메시지를 `messages` 배열에 추가

**출력**:
```typescript
{
  messages: [
    {
      role: "assistant",
      content: state.analysis,
      timestamp: Date,
      metadata: {
        sql: string,
        result: unknown[],
        insights: Insight[],
        visualization: VisualizationSuggestion[],
        followUpQuestions: string[]
      }
    }
  ]
}
```

**구현 위치**: `graph.ts:66-90`

---

### 10. handleError (에러 처리)

**파일**: `graph.ts`

**역할**:
- 에러 메시지를 사용자 친화적으로 변환
- `state.error`를 `analysis`에 복사하여 응답 생성

**출력**:
```typescript
{
  analysis: string // 에러 메시지
}
```

**구현 위치**: `graph.ts:36-50`

---

### 11. askClarification (명확화 질문)

**파일**: `graph.ts`

**역할**:
- 질문이 모호한 경우 사용자에게 명확화 질문 전달
- `state.clarificationQuestion`을 `analysis`에 복사

**출력**:
```typescript
{
  analysis: string // 명확화 질문
}
```

**구현 위치**: `graph.ts:52-64`

---

## 주요 기능

### 1. 재시도 메커니즘

`executeQuery` 노드에서 에러 발생 시 자동으로 SQL 재생성을 시도합니다.

**최대 재시도 횟수**: 10회 (`graph.ts:16`, `query-executor.ts:8`)

**흐름**:
```
executeQuery (에러 발생)
  → retryCount 증가
  → retryCount < 10 ?
      - Yes → generateSQL (이전 에러와 SQL을 참고하여 개선)
      - No → handleError
```

**구현 위치**:
- 라우팅: `graph.ts:105-118`
- 재시도 카운트 증가: `query-executor.ts:130`

---

### 2. 병렬 처리

`analyzeResults` 이후 3개의 노드가 **동시에** 실행되어 성능을 최적화합니다:

1. `generateInsights` - 인사이트 생성
2. `suggestVisualizations` - 시각화 제안
3. `generateFollowUps` - 후속 질문 생성

모든 병렬 작업이 완료되면 `formatResponse`로 수렴합니다.

**구현 위치**: `graph.ts:168-180`

---

### 3. 스트리밍 응답

`result-analyzer.ts`는 **스트리밍 함수**를 제공하여 실시간으로 응답을 생성할 수 있습니다.

```typescript
export async function* streamAnalysisResults(state: ChatbotState): AsyncGenerator<string>
```

**사용처**: 프론트엔드에서 실시간으로 분석 결과를 표시할 때 사용

**구현 위치**: `result-analyzer.ts:81-129`

---

### 4. 대화 히스토리 유지

LangGraph의 `MemorySaver`를 사용하여 대화 상태를 유지합니다.

```typescript
const checkpointer = new MemorySaver()
return workflow.compile({ checkpointer })
```

**구현 위치**: `graph.ts:190-192`

---

## 프론트엔드 연동

### ChatInterface 컴포넌트

**파일**: `admin/src/components/chatbot/ChatInterface.tsx`

**주요 기능**:
- 사용자 입력 처리
- 실시간 스트리밍 메시지 표시
- Thinking 상태 표시
- 대화 히스토리 로딩
- 후속 질문 클릭 이벤트 처리

**상태 관리**:
```typescript
const [messages, setMessages] = useState<ChatMessage[]>([])
const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
const [currentThinking, setCurrentThinking] = useState<string | null>(null)
```

**TanStack Query 사용**:
```typescript
const chatbotMutation = useChatbotMutation({
  onMessage: (message) => { /* 최종 메시지 */ },
  onMessageUpdate: (message) => { /* 스트리밍 업데이트 */ },
  onThinking: (thinking) => { /* Thinking 상태 */ },
  onError: (error) => { /* 에러 처리 */ },
})
```

**구현 위치**: `ChatInterface.tsx:14-203`

---

## LLM 모델 사용 전략

| 노드 | 모델 | Temperature | 이유 |
|------|------|-------------|------|
| analyze | GPT-4o-mini | 0 | 정확한 의도 파악 필요 |
| generateSQL | GPT-4o | 0 | 복잡한 SQL 생성, 높은 정확도 필요 |
| validateSQL | GPT-4o-mini | 0 | 규칙 기반 검증 (현재 비활성화) |
| analyzeResults | GPT-4o | 0.3 | 자연스러운 분석 문장 생성 |
| generateInsights | GPT-4o | 0.5 | 창의적인 인사이트 발굴 |
| suggestVisualizations | GPT-4o-mini | 0.3 | 규칙 기반 시각화 제안 |
| generateFollowUps | GPT-4o-mini | 0.7 | 다양한 후속 질문 생성 |

---

## 보안 및 제약사항

### 1. SQL 검증 (현재 비활성화)

**위험 키워드** (`sql-validator.ts:10-24`):
- DROP, DELETE, TRUNCATE, ALTER, CREATE
- UPDATE, INSERT, GRANT, REVOKE
- EXEC, EXECUTE, pg_sleep, pg_terminate_backend

**검증 조건**:
- Word boundary를 사용한 정확한 키워드 매칭
- workspace_id 필터 필수
- SELECT 쿼리만 허용

**현재 상태**: 테스트를 위해 모든 검증이 비활성화됨

### 2. 쿼리 실행 제약

- **타임아웃**: 10초 (`query-executor.ts:6`)
- **최대 행 수**: 1,000행 (`query-executor.ts:7`)
- **최대 재시도**: 10회 (`query-executor.ts:8`)

---

## 로깅

모든 노드는 `chatbotLogger`를 사용하여 실행 시간과 결과를 로깅합니다.

```typescript
chatbotLogger.nodeStart("nodeName")
// ... 작업 수행
chatbotLogger.nodeSuccess("nodeName", duration)
// 또는
chatbotLogger.nodeError("nodeName", errorMessage, duration)
```

**로그 예시**:
```
[LangGraph] analyzeQuestion started
[LangGraph] analyzeQuestion completed in 523ms
[LangGraph] executeQuery (15 rows) completed in 142ms
```

---

## 개선 사항 제안

### 1. SQL 검증 활성화

현재 비활성화된 SQL 검증 로직을 프로덕션 환경에서 활성화해야 합니다.

### 2. 캐싱

동일한 쿼리에 대해 캐싱을 적용하여 성능을 개선할 수 있습니다.
- `state.fromCache` 필드는 이미 준비되어 있음

### 3. 에러 메시지 개선

사용자에게 더 구체적이고 실행 가능한 에러 메시지를 제공할 수 있습니다.

### 4. 병렬 처리 최적화

3개의 병렬 노드 중 일부가 실패해도 다른 노드의 결과를 사용할 수 있도록 개선할 수 있습니다.

---

## 참고 문서

- [LangGraph 공식 문서](https://langchain-ai.github.io/langgraph/)
- [LangChain OpenAI Integration](https://js.langchain.com/docs/integrations/chat/openai)
- [Drizzle ORM](https://orm.drizzle.team/)

---

**작성일**: 2025-10-27
**마지막 업데이트**: 2025-10-27
