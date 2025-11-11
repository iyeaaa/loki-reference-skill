import { createOpenAI } from "@ai-sdk/openai"
import { createStep, createWorkflow } from "@mastra/core/workflows"
import { generateObject } from "ai"
import { z } from "zod"
import { config } from "../../../../config"
import { CompanyInfoSchema } from "./web-search/types"

/**
 * Web Company Enrichment Single Workflow
 * Enriches a single company object by filling in missing fields using web research
 *
 * Flow:
 * 1. Identify missing fields
 * 2. Research missing fields using research agent
 * 3. Extract structured data from research results
 * 4. Return enriched company object
 */

type CompanyInfo = z.infer<typeof CompanyInfoSchema>

/**
 * Step 1: Identify missing fields in company object
 */
const identifyMissingFieldsStep = createStep({
  id: "identify-missing-fields",
  description: "Identify which fields are missing or null in company object",
  inputSchema: z.object({
    company: CompanyInfoSchema,
  }),
  outputSchema: z.object({
    company: CompanyInfoSchema,
    missingFields: z.array(z.string()),
    needsEnrichment: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { company } = inputData

    console.log("🔍 Web Company Enrichment (Single)")
    console.log(`Company: "${company.name}"`)
    console.log(`Source: ${company.source}\n`)

    const missingFields: string[] = []
    if (!company.email) missingFields.push("email")
    if (!company.foundedYear) missingFields.push("founded year")
    if (!company.website) missingFields.push("website")
    if (!company.location) missingFields.push("location")

    const needsEnrichment = missingFields.length > 0

    if (!needsEnrichment) {
      console.log("✅ No missing fields - enrichment not needed\n")
    } else {
      console.log(`📋 Missing fields: ${missingFields.join(", ")}\n`)
    }

    return {
      company,
      missingFields,
      needsEnrichment,
    }
  },
})

/**
 * Step 2: Research missing fields using research agent
 */
const researchMissingFieldsStep = createStep({
  id: "research-missing-fields",
  description: "Use research agent to find missing company information",
  inputSchema: z.object({
    company: CompanyInfoSchema,
    missingFields: z.array(z.string()),
    needsEnrichment: z.boolean(),
  }),
  outputSchema: z.object({
    company: CompanyInfoSchema,
    researchData: z.string(),
    missingFields: z.array(z.string()),
    researchSuccess: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { company, missingFields, needsEnrichment } = inputData

    // Skip research if no enrichment needed
    if (!needsEnrichment) {
      return {
        company,
        researchData: "",
        missingFields: [],
        researchSuccess: true,
      }
    }

    console.log("🔬 Researching missing fields...\n")

    try {
      // Get the research agent from Mastra instance
      const researchAgent = mastra.getAgent("researchAgent")

      if (!researchAgent) {
        console.error("❌ Research agent not found\n")
        return {
          company,
          researchData: "",
          missingFields,
          researchSuccess: false,
        }
      }

      // Build context about the company
      const companyContext = `
Company Name: ${company.name}
${company.website ? `Website: ${company.website}` : ""}
${company.location ? `Location: ${company.location}` : ""}
${company.email ? `Email: ${company.email}` : ""}
${company.foundedYear ? `Founded: ${company.foundedYear}` : ""}
Source: ${company.source}
`.trim()

      // Build research query
      const researchQuery = `Find the ${missingFields.join(", ")} for this company. Be specific and provide only factual information with sources.`

      // Construct the research prompt
      const researchPrompt = `
${companyContext}

Task: ${researchQuery}

Please use web search to find the missing information about this company.
Return the information in a clear, structured format with each field labeled.
Include source URLs where you found the information.
If you cannot find certain information, explicitly state that it's not available.
`

      // Call the research agent
      const response = await researchAgent.generate(researchPrompt, {
        maxSteps: 5, // Allow multiple tool calls for thorough research
      })

      const researchData = response.text

      console.log("✅ Research completed\n")

      return {
        company,
        researchData,
        missingFields,
        researchSuccess: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`❌ Research failed: ${errorMessage}\n`)

      return {
        company,
        researchData: "",
        missingFields,
        researchSuccess: false,
      }
    }
  },
})

/**
 * Step 3: Extract structured data from research results
 */
const extractStructuredDataStep = createStep({
  id: "extract-structured-data",
  description: "Extract structured company data from research results using AI",
  inputSchema: z.object({
    company: CompanyInfoSchema,
    researchData: z.string(),
    missingFields: z.array(z.string()),
    researchSuccess: z.boolean(),
  }),
  outputSchema: z.object({
    enrichedCompany: CompanyInfoSchema,
    fieldsEnriched: z.array(z.string()),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { company, researchData, missingFields, researchSuccess } = inputData

    // If research failed or no enrichment needed, return original company
    if (!researchSuccess || !researchData) {
      return {
        enrichedCompany: company,
        fieldsEnriched: [],
        success: missingFields.length === 0,
      }
    }

    console.log("📊 Extracting structured data...\n")

    try {
      const openai = createOpenAI({ apiKey: config.openai.apiKey })

      // Use AI to extract structured data from research results
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: z.object({
          name: z.string(),
          website: z.string().optional().nullable(),
          email: z.string().optional().nullable(),
          foundedYear: z.number().optional().nullable(),
          location: z.string().optional().nullable(),
        }),
        prompt: `
Original Company Data:
${JSON.stringify(company, null, 2)}

Research Results:
${researchData}

Extract and return the company information in structured format.
- Keep existing non-null fields from the original data unchanged
- Only fill in fields that were null/missing if you found them in the research
- Set fields to null if not found in research
- For foundedYear, extract only the 4-digit year as a number
- For website, include the full URL with protocol (https://)
- For email, extract a valid email address
- For location, use format: "City, State/Province, Country" when possible

Return the complete company object with enriched data.
`,
        temperature: 0.2,
      })

      // Build enriched company object, preserving original values where new data is null
      const enrichedCompany: CompanyInfo = {
        name: object.name || company.name,
        website: object.website ?? company.website,
        email: object.email ?? company.email,
        foundedYear: object.foundedYear ?? company.foundedYear,
        location: object.location ?? company.location,
        source: company.source,
        sourceType: company.sourceType,
        extractedAt: new Date().toISOString(),
      }

      // Determine which fields were actually enriched
      const fieldsEnriched: string[] = []
      if (!company.email && enrichedCompany.email) fieldsEnriched.push("email")
      if (!company.foundedYear && enrichedCompany.foundedYear) fieldsEnriched.push("founded year")
      if (!company.website && enrichedCompany.website) fieldsEnriched.push("website")
      if (!company.location && enrichedCompany.location) fieldsEnriched.push("location")

      if (fieldsEnriched.length > 0) {
        console.log(`✅ Enriched fields: ${fieldsEnriched.join(", ")}\n`)
      } else {
        console.log("⚠️  No new data found in research\n")
      }

      return {
        enrichedCompany,
        fieldsEnriched,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`❌ Extraction failed: ${errorMessage}\n`)

      return {
        enrichedCompany: company,
        fieldsEnriched: [],
        success: false,
      }
    }
  },
})

/**
 * Step 4: Format and return final result
 */
const formatResultStep = createStep({
  id: "format-result",
  description: "Format the final enriched company result",
  inputSchema: z.object({
    enrichedCompany: CompanyInfoSchema,
    fieldsEnriched: z.array(z.string()),
    success: z.boolean(),
  }),
  outputSchema: z.object({
    company: CompanyInfoSchema,
    fieldsEnriched: z.array(z.string()),
    enrichmentCount: z.number(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { enrichedCompany, fieldsEnriched, success } = inputData

    const enrichmentCount = fieldsEnriched.length

    console.log(`${"=".repeat(60)}`)
    console.log("🎉 COMPANY ENRICHMENT COMPLETE")
    console.log(`${"=".repeat(60)}`)
    console.log(`Company: ${enrichedCompany.name}`)
    console.log(`Fields enriched: ${enrichmentCount}`)
    if (enrichmentCount > 0) {
      console.log(`Enhanced: ${fieldsEnriched.join(", ")}`)
    }
    console.log(`${"=".repeat(60)}\n`)

    return {
      company: enrichedCompany,
      fieldsEnriched,
      enrichmentCount,
      success,
      message:
        enrichmentCount > 0
          ? `Successfully enriched ${enrichmentCount} field${enrichmentCount > 1 ? "s" : ""}`
          : "No additional data found",
    }
  },
})

/**
 * Main workflow composition
 */
export const webCompanyEnrichmentSingleWorkflow = createWorkflow({
  id: "web-company-enrichment-single",
  inputSchema: z.object({
    company: CompanyInfoSchema,
  }),
  outputSchema: z.object({
    company: CompanyInfoSchema,
    fieldsEnriched: z.array(z.string()),
    enrichmentCount: z.number(),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(identifyMissingFieldsStep)
  .then(researchMissingFieldsStep)
  .then(extractStructuredDataStep)
  .then(formatResultStep)
  .commit()
