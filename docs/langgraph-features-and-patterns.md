# LangGraph 기능 및 패턴 완전 가이드

## 목차
1. [LangGraph 핵심 개념](#1-langgraph-핵심-개념)
2. [기본 그래프 패턴](#2-기본-그래프-패턴)
3. [Agent 패턴](#3-agent-패턴)
4. [조건부 라우팅](#4-조건부-라우팅)
5. [병렬 실행](#5-병렬-실행)
6. [Human-in-the-Loop](#6-human-in-the-loop)
7. [Memory & State 관리](#7-memory--state-관리)
8. [Tool Calling](#8-tool-calling)
9. [서브그래프](#9-서브그래프)
10. [체크포인트 & 재시작](#10-체크포인트--재시작)
11. [에러 핸들링 & 재시도](#11-에러-핸들링--재시도)
12. [스트리밍](#12-스트리밍)
13. [실제 비즈니스 유스케이스](#13-실제-비즈니스-유스케이스)

---

## 1. LangGraph 핵심 개념

### 1.1 State (상태)
그래프 내에서 노드 간 전달되는 데이터 구조

```typescript
interface BaseState {
  messages: Message[]
  // 필요한 다른 필드들
}
```

### 1.2 Node (노드)
State를 입력받아 처리하고 업데이트된 State를 반환하는 함수

```typescript
async function nodeFunction(state: State): Promise<Partial<State>> {
  // 처리 로직
  return { /* 업데이트할 state */ }
}
```

### 1.3 Edge (엣지)
노드 간의 연결을 정의

- **Normal Edge**: 항상 다음 노드로 이동
- **Conditional Edge**: 조건에 따라 다른 노드로 분기

### 1.4 Graph (그래프)
노드와 엣지로 구성된 워크플로우

---

## 2. 기본 그래프 패턴

### 2.1 순차 실행 (Sequential)

**구조도:**
```
START → Node1 → Node2 → Node3 → END
```

**설명:**
가장 기본적인 패턴으로 노드들이 순차적으로 실행됩니다.

**예시: 이메일 처리 파이프라인**
```typescript
interface EmailProcessingState {
  email: string
  sentiment: string
  category: string
  response: string
}

// 1. 감정 분석
async function analyzeSentiment(state: EmailProcessingState) {
  const sentiment = await llm.invoke(`이메일의 감정을 분석: ${state.email}`)
  return { sentiment }
}

// 2. 카테고리 분류
async function categorizeEmail(state: EmailProcessingState) {
  const category = await llm.invoke(`이메일 카테고리: ${state.email}`)
  return { category }
}

// 3. 응답 생성
async function generateResponse(state: EmailProcessingState) {
  const response = await llm.invoke(
    `감정: ${state.sentiment}, 카테고리: ${state.category}에 맞는 응답 생성`
  )
  return { response }
}

// 그래프 구성
const workflow = new StateGraph({ channels: emailStateChannels })
  .addNode("analyze", analyzeSentiment)
  .addNode("categorize", categorizeEmail)
  .addNode("generate", generateResponse)
  .addEdge("analyze", "categorize")
  .addEdge("categorize", "generate")
  .addEdge("generate", END)
  .setEntryPoint("analyze")

const app = workflow.compile()
```

**활용 사례:**
- 문서 처리 파이프라인
- 데이터 변환 워크플로우
- 단계별 검증 프로세스

---

### 2.2 분기 (Branching)

**구조도:**
```
        ┌→ NodeA → END
START → Router
        └→ NodeB → END
```

**설명:**
조건에 따라 다른 경로로 분기합니다.

**예시: 고객 문의 라우팅**
```typescript
interface InquiryState {
  inquiry: string
  type: "technical" | "billing" | "general"
  response: string
}

// 라우터: 문의 유형 판단
function routeInquiry(state: InquiryState): string {
  if (state.type === "technical") return "technical_handler"
  if (state.type === "billing") return "billing_handler"
  return "general_handler"
}

// 기술 지원 처리
async function handleTechnical(state: InquiryState) {
  const response = await technicalLLM.invoke(state.inquiry)
  return { response }
}

// 청구 관련 처리
async function handleBilling(state: InquiryState) {
  const response = await billingLLM.invoke(state.inquiry)
  return { response }
}

// 일반 문의 처리
async function handleGeneral(state: InquiryState) {
  const response = await generalLLM.invoke(state.inquiry)
  return { response }
}

// 그래프 구성
const workflow = new StateGraph({ channels: inquiryStateChannels })
  .addNode("classify", classifyInquiry)
  .addNode("technical_handler", handleTechnical)
  .addNode("billing_handler", handleBilling)
  .addNode("general_handler", handleGeneral)
  .addConditionalEdges("classify", routeInquiry)
  .addEdge("technical_handler", END)
  .addEdge("billing_handler", END)
  .addEdge("general_handler", END)
  .setEntryPoint("classify")

const app = workflow.compile()
```

**활용 사례:**
- 고객 지원 자동화
- 콘텐츠 분류 시스템
- 동적 워크플로우 라우팅

---

### 2.3 루프 (Loop)

**구조도:**
```
START → Node1 → Decision
             ↑      ↓ (continue)
             └──────┘
                    ↓ (done)
                   END
```

**설명:**
조건이 만족될 때까지 반복 실행합니다.

**예시: 반복 개선 에이전트**
```typescript
interface RefinementState {
  content: string
  feedback: string[]
  iteration: number
  maxIterations: number
  isApproved: boolean
}

// 콘텐츠 개선
async function refineContent(state: RefinementState) {
  const improved = await llm.invoke(
    `다음 피드백을 반영하여 개선: ${state.content}\n피드백: ${state.feedback.join(", ")}`
  )
  return { content: improved, iteration: state.iteration + 1 }
}

// 품질 검토
async function reviewQuality(state: RefinementState) {
  const review = await llm.invoke(`이 콘텐츠의 품질을 평가: ${state.content}`)
  const isApproved = review.includes("승인")
  const feedback = isApproved ? [] : [review]
  return { isApproved, feedback }
}

// 계속할지 결정
function shouldContinue(state: RefinementState): string {
  if (state.isApproved) return "end"
  if (state.iteration >= state.maxIterations) return "end"
  return "refine"
}

// 그래프 구성
const workflow = new StateGraph({ channels: refinementStateChannels })
  .addNode("refine", refineContent)
  .addNode("review", reviewQuality)
  .addConditionalEdges("review", shouldContinue, {
    refine: "refine",
    end: END,
  })
  .addEdge("refine", "review")
  .setEntryPoint("refine")

const app = workflow.compile()
```

**활용 사례:**
- 콘텐츠 반복 개선
- 자동 디버깅 시스템
- 최적화 알고리즘

---

## 3. Agent 패턴

### 3.1 ReAct Agent (Reasoning + Acting)

**구조도:**
```
START → Think → Act → Observe → Decision
         ↑              ↓           ↓
         └──────────────┘      (done)
                                    ↓
                                  END
```

**설명:**
생각(Reasoning) → 행동(Acting) → 관찰(Observe)을 반복하는 에이전트

**예시: 데이터 분석 에이전트**
```typescript
interface AgentState {
  input: string
  thought: string
  action: { tool: string; input: string } | null
  observation: string
  steps: Step[]
  finalAnswer: string
}

interface Step {
  thought: string
  action: string
  observation: string
}

// 사고 단계
async function think(state: AgentState) {
  const thought = await llm.invoke(
    `목표: ${state.input}\n지금까지의 진행: ${JSON.stringify(state.steps)}\n다음에 무엇을 해야 할까요?`
  )

  // 도구 사용 결정
  const action = parseAction(thought) // { tool: "calculator", input: "2+2" }

  return { thought, action }
}

// 행동 단계 (도구 실행)
async function act(state: AgentState) {
  if (!state.action) return {}

  const tool = tools[state.action.tool]
  const observation = await tool.invoke(state.action.input)

  const steps = [
    ...state.steps,
    {
      thought: state.thought,
      action: `${state.action.tool}(${state.action.input})`,
      observation,
    },
  ]

  return { observation, steps }
}

// 완료 여부 판단
function shouldContinue(state: AgentState): string {
  if (state.thought.includes("최종 답변:")) return "finish"
  if (state.steps.length >= 10) return "finish" // 최대 반복 제한
  return "think"
}

// 최종 답변 생성
async function finish(state: AgentState) {
  const finalAnswer = await llm.invoke(
    `지금까지의 분석을 바탕으로 최종 답변: ${JSON.stringify(state.steps)}`
  )
  return { finalAnswer }
}

// 그래프 구성
const workflow = new StateGraph({ channels: agentStateChannels })
  .addNode("think", think)
  .addNode("act", act)
  .addNode("finish", finish)
  .addEdge("think", "act")
  .addConditionalEdges("act", shouldContinue, {
    think: "think",
    finish: "finish",
  })
  .addEdge("finish", END)
  .setEntryPoint("think")

const app = workflow.compile()
```

**활용 사례:**
- 복잡한 문제 해결
- 자동 리서치 에이전트
- 코드 생성 및 디버깅

---

### 3.2 Plan-and-Execute Agent

**구조도:**
```
START → Plan → Execute Step 1 → Execute Step 2 → ... → Replan?
                                                            ↓
                                                          END
```

**설명:**
먼저 전체 계획을 세우고, 각 단계를 순차적으로 실행합니다.

**예시: 마케팅 캠페인 기획**
```typescript
interface PlanExecuteState {
  objective: string
  plan: string[]
  pastSteps: [string, string][] // [step, result]
  currentStep: string
  currentResult: string
  finalResult: string
}

// 계획 수립
async function createPlan(state: PlanExecuteState) {
  const planText = await llm.invoke(
    `목표를 달성하기 위한 단계별 계획을 세우세요: ${state.objective}`
  )
  const plan = planText.split("\n").filter(s => s.trim())
  return { plan }
}

// 단계 실행
async function executeStep(state: PlanExecuteState) {
  const currentStep = state.plan[state.pastSteps.length]
  const currentResult = await llm.invoke(
    `다음 단계를 실행하세요: ${currentStep}\n이전 결과: ${JSON.stringify(state.pastSteps)}`
  )

  const pastSteps = [...state.pastSteps, [currentStep, currentResult]]

  return { currentStep, currentResult, pastSteps }
}

// 재계획 필요 여부 판단
async function shouldReplan(state: PlanExecuteState): Promise<string> {
  if (state.pastSteps.length >= state.plan.length) return "finish"

  const needsReplan = await llm.invoke(
    `현재 진행 상황에서 계획을 수정해야 하나요? ${JSON.stringify(state.pastSteps)}`
  )

  return needsReplan.includes("예") ? "replan" : "execute"
}

// 그래프 구성
const workflow = new StateGraph({ channels: planExecuteStateChannels })
  .addNode("plan", createPlan)
  .addNode("execute", executeStep)
  .addNode("replan", createPlan)
  .addNode("finish", generateFinalResult)
  .addEdge("plan", "execute")
  .addConditionalEdges("execute", shouldReplan, {
    execute: "execute",
    replan: "replan",
    finish: "finish",
  })
  .addEdge("replan", "execute")
  .addEdge("finish", END)
  .setEntryPoint("plan")

const app = workflow.compile()
```

**활용 사례:**
- 프로젝트 관리
- 복잡한 작업 자동화
- 연구 및 분석 워크플로우

---

## 4. 조건부 라우팅

### 4.1 Dynamic Routing

**구조도:**
```
              ┌→ Path A → END
              ├→ Path B → END
START → Router├→ Path C → END
              └→ Path D → END
```

**설명:**
런타임에 State를 기반으로 동적으로 경로를 결정합니다.

**예시: 감정 기반 응답 시스템**
```typescript
interface SentimentState {
  message: string
  sentiment: "positive" | "negative" | "neutral" | "urgent"
  response: string
}

// 감정 분석
async function analyzeSentiment(state: SentimentState) {
  const analysis = await llm.invoke(`감정 분석: ${state.message}`)
  const sentiment = extractSentiment(analysis)
  return { sentiment }
}

// 라우팅 로직
function routeBySentiment(state: SentimentState): string {
  return state.sentiment // "positive", "negative", "neutral", "urgent"
}

// 각 감정별 핸들러
async function handlePositive(state: SentimentState) {
  const response = await llm.invoke(`긍정적인 톤으로 응답: ${state.message}`)
  return { response }
}

async function handleNegative(state: SentimentState) {
  const response = await llm.invoke(`공감하며 문제 해결 중심으로 응답: ${state.message}`)
  return { response }
}

async function handleNeutral(state: SentimentState) {
  const response = await llm.invoke(`중립적이고 정보 제공 중심으로 응답: ${state.message}`)
  return { response }
}

async function handleUrgent(state: SentimentState) {
  // 긴급 알림 전송
  await sendUrgentNotification(state.message)
  const response = await llm.invoke(`즉시 대응이 필요한 응답: ${state.message}`)
  return { response }
}

// 그래프 구성
const workflow = new StateGraph({ channels: sentimentStateChannels })
  .addNode("analyze", analyzeSentiment)
  .addNode("positive", handlePositive)
  .addNode("negative", handleNegative)
  .addNode("neutral", handleNeutral)
  .addNode("urgent", handleUrgent)
  .addConditionalEdges("analyze", routeBySentiment, {
    positive: "positive",
    negative: "negative",
    neutral: "neutral",
    urgent: "urgent",
  })
  .addEdge("positive", END)
  .addEdge("negative", END)
  .addEdge("neutral", END)
  .addEdge("urgent", END)
  .setEntryPoint("analyze")

const app = workflow.compile()
```

**활용 사례:**
- 고객 지원 자동화
- 콘텐츠 필터링
- 우선순위 기반 작업 분배

---

## 5. 병렬 실행

### 5.1 Map-Reduce Pattern

**구조도:**
```
            ┌→ Process A ─┐
START → Map ├→ Process B ─┤→ Reduce → END
            └→ Process C ─┘
```

**설명:**
여러 작업을 병렬로 실행하고 결과를 통합합니다.

**예시: 다중 소스 정보 수집**
```typescript
interface MapReduceState {
  query: string
  sources: string[]
  results: { source: string; content: string }[]
  summary: string
}

// 각 소스에서 정보 수집 (병렬 실행)
async function fetchFromSource(source: string, query: string) {
  const content = await llm.invoke(`${source}에서 ${query}에 대한 정보 검색`)
  return { source, content }
}

// Map 단계
async function mapPhase(state: MapReduceState) {
  const promises = state.sources.map(source =>
    fetchFromSource(source, state.query)
  )
  const results = await Promise.all(promises)
  return { results }
}

// Reduce 단계
async function reducePhase(state: MapReduceState) {
  const allContent = state.results.map(r => `[${r.source}]: ${r.content}`).join("\n\n")
  const summary = await llm.invoke(
    `다음 정보들을 종합하여 요약하세요:\n${allContent}`
  )
  return { summary }
}

// 그래프 구성
const workflow = new StateGraph({ channels: mapReduceStateChannels })
  .addNode("map", mapPhase)
  .addNode("reduce", reducePhase)
  .addEdge("map", "reduce")
  .addEdge("reduce", END)
  .setEntryPoint("map")

const app = workflow.compile()
```

**활용 사례:**
- 다중 소스 데이터 집계
- 대규모 문서 처리
- 분산 분석 작업

---

### 5.2 Fan-out/Fan-in Pattern

**구조도:**
```
            ┌→ Analyzer A ─┐
START → Split├→ Analyzer B ─┤→ Merge → END
            └→ Analyzer C ─┘
```

**예시: 다각도 콘텐츠 분석**
```typescript
interface AnalysisState {
  content: string
  seoAnalysis: string
  readabilityAnalysis: string
  sentimentAnalysis: string
  finalReport: string
}

// SEO 분석
async function analyzeSEO(state: AnalysisState) {
  const seoAnalysis = await llm.invoke(`SEO 관점에서 분석: ${state.content}`)
  return { seoAnalysis }
}

// 가독성 분석
async function analyzeReadability(state: AnalysisState) {
  const readabilityAnalysis = await llm.invoke(`가독성 분석: ${state.content}`)
  return { readabilityAnalysis }
}

// 감정 분석
async function analyzeSentiment(state: AnalysisState) {
  const sentimentAnalysis = await llm.invoke(`감정 분석: ${state.content}`)
  return { sentimentAnalysis }
}

// 결과 병합
async function mergeAnalyses(state: AnalysisState) {
  const finalReport = await llm.invoke(
    `다음 분석 결과들을 종합한 리포트 작성:
    SEO: ${state.seoAnalysis}
    가독성: ${state.readabilityAnalysis}
    감정: ${state.sentimentAnalysis}`
  )
  return { finalReport }
}

// 그래프 구성 (병렬 실행을 위해 조건부 엣지 사용)
const workflow = new StateGraph({ channels: analysisStateChannels })
  .addNode("seo", analyzeSEO)
  .addNode("readability", analyzeReadability)
  .addNode("sentiment", analyzeSentiment)
  .addNode("merge", mergeAnalyses)
  // 모든 분석이 완료되면 merge로 이동
  .addEdge("seo", "merge")
  .addEdge("readability", "merge")
  .addEdge("sentiment", "merge")
  .addEdge("merge", END)
  .setEntryPoint("seo")
  .setEntryPoint("readability")
  .setEntryPoint("sentiment")

const app = workflow.compile()
```

**활용 사례:**
- 다각도 분석
- 품질 검증 시스템
- 멀티 모델 추론

---

## 6. Human-in-the-Loop

### 6.1 Approval Workflow

**구조도:**
```
START → Generate → Wait for Approval → Approved?
                         ↑                ↓ (No)
                         └────────────────┘
                                          ↓ (Yes)
                                         END
```

**설명:**
중요한 단계에서 사람의 승인을 받습니다.

**예시: 이메일 발송 승인 시스템**
```typescript
interface ApprovalState {
  recipient: string
  emailDraft: string
  approved: boolean | null
  feedback: string
  iteration: number
}

// 이메일 초안 생성
async function generateEmail(state: ApprovalState) {
  const emailDraft = await llm.invoke(
    `${state.recipient}에게 보낼 이메일 작성${state.feedback ? `\n피드백: ${state.feedback}` : ""}`
  )
  return { emailDraft, iteration: state.iteration + 1 }
}

// 사람의 승인 대기 (중단점)
async function waitForApproval(state: ApprovalState) {
  // 이 지점에서 그래프 실행이 중단되고 사용자 입력 대기
  return state
}

// 승인 여부 확인
function checkApproval(state: ApprovalState): string {
  if (state.approved === true) return "send"
  if (state.approved === false) return "regenerate"
  return "wait" // 아직 결정되지 않음
}

// 이메일 발송
async function sendEmail(state: ApprovalState) {
  await emailService.send(state.recipient, state.emailDraft)
  return { sent: true }
}

// 그래프 구성
const workflow = new StateGraph({ channels: approvalStateChannels })
  .addNode("generate", generateEmail)
  .addNode("wait", waitForApproval)
  .addNode("send", sendEmail)
  .addEdge("generate", "wait")
  .addConditionalEdges("wait", checkApproval, {
    send: "send",
    regenerate: "generate",
    wait: "wait",
  })
  .addEdge("send", END)
  .setEntryPoint("generate")

const app = workflow.compile({
  checkpointer: new MemorySaver(), // 체크포인트 저장
  interruptBefore: ["wait"], // wait 노드 전에 중단
})

// 사용 예시
const config = { configurable: { thread_id: "approval-123" } }
const result = await app.invoke({ recipient: "user@example.com" }, config)

// 승인 처리
await app.invoke(
  { ...result, approved: true },
  config
)
```

**활용 사례:**
- 콘텐츠 발행 승인
- 결제 승인
- 중요 의사결정

---

### 6.2 Interactive Refinement

**구조도:**
```
START → Generate → Present → User Feedback? → Refine
                      ↑                           ↓
                      └───────────────────────────┘
                                                  ↓ (Satisfied)
                                                 END
```

**예시: 대화형 문서 작성**
```typescript
interface InteractiveState {
  topic: string
  document: string
  userFeedback: string[]
  version: number
  satisfied: boolean
}

// 문서 생성/개선
async function generateDocument(state: InteractiveState) {
  const prompt = state.version === 0
    ? `${state.topic}에 대한 문서 작성`
    : `다음 피드백을 반영하여 문서 개선:\n${state.document}\n\n피드백:\n${state.userFeedback.join("\n")}`

  const document = await llm.invoke(prompt)
  return { document, version: state.version + 1 }
}

// 사용자 피드백 수집
async function collectFeedback(state: InteractiveState) {
  // 프론트엔드에서 피드백 입력 대기
  return state
}

// 계속 여부 확인
function shouldContinue(state: InteractiveState): string {
  return state.satisfied ? "finish" : "generate"
}

// 그래프 구성
const workflow = new StateGraph({ channels: interactiveStateChannels })
  .addNode("generate", generateDocument)
  .addNode("feedback", collectFeedback)
  .addNode("finish", finalizeDocument)
  .addEdge("generate", "feedback")
  .addConditionalEdges("feedback", shouldContinue, {
    generate: "generate",
    finish: "finish",
  })
  .addEdge("finish", END)
  .setEntryPoint("generate")

const app = workflow.compile({
  checkpointer: new MemorySaver(),
  interruptBefore: ["feedback"],
})
```

**활용 사례:**
- 대화형 콘텐츠 생성
- 맞춤형 레포트 작성
- 협업 문서 편집

---

## 7. Memory & State 관리

### 7.1 Short-term Memory (대화 히스토리)

**구조도:**
```
User Input → Add to Memory → Process → Response
                ↑                         ↓
                └─────────────────────────┘
```

**예시: 대화형 챗봇**
```typescript
interface ConversationState {
  messages: { role: "user" | "assistant"; content: string }[]
  context: Record<string, any>
}

async function processMessage(state: ConversationState) {
  const lastMessage = state.messages[state.messages.length - 1]

  // 전체 대화 히스토리를 컨텍스트로 전달
  const response = await llm.invoke(
    state.messages.map(m => `${m.role}: ${m.content}`).join("\n")
  )

  const newMessages = [
    ...state.messages,
    { role: "assistant", content: response },
  ]

  return { messages: newMessages }
}

const workflow = new StateGraph({ channels: conversationStateChannels })
  .addNode("process", processMessage)
  .addEdge("process", END)
  .setEntryPoint("process")

const app = workflow.compile({
  checkpointer: new MemorySaver(), // 메모리 저장
})

// 세션별로 대화 유지
const config = { configurable: { thread_id: "user-123" } }
await app.invoke({ messages: [{ role: "user", content: "안녕하세요" }] }, config)
await app.invoke({ messages: [{ role: "user", content: "이전 대화 기억하나요?" }] }, config)
```

---

### 7.2 Long-term Memory (벡터 DB)

**예시: 지식 베이스 검색**
```typescript
interface KnowledgeState {
  query: string
  relevantDocs: Document[]
  answer: string
}

async function retrieveKnowledge(state: KnowledgeState) {
  // 벡터 DB에서 관련 문서 검색
  const relevantDocs = await vectorStore.similaritySearch(state.query, 5)
  return { relevantDocs }
}

async function generateAnswer(state: KnowledgeState) {
  const context = state.relevantDocs.map(d => d.content).join("\n\n")
  const answer = await llm.invoke(
    `다음 정보를 바탕으로 답변:\n${context}\n\n질문: ${state.query}`
  )
  return { answer }
}

const workflow = new StateGraph({ channels: knowledgeStateChannels })
  .addNode("retrieve", retrieveKnowledge)
  .addNode("generate", generateAnswer)
  .addEdge("retrieve", "generate")
  .addEdge("generate", END)
  .setEntryPoint("retrieve")

const app = workflow.compile()
```

---

### 7.3 Persistent State (체크포인트)

**예시: 장기 실행 워크플로우**
```typescript
import { SqliteSaver } from "@langchain/langgraph/checkpoints/sqlite"

// SQLite를 사용한 영구 체크포인트
const checkpointer = new SqliteSaver("checkpoints.db")

const app = workflow.compile({
  checkpointer,
  interruptBefore: ["approval", "payment"],
})

// 워크플로우 시작
const config = { configurable: { thread_id: "order-12345" } }
await app.invoke({ orderId: "12345" }, config)

// 나중에 같은 thread_id로 재개
const state = await app.getState(config)
await app.invoke({ ...state.values, approved: true }, config)
```

**활용 사례:**
- 주문 처리 워크플로우
- 장기 프로젝트 관리
- 단계별 승인 프로세스

---

## 8. Tool Calling

### 8.1 Single Tool Usage

**예시: 계산기 도구**
```typescript
interface ToolState {
  input: string
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  finalAnswer: string
}

// 도구 정의
const calculatorTool = {
  name: "calculator",
  description: "수학 계산 수행",
  parameters: {
    expression: { type: "string", description: "계산식" },
  },
  execute: async (expression: string) => {
    return eval(expression) // 실제로는 안전한 방식 사용
  },
}

// 도구 호출 결정
async function decideTool(state: ToolState) {
  const response = await llm.invoke(
    `다음 요청에 필요한 도구를 선택하고 파라미터를 지정하세요: ${state.input}`
  )
  const toolCall = parseToolCall(response)
  return { toolCalls: [toolCall] }
}

// 도구 실행
async function executeTool(state: ToolState) {
  const toolCall = state.toolCalls[state.toolCalls.length - 1]
  const result = await calculatorTool.execute(toolCall.parameters.expression)
  return { toolResults: [...state.toolResults, { toolCall, result }] }
}

// 최종 답변
async function generateAnswer(state: ToolState) {
  const finalAnswer = await llm.invoke(
    `도구 실행 결과를 바탕으로 답변: ${JSON.stringify(state.toolResults)}`
  )
  return { finalAnswer }
}

const workflow = new StateGraph({ channels: toolStateChannels })
  .addNode("decide", decideTool)
  .addNode("execute", executeTool)
  .addNode("answer", generateAnswer)
  .addEdge("decide", "execute")
  .addEdge("execute", "answer")
  .addEdge("answer", END)
  .setEntryPoint("decide")

const app = workflow.compile()
```

---

### 8.2 Multi-Tool Agent

**예시: 다중 도구 에이전트**
```typescript
// 여러 도구 정의
const tools = {
  search: {
    name: "search",
    description: "웹 검색",
    execute: async (query: string) => await webSearch(query),
  },
  calculator: {
    name: "calculator",
    description: "수학 계산",
    execute: async (expr: string) => eval(expr),
  },
  database: {
    name: "database",
    description: "데이터베이스 쿼리",
    execute: async (sql: string) => await db.query(sql),
  },
  emailSender: {
    name: "emailSender",
    description: "이메일 발송",
    execute: async (to: string, content: string) =>
      await emailService.send(to, content),
  },
}

interface MultiToolState {
  input: string
  steps: { tool: string; input: any; output: any }[]
  nextAction: { tool: string; input: any } | null
  complete: boolean
  finalAnswer: string
}

// 다음 행동 결정
async function planNextAction(state: MultiToolState) {
  const toolDescriptions = Object.entries(tools)
    .map(([name, tool]) => `${name}: ${tool.description}`)
    .join("\n")

  const response = await llm.invoke(
    `목표: ${state.input}
    사용 가능한 도구:
    ${toolDescriptions}

    이전 단계: ${JSON.stringify(state.steps)}

    다음 단계를 결정하세요. 완료되었으면 "완료"라고 답하세요.`
  )

  if (response.includes("완료")) {
    return { complete: true, nextAction: null }
  }

  const nextAction = parseToolCall(response)
  return { nextAction, complete: false }
}

// 도구 실행
async function executeAction(state: MultiToolState) {
  if (!state.nextAction) return {}

  const tool = tools[state.nextAction.tool]
  const output = await tool.execute(state.nextAction.input)

  const steps = [
    ...state.steps,
    {
      tool: state.nextAction.tool,
      input: state.nextAction.input,
      output,
    },
  ]

  return { steps }
}

// 라우팅
function routeNext(state: MultiToolState): string {
  return state.complete ? "finish" : "plan"
}

// 최종 답변
async function finalize(state: MultiToolState) {
  const finalAnswer = await llm.invoke(
    `다음 단계들의 결과를 종합하여 최종 답변을 작성하세요:\n${JSON.stringify(state.steps)}`
  )
  return { finalAnswer }
}

const workflow = new StateGraph({ channels: multiToolStateChannels })
  .addNode("plan", planNextAction)
  .addNode("execute", executeAction)
  .addNode("finish", finalize)
  .addEdge("plan", "execute")
  .addConditionalEdges("execute", routeNext, {
    plan: "plan",
    finish: "finish",
  })
  .addEdge("finish", END)
  .setEntryPoint("plan")

const app = workflow.compile()
```

**활용 사례:**
- 복합 작업 자동화
- API 통합 에이전트
- 멀티 모달 워크플로우

---

## 9. 서브그래프

### 9.1 Hierarchical Workflow

**구조도:**
```
Main Graph:
START → SubGraph A → SubGraph B → END

SubGraph A:
  Node 1 → Node 2 → Node 3

SubGraph B:
  Node 4 → Node 5
```

**예시: 복잡한 문서 처리**
```typescript
// 서브그래프 1: 콘텐츠 분석
const analysisSubgraph = new StateGraph({ channels: analysisChannels })
  .addNode("extract", extractKeyInfo)
  .addNode("classify", classifyContent)
  .addNode("summarize", summarizeContent)
  .addEdge("extract", "classify")
  .addEdge("classify", "summarize")
  .addEdge("summarize", END)
  .setEntryPoint("extract")
  .compile()

// 서브그래프 2: 콘텐츠 변환
const transformSubgraph = new StateGraph({ channels: transformChannels })
  .addNode("format", formatContent)
  .addNode("optimize", optimizeContent)
  .addNode("validate", validateContent)
  .addEdge("format", "optimize")
  .addEdge("optimize", "validate")
  .addEdge("validate", END)
  .setEntryPoint("format")
  .compile()

// 메인 그래프
interface MainState {
  document: string
  analysisResult: any
  transformResult: any
}

async function runAnalysis(state: MainState) {
  const result = await analysisSubgraph.invoke({ content: state.document })
  return { analysisResult: result }
}

async function runTransform(state: MainState) {
  const result = await transformSubgraph.invoke({
    content: state.document,
    analysis: state.analysisResult,
  })
  return { transformResult: result }
}

const mainWorkflow = new StateGraph({ channels: mainChannels })
  .addNode("analyze", runAnalysis)
  .addNode("transform", runTransform)
  .addEdge("analyze", "transform")
  .addEdge("transform", END)
  .setEntryPoint("analyze")

const app = mainWorkflow.compile()
```

**활용 사례:**
- 모듈화된 워크플로우
- 재사용 가능한 프로세스
- 복잡한 시스템 구성

---

## 10. 체크포인트 & 재시작

### 10.1 Crash Recovery

**예시: 장애 복구 시스템**
```typescript
import { SqliteSaver } from "@langchain/langgraph/checkpoints/sqlite"

interface RobustState {
  steps: string[]
  currentStep: number
  results: any[]
  error: string | null
}

// 각 단계를 체크포인트와 함께 저장
const checkpointer = new SqliteSaver("workflow.db")

async function step1(state: RobustState) {
  // 무거운 작업 수행
  const result = await heavyComputation1()
  return {
    steps: [...state.steps, "step1"],
    currentStep: 1,
    results: [...state.results, result],
  }
}

async function step2(state: RobustState) {
  const result = await heavyComputation2()
  return {
    steps: [...state.steps, "step2"],
    currentStep: 2,
    results: [...state.results, result],
  }
}

const workflow = new StateGraph({ channels: robustChannels })
  .addNode("step1", step1)
  .addNode("step2", step2)
  .addNode("step3", step3)
  .addEdge("step1", "step2")
  .addEdge("step2", "step3")
  .addEdge("step3", END)
  .setEntryPoint("step1")

const app = workflow.compile({ checkpointer })

// 실행
const config = { configurable: { thread_id: "task-123" } }
try {
  await app.invoke({ steps: [], currentStep: 0, results: [] }, config)
} catch (error) {
  // 장애 발생 시, 마지막 체크포인트부터 재개
  const state = await app.getState(config)
  console.log("마지막 완료 단계:", state.values.currentStep)

  // 재시도
  await app.invoke(state.values, config)
}
```

---

### 10.2 Time Travel Debugging

**예시: 과거 상태로 롤백**
```typescript
// 모든 체크포인트 조회
const history = await app.getStateHistory(config)

for await (const state of history) {
  console.log("체크포인트:", state.config.configurable.checkpoint_id)
  console.log("상태:", state.values)
  console.log("---")
}

// 특정 체크포인트로 롤백
const targetCheckpoint = "checkpoint-5"
const pastState = await app.getState({
  configurable: {
    thread_id: "task-123",
    checkpoint_id: targetCheckpoint,
  },
})

// 그 시점부터 다시 실행
await app.invoke(pastState.values, config)
```

**활용 사례:**
- 디버깅
- 감사 추적
- A/B 테스팅

---

## 11. 에러 핸들링 & 재시도

### 11.1 Retry with Exponential Backoff

**예시: 외부 API 호출 재시도**
```typescript
interface RetryState {
  input: string
  attempts: number
  maxAttempts: number
  result: any
  error: string | null
}

async function callExternalAPI(state: RetryState) {
  try {
    const result = await fetch("https://api.example.com/data")
    return { result, error: null }
  } catch (error) {
    const attempts = state.attempts + 1

    if (attempts >= state.maxAttempts) {
      return { error: "최대 재시도 횟수 초과", attempts }
    }

    // Exponential backoff
    await new Promise(resolve =>
      setTimeout(resolve, Math.pow(2, attempts) * 1000)
    )

    return { attempts, error: error.message }
  }
}

function shouldRetry(state: RetryState): string {
  if (state.result) return "success"
  if (state.attempts >= state.maxAttempts) return "failed"
  return "retry"
}

const workflow = new StateGraph({ channels: retryChannels })
  .addNode("call", callExternalAPI)
  .addNode("success", handleSuccess)
  .addNode("failed", handleFailure)
  .addConditionalEdges("call", shouldRetry, {
    retry: "call",
    success: "success",
    failed: "failed",
  })
  .addEdge("success", END)
  .addEdge("failed", END)
  .setEntryPoint("call")

const app = workflow.compile()
```

---

### 11.2 Fallback Strategies

**예시: 다중 모델 폴백**
```typescript
interface FallbackState {
  input: string
  models: string[]
  currentModel: number
  result: string | null
  error: string | null
}

async function tryModel(state: FallbackState) {
  const modelName = state.models[state.currentModel]

  try {
    const result = await getModel(modelName).invoke(state.input)
    return { result, error: null }
  } catch (error) {
    return {
      error: error.message,
      currentModel: state.currentModel + 1,
    }
  }
}

function shouldFallback(state: FallbackState): string {
  if (state.result) return "success"
  if (state.currentModel >= state.models.length) return "failed"
  return "retry"
}

const workflow = new StateGraph({ channels: fallbackChannels })
  .addNode("try", tryModel)
  .addNode("success", processSuccess)
  .addNode("failed", handleAllFailed)
  .addConditionalEdges("try", shouldFallback, {
    retry: "try",
    success: "success",
    failed: "failed",
  })
  .addEdge("success", END)
  .addEdge("failed", END)
  .setEntryPoint("try")

const app = workflow.compile()

// 사용
await app.invoke({
  input: "질문",
  models: ["gpt-4", "gpt-3.5-turbo", "claude-3"],
  currentModel: 0,
})
```

**활용 사례:**
- API 안정성 향상
- 다중 모델 시스템
- 장애 대응

---

## 12. 스트리밍

### 12.1 Real-time Streaming

**예시: 실시간 사고과정 스트리밍**
```typescript
interface StreamState {
  input: string
  steps: { name: string; output: string; timestamp: number }[]
  finalResult: string
}

async function* streamWorkflow(input: string) {
  const config = { configurable: { thread_id: "stream-123" } }

  // 각 노드 실행마다 이벤트 스트리밍
  for await (const event of await app.stream({ input }, config)) {
    const [[nodeName, nodeState]] = Object.entries(event)

    yield {
      type: "node",
      node: nodeName,
      state: nodeState,
      timestamp: Date.now(),
    }
  }

  yield { type: "complete", timestamp: Date.now() }
}

// Elysia 라우터에서 사용
app.post("/stream", async ({ body }) => {
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of streamWorkflow(body.input)) {
        controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`)
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  })
})
```

---

### 12.2 Token Streaming (LLM 출력)

**예시: LLM 토큰 스트리밍**
```typescript
async function streamLLMResponse(state: StreamState) {
  const stream = await llm.stream(state.input)

  let fullResponse = ""
  for await (const chunk of stream) {
    fullResponse += chunk

    // 각 토큰을 즉시 전송
    yield {
      type: "token",
      content: chunk,
      accumulated: fullResponse,
    }
  }

  return { response: fullResponse }
}

// 클라이언트에서 사용
const eventSource = new EventSource("/api/stream")

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)

  if (data.type === "token") {
    // UI 업데이트 (타이핑 효과)
    updateUI(data.content)
  }
}
```

**활용 사례:**
- 실시간 채팅
- 진행 상황 모니터링
- 대화형 인터페이스

---

## 13. 실제 비즈니스 유스케이스

### 13.1 고객 지원 자동화 시스템

**기능:** 고객 문의를 자동으로 분류하고 적절한 응답 생성

**그래프 구조:**
```
START → 문의 분석 → 카테고리 분류 → 라우팅
                                      ├→ 일반 문의 → 자동 응답 → END
                                      ├→ 기술 문의 → 전문가 에이전트 → END
                                      └→ 긴급 → 알림 + 우선 처리 → END
```

**구현 포인트:**
- 감정 분석으로 우선순위 결정
- 지식 베이스에서 관련 정보 검색
- Human-in-the-loop for 복잡한 케이스
- 응답 품질 자동 검증

---

### 13.2 콘텐츠 생성 및 최적화 파이프라인

**기능:** SEO 최적화된 블로그 포스트 자동 생성

**그래프 구조:**
```
START → 키워드 분석 → 아웃라인 생성 → 사용자 승인
                                          ↓
                     본문 작성 → SEO 최적화 → 이미지 추천 → 최종 검토 → END
```

**구현 포인트:**
- Map-Reduce for 다중 섹션 병렬 생성
- 반복 개선 루프
- SEO 체크리스트 자동 검증
- A/B 테스트용 변형 생성

---

### 13.3 데이터 분석 및 리포팅 에이전트

**기능:** 데이터베이스를 자동으로 분석하고 인사이트 생성

**그래프 구조:**
```
START → 데이터 로딩 → 탐색적 분석 → 패턴 발견
                                      ↓
                    인사이트 생성 → 시각화 → 리포트 작성 → END
```

**구현 포인트:**
- Tool calling for SQL 쿼리
- 병렬 차트 생성
- 자동 이상치 탐지
- 스케줄링된 정기 리포트

---

### 13.4 영업 이메일 자동화 시스템

**기능:** 리드 정보를 바탕으로 개인화된 영업 이메일 생성 및 발송

**그래프 구조:**
```
START → 리드 분석 → 페르소나 파악 → 이메일 초안 생성
                                           ↓
                     A/B 변형 생성 → 승인 대기 → 발송 스케줄링 → 추적 → END
```

**구현 포인트:**
- 고객 데이터베이스 통합
- 개인화 변수 자동 삽입
- 발송 시간 최적화
- 응답률 추적 및 학습

---

### 13.5 문서 검토 및 개선 시스템

**기능:** 계약서, 제안서 등의 문서 자동 검토 및 개선 제안

**그래프 구조:**
```
START → 문서 분석 → 병렬 검토
                    ├→ 법률 검토
                    ├→ 문법 검토
                    ├→ 명확성 검토
                    └→ 일관성 검토
                           ↓
                    결과 통합 → 개선안 생성 → 승인 → 최종본 생성 → END
```

**구현 포인트:**
- 다중 관점 병렬 분석
- 버전 관리
- 변경 사항 추적
- 규정 준수 확인

---

### 13.6 멀티 채널 마케팅 캠페인 관리

**기능:** 통합된 마케팅 캠페인 기획, 실행, 분석

**그래프 구조:**
```
START → 캠페인 목표 설정 → 타겟 오디언스 분석
                                  ↓
                    채널별 콘텐츠 생성 (병렬)
                    ├→ 이메일
                    ├→ 소셜 미디어
                    ├→ 블로그
                    └→ 광고
                         ↓
                    스케줄링 → 실행 → 성과 모니터링 → 최적화 → END
```

**구현 포인트:**
- 각 채널별 최적화
- 일관된 브랜드 메시지
- 실시간 성과 추적
- 자동 A/B 테스트

---

### 13.7 채용 프로세스 자동화

**기능:** 지원자 선별부터 면접 스케줄링까지 자동화

**그래프 구조:**
```
START → 이력서 분석 → 스코어링 → 필터링
                                  ↓
                    합격자 → 면접 질문 생성 → 스케줄 조율
                                                    ↓
                    불합격자 → 정중한 거절 이메일 → END
```

**구현 포인트:**
- NLP 기반 이력서 파싱
- 공정한 평가 기준
- 자동 이메일 발송
- 캘린더 통합

---

### 13.8 소셜 미디어 모니터링 및 대응

**기능:** 브랜드 멘션 실시간 모니터링 및 자동 대응

**그래프 구조:**
```
실시간 스트림 → 브랜드 멘션 감지 → 감정 분석 → 우선순위 분류
                                                      ↓
                              긍정 → 감사 메시지
                              중립 → 정보 제공
                              부정 → 즉각 대응 + 에스컬레이션
```

**구현 포인트:**
- 실시간 스트림 처리
- 감정 분석
- 위기 상황 조기 감지
- 자동 응답 vs 인간 개입 결정

---

### 13.9 지식 베이스 관리 시스템

**기능:** FAQ, 문서를 자동으로 업데이트하고 검색 가능하게 관리

**그래프 구조:**
```
START → 새 정보 수집 → 중복 확인 → 카테고리 분류
                                        ↓
                    요약 생성 → 태깅 → 벡터 임베딩 → 저장 → END

검색 시:
Query → 임베딩 → 유사도 검색 → 재순위화 → 답변 생성 → END
```

**구현 포인트:**
- 벡터 DB 통합
- 자동 중복 제거
- 시간 경과에 따른 정보 업데이트
- 검색 품질 개선

---

### 13.10 코드 리뷰 자동화

**기능:** Pull Request 자동 분석 및 리뷰 코멘트 생성

**그래프 구조:**
```
PR 생성 → 변경 사항 분석 → 병렬 검토
                          ├→ 코드 품질
                          ├→ 보안 취약점
                          ├→ 성능 이슈
                          └→ 테스트 커버리지
                                 ↓
                    리뷰 코멘트 생성 → 우선순위 분류 → 게시 → END
```

**구현 포인트:**
- Git 통합
- 정적 분석 도구 연동
- 컨텍스트 인식 코멘트
- 학습 기반 개선

---

## 14. Send Grinda 프로젝트 특화 유스케이스

### 14.1 이메일 시퀀스 최적화 에이전트

**목적:** 기존 이메일 시퀀스를 분석하고 개선안 제안

**그래프 구조:**
```
START → 시퀀스 로딩 → 성과 데이터 분석 → 병렬 분석
                                        ├→ 오픈율 분석
                                        ├→ 응답률 분석
                                        ├→ 타이밍 분석
                                        └→ 콘텐츠 품질 분석
                                                ↓
                            인사이트 통합 → A/B 테스트 제안 → 실행 계획 → END
```

**구현 예시:**
```typescript
interface SequenceOptimizationState {
  sequenceId: string
  metrics: {
    openRate: number
    replyRate: number
    bounceRate: number
  }
  analysis: {
    timing: string
    content: string
    targeting: string
  }
  recommendations: string[]
}

async function analyzePerformance(state: SequenceOptimizationState) {
  const data = await db.query(`
    SELECT * FROM email_metrics WHERE sequence_id = ?
  `, [state.sequenceId])

  const analysis = await llm.invoke(
    `다음 이메일 시퀀스 성과를 분석하고 개선점 제안: ${JSON.stringify(data)}`
  )

  return { analysis: parseAnalysis(analysis) }
}

async function generateRecommendations(state: SequenceOptimizationState) {
  const recommendations = await llm.invoke(
    `분석 결과를 바탕으로 구체적인 개선안 제시: ${JSON.stringify(state.analysis)}`
  )

  return { recommendations: parseRecommendations(recommendations) }
}
```

---

### 14.2 개인화된 이메일 콘텐츠 생성기

**목적:** 수신자 데이터를 기반으로 고도로 개인화된 이메일 생성

**그래프 구조:**
```
START → 리드 데이터 수집 → 산업 분석 → 페인 포인트 파악
                                            ↓
                    관련 사례 검색 → 초안 생성 → 톤 조정 → 검증
                                                         ↓
                    A/B 변형 생성 → 스팸 필터 체크 → 승인 대기 → END
```

**구현 포인트:**
- CRM 데이터 통합
- LinkedIn/웹 데이터 수집
- 산업별 템플릿
- 개인화 변수 최대 20개 이상

---

### 14.3 답장 분류 및 자동 응답 시스템

**목적:** 수신된 답장을 분석하고 적절한 후속 조치 자동화

**그래프 구조:**
```
답장 수신 → 의도 분석 → 분류
                        ├→ 긍정적 관심 → 미팅 제안 생성
                        ├→ 추가 정보 요청 → 자료 발송
                        ├→ 거절 → 정중한 종료 + 리드 상태 업데이트
                        ├→ 자동 응답 → 무시
                        └→ 불확실 → 사람 검토 필요
```

**구현 예시:**
```typescript
interface ReplyClassificationState {
  emailId: string
  from: string
  subject: string
  content: string
  intent: "interested" | "not_interested" | "info_request" | "meeting" | "auto_reply"
  sentiment: "positive" | "neutral" | "negative"
  nextAction: string
  response: string
}

async function classifyIntent(state: ReplyClassificationState) {
  const classification = await llm.invoke(
    `다음 이메일 답장의 의도를 분류하세요:
    제목: ${state.subject}
    내용: ${state.content}

    분류 옵션: interested, not_interested, info_request, meeting, auto_reply`
  )

  return {
    intent: extractIntent(classification),
    sentiment: extractSentiment(classification),
  }
}

async function generateFollowUp(state: ReplyClassificationState) {
  const response = await llm.invoke(
    `의도: ${state.intent}, 감정: ${state.sentiment}에 맞는 후속 이메일 작성`
  )

  return { response }
}

function routeByIntent(state: ReplyClassificationState): string {
  switch (state.intent) {
    case "interested":
    case "meeting":
      return "generate_meeting_proposal"
    case "info_request":
      return "send_materials"
    case "not_interested":
      return "polite_close"
    case "auto_reply":
      return "ignore"
    default:
      return "human_review"
  }
}
```

---

### 14.4 이메일 워밍업 자동화

**목적:** 새 이메일 계정의 평판을 점진적으로 구축

**그래프 구조:**
```
START → 계정 상태 확인 → 일일 한도 계산 → 발송 대상 선택
                                            ↓
                    이메일 발송 → 응답 모니터링 → 평판 점수 업데이트
                         ↑                              ↓
                         └──────────────────────────────┘
                                   (7-14일 반복)
                                        ↓
                                      완료 → END
```

**구현 포인트:**
- 점진적 볼륨 증가 (하루 10개 → 100개)
- 자동 응답 생성 및 발송
- 스팸 신고 모니터링
- SPF/DKIM/DMARC 검증

---

### 14.5 시퀀스 성과 예측 모델

**목적:** 새로운 시퀀스의 예상 성과를 사전에 예측

**그래프 구조:**
```
START → 시퀀스 분석 → 유사 시퀀스 검색 → 특징 추출
                                          ↓
                    과거 데이터 학습 → 예측 모델 실행 → 신뢰도 계산
                                                         ↓
                    시각화 생성 → 개선 제안 → 리포트 생성 → END
```

---

### 14.6 리드 스코어링 및 우선순위화

**목적:** 리드의 전환 가능성을 자동으로 평가

**그래프 구조:**
```
START → 리드 데이터 수집 → 병렬 분석
                          ├→ 회사 규모/산업
                          ├→ 직책/권한
                          ├→ 웹사이트 활동
                          └→ 이메일 인게이지먼트
                                 ↓
                    스코어 계산 → 세그먼트 분류 → 맞춤 시퀀스 할당 → END
```

**구현 포인트:**
- 다양한 데이터 소스 통합
- 가중치 자동 학습
- 실시간 스코어 업데이트
- 세그먼트별 전략

---

## 15. 고급 패턴

### 15.1 Self-Healing Workflow

**설명:** 오류 발생 시 스스로 복구하는 워크플로우

```typescript
interface SelfHealingState {
  task: string
  attempts: { method: string; error: string | null }[]
  strategies: string[]
  currentStrategy: number
  result: any
}

async function tryStrategy(state: SelfHealingState) {
  const strategy = state.strategies[state.currentStrategy]

  try {
    const result = await executeWithStrategy(state.task, strategy)
    return { result }
  } catch (error) {
    // LLM에게 대안 전략 제안 요청
    const newStrategy = await llm.invoke(
      `이 오류를 해결할 대안 제안: ${error.message}\n이전 시도: ${JSON.stringify(state.attempts)}`
    )

    return {
      attempts: [...state.attempts, { method: strategy, error: error.message }],
      strategies: [...state.strategies, newStrategy],
      currentStrategy: state.currentStrategy + 1,
    }
  }
}
```

---

### 15.2 Ensemble Pattern

**설명:** 여러 모델/전략의 결과를 앙상블

```typescript
interface EnsembleState {
  input: string
  models: string[]
  predictions: { model: string; output: any; confidence: number }[]
  finalPrediction: any
}

async function runEnsemble(state: EnsembleState) {
  const predictions = await Promise.all(
    state.models.map(async (model) => {
      const output = await getModel(model).invoke(state.input)
      const confidence = calculateConfidence(output)
      return { model, output, confidence }
    })
  )

  // 가중 평균 또는 투표
  const finalPrediction = weightedVote(predictions)

  return { predictions, finalPrediction }
}
```

---

### 15.3 Adaptive Workflow

**설명:** 실행 중 동적으로 워크플로우 구조 변경

```typescript
async function adaptWorkflow(state: AdaptiveState) {
  // 현재 상황 평가
  const situation = await analyzeContext(state)

  // LLM에게 최적의 다음 단계 질문
  const nextSteps = await llm.invoke(
    `현재 상황: ${situation}\n가장 효과적인 다음 단계를 추천하세요.`
  )

  // 동적으로 노드 추가
  const newNodes = parseRecommendedNodes(nextSteps)
  for (const node of newNodes) {
    workflow.addNode(node.name, node.func)
  }

  return { adaptedPlan: nextSteps }
}
```

---

## 16. 성능 최적화 전략

### 16.1 Caching

```typescript
const cache = new Map()

async function cachedLLMCall(prompt: string) {
  const cacheKey = hash(prompt)

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  const result = await llm.invoke(prompt)
  cache.set(cacheKey, result)

  return result
}
```

### 16.2 Batch Processing

```typescript
async function batchProcess(state: BatchState) {
  const BATCH_SIZE = 10
  const results = []

  for (let i = 0; i < state.items.length; i += BATCH_SIZE) {
    const batch = state.items.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(item => processItem(item))
    )
    results.push(...batchResults)
  }

  return { results }
}
```

### 16.3 Lazy Loading

```typescript
async function loadDataOnDemand(state: LazyState) {
  // 필요할 때만 데이터 로딩
  if (!state.cachedData) {
    state.cachedData = await fetchLargeDataset()
  }

  return state
}
```

---

## 17. 모니터링 및 디버깅

### 17.1 Logging & Tracing

```typescript
async function tracedNode(state: State) {
  const startTime = Date.now()

  console.log(`[${new Date().toISOString()}] 노드 시작: ${nodeName}`)
  console.log(`입력 상태:`, JSON.stringify(state, null, 2))

  try {
    const result = await nodeFunction(state)

    const duration = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] 노드 완료: ${nodeName} (${duration}ms)`)
    console.log(`출력 상태:`, JSON.stringify(result, null, 2))

    return result
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 노드 오류: ${nodeName}`, error)
    throw error
  }
}
```

### 17.2 Metrics Collection

```typescript
interface Metrics {
  nodeName: string
  duration: number
  inputTokens: number
  outputTokens: number
  cost: number
  timestamp: number
}

const metrics: Metrics[] = []

async function collectMetrics(nodeName: string, fn: Function) {
  const start = Date.now()
  const result = await fn()
  const duration = Date.now() - start

  metrics.push({
    nodeName,
    duration,
    inputTokens: calculateTokens(result.input),
    outputTokens: calculateTokens(result.output),
    cost: calculateCost(result),
    timestamp: Date.now(),
  })

  return result
}
```

---

## 요약

LangGraph는 복잡한 AI 워크플로우를 구조화하고 관리하는 강력한 도구입니다.

**핵심 패턴:**
1. ✅ Sequential - 순차 실행
2. ✅ Branching - 조건부 분기
3. ✅ Loop - 반복 실행
4. ✅ Agent (ReAct, Plan-Execute)
5. ✅ Map-Reduce - 병렬 처리
6. ✅ Human-in-the-Loop - 사람 개입
7. ✅ Memory & State - 상태 관리
8. ✅ Tool Calling - 외부 도구 사용
9. ✅ Subgraph - 모듈화
10. ✅ Checkpoint - 복구 가능성

**Send Grinda 프로젝트 적용:**
- 이메일 시퀀스 최적화
- 답장 자동 분류 및 응답
- 리드 스코어링
- 개인화 콘텐츠 생성
- 성과 예측 및 분석

각 패턴은 독립적으로 또는 조합하여 사용할 수 있으며, 프로젝트의 요구사항에 맞게 커스터마이징 가능합니다.
