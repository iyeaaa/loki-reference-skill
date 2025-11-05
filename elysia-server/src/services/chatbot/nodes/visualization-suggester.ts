import { ChatOpenAI } from "@langchain/openai"
import { getVisualizationSuggestionPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.6, // Moderate creativity for varied visualization suggestions
})

export async function suggestVisualizations(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const emitter = state._emitter

  // 노드 시작 이벤트
  if (emitter) {
    emitter.nodeStart("suggestVisualizations", "그래프 만드는 중...")
  }

  try {
    // 결과가 없는 경우 시각화 생략
    if (state.queryResult.length === 0) {
      if (emitter) {
        emitter.nodeComplete("suggestVisualizations", "시각화 제안 생략 (결과 없음)")
      }
      return {
        visualizationSuggestions: [],
      }
    }

    const prompt = getVisualizationSuggestionPrompt(state.queryResult)

    if (!prompt) {
      if (emitter) {
        emitter.nodeComplete("suggestVisualizations", "시각화 제안 생략 (프롬프트 없음)")
      }
      return {
        visualizationSuggestions: [],
      }
    }

    // Use non-streaming LLM call for intermediate node (no progress events)
    const response = await llm.invoke(prompt)
    const content = response.content as string

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\[[\s\S]*\])/)
    const jsonStr = jsonMatch?.[1] || content

    const suggestions = JSON.parse(jsonStr.trim())

    if (emitter) {
      emitter.nodeComplete(
        "suggestVisualizations",
        `시각화 제안 생성 완료 (${Array.isArray(suggestions) ? suggestions.length : 0}개)`,
        { visualizationSuggestions: Array.isArray(suggestions) ? suggestions : [] }, // 즉시 프론트엔드로 전송
      )
    }

    return {
      visualizationSuggestions: Array.isArray(suggestions) ? suggestions : [],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    if (emitter) {
      emitter.error("suggestVisualizations", errorMessage)
    }

    return {
      visualizationSuggestions: [],
    }
  }
}
