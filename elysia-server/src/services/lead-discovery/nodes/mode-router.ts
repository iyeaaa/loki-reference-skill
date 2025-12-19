/**
 * Mode Router Node
 * Detects whether user input is for basic (website) or advanced (detailed search) mode
 */

import { ChatOpenAI } from "@langchain/openai"
import { createErrorContext } from "../error-classifier"
import { leadDiscoveryLogger } from "../logger"
import type { LeadDiscoveryState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
})

// URL detection regex
const URL_PATTERN = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i
const DOMAIN_PATTERN = /^[\da-z][\da-z.-]*\.[a-z]{2,}$/i

// Detect if input contains a website URL
function detectWebsiteUrl(input: string): string | null {
  const trimmed = input.trim()

  // Check if entire input is a URL
  if (URL_PATTERN.test(trimmed) || DOMAIN_PATTERN.test(trimmed)) {
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
  }

  // Extract URL from text
  const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/i)
  if (urlMatch?.[1]) {
    return urlMatch[1]
  }

  // Extract domain from text
  const domainMatch = trimmed.match(/([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}/i)
  if (domainMatch?.[0]) {
    return `https://${domainMatch[0]}`
  }

  return null
}

// Analyze input to determine mode using LLM
async function analyzeInputMode(
  input: string,
  hasUrl: boolean,
): Promise<{
  mode: "basic" | "advanced"
  confidence: number
  indicators: string[]
  extractedCriteria?: {
    country?: string
    industry?: string
    employeeRange?: string
    revenueRange?: string
  }
}> {
  const prompt = `Analyze the following user input and determine the search mode.

User Input: "${input}"
Contains URL: ${hasUrl}

## Mode Definitions:

### BASIC MODE (Website Analysis):
- User provides a company website URL
- User wants to analyze a specific company
- User wants to find similar companies/buyers based on a website
- Examples: "apple.com", "https://tesla.com", "analyze this website: google.com"

### ADVANCED MODE (Direct Search):
- User specifies search criteria directly (country, industry, company size, etc.)
- User asks for leads without providing a website
- User specifies buyer characteristics
- Examples:
  - "Find healthcare companies in USA"
  - "Show me 100 software companies with 1000+ employees"
  - "Search for manufacturing companies in Canada"
  - "Find potential buyers in the automotive industry"

## Response Format (JSON only):
{
  "mode": "basic" | "advanced",
  "confidence": 0-100,
  "indicators": ["reason1", "reason2", ...],
  "extractedCriteria": {
    "country": "extracted country or null",
    "industry": "extracted industry or null",
    "employeeRange": "extracted employee range or null",
    "revenueRange": "extracted revenue range or null"
  }
}

Respond with JSON only, no markdown.`

  try {
    const response = await llm.invoke(prompt)
    const content = (response.content as string).trim()

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    // Fallback: if has URL, assume basic mode
    return {
      mode: hasUrl ? "basic" : "advanced",
      confidence: 60,
      indicators: ["fallback detection"],
    }
  } catch (error) {
    leadDiscoveryLogger.warn(`Mode analysis LLM failed: ${error}`)
    return {
      mode: hasUrl ? "basic" : "advanced",
      confidence: 50,
      indicators: ["LLM fallback - URL detection only"],
    }
  }
}

export async function routeMode(state: LeadDiscoveryState): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  // 상세 로그: 입력 분석 시작
  leadDiscoveryLogger.info(`[입력 분석] 시작 - 입력: "${state.userInput}"`)
  leadDiscoveryLogger.nodeStart("routeMode", {
    userInput: state.userInput,
    sessionId: state.sessionId,
  })

  if (emitter) {
    emitter.nodeStart("routeMode", "입력하신 내용을 분석하고 있어요")
  }

  try {
    // Step 1: URL 감지
    const detectedUrl = detectWebsiteUrl(state.userInput)
    const hasUrl = !!detectedUrl

    leadDiscoveryLogger.info(`[입력 분석] URL 감지 결과: ${hasUrl ? detectedUrl : "URL 없음"}`)

    // Thinking: URL 감지 결과
    if (emitter) {
      const urlThought = hasUrl
        ? `입력된 내용에서 웹사이트 URL을 발견했어요: ${detectedUrl}\n\n이 웹사이트를 분석해서 적합한 바이어를 찾아볼게요.`
        : `입력된 내용에서 웹사이트 URL이 발견되지 않았어요.\n\n검색 조건을 분석해서 직접 바이어를 검색할게요.`

      emitter.thinking("routeMode", {
        summary: hasUrl
          ? `${detectedUrl} 웹사이트를 분석할 준비를 하고 있어요`
          : "입력된 검색 조건을 분석하고 있어요",
        detail: urlThought,
        isStreaming: true,
      })
    }

    if (emitter && hasUrl) {
      emitter.progress("routeMode", `${detectedUrl} 웹사이트를 발견했어요`, 30)
    }

    // Step 2: LLM으로 입력 모드 분석
    leadDiscoveryLogger.info(`[입력 분석] AI로 검색 모드 판별 중`)
    if (emitter) {
      emitter.progress("routeMode", "검색 방식을 결정하고 있어요", 60)
    }

    const analysis = await analyzeInputMode(state.userInput, hasUrl)

    // 분석 결과 상세 로그
    leadDiscoveryLogger.info(`[입력 분석] 모드 판별 완료:`)
    leadDiscoveryLogger.info(
      `  - 모드: ${analysis.mode === "basic" ? "웹사이트 분석" : "고급 검색"}`,
    )
    leadDiscoveryLogger.info(`  - 신뢰도: ${analysis.confidence}%`)
    leadDiscoveryLogger.info(`  - 판별 근거: ${analysis.indicators.join(", ")}`)

    leadDiscoveryLogger.modeDetected(analysis.mode, analysis.confidence, analysis.indicators)

    const duration = Date.now() - startTime

    // Thinking 완료: 분석 결과 설명
    if (emitter) {
      const modeExplanation =
        analysis.mode === "basic"
          ? `웹사이트 분석 모드로 진행할게요.\n\n**판별 근거:**\n${analysis.indicators.map((i) => `- ${i}`).join("\n")}\n\n**신뢰도:** ${analysis.confidence}%`
          : `고급 검색 모드로 진행할게요.\n\n**판별 근거:**\n${analysis.indicators.map((i) => `- ${i}`).join("\n")}\n\n**신뢰도:** ${analysis.confidence}%`

      emitter.thinking("routeMode", {
        summary:
          analysis.mode === "basic"
            ? "웹사이트를 분석해서 바이어를 찾을게요"
            : "검색 조건으로 바이어를 직접 찾을게요",
        detail: modeExplanation,
        isStreaming: false,
      })
    }

    // Emit progress (토스 스타일)
    if (emitter) {
      const modeText = analysis.mode === "basic" ? "웹사이트 분석 모드" : "고급 검색 모드"
      emitter.nodeComplete("routeMode", `${modeText}로 진행할게요`, {
        mode: analysis.mode,
        confidence: analysis.confidence,
        websiteUrl: detectedUrl,
      })
    }

    leadDiscoveryLogger.info(
      `[입력 분석] 완료 - 모드: ${analysis.mode}, 소요시간: ${(duration / 1000).toFixed(1)}초`,
    )
    leadDiscoveryLogger.nodeSuccess("routeMode", duration, {
      mode: analysis.mode,
      confidence: analysis.confidence,
      hasUrl,
    })

    // Return state updates
    if (analysis.mode === "basic" && detectedUrl) {
      return {
        searchMode: "basic",
        isWebsiteMode: true,
        websiteUrl: detectedUrl,
        analysisStatus: "웹사이트를 분석할게요",
      }
    }

    // Advanced mode - may have extracted criteria
    if (analysis.extractedCriteria) {
      leadDiscoveryLogger.info(`[입력 분석] 추출된 검색 조건:`)
      leadDiscoveryLogger.info(`  - 국가: ${analysis.extractedCriteria.country || "(없음)"}`)
      leadDiscoveryLogger.info(`  - 산업: ${analysis.extractedCriteria.industry || "(없음)"}`)
      leadDiscoveryLogger.info(
        `  - 직원수: ${analysis.extractedCriteria.employeeRange || "(없음)"}`,
      )
    }

    return {
      searchMode: "advanced",
      isWebsiteMode: false,
      bigQueryParams: analysis.extractedCriteria
        ? {
            query: state.userInput,
            country: analysis.extractedCriteria.country,
            industry: analysis.extractedCriteria.industry,
            employeeRange: analysis.extractedCriteria.employeeRange,
            revenueRange: analysis.extractedCriteria.revenueRange,
          }
        : {
            query: state.userInput,
          },
      analysisStatus: "검색 조건을 생성하고 있어요",
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // 구조화된 에러 컨텍스트 생성
    const errorContext = createErrorContext(error, "routeMode", {
      sessionId: state.sessionId,
      retryCount: state.retryCount,
      details: {
        userInput: state.userInput,
        executionTimeMs: duration,
      },
    })

    leadDiscoveryLogger.error(`[입력 분석] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.nodeError("routeMode", errorMessage, duration)

    if (emitter) {
      emitter.error("routeMode", `입력 분석 중 문제가 발생했어요: ${errorMessage}`)
    }

    return {
      error: errorContext.message,
      errorContext,
      searchMode: "advanced", // Fallback to advanced mode
      isWebsiteMode: false,
    }
  }
}
