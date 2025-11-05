# Chatbot 스트리밍 미작동 이슈 분석 및 해결 방안

> 이슈 발견일: 2025-11-05
> 증상: 마지막 응답(analysis)이 스트리밍되지 않고 한 번에 표시됨

## 🔍 문제 증상

사용자 질문: "최근 1달간 이메일 오픈률 분석해줘"

### 현재 동작
```
[스트리밍됨] SQL 생성 중...
[스트리밍됨] 쿼리 실행 중...
[한 번에 표시] 최근 1달간 이메일 오픈률은 약 37.95%로 나타났습니다...
                (긴 분석 텍스트 전체가 한 번에 표시됨)
```

### 기대 동작
```
[스트리밍됨] SQL 생성 중...
[스트리밍됨] 쿼리 실행 중...
[스트리밍됨] 최근 1달간
[스트리밍됨] 이메일 오픈률은
[스트리밍됨] 약 37.95%로
[스트리밍됨] 나타났습니다...
```

---

## 🎯 근본 원인 (Root Cause)

### 문제 1: `analyzeResults` 노드가 스트리밍을 사용하지 않음

**파일**: `elysia-server/src/services/chatbot/nodes/result-analyzer.ts:89`

```typescript
// ❌ 현재 코드 (문제)
export async function analyzeResults(state: ChatbotState): Promise<Partial<ChatbotState>> {
  // ...
  const response = await llm.invoke(prompt)  // ⚠️ invoke() 사용 - 스트리밍 없음
  const analysis = response.content as string

  return {
    analysis,  // 전체 텍스트를 한 번에 반환
  }
}
```

**분석**:
- `llm.invoke()`는 **전체 응답을 기다린 후 한 번에 반환**
- 스트리밍 함수 `streamAnalysisResults`는 **정의만 되어있고 사용되지 않음**
- `_emitter`가 주입되어 있지만 **사용하지 않음**

---

### 문제 2: 다른 노드와의 일관성 부재

다른 노드들은 스트리밍을 올바르게 구현했습니다:

| 노드 | 스트리밍 여부 | 구현 방식 |
|------|------------|----------|
| `analyze.ts:51` | ✅ YES | `llm.stream()` + `streamLLMResponse()` |
| `sql-generator.ts:49` | ✅ YES | `llm.stream()` + `streamLLMResponse()` |
| `insight-generator.ts:44` | ✅ YES | `llm.stream()` + `streamLLMResponse()` |
| `visualization-suggester.ts:49` | ✅ YES | `llm.stream()` + `streamLLMResponse()` |
| `follow-up-generator.ts:32` | ✅ YES | `llm.stream()` + `streamLLMResponse()` |
| **`result-analyzer.ts:89`** | ❌ **NO** | ❌ `llm.invoke()` - **문제!** |

---

## 🔧 해결 방안

### Solution 1: `streamLLMResponse` 사용 (권장)

다른 노드와 동일한 패턴으로 수정:

```typescript
// ✅ 수정된 코드
import { streamLLMResponse } from "../sse-context"

export async function analyzeResults(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  const emitter = state._emitter  // ⭐ emitter 가져오기

  // 노드 시작 이벤트
  if (emitter) {
    emitter.nodeStart("analyzeResults", "쿼리 결과를 분석하는 중...")
  }

  chatbotLogger.nodeStart("analyzeResults")

  try {
    // Detect mutation queries
    const sqlLower = state.generatedSQL.toLowerCase().trim()
    const isMutation =
      sqlLower.startsWith("update") ||
      sqlLower.startsWith("delete") ||
      sqlLower.startsWith("insert") ||
      sqlLower.startsWith("with")

    const hasCTEMutation =
      sqlLower.includes("insert into") ||
      sqlLower.includes("update ") ||
      sqlLower.includes("delete from")

    // 결과가 없는 경우 (mutation 포함)
    if (state.queryResult.length === 0) {
      const duration = Date.now() - startTime

      if (isMutation || hasCTEMutation) {
        const affectedRows = state.affectedRows || 0
        chatbotLogger.nodeSuccess(`analyzeResults (mutation: ${affectedRows} rows)`, duration)

        let operationType = "created"
        if (sqlLower.includes("update")) operationType = "updated"
        else if (sqlLower.includes("delete")) operationType = "deleted"
        else if (sqlLower.includes("insert")) operationType = "created"

        const message = `✅ Successfully ${operationType} ${affectedRows || 1} row${affectedRows !== 1 ? "s" : ""}.\n\nThe data has been added to the database.`

        // 짧은 메시지도 emitter로 전송
        if (emitter) {
          emitter.nodeComplete("analyzeResults", "분석 완료", { analysis: message })
        }

        return { analysis: message }
      }

      chatbotLogger.nodeSuccess("analyzeResults (no results)", duration)

      const message = "No results found. Try searching with different conditions."
      if (emitter) {
        emitter.nodeComplete("analyzeResults", "분석 완료", { analysis: message })
      }

      return { analysis: message }
    }

    // CTE mutation
    if (hasCTEMutation && state.queryResult.length > 0) {
      const duration = Date.now() - startTime
      chatbotLogger.nodeSuccess(
        `analyzeResults (CTE mutation: ${state.queryResult.length} rows returned)`,
        duration,
      )

      let operationType = "created"
      if (sqlLower.includes("update")) operationType = "updated"
      else if (sqlLower.includes("delete")) operationType = "deleted"
      else if (sqlLower.includes("insert")) operationType = "created"

      const resultSummary =
        state.queryResult.length === 1
          ? "\n\n**Created record:**\n```json\n" +
            JSON.stringify(state.queryResult[0], null, 2) +
            "\n```"
          : `\n\n**${state.queryResult.length} records ${operationType}**`

      const message = `✅ Successfully ${operationType} ${state.queryResult.length} row${state.queryResult.length !== 1 ? "s" : ""}.${resultSummary}`

      if (emitter) {
        emitter.nodeComplete("analyzeResults", "분석 완료", { analysis: message })
      }

      return { analysis: message }
    }

    // ⭐ 스트리밍 사용 (핵심 수정)
    if (emitter) {
      emitter.progress("analyzeResults", "LLM 분석 시작...", 20)
    }

    const prompt = getAnalysisResultPrompt(
      state.currentQuestion,
      state.generatedSQL,
      state.queryResult,
      state.executionTime,
    )

    // ⭐ llm.stream() 사용
    let analysis = ""
    if (emitter) {
      const stream = await llm.stream(prompt)
      analysis = await streamLLMResponse(emitter, "analyzeResults", stream, {
        onComplete: () => {
          emitter.progress("analyzeResults", "분석 완료", 100)
        },
      })
    } else {
      // Fallback: emitter 없을 때만 invoke 사용
      const response = await llm.invoke(prompt)
      analysis = response.content as string
    }

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("analyzeResults", duration)

    if (emitter) {
      emitter.nodeComplete("analyzeResults", "쿼리 결과 분석 완료")
    }

    return { analysis }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    chatbotLogger.nodeError("analyzeResults", errorMessage, duration)

    if (emitter) {
      emitter.error("analyzeResults", errorMessage)
    }

    return {
      analysis: "An error occurred while analyzing the results.",
      error: errorMessage,
    }
  }
}
```

---

### Solution 2: LLM 설정에 streaming 활성화

현재 `result-analyzer.ts`의 LLM 인스턴스:

```typescript
// ❌ 현재
const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.3,
  // streaming 옵션 없음
})

// ✅ 수정
const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.3,
  streaming: true,  // ⭐ 명시적으로 스트리밍 활성화
})
```

---

## 📊 수정 전후 비교

### Before (현재)
```typescript
// result-analyzer.ts:89
const response = await llm.invoke(prompt)  // 5-10초 대기
const analysis = response.content as string
return { analysis }  // 전체 텍스트 한 번에 반환
```

**사용자 경험**:
```
[0-5초] 노드 실행 중...
[5-10초] ⏳ 아무 변화 없음 (LLM 응답 대기)
[10초] 💥 전체 텍스트가 갑자기 나타남
```

### After (수정 후)
```typescript
// result-analyzer.ts (수정)
const stream = await llm.stream(prompt)
const analysis = await streamLLMResponse(emitter, "analyzeResults", stream)
return { analysis }
```

**사용자 경험**:
```
[0초] 노드 실행 중...
[1초] "최근 1달간 "
[2초] "이메일 오픈률은 "
[3초] "약 37.95%로 "
[4초] "나타났습니다..."
[10초] ✅ 완료
```

---

## 🧪 테스트 방법

### 1. 수정 적용
```bash
# result-analyzer.ts 수정
cd elysia-server/src/services/chatbot/nodes
# 위의 수정 사항 적용
```

### 2. 서버 재시작
```bash
cd elysia-server
bun --watch src/index.ts
```

### 3. 테스트 쿼리
```
질문: "최근 1달간 이메일 오픈률 분석해줘"
```

### 4. 확인 사항
- ✅ 텍스트가 단어/문장 단위로 점진적으로 나타나는지
- ✅ SSE 이벤트 `text_chunk`가 발생하는지 (브라우저 DevTools Network 탭)
- ✅ 로그에 `[Node] analyzeResults progress: ...`가 출력되는지

---

## 🔍 추가 발견사항

### 1. `streamAnalysisResults` 함수는 사용되지 않음

**파일**: `result-analyzer.ts:114-188`

```typescript
// ❌ 정의만 되어 있고 어디서도 호출하지 않음
export async function* streamAnalysisResults(state: ChatbotState): AsyncGenerator<string> {
  // ... 올바른 스트리밍 구현
  const stream = await llm.stream(prompt)

  for await (const chunk of stream) {
    if (chunk.content) {
      yield chunk.content as string
    }
  }
}
```

**원인**:
- 이 함수는 Generator 함수(`async function*`)로 외부에서 호출해야 함
- 하지만 LangGraph 노드는 `AsyncGenerator`를 반환할 수 없음
- LangGraph는 `Promise<Partial<ChatbotState>>`만 허용

**해결책**:
- `streamAnalysisResults` 함수 삭제 (사용 불가)
- 대신 `streamLLMResponse` 헬퍼 사용 (Solution 1)

---

### 2. 다른 노드들은 올바르게 구현됨

**예시**: `analyze.ts:51`

```typescript
// ✅ 올바른 패턈
if (emitter) {
  emitter.progress("analyzeQuestion", "LLM 분석 시작...", 10)

  const stream = await llm.stream(prompt)
  content = await streamLLMResponse(emitter, "analyzeQuestion", stream, {
    onComplete: () => {
      emitter.progress("analyzeQuestion", "분석 응답 처리 중...", 80)
    },
  })
} else {
  // Fallback: 스트리밍 불가능한 경우만 invoke 사용
  const response = await llm.invoke(prompt)
  content = response.content as string
}
```

**결론**: `result-analyzer.ts`만 이 패턴을 따르지 않음

---

## 📈 예상 효과

### 사용자 경험 개선
- **체감 대기 시간**: 10초 → 1-2초 (첫 응답까지)
- **인터랙션**: 정적 → 동적 (실시간 피드백)
- **이탈률**: 감소 예상 (오래 기다려서 페이지를 떠나는 사용자 감소)

### 기술적 이점
- **일관성**: 모든 노드가 동일한 스트리밍 패턴 사용
- **유지보수성**: 코드 패턴 통일
- **모니터링**: SSE 이벤트로 진행 상황 추적 가능

---

## 🚀 구현 우선순위

### Priority 1: 즉시 수정 (1시간)
1. `result-analyzer.ts:89` - `llm.invoke()` → `llm.stream()` 변경
2. `streamLLMResponse` 헬퍼 통합
3. `streaming: true` 옵션 추가

### Priority 2: 정리 (30분)
1. `streamAnalysisResults` 함수 삭제 (사용 불가능)
2. 주석 업데이트
3. 테스트 작성

---

## 📝 체크리스트

구현 시 확인 사항:

- [ ] `llm.invoke()` → `llm.stream()` 변경
- [ ] `streamLLMResponse` 헬퍼 사용
- [ ] `emitter.nodeStart()` 호출 추가
- [ ] `emitter.progress()` 호출 추가
- [ ] `emitter.nodeComplete()` 호출 추가
- [ ] `streaming: true` 옵션 확인
- [ ] 에러 처리에서도 emitter 사용
- [ ] 짧은 메시지(mutation)도 emitter로 전송
- [ ] Fallback 처리 (emitter 없을 때)
- [ ] 로그 확인
- [ ] SSE 이벤트 확인 (브라우저 DevTools)
- [ ] 실제 사용자 테스트

---

## 🎓 교훈 및 권장사항

### 1. 코드 리뷰 프로세스
- 새 노드 추가 시 **기존 노드와 패턴 일치** 확인
- PR 시 **스트리밍 동작 여부** 체크리스트 추가

### 2. 자동화된 테스트
```typescript
// ✅ 스트리밍 테스트 추가
describe('analyzeResults', () => {
  it('should stream analysis text', async () => {
    const emitter = createMockEmitter()
    const state = createMockState()

    await analyzeResults(state)

    // emitter.textChunk가 여러 번 호출되었는지 확인
    expect(emitter.textChunk).toHaveBeenCalledTimes(greaterThan(1))
  })
})
```

### 3. 문서화
- 모든 노드 구현 시 **스트리밍 패턴 가이드** 참조
- `streamLLMResponse` 헬퍼 사용법 문서화

---

## 참고 자료

- **올바른 구현 예시**: `elysia-server/src/services/chatbot/nodes/analyze.ts:51`
- **SSE 컨텍스트**: `elysia-server/src/services/chatbot/sse-context.ts`
- **라우트 핸들러**: `elysia-server/src/routes/chatbot.routes.ts:201`

---

**문서 버전**: 1.0
**이슈 심각도**: HIGH (사용자 경험에 직접적 영향)
**예상 수정 시간**: 1-2시간
**검증자**: Claude Code
