/**
 * Hunter.io Query Generator Service
 *
 * Two-step LLM approach:
 * 1. GPT-4o: Generate initial query strategy from survey data
 * 2. gpt-5-mini: Structured extraction with Zod schema
 */

import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"
import {
  VALID_HUNTERIO_INDUSTRIES,
  type ValidHunterioIndustry,
} from "../constants/hunterio-industries"
import type { HunterioDiscoverParams } from "./hunterio-lead-search.service"

// Re-export for backwards compatibility
export {
  VALID_HUNTERIO_INDUSTRIES,
  type ValidHunterioIndustry,
} from "../constants/hunterio-industries"

// Step 1: GPT-5.2 for initial query generation
const generatorLLM = new ChatOpenAI({
  model: "gpt-5.2",
  reasoning: {
    effort: "medium",
  },
})

// Step 2: gpt-5-mini for structured extraction
// Note: gpt-5-mini does not support temperature, uses reasoning_effort instead
const extractorLLM = new ChatOpenAI({
  model: "gpt-5-mini",
  reasoning: {
    effort: "minimal",
  },
})

/**
 * Zod schema for Hunter.io Discover API parameters
 */
const HunterQueryOutputSchema = z.object({
  query: z.string().describe("Natural language search description for Hunter.io"),
  country_code: z.string().describe("ISO 3166-1 alpha-2 country code (e.g., US, KR, JP)"),
  industries: z
    .array(z.enum(VALID_HUNTERIO_INDUSTRIES))
    .describe("Industries to include - MUST be from the valid industries list"),
  headcount: z
    .array(z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000"]))
    .describe("Company size ranges to target (SMB focus, max 1000 employees)"),
  keywords: z.array(z.string()).describe("Relevant keywords to include"),
})

// Country code to ISO 3166-1 alpha-2 mapping
const COUNTRY_CODE_MAP: Record<string, string> = {
  us: "US",
  usa: "US",
  kr: "KR",
  korea: "KR",
  jp: "JP",
  japan: "JP",
  cn: "CN",
  china: "CN",
  de: "DE",
  germany: "DE",
  uk: "GB",
  gb: "GB",
  fr: "FR",
  france: "FR",
  ca: "CA",
  canada: "CA",
  au: "AU",
  australia: "AU",
  sg: "SG",
  singapore: "SG",
  in: "IN",
  india: "IN",
  br: "BR",
  brazil: "BR",
  mx: "MX",
  mexico: "MX",
}

export interface SurveyData {
  industry: string
  target: string
  country: string
  experience: string
}

/**
 * Generate Hunter.io Discover API parameters from survey data
 *
 * Two-step LLM approach:
 * 1. GPT-4o generates search strategy
 * 2. gpt-5-mini extracts structured params with Zod
 */
export async function generateHunterioQuery(
  surveyData: SurveyData,
): Promise<HunterioDiscoverParams> {
  console.log("[HunterioQueryGenerator] Generating query from survey data:", surveyData)
  const startTime = Date.now()

  try {
    // =============================================
    // STEP 1: GPT-4o - Generate search strategy
    // =============================================
    const strategyPrompt = `You are a B2B lead generation expert. Analyze the following survey data and describe the ideal Hunter.io search strategy.

Survey Data:
- Industry: ${surveyData.industry}
- Target Customer: ${surveyData.target}
- Country: ${surveyData.country}
- Experience Level: ${surveyData.experience}

Describe:
1. What natural language query would find these B2B prospects?
2. Which specific industries should we target?
3. What company sizes are appropriate (focus on SMBs, max 1000 employees)?
4. What keywords would help narrow down to ideal prospects?
5. What country/region should we search in?

Be specific and actionable. Focus on small to medium businesses.`

    console.log("[HunterioQueryGenerator] Step 1: Generating strategy with GPT-4o")
    const strategyResponse = await generatorLLM.invoke(strategyPrompt)
    const strategy = strategyResponse.content as string

    console.log("[HunterioQueryGenerator] Strategy generated:", `${strategy.substring(0, 200)}...`)

    // =============================================
    // STEP 2: gpt-5-mini - Structured extraction
    // =============================================
    const structuredLLM = extractorLLM.withStructuredOutput(HunterQueryOutputSchema)

    const extractionPrompt = `Based on this B2B lead search strategy, extract structured Hunter.io API parameters.

Strategy:
${strategy}

Original Survey Data:
- Industry: ${surveyData.industry}
- Target: ${surveyData.target}
- Country: ${surveyData.country}

CRITICAL: You MUST select industries ONLY from this valid Hunter.io industries list:
${VALID_HUNTERIO_INDUSTRIES.join(", ")}

Rules:
- Map country to ISO 3166-1 alpha-2 code (e.g., US, KR, JP, DE, GB)
- Only include headcount ranges up to "501-1000" (SMB focus)
- Generate 2-5 relevant keywords
- Keep industry list to 2-3 max
- Industries MUST be exact matches from the valid list above`

    console.log("[HunterioQueryGenerator] Step 2: Extracting structured params with gpt-5-mini")
    const extracted = await structuredLLM.invoke(extractionPrompt)

    // Transform simplified schema to Hunter.io API format
    const result: HunterioDiscoverParams = {
      query: extracted.query,
      headquarters_location: {
        include: [{ country: extracted.country_code }],
      },
      industry: {
        include: extracted.industries,
      },
      headcount: extracted.headcount,
      keywords: {
        include: extracted.keywords,
        match: "all",
      },
      limit: 100,
      offset: 0,
    }

    const duration = Date.now() - startTime
    console.log(`[HunterioQueryGenerator] Generated params in ${duration}ms:`, result)

    return result
  } catch (error) {
    console.error("[HunterioQueryGenerator] Error generating query:", error)
    return buildFallbackParams(surveyData)
  }
}

/**
 * Find matching valid Hunter.io industries from survey input
 */
export function findMatchingIndustries(surveyIndustry: string): ValidHunterioIndustry[] {
  const input = surveyIndustry.toLowerCase()

  // Find industries that contain the input term or vice versa
  const matches = VALID_HUNTERIO_INDUSTRIES.filter((industry) => {
    const industryLower = industry.toLowerCase()
    const firstWord = industryLower.split(" ")[0] ?? ""
    return industryLower.includes(input) || input.includes(firstWord)
  })

  // Return up to 3 matches, or a general fallback
  if (matches.length > 0) {
    return matches.slice(0, 3) as ValidHunterioIndustry[]
  }

  // Fallback to general categories based on common terms
  if (input.includes("tech") || input.includes("software") || input.includes("it")) {
    return [
      "Software Development",
      "IT Services and IT Consulting",
      "Technology, Information and Internet",
    ]
  }
  if (input.includes("health") || input.includes("medical")) {
    return ["Hospitals and Health Care", "Medical Practices", "Medical Equipment Manufacturing"]
  }
  if (input.includes("financ") || input.includes("bank")) {
    return ["Financial Services", "Banking", "Investment Management"]
  }
  if (input.includes("retail") || input.includes("commerce")) {
    return ["Retail", "Online and Mail Order Retail"]
  }
  if (input.includes("manufactur")) {
    return ["Manufacturing", "Machinery Manufacturing"]
  }
  if (input.includes("consult")) {
    return ["Business Consulting and Services", "Professional Services"]
  }
  if (input.includes("market") || input.includes("advertis")) {
    return ["Marketing Services", "Advertising Services"]
  }
  if (input.includes("educat") || input.includes("learning")) {
    return ["Education", "E-Learning Providers", "Higher Education"]
  }

  // Ultimate fallback - use Professional Services as it's broad
  return ["Professional Services"]
}

/**
 * Build fallback parameters when LLM fails
 */
function buildFallbackParams(surveyData: SurveyData): HunterioDiscoverParams {
  console.log("[HunterioQueryGenerator] Using fallback params for:", surveyData)

  // Map country
  const countryCode =
    COUNTRY_CODE_MAP[surveyData.country.toLowerCase()] || surveyData.country.toUpperCase()

  // Find matching valid industries
  const industries = findMatchingIndustries(surveyData.industry)

  return {
    query: `${surveyData.target} in ${surveyData.industry} sector`,
    headquarters_location: {
      include: [{ country: countryCode }],
    },
    industry: {
      include: industries,
    },
    headcount: ["1-10", "11-50", "51-200", "201-500", "501-1000"],
    limit: 100,
    offset: 0,
  }
}
