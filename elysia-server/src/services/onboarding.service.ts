/**
 * Onboarding Service
 *
 * 워크스페이스 기반 온보딩 진행 상태 관리
 * - 온보딩 진행 CRUD
 * - 스텝별 데이터 저장
 * - 온보딩 완료 처리
 */

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import { config } from "../config"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import { leads as leadsTable } from "../db/schema/leads"
import { type OnboardingStatus, onboardingProgress } from "../db/schema/onboarding"
import { sequenceSteps } from "../db/schema/sequences"
import { workspaces } from "../db/schema/workspaces"
import { createB2BCustomerIndustryAgent, generateB2BCustomerIndustryPrompt } from "../shared/mastra"
import { structuredExtractionAgent } from "../shared/mastra/shell/agents/structured-extraction-agent"
import { createLog } from "./activity-log.service"
import { getAITemplateGenerationService } from "./ai-template-generation.service"
import { searchBigQuery } from "./bigquery-search.service"
import { createCustomerGroup } from "./customer-group.service"
import { bulkAddLeadsToCustomerGroup, bulkCreateLeads } from "./lead.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "./lead-discovery/nodes/bigquery-executor"
import { enrichLead } from "./lead-enrichment.service"
import * as salesStrategyService from "./sales-strategy.service"
import { createSequence, createSequenceStep } from "./sequence.service"
import { getUser } from "./user.service"
import * as workspaceServiceImport from "./workspace.service"

// ====================================
// ERROR TYPES
// ====================================

export class OnboardingValidationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
    this.name = "OnboardingValidationError"
  }
}

// ====================================
// TYPES
// ====================================

export interface OnboardingSurveyData {
  industry?: string
  target?: string
  country?: string
  experience?: string
  lang?: string
}

export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed" | "stalled"

export interface OnboardingProgressData {
  id: string
  workspaceId: string
  status: OnboardingStatus
  currentStep: number
  surveyData: OnboardingSurveyData | null
  selectedLeadIds: string[] | null
  generatedSequenceId: string | null
  customerGroupId: string | null
  companyInfoCompleted: Date | null
  leadSearchCompleted: Date | null
  emailGenerationCompleted: Date | null
  emailLinkCompleted: Date | null
  completedAt: Date | null
  jobId: string | null
  jobStatus: JobStatus | null
  createdAt: Date
  updatedAt: Date
}

// ====================================
// CRUD OPERATIONS
// ====================================

/**
 * 워크스페이스의 온보딩 진행 상태 조회 또는 생성
 */
export async function getOrCreateOnboardingProgress(
  workspaceId: string,
): Promise<OnboardingProgressData> {
  // console.log("[OnboardingService] getOrCreateOnboardingProgress called, workspaceId:", workspaceId)

  // 먼저 기존 진행 상태 조회
  const [existing] = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.workspaceId, workspaceId))
    .limit(1)

  if (existing) {
    console.log("[OnboardingService] Found existing progress:", existing.id)
    // console.log("[OnboardingService]   - status:", existing.status)
    // console.log("[OnboardingService]   - currentStep:", existing.currentStep)
    // console.log("[OnboardingService]   - surveyData:", JSON.stringify(existing.surveyData, null, 2))
    return existing as OnboardingProgressData
  }

  // 없으면 새로 생성
  // console.log("[OnboardingService] No existing progress, creating new one...")
  const [created] = await db
    .insert(onboardingProgress)
    .values({
      workspaceId,
      status: "not_started",
      currentStep: 0,
    })
    .returning()

  // console.log("[OnboardingService] Created new progress:", created?.id)
  return created as OnboardingProgressData
}

/**
 * 온보딩 진행 상태 조회
 */
export async function getOnboardingProgress(
  workspaceId: string,
): Promise<OnboardingProgressData | null> {
  // console.log("[OnboardingService] getOnboardingProgress called, workspaceId:", workspaceId)

  const [result] = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.workspaceId, workspaceId))
    .limit(1)

  if (result) {
    // console.log("[OnboardingService] getOnboardingProgress result:")
    // console.log("[OnboardingService]   - id:", result.id)
    // console.log("[OnboardingService]   - status:", result.status)
    // console.log("[OnboardingService]   - currentStep:", result.currentStep)
    // console.log("[OnboardingService]   - surveyData:", JSON.stringify(result.surveyData, null, 2))
  } else {
    // console.log("[OnboardingService] getOnboardingProgress: No result found")
  }

  return (result as OnboardingProgressData) || null
}

/**
 * 온보딩 진행 상태 ID로 조회
 */
export async function getOnboardingProgressById(
  id: string,
): Promise<OnboardingProgressData | null> {
  const [result] = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.id, id))
    .limit(1)

  return (result as OnboardingProgressData) || null
}

/**
 * Update job information in onboarding progress
 */
export async function updateJobInfo(
  workspaceId: string,
  jobId: string,
  jobStatus: "waiting" | "active" | "completed" | "failed" | "delayed" | "stalled",
): Promise<void> {
  await db
    .update(onboardingProgress)
    .set({
      jobId,
      jobStatus,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.workspaceId, workspaceId))
}

/**
 * Check job completion status for conditional navigation
 * Used by frontend to determine whether to show Step 3 (loading) or skip to Step 4
 */
export async function checkJobCompletionStatus(workspaceId: string): Promise<{
  isComplete: boolean
  jobStatus: string | null
  hasLeads: boolean
  hasSequence: boolean
}> {
  const progress = await getOnboardingProgress(workspaceId)

  if (!progress) {
    return {
      isComplete: false,
      jobStatus: null,
      hasLeads: false,
      hasSequence: false,
    }
  }

  const isComplete = progress.jobStatus === "completed"
  const hasLeads = Array.isArray(progress.selectedLeadIds) && progress.selectedLeadIds.length > 0
  const hasSequence = !!progress.generatedSequenceId

  return {
    isComplete,
    jobStatus: progress.jobStatus || null,
    hasLeads,
    hasSequence,
  }
}

// ====================================
// SURVEY DATA OPERATIONS
// ====================================

/**
 * 설문 데이터 저장 (Step 0 완료 -> Step 1 시작)
 * - onboarding_progress.survey_data 저장
 * - workspace_sales_strategies 동시 생성 (데이터 일관성 보장)
 */
export async function saveSurveyData(
  workspaceId: string,
  surveyData: OnboardingSurveyData,
  userId?: string,
): Promise<OnboardingProgressData> {
  // console.log("[OnboardingService] saveSurveyData called")
  // console.log("[OnboardingService] workspaceId:", workspaceId)
  // console.log("[OnboardingService] surveyData:", JSON.stringify(surveyData, null, 2))
  // console.log("[OnboardingService] userId:", userId)

  // 필수 필드 검증
  if (!surveyData.industry || !surveyData.target || !surveyData.country || !surveyData.experience) {
    console.log("[OnboardingService] ❌ Missing required fields in surveyData")
    throw new OnboardingValidationError(
      "설문 데이터가 불완전합니다. industry, target, country, experience는 필수입니다.",
      "INCOMPLETE_SURVEY_DATA",
    )
  }

  // console.log("[OnboardingService] Getting or creating onboarding progress...")
  const progress = await getOrCreateOnboardingProgress(workspaceId)
  // console.log("[OnboardingService] Progress ID:", progress.id)
  // console.log(
  //   "[OnboardingService] Current surveyData in DB:",
  //   JSON.stringify(progress.surveyData, null, 2),
  // )

  // 트랜잭션으로 survey_data와 sales_strategy를 함께 저장
  // console.log("[OnboardingService] Updating onboarding_progress with surveyData...")
  const [updated] = await db
    .update(onboardingProgress)
    .set({
      surveyData,
      status: "survey_completed",
      currentStep: 1,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  // console.log("[OnboardingService] ✅ onboarding_progress updated:")
  // console.log("[OnboardingService]   - id:", updated?.id)
  // console.log("[OnboardingService]   - surveyData:", JSON.stringify(updated?.surveyData, null, 2))
  // console.log("[OnboardingService]   - status:", updated?.status)
  // console.log("[OnboardingService]   - currentStep:", updated?.currentStep)

  // workspace_sales_strategies도 함께 생성/연결
  try {
    // console.log("[OnboardingService] Linking sales strategy...")
    await salesStrategyService.findOrCreateAndLinkSalesStrategy(workspaceId, {
      industry: surveyData.industry as Parameters<
        typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
      >[1]["industry"],
      target: surveyData.target as Parameters<
        typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
      >[1]["target"],
      country: surveyData.country as Parameters<
        typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
      >[1]["country"],
      experience: surveyData.experience as Parameters<
        typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
      >[1]["experience"],
    })
    console.log("[OnboardingService] ✅ Sales strategy linked successfully")
  } catch (error) {
    console.error("[OnboardingService] ⚠️ Failed to link sales strategy (may already exist):", error)
    // 이미 연결된 경우 무시 (중복 방지)
  }

  // Activity Log 기록
  await createLog(workspaceId, "onboarding", progress.id, "survey_completed", {
    userId,
    details: { surveyData },
  })

  console.log("[OnboardingService] saveSurveyData completed successfully")
  return updated as OnboardingProgressData
}

// ====================================
// STEP OPERATIONS
// ====================================

/**
 * 온보딩 필수 데이터 검증
 * - 설문 데이터(survey_data) 존재 여부 확인
 * - workspace_sales_strategies 존재 여부 확인
 *
 * Step 2, 3 진행 전 회사 정보가 실제로 존재하는지 검증합니다.
 * companyInfoCompleted 플래그만으로는 데이터 삭제 후 상태를 감지할 수 없으므로
 * 실제 데이터 존재 여부를 확인합니다.
 */
async function validateOnboardingPrerequisites(
  workspaceId: string,
  progress: OnboardingProgressData,
): Promise<void> {
  // 1. 설문 데이터 검증
  if (!progress.surveyData) {
    throw new OnboardingValidationError(
      "회사 정보가 없습니다. Step 1(회사 정보 확인)을 다시 완료해주세요.",
      "MISSING_SURVEY_DATA",
    )
  }

  // 2. workspace_sales_strategies 검증
  const salesStrategies = await salesStrategyService.getWorkspaceSalesStrategies(workspaceId)
  if (salesStrategies.length === 0) {
    throw new OnboardingValidationError(
      "회사 전략 정보가 없습니다. Step 1(회사 정보 확인)을 다시 완료해주세요.",
      "MISSING_SALES_STRATEGY",
    )
  }
}

/**
 * Step 1 완료: 회사 정보 확인 완료
 * - 설문 데이터(survey_data) 존재 여부 검증
 * - workspace_sales_strategies 존재 여부 검증
 */
export async function completeStep1CompanyInfo(
  workspaceId: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

  // 설문 데이터 검증
  if (!progress.surveyData) {
    throw new OnboardingValidationError(
      "설문 데이터가 없습니다. 설문을 먼저 완료해주세요.",
      "MISSING_SURVEY_DATA",
    )
  }

  // workspace_sales_strategies 검증
  const salesStrategies = await salesStrategyService.getWorkspaceSalesStrategies(workspaceId)
  if (salesStrategies.length === 0) {
    // 설문 데이터가 있다면 자동으로 sales strategy 생성
    const surveyData = progress.surveyData as OnboardingSurveyData
    if (surveyData.industry && surveyData.target && surveyData.country && surveyData.experience) {
      try {
        await salesStrategyService.findOrCreateAndLinkSalesStrategy(workspaceId, {
          industry: surveyData.industry as Parameters<
            typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
          >[1]["industry"],
          target: surveyData.target as Parameters<
            typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
          >[1]["target"],
          country: surveyData.country as Parameters<
            typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
          >[1]["country"],
          experience: surveyData.experience as Parameters<
            typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
          >[1]["experience"],
        })
      } catch (error) {
        console.error("[Onboarding] Failed to auto-create sales strategy:", error)
      }
    }
  }

  // 🔄 이메일 재생성: Step 1 완료 시 회사 정보로 이메일 템플릿 재생성
  // 회원가입 시 자동 생성된 이메일은 기본값(기본 워크스페이스)을 사용했을 수 있음
  if (progress.generatedSequenceId) {
    try {
      console.log(
        `[Onboarding] Step 1 완료 - 이메일 재생성 시작 (sequence: ${progress.generatedSequenceId})`,
      )
      await regenerateSequenceEmails(
        workspaceId,
        progress.generatedSequenceId,
        progress.surveyData as OnboardingSurveyData,
      )
      console.log("[Onboarding] ✅ 이메일 재생성 완료")
    } catch (error) {
      console.error("[Onboarding] ⚠️ 이메일 재생성 실패 (계속 진행):", error)
      // 재생성 실패해도 Step 1 완료는 진행
    }
  }

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      companyInfoCompleted: new Date(),
      status: "company_info",
      currentStep: 2,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  // Activity Log 기록
  await createLog(workspaceId, "onboarding", progress.id, "step1_completed", {
    userId,
    details: { step: 1, stepName: "회사 정보 확인" },
  })

  return updated as OnboardingProgressData
}

/**
 * Step 2 완료: 리드 검색 및 저장 완료
 * - Step 1 완료 여부 검증
 * - 실제 데이터 존재 여부 검증 (회사 정보 삭제 방지)
 */
export async function completeStep2LeadSearch(
  workspaceId: string,
  selectedLeadIds: string[],
  customerGroupId?: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

  // Step 1 완료 검증
  if (!progress.companyInfoCompleted) {
    throw new OnboardingValidationError(
      "Step 1(회사 정보 확인)을 먼저 완료해주세요.",
      "STEP1_NOT_COMPLETED",
    )
  }

  // 실제 데이터 존재 여부 검증 (회사 정보가 삭제되지 않았는지 확인)
  await validateOnboardingPrerequisites(workspaceId, progress)

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      selectedLeadIds,
      customerGroupId: customerGroupId || null,
      leadSearchCompleted: new Date(),
      status: "lead_search",
      currentStep: 3,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  // Activity Log 기록
  await createLog(workspaceId, "onboarding", progress.id, "step2_completed", {
    userId,
    details: {
      step: 2,
      stepName: "리드 검색",
      leadCount: selectedLeadIds.length,
      customerGroupId,
    },
  })

  return updated as OnboardingProgressData
}

/**
 * Step 3 완료: 이메일 시퀀스 생성 완료
 * - Step 2 완료 여부 검증 (선택적 - 리드 없이도 진행 가능)
 * - 실제 데이터 존재 여부 검증 (회사 정보 삭제 방지)
 */
export async function completeStep3EmailGeneration(
  workspaceId: string,
  sequenceId: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

  // Step 1 완료 검증 (필수)
  if (!progress.companyInfoCompleted) {
    throw new OnboardingValidationError(
      "Step 1(회사 정보 확인)을 먼저 완료해주세요.",
      "STEP1_NOT_COMPLETED",
    )
  }

  // 실제 데이터 존재 여부 검증 (회사 정보가 삭제되지 않았는지 확인)
  await validateOnboardingPrerequisites(workspaceId, progress)

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      generatedSequenceId: sequenceId,
      emailGenerationCompleted: new Date(),
      status: "email_generation",
      currentStep: 4,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  // Activity Log 기록
  await createLog(workspaceId, "onboarding", progress.id, "step3_completed", {
    userId,
    details: { step: 3, stepName: "이메일 시퀀스 생성", sequenceId },
  })

  return updated as OnboardingProgressData
}

/**
 * Step 4 완료: 이메일 연동 완료 (선택적)
 */
export async function completeStep4EmailLink(
  workspaceId: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      emailLinkCompleted: new Date(),
      status: "email_link",
      currentStep: 5,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  // Activity Log 기록
  await createLog(workspaceId, "onboarding", progress.id, "step4_completed", {
    userId,
    details: { step: 4, stepName: "이메일 연동" },
  })

  return updated as OnboardingProgressData
}

/**
 * 온보딩 완료 처리
 * - 필수 데이터 검증 (survey_data, workspace_sales_strategies)
 * - 최소 Step 1 완료 검증
 */
export async function completeOnboarding(
  workspaceId: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

  // 설문 데이터가 있는 경우에만 sales strategy 자동 생성 시도
  if (progress.surveyData) {
    const salesStrategies = await salesStrategyService.getWorkspaceSalesStrategies(workspaceId)
    if (salesStrategies.length === 0) {
      const surveyData = progress.surveyData as OnboardingSurveyData
      if (surveyData.industry && surveyData.target && surveyData.country && surveyData.experience) {
        try {
          await salesStrategyService.findOrCreateAndLinkSalesStrategy(workspaceId, {
            industry: surveyData.industry as Parameters<
              typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
            >[1]["industry"],
            target: surveyData.target as Parameters<
              typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
            >[1]["target"],
            country: surveyData.country as Parameters<
              typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
            >[1]["country"],
            experience: surveyData.experience as Parameters<
              typeof salesStrategyService.findOrCreateAndLinkSalesStrategy
            >[1]["experience"],
          })
          console.log("[Onboarding] Auto-created sales strategy on completion")
        } catch (error) {
          console.error("[Onboarding] Failed to auto-create sales strategy on completion:", error)
        }
      }
    }
  }

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  // Activity Log 기록
  const result = updated as OnboardingProgressData
  const durationMs = result.completedAt
    ? new Date(result.completedAt).getTime() - new Date(result.createdAt).getTime()
    : null

  await createLog(workspaceId, "onboarding", progress.id, "completed", {
    userId,
    details: {
      finalStep: result.currentStep,
      durationMs,
      leadCount: result.selectedLeadIds?.length || 0,
      sequenceId: result.generatedSequenceId,
    },
  })

  return result
}

/**
 * 현재 스텝 업데이트 (자유 이동)
 */
export async function updateCurrentStep(
  workspaceId: string,
  step: number,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

  // 상태 매핑
  let status: OnboardingStatus = "not_started"
  if (step === 1) status = "survey_completed"
  else if (step === 2) status = "company_info"
  else if (step === 3) status = "lead_search"
  else if (step === 4) status = "email_generation"
  else if (step >= 5) status = "completed"

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      currentStep: step,
      status,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  return updated as OnboardingProgressData
}

// ====================================
// QUERY OPERATIONS
// ====================================

/**
 * 미완료 온보딩 목록 조회 (분석용)
 */
export async function getIncompleteOnboardings(limit = 100) {
  const result = await db
    .select({
      id: onboardingProgress.id,
      workspaceId: onboardingProgress.workspaceId,
      workspaceName: workspaces.name,
      status: onboardingProgress.status,
      currentStep: onboardingProgress.currentStep,
      surveyData: onboardingProgress.surveyData,
      createdAt: onboardingProgress.createdAt,
      updatedAt: onboardingProgress.updatedAt,
    })
    .from(onboardingProgress)
    .innerJoin(workspaces, eq(onboardingProgress.workspaceId, workspaces.id))
    .where(isNull(onboardingProgress.completedAt))
    .orderBy(desc(onboardingProgress.updatedAt))
    .limit(limit)

  return result
}

/**
 * 완료된 온보딩 통계
 */
export async function getOnboardingStats() {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${onboardingProgress.completedAt} is not null)::int`,
      inProgress: sql<number>`count(*) filter (where ${onboardingProgress.completedAt} is null and ${onboardingProgress.currentStep} > 0)::int`,
      notStarted: sql<number>`count(*) filter (where ${onboardingProgress.currentStep} = 0)::int`,
      avgStepCompleted: sql<number>`avg(${onboardingProgress.currentStep})::numeric(10,2)`,
    })
    .from(onboardingProgress)

  return stats
}

/**
 * 온보딩 리셋 (개발/테스트용)
 */
export async function resetOnboarding(workspaceId: string): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      status: "not_started",
      currentStep: 0,
      surveyData: null,
      selectedLeadIds: null,
      generatedSequenceId: null,
      customerGroupId: null,
      companyInfoCompleted: null,
      leadSearchCompleted: null,
      emailGenerationCompleted: null,
      emailLinkCompleted: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.id, progress.id))
    .returning()

  return updated as OnboardingProgressData
}

// ====================================
// AUTO-GENERATION (TRIAL SIGNUP)
// ====================================

// Country code → actual Apollo BigQuery country values (must match data exactly)
// Apollo has individual country names, not regions like "Southeast Asia"
export const COUNTRY_NAMES: Record<string, string> = {
  jp: "Japan",
  us: "United States",
  sea: "Singapore", // Apollo has individual SEA countries - use Singapore as representative
  eu: "United Kingdom", // Apollo has individual EU countries - use UK as representative
  cn: "China",
  ae: "United Arab Emirates",
}

// Country name → language for email translation
// Used to generate emails in the lead's native language
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  Japan: "Japanese",
  "United States": "English",
  "United Kingdom": "English",
  China: "Chinese",
  "South Korea": "Korean",
  Korea: "Korean",
  Germany: "German",
  France: "French",
  Spain: "Spanish",
  Italy: "Italian",
  Netherlands: "Dutch",
  Singapore: "English",
  "United Arab Emirates": "English",
  India: "English",
  Australia: "English",
  Canada: "English",
  Brazil: "Portuguese",
  Mexico: "Spanish",
  Taiwan: "Chinese",
  "Hong Kong": "Chinese",
  Vietnam: "Vietnamese",
  Thailand: "Thai",
  Indonesia: "Indonesian",
  Malaysia: "English",
  Philippines: "English",
}

// Industry code → English keywords for BigQuery LIKE search
// Apollo uses free-form industry text - these keywords will match via LIKE
export const INDUSTRY_NAMES: Record<string, string> = {
  beauty: "beauty cosmetics skincare",
  fashion: "fashion apparel clothing",
  food: "food beverage",
  it_saas: "software technology saas",
  manufacturing: "manufacturing",
}

/**
 * HTML 특수문자 이스케이프 (XSS 방지)
 * < > & " ' 문자를 HTML 엔티티로 변환
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char)
}

/**
 * Replace template variables with lead data
 * Handles language-appropriate fallbacks based on target language
 *
 * @param template - Email template with placeholders
 * @param lead - Lead data for replacement
 * @param targetLanguage - Target language for fallbacks (optional, auto-detected if not provided)
 * @param isHtml - Whether the template is HTML (applies XSS sanitization)
 */
function replaceVariables(
  template: string,
  lead: {
    companyName: string | null
    contactName?: string | null
    websiteUrl?: string | null
    country?: string | null
  },
  targetLanguage?: string,
  isHtml = false,
): string {
  // Determine language for fallbacks
  // Priority: 1) explicit targetLanguage, 2) lead's country, 3) template detection
  let isKorean = false

  if (targetLanguage) {
    isKorean = targetLanguage === "Korean"
  } else if (lead.country) {
    const countryLanguage = COUNTRY_TO_LANGUAGE[lead.country]
    isKorean = countryLanguage === "Korean"
  } else {
    // Fallback to template detection (legacy behavior)
    const koreanCharCount = (template.match(/[\u3131-\uD79D]/g) || []).length
    isKorean = koreanCharCount > 10
  }

  // Language-appropriate fallbacks
  const companyFallback = isKorean ? "귀사" : "your company"
  // For contact name: if missing, remove the greeting entirely or use appropriate fallback
  const hasContactName = lead.contactName && lead.contactName.trim().length > 0

  // XSS 방지: HTML 컨텍스트에서는 사용자 데이터를 이스케이프
  const safeCompanyName = isHtml
    ? escapeHtml(lead.companyName || companyFallback)
    : lead.companyName || companyFallback
  const safeWebsiteUrl = isHtml ? escapeHtml(lead.websiteUrl || "") : lead.websiteUrl || ""
  const safeCountry = isHtml ? escapeHtml(lead.country || "") : lead.country || ""

  let result = template
    // English variable names (new)
    .replace(/\{\{company_name\}\}/gi, safeCompanyName)
    // Korean/legacy variable names
    .replace(/\{\{companyName\}\}/g, safeCompanyName)
    .replace(/\{\{회사명\}\}/g, safeCompanyName)
    .replace(/\{\{website\}\}/g, safeWebsiteUrl)
    .replace(/\{\{country\}\}/g, safeCountry)

  // Handle contact name with language-appropriate greeting
  if (hasContactName && lead.contactName) {
    const safeContactName = isHtml ? escapeHtml(lead.contactName) : lead.contactName
    result = result
      .replace(/\{\{contact_name\}\}/gi, safeContactName)
      .replace(/\{\{contactName\}\}/g, safeContactName)
      .replace(/\{\{담당자명\}\}/g, safeContactName)
  } else {
    // Remove awkward greetings when no contact name
    // "Hi {{contact_name}}," -> "Hi there," (English) or "안녕하세요," (Korean)
    result = result
      .replace(/Hi \{\{contact_name\}\},?/gi, "Hi there,")
      .replace(/Hello \{\{contact_name\}\},?/gi, "Hello,")
      .replace(/Dear \{\{contact_name\}\},?/gi, "Hello,")
      .replace(/Hi \{\{담당자명\}\},?/gi, "Hi there,")
      .replace(/Hello \{\{담당자명\}\},?/gi, "Hello,")
      .replace(/Dear \{\{담당자명\}\},?/gi, "Hello,")
      .replace(/\{\{담당자명\}\}님,?/g, "")
      .replace(/안녕하세요 \{\{담당자명\}\}님,?/g, "안녕하세요,")
      // Fallback for any remaining
      .replace(/\{\{contact_name\}\}/gi, "")
      .replace(/\{\{contactName\}\}/g, "")
      .replace(/\{\{담당자명\}\}/g, "")
  }

  return result
}

/**
 * Generate preview emails for each lead × step combination
 * Stores in emails table for UI display and eventual sending
 *
 * Each lead's emails are staggered by 1 minute to avoid sending all at once
 * Example: Lead 1 at 10:00, Lead 2 at 10:01, Lead 3 at 10:02, etc.
 *
 * NEW: Emails are now translated to the lead's native language based on their country
 *
 * @param workspaceId - Workspace ID (required for emails table)
 * @param userEmailAccountId - Trial email account ID (created for trial users)
 * @param fromEmail - The from email address (user's email)
 * @param sequenceId - Sequence ID
 * @param stepTemplates - Array of step templates with delayDays
 * @param leadDetails - Array of lead details including contactEmail
 * @param baseLanguage - The original language of the templates (default: from survey country)
 * @returns Number of emails created
 */
export async function generatePreviewEmailsForSequence(
  workspaceId: string,
  userEmailAccountId: string,
  fromEmail: string,
  sequenceId: string,
  stepTemplates: Array<{
    stepId: string
    stepOrder: number
    delayDays: number
    emailSubject: string
    emailBodyText: string
    emailBodyHtml: string | null
  }>,
  leadDetails: Array<{
    id: string
    companyName: string | null
    contactName?: string | null
    contactEmail?: string | null
    websiteUrl?: string | null
    country?: string | null
    businessType?: string | null
  }>,
  onProgress?: (generated: number, total: number) => Promise<void>,
  baseLanguage?: string,
): Promise<number> {
  const emailsToCreate = []
  const aiService = getAITemplateGenerationService()

  // Base time for scheduling (now + 1 minute for immediate sending)
  const baseTime = new Date(Date.now() + 1 * 60 * 1000)

  // Cache for translated templates by language
  // Key: `${stepOrder}-${language}`, Value: translated template
  const translationCache = new Map<
    string,
    { subject: string; bodyText: string; bodyHtml: string | null }
  >()

  // Determine the base language from the first template or default to Korean
  const originalLanguage = baseLanguage || "Korean"

  for (let leadIndex = 0; leadIndex < leadDetails.length; leadIndex++) {
    const lead = leadDetails[leadIndex]
    if (!lead) continue

    // Stagger each lead by 1 minute
    const leadOffset = leadIndex * 60 * 1000 // 1 minute per lead

    // Determine the target language based on lead's country
    const leadCountry = lead.country || ""
    const targetLanguage = COUNTRY_TO_LANGUAGE[leadCountry] || "English"

    // Check if translation is needed (translate when source and target languages differ)
    const needsTranslation = targetLanguage !== originalLanguage

    for (const step of stepTemplates) {
      let subject = step.emailSubject
      let bodyText = step.emailBodyText
      let bodyHtml = step.emailBodyHtml

      // Translate if needed (cache results per step + language)
      if (needsTranslation) {
        const cacheKey = `${step.stepOrder}-${targetLanguage}`
        let translated = translationCache.get(cacheKey)

        if (!translated) {
          console.log(
            `[PreviewEmails] Translating step ${step.stepOrder} to ${targetLanguage} for lead ${lead.companyName}`,
          )
          try {
            const translatedTemplate = await aiService.translateEmailTemplate({
              subject: step.emailSubject,
              bodyText: step.emailBodyText,
              bodyHtml: step.emailBodyHtml,
              targetLanguage,
            })

            translated = {
              subject: translatedTemplate.subject,
              bodyText: translatedTemplate.bodyText,
              bodyHtml: translatedTemplate.bodyHtml,
            }
            translationCache.set(cacheKey, translated)
            console.log(`[PreviewEmails] ✅ Translation cached for ${cacheKey}`)
          } catch (translationError) {
            // 번역 실패 시: 해당 스텝의 이메일을 스킵하고 로그 기록
            // 잘못된 언어의 이메일이 발송되는 것을 방지
            console.error(
              `[PreviewEmails] ❌ Translation failed for step ${step.stepOrder} to ${targetLanguage}:`,
              translationError,
            )
            console.warn(
              `[PreviewEmails] ⚠️ Skipping email for lead ${lead.companyName} (${lead.id}) - step ${step.stepOrder}`,
            )
            // 이 스텝은 스킵하고 다음 스텝으로 진행
            continue
          }
        }

        subject = translated.subject
        bodyText = translated.bodyText
        bodyHtml = translated.bodyHtml
      }

      // Replace placeholders with lead data (pass targetLanguage for accurate fallbacks)
      subject = replaceVariables(subject, lead, targetLanguage, false)
      bodyText = replaceVariables(bodyText, lead, targetLanguage, false)
      bodyHtml = bodyHtml ? replaceVariables(bodyHtml, lead, targetLanguage, true) : null

      // Calculate scheduled time: base + lead offset + delay days
      const scheduledAt = new Date(
        baseTime.getTime() + leadOffset + step.delayDays * 24 * 60 * 60 * 1000,
      )

      emailsToCreate.push({
        workspaceId,
        userEmailAccountId, // Real trial email account ID
        leadId: lead.id,
        sequenceId,
        stepId: step.stepId,
        direction: "outbound" as const,
        fromEmail, // User's actual email address
        toEmail: lead.contactEmail || TRIAL_PLACEHOLDER_EMAIL,
        subject,
        bodyText,
        bodyHtml,
        status: "draft" as const, // Draft status for preview (not yet ready to send)
        scheduledAt,
        // Denormalized fields for performance
        leadName: lead.companyName,
        leadEmail: lead.contactEmail,
      })

      // Call progress callback after each email for real-time updates
      if (onProgress) {
        const totalPreviews = leadDetails.length * stepTemplates.length
        await onProgress(emailsToCreate.length, totalPreviews)
      }
    }
  }

  if (emailsToCreate.length > 0) {
    await db.insert(emails).values(emailsToCreate)
  }

  return emailsToCreate.length
}

/**
 * Get B2B customer industries using AI agent
 * Takes the seller's industry and country, returns 1-3 target customer industries
 *
 * @param industryName - The seller's industry name
 * @param countryName - The country name
 * @returns Array of 1-3 target customer industry names
 */
async function getB2BCustomerIndustries(
  industryName: string,
  countryName: string,
): Promise<string[]> {
  try {
    console.log(
      `[B2BAgent] Analyzing target customer industries for: ${industryName} in ${countryName}`,
    )

    // Step 1: Generate analysis using B2B agent
    const agent = createB2BCustomerIndustryAgent()
    const prompt = generateB2BCustomerIndustryPrompt(industryName, countryName)
    const response = await agent.generate(prompt)

    console.log(`[B2BAgent] Agent response: ${response.text}`)

    // Step 2: Extract structured output using structured extraction agent
    const structured = await structuredExtractionAgent.generate(
      [
        {
          role: "user",
          content: `Extract the target industries from the following analysis. Return only the industry names as a JSON array.

Analysis:
${response.text}

Return format: { "targetIndustries": ["Industry1", "Industry2", "Industry3"] }`,
        },
      ],
      {
        output: z.object({
          targetIndustries: z
            .array(z.string())
            .min(1)
            .max(3)
            .describe("1-3 target customer industries"),
        }),
      },
    )

    const industries = structured.object.targetIndustries
    console.log(`[B2BAgent] Extracted target industries: ${industries.join(", ")}`)

    return industries
  } catch (error) {
    console.error("[B2BAgent] Agent failed, falling back to original industry", error)
    return [industryName] // Fallback to original behavior
  }
}

/**
 * Non-interactive lead discovery for auto-generation
 * Calls BigQuery directly without SSE/LangGraph for background processing
 *
 * @param workspaceId - The workspace ID
 * @param userId - The user ID who created the workspace
 * @param surveyData - Survey data with industry, country, and target
 * @returns Object with leadIds array, count, and enrichment stats
 */
async function discoverLeadsForOnboarding(
  workspaceId: string,
  userId: string,
  surveyData: { industry: string; country: string; target: string },
): Promise<{
  leadIds: string[]
  count: number
  targetCount?: number
  enrichmentSuccessRate?: string
  duplicatesSkipped?: number
  totalEnriched?: number
  totalDuplicates?: number
}> {
  const TARGET_LEADS = 30
  const MAX_ITERATIONS = 5
  const BATCH_SIZE = 200

  // Map codes to actual Apollo BigQuery values
  const countryName = COUNTRY_NAMES[surveyData.country] || surveyData.country
  const industryName = INDUSTRY_NAMES[surveyData.industry] || surveyData.industry

  // Get target customer industries from B2B agent (1-3 industries that would BUY from this industry)
  const targetIndustries = await getB2BCustomerIndustries(industryName, countryName)
  console.log(`[LeadDiscovery] Target customer industries: ${targetIndustries.join(", ")}`)

  // In-memory state tracking
  const uniqueLeadsByWebsite = new Map<
    string,
    {
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
  >()

  console.log(`[LeadDiscovery] Target: ${TARGET_LEADS} unique enriched leads with email`)

  try {
    // Step 1: Search BigQuery once per industry
    console.log(`[LeadDiscovery] Searching BigQuery for ${targetIndustries.length} industries...`)

    for (const targetIndustry of targetIndustries) {
      const query = `${targetIndustry} companies in ${countryName}`
      console.log(`[LeadDiscovery] Query for "${targetIndustry}": "${query}"`)

      const result = await searchBigQuery(query, APOLLO_LEADS_DATA_DICTIONARY, {
        limitOverride: BATCH_SIZE,
      })

      if (!result.results.length) {
        console.log(`[LeadDiscovery] No results from BigQuery for "${targetIndustry}"`)
        continue
      }

      console.log(`[LeadDiscovery] Found ${result.results.length} results for "${targetIndustry}"`)

      // Add leads to unique leads in-memory state
      let newLeadsAdded = 0
      for (const row of result.results) {
        const website = row.website as string
        if (!website || uniqueLeadsByWebsite.has(website)) continue

        uniqueLeadsByWebsite.set(website, {
          company: row.company as string,
          website,
          industry: row.industry as string,
          employees: row.employees?.toString() || "",
          country: row.country as string,
        })
        newLeadsAdded++
      }

      console.log(
        `[LeadDiscovery] Added ${newLeadsAdded} new leads from "${targetIndustry}" ` +
          `(${result.results.length - newLeadsAdded} duplicates)`,
      )
    }

    console.log(`[LeadDiscovery] Total unique leads from BigQuery: ${uniqueLeadsByWebsite.size}`)

    // Step 2: Enrich leads in batches until target reached
    let iteration = 0

    while (iteration < MAX_ITERATIONS) {
      iteration++

      // Count current enriched leads with emails
      const enrichedWithEmails = Array.from(uniqueLeadsByWebsite.values()).filter(
        (lead) => lead.enriched?.primaryEmail,
      )

      console.log(
        `[LeadDiscovery] Enrichment iteration ${iteration}/${MAX_ITERATIONS}: ` +
          `${enrichedWithEmails.length}/${TARGET_LEADS} enriched leads with email`,
      )

      // BASE CASE: We have enough enriched leads with email
      if (enrichedWithEmails.length >= TARGET_LEADS) {
        console.log(
          `[LeadDiscovery] ✓ Target reached: ${enrichedWithEmails.length} enriched leads with email`,
        )
        break
      }

      // Enrich un-enriched leads
      const unenrichedLeads = Array.from(uniqueLeadsByWebsite.values()).filter(
        (lead) => !lead.enriched,
      )

      if (unenrichedLeads.length === 0) {
        console.log("[LeadDiscovery] No more un-enriched leads to process")
        break
      }

      console.log(`[LeadDiscovery] Enriching ${unenrichedLeads.length} un-enriched leads...`)

      const enrichedLeads = await enrichLeadsForOnboarding(unenrichedLeads)

      // Update in-memory state with enrichment results
      for (const enriched of enrichedLeads) {
        if (!enriched.websiteUrl) continue

        const existing = uniqueLeadsByWebsite.get(enriched.websiteUrl)
        if (existing) {
          existing.enriched = enriched
        }
      }

      const enrichedCount = enrichedLeads.filter((l) => l.primaryEmail).length
      console.log(
        `[LeadDiscovery] Enrichment complete: ${enrichedCount}/${enrichedLeads.length} have emails`,
      )
    }

    // Collect all enriched leads with valid emails
    const enrichedLeadsWithEmails = Array.from(uniqueLeadsByWebsite.values())
      .filter((lead): lead is typeof lead & { enriched: NonNullable<typeof lead.enriched> } => {
        if (!lead.enriched?.primaryEmail) return false
        const email = lead.enriched.primaryEmail.toLowerCase()
        // Filter out generic no-reply addresses
        if (email.includes("noreply")) return false
        if (email.startsWith("postmaster@")) return false
        if (email.startsWith("abuse@")) return false
        return true
      })
      .map((lead) => lead.enriched)

    console.log(
      `[LeadDiscovery] Total enriched leads with valid emails: ${enrichedLeadsWithEmails.length}`,
    )

    // Take first 150 and create in database
    const leadsToCreate = enrichedLeadsWithEmails.slice(0, TARGET_LEADS).map((lead) => ({
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

    console.log(`[LeadDiscovery] Creating ${leadsToCreate.length} leads in database...`)

    // Create leads in database (handles deduplication)
    const { createdLeads, stats } = await bulkCreateLeads({
      workspaceId,
      leads: leadsToCreate,
      createdBy: userId,
    })

    const enrichmentSuccessRate =
      uniqueLeadsByWebsite.size > 0
        ? ((enrichedLeadsWithEmails.length / uniqueLeadsByWebsite.size) * 100).toFixed(1)
        : "0.0"

    console.log(
      `[LeadDiscovery] Final stats: ${stats.created} leads created, ` +
        `${stats.skipped} duplicates in DB, ` +
        `${uniqueLeadsByWebsite.size} total unique leads found, ` +
        `${enrichedLeadsWithEmails.length} enriched with emails. ` +
        `Success rate: ${enrichmentSuccessRate}%`,
    )

    if (stats.created < TARGET_LEADS) {
      console.warn(
        `[LeadDiscovery] Warning: Only created ${stats.created}/${TARGET_LEADS} leads after deduplication`,
      )
    }

    return {
      leadIds: createdLeads.map((l) => l.id),
      count: stats.created,
      targetCount: TARGET_LEADS,
      enrichmentSuccessRate: `${enrichmentSuccessRate}%`,
      duplicatesSkipped: stats.skipped,
      totalEnriched: enrichedLeadsWithEmails.length,
      totalDuplicates: stats.skipped,
    }
  } catch (error) {
    console.error("[LeadDiscovery] Error during lead discovery:", error)
    throw error // Propagate error to caller for proper error handling
  }
}

/**
 * Enrich BigQuery leads with contact emails and company info
 * Uses Hunter.io for email discovery and Jina/Gemini for company analysis
 * Processes leads in parallel batches (10 concurrent) with 2s delays between batches
 */
export async function enrichLeadsForOnboarding(
  leadsToEnrich: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
  }>,
): Promise<
  Array<{
    companyName: string
    websiteUrl: string
    businessType: string
    country: string
    employeeCount: string
    description?: string
    primaryEmail?: string
  }>
> {
  const hunterApiKey = config.hunter.apiKey
  const geminiApiKey = config.gemini.apiKey

  const BATCH_SIZE = 10 // Process 10 leads concurrently
  const DELAY_BETWEEN_BATCHES = 2000 // 2s delay between batches

  const enrichedLeads = []

  // Process leads in batches
  for (let i = 0; i < leadsToEnrich.length; i += BATCH_SIZE) {
    const batch = leadsToEnrich.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(leadsToEnrich.length / BATCH_SIZE)

    console.log(
      `[LeadEnrichment] Processing batch ${batchNumber}/${totalBatches} (${batch.length} leads)`,
    )

    // Enrich batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async (lead) => {
        try {
          if (!lead.website) {
            // No website = can't enrich, add basic data
            return {
              companyName: lead.company || "Unknown Company",
              websiteUrl: lead.website,
              businessType: lead.industry,
              country: lead.country,
              employeeCount: lead.employees?.toString(),
            }
          }

          const enrichment = await enrichLead(lead.website, lead.company, {
            hunterApiKey,
            geminiApiKey,
            skipHunter: false,
          })

          // Get primary email (highest confidence)
          const primaryEmail = enrichment.emails?.[0]?.value

          console.log(`[LeadEnrichment] Enriched ${lead.company}: email=${primaryEmail || "none"}`)

          return {
            companyName: lead.company || "Unknown Company",
            websiteUrl: lead.website,
            businessType: lead.industry,
            country: lead.country,
            employeeCount: lead.employees?.toString(),
            description: enrichment.companyInfo?.description,
            primaryEmail,
          }
        } catch (error) {
          console.error(`[LeadEnrichment] Failed to enrich ${lead.company}:`, error)
          // Still return lead without enrichment
          return {
            companyName: lead.company || "Unknown Company",
            websiteUrl: lead.website,
            businessType: lead.industry,
            country: lead.country,
            employeeCount: lead.employees?.toString(),
          }
        }
      }),
    )

    // Collect successful enrichments
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        enrichedLeads.push(result.value)
      } else {
        console.error(`[LeadEnrichment] Batch promise rejected:`, result.reason)
      }
    }

    // Rate limiting: wait between batches (except after last batch)
    if (i + BATCH_SIZE < leadsToEnrich.length) {
      console.log(`[LeadEnrichment] Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`)
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    }
  }

  return enrichedLeads
}

// 3-touch email sequence for trial signup
// Touch 1: Brief intro (2 minutes after enrollment - same day)
// Touch 2: Follow-up with value (1 day later, same time)
// Touch 3: Final reminder (2 days later, same time)
export const EMAIL_TYPES_3TOUCH = [
  {
    type: "introduction",
    promptKr:
      "잠재 고객에게 보내는 첫 이메일을 작성해주세요. 짧고 간결하게(2-5문장) 고객의 핵심 문제점을 언급하고, 우리가 어떻게 도움을 줄 수 있는지 설명하세요. 부담 없는 다음 단계(예: 자료 확인, 짧은 통화)를 제안해주세요.",
    promptEn:
      "Write a brief introduction email (2-5 sentences) to a potential customer. Highlight a key pain point they likely face, briefly explain how you can help, and propose a low-commitment next step (e.g., viewing a resource, a quick 10-min call).",
    delayDays: 0, // 2분 뒤 (scheduledMinute로 조절)
  },
  {
    type: "follow_up_1",
    promptKr:
      "이전 이메일의 후속 메시지를 작성해주세요. 첫 이메일을 간략히 언급하고, 새로운 가치(성공 사례, 구체적 혜택, 또는 인사이트)를 추가하세요. 명확하고 시간이 정해진 행동 요청(예: '이번 주 10분 통화')으로 마무리해주세요.",
    promptEn:
      "Write a follow-up email referencing your previous outreach. Add new value (a success story, specific benefit, or insight) that wasn't in the first email. End with a clear, time-bound CTA (e.g., '10 minutes this week') to lower the commitment barrier.",
    delayDays: 1, // 1일 뒤 (같은 시간)
  },
  {
    type: "follow_up_2",
    promptKr:
      "마지막 후속 이메일을 작성해주세요. 이전 이메일들을 간략히 언급하고, 고객이 놓치고 있는 가치를 강조하세요. 긴급성을 부드럽게 표현하면서 최종 행동 요청(예: '이번 주 내로 답변 부탁드립니다')으로 마무리해주세요.",
    promptEn:
      "Write a final follow-up email. Reference previous outreach briefly, emphasize the value they're missing, and create soft urgency. End with a final CTA (e.g., 'Would love to hear from you this week').",
    delayDays: 2, // 2일 뒤 (같은 시간)
  },
]

// Backward compatibility alias
export const EMAIL_TYPES_2TOUCH = EMAIL_TYPES_3TOUCH

// Placeholder email for leads without contact email
const TRIAL_PLACEHOLDER_EMAIL = "trial@preview.local"

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * Auto-generate onboarding content after trial signup
 *
 * This function runs in the background after a new trial user signs up.
 * It automatically:
 * 1. Discovers leads using BigQuery (non-interactive, direct call)
 * 2. Creates a customer group with discovered leads
 * 3. Generates email templates using AI
 * 4. Creates a sequence with immediate scheduling
 * 5. Updates onboarding progress
 *
 * @param workspaceId - The workspace ID
 * @param userId - The user ID who created the workspace
 * @param surveyData - Survey data from signup (industry, target, country, experience, lang)
 */
export async function autoGenerateOnboarding(
  workspaceId: string,
  userId: string,
  surveyData: {
    industry: string
    target: string
    country: string
    experience: string
    lang?: string
  },
): Promise<void> {
  const isKorean = surveyData.lang === "ko"

  console.log(`[AutoGenerate] Starting for workspace ${workspaceId}`)

  try {
    // Get workspace info for AI template generation
    const workspace = await workspaceServiceImport.getWorkspace(workspaceId)
    if (!workspace) {
      console.error(`[AutoGenerate] Workspace not found: ${workspaceId}`)
      return
    }

    // Get user info for email address
    const user = await getUser(userId)
    if (!user) {
      console.error(`[AutoGenerate] User not found: ${userId}`)
      return
    }

    // Store user email for later use
    const userEmail = user.email

    // 1. Discover leads using BigQuery (non-interactive)
    console.log("[AutoGenerate] Discovering leads...")
    const { leadIds, count: leadCount } = await discoverLeadsForOnboarding(workspaceId, userId, {
      industry: surveyData.industry,
      country: surveyData.country,
      target: surveyData.target,
    })
    console.log(`[AutoGenerate] Discovered ${leadCount} leads`)

    // 2. Create customer group
    const customerGroup = await createCustomerGroup({
      workspaceId,
      name: isKorean ? "데모 리드 그룹" : "Demo Lead Group",
      description:
        leadCount > 0
          ? isKorean
            ? `트라이얼 가입 시 자동 생성된 리드 그룹 (${leadCount}개 리드 포함)`
            : `Lead group auto-generated during trial signup (${leadCount} leads included)`
          : isKorean
            ? "트라이얼 가입 시 자동 생성된 리드 그룹. 리드 탐색에서 리드를 추가하세요."
            : "Lead group auto-generated during trial signup. Add leads from Lead Discovery.",
      createdBy: userId,
    })

    if (!customerGroup) {
      console.error("[AutoGenerate] Failed to create customer group")
      return
    }

    console.log(`[AutoGenerate] Created customer group ${customerGroup.id}`)

    // 3. Add discovered leads to customer group
    if (leadIds.length > 0) {
      await bulkAddLeadsToCustomerGroup(leadIds, customerGroup.id, userId)
      console.log(`[AutoGenerate] Added ${leadIds.length} leads to customer group`)
    }

    // 4. Generate email templates using AI (3-touch sequence for trial)
    const templatesNeeded = EMAIL_TYPES_3TOUCH.length
    console.log(`[AutoGenerate] Will generate ${templatesNeeded} templates (3-touch sequence)`)

    const aiService = getAITemplateGenerationService()
    const templates: Array<{
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
    }> = []

    for (let i = 0; i < templatesNeeded; i++) {
      const emailType = EMAIL_TYPES_3TOUCH[i]
      if (!emailType) continue

      const prompt = isKorean ? emailType.promptKr : emailType.promptEn
      const industryContext = isKorean
        ? `${surveyData.industry} 산업의 ${surveyData.target} 고객을 대상으로`
        : `for ${surveyData.target} customers in the ${surveyData.industry} industry`

      try {
        // Use companyName and companyDescription if available, fallback to workspace name/description
        // Filter out default values like "기본 워크스페이스" that don't provide useful context
        const effectiveDescription =
          workspace.companyDescription && workspace.companyDescription !== "기본 워크스페이스"
            ? workspace.companyDescription
            : workspace.description && workspace.description !== "기본 워크스페이스"
              ? workspace.description
              : undefined

        const template = await aiService.generateEmailTemplate({
          workspaceName: workspace.companyName || workspace.name,
          workspaceDescription: effectiveDescription,
          country: surveyData.country,
          userPrompt: `${prompt} ${industryContext}`,
        })

        templates.push({
          stepOrder: i + 1,
          delayDays: emailType.delayDays, // 0 for intro, 3 for follow-up
          emailSubject: template.subject,
          emailBodyText: template.bodyText,
          emailBodyHtml: template.bodyHtml,
        })

        console.log(
          `[AutoGenerate] Generated template ${i + 1}/${templatesNeeded}: ${emailType.type} (delay: ${emailType.delayDays} days)`,
        )
      } catch (error) {
        console.error(`[AutoGenerate] Failed to generate template ${i + 1}:`, error)
        // Continue with remaining templates
      }
    }

    if (templates.length === 0) {
      console.error("[AutoGenerate] No templates generated, aborting")
      return
    }

    // 5. Create sequence with discovered leads
    const sequence = await createSequence({
      workspaceId,
      name: isKorean ? "데모 이메일 시퀀스" : "Demo Email Sequence",
      description:
        leadIds.length > 0
          ? isKorean
            ? `트라이얼 가입 시 자동 생성된 데모 시퀀스 (${leadIds.length}개 리드 포함)`
            : `Demo sequence auto-generated during trial signup (${leadIds.length} leads included)`
          : isKorean
            ? "트라이얼 가입 시 자동 생성된 데모 시퀀스. 리드를 추가한 후 실행하세요."
            : "Demo sequence auto-generated during trial signup. Add leads before running.",
      status: leadIds.length > 0 ? "ready" : "draft", // Ready if leads exist, draft otherwise
      customerGroupId: customerGroup.id,
      createdBy: userId,
      selectedLeadIds: leadIds.length > 0 ? leadIds : undefined,
    })

    if (!sequence) {
      console.error("[AutoGenerate] Failed to create sequence")
      return
    }

    console.log(`[AutoGenerate] Created sequence ${sequence.id}`)

    // 6. Create sequence steps with 3-touch timing (Day 0, Day 1, Day 2)
    const now = new Date()
    const kstNow = new Date(now.getTime() + KST_OFFSET_MS)
    const scheduledHour = kstNow.getUTCHours()
    const scheduledMinute = Math.min(59, kstNow.getUTCMinutes() + 2) // 2 min buffer

    // Array to store created steps with their IDs for preview email generation
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
        delayDays: template.delayDays, // From EMAIL_TYPES_3TOUCH: 0, 1, 2 days
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

      console.log(
        `[AutoGenerate] Created sequence step ${template.stepOrder} (delay: ${template.delayDays} days)`,
      )
    }

    // 7. Generate preview emails for each lead × step combination
    // Emails are staggered: each lead gets emails 1 minute after the previous
    if (leadIds.length > 0 && createdSteps.length > 0) {
      // Fetch lead details for personalization
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

      // Fetch contact emails from leadContacts table (populated during enrichment)
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

      // Create email lookup map
      const emailMap = new Map(leadEmails.map((e) => [e.leadId, e.email]))

      // Add contactEmail to leadDetails
      const leadDetailsWithEmail = leadDetails.map((lead) => ({
        ...lead,
        contactEmail: emailMap.get(lead.id) || null,
      }))

      console.log(
        `[AutoGenerate] Found ${leadEmails.length} contact emails for ${leadDetails.length} leads`,
      )

      // Get or create email account RIGHT BEFORE inserting emails
      // This handles the race condition where TRIAL_PREVIEW was deleted by Nylas callback
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
        console.log(`[AutoGenerate] Using existing email account: ${emailAccountId}`)
      } else {
        // Create new trial email account
        const [newAccount] = await db
          .insert(userEmailAccounts)
          .values({
            userId,
            workspaceId,
            emailAddress: userEmail,
            apiKey: "TRIAL_PREVIEW",
            isVerified: false,
            isDefault: true,
            status: "inactive",
          })
          .returning({ id: userEmailAccounts.id })

        if (!newAccount) {
          console.error("[AutoGenerate] Failed to create email account")
          return
        }
        emailAccountId = newAccount.id
        console.log(`[AutoGenerate] Created trial email account: ${emailAccountId}`)
      }

      // Determine the base language from the survey country
      const surveyCountryName = COUNTRY_NAMES[surveyData.country] || surveyData.country
      const baseLanguage = COUNTRY_TO_LANGUAGE[surveyCountryName] || "English"

      const previewCount = await generatePreviewEmailsForSequence(
        workspaceId,
        emailAccountId,
        userEmail,
        sequence.id,
        createdSteps,
        leadDetailsWithEmail,
        undefined, // No progress callback for this call
        baseLanguage,
      )
      console.log(
        `[AutoGenerate] Generated ${previewCount} preview emails (${leadDetails.length} leads × ${createdSteps.length} steps)`,
      )
    }

    // 8. Update onboarding progress
    // First complete step 1 (company info) - required before step 2/3
    await completeStep1CompanyInfo(workspaceId, userId)
    console.log("[AutoGenerate] Completed step 1 (company info)")

    // Complete step 2 (lead search) if leads were found
    if (leadIds.length > 0) {
      await completeStep2LeadSearch(workspaceId, leadIds, customerGroup.id, userId)
      console.log("[AutoGenerate] Completed step 2 (lead search)")
    }
    // Complete step 3 (email generation)
    await completeStep3EmailGeneration(workspaceId, sequence.id, userId)

    console.log(
      `[AutoGenerate] Success: ${leadCount} leads, ${templates.length} templates, sequence ${sequence.id}`,
    )
  } catch (error) {
    console.error("[AutoGenerate] Failed:", error)
    // Silently fail - user can still do manual onboarding
  }
}

/**
 * Step 1 완료 시 이메일 재생성
 * 회원가입 시 자동 생성된 이메일의 템플릿을 업데이트된 회사 정보로 재생성합니다.
 */
async function regenerateSequenceEmails(
  workspaceId: string,
  sequenceId: string,
  surveyData: OnboardingSurveyData,
): Promise<void> {
  const isKorean = surveyData.lang === "ko"

  // 1. 최신 워크스페이스 정보 가져오기
  const workspace = await workspaceServiceImport.getWorkspace(workspaceId)
  if (!workspace) {
    throw new Error("Workspace not found")
  }

  // 회사 정보가 기본값인 경우 재생성하지 않음
  const hasValidCompanyInfo =
    workspace.companyName &&
    workspace.companyName.trim() !== "" &&
    workspace.companyDescription &&
    workspace.companyDescription.trim() !== "" &&
    workspace.companyDescription !== "기본 워크스페이스"

  if (!hasValidCompanyInfo) {
    console.log("[RegenerateEmails] 회사 정보가 기본값이므로 재생성 스킵")
    return
  }

  console.log(
    `[RegenerateEmails] 회사 정보: ${workspace.companyName} - ${workspace.companyDescription?.substring(0, 50)}...`,
  )

  // 2. 시퀀스 스텝 가져오기
  const steps = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequenceId))
    .orderBy(sequenceSteps.stepOrder)

  if (steps.length === 0) {
    console.log("[RegenerateEmails] 시퀀스 스텝이 없음")
    return
  }

  // 3. AI 서비스로 템플릿 재생성
  const aiService = getAITemplateGenerationService()

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (!step) continue

    const emailType = EMAIL_TYPES_2TOUCH[i]
    if (!emailType) continue

    const prompt = isKorean ? emailType.promptKr : emailType.promptEn
    const industryContext = isKorean
      ? `${surveyData.industry} 산업의 ${surveyData.target} 고객을 대상으로`
      : `for ${surveyData.target} customers in the ${surveyData.industry} industry`

    try {
      const template = await aiService.generateEmailTemplate({
        workspaceName: workspace.companyName || workspace.name,
        workspaceDescription: workspace.companyDescription || undefined,
        country: surveyData.country || "jp",
        userPrompt: `${prompt} ${industryContext}`,
      })

      // 4. 시퀀스 스텝 업데이트
      await db
        .update(sequenceSteps)
        .set({
          emailSubject: template.subject,
          emailBodyText: template.bodyText,
          emailBodyHtml: template.bodyHtml,
          updatedAt: new Date(),
        })
        .where(eq(sequenceSteps.id, step.id))

      console.log(`[RegenerateEmails] 스텝 ${i + 1} 템플릿 재생성 완료`)
    } catch (error) {
      console.error(`[RegenerateEmails] 스텝 ${i + 1} 재생성 실패:`, error)
    }
  }

  // 5. 기존 이메일들도 업데이트 (draft 상태인 것만)
  // 시퀀스 스텝의 새 템플릿을 기반으로 이메일 본문 업데이트
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (!step) continue

    // 업데이트된 스텝 정보 다시 가져오기
    const [updatedStep] = await db.select().from(sequenceSteps).where(eq(sequenceSteps.id, step.id))

    if (!updatedStep) continue

    // 해당 스텝의 draft 이메일들 업데이트
    await db
      .update(emails)
      .set({
        subject: updatedStep.emailSubject,
        bodyText: updatedStep.emailBodyText,
        bodyHtml: updatedStep.emailBodyHtml,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emails.sequenceId, sequenceId),
          eq(emails.stepId, step.id),
          eq(emails.status, "draft"),
        ),
      )
  }

  console.log("[RegenerateEmails] ✅ 모든 이메일 재생성 완료")
}
