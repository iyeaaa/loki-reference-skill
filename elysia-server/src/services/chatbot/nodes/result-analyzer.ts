import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getAnalysisResultPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-5",
})

export async function analyzeResults(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("analyzeResults")

  try {
    // Detect mutation queries (UPDATE/DELETE/INSERT) or CTE with mutation
    const sqlLower = state.generatedSQL.toLowerCase().trim()
    const isMutation =
      sqlLower.startsWith("update") ||
      sqlLower.startsWith("delete") ||
      sqlLower.startsWith("insert") ||
      sqlLower.startsWith("with")

    // CTE (WITH) 구문 내의 INSERT/UPDATE/DELETE 감지
    const hasCTEMutation =
      sqlLower.includes("insert into") ||
      sqlLower.includes("update ") ||
      sqlLower.includes("delete from")

    // 결과가 없는 경우
    if (state.queryResult.length === 0) {
      const duration = Date.now() - startTime

      // Mutation 쿼리인 경우
      if (isMutation || hasCTEMutation) {
        const affectedRows = state.affectedRows || 0
        chatbotLogger.nodeSuccess(`analyzeResults (mutation: ${affectedRows} rows)`, duration)

        let operationType = "created"
        if (sqlLower.includes("update")) operationType = "updated"
        else if (sqlLower.includes("delete")) operationType = "deleted"
        else if (sqlLower.includes("insert")) operationType = "created"

        return {
          analysis: `✅ Successfully ${operationType} ${affectedRows || 1} row${affectedRows !== 1 ? "s" : ""}.\n\nThe data has been added to the database.`,
        }
      }

      // SELECT 쿼리인데 결과가 없는 경우
      chatbotLogger.nodeSuccess("analyzeResults (no results)", duration)
      return {
        analysis: "No results found. Try searching with different conditions.",
      }
    }

    // CTE mutation의 경우 결과가 있어도 mutation 메시지 표시
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

      // Format the result data nicely
      const resultSummary =
        state.queryResult.length === 1
          ? "\n\n**Created record:**\n```json\n" +
            JSON.stringify(state.queryResult[0], null, 2) +
            "\n```"
          : `\n\n**${state.queryResult.length} records ${operationType}**`

      return {
        analysis: `✅ Successfully ${operationType} ${state.queryResult.length} row${state.queryResult.length !== 1 ? "s" : ""}.${resultSummary}`,
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
    // Detect mutation queries (UPDATE/DELETE/INSERT) or CTE with mutation
    const sqlLower = state.generatedSQL.toLowerCase().trim()
    const isMutation =
      sqlLower.startsWith("update") ||
      sqlLower.startsWith("delete") ||
      sqlLower.startsWith("insert") ||
      sqlLower.startsWith("with")

    // CTE (WITH) 구문 내의 INSERT/UPDATE/DELETE 감지
    const hasCTEMutation =
      sqlLower.includes("insert into") ||
      sqlLower.includes("update ") ||
      sqlLower.includes("delete from")

    // 결과가 없는 경우
    if (state.queryResult.length === 0) {
      // Mutation 쿼리인 경우
      if (isMutation || hasCTEMutation) {
        const affectedRows = state.affectedRows || 0

        let operationType = "created"
        if (sqlLower.includes("update")) operationType = "updated"
        else if (sqlLower.includes("delete")) operationType = "deleted"
        else if (sqlLower.includes("insert")) operationType = "created"

        yield `✅ Successfully ${operationType} ${affectedRows || 1} row${affectedRows !== 1 ? "s" : ""}.\n\nThe data has been added to the database.`
        return
      }

      // SELECT 쿼리인데 결과가 없는 경우
      yield "No results found. Try searching with different conditions."
      return
    }

    // CTE mutation의 경우 결과가 있어도 mutation 메시지 표시
    if (hasCTEMutation && state.queryResult.length > 0) {
      let operationType = "created"
      if (sqlLower.includes("update")) operationType = "updated"
      else if (sqlLower.includes("delete")) operationType = "deleted"
      else if (sqlLower.includes("insert")) operationType = "created"

      // Format the result data nicely
      const resultSummary =
        state.queryResult.length === 1
          ? "\n\n**Created record:**\n```json\n" +
            JSON.stringify(state.queryResult[0], null, 2) +
            "\n```"
          : `\n\n**${state.queryResult.length} records ${operationType}**`

      yield `✅ Successfully ${operationType} ${state.queryResult.length} row${state.queryResult.length !== 1 ? "s" : ""}.${resultSummary}`
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
