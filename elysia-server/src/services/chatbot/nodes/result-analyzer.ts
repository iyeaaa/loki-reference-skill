import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getAnalysisResultPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.3,
})

export async function analyzeResults(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("analyzeResults")

  try {
    // Detect mutation queries (UPDATE/DELETE/INSERT)
    const sqlLower = state.generatedSQL.toLowerCase().trim()
    const isMutation =
      sqlLower.startsWith("update") ||
      sqlLower.startsWith("delete") ||
      sqlLower.startsWith("insert")

    // 결과가 없는 경우
    if (state.queryResult.length === 0) {
      const duration = Date.now() - startTime

      // Mutation 쿼리인 경우
      if (isMutation) {
        const affectedRows = state.affectedRows || 0
        chatbotLogger.nodeSuccess(`analyzeResults (mutation: ${affectedRows} rows)`, duration)

        let operationType = "modified"
        if (sqlLower.startsWith("update")) operationType = "updated"
        else if (sqlLower.startsWith("delete")) operationType = "deleted"
        else if (sqlLower.startsWith("insert")) operationType = "inserted"

        return {
          analysis: `Successfully ${operationType} ${affectedRows} row${affectedRows !== 1 ? "s" : ""}.`,
        }
      }

      // SELECT 쿼리인데 결과가 없는 경우
      chatbotLogger.nodeSuccess("analyzeResults (no results)", duration)
      return {
        analysis: "No results found. Try searching with different conditions.",
      }
    }

    const prompt = getAnalysisResultPrompt(
      state.currentQuestion,
      state.generatedSQL,
      state.queryResult,
      state.executionTime,
    )

    const response = await llm.invoke(prompt)
    const analysis = response.content as string

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("analyzeResults", duration)

    return {
      analysis,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    chatbotLogger.nodeError("analyzeResults", errorMessage, duration)

    return {
      analysis: "An error occurred while analyzing the results.",
      error: errorMessage,
    }
  }
}

/**
 * Stream analysis results with LLM chunk streaming
 * Used for real-time text generation in the frontend
 */
export async function* streamAnalysisResults(state: ChatbotState): AsyncGenerator<string> {
  try {
    // Detect mutation queries (UPDATE/DELETE/INSERT)
    const sqlLower = state.generatedSQL.toLowerCase().trim()
    const isMutation =
      sqlLower.startsWith("update") ||
      sqlLower.startsWith("delete") ||
      sqlLower.startsWith("insert")

    // 결과가 없는 경우
    if (state.queryResult.length === 0) {
      // Mutation 쿼리인 경우
      if (isMutation) {
        const affectedRows = state.affectedRows || 0

        let operationType = "modified"
        if (sqlLower.startsWith("update")) operationType = "updated"
        else if (sqlLower.startsWith("delete")) operationType = "deleted"
        else if (sqlLower.startsWith("insert")) operationType = "inserted"

        yield `Successfully ${operationType} ${affectedRows} row${affectedRows !== 1 ? "s" : ""}.`
        return
      }

      // SELECT 쿼리인데 결과가 없는 경우
      yield "No results found. Try searching with different conditions."
      return
    }

    const prompt = getAnalysisResultPrompt(
      state.currentQuestion,
      state.generatedSQL,
      state.queryResult,
      state.executionTime,
    )

    const stream = await llm.stream(prompt)

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content as string
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    chatbotLogger.nodeError("streamAnalysisResults", errorMessage, 0)
    yield "An error occurred while analyzing the results."
  }
}
