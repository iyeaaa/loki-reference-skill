import { ChatOpenAI } from "@langchain/openai"
import { getInsightGenerationPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.7, // Higher temperature for creative, diverse insights
})

export async function generateInsights(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const emitter = state._emitter

  // 노드 시작 이벤트
  if (emitter) {
    emitter.nodeStart("generateInsights", "중요한 내용을 정리하고 있어요...")
  }

  try {
    // 결과가 없는 경우에만 인사이트 생략 (1개 행도 인사이트 생성 가능)
    if (state.queryResult.length === 0) {
      if (emitter) {
        emitter.nodeComplete("generateInsights", "데이터 인사이트 생략 (결과 없음)", {
          insights: [],
        })
      }
      return {
        insights: [],
      }
    }

    const prompt = getInsightGenerationPrompt(
      state.currentQuestion,
      state.analysis,
      state.queryResult,
    )

    // Use non-streaming LLM call for intermediate node (no progress events)
    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const insights = JSON.parse(jsonStr.trim())

    if (emitter) {
      emitter.nodeComplete(
        "generateInsights",
        `핵심 내용 정리 완료 (${Array.isArray(insights) ? insights.length : 0}개)`,
        { insights: Array.isArray(insights) ? insights : [] }, // 즉시 프론트엔드로 전송
      )
    }

    return {
      insights: Array.isArray(insights) ? insights : [],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    if (emitter) {
      emitter.error("generateInsights", errorMessage)
    }

    return {
      insights: [],
    }
  }
}
