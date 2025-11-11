import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { Result } from "neverthrow"
import { err, ok } from "neverthrow"
import { config } from "../../../config"
import { executeWebReader } from "../../web-reader/shell/execute"
import { prepareLLMPrompt, truncateContent } from "../core/prepare"
import type { WebReaderSummaryError, WebReaderSummaryResponse } from "../core/types"
import { validateWebReaderSummaryParams } from "../core/validate"

/**
 * Configuration for Web Reader Summary (optional overrides)
 */
export interface WebReaderSummaryConfig {
  model?: string
  temperature?: number
  maxContentLength?: number
}

/**
 * Context for logging
 */
export interface WebReaderSummaryContext {
  logger?: {
    error: (msg: string, meta?: unknown) => void
    info: (msg: string, meta?: unknown) => void
  }
}

/**
 * Execute Web Reader Summary
 * Shell layer - orchestrates I/O operations
 *
 * Flow:
 * 1. Validate input parameters (call core)
 * 2. Fetch web content using web-reader (call shared slice)
 * 3. Prepare LLM prompt (call core)
 * 4. Call LLM to get answer (I/O)
 * 5. Return result
 */
export async function executeWebReaderSummary(
  params: unknown,
  options?: WebReaderSummaryConfig,
  context?: WebReaderSummaryContext,
): Promise<Result<WebReaderSummaryResponse, WebReaderSummaryError>> {
  const logger = context?.logger

  // Step 1: Validate parameters using core logic
  const validationResult = validateWebReaderSummaryParams(params)
  if (!validationResult.success) {
    const error: WebReaderSummaryError = {
      type: "VALIDATION_ERROR",
      message: "Invalid web reader summary parameters",
      details: validationResult.error,
    }
    logger?.error("Web Reader Summary validation failed", { error })
    return err(error)
  }

  const { url, query } = validationResult.data

  logger?.info("Starting Web Reader Summary", { url, query })

  // Step 2: Fetch web content using web-reader shared slice
  const webReaderResult = await executeWebReader(
    { url },
    undefined, // use default config
    context, // pass logging context
  )

  if (webReaderResult.isErr()) {
    const webReaderError = webReaderResult.error
    const error: WebReaderSummaryError = {
      type: "WEB_READER_ERROR",
      message: `Failed to fetch web content: ${webReaderError.message}`,
      cause: webReaderError,
    }
    logger?.error("Web Reader failed", { error })
    return err(error)
  }

  const content = webReaderResult.value

  logger?.info("Web content fetched successfully", {
    url,
    contentLength: content.length,
  })

  // Step 3: Prepare LLM prompt using core logic
  const maxContentLength = options?.maxContentLength ?? 50000
  const truncatedContent = truncateContent(content, maxContentLength)
  const prompt = prepareLLMPrompt(truncatedContent, query, url)

  logger?.info("LLM prompt prepared", {
    promptLength: prompt.length,
    contentTruncated: content.length > maxContentLength,
  })

  // Step 4: Call LLM to get answer (I/O operation)
  try {
    const openai = createOpenAI({ apiKey: config.openai.apiKey })
    const model = options?.model ?? "gpt-4o-mini"
    const temperature = options?.temperature ?? 0.3

    const { text } = await generateText({
      model: openai(model),
      prompt,
      temperature,
    })

    logger?.info("Web Reader Summary completed successfully", {
      url,
      query,
      answerLength: text.length,
    })

    // Step 5: Return result
    return ok(text)
  } catch (error) {
    const llmError: WebReaderSummaryError = {
      type: "LLM_ERROR",
      message: error instanceof Error ? error.message : "Unknown LLM error",
      cause: error,
    }
    logger?.error("LLM call failed", { error: llmError })
    return err(llmError)
  }
}
