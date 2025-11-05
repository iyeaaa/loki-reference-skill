import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getAnalysisPrompt, getAnalysisPromptWithCSV } from "../prompts"
import { getRelevantSchema } from "../schema-context"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.3, // Consistent analysis with some flexibility
})

export async function analyzeQuestion(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  // Emit node start event
  if (emitter) {
    emitter.nodeStart("analyzeQuestion", "요청하신 내용을 확인하고 있어요...")
  }

  chatbotLogger.nodeStart("analyzeQuestion")

  // Log input state
  chatbotLogger.nodeDetail("analyzeQuestion", {
    question: state.currentQuestion,
    workspaceId: state.workspaceId,
    messageCount: state.messages.length,
  })

  try {
    // Check if CSV data is present
    const hasCSV = !!state.csvData && state.csvData.rowCount > 0

    const prompt =
      hasCSV && state.csvData
        ? getAnalysisPromptWithCSV(
            state.currentQuestion,
            state.workspaceId,
            state.csvData,
            state.messages,
          )
        : getAnalysisPrompt(state.currentQuestion, state.workspaceId, state.messages)

    // Generate analysis using LLM (no intermediate progress events)
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

    // Emit node complete event
    if (emitter) {
      emitter.nodeComplete("analyzeQuestion", "내용 확인 완료", {
        intent: analysis.intent,
        needsClarification: analysis.needsClarification || false,
      })
    }

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

    // Emit error event
    if (emitter) {
      emitter.error("analyzeQuestion", `내용을 이해하는데 문제가 생겼어요: ${errorMessage}`)
    }

    return {
      error: `요청하신 내용을 확인하는 중 문제가 발생했어요. 다시 한 번 시도해주세요.`,
      needsClarification: false,
    }
  }
}
