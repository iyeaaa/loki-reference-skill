import Elysia, { t } from "elysia"
import { config } from "../config"
import { getAITemplateGenerationService } from "../services/ai-template-generation.service"
import { searchBigQuery } from "../services/bigquery-search.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "../services/lead-discovery/nodes/bigquery-executor"
import { enrichLead } from "../services/lead-enrichment.service"
import { COUNTRY_NAMES, EMAIL_TYPES_3TOUCH, INDUSTRY_NAMES } from "../services/onboarding.service"
import { createB2BCustomerIndustryAgent, generateB2BCustomerIndustryPrompt } from "../shared/mastra"
import { errorResponse, ResponseCode } from "../types/response.types"

// In-memory job storage
type JobStatus = "processing" | "completed" | "failed"

interface TestJob {
  jobId: string
  status: JobStatus
  progress: number
  data?: {
    leadDiscovery: {
      stats: {
        totalFound: number
        totalEnriched: number
        totalWithEmail: number
        duplicatesSkipped: number
        iterations: number
      }
      leads: Array<{
        company: string
        website: string
        industry: string
        country: string
        employees: string
        email?: string
        description?: string
      }>
    }
    emailGeneration: {
      templates: Array<{
        step: number
        type: string
        delayDays: number
        subject: string
        bodyText: string
        bodyHtml: string
      }>
    }
  }
  error?: string
  createdAt: Date
}

const jobs = new Map<string, TestJob>()

interface LeadData {
  company: string
  website: string
  industry: string
  employees: string
  country: string
  enriched?: {
    companyName: string
    websiteUrl: string
    businessType: string
    country: string
    employeeCount: string
    description?: string
    primaryEmail?: string
  }
}

/**
 * Get target customer industries using B2B agent
 */
async function getB2BCustomerIndustries(
  industryName: string,
  countryName: string,
): Promise<string[]> {
  try {
    const agent = createB2BCustomerIndustryAgent()
    const prompt = generateB2BCustomerIndustryPrompt(industryName, countryName)
    const result = await agent.generate(prompt)

    if (result.text) {
      try {
        const parsed = JSON.parse(result.text)
        if (parsed.target_industries && Array.isArray(parsed.target_industries)) {
          return parsed.target_industries.slice(0, 3)
        }
      } catch (_e) {
        // Fallback to original
      }
    }

    return [industryName]
  } catch (_error) {
    return [industryName]
  }
}

/**
 * Discover leads (same as test-lead-discovery.ts)
 */
async function discoverLeads(options: { industry: string; target: string; country: string }) {
  const TARGET_LEADS = 30
  const MAX_ITERATIONS = 5
  const BATCH_SIZE = 200

  const countryName = COUNTRY_NAMES[options.country] || options.country
  const industryName = INDUSTRY_NAMES[options.industry] || options.industry

  const targetIndustries = await getB2BCustomerIndustries(industryName, countryName)

  const uniqueLeadsByWebsite = new Map<string, LeadData>()
  const stats = {
    totalFound: 0,
    totalEnriched: 0,
    totalWithEmail: 0,
    duplicatesSkipped: 0,
    iterations: 0,
  }

  // Step 1: Search BigQuery
  for (const targetIndustry of targetIndustries) {
    if (!targetIndustry) continue

    const query = `${targetIndustry} companies in ${countryName}`
    const result = await searchBigQuery(query, APOLLO_LEADS_DATA_DICTIONARY, {
      limitOverride: BATCH_SIZE,
    })

    if (!result.results.length) continue

    for (const row of result.results) {
      const website = row.website as string
      if (!website || uniqueLeadsByWebsite.has(website)) {
        stats.duplicatesSkipped++
        continue
      }

      uniqueLeadsByWebsite.set(website, {
        company: row.company as string,
        website,
        industry: row.industry as string,
        employees: row.employees?.toString() || "",
        country: row.country as string,
      })
      stats.totalFound++
    }
  }

  // Step 2: Enrich leads
  const hunterApiKey = config.hunter.apiKey
  const geminiApiKey = config.gemini.apiKey

  let iteration = 0
  while (iteration < MAX_ITERATIONS) {
    iteration++
    stats.iterations = iteration

    const enrichedWithEmails = Array.from(uniqueLeadsByWebsite.values()).filter(
      (lead) => lead.enriched?.primaryEmail,
    )

    if (enrichedWithEmails.length >= TARGET_LEADS) break

    const unenrichedLeads = Array.from(uniqueLeadsByWebsite.values()).filter(
      (lead) => !lead.enriched,
    )

    if (unenrichedLeads.length === 0) break

    const BATCH_SIZE_ENRICH = 20
    const leadsThisBatch = unenrichedLeads.slice(0, BATCH_SIZE_ENRICH)

    for (const lead of leadsThisBatch) {
      try {
        const enrichment = await enrichLead(lead.website, lead.company, {
          hunterApiKey,
          geminiApiKey,
          skipHunter: false,
        })

        const primaryEmail = enrichment.emails?.[0]?.value

        const isValidEmail =
          primaryEmail &&
          !primaryEmail.toLowerCase().includes("noreply") &&
          !primaryEmail.toLowerCase().startsWith("postmaster@") &&
          !primaryEmail.toLowerCase().startsWith("abuse@")

        lead.enriched = {
          companyName: lead.company || "Unknown Company",
          websiteUrl: lead.website,
          businessType: lead.industry,
          country: lead.country,
          employeeCount: lead.employees,
          description: enrichment.companyInfo?.description,
          primaryEmail: isValidEmail ? primaryEmail : undefined,
        }

        stats.totalEnriched++
        if (isValidEmail) stats.totalWithEmail++

        uniqueLeadsByWebsite.set(lead.website, lead)
      } catch (_error) {
        lead.enriched = {
          companyName: lead.company || "Unknown Company",
          websiteUrl: lead.website,
          businessType: lead.industry,
          country: lead.country,
          employeeCount: lead.employees,
        }
        uniqueLeadsByWebsite.set(lead.website, lead)
      }
    }

    const currentWithEmail = Array.from(uniqueLeadsByWebsite.values()).filter(
      (lead) => lead.enriched?.primaryEmail,
    ).length

    if (currentWithEmail >= TARGET_LEADS) break
  }

  const leadsWithEmail = Array.from(uniqueLeadsByWebsite.values())
    .filter((lead) => lead.enriched?.primaryEmail)
    .slice(0, TARGET_LEADS)

  return {
    leads: leadsWithEmail,
    stats,
  }
}

/**
 * Generate email templates (same as test-email-generation.ts)
 */
async function generateEmails(options: {
  workspaceName: string
  workspaceDescription?: string
  industry: string
  target: string
  country: string
}) {
  const aiService = getAITemplateGenerationService()
  const countryFullName = COUNTRY_NAMES[options.country] || options.country
  const industryContext = `${options.industry} 산업의 ${options.target} 고객을 대상으로`

  const templates = []

  for (let i = 0; i < EMAIL_TYPES_3TOUCH.length; i++) {
    const emailType = EMAIL_TYPES_3TOUCH[i]
    if (!emailType) continue

    const prompt = emailType.promptKr

    const template = await aiService.generateEmailTemplate({
      workspaceName: options.workspaceName,
      workspaceDescription: options.workspaceDescription,
      country: countryFullName,
      userPrompt: `${prompt} ${industryContext}`,
    })

    templates.push({
      stepOrder: i + 1,
      type: emailType.type,
      delayDays: emailType.delayDays,
      template,
    })
  }

  return templates
}

/**
 * Background job processor
 */
async function processOnboardingTest(
  jobId: string,
  params: {
    workspaceName: string
    workspaceDescription?: string
    industry: string
    target: string
    country: string
  },
) {
  const job = jobs.get(jobId)
  if (!job) return

  try {
    console.log("[TestOnboarding] Starting job", jobId, params)

    // Update progress: starting lead discovery
    job.progress = 10
    jobs.set(jobId, job)

    // Run lead discovery
    const leadDiscoveryResult = await discoverLeads({
      industry: params.industry,
      target: params.target,
      country: params.country,
    })

    console.log(
      `[TestOnboarding] Lead discovery complete: ${leadDiscoveryResult.leads.length} leads`,
    )

    // Update progress: lead discovery complete
    job.progress = 50
    jobs.set(jobId, job)

    // Run email generation
    const emailTemplates = await generateEmails({
      workspaceName: params.workspaceName,
      workspaceDescription: params.workspaceDescription,
      industry: params.industry,
      target: params.target,
      country: params.country,
    })

    console.log(`[TestOnboarding] Email generation complete: ${emailTemplates.length} templates`)

    // Update job with results
    job.status = "completed"
    job.progress = 100
    job.data = {
      leadDiscovery: {
        stats: leadDiscoveryResult.stats,
        leads: leadDiscoveryResult.leads.map((lead) => ({
          company: lead.enriched?.companyName || lead.company,
          website: lead.enriched?.websiteUrl || lead.website,
          industry: lead.enriched?.businessType || lead.industry,
          country: lead.enriched?.country || lead.country,
          employees: lead.enriched?.employeeCount || lead.employees,
          email: lead.enriched?.primaryEmail,
          description: lead.enriched?.description,
        })),
      },
      emailGeneration: {
        templates: emailTemplates.map((t) => ({
          step: t.stepOrder,
          type: t.type,
          delayDays: t.delayDays,
          subject: t.template.subject,
          bodyText: t.template.bodyText,
          bodyHtml: t.template.bodyHtml,
        })),
      },
    }
    jobs.set(jobId, job)

    console.log("[TestOnboarding] Job completed", jobId)
  } catch (err) {
    console.error("[TestOnboarding] Job failed", jobId, err)
    job.status = "failed"
    job.error = err instanceof Error ? err.message : "Unknown error"
    jobs.set(jobId, job)
  }
}

export const testRoutes = new Elysia({ prefix: "/api/v1/test" })
  // Start onboarding test (returns jobId immediately)
  .post(
    "/onboarding",
    async ({ body }) => {
      const jobId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`

      // Create job
      const job: TestJob = {
        jobId,
        status: "processing",
        progress: 0,
        createdAt: new Date(),
      }
      jobs.set(jobId, job)

      // Clean up old jobs (older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      for (const [id, j] of jobs.entries()) {
        if (j.createdAt < oneHourAgo) {
          jobs.delete(id)
        }
      }

      // Start background processing
      processOnboardingTest(jobId, body).catch((err) => {
        console.error("[TestOnboarding] Background processing error:", err)
      })

      return { jobId }
    },
    {
      body: t.Object({
        workspaceName: t.String(),
        workspaceDescription: t.Optional(t.String()),
        industry: t.String(),
        target: t.String(),
        country: t.String(),
      }),
    },
  )
  // Get onboarding test status
  .get(
    "/onboarding/:jobId",
    async ({ params, set }) => {
      const job = jobs.get(params.jobId)

      if (!job) {
        set.status = 404
        return errorResponse("Job not found", ResponseCode.NOT_FOUND)
      }

      return {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        data: job.data,
        error: job.error,
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
    },
  )
