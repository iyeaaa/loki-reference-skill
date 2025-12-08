/**
 * Mode Router Node
 * Detects whether user input is for basic (website) or advanced (detailed search) mode
 */

import { ChatOpenAI } from "@langchain/openai"
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

  leadDiscoveryLogger.nodeStart("routeMode", {
    userInput: state.userInput,
    sessionId: state.sessionId,
  })

  if (emitter) {
    emitter.nodeStart("routeMode", "Analyzing search mode...")
  }

  try {
    // Step 1: Detect URL in input
    const detectedUrl = detectWebsiteUrl(state.userInput)
    const hasUrl = !!detectedUrl

    leadDiscoveryLogger.debug(`URL detection: ${hasUrl ? detectedUrl : "none"}`)

    // Step 2: Analyze input mode using LLM
    const analysis = await analyzeInputMode(state.userInput, hasUrl)

    leadDiscoveryLogger.modeDetected(analysis.mode, analysis.confidence, analysis.indicators)

    const duration = Date.now() - startTime

    // Emit progress
    if (emitter) {
      emitter.nodeComplete("routeMode", `Mode: ${analysis.mode.toUpperCase()}`, {
        mode: analysis.mode,
        confidence: analysis.confidence,
        websiteUrl: detectedUrl,
      })
    }

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
        analysisStatus: "Website detected, starting analysis...",
      }
    }

    // Advanced mode - may have extracted criteria
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
      analysisStatus: "Direct search mode, generating parameters...",
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    leadDiscoveryLogger.nodeError("routeMode", errorMessage, duration)

    if (emitter) {
      emitter.error("routeMode", errorMessage)
    }

    return {
      error: `Mode detection failed: ${errorMessage}`,
      searchMode: "advanced", // Fallback to advanced mode
      isWebsiteMode: false,
    }
  }
}
