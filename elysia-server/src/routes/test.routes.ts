import Elysia, { t } from "elysia"
import { getAITemplateGenerationService } from "../services/ai-template-generation.service"
import { searchBuyers } from "../services/buyer-search"
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
      // Task 1: Lead discovery (🆕 새로운 buyer-search 오케스트레이터 사용)
      (async () => {
        const leadStartTime = Date.now()
        const countryName = COUNTRY_NAMES[params.country] || params.country
        const industryName = INDUSTRY_NAMES[params.industry] || params.industry

        // 🆕 새로운 buyer-search 오케스트레이터 사용
        // 회사 설명이 있으면 ICP 기반 검색, 없으면 기본 검색
        const buyerResult = await searchBuyers(
          {
            query: `${industryName} companies in ${countryName}`,
            location: { country: params.country },
            industry: { include: [industryName] },
            limit: 30,
            // 🆕 ICP 기반 검색을 위한 회사 설명
            myCompanyDescription: params.workspaceDescription,
            targetType: params.target,
          },
          {
            locale: "ko",
            targetCount: 30,
            // Progress callback: Phase별로 범위 매핑
            onProgress: (event) => {
              const phaseRanges: Record<string, { start: number; end: number }> = {
                init: { start: 0, end: 5 },
                discovery: { start: 5, end: 40 },
                enrichment: { start: 40, end: 80 },
                fill: { start: 80, end: 95 },
                complete: { start: 100, end: 100 },
              }

              const range = phaseRanges[event.phase] || { start: 0, end: 100 }
              const phaseWidth = range.end - range.start
              const discoveryPercent = Math.min(
                100,
                range.start + (phaseWidth * event.phaseProgress) / 100,
              )

              job.discoveryProgress = Math.round(discoveryPercent)
              // Overall progress: discovery 80% + templates 20%
              const overall = Math.floor(
                (job.discoveryProgress || 0) * 0.8 + (job.templatesProgress || 0) * 0.2,
              )
              job.progress = Math.min(100, overall)
              jobs.set(jobId, job)
            },
          },
        )

        job.discoveryProgress = 100
        jobs.set(jobId, job)

        // 🆕 결과 변환: BuyerSearchResult → 기존 LeadData 형식
        const leads: LeadData[] = buyerResult.results.map((r) => ({
          company: r.company.name,
          website: r.company.domain,
          industry: r.company.industry || "",
          employees: r.company.headcount || "",
          country: r.company.country || countryName,
          enriched: {
            companyName: r.company.name,
            websiteUrl: r.company.domain,
            businessType: r.company.industry || "",
            country: r.company.country || countryName,
            employeeCount: r.company.headcount || "",
            description: r.company.description || undefined,
            primaryEmail: r.contact?.email || undefined,
          },
        }))

        const result = {
          leads,
          stats: {
            totalFound: buyerResult.stats.companiesAttempted,
            totalEnriched: buyerResult.stats.companiesSucceeded,
            totalWithEmail: leads.filter((l) => l.enriched?.primaryEmail).length,
            duplicatesSkipped: 0,
            iterations: buyerResult.stats.fillAttempts + 1,
          },
        }

        const leadDuration = Date.now() - leadStartTime
        console.log(
          `[TestOnboarding] 🆕 Buyer search complete: ${result.leads.length} leads (${leadDuration}ms)`,
        )
        console.log(`[TestOnboarding] Stats:`, buyerResult.stats)
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

  // ====================================
  // 🆕 Buyer Search 테스트 (새로운 오케스트레이터)
  // ====================================
  .post(
    "/buyer-search",
    async ({ body, set }) => {
      try {
        console.log("[TestBuyerSearch] Starting search with params:", body)

        const startTime = Date.now()

        // 검색 실행
        const result = await searchBuyers(
          {
            query: body.query,
            location: body.country ? { country: body.country } : undefined,
            industry: body.industry ? { include: [body.industry] } : undefined,
            headcount: body.headcount,
            limit: body.targetCount || 30,
          },
          {
            locale: (body.locale as "ko" | "en") || "ko",
            targetCount: body.targetCount || 30,
            onProgress: (event) => {
              console.log(
                `[TestBuyerSearch] Progress: [${event.phase}] ${Math.round(event.progress)}% - ` +
                  `${event.message} (${event.resultsFound}/${event.targetCount})`,
              )
            },
          },
        )

        const elapsed = Date.now() - startTime

        console.log(
          `[TestBuyerSearch] Complete: ${result.results.length} buyers found in ${elapsed}ms`,
        )
        console.log(`[TestBuyerSearch] Stats:`, result.stats)

        return successResponse({
          success: result.success,
          results: result.results.map((r) => ({
            company: {
              domain: r.company.domain,
              name: r.company.name,
              description: r.company.description,
              industry: r.company.industry,
              country: r.company.country,
              headcount: r.company.headcount,
            },
            contact: r.contact
              ? {
                  email: r.contact.email,
                  type: r.contact.type,
                  confidence: r.contact.confidence,
                  firstName: r.contact.firstName,
                  lastName: r.contact.lastName,
                  position: r.contact.position,
                }
              : null,
            source: r.source,
            fromCache: r.fromCache,
          })),
          stats: {
            ...result.stats,
            totalTimeMs: result.totalTimeMs,
          },
          error: result.error,
        })
      } catch (err) {
        console.error("[TestBuyerSearch] Error:", err)
        set.status = 500
        return errorResponse(
          err instanceof Error ? err.message : "Unknown error",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        /** 자연어 검색 쿼리 (예: "AI startups in San Francisco") */
        query: t.Optional(t.String()),
        /** 국가 코드 (ISO 3166-1 alpha-2) */
        country: t.Optional(t.String()),
        /** 산업 */
        industry: t.Optional(t.String()),
        /** 회사 규모 (예: ["51-200", "201-500"]) */
        headcount: t.Optional(t.Array(t.String())),
        /** 목표 결과 수 (기본: 30) */
        targetCount: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        /** 언어 (ko/en) */
        locale: t.Optional(t.String()),
      }),
    },
  )

  // SSE 스트리밍 버전 (실시간 Progress)
  .get(
    "/buyer-search/stream",
    async function* ({ query }) {
      const params = {
        query: query.query,
        country: query.country,
        industry: query.industry,
        headcount: query.headcount?.split(","),
        targetCount: Number(query.targetCount) || 30,
        locale: query.locale || "ko",
      }

      console.log("[TestBuyerSearch/Stream] Starting SSE stream with params:", params)

      // SSE 스트리밍을 위한 Generator
      let lastProgressEvent: unknown = null

      const searchPromise = searchBuyers(
        {
          query: params.query,
          location: params.country ? { country: params.country } : undefined,
          industry: params.industry ? { include: [params.industry] } : undefined,
          headcount: params.headcount,
          limit: params.targetCount,
        },
        {
          locale: params.locale as "ko" | "en",
          targetCount: params.targetCount,
          onProgress: (event) => {
            lastProgressEvent = {
              type: "progress",
              data: event,
            }
          },
        },
      )

      // Progress 이벤트 전송
      const progressInterval = setInterval(() => {
        if (lastProgressEvent) {
          // Yield는 generator 내에서만 가능하므로 여기서는 로깅만
          console.log("[TestBuyerSearch/Stream] Progress:", lastProgressEvent)
        }
      }, 500)

      try {
        // Progress 이벤트 스트리밍
        yield `data: ${JSON.stringify({ type: "start", message: "Search started" })}\n\n`

        const result = await searchPromise
        clearInterval(progressInterval)

        // 최종 결과 전송
        yield `data: ${JSON.stringify({
          type: "complete",
          success: result.success,
          resultsCount: result.results.length,
          stats: result.stats,
          totalTimeMs: result.totalTimeMs,
        })}\n\n`

        // 결과 데이터 전송 (청크로 분할)
        const chunkSize = 5
        for (let i = 0; i < result.results.length; i += chunkSize) {
          const chunk = result.results.slice(i, i + chunkSize).map((r) => ({
            company: {
              domain: r.company.domain,
              name: r.company.name,
              description: r.company.description,
              industry: r.company.industry,
            },
            contact: r.contact
              ? {
                  email: r.contact.email,
                  type: r.contact.type,
                  confidence: r.contact.confidence,
                }
              : null,
            source: r.source,
          }))

          yield `data: ${JSON.stringify({ type: "results", data: chunk })}\n\n`
        }

        yield `data: ${JSON.stringify({ type: "done" })}\n\n`
      } catch (err) {
        clearInterval(progressInterval)
        yield `data: ${JSON.stringify({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        })}\n\n`
      }
    },
    {
      query: t.Object({
        query: t.Optional(t.String()),
        country: t.Optional(t.String()),
        industry: t.Optional(t.String()),
        headcount: t.Optional(t.String()), // comma-separated
        targetCount: t.Optional(t.String()),
        locale: t.Optional(t.String()),
      }),
    },
  )
