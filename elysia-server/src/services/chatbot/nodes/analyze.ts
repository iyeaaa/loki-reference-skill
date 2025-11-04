import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getAnalysisPrompt } from "../prompts"
import { getRelevantSchema } from "../schema-context"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})

export async function analyzeQuestion(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("analyzeQuestion")

  // Log input state
  chatbotLogger.nodeDetail("analyzeQuestion", {
    question: state.currentQuestion,
    workspaceId: state.workspaceId,
    messageCount: state.messages.length,
  })

  try {
    const prompt = getAnalysisPrompt(state.currentQuestion, state.workspaceId, state.messages)

    const response = await llm.invoke(prompt)
    const content = response.content as string

    // JSON 추출 (마크다운 코드 블록 제거)
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch?.[1] || content

    const analysis = JSON.parse((jsonStr || content).trim())

    // 스키마 컨텍스트 준비
    const schemaContext = getRelevantSchema(state.currentQuestion)

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("analyzeQuestion", duration)

    // Log output details
    chatbotLogger.nodeDetail("analyzeQuestion", {
      intent: analysis.intent,
      requiredTables: analysis.requiredTables,
      timeRange: analysis.timeRange,
      needsClarification: analysis.needsClarification || false,
      analysisType: analysis.analysisType,
    })

    return {
      metadata: analysis,
      needsClarification: analysis.needsClarification || false,
      clarificationQuestion: analysis.clarificationQuestion || "",
      schemaContext,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    chatbotLogger.nodeError("analyzeQuestion", errorMessage, duration)

    return {
      error: `질문 분석 중 오류가 발생했습니다: ${errorMessage}`,
      needsClarification: false,
    }
  }
}
