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
  discoveryProgress?: number
  templatesProgress?: number
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
      duration: number // milliseconds
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
      duration: number // milliseconds
    }
    totalDuration: number // milliseconds
  }
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
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
async function discoverLeadsEnhanced(
  options: {
    industry: string
    target: string
    country: string
    /** 🆕 본인 회사 설명 - ICP 기반 고객사 검색에 사용 */
    myCompanyDescription?: string
  },
  onProgress?: (progress: {
    currentCount: number
    targetCount: number
    message: string
    phase?: string
  }) => void,
) {
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
    // Progress callback for real-time updates
    onProgress
      ? async (progress) => {
          onProgress({
            currentCount: progress.currentCount,
            targetCount: progress.targetCount,
            message: progress.messageKr || progress.message,
            phase: progress.phase, // phase 정보 전달
          })
        }
      : undefined,
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
 * Generate email templates with sequence context for differentiated emails
 * 🆕 Uses batch generation for 3x faster performance
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

  // 🆕 Batch generation: 모든 이메일을 병렬로 생성 (순차 대비 3배 빠름)
  const emailConfigs = EMAIL_TYPES_3TOUCH.map((emailType, i) => ({
    userPrompt: `${emailType.promptKr} ${industryContext}`,
    stepNumber: i + 1,
    totalSteps: EMAIL_TYPES_3TOUCH.length,
    stepType: emailType.type as "introduction" | "follow_up_1" | "follow_up_2",
  }))

  const generatedTemplates = await aiService.generateEmailTemplatesBatch({
    workspaceName: options.workspaceName,
    workspaceNameEn: options.workspaceNameEn,
    workspaceDescription: options.workspaceDescription,
    country: countryFullName,
    emailConfigs,
  })

  // Map generated templates to expected format
  const templates = generatedTemplates.map((template, i) => {
    const emailType = EMAIL_TYPES_3TOUCH[i]
    if (!emailType) throw new Error(`Missing email type at index ${i}`)

    return {
      stepOrder: i + 1,
      type: emailType.type,
      delayDays: emailType.delayDays,
      template,
    }
  })

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
    const startTime = Date.now()
    job.startedAt = new Date()
    console.log("[TestOnboarding] Starting job", jobId, params)

    // 병렬 실행 전에 progress 초기화 (타이밍 이슈 방지)
    job.discoveryProgress = 0
    job.templatesProgress = 0
    job.progress = 0
    jobs.set(jobId, job)

    // 🚀 병렬 실행: 리드 검색과 이메일 생성을 동시에 시작
    console.log("[TestOnboarding] 🚀 Starting parallel execution: Discovery + Templates")

    const [leadResult, emailResult] = await Promise.allSettled([
      // Task 1: Lead discovery
      (async () => {
        const leadStartTime = Date.now()

        const result = await discoverLeadsEnhanced(
          {
            industry: params.industry,
            target: params.target,
            country: params.country,
            myCompanyDescription: params.workspaceDescription,
          },
          // Progress callback: 0% ~ 100% for discovery
          // Phase별로 범위를 매핑하여 progress가 리셋되지 않도록 함
          (progress) => {
            // 각 phase를 전체 discovery의 일부 비율로 매핑 (실행 순서대로)
            const phaseRanges: Record<string, { start: number; end: number }> = {
              bigquery: { start: 0, end: 20 }, // 검색
              enrichment: { start: 20, end: 50 }, // 이메일 찾기 (가장 오래 걸림)
              scoring: { start: 50, end: 65 }, // 점수 매기기
              hunterio: { start: 65, end: 70 }, // 추가 검색 (필요시)
              description_enrichment: { start: 70, end: 90 }, // 설명 보강
              reranking: { start: 90, end: 100 }, // 최종 순위
              complete: { start: 100, end: 100 },
            }

            const range = progress.phase
              ? phaseRanges[progress.phase] || { start: 0, end: 100 }
              : { start: 0, end: 100 }
            const phaseProgress = Math.floor(
              (progress.currentCount / progress.targetCount) * (range.end - range.start),
            )
            const discoveryPercent = Math.min(100, range.start + phaseProgress)

            job.discoveryProgress = discoveryPercent
            // Overall progress: discovery 80% + templates 20%
            const overall = Math.floor(
              (job.discoveryProgress || 0) * 0.8 + (job.templatesProgress || 0) * 0.2,
            )
            job.progress = Math.min(100, overall)
            jobs.set(jobId, job)
          },
        )

        job.discoveryProgress = 100
        jobs.set(jobId, job)

        const leadDuration = Date.now() - leadStartTime
        console.log(
          `[TestOnboarding] Lead discovery complete: ${result.leads.length} leads (${leadDuration}ms)`,
        )
        return { result, duration: leadDuration }
      })(),

      // Task 2: Email generation
      (async () => {
        const emailStartTime = Date.now()

        // 이메일 생성 시작 (50%)
        job.templatesProgress = 50
        const overall1 = Math.floor(
          (job.discoveryProgress || 0) * 0.8 + (job.templatesProgress || 0) * 0.2,
        )
        job.progress = Math.min(100, overall1)
        jobs.set(jobId, job)

        const templates = await generateEmails({
          workspaceName: params.workspaceName,
          workspaceNameEn: params.workspaceNameEn,
          workspaceDescription: params.workspaceDescription,
          industry: params.industry,
          target: params.target,
          country: params.country,
        })

        // 이메일 생성 완료 (100%)
        job.templatesProgress = 100
        const overall2 = Math.floor(
          (job.discoveryProgress || 0) * 0.8 + (job.templatesProgress || 0) * 0.2,
        )
        job.progress = Math.min(100, overall2)
        jobs.set(jobId, job)

        const emailDuration = Date.now() - emailStartTime
        console.log(
          `[TestOnboarding] Email generation complete: ${templates.length} templates (${emailDuration}ms)`,
        )
        return { templates, duration: emailDuration }
      })(),
    ])

    // 결과 처리
    if (leadResult.status === "rejected") {
      throw new Error(`Lead discovery failed: ${leadResult.reason}`)
    }
    if (emailResult.status === "rejected") {
      throw new Error(`Email generation failed: ${emailResult.reason}`)
    }

    const leadDiscoveryResult = leadResult.value.result
    const leadDuration = leadResult.value.duration
    const emailTemplates = emailResult.value.templates
    const emailDuration = emailResult.value.duration

    // Update progress: both complete
    job.progress = 90
    jobs.set(jobId, job)

    const totalDuration = Date.now() - startTime

    // Update job with results
    job.status = "completed"
    job.progress = 100
    job.completedAt = new Date()
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
        duration: leadDuration,
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
        duration: emailDuration,
      },
      totalDuration,
    }
    jobs.set(jobId, job)

    console.log(`[TestOnboarding] Job completed ${jobId} (total: ${totalDuration}ms)`)
  } catch (err) {
    console.error("[TestOnboarding] Job failed", jobId, err)
    job.status = "failed"
    job.error = err instanceof Error ? err.message : "Unknown error"
    job.completedAt = new Date()
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
        discoveryProgress: job.discoveryProgress,
        templatesProgress: job.templatesProgress,
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
