# LangGraph 데이터베이스 분석 챗봇 구현 계획

## 개요

Send Grinda 워크스페이스의 이메일 데이터, 리드 정보, 시퀀스 성과 등을 자연어로 질문하면 실시간으로 분석하여 답변하는 AI 챗봇을 구현합니다.

**주요 기능:**
- 자연어 질문 → SQL 쿼리 자동 생성
- 실시간 데이터베이스 분석
- 시각화 추천 및 인사이트 제공
- 다중 쿼리 자동 실행
- 대화 히스토리 기반 컨텍스트 유지

## 아키텍처

### 전체 구조도

```
User: "이번 주 이메일 오픈율은?"
    ↓
┌─────────────────────────────────────────┐
│         Frontend (Chat UI)              │
│  - 채팅 인터페이스                        │
│  - 실시간 스트리밍 표시                   │
│  - 차트/테이블 렌더링                     │
└─────────────────────────────────────────┘
    ↓ SSE Stream
┌─────────────────────────────────────────┐
│      Backend (LangGraph SQL Agent)       │
│                                          │
│  1. 질문 분석                             │
│  2. SQL 생성                             │
│  3. 안전성 검증                           │
│  4. 쿼리 실행                             │
│  5. 결과 해석                             │
│  6. 인사이트 생성                         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│        PostgreSQL Database               │
│  - emails                                │
│  - leads                                 │
│  - sequences                             │
│  - users, workspaces                     │
└─────────────────────────────────────────┘
```

---

## 데이터베이스 스키마 정리

### 1. 이메일 관련 테이블

#### emails
```sql
- id, workspace_id, user_email_account_id
- direction: 'outbound' | 'inbound'
- from_email, to_email, subject, body_text, body_html
- status: 'draft' | 'scheduled' | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed'
- sent_at, delivered_at, opened_at, clicked_at, replied_at
- open_count, click_count
- lead_id, sequence_id, step_id
```

#### email_replies
```sql
- id, workspace_id, original_email_id, reply_email_id
- sentiment: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested'
- intent, ai_summary
- is_read, assigned_to
```

#### email_events
```sql
- id, email_id
- event_type: 'processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'deferred' | 'spam_report' | 'unsubscribe'
- timestamp, user_agent, ip_address, url
```

### 2. 리드 관련 테이블

#### leads
```sql
- id, workspace_id
- company_name, contact_name, website_url
- business_type, employee_count
- lead_status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'lost' | 'unsubscribed'
- lead_score, notes
- created_at, last_contacted_at
```

### 3. 시퀀스 관련 테이블

#### sequences
```sql
- id, workspace_id, customer_group_id
- name, description, workflow_data
- status: 'draft' | 'active' | 'paused' | 'archived'
- created_by, created_at
```

#### sequence_enrollments
```sql
- id, sequence_id, lead_id, user_email_account_id
- current_step_order
- status: 'active' | 'paused' | 'completed' | 'stopped' | 'bounced' | 'unsubscribed'
- enrolled_at, first_email_sent_at, last_email_sent_at
- next_step_scheduled_at
```

#### sequence_steps
```sql
- id, sequence_id
- step_order, delay_days, scheduled_hour
- email_subject, email_body_text, email_body_html
```

### 4. 유저 및 워크스페이스

#### users
```sql
- id, username, email
- user_role: 'admin' | 'user'
- department_id, employee_id
- is_active, last_login_at
```

#### workspaces
```sql
- id, name, description
- owner_id, is_active
```

---

## LangGraph SQL Agent 구조

### State 정의

```typescript
interface ChatbotState {
  // 대화 흐름
  messages: ChatMessage[]
  currentQuestion: string
  conversationId: string

  // SQL 생성
  generatedSQL: string
  sqlExplanation: string
  isQuerySafe: boolean

  // 실행 결과
  queryResult: any[]
  executionTime: number
  error: string | null

  // 분석
  analysis: string
  insights: string[]
  visualizationSuggestions: VisualizationSuggestion[]

  // 컨텍스트
  workspaceId: string
  userId: string
  schemaContext: string
  previousQueries: QueryHistory[]

  // 추가 질문
  followUpQuestions: string[]
  needsClarification: boolean
  clarificationQuestion: string
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    sql?: string
    result?: any[]
    visualization?: any
  }
}

interface VisualizationSuggestion {
  type: 'bar' | 'line' | 'pie' | 'table' | 'metric'
  title: string
  config: any
}
```

---

### 노드 구조

```typescript
/**
 * 전체 그래프 흐름:
 *
 * START → Analyze Question → Need Clarification?
 *              ↓ (No)                ↓ (Yes)
 *         Generate SQL         Ask Clarification → END
 *              ↓
 *         Validate SQL
 *              ↓
 *         Safe? → (No) → Error Response → END
 *              ↓ (Yes)
 *         Execute Query
 *              ↓
 *         Success? → (No) → Retry/Error → END
 *              ↓ (Yes)
 *         Analyze Results
 *              ↓
 *         Generate Insights → Parallel
 *              ↓                ├→ Suggest Visualizations
 *         Format Response      └→ Generate Follow-ups
 *              ↓
 *            END
 */
```

---

### 1. Analyze Question (질문 분석)

```typescript
async function analyzeQuestion(state: ChatbotState) {
  const prompt = `
당신은 Send Grinda 이메일 자동화 시스템의 데이터 분석가입니다.

사용자 질문: "${state.currentQuestion}"

이전 대화 컨텍스트:
${state.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

데이터베이스 스키마:
- emails: 이메일 발송 기록 (상태, 오픈, 클릭, 답장 등)
- leads: 리드 정보 (회사명, 상태, 점수)
- sequences: 이메일 시퀀스
- sequence_enrollments: 시퀀스 등록 정보
- email_replies: 답장 분석 (감정, 의도)

현재 워크스페이스: ${state.workspaceId}

작업:
1. 질문의 의도를 파악하세요
2. 필요한 테이블과 컬럼을 식별하세요
3. 명확하지 않은 부분이 있나요?
4. 어떤 종류의 분석이 필요한가요? (통계, 트렌드, 비교 등)

JSON 형식으로 응답:
{
  "intent": "질문의 의도",
  "requiredTables": ["table1", "table2"],
  "timeRange": "이번 주" | "오늘" | "지난 30일" | null,
  "needsClarification": true/false,
  "clarificationQuestion": "추가 질문" | null,
  "analysisType": "aggregate" | "trend" | "comparison" | "detail"
}
`

  const response = await llm.invoke(prompt)
  const analysis = JSON.parse(response)

  return {
    needsClarification: analysis.needsClarification,
    clarificationQuestion: analysis.clarificationQuestion,
    metadata: analysis,
  }
}
```

---

### 2. Generate SQL (SQL 생성)

```typescript
async function generateSQL(state: ChatbotState) {
  const schemaPrompt = `
# 데이터베이스 스키마

## emails 테이블
\`\`\`sql
CREATE TABLE emails (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_email_account_id UUID NOT NULL,
  lead_id UUID,
  sequence_id UUID,
  step_id UUID,

  direction VARCHAR CHECK (direction IN ('outbound', 'inbound')),
  from_email VARCHAR(255),
  to_email VARCHAR(255),
  subject VARCHAR(500),
  body_text TEXT,

  status VARCHAR CHECK (status IN ('draft', 'scheduled', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),

  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,

  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

## leads 테이블
\`\`\`sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  company_name VARCHAR(255),
  contact_name VARCHAR(255),
  website_url VARCHAR(500),
  business_type VARCHAR(100),
  employee_count VARCHAR(50),

  lead_status VARCHAR CHECK (lead_status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost', 'unsubscribed')),
  lead_score INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contacted_at TIMESTAMP WITH TIME ZONE
);
\`\`\`

## sequences 테이블
\`\`\`sql
CREATE TABLE sequences (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

## sequence_enrollments 테이블
\`\`\`sql
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY,
  sequence_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  current_step_order INTEGER,
  status VARCHAR CHECK (status IN ('active', 'paused', 'completed', 'stopped', 'bounced', 'unsubscribed')),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_email_sent_at TIMESTAMP WITH TIME ZONE,
  last_email_sent_at TIMESTAMP WITH TIME ZONE
);
\`\`\`

## email_replies 테이블
\`\`\`sql
CREATE TABLE email_replies (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  original_email_id UUID NOT NULL,
  reply_email_id UUID NOT NULL,
  sentiment VARCHAR CHECK (sentiment IN ('positive', 'neutral', 'negative', 'interested', 'not_interested')),
  intent VARCHAR(255),
  ai_summary TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`
`

  const sqlPrompt = `
${schemaPrompt}

# 작업
사용자 질문: "${state.currentQuestion}"
워크스페이스 ID: ${state.workspaceId}

이전 분석:
${JSON.stringify(state.metadata)}

# 요구사항
1. PostgreSQL 문법을 사용하세요
2. 반드시 WHERE workspace_id = '${state.workspaceId}' 조건을 포함하세요
3. 날짜 비교는 TIMESTAMP WITH TIME ZONE 타입을 고려하세요
4. 집계 함수를 적절히 사용하세요
5. 성능을 위해 필요한 컬럼만 SELECT 하세요
6. LIMIT을 적절히 사용하세요 (기본 100)

# 응답 형식
\`\`\`json
{
  "sql": "실행할 SQL 쿼리",
  "explanation": "쿼리가 무엇을 하는지 간단한 설명",
  "estimatedRows": 예상 결과 행 수
}
\`\`\`

SQL을 생성하세요:
`

  const response = await llm.invoke(sqlPrompt)
  const result = JSON.parse(response)

  return {
    generatedSQL: result.sql,
    sqlExplanation: result.explanation,
  }
}
```

---

### 3. Validate SQL (SQL 검증)

```typescript
async function validateSQL(state: ChatbotState) {
  const sql = state.generatedSQL.toLowerCase()

  // 위험한 키워드 체크
  const dangerousKeywords = [
    'drop', 'delete', 'truncate', 'alter', 'create',
    'update', 'insert', 'grant', 'revoke', 'exec'
  ]

  const hasDangerousKeyword = dangerousKeywords.some(keyword =>
    sql.includes(keyword)
  )

  if (hasDangerousKeyword) {
    return {
      isQuerySafe: false,
      error: '읽기 전용 쿼리만 허용됩니다. (SELECT만 가능)',
    }
  }

  // workspace_id 필터 확인
  if (!sql.includes('workspace_id')) {
    return {
      isQuerySafe: false,
      error: '보안을 위해 workspace_id 필터가 필요합니다.',
    }
  }

  // 추가 AI 검증
  const validationPrompt = `
다음 SQL 쿼리가 안전한지 검증하세요:

\`\`\`sql
${state.generatedSQL}
\`\`\`

체크리스트:
1. SELECT 쿼리인가?
2. workspace_id 필터가 있는가?
3. JOIN이 올바른가?
4. 성능 문제가 예상되는가?

JSON으로 응답:
{
  "isSafe": true/false,
  "issues": ["문제점 목록"],
  "suggestions": ["개선 사항"]
}
`

  const validation = await llm.invoke(validationPrompt)
  const result = JSON.parse(validation)

  return {
    isQuerySafe: result.isSafe,
    error: result.issues.length > 0 ? result.issues.join(', ') : null,
  }
}
```

---

### 4. Execute Query (쿼리 실행)

```typescript
async function executeQuery(state: ChatbotState) {
  const startTime = Date.now()

  try {
    // Drizzle ORM을 사용하거나 직접 SQL 실행
    const result = await db.execute(sql`${state.generatedSQL}`)

    const executionTime = Date.now() - startTime

    return {
      queryResult: result.rows,
      executionTime,
      error: null,
    }
  } catch (error) {
    return {
      queryResult: [],
      executionTime: Date.now() - startTime,
      error: error.message,
    }
  }
}
```

---

### 5. Analyze Results (결과 분석)

```typescript
async function analyzeResults(state: ChatbotState) {
  const prompt = `
사용자 질문: "${state.currentQuestion}"

실행한 SQL:
\`\`\`sql
${state.generatedSQL}
\`\`\`

쿼리 결과 (${state.queryResult.length}행):
\`\`\`json
${JSON.stringify(state.queryResult.slice(0, 5), null, 2)}
${state.queryResult.length > 5 ? '... (더 많은 결과)' : ''}
\`\`\`

작업:
1. 결과를 자연어로 요약하세요
2. 주요 수치와 패턴을 설명하세요
3. 비즈니스 인사이트를 제공하세요

자연어로 답변하세요:
`

  const analysis = await llm.invoke(prompt)

  return { analysis }
}
```

---

### 6. Generate Insights (인사이트 생성)

```typescript
async function generateInsights(state: ChatbotState) {
  const prompt = `
데이터 분석 결과를 바탕으로 실행 가능한 인사이트를 제공하세요.

질문: "${state.currentQuestion}"
분석: ${state.analysis}
데이터: ${JSON.stringify(state.queryResult.slice(0, 3))}

다음 형식으로 3-5개의 인사이트를 제공하세요:

[
  {
    "insight": "발견한 패턴이나 이상 징후",
    "recommendation": "구체적인 액션 아이템",
    "impact": "high" | "medium" | "low"
  }
]
`

  const response = await llm.invoke(prompt)
  const insights = JSON.parse(response)

  return { insights }
}
```

---

### 7. Suggest Visualizations (시각화 제안)

```typescript
async function suggestVisualizations(state: ChatbotState) {
  const prompt = `
데이터 결과를 시각화하는 최적의 방법을 제안하세요.

데이터 샘플:
${JSON.stringify(state.queryResult.slice(0, 3))}

컬럼: ${Object.keys(state.queryResult[0] || {})}
행 수: ${state.queryResult.length}

다음 형식으로 응답:
[
  {
    "type": "bar" | "line" | "pie" | "table" | "metric",
    "title": "차트 제목",
    "xAxis": "x축 컬럼명",
    "yAxis": "y축 컬럼명",
    "description": "왜 이 시각화가 적합한가"
  }
]
`

  const response = await llm.invoke(prompt)
  const suggestions = JSON.parse(response)

  return { visualizationSuggestions: suggestions }
}
```

---

### 8. Generate Follow-up Questions (후속 질문 생성)

```typescript
async function generateFollowUpQuestions(state: ChatbotState) {
  const prompt = `
현재 분석 결과를 바탕으로 유용한 후속 질문 3개를 제안하세요.

현재 질문: "${state.currentQuestion}"
분석 결과: ${state.analysis}

후속 질문은 구체적이고 실행 가능해야 합니다.

예시:
- "지난 주와 비교하면 어떤가요?"
- "가장 성과가 좋은 시퀀스는 무엇인가요?"
- "업종별로 분석해주세요"

배열로 응답하세요: ["질문1", "질문2", "질문3"]
`

  const response = await llm.invoke(prompt)
  const followUpQuestions = JSON.parse(response)

  return { followUpQuestions }
}
```

---

## 그래프 조립

```typescript
import { StateGraph, END } from "@langchain/langgraph"

function createChatbotGraph() {
  const workflow = new StateGraph<ChatbotState>({ channels: chatbotStateChannels })

  // 노드 추가
  workflow.addNode("analyze", analyzeQuestion)
  workflow.addNode("generateSQL", generateSQL)
  workflow.addNode("validateSQL", validateSQL)
  workflow.addNode("executeQuery", executeQuery)
  workflow.addNode("analyzeResults", analyzeResults)
  workflow.addNode("generateInsights", generateInsights)
  workflow.addNode("suggestVisualizations", suggestVisualizations)
  workflow.addNode("generateFollowUps", generateFollowUpQuestions)
  workflow.addNode("formatResponse", formatFinalResponse)
  workflow.addNode("handleError", handleError)
  workflow.addNode("askClarification", askClarification)

  // 엣지 정의
  workflow.addConditionalEdges("analyze", (state) => {
    if (state.needsClarification) return "clarification"
    return "generateSQL"
  }, {
    clarification: "askClarification",
    generateSQL: "generateSQL",
  })

  workflow.addEdge("askClarification", END)
  workflow.addEdge("generateSQL", "validateSQL")

  workflow.addConditionalEdges("validateSQL", (state) => {
    return state.isQuerySafe ? "execute" : "error"
  }, {
    execute: "executeQuery",
    error: "handleError",
  })

  workflow.addConditionalEdges("executeQuery", (state) => {
    return state.error ? "error" : "analyze"
  }, {
    error: "handleError",
    analyze: "analyzeResults",
  })

  workflow.addEdge("handleError", END)

  // 병렬 실행: 인사이트, 시각화, 후속질문
  workflow.addEdge("analyzeResults", "generateInsights")
  workflow.addEdge("analyzeResults", "suggestVisualizations")
  workflow.addEdge("analyzeResults", "generateFollowUps")

  workflow.addEdge("generateInsights", "formatResponse")
  workflow.addEdge("suggestVisualizations", "formatResponse")
  workflow.addEdge("generateFollowUps", "formatResponse")

  workflow.addEdge("formatResponse", END)

  workflow.setEntryPoint("analyze")

  return workflow.compile({
    checkpointer: new MemorySaver(),
  })
}
```

---

## 백엔드 구현

### 파일 구조

```
elysia-server/
├── src/
│   ├── services/
│   │   └── chatbot/
│   │       ├── index.ts                  # 메인 export
│   │       ├── graph.ts                  # LangGraph 정의
│   │       ├── nodes/
│   │       │   ├── analyze.ts            # 질문 분석
│   │       │   ├── sql-generator.ts      # SQL 생성
│   │       │   ├── sql-validator.ts      # SQL 검증
│   │       │   ├── query-executor.ts     # 쿼리 실행
│   │       │   ├── result-analyzer.ts    # 결과 분석
│   │       │   └── insight-generator.ts  # 인사이트 생성
│   │       ├── state.ts                  # State 타입 정의
│   │       ├── schema-context.ts         # DB 스키마 정보
│   │       └── prompts.ts                # LLM 프롬프트 모음
│   └── routes/
│       └── chatbot.routes.ts             # API 라우트
```

---

### API 라우트

```typescript
// elysia-server/src/routes/chatbot.routes.ts
import { Elysia, t } from "elysia"
import { createChatbotGraph } from "../services/chatbot/graph"
import { authMiddleware } from "../middleware/auth"

export const chatbotRoutes = new Elysia({ prefix: "/api/chatbot" })
  .use(authMiddleware)
  .post(
    "/ask",
    async ({ body, user, set }) => {
      const graph = createChatbotGraph()

      // SSE 헤더 설정
      set.headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const config = {
              configurable: {
                thread_id: body.conversationId || `chat-${Date.now()}`,
              },
            }

            // 스트리밍 실행
            for await (const event of await graph.stream({
              currentQuestion: body.question,
              workspaceId: body.workspaceId,
              userId: user.id,
              messages: body.messages || [],
            }, config)) {
              const [[nodeName, nodeState]] = Object.entries(event)

              // 각 노드의 진행 상황을 스트리밍
              const streamEvent = {
                type: "node",
                node: nodeName,
                state: nodeState,
                timestamp: Date.now(),
              }

              controller.enqueue(`data: ${JSON.stringify(streamEvent)}\n\n`)
            }

            controller.enqueue(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            controller.close()
          } catch (error) {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: "error",
                error: error.message
              })}\n\n`
            )
            controller.close()
          }
        },
      })

      return new Response(stream)
    },
    {
      body: t.Object({
        question: t.String({ minLength: 1 }),
        workspaceId: t.String(),
        conversationId: t.Optional(t.String()),
        messages: t.Optional(t.Array(t.Object({
          role: t.Union([t.Literal("user"), t.Literal("assistant")]),
          content: t.String(),
        }))),
      }),
    }
  )
  .get(
    "/history/:conversationId",
    async ({ params }) => {
      // 대화 히스토리 조회
      const graph = createChatbotGraph()
      const config = {
        configurable: { thread_id: params.conversationId },
      }

      const state = await graph.getState(config)

      return {
        messages: state.values.messages || [],
        conversationId: params.conversationId,
      }
    }
  )
```

---

## 프론트엔드 구현

### 파일 구조

```
admin/
├── src/
│   ├── pages/
│   │   └── ChatbotPage.tsx               # 메인 챗봇 페이지
│   ├── components/
│   │   └── chatbot/
│   │       ├── ChatInterface.tsx         # 채팅 UI
│   │       ├── MessageBubble.tsx         # 메시지 버블
│   │       ├── QueryVisualization.tsx    # 쿼리 결과 시각화
│   │       ├── InsightCard.tsx           # 인사이트 카드
│   │       ├── ThinkingIndicator.tsx     # 사고 과정 표시
│   │       ├── QuickQuestions.tsx        # 빠른 질문 버튼
│   │       └── DataTable.tsx             # 결과 테이블
│   └── lib/
│       └── api/
│           └── hooks/
│               └── chatbot.ts             # API 훅
```

---

### 메인 챗봇 페이지

```typescript
// admin/src/pages/ChatbotPage.tsx
import { useState } from "react"
import { ChatInterface } from "@/components/chatbot/ChatInterface"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ChatbotPage() {
  const workspaceId = localStorage.getItem("selectedWorkspace") || "all"

  return (
    <div className="container mx-auto py-6 h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AI 데이터 분석 챗봇</h1>
        <p className="text-muted-foreground mt-2">
          자연어로 질문하면 실시간으로 데이터를 분석하고 인사이트를 제공합니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        {/* 메인 채팅 영역 */}
        <div className="lg:col-span-3">
          <ChatInterface workspaceId={workspaceId} />
        </div>

        {/* 사이드바: 빠른 질문 */}
        <div className="lg:col-span-1">
          <Card className="p-4 h-full overflow-y-auto">
            <h3 className="font-semibold mb-4">빠른 질문</h3>

            <Tabs defaultValue="performance">
              <TabsList className="w-full">
                <TabsTrigger value="performance">성과</TabsTrigger>
                <TabsTrigger value="leads">리드</TabsTrigger>
                <TabsTrigger value="sequences">시퀀스</TabsTrigger>
              </TabsList>

              <TabsContent value="performance" className="space-y-2 mt-4">
                <QuickQuestionButton question="오늘 발송한 이메일 수는?" />
                <QuickQuestionButton question="이번 주 오픈율은?" />
                <QuickQuestionButton question="가장 높은 응답률을 보인 시퀀스는?" />
                <QuickQuestionButton question="최근 7일 트렌드를 보여줘" />
              </TabsContent>

              <TabsContent value="leads" className="space-y-2 mt-4">
                <QuickQuestionButton question="신규 리드 현황은?" />
                <QuickQuestionButton question="전환된 리드 수는?" />
                <QuickQuestionButton question="업종별 리드 분포는?" />
                <QuickQuestionButton question="리드 점수가 높은 순으로 보여줘" />
              </TabsContent>

              <TabsContent value="sequences" className="space-y-2 mt-4">
                <QuickQuestionButton question="활성 시퀀스 목록" />
                <QuickQuestionButton question="시퀀스별 완료율" />
                <QuickQuestionButton question="가장 많이 등록된 시퀀스는?" />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  )
}

function QuickQuestionButton({ question }: { question: string }) {
  return (
    <button
      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
      onClick={() => {
        // 질문 전송
      }}
    >
      {question}
    </button>
  )
}
```

---

### 채팅 인터페이스

```typescript
// admin/src/components/chatbot/ChatInterface.tsx
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Loader2 } from "lucide-react"
import { MessageBubble } from "./MessageBubble"
import { ThinkingIndicator } from "./ThinkingIndicator"
import { useChatbot } from "@/lib/api/hooks/chatbot"

interface ChatInterfaceProps {
  workspaceId: string
}

export function ChatInterface({ workspaceId }: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentThinking, setCurrentThinking] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { ask, isStreaming } = useChatbot({
    onMessage: (message) => {
      setMessages(prev => [...prev, message])
      setCurrentThinking(null)
    },
    onThinking: (thinking) => {
      setCurrentThinking(thinking)
    },
  })

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, currentThinking])

  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage = {
      role: "user" as const,
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")

    await ask({
      question: input,
      workspaceId,
      messages,
    })
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border">
      {/* 메시지 영역 */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))}

          {currentThinking && (
            <ThinkingIndicator thinking={currentThinking} />
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* 입력 영역 */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="데이터에 대해 질문하세요... (예: 이번 주 이메일 오픈율은?)"
            className="min-h-[60px] max-h-[200px]"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            {isStreaming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

### 메시지 버블

```typescript
// admin/src/components/chatbot/MessageBubble.tsx
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Bot, Database, TrendingUp } from "lucide-react"
import { QueryVisualization } from "./QueryVisualization"
import { InsightCard } from "./InsightCard"

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex gap-3 max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
        {/* 아바타 */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-primary" : "bg-secondary"
        }`}>
          {isUser ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className="h-4 w-4 text-secondary-foreground" />
          )}
        </div>

        {/* 메시지 내용 */}
        <div className="space-y-2 flex-1">
          <Card className={`p-4 ${
            isUser ? "bg-primary text-primary-foreground" : "bg-card"
          }`}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </Card>

          {/* 메타데이터 (Assistant 메시지만) */}
          {!isUser && message.metadata && (
            <div className="space-y-3">
              {/* SQL 쿼리 */}
              {message.metadata.sql && (
                <Card className="p-3 bg-muted">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4" />
                    <span className="text-xs font-medium">실행한 쿼리</span>
                  </div>
                  <pre className="text-xs overflow-x-auto">
                    <code>{message.metadata.sql}</code>
                  </pre>
                </Card>
              )}

              {/* 시각화 */}
              {message.metadata.visualization && (
                <QueryVisualization data={message.metadata.result} />
              )}

              {/* 인사이트 */}
              {message.metadata.insights && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">인사이트</span>
                  </div>
                  {message.metadata.insights.map((insight, i) => (
                    <InsightCard key={i} insight={insight} />
                  ))}
                </div>
              )}

              {/* 후속 질문 */}
              {message.metadata.followUpQuestions && (
                <div className="flex flex-wrap gap-2">
                  {message.metadata.followUpQuestions.map((q, i) => (
                    <Badge key={i} variant="outline" className="cursor-pointer hover:bg-accent">
                      {q}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

### API 훅

```typescript
// admin/src/lib/api/hooks/chatbot.ts
import { useState, useCallback } from "react"

interface UseChatbotOptions {
  onMessage: (message: ChatMessage) => void
  onThinking: (thinking: string) => void
}

export function useChatbot({ onMessage, onThinking }: UseChatbotOptions) {
  const [isStreaming, setIsStreaming] = useState(false)

  const ask = useCallback(async (params: {
    question: string
    workspaceId: string
    messages: ChatMessage[]
  }) => {
    setIsStreaming(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/chatbot/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(params),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      let accumulatedData: any = {
        analysis: "",
        insights: [],
        sql: "",
        result: [],
      }

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6))

            if (data.type === "node") {
              // 노드별 처리
              switch (data.node) {
                case "analyze":
                  onThinking("질문을 분석하고 있습니다...")
                  break
                case "generateSQL":
                  onThinking("SQL 쿼리를 생성하고 있습니다...")
                  break
                case "executeQuery":
                  onThinking("데이터베이스를 조회하고 있습니다...")
                  accumulatedData.sql = data.state.generatedSQL
                  break
                case "analyzeResults":
                  onThinking("결과를 분석하고 있습니다...")
                  accumulatedData.result = data.state.queryResult
                  accumulatedData.analysis = data.state.analysis
                  break
                case "generateInsights":
                  onThinking("인사이트를 생성하고 있습니다...")
                  accumulatedData.insights = data.state.insights
                  break
              }
            }

            if (data.type === "done") {
              // 최종 메시지 생성
              onMessage({
                role: "assistant",
                content: accumulatedData.analysis,
                timestamp: new Date(),
                metadata: {
                  sql: accumulatedData.sql,
                  result: accumulatedData.result,
                  insights: accumulatedData.insights,
                  followUpQuestions: accumulatedData.followUpQuestions,
                },
              })
            }

            if (data.type === "error") {
              onMessage({
                role: "assistant",
                content: `오류가 발생했습니다: ${data.error}`,
                timestamp: new Date(),
              })
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error)
    } finally {
      setIsStreaming(false)
    }
  }, [onMessage, onThinking])

  return { ask, isStreaming }
}
```

---

## 사용 예시

### 예시 1: 이메일 성과 분석

**사용자 질문:**
```
"이번 주 발송한 이메일의 오픈율은?"
```

**AI 실행 과정 (스트리밍):**
```
1. [분석] 질문을 분석하고 있습니다...
   - 의도: 이메일 성과 측정
   - 기간: 이번 주
   - 필요 데이터: emails 테이블

2. [SQL 생성] 쿼리를 생성하고 있습니다...
   ```sql
   SELECT
     COUNT(*) as total_sent,
     COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened,
     ROUND(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as open_rate
   FROM emails
   WHERE workspace_id = '...'
     AND direction = 'outbound'
     AND sent_at >= date_trunc('week', CURRENT_TIMESTAMP)
     AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')
   ```

3. [실행] 데이터베이스를 조회하고 있습니다...

4. [분석] 결과를 분석하고 있습니다...

5. [완료]
```

**AI 응답:**
```
이번 주에 발송한 이메일은 총 1,234개이며, 그 중 456개가 오픈되어
오픈율은 36.98%입니다.

📊 주요 지표:
- 총 발송: 1,234개
- 총 오픈: 456개
- 오픈율: 36.98%

💡 인사이트:
1. [높은 영향] 오픈율이 업계 평균(21%)보다 15%p 높습니다.
   → 제목 라인 전략이 효과적입니다.

2. [중간 영향] 월요일 발송 이메일의 오픈율이 가장 높습니다(42%).
   → 중요한 캠페인은 월요일에 발송하세요.

3. [낮은 영향] 오후 2-4시 발송 이메일의 성과가 좋습니다.
   → 발송 시간을 최적화하세요.

🔍 추가 질문:
- 지난 주와 비교하면 어떤가요?
- 시퀀스별로 오픈율을 보여주세요
- 오픈율이 가장 높은 요일은?
```

---

### 예시 2: 리드 분석

**사용자 질문:**
```
"전환율이 높은 리드의 특징은?"
```

**AI 실행 과정:**
```sql
SELECT
  business_type,
  employee_count,
  lead_source,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN lead_status = 'converted' THEN 1 END) as converted,
  ROUND(COUNT(CASE WHEN lead_status = 'converted' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as conversion_rate
FROM leads
WHERE workspace_id = '...'
  AND lead_status IN ('converted', 'qualified', 'unqualified', 'lost')
GROUP BY business_type, employee_count, lead_source
HAVING COUNT(*) >= 10
ORDER BY conversion_rate DESC
LIMIT 10
```

**AI 응답:**
```
전환율이 높은 리드의 공통 특징을 분석했습니다:

🎯 높은 전환율 세그먼트 (Top 3):

1. **IT/소프트웨어 + 50-200명 규모 + 웹사이트 문의**
   - 전환율: 45.2%
   - 평균 전환 기간: 14일

2. **제조업 + 200-500명 규모 + 추천**
   - 전환율: 38.7%
   - 평균 전환 기간: 21일

3. **헬스케어 + 50-200명 규모 + 컨퍼런스**
   - 전환율: 35.1%
   - 평균 전환 기간: 18일

💡 인사이트:
1. [높은 영향] 50-200명 규모의 기업이 가장 높은 전환율을 보입니다.
   → 이 규모를 타겟팅하는 캠페인을 강화하세요.

2. [높은 영향] 웹사이트 문의와 추천 리드의 전환율이 2배 이상 높습니다.
   → 웹사이트 문의 폼을 개선하고, 추천 프로그램을 확대하세요.

3. [중간 영향] IT와 제조업이 핵심 업종입니다.
   → 이 업종에 특화된 콘텐츠를 제작하세요.

📊 시각화:
[Bar Chart: 업종별 전환율]
[Pie Chart: 리드 소스 분포]
```

---

## 고급 기능

### 1. 다중 쿼리 자동 실행

복잡한 질문은 여러 쿼리로 분해:

```typescript
async function handleComplexQuery(state: ChatbotState) {
  const prompt = `
질문: "${state.currentQuestion}"

이 질문에 답하기 위해 여러 쿼리가 필요한가요?
필요하다면 단계별로 분해하세요.

예시:
질문: "가장 성과가 좋은 시퀀스의 상세 정보와 사용된 리드 특성은?"
→ 1. 시퀀스별 성과 계산
→ 2. 최고 성과 시퀀스의 상세 정보 조회
→ 3. 해당 시퀀스에 등록된 리드의 특성 분석

JSON으로 응답:
{
  "needsMultipleQueries": true/false,
  "queries": [
    { "purpose": "목적", "description": "설명" }
  ]
}
`

  const response = await llm.invoke(prompt)
  const plan = JSON.parse(response)

  if (plan.needsMultipleQueries) {
    // 각 쿼리를 순차 실행
    const results = []
    for (const query of plan.queries) {
      const sql = await generateSQL({ ...state, currentQuestion: query.description })
      const result = await executeQuery({ ...state, generatedSQL: sql })
      results.push({ query, result })
    }
    return { multiQueryResults: results }
  }

  return {}
}
```

---

### 2. 자연어 필터 추가

대화 중 필터 추가:

```
User: "이번 주 이메일 오픈율은?"
AI: "36.98%입니다."

User: "IT 업종만 보여줘"
AI: [이전 쿼리에 WHERE business_type = 'IT' 추가]
   "IT 업종의 이번 주 오픈율은 42.3%입니다."
```

---

### 3. 시각화 자동 생성

Recharts를 사용한 동적 차트:

```typescript
// admin/src/components/chatbot/QueryVisualization.tsx
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip } from "recharts"

export function QueryVisualization({ data, suggestion }: Props) {
  switch (suggestion.type) {
    case "bar":
      return (
        <BarChart width={600} height={300} data={data}>
          <XAxis dataKey={suggestion.xAxis} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={suggestion.yAxis} fill="#8884d8" />
        </BarChart>
      )

    case "line":
      return (
        <LineChart width={600} height={300} data={data}>
          <XAxis dataKey={suggestion.xAxis} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey={suggestion.yAxis} stroke="#8884d8" />
        </LineChart>
      )

    // ... 다른 차트 타입
  }
}
```

---

## 보안 및 제한사항

### 1. 쿼리 보안

```typescript
const SECURITY_RULES = {
  // READ-ONLY
  allowedKeywords: ['select', 'with', 'where', 'group', 'order', 'limit'],

  // 금지
  dangerousKeywords: [
    'drop', 'delete', 'truncate', 'alter', 'create',
    'update', 'insert', 'grant', 'revoke', 'exec'
  ],

  // 필수
  requiredFilters: ['workspace_id'],

  // 제한
  maxRows: 1000,
  maxExecutionTime: 10000, // 10초
}
```

### 2. Rate Limiting

```typescript
// 사용자당 분당 10개 쿼리 제한
const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user.id,
})
```

### 3. 쿼리 로깅

```typescript
// 모든 쿼리를 로깅하여 감사 추적
await db.insert(chatbotQueryLogs).values({
  userId: user.id,
  workspaceId: state.workspaceId,
  question: state.currentQuestion,
  generatedSQL: state.generatedSQL,
  executionTime: state.executionTime,
  resultCount: state.queryResult.length,
  timestamp: new Date(),
})
```

---

## 성능 최적화

### 1. 쿼리 캐싱

```typescript
import { LRUCache } from "lru-cache"

const queryCache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5분
})

async function executeQueryWithCache(state: ChatbotState) {
  const cacheKey = `${state.workspaceId}:${state.generatedSQL}`

  const cached = queryCache.get(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }

  const result = await executeQuery(state)
  queryCache.set(cacheKey, result)

  return result
}
```

### 2. 스키마 컨텍스트 최적화

```typescript
// 전체 스키마 대신 관련 테이블만 제공
async function getRelevantSchema(question: string) {
  // 질문에서 키워드 추출
  const keywords = extractKeywords(question)

  // 관련 테이블 필터링
  const relevantTables = TABLES.filter(table =>
    keywords.some(keyword => table.name.includes(keyword) ||
                            table.description.includes(keyword))
  )

  return relevantTables.map(t => t.schema).join('\n\n')
}
```

---

## 배포 및 모니터링

### 환경 변수

```env
# .env
OPENAI_API_KEY=your_key
DATABASE_URL=postgresql://...
CHATBOT_MAX_QUERIES_PER_MINUTE=10
CHATBOT_MAX_EXECUTION_TIME=10000
CHATBOT_ENABLE_CACHE=true
```

### 모니터링 메트릭

```typescript
// Prometheus 메트릭
const metrics = {
  totalQuestions: new Counter({ name: 'chatbot_questions_total' }),
  queryDuration: new Histogram({ name: 'chatbot_query_duration_seconds' }),
  llmDuration: new Histogram({ name: 'chatbot_llm_duration_seconds' }),
  errorRate: new Counter({ name: 'chatbot_errors_total' }),
  cacheHitRate: new Counter({ name: 'chatbot_cache_hits_total' }),
}
```

---

## 다음 단계

1. **Phase 1**: 기본 SQL Agent 구현 (1주)
2. **Phase 2**: 프론트엔드 UI 구현 (1주)
3. **Phase 3**: 시각화 및 인사이트 추가 (1주)
4. **Phase 4**: 고급 기능 (다중 쿼리, 필터 등) (1주)
5. **Phase 5**: 테스트 및 최적화 (1주)

총 예상 기간: **5주**

---

## 참고 자료

- [LangGraph SQL Agent Tutorial](https://langchain-ai.github.io/langgraph/tutorials/sql-agent/)
- [Text-to-SQL Best Practices](https://python.langchain.com/docs/use_cases/sql/)
- [Drizzle ORM 문서](https://orm.drizzle.team/)
- [PostgreSQL 보안 가이드](https://www.postgresql.org/docs/current/sql-grant.html)
