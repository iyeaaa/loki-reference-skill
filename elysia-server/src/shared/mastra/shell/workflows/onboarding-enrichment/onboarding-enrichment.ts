import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import { onboardingResearchAgent } from "../../agents/onboarding-research-agent"
import { structuredExtractionAgent } from "../../agents/structured-extraction-agent"

// Event emitter for streaming workflow progress
export type WorkflowProgressCallback = (step: string, message: string, data?: unknown) => void

// Global streaming context - stores active streaming callbacks by runId
const workflowProgressCallbacks = new Map<string, WorkflowProgressCallback>()

// Current active streaming runId (for steps that can't access workflow input directly)
let currentStreamingRunId: string | null = null

export function registerWorkflowProgressCallback(
  runId: string,
  callback: WorkflowProgressCallback,
) {
  workflowProgressCallbacks.set(runId, callback)
  currentStreamingRunId = runId
}

export function unregisterWorkflowProgressCallback(runId: string) {
  workflowProgressCallbacks.delete(runId)
  if (currentStreamingRunId === runId) {
    currentStreamingRunId = null
  }
}

function emitProgress(step: string, message: string, data?: unknown) {
  if (!currentStreamingRunId) return
  const callback = workflowProgressCallbacks.get(currentStreamingRunId)
  if (callback) {
    callback(step, message, data)
  }
}

const CompanySchemaInternal = z
  .object({
    name: z.string().describe("Name of the company"),
    description: z.string().describe("Detailed description of the company"),
    industries: z.array(z.string()).describe("Industry or sector"),
    location: z.string().describe("Geographic location or headquarters"),
    size: z.string().describe("Number of employees or company size"),
    foundedYear: z.string().describe("Founding year of the company"),
    website: z.string().describe("Company website URL"),
    logo: z.string().describe("URL to company logo image"),
  })
  .strict()
  .describe("Company information")

const ProductSchemaInternal = z
  .object({
    name: z.string().describe("Name of the product"),
    category: z.string().describe("Product category"),
    description: z.string().describe("Detailed description of the product"),
    features: z.array(z.string()).describe("List of product features"),
    priceRange: z.string().describe("Price range of the product"),
    targetAudience: z.string().describe("Target audience for the product"),
    image: z.string().describe("URL to product image"),
  })
  .strict()

const BusinessInternalSchema = z
  .object({
    targetMarkets: z.array(z.string()).describe("Target markets or regions for the business"),
    expansionGoals: z.array(z.string()).describe("Future expansion goals and plans"),
    keywords: z.array(z.string()).describe("Keywords relevant to the business"),
    competitiveAdvantages: z.array(z.string()).describe("Competitive advantages of the business"),
  })
  .strict()
  .describe("Business strategy and market information")

export const BusinessAndMarketSchema = z
  .object({
    business: BusinessInternalSchema,
  })
  .strict()

export type BusinessAndMarket = z.infer<typeof BusinessAndMarketSchema>

export const CompanyAndProductSchema = z
  .object({
    company: CompanySchemaInternal,
    products: z.array(ProductSchemaInternal).describe("Array of product information"),
  })
  .strict()

export const OnboardingEnrichmentOutputSchema = z
  .object({
    companyAndProducts: CompanyAndProductSchema,
    business: BusinessAndMarketSchema,
    rawOutput: z.string(),
  })
  .strict()

export type OnboardingEnrichmentOutput = z.infer<typeof OnboardingEnrichmentOutputSchema>

const researchAgentStep = createStep({
  id: "onboarding-research-agent-step",
  description: "Find company and product information",
  inputSchema: z.object({
    companyUrl: z.string(),
    stream: z.boolean().default(false),
  }),
  outputSchema: z.string(),
  execute: async ({ inputData }) => {
    const { companyUrl } = inputData

    emitProgress("researching", "Researching company information...")

    try {
      const response = await onboardingResearchAgent.generate([
        {
          role: "user",
          content: `Research company and product information for this company ${companyUrl}. 
Ensure accuracy, and investigate thoroughly.
Language is 'en': English.
Report should be in (ISO 639-1)`,
        },
      ])

      emitProgress("researching_complete", "Company research completed", {
        length: response.text.length,
      })

      return response.text
    } catch (error) {
      console.error("[RESEARCH STEP ERROR]", error)
      throw error
    }
  },
})

const companyAndProductExtractionStep = createStep({
  id: "company-and-product-extraction-step",
  description: "Extracts company and product information from the research output",
  inputSchema: z.string(),
  outputSchema: CompanyAndProductSchema,
  execute: async ({ inputData }) => {
    emitProgress("extracting_company", "Extracting company and product information...")

    try {
      const res = await structuredExtractionAgent.generate(
        [
          {
            role: "user",
            content: `Here's the data: ${inputData}
Extract company and product information from this data in (ISO 639-1), make sure to return all schema values as empty values if they are not in the data.`,
          },
        ],
        {
          output: CompanyAndProductSchema,
        },
      )

      emitProgress("extracting_company_complete", "Company and product extraction completed", {
        companyName: res.object.company.name,
        productsCount: res.object.products.length,
      })

      return res.object
    } catch (error) {
      console.error("[COMPANY EXTRACTION STEP ERROR]", error)
      throw error
    }
  },
})

const businessAndMarketExtractionStep = createStep({
  id: "business-and-market-extraction-step",
  description: "Extracts business and market information from the research output",
  inputSchema: z.string(),
  outputSchema: BusinessAndMarketSchema,
  execute: async ({ inputData }) => {
    emitProgress("extracting_market", "Extracting business and market information...")

    try {
      const res = await structuredExtractionAgent.generate(
        [
          {
            role: "user",
            content: `Here's the data: ${inputData}
Extract business and market information from this data in (ISO 639-1), make sure to return all schema values as empty values if they are not in the data.`,
          },
        ],
        {
          output: BusinessAndMarketSchema,
        },
      )

      emitProgress("extracting_market_complete", "Business and market extraction completed", {
        targetMarketsCount: res.object.business.targetMarkets.length,
        expansionGoalsCount: res.object.business.expansionGoals.length,
      })

      return res.object
    } catch (error) {
      console.error("[MARKET EXTRACTION STEP ERROR]", error)
      throw error
    }
  },
})

const mergeDataStep = createStep({
  id: "merge-data-step",
  description: "Merges company and product information with business and market information",
  inputSchema: z.object({
    "company-and-product-extraction-step": CompanyAndProductSchema,
    "business-and-market-extraction-step": BusinessAndMarketSchema,
  }),
  outputSchema: OnboardingEnrichmentOutputSchema,
  execute: async ({ inputData, getStepResult }) => {
    emitProgress("merging", "Merging extracted data...")

    const companyAndProducts = inputData["company-and-product-extraction-step"]
    const businessAndMarket = inputData["business-and-market-extraction-step"]
    const rawOutput = getStepResult(researchAgentStep)

    emitProgress("merging_complete", "Data merge completed")

    return {
      business: businessAndMarket,
      companyAndProducts: companyAndProducts,
      rawOutput: rawOutput,
    }
  },
})

export const onboardingEnrichmentWorkflow = createWorkflow({
  id: "onboarding-enrichment-workflow",
  inputSchema: z.object({
    companyUrl: z.string(),
    stream: z.boolean().default(false),
  }),
  outputSchema: OnboardingEnrichmentOutputSchema,
})
  .then(researchAgentStep)
  .parallel([companyAndProductExtractionStep, businessAndMarketExtractionStep])
  .then(mergeDataStep)
  .commit()
