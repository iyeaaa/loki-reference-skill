import Elysia, { t } from "elysia"
import { getAITemplateGenerationService } from "../services/ai-template-generation.service"
import { searchAndEnrichLeads } from "../services/lead-search-enrichment.service"
import { sendOnboardingCompleteEmail } from "../services/loops.service"
import { COUNTRY_NAMES, EMAIL_TYPES_3TOUCH, INDUSTRY_NAMES } from "../services/onboarding.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"

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
 * 🆕 Discover leads using ICP-based customer search
 *
 * workspaceDescription이 있으면 ICP 기반 고객사 검색 사용
 * 없으면 기존 하이브리드 검색 사용
 */
async function discoverLeadsEnhanced(options: {
  industry: string
  target: string
  country: string
  /** 🆕 본인 회사 설명 - ICP 기반 고객사 검색에 사용 */
  myCompanyDescription?: string
}) {
  const countryName = COUNTRY_NAMES[options.country] || options.country
  const industryName = INDUSTRY_NAMES[options.industry] || options.industry

  console.log(
    `[TestOnboarding] 🆕 Enhanced lead discovery: ICP search = ${!!options.myCompanyDescription}`,
  )
  if (options.myCompanyDescription) {
    console.log(`[TestOnboarding] My company: "${options.myCompanyDescription.slice(0, 50)}..."`)
  }

  const query = `${industryName} companies in ${countryName}`

  const result = await searchAndEnrichLeads(
    30, // TARGET_LEADS
    query,
    0, // minimumMatchScore
    undefined, // onProgress
    {
      industry: industryName,
      country: countryName,
      target: options.target,
      // 🆕 본인 회사 설명 → ICP 기반 고객사 검색
      myCompanyDescription: options.myCompanyDescription,
    },
  )

  // Transform to expected format
  const leads: LeadData[] = result.leads.map((lead) => ({
    company: lead.companyName,
    website: lead.websiteUrl,
    industry: lead.businessType || "",
    employees: lead.employeeCount || "",
    country: lead.country || countryName,
    enriched: {
      companyName: lead.companyName,
      websiteUrl: lead.websiteUrl,
      businessType: lead.businessType || "",
      country: lead.country || countryName,
      employeeCount: lead.employeeCount || "",
      description: lead.description,
      primaryEmail: lead.primaryEmail || undefined,
    },
  }))

  return {
    leads,
    stats: {
      totalFound: result.stats.totalFound,
      totalEnriched: result.stats.totalFound,
      totalWithEmail: result.stats.withEmails,
      duplicatesSkipped: result.stats.skippedDuplicates,
      iterations: 1,
    },
  }
}

/**
 * Generate email templates (same as test-email-generation.ts)
 */
async function generateEmails(options: {
  workspaceName: string
  workspaceNameEn?: string
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
      workspaceNameEn: options.workspaceNameEn,
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
    workspaceNameEn?: string
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

    // 🆕 Run lead discovery with ICP-based customer search
    // workspaceDescription이 있으면 ICP 기반으로 "이 회사의 고객"을 찾음
    const leadDiscoveryResult = await discoverLeadsEnhanced({
      industry: params.industry,
      target: params.target,
      country: params.country,
      myCompanyDescription: params.workspaceDescription, // 회사 설명 → 고객사 검색에 사용
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
      workspaceNameEn: params.workspaceNameEn,
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
        workspaceNameEn: t.Optional(t.String()),
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

  // ====================================
  // 온보딩 완료 이메일 테스트 (Loops.so)
  // ====================================
  .post(
    "/onboarding-email",
    async ({ body, set }) => {
      try {
        const success = await sendOnboardingCompleteEmail({
          email: body.email,
          firstName: body.firstName,
          companyName: body.companyName,
          companyDescription: body.companyDescription,
          leadCount: body.leadCount,
          emailCount: body.emailCount,
          dashboardUrl: body.dashboardUrl,
          language: body.language as "en" | "ko",
          trialDaysRemaining: body.trialDaysRemaining,
          industry: body.industry,
          topCompanies: body.topCompanies,
        })

        if (!success) {
          set.status = 500
          return errorResponse("Failed to send email", ResponseCode.INTERNAL_ERROR)
        }

        return successResponse({
          success: true,
          message: `Email sent to ${body.email}`,
        })
      } catch (err) {
        set.status = 500
        return errorResponse(
          err instanceof Error ? err.message : "Unknown error",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        firstName: t.Optional(t.String()),
        companyName: t.Optional(t.String()),
        companyDescription: t.Optional(t.String()),
        leadCount: t.Number({ minimum: 0 }),
        emailCount: t.Number({ minimum: 0 }),
        dashboardUrl: t.String(),
        language: t.Optional(t.Union([t.Literal("en"), t.Literal("ko")])),
        trialDaysRemaining: t.Optional(t.Number({ minimum: 0 })),
        industry: t.Optional(t.String()),
        topCompanies: t.Optional(t.Array(t.String())),
      }),
    },
  )
