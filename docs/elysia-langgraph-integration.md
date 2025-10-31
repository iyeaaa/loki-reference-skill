# Elysia LangGraph 통합 개발 계획

## 개요

Admin 사이드바의 "시스템 관리" 섹션에 LangGraph 기반 AI 워크플로우 기능을 추가합니다. 프론트엔드에서 실시간 스트리밍으로 AI의 사고과정을 확인할 수 있는 시스템을 구축합니다.

## 목표

- LangGraph를 사용한 복잡한 AI 워크플로우 구현
- Server-Sent Events (SSE)를 통한 실시간 스트리밍
- 프론트엔드에서 AI 사고과정의 단계별 시각화
- 기존 Elysia 서버와의 원활한 통합

## 기술 스택

### 백엔드
- **LangChain/LangGraph**: AI 워크플로우 구축
- **Elysia**: 기존 프레임워크
- **Server-Sent Events (SSE)**: 실시간 스트리밍
- **OpenAI API**: LLM 제공자

### 프론트엔드
- **React**: UI 프레임워크
- **TanStack Query**: 서버 상태 관리
- **EventSource API**: SSE 클라이언트
- **Shadcn/ui**: UI 컴포넌트

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Admin)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  AI 워크플로우 페이지                                   │  │
│  │  - 입력 폼                                             │  │
│  │  - 스트리밍 UI (사고과정 표시)                          │  │
│  │  - 결과 표시                                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ▼ SSE
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Elysia Server)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LangGraph 라우터                                      │  │
│  │  - POST /api/langgraph/execute                         │  │
│  │  - SSE 스트리밍 엔드포인트                              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LangGraph 서비스                                      │  │
│  │  - 워크플로우 정의                                      │  │
│  │  - State 관리                                          │  │
│  │  - 노드 실행 로직                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        OpenAI API                            │
└─────────────────────────────────────────────────────────────┘
```

## 구현 단계

### Phase 1: 백엔드 기본 구조 (elysia-server/)

#### 1.1 패키지 설치
```bash
cd elysia-server
bun add @langchain/core @langchain/langgraph @langchain/openai
```

#### 1.2 파일 구조
```
elysia-server/
├── src/
│   ├── services/
│   │   └── langgraph/
│   │       ├── index.ts                    # 메인 export
│   │       ├── graph.ts                    # 그래프 정의
│   │       ├── nodes.ts                    # 노드 함수들
│   │       ├── state.ts                    # State 타입 정의
│   │       └── examples/
│   │           └── email-analysis.graph.ts # 예제: 이메일 분석 워크플로우
│   └── routes/
│       └── langgraph.routes.ts             # LangGraph API 라우트
```

#### 1.3 State 정의 (`src/services/langgraph/state.ts`)
```typescript
export interface WorkflowState {
  input: string
  steps: Step[]
  currentStep: string
  result?: string
  error?: string
}

export interface Step {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  startTime?: Date
  endTime?: Date
  output?: string
  thinking?: string
}
```

#### 1.4 그래프 정의 예시 (`src/services/langgraph/examples/email-analysis.graph.ts`)
```typescript
import { StateGraph, END } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"

// 1. 입력 분석 노드
async function analyzeInput(state: WorkflowState) {
  // AI가 입력을 분석
  return { ...state, currentStep: "classify" }
}

// 2. 분류 노드
async function classifyEmail(state: WorkflowState) {
  // 이메일 타입 분류
  return { ...state, currentStep: "generate" }
}

// 3. 응답 생성 노드
async function generateResponse(state: WorkflowState) {
  // 응답 생성
  return { ...state, currentStep: "review" }
}

// 4. 검토 노드
async function reviewResponse(state: WorkflowState) {
  // 응답 검토 및 개선
  return { ...state, currentStep: END }
}

export function createEmailAnalysisGraph() {
  const workflow = new StateGraph({
    channels: { /* state definition */ }
  })

  workflow.addNode("analyze", analyzeInput)
  workflow.addNode("classify", classifyEmail)
  workflow.addNode("generate", generateResponse)
  workflow.addNode("review", reviewResponse)

  workflow.addEdge("analyze", "classify")
  workflow.addEdge("classify", "generate")
  workflow.addEdge("generate", "review")
  workflow.addEdge("review", END)

  workflow.setEntryPoint("analyze")

  return workflow.compile()
}
```

#### 1.5 라우터 구현 (`src/routes/langgraph.routes.ts`)
```typescript
import { Elysia, t } from "elysia"
import { createEmailAnalysisGraph } from "../services/langgraph/examples/email-analysis.graph"

export const langgraphRoutes = new Elysia({ prefix: "/api/langgraph" })
  .post(
    "/execute",
    async ({ body, set }) => {
      const graph = createEmailAnalysisGraph()

      // SSE 헤더 설정
      set.headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }

      // 스트림 생성
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // 각 스텝마다 이벤트 전송
            for await (const chunk of await graph.stream({ input: body.input })) {
              const data = JSON.stringify({
                type: "step",
                step: chunk.currentStep,
                thinking: chunk.thinking,
                output: chunk.output,
              })

              controller.enqueue(`data: ${data}\n\n`)
            }

            controller.enqueue(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            controller.close()
          } catch (error) {
            controller.enqueue(
              `data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`
            )
            controller.close()
          }
        },
      })

      return new Response(stream)
    },
    {
      body: t.Object({
        input: t.String(),
        workflowType: t.Optional(t.String()),
      }),
    }
  )
```

### Phase 2: 프론트엔드 기본 구조 (admin/)

#### 2.1 파일 구조
```
admin/
├── src/
│   ├── components/
│   │   └── langgraph/
│   │       ├── WorkflowInput.tsx          # 입력 폼
│   │       ├── StreamingDisplay.tsx       # 스트리밍 UI
│   │       ├── ThinkingStep.tsx           # 개별 스텝 표시
│   │       └── WorkflowResult.tsx         # 최종 결과
│   ├── pages/
│   │   └── LangGraphPage.tsx              # 메인 페이지
│   └── lib/
│       └── api/
│           └── hooks/
│               └── langgraph.ts            # API 훅
```

#### 2.2 사이드바 메뉴 추가 (`admin/src/components/AppSidebar.tsx`)
```typescript
// adminMenuItems 배열에 추가
{
  title: "AI 워크플로우",
  url: "/langgraph",
  icon: Brain, // lucide-react에서 import
}
```

#### 2.3 스트리밍 훅 (`admin/src/lib/api/hooks/langgraph.ts`)
```typescript
import { useCallback, useEffect, useRef, useState } from "react"

interface StreamEvent {
  type: "step" | "done" | "error"
  step?: string
  thinking?: string
  output?: string
  error?: string
}

export function useLangGraphStream() {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const execute = useCallback(async (input: string) => {
    setEvents([])
    setIsStreaming(true)

    const response = await fetch(`${API_BASE_URL}/api/langgraph/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split("\n")

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6))
          setEvents((prev) => [...prev, data])

          if (data.type === "done" || data.type === "error") {
            setIsStreaming(false)
          }
        }
      }
    }
  }, [])

  return { events, isStreaming, execute }
}
```

#### 2.4 메인 페이지 (`admin/src/pages/LangGraphPage.tsx`)
```typescript
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useLangGraphStream } from "@/lib/api/hooks/langgraph"
import { StreamingDisplay } from "@/components/langgraph/StreamingDisplay"

export default function LangGraphPage() {
  const [input, setInput] = useState("")
  const { events, isStreaming, execute } = useLangGraphStream()

  const handleSubmit = async () => {
    await execute(input)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">AI 워크플로우</h1>
        <p className="text-muted-foreground">
          LangGraph를 사용한 AI 워크플로우 실행 및 사고과정 모니터링
        </p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">입력</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="분석할 내용을 입력하세요..."
            rows={4}
          />
          <Button onClick={handleSubmit} disabled={isStreaming}>
            {isStreaming ? "실행 중..." : "실행"}
          </Button>
        </div>

        {events.length > 0 && (
          <StreamingDisplay events={events} isStreaming={isStreaming} />
        )}
      </div>
    </div>
  )
}
```

#### 2.5 스트리밍 UI (`admin/src/components/langgraph/StreamingDisplay.tsx`)
```typescript
import { Card } from "@/components/ui/card"
import { ThinkingStep } from "./ThinkingStep"

interface StreamingDisplayProps {
  events: StreamEvent[]
  isStreaming: boolean
}

export function StreamingDisplay({ events, isStreaming }: StreamingDisplayProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">실행 과정</h2>

      <div className="space-y-3">
        {events.map((event, index) => (
          <ThinkingStep key={index} event={event} />
        ))}
      </div>

      {isStreaming && (
        <Card className="p-4 animate-pulse">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100" />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200" />
            <span className="ml-2 text-sm text-muted-foreground">처리 중...</span>
          </div>
        </Card>
      )}
    </div>
  )
}
```

#### 2.6 개별 스텝 컴포넌트 (`admin/src/components/langgraph/ThinkingStep.tsx`)
```typescript
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ThinkingStepProps {
  event: StreamEvent
}

export function ThinkingStep({ event }: ThinkingStepProps) {
  if (event.type === "error") {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <div className="flex items-center space-x-2">
          <Badge variant="destructive">오류</Badge>
          <p className="text-sm text-red-600">{event.error}</p>
        </div>
      </Card>
    )
  }

  if (event.type === "done") {
    return (
      <Card className="p-4 border-green-200 bg-green-50">
        <div className="flex items-center space-x-2">
          <Badge className="bg-green-600">완료</Badge>
          <p className="text-sm text-green-600">워크플로우가 완료되었습니다.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge>{event.step}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleTimeString()}
          </span>
        </div>

        {event.thinking && (
          <div className="mt-2 p-3 bg-muted rounded-md">
            <p className="text-sm font-medium mb-1">💭 사고 과정:</p>
            <p className="text-sm text-muted-foreground">{event.thinking}</p>
          </div>
        )}

        {event.output && (
          <div className="mt-2 p-3 bg-blue-50 rounded-md">
            <p className="text-sm font-medium mb-1">📤 출력:</p>
            <p className="text-sm">{event.output}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
```

### Phase 3: 라우팅 설정

#### 3.1 백엔드 라우터 등록 (`elysia-server/src/index.ts`)
```typescript
import { langgraphRoutes } from "./routes/langgraph.routes"

const app = new Elysia()
  // ... 기존 라우트들
  .use(langgraphRoutes)
  .listen(3000)
```

#### 3.2 프론트엔드 라우터 등록 (`admin/src/router.tsx`)
```typescript
import { lazy } from "react"

const LangGraphPage = lazy(() => import("@/pages/LangGraphPage"))

// routes 배열에 추가
{
  path: "/langgraph",
  element: <LangGraphPage />,
}
```

## 예제 워크플로우: 이메일 분석 및 응답 생성

### 워크플로우 단계

1. **입력 분석 (analyze)**
   - 사고과정: "받은 이메일의 내용과 톤을 분석합니다..."
   - 출력: "문의 이메일, 공식적인 톤, 제품 정보 요청"

2. **분류 (classify)**
   - 사고과정: "이메일 유형을 분류하고 적절한 응답 전략을 결정합니다..."
   - 출력: "제품 문의 → 상세 정보 제공 전략"

3. **응답 생성 (generate)**
   - 사고과정: "분류된 정보를 바탕으로 초안을 작성합니다..."
   - 출력: "[이메일 초안 내용]"

4. **검토 (review)**
   - 사고과정: "생성된 응답을 검토하고 개선점을 찾습니다..."
   - 출력: "[최종 수정된 이메일]"

## 배포 및 테스트

### 로컬 개발 환경

1. 백엔드 실행
```bash
cd elysia-server
bun install
bun dev
```

2. 프론트엔드 실행
```bash
cd admin
npm install
npm run dev
```

### 환경 변수 설정

```env
# elysia-server/.env
OPENAI_API_KEY=your_api_key
```

## 확장 가능성

### 추가 워크플로우 예시

1. **콘텐츠 생성 워크플로우**
   - 키워드 분석 → 아웃라인 생성 → 본문 작성 → SEO 최적화

2. **데이터 분석 워크플로우**
   - 데이터 로딩 → 전처리 → 분석 → 시각화 → 리포트 생성

3. **고객 지원 워크플로우**
   - 문의 분류 → 지식베이스 검색 → 답변 생성 → 품질 검증

## 성능 최적화

### 백엔드
- 스트리밍 청크 크기 최적화
- LangGraph 노드 병렬 실행
- 캐싱 전략 적용

### 프론트엔드
- 가상 스크롤링 (긴 워크플로우)
- 이벤트 배칭
- React.memo 최적화

## 보안 고려사항

- API 인증 토큰 검증
- Rate limiting
- 입력 validation
- XSS 방지

## 모니터링

- 워크플로우 실행 시간 추적
- 에러 로깅
- 사용자 행동 분석

## 참고 자료

- [LangGraph 공식 문서](https://langchain-ai.github.io/langgraph/)
- [Elysia 문서](https://elysiajs.com/)
- [Server-Sent Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

## 일정

- **Week 1**: Phase 1 구현 (백엔드 기본 구조)
- **Week 2**: Phase 2 구현 (프론트엔드 기본 구조)
- **Week 3**: Phase 3 구현 (통합 및 테스트)
- **Week 4**: 문서화 및 배포

## 다음 단계

1. 백엔드에 LangGraph 패키지 설치
2. 기본 워크플로우 구현
3. SSE 스트리밍 API 구현
4. 프론트엔드 UI 개발
5. 통합 테스트
6. 프로덕션 배포
