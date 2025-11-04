# LangGraph Human-in-the-Loop 구현 가이드

## 📋 개요

이 문서는 Send Grid Test 프로젝트의 챗봇에서 LangGraph의 최신 `interrupt()` 패턴을 사용하여 Human-in-the-Loop(사용자 확인)을 구현하는 방법을 설명합니다.

## 🔍 현재 문제점

### 기존 구현의 문제
```typescript
// ❌ 잘못된 방법: interruptBefore/interruptAfter 사용
workflow.compile({
  checkpointer,
  interruptBefore: [NODE_NAMES.EXECUTE_QUERY],  // 문제!
})
```

**문제점:**
1. `interruptBefore`는 노드 실행 **전**에 interrupt 발생
2. 이전 노드(`askConfirmation`)의 state만 checkpoint에 저장됨
3. `askConfirmation`이 반환하지 않은 필드들은 기본값으로 리셋
4. Resume 시 `generatedSQL`, `sqlQueries` 등이 모두 비어있음

### 로그에서 보이는 증상
```
[confirm-initial-state]
    hasGeneratedSQL: false    ← SQL 손실!
    sqlQueriesCount: 0        ← 쿼리 손실!
    nextNodes: []             ← 다음 노드 정보 없음!
```

## ✅ 해결 방안: 최신 interrupt() 패턴 사용

### 핵심 개념

LangGraph의 `interrupt()` 함수는:
1. **동적 interrupt**: 노드 내부 어디서든 호출 가능
2. **자동 state 보존**: 호출 시점의 전체 state를 checkpoint에 저장
3. **명시적 resume**: `Command({ resume: value })` 로 재개

## 🔧 구현 방안

### 방안 1: interrupt() 함수 사용 (추천 ⭐)

#### 1.1 askConfirmation 노드 수정

```typescript
import { interrupt, Command } from "@langchain/langgraph"

async function askConfirmation(state: ChatbotState): Promise<Command> {
  chatbotLogger.nodeStart("askConfirmation")

  // CRITICAL: interrupt() 호출 - 여기서 state가 자동으로 저장됨
  const userDecision = interrupt({
    type: "confirmation_required",
    question: "계속 진행하시겠습니까?",
    confirmationMessage: state.confirmationMessage,
    sql: state.generatedSQL,
    sqlQueries: state.sqlQueries,
  })

  chatbotLogger.nodeSuccess("askConfirmation")

  // userDecision은 resume 시 전달된 값
  if (userDecision === true || userDecision?.confirmed === true) {
    // 승인됨 - 실행 노드로 라우팅
    if (state.sqlQueries && state.sqlQueries.length > 1) {
      return new Command({ goto: NODE_NAMES.EXECUTE_SEQUENTIAL })
    }
    return new Command({ goto: NODE_NAMES.EXECUTE_QUERY })
  }

  // 거부됨 - 에러 핸들링
  return new Command({
    goto: NODE_NAMES.HANDLE_ERROR,
    update: { error: "사용자가 작업을 취소했습니다." }
  })
}
```

#### 1.2 그래프 구성

```typescript
const workflow = new StateGraph(ChatbotStateAnnotation)
  .addNode(NODE_NAMES.ASK_CONFIRMATION, askConfirmation)
  .addNode(NODE_NAMES.EXECUTE_QUERY, executeQuery)
  .addNode(NODE_NAMES.EXECUTE_SEQUENTIAL, executeSequential)
  .addNode(NODE_NAMES.HANDLE_ERROR, handleError)
  // ... 기타 노드들

// askConfirmation은 Command를 반환하므로 자동 라우팅됨
// conditional edges 불필요!

const checkpointer = new MemorySaver()
const graph = workflow.compile({
  checkpointer,
  // interrupt()를 사용하므로 interruptBefore/After 불필요
})
```

#### 1.3 Frontend 처리 (변경 불필요)

Frontend는 이미 올바르게 구현되어 있음:
```typescript
// chatbot.ts의 handleNodeEvent에서 이미 처리 중
if (data.type === "node" && data.node === "__interrupt__") {
  // interrupt 감지하여 confirmation UI 표시
  onConfirmationRequired(data.state.confirmationMessage)
}
```

#### 1.4 Backend Resume 처리

```typescript
// chatbot.routes.ts - /confirm endpoint
.post("/confirm", async ({ body }) => {
  const graph = createChatbotGraph()
  const config = {
    configurable: { thread_id: body.conversationId }
  }

  if (!body.confirmed) {
    // 거부 시 - false로 resume
    await graph.invoke(
      new Command({ resume: false }),
      config
    )
    return successResponse({ message: "작업이 취소되었습니다." })
  }

  // 승인 시 - true로 resume하고 결과 스트리밍
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        // CRITICAL: Command({ resume: true })로 재개
        for await (const event of await graph.stream(
          new Command({ resume: true }),
          config
        )) {
          // 스트리밍 처리...
        }
      } catch (error) {
        // 에러 처리...
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    }
  })
})
```

### 방안 2: 노드 분리 패턴 (대안)

confirmation 로직을 완전히 분리하여 명확하게 만드는 방법:

```typescript
// 1. 검증만 하는 노드
async function validateSQL(state: ChatbotState) {
  // SQL 검증 로직
  const isMutation = /* ... */

  if (isMutation) {
    return {
      needsConfirmation: true,
      confirmationMessage: "이 mutation을 실행하시겠습니까?"
    }
  }

  return { needsConfirmation: false }
}

// 2. 라우팅 노드
function routeAfterValidation(state: ChatbotState): string {
  if (state.needsConfirmation) {
    return NODE_NAMES.ASK_CONFIRMATION
  }
  return NODE_NAMES.EXECUTE_QUERY
}

// 3. Confirmation 노드 (interrupt 사용)
async function askConfirmation(state: ChatbotState): Promise<Command> {
  const approved = interrupt({
    confirmationMessage: state.confirmationMessage,
    sql: state.generatedSQL,
  })

  if (approved) {
    return new Command({ goto: NODE_NAMES.EXECUTE_QUERY })
  }

  return new Command({
    goto: NODE_NAMES.HANDLE_ERROR,
    update: { error: "Cancelled" }
  })
}
```

## 🎯 권장 구현 단계

### Phase 1: 최소 변경으로 수정 (빠른 해결)

1. **askConfirmation 노드에서 interrupt() 사용**
   ```typescript
   const approved = interrupt({
     confirmationMessage: state.confirmationMessage
   })
   ```

2. **graph.compile()에서 interruptBefore/After 제거**
   ```typescript
   const graph = workflow.compile({ checkpointer })
   ```

3. **/confirm endpoint에서 Command 사용**
   ```typescript
   await graph.stream(new Command({ resume: true }), config)
   ```

### Phase 2: 완전한 리팩토링 (최적화)

1. **Command API로 라우팅 통합**
   - Conditional edges를 Command의 goto로 대체

2. **State 관리 단순화**
   - 불필요한 필드 제거 (needsConfirmation, isConfirmed 등)
   - interrupt()가 자동으로 처리

3. **에러 처리 강화**
   - interrupt의 resume 값으로 에러/취소 구분

## 📊 Before vs After 비교

### Before (현재 - 문제 있음)
```
validateSQL → needsConfirmation=true
    ↓
askConfirmation (returns { analysis })
    ↓
interruptBefore: [executeQuery]
    ↓
Checkpoint: ✗ SQL 손실 (askConfirmation만 저장됨)
    ↓
User confirms
    ↓
Resume: ✗ generatedSQL="" (checkpoint에 없음)
```

### After (수정 후 - 정상)
```
validateSQL → needsConfirmation=true
    ↓
askConfirmation
    ↓
interrupt({ confirmationMessage, sql, ... })
    ↓
Checkpoint: ✓ 전체 state 자동 저장
    ↓
User confirms
    ↓
Resume with Command({ resume: true })
    ↓
interrupt() returns true
    ↓
Command({ goto: executeQuery })
    ↓
Execute: ✓ generatedSQL 존재
```

## ⚠️ 주의사항

### Do's ✅

1. **interrupt() 앞의 코드는 idempotent하게 작성**
   ```typescript
   // ✅ 좋은 예: 읽기 전용 연산
   const message = generateConfirmationMessage(state)
   const approved = interrupt(message)

   // ✅ 좋은 예: 부작용은 interrupt 후에
   const approved = interrupt(message)
   if (approved) {
     await executeQuery(state.sql)  // 한 번만 실행됨
   }
   ```

2. **JSON 직렬화 가능한 값만 전달**
   ```typescript
   // ✅ 좋은 예
   interrupt({
     message: "Confirm?",
     sql: state.generatedSQL,
     count: 5
   })

   // ❌ 나쁜 예
   interrupt({
     callback: () => {},  // 함수는 직렬화 불가
     dbConnection: db     // 객체 인스턴스 불가
   })
   ```

3. **일관된 interrupt 순서 유지**
   ```typescript
   // ✅ 좋은 예: 항상 같은 순서
   const approved = interrupt("Confirm?")
   const edited = interrupt("Edit?")

   // ❌ 나쁜 예: 조건부로 순서 변경
   if (condition) {
     interrupt("A")
   }
   interrupt("B")  // resume 시 매칭 실패
   ```

### Don'ts ❌

1. **try/catch로 interrupt 감싸지 않기**
   ```typescript
   // ❌ 절대 금지!
   try {
     const approved = interrupt("Confirm?")
   } catch (error) {
     // interrupt의 특수 예외를 잡아서 pause가 작동하지 않음
   }

   // ✅ 올바른 방법: interrupt는 감싸지 않음
   const approved = interrupt("Confirm?")
   try {
     await dangerousOperation()
   } catch (error) {
     // 다른 에러만 처리
   }
   ```

2. **부작용을 interrupt 전에 실행하지 않기**
   ```typescript
   // ❌ 나쁜 예: resume 시 중복 실행됨
   await sendEmail(state.email)  // 재실행 시 이메일 중복 발송!
   const approved = interrupt("Confirm?")

   // ✅ 좋은 예: interrupt 후에 실행
   const approved = interrupt("Confirm?")
   if (approved) {
     await sendEmail(state.email)  // 한 번만 실행
   }
   ```

## 🧪 테스트 계획

### 1. 단위 테스트
```typescript
describe("askConfirmation with interrupt", () => {
  it("should preserve SQL state in checkpoint", async () => {
    const graph = createChatbotGraph()
    const config = { configurable: { thread_id: "test-123" } }

    const initialState = {
      generatedSQL: "INSERT INTO...",
      sqlQueries: ["INSERT..."],
      needsConfirmation: true,
    }

    // Execute until interrupt
    const result = await graph.invoke(initialState, config)
    expect(result.__interrupt__).toBeDefined()

    // Check checkpoint
    const checkpointState = await graph.getState(config)
    expect(checkpointState.values.generatedSQL).toBe("INSERT INTO...")
    expect(checkpointState.values.sqlQueries).toHaveLength(1)
  })

  it("should resume and execute on approval", async () => {
    // Resume with approval
    const result = await graph.invoke(
      new Command({ resume: true }),
      config
    )

    expect(result.queryResult).toBeDefined()
    expect(result.error).toBeNull()
  })
})
```

### 2. 통합 테스트 시나리오

1. **정상 플로우**
   - Mutation 질문 입력
   - Confirmation 메시지 표시
   - 승인 클릭
   - SQL 실행 성공

2. **거부 플로우**
   - Mutation 질문 입력
   - Confirmation 메시지 표시
   - 거부 클릭
   - 취소 메시지 표시

3. **에러 복구**
   - SQL 실행 중 에러
   - Retry 로직 작동
   - 최종적으로 에러 메시지 표시

## 📈 마이그레이션 체크리스트

- [ ] `@langchain/langgraph` 패키지 최신 버전 확인
- [ ] `interrupt`, `Command` import 추가
- [ ] `askConfirmation` 노드를 `interrupt()` 패턴으로 수정
- [ ] `graph.compile()`에서 `interruptBefore/After` 제거
- [ ] `/confirm` endpoint에서 `Command({ resume })` 사용
- [ ] State reducers에서 불필요한 보존 로직 제거
- [ ] 기존 confirmation 관련 state 필드 정리
- [ ] 로깅 추가 (interrupt 전후 state 확인)
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 수행
- [ ] 프로덕션 배포

## 🔗 참고 자료

- [LangGraph JS Human-in-the-Loop 공식 문서](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [interrupt() 함수 API 문서](https://langchain-ai.github.io/langgraphjs/reference/functions/interrupt.html)
- [Command API 문서](https://langchain-ai.github.io/langgraphjs/reference/classes/Command.html)
- [Best Practices for Interrupts](https://blog.langchain.com/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt/)
