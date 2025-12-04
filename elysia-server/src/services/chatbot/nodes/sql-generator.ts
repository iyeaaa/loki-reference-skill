import { ChatOpenAI } from "@langchain/openai"
import { chatbotLogger } from "../../../utils/logger"
import { getSQLGenerationPrompt } from "../prompts"
import type { ChatbotState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.1, // Low temperature for accurate, deterministic SQL generation
})

export async function generateSQL(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  // Emit node start event
  if (emitter) {
    emitter.nodeStart("generateSQL", "Finding the data you need...")
  }

  chatbotLogger.nodeStart("generateSQL")

  // Log input state
  chatbotLogger.nodeDetail("generateSQL", {
    question: state.currentQuestion,
    workspaceId: state.workspaceId,
    metadata: state.metadata,
    hasError: !!state.error,
  })

  let content: string | undefined

  try {
    // Check if CSV data is present
    const hasCSV = !!state.csvData && state.csvData.rowCount > 0

    const prompt = getSQLGenerationPrompt(
      state.currentQuestion,
      state.workspaceId,
      state.schemaContext,
      state.metadata || {},
      hasCSV ? state.csvData : undefined,
    )

    // Generate SQL using LLM (no intermediate progress events)
    const response = await llm.invoke(prompt)
    content = response.content as string

    // JSON 추출 시도 (더 robust한 패턴)
    const jsonMatch =
      content.match(/```json\n?([\s\S]*?)\n?```/) ||
      content.match(/```\n?(\{[\s\S]*?\})\n?```/) ||
      content.match(/(\{[\s\S]*?\})/)

    // JSON 형식인 경우
    if (jsonMatch?.[1]) {
      const jsonStr = jsonMatch[1].trim()
      chatbotLogger.info(
        `[SQL Generator] Attempting to parse JSON: ${jsonStr.substring(0, 200)}...`,
      )
      const result = JSON.parse(jsonStr)

      // queries 배열이 있는 경우 (복잡한 순차 실행)
      if (result.queries && Array.isArray(result.queries)) {
        const duration = Date.now() - startTime
        chatbotLogger.nodeSuccess("generateSQL (sequential)", duration)

        chatbotLogger.nodeDetail("generateSQL", {
          queryCount: result.queries.length,
          explanation: result.explanation,
        })
        chatbotLogger.info(
          `[LangGraph] Generated ${result.queries.length} sequential queries:\n${result.queries.map((q: string, i: number) => `${i + 1}. ${q.substring(0, 100)}...`).join("\n")}`,
        )

        // Emit node complete event with SQL metadata
        if (emitter) {
          emitter.nodeComplete("generateSQL", `Data ready (${result.queries.length} steps)`, {
            queryCount: result.queries.length,
            sql: result.queries[0],
            sqlExplanation: result.explanation,
          })
        }

        return {
          sqlQueries: result.queries,
          generatedSQL: result.queries[0], // 첫 번째 쿼리를 기본값으로
          sqlExplanation: result.explanation,
        }
      }

      // 단일 SQL (result.sql)이 있는 경우
      if (result.sql) {
        const duration = Date.now() - startTime
        chatbotLogger.nodeSuccess("generateSQL", duration)

        chatbotLogger.nodeDetail("generateSQL", {
          sqlLength: result.sql.length,
          explanation: result.explanation,
          estimatedRows: result.estimatedRows,
        })
        chatbotLogger.info(`[LangGraph] Generated SQL:\n${result.sql}`)

        // Emit node complete event with SQL metadata
        if (emitter) {
          emitter.nodeComplete("generateSQL", "Data ready", {
            sql: result.sql,
            sqlExplanation: result.explanation,
          })
        }

        return {
          generatedSQL: result.sql,
          sqlExplanation: result.explanation,
          sqlQueries: [], // 순차 쿼리 없음
        }
      }
    }

    // JSON 형식이 아닌 경우, 직접 SQL로 간주 (기존 호환성)
    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("generateSQL (raw)", duration)

    chatbotLogger.info(`[LangGraph] Generated raw SQL:\n${content}`)

    // Emit node complete event with SQL metadata
    if (emitter) {
      emitter.nodeComplete("generateSQL", "Data ready", {
        sql: content.trim(),
      })
    }

    return {
      generatedSQL: content.trim(),
      sqlExplanation: "SQL generated without explanation",
      sqlQueries: [],
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // More specific error message for JSON parsing errors
    let userFriendlyError = `An error occurred while fetching data: ${errorMessage}`
    if (errorMessage.includes("JSON") || errorMessage.includes("parse")) {
      userFriendlyError =
        "Unable to process your request. Please try rephrasing your question more specifically."

      // Log the actual response for debugging
      chatbotLogger.error(`[SQL Generator] JSON parsing failed. LLM response:\n${content}`)
    }

    chatbotLogger.nodeError("generateSQL", errorMessage, duration)

    // Emit error event
    if (emitter) {
      emitter.error("generateSQL", userFriendlyError)
    }

    return {
      error: userFriendlyError,
      generatedSQL: "",
      sqlExplanation: "",
      sqlQueries: [],
    }
  }
}
