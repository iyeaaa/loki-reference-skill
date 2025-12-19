/**
 * Campaign Generator Service
 *
 * 재사용 가능한 캠페인 생성 모듈
 * - 리드 검색
 * - 고객 그룹 생성
 * - 이메일 템플릿 생성
 * - 시퀀스 생성 및 활성화
 *
 * BullMQ Worker, REST API, 다른 서비스에서 호출 가능
 */

import type { Job } from "bullmq"
import { and, count, eq, inArray, isNotNull } from "drizzle-orm"
import { db } from "../db"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { leadContacts } from "../db/schema/lead-details"
import { leads as leadsTable } from "../db/schema/leads"
import type { OnboardingAutoGenerateJob, OnboardingAutoGenerateResult } from "../lib/queue/types"
import logger from "../utils/logger"
import { getAITemplateGenerationService } from "./ai-template-generation.service"
import { searchBigQuery } from "./bigquery-search.service"
import { createCustomerGroup } from "./customer-group.service"
import { bulkAddLeadsToCustomerGroup, bulkCreateLeads } from "./lead.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "./lead-discovery/nodes/bigquery-executor"
import {
  COUNTRY_NAMES,
  EMAIL_TYPES_2TOUCH,
  enrichLeadsForOnboarding,
  generatePreviewEmailsForSequence,
  INDUSTRY_NAMES,
  KST_OFFSET_MS,
} from "./onboarding.service"
import {
  bulkEnrollWithScheduling,
  createSequence,
  createSequenceStep,
  updateSequence,
} from "./sequence.service"
import { getUser } from "./user.service"
import * as workspaceService from "./workspace.service"

// ============================================================================
// Types
// ============================================================================

/**
 * 캠페인 생성 설정
 */
export interface CampaignGeneratorConfig {
  /** 수집할 리드 수 (기본: 20) */
  targetLeads?: number
  /** 배치당 리드 수 (기본: 20) */
  enrichmentBatchSize?: number
  /** BigQuery 검색당 가져올 리드 수 (기본: 100) */
  bigqueryBatchSize?: number
  /** 최대 검색 반복 횟수 (기본: 2) */
  maxSearchIterations?: number
  /** 이메일 템플릿 설정 (기본: Day 0, Day 3) */
  emailSchedule?: Array<{
    type: string
    delayDays: number
    promptKr: string
    promptEn: string
  }>
  /** 시퀀스 자동 활성화 여부 (기본: false) */
  autoActivateSequence?: boolean
  /** 프리뷰 이메일 생성 여부 (기본: true) */
  generatePreviews?: boolean
}

/**
 * 캠페인 생성 컨텍스트
 */
export interface CampaignGeneratorContext {
  workspaceId: string
  userId: string
  surveyData: {
    industry: string
    target: string
    country: string
    experience: string
    lang?: string
  }
}

/**
 * 캠페인 생성 결과
 */
export interface CampaignGeneratorResult {
  success: boolean
  leadIds: string[]
  leadsCount: number
  customerGroupId: string
  sequenceId: string
  stepsCount: number
  previewsCount: number
  sequenceActivated: boolean
  errors: Array<{
    phase: string
    message: string
    timestamp: string
  }>
}

/**
 * 진행 상황 콜백
 */
export type ProgressCallback = (phase: string, progressPercent: number, message: string) => void

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<CampaignGeneratorConfig> = {
  targetLeads: 20,
  enrichmentBatchSize: 20,
  bigqueryBatchSize: 100,
  maxSearchIterations: 2,
  emailSchedule: EMAIL_TYPES_2TOUCH,
  autoActivateSequence: false,
  generatePreviews: true,
}

// ============================================================================
// Main Campaign Generator Class
// ============================================================================

/**
 * 캠페인 생성기
 * 리드 검색부터 시퀀스 활성화까지 전체 파이프라인을 처리
 */
export class CampaignGenerator {
  private config: Required<CampaignGeneratorConfig>
  private context: CampaignGeneratorContext
  private progressCallback?: ProgressCallback
  private errors: Array<{ phase: string; message: string; timestamp: string }> = []

  constructor(
    context: CampaignGeneratorContext,
    config?: CampaignGeneratorConfig,
    progressCallback?: ProgressCallback,
  ) {
    this.context = context
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.progressCallback = progressCallback
  }

  /**
   * 전체 캠페인 생성 파이프라인 실행
   */
  async generate(): Promise<CampaignGeneratorResult> {
    logger.info(
      { workspaceId: this.context.workspaceId, config: this.config },
      "[CampaignGenerator] Starting campaign generation",
    )

    let leadIds: string[] = []
    let customerGroupId = ""
    let sequenceId = ""
    let stepsCount = 0
    let previewsCount = 0
    let sequenceActivated = false

    try {
      // Phase 1: 리드 검색
      this.reportProgress("discovery", 0, "리드 검색 시작")
      const discoveryResult = await this.discoverLeads()
      leadIds = discoveryResult.leadIds
      this.reportProgress("discovery", 30, `${leadIds.length}개 리드 발견`)

      // Phase 2: 고객 그룹 생성
      this.reportProgress("group", 35, "고객 그룹 생성 중")
      customerGroupId = await this.createGroup(leadIds)
      this.reportProgress("group", 45, "고객 그룹 생성 완료")

      // Phase 3: 이메일 템플릿 생성
      this.reportProgress("templates", 50, "이메일 템플릿 생성 중")
      const templates = await this.generateTemplates()
      this.reportProgress("templates", 65, `${templates.length}개 템플릿 생성 완료`)

      // Phase 4: 시퀀스 생성
      this.reportProgress("sequence", 70, "시퀀스 생성 중")
      const sequenceResult = await this.createSequenceWithSteps(customerGroupId, leadIds, templates)
      sequenceId = sequenceResult.sequenceId
      stepsCount = sequenceResult.steps.length
      this.reportProgress("sequence", 80, `시퀀스 생성 완료 (${stepsCount}개 스텝)`)

      // Phase 5: 프리뷰 이메일 생성 (선택적)
      if (this.config.generatePreviews && leadIds.length > 0) {
        this.reportProgress("previews", 85, "프리뷰 이메일 생성 중")
        previewsCount = await this.generatePreviews(sequenceId, sequenceResult.steps, leadIds)
        this.reportProgress("previews", 95, `${previewsCount}개 프리뷰 생성 완료`)
      }

      // Phase 6: 시퀀스 활성화 (선택적)
      if (this.config.autoActivateSequence && leadIds.length > 0) {
        this.reportProgress("activate", 97, "시퀀스 활성화 중")
        sequenceActivated = await this.activateSequenceWithEnrollment(sequenceId, leadIds)
        this.reportProgress("activate", 100, "시퀀스 활성화 완료")
      } else {
        this.reportProgress("complete", 100, "캠페인 생성 완료")
      }

      const result: CampaignGeneratorResult = {
        success: true,
        leadIds,
        leadsCount: leadIds.length,
        customerGroupId,
        sequenceId,
        stepsCount,
        previewsCount,
        sequenceActivated,
        errors: this.errors,
      }

      logger.info({ result }, "[CampaignGenerator] Campaign generation completed")
      return result
    } catch (error) {
      this.addError("generate", String(error))
      logger.error({ error }, "[CampaignGenerator] Campaign generation failed")

      return {
        success: false,
        leadIds,
        leadsCount: leadIds.length,
        customerGroupId,
        sequenceId,
        stepsCount,
        previewsCount,
        sequenceActivated,
        errors: this.errors,
      }
    }
  }

  // ==========================================================================
  // Phase 1: 리드 검색
  // ==========================================================================

  private async discoverLeads(): Promise<{ leadIds: string[]; count: number }> {
    const { workspaceId, userId, surveyData } = this.context
    const { targetLeads, enrichmentBatchSize, bigqueryBatchSize, maxSearchIterations } = this.config

    logger.info({ workspaceId, targetLeads }, "[CampaignGenerator] Starting lead discovery")

    // 기존 리드 확인
    const currentLeadsCount = await this.countLeadsWithEmails()
    if (currentLeadsCount >= targetLeads) {
      logger.info(
        { currentLeadsCount, targetLeads },
        "[CampaignGenerator] Already have enough leads",
      )
      return await this.getExistingLeadIds(targetLeads)
    }

    // BigQuery 검색
    const countryName = COUNTRY_NAMES[surveyData.country] || surveyData.country
    const industryName = INDUSTRY_NAMES[surveyData.industry] || surveyData.industry
    const processedWebsites = new Set<string>()

    for (let iteration = 0; iteration < maxSearchIterations; iteration++) {
      const currentCount = await this.countLeadsWithEmails()
      if (currentCount >= targetLeads) break

      const query = this.buildSearchQuery(industryName, countryName, iteration)
      logger.info({ query, iteration }, "[CampaignGenerator] Executing BigQuery search")

      const result = await searchBigQuery(query, APOLLO_LEADS_DATA_DICTIONARY, {
        limitOverride: bigqueryBatchSize,
      })

      if (!result.results.length) continue

      // 중복 제거 및 리드 준비
      const leadsToEnrich = result.results
        .filter((row) => {
          const website = row.website as string
          if (!website || processedWebsites.has(website.toLowerCase())) return false
          processedWebsites.add(website.toLowerCase())
          return true
        })
        .map((row) => ({
          company: row.company as string,
          website: row.website as string,
          industry: row.industry as string,
          employees: row.employees?.toString() || "",
          country: row.country as string,
        }))

      if (leadsToEnrich.length === 0) continue

      // 배치 처리
      for (let i = 0; i < leadsToEnrich.length; i += enrichmentBatchSize) {
        const batch = leadsToEnrich.slice(i, i + enrichmentBatchSize)
        const enrichedBatch = await enrichLeadsForOnboarding(batch)

        // 유효한 리드 필터링 및 저장
        const validLeads = enrichedBatch
          .filter((lead) => {
            if (!lead.primaryEmail) return false
            const email = lead.primaryEmail.toLowerCase()
            return !email.includes("noreply") && !email.startsWith("postmaster@")
          })
          .map((lead) => ({
            companyName: lead.companyName,
            foundCompanyName: lead.companyName,
            websiteUrl: lead.websiteUrl,
            businessType: lead.businessType,
            country: lead.country,
            employeeCount: lead.employeeCount,
            description: lead.description,
            primaryEmail: lead.primaryEmail,
            leadSource: "bigquery-auto" as const,
            leadStatus: "new" as const,
          }))

        if (validLeads.length > 0) {
          await bulkCreateLeads({
            workspaceId,
            leads: validLeads,
            createdBy: userId,
          })
        }

        const afterCount = await this.countLeadsWithEmails()
        if (afterCount >= targetLeads) break
      }
    }

    return await this.getExistingLeadIds(targetLeads)
  }

  private buildSearchQuery(industry: string, country: string, iteration: number): string {
    const variations = [
      `${industry} companies in ${country}`,
      `${industry} businesses in ${country}`,
      `${industry} firms in ${country}`,
      `${country} ${industry} 업체`,
    ]
    const index = iteration % variations.length
    const result = variations[index]
    if (!result) {
      return variations[0] ?? `${industry} companies in ${country}`
    }
    return result
  }

  private async countLeadsWithEmails(): Promise<number> {
    const result = await db
      .select({ value: count() })
      .from(leadsTable)
      .innerJoin(leadContacts, eq(leadsTable.id, leadContacts.leadId))
      .where(
        and(
          eq(leadsTable.workspaceId, this.context.workspaceId),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
          isNotNull(leadContacts.contactValue),
        ),
      )
    return result[0]?.value ?? 0
  }

  private async getExistingLeadIds(limit: number): Promise<{ leadIds: string[]; count: number }> {
    const existingLeads = await db
      .select({ id: leadsTable.id })
      .from(leadsTable)
      .innerJoin(leadContacts, eq(leadsTable.id, leadContacts.leadId))
      .where(
        and(
          eq(leadsTable.workspaceId, this.context.workspaceId),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
          isNotNull(leadContacts.contactValue),
        ),
      )
      .limit(limit)

    const leadIds = existingLeads.map((l) => l.id)
    return { leadIds, count: leadIds.length }
  }

  // ==========================================================================
  // Phase 2: 고객 그룹 생성
  // ==========================================================================

  private async createGroup(leadIds: string[]): Promise<string> {
    const { workspaceId, userId, surveyData } = this.context
    const isKorean = surveyData.lang === "ko"

    const customerGroup = await createCustomerGroup({
      workspaceId,
      name: isKorean ? "자동 생성 리드 그룹" : "Auto-Generated Lead Group",
      description: isKorean
        ? `자동 생성된 리드 그룹 (${leadIds.length}개 리드 포함)`
        : `Auto-generated lead group (${leadIds.length} leads included)`,
      createdBy: userId,
    })

    if (!customerGroup) {
      throw new Error("Failed to create customer group")
    }

    if (leadIds.length > 0) {
      await bulkAddLeadsToCustomerGroup(leadIds, customerGroup.id, userId)
    }

    logger.info({ customerGroupId: customerGroup.id }, "[CampaignGenerator] Customer group created")
    return customerGroup.id
  }

  // ==========================================================================
  // Phase 3: 이메일 템플릿 생성
  // ==========================================================================

  private async generateTemplates(): Promise<
    Array<{
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
    }>
  > {
    const { workspaceId, surveyData } = this.context
    const { emailSchedule } = this.config
    const isKorean = surveyData.lang === "ko"

    const workspace = await workspaceService.getWorkspace(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    const aiService = getAITemplateGenerationService()
    const templates: Array<{
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
    }> = []

    for (let i = 0; i < emailSchedule.length; i++) {
      const emailType = emailSchedule[i]
      if (!emailType) continue

      const prompt = isKorean ? emailType.promptKr : emailType.promptEn
      const industryContext = isKorean
        ? `${surveyData.industry} 산업의 ${surveyData.target} 고객을 대상으로`
        : `for ${surveyData.target} customers in the ${surveyData.industry} industry`

      try {
        const template = await aiService.generateEmailTemplate({
          workspaceName: workspace.companyName || workspace.name,
          workspaceDescription: workspace.companyDescription || undefined,
          country: surveyData.country,
          userPrompt: `${prompt} ${industryContext}`,
        })

        templates.push({
          stepOrder: i + 1,
          delayDays: emailType.delayDays,
          emailSubject: template.subject,
          emailBodyText: template.bodyText,
          emailBodyHtml: template.bodyHtml,
        })

        logger.info(
          { stepOrder: i + 1, type: emailType.type },
          "[CampaignGenerator] Template generated",
        )
      } catch (error) {
        this.addError("templates", `Failed to generate template ${i + 1}: ${error}`)
      }
    }

    if (templates.length === 0) {
      throw new Error("No templates generated")
    }

    return templates
  }

  // ==========================================================================
  // Phase 4: 시퀀스 생성
  // ==========================================================================

  private async createSequenceWithSteps(
    customerGroupId: string,
    leadIds: string[],
    templates: Array<{
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
    }>,
  ): Promise<{
    sequenceId: string
    steps: Array<{
      stepId: string
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string | null
    }>
  }> {
    const { workspaceId, userId, surveyData } = this.context
    const isKorean = surveyData.lang === "ko"

    // 시퀀스 생성
    const sequence = await createSequence({
      workspaceId,
      name: isKorean ? "자동 생성 이메일 시퀀스" : "Auto-Generated Email Sequence",
      description: isKorean
        ? `자동 생성된 이메일 시퀀스 (${leadIds.length}개 리드, ${templates.length}개 스텝)`
        : `Auto-generated email sequence (${leadIds.length} leads, ${templates.length} steps)`,
      status: leadIds.length > 0 ? "ready" : "draft",
      customerGroupId,
      createdBy: userId,
      selectedLeadIds: leadIds.length > 0 ? leadIds : undefined,
    })

    if (!sequence) {
      throw new Error("Failed to create sequence")
    }

    // 시퀀스 스텝 생성
    const now = new Date()
    const kstNow = new Date(now.getTime() + KST_OFFSET_MS)
    const scheduledHour = kstNow.getUTCHours()
    const scheduledMinute = Math.min(59, kstNow.getUTCMinutes() + 2)

    const createdSteps: Array<{
      stepId: string
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string | null
    }> = []

    for (const template of templates) {
      const step = await createSequenceStep({
        sequenceId: sequence.id,
        stepOrder: template.stepOrder,
        delayDays: template.delayDays,
        scheduledHour,
        scheduledMinute,
        emailSubject: template.emailSubject,
        emailBodyText: template.emailBodyText,
        emailBodyHtml: template.emailBodyHtml,
        generationSource: "ai",
      })

      if (step) {
        createdSteps.push({
          stepId: step.id,
          stepOrder: step.stepOrder,
          delayDays: template.delayDays,
          emailSubject: template.emailSubject,
          emailBodyText: template.emailBodyText,
          emailBodyHtml: template.emailBodyHtml,
        })
      }
    }

    logger.info(
      { sequenceId: sequence.id, stepsCount: createdSteps.length },
      "[CampaignGenerator] Sequence created",
    )

    return { sequenceId: sequence.id, steps: createdSteps }
  }

  // ==========================================================================
  // Phase 5: 프리뷰 이메일 생성
  // ==========================================================================

  private async generatePreviews(
    sequenceId: string,
    steps: Array<{
      stepId: string
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string | null
    }>,
    leadIds: string[],
  ): Promise<number> {
    const { workspaceId, userId } = this.context

    if (leadIds.length === 0 || steps.length === 0) return 0

    // 사용자 이메일 조회
    const user = await getUser(userId)
    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    // 이메일 계정 조회 또는 생성
    let emailAccountId: string
    const [existingAccount] = await db
      .select({ id: userEmailAccounts.id })
      .from(userEmailAccounts)
      .where(
        and(eq(userEmailAccounts.userId, userId), eq(userEmailAccounts.workspaceId, workspaceId)),
      )
      .limit(1)

    if (existingAccount) {
      emailAccountId = existingAccount.id
    } else {
      const [newAccount] = await db
        .insert(userEmailAccounts)
        .values({
          userId,
          workspaceId,
          emailAddress: user.email,
          apiKey: "TRIAL_PREVIEW",
          isVerified: false,
          isDefault: true,
          status: "inactive",
        })
        .returning({ id: userEmailAccounts.id })

      if (!newAccount) {
        throw new Error("Failed to create email account")
      }
      emailAccountId = newAccount.id
    }

    // 리드 정보 조회
    const leadDetails = await db
      .select({
        id: leadsTable.id,
        companyName: leadsTable.companyName,
        contactName: leadsTable.contactName,
        websiteUrl: leadsTable.websiteUrl,
        country: leadsTable.country,
        businessType: leadsTable.businessType,
      })
      .from(leadsTable)
      .where(inArray(leadsTable.id, leadIds))

    const leadEmails = await db
      .select({
        leadId: leadContacts.leadId,
        email: leadContacts.contactValue,
      })
      .from(leadContacts)
      .where(
        and(
          inArray(leadContacts.leadId, leadIds),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
        ),
      )

    const emailMap = new Map(leadEmails.map((e) => [e.leadId, e.email]))
    const leadDetailsWithEmail = leadDetails.map((lead) => ({
      ...lead,
      contactEmail: emailMap.get(lead.id) || null,
    }))

    // 프리뷰 이메일 생성
    const previewCount = await generatePreviewEmailsForSequence(
      workspaceId,
      emailAccountId,
      user.email,
      sequenceId,
      steps,
      leadDetailsWithEmail,
    )

    logger.info({ previewCount }, "[CampaignGenerator] Preview emails generated")
    return previewCount
  }

  // ==========================================================================
  // Phase 6: 시퀀스 활성화
  // ==========================================================================

  private async activateSequenceWithEnrollment(
    sequenceId: string,
    leadIds: string[],
  ): Promise<boolean> {
    const { workspaceId, userId } = this.context

    try {
      // 이메일 계정 조회
      const [existingAccount] = await db
        .select({ id: userEmailAccounts.id })
        .from(userEmailAccounts)
        .where(
          and(eq(userEmailAccounts.userId, userId), eq(userEmailAccounts.workspaceId, workspaceId)),
        )
        .limit(1)

      if (!existingAccount) {
        this.addError("activate", "No email account found for user")
        return false
      }

      // 리드들을 시퀀스에 등록 (스케줄링 포함)
      await bulkEnrollWithScheduling({
        sequenceId,
        leadIds,
        userEmailAccountId: existingAccount.id,
        enrolledBy: userId,
      })

      // 시퀀스 상태를 "active"로 변경
      await updateSequence(sequenceId, {
        status: "active",
      })

      logger.info(
        { sequenceId, leadsCount: leadIds.length },
        "[CampaignGenerator] Sequence activated",
      )
      return true
    } catch (error) {
      this.addError("activate", `Failed to activate sequence: ${error}`)
      return false
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private reportProgress(phase: string, progressPercent: number, message: string): void {
    if (this.progressCallback) {
      this.progressCallback(phase, progressPercent, message)
    }
    logger.info({ phase, progressPercent, message }, "[CampaignGenerator] Progress")
  }

  private addError(phase: string, message: string): void {
    this.errors.push({
      phase,
      message,
      timestamp: new Date().toISOString(),
    })
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 캠페인 생성 (간편 함수)
 *
 * @example
 * const result = await generateCampaign({
 *   workspaceId: "...",
 *   userId: "...",
 *   surveyData: { industry: "beauty", target: "b2b", country: "jp", experience: "some" }
 * }, {
 *   targetLeads: 20,
 *   autoActivateSequence: true
 * })
 */
export async function generateCampaign(
  context: CampaignGeneratorContext,
  config?: CampaignGeneratorConfig,
  progressCallback?: ProgressCallback,
): Promise<CampaignGeneratorResult> {
  const generator = new CampaignGenerator(context, config, progressCallback)
  return generator.generate()
}

/**
 * BullMQ Job에서 캠페인 생성 (Worker용)
 */
export async function generateCampaignFromJob(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
  config?: CampaignGeneratorConfig,
): Promise<CampaignGeneratorResult> {
  const { workspaceId, userId, surveyData } = job.data

  if (!surveyData.industry || !surveyData.target || !surveyData.country || !surveyData.experience) {
    throw new Error("Invalid survey data: missing required fields")
  }

  const context: CampaignGeneratorContext = {
    workspaceId,
    userId,
    surveyData: {
      industry: surveyData.industry,
      target: surveyData.target,
      country: surveyData.country,
      experience: surveyData.experience,
      lang: surveyData.lang,
    },
  }

  // Job progress 콜백
  const progressCallback: ProgressCallback = async (phase, progressPercent, message) => {
    await job.updateProgress({ phase, progressPercent, message })
  }

  return generateCampaign(context, config, progressCallback)
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * 빠른 온보딩용 설정 (20개 리드, 2-touch)
 */
export const QUICK_ONBOARDING_CONFIG: CampaignGeneratorConfig = {
  targetLeads: 20,
  bigqueryBatchSize: 100,
  maxSearchIterations: 2,
  autoActivateSequence: false,
  generatePreviews: true,
}

/**
 * 전체 온보딩용 설정 (300개 리드, 2-touch)
 */
export const FULL_ONBOARDING_CONFIG: CampaignGeneratorConfig = {
  targetLeads: 300,
  bigqueryBatchSize: 500,
  maxSearchIterations: 5,
  autoActivateSequence: false,
  generatePreviews: true,
}

/**
 * 즉시 활성화용 설정 (20개 리드, 2-touch, 자동 활성화)
 */
export const INSTANT_CAMPAIGN_CONFIG: CampaignGeneratorConfig = {
  targetLeads: 20,
  bigqueryBatchSize: 100,
  maxSearchIterations: 2,
  autoActivateSequence: true,
  generatePreviews: true,
}
