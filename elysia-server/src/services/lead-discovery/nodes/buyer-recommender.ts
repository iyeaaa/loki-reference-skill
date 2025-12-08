/**
 * Buyer Recommender Node
 * Generates 3 buyer country/industry recommendations based on website analysis
 */

import { Command, interrupt } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"
import { v4 as uuidv4 } from "uuid"
import { leadDiscoveryLogger } from "../logger"
import type { BuyerRecommendation, LeadDiscoveryState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.5, // Some creativity for diverse recommendations
})

// Available industries in BigQuery
const AVAILABLE_INDUSTRIES = [
  "Business Services",
  "Software & Internet",
  "Healthcare",
  "Financial Services",
  "Manufacturing",
  "Retail",
  "Food & Beverage",
  "Real Estate & Construction",
  "Education",
  "Media & Entertainment",
  "Telecommunications",
  "Transportation & Storage",
  "Agriculture & Mining",
  "Computers & Electronics",
  "Government",
]

// Available countries
const AVAILABLE_COUNTRIES = ["USA", "Canada"]

// Generate buyer recommendations based on website analysis
async function generateRecommendations(
  analysis: {
    companyName?: string
    description?: string
    industry?: string
    products?: string[]
    targetMarkets?: string[]
    businessModel?: string
    strengths?: string[]
  },
  userInput: string,
): Promise<BuyerRecommendation[]> {
  const prompt = `Based on the following company analysis, recommend 3 potential buyer segments that would be interested in this company's products/services.

## Company Information:
- Name: ${analysis.companyName || "Unknown"}
- Description: ${analysis.description || "N/A"}
- Industry: ${analysis.industry || "N/A"}
- Products/Services: ${analysis.products?.join(", ") || "N/A"}
- Target Markets: ${analysis.targetMarkets?.join(", ") || "N/A"}
- Business Model: ${analysis.businessModel || "N/A"}
- Strengths: ${analysis.strengths?.join(", ") || "N/A"}

## User's Original Query:
"${userInput}"

## Available Options:
Countries: ${AVAILABLE_COUNTRIES.join(", ")}
Industries: ${AVAILABLE_INDUSTRIES.join(", ")}

## Task:
Generate exactly 3 diverse buyer recommendations. Each should target different market segments.

## Response Format (JSON array):
[
  {
    "country": "USA or Canada",
    "industry": "One of the available industries",
    "subIndustry": "Specific sub-industry if applicable (optional)",
    "reasoning": "Why this segment would be interested (2-3 sentences in Korean)",
    "estimatedLeadCount": "Estimated number of potential leads (rough number)",
    "keywords": ["relevant", "search", "keywords"]
  }
]

Rules:
- Provide exactly 3 recommendations
- Each recommendation should target a different industry or market angle
- Use only available countries and industries
- Write reasoning in Korean
- Be specific about why each segment would be interested
- Respond with JSON array only, no markdown

JSON:`

  const response = await llm.invoke(prompt)
  const responseText = (response.content as string).trim()

  // Parse JSON array from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])

    return parsed.map(
      (rec: {
        country: string
        industry: string
        subIndustry?: string
        reasoning: string
        estimatedLeadCount?: number
        keywords?: string[]
      }) => ({
        id: uuidv4(),
        country: rec.country,
        industry: rec.industry,
        subIndustry: rec.subIndustry,
        reasoning: rec.reasoning,
        estimatedLeadCount: rec.estimatedLeadCount,
        keywords: rec.keywords,
      }),
    )
  }

  // Fallback recommendations if parsing fails
  return [
    {
      id: uuidv4(),
      country: "USA",
      industry: "Business Services",
      reasoning: "일반적인 비즈니스 서비스 산업은 다양한 제품과 서비스에 관심을 가질 수 있습니다.",
      estimatedLeadCount: 500,
    },
    {
      id: uuidv4(),
      country: "USA",
      industry: "Software & Internet",
      reasoning: "소프트웨어 및 인터넷 기업들은 혁신적인 솔루션을 찾는 경향이 있습니다.",
      estimatedLeadCount: 300,
    },
    {
      id: uuidv4(),
      country: "Canada",
      industry: "Manufacturing",
      reasoning: "캐나다 제조업체들은 새로운 공급업체와 파트너십을 모색하고 있습니다.",
      estimatedLeadCount: 200,
    },
  ]
}

export async function recommendBuyers(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState> | Command> {
  const startTime = Date.now()
  const emitter = state._emitter

  leadDiscoveryLogger.nodeStart("recommendBuyers", {
    hasAnalysis: !!state.websiteAnalysis,
    companyName: state.websiteAnalysis?.companyName,
  })

  if (emitter) {
    emitter.nodeStart("recommendBuyers", "Generating buyer recommendations...")
  }

  try {
    // Check if we already have a selected recommendation (resuming from interrupt)
    if (state.selectedRecommendation) {
      leadDiscoveryLogger.info("Resuming with already selected recommendation")
      const duration = Date.now() - startTime
      leadDiscoveryLogger.nodeSuccess("recommendBuyers", duration, {
        status: "resumed_with_selection",
      })
      return {} // Continue to next node
    }

    // Generate recommendations based on website analysis
    const analysis = state.websiteAnalysis || {}
    const recommendations = await generateRecommendations(analysis, state.userInput)

    leadDiscoveryLogger.recommendationsGenerated(
      recommendations.length,
      recommendations.map((r) => ({ country: r.country, industry: r.industry })),
    )

    if (emitter) {
      emitter.progress("recommendBuyers", "Recommendations generated", 80, {
        count: recommendations.length,
      })
    }

    // Use interrupt for Human-in-the-Loop selection
    leadDiscoveryLogger.waitingForUserSelection(
      recommendations.map((r) => `${r.country} / ${r.industry}`),
    )

    // Store recommendations in state before interrupt
    const stateUpdate: Partial<LeadDiscoveryState> = {
      buyerRecommendations: recommendations,
      needsUserSelection: true,
    }

    // Emit recommendations to client
    if (emitter) {
      emitter.nodeComplete("recommendBuyers", "Select a buyer segment", {
        recommendations: recommendations.map((r) => ({
          id: r.id,
          country: r.country,
          industry: r.industry,
          subIndustry: r.subIndustry,
          reasoning: r.reasoning,
          estimatedLeadCount: r.estimatedLeadCount,
        })),
        requiresSelection: true,
      })
    }

    // Interrupt and wait for user selection
    // The interrupt payload will be sent to the client
    const userSelection = interrupt({
      type: "buyer_selection_required",
      message: "Please select a buyer segment to search",
      recommendations: recommendations.map((r) => ({
        id: r.id,
        country: r.country,
        industry: r.industry,
        subIndustry: r.subIndustry,
        reasoning: r.reasoning,
        estimatedLeadCount: r.estimatedLeadCount,
      })),
    })

    const duration = Date.now() - startTime

    // Process user selection
    if (userSelection && typeof userSelection === "object") {
      const selection = userSelection as { selectedId?: string; confirmed?: boolean }

      if (selection.selectedId) {
        const selected = recommendations.find((r) => r.id === selection.selectedId)

        if (selected) {
          leadDiscoveryLogger.recommendationSelected({
            country: selected.country,
            industry: selected.industry,
            reasoning: selected.reasoning,
          })

          leadDiscoveryLogger.nodeSuccess("recommendBuyers", duration, {
            selectedCountry: selected.country,
            selectedIndustry: selected.industry,
          })

          return {
            ...stateUpdate,
            selectedRecommendation: selected,
            needsUserSelection: false,
            isConfirmed: true,
          }
        }
      }
    }

    // User cancelled or invalid selection
    leadDiscoveryLogger.warn("User cancelled selection or invalid selection received")
    return new Command({
      goto: "handleError",
      update: {
        error: "Selection cancelled by user",
        buyerRecommendations: recommendations,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    leadDiscoveryLogger.nodeError("recommendBuyers", errorMessage, duration)

    if (emitter) {
      emitter.error("recommendBuyers", errorMessage)
    }

    return {
      error: `Failed to generate recommendations: ${errorMessage}`,
    }
  }
}
