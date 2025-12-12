/**
 * Onboarding Service
 *
 * 워크스페이스 기반 온보딩 진행 상태 관리
 * - 온보딩 진행 CRUD
 * - 스텝별 데이터 저장
 * - 온보딩 완료 처리
 */

import { desc, eq, isNull, sql } from "drizzle-orm"
import { db } from "../db/index"
import { type OnboardingStatus, onboardingProgress } from "../db/schema/onboarding"
import { workspaces } from "../db/schema/workspaces"
import { createLog } from "./activity-log.service"

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
  // 먼저 기존 진행 상태 조회
  const [existing] = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.workspaceId, workspaceId))
    .limit(1)

  if (existing) {
    return existing as OnboardingProgressData
  }

  // 없으면 새로 생성
  const [created] = await db
    .insert(onboardingProgress)
    .values({
      workspaceId,
      status: "not_started",
      currentStep: 0,
    })
    .returning()

  return created as OnboardingProgressData
}

/**
 * 온보딩 진행 상태 조회
 */
export async function getOnboardingProgress(
  workspaceId: string,
): Promise<OnboardingProgressData | null> {
  const [result] = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.workspaceId, workspaceId))
    .limit(1)

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

// ====================================
// SURVEY DATA OPERATIONS
// ====================================

/**
 * 설문 데이터 저장 (Step 0 완료 -> Step 1 시작)
 */
export async function saveSurveyData(
  workspaceId: string,
  surveyData: OnboardingSurveyData,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

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

  // Activity Log 기록
  await createLog(workspaceId, "onboarding", progress.id, "survey_completed", {
    userId,
    details: { surveyData },
  })

  return updated as OnboardingProgressData
}

// ====================================
// STEP OPERATIONS
// ====================================

/**
 * Step 1 완료: 회사 정보 확인 완료
 */
export async function completeStep1CompanyInfo(
  workspaceId: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

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
 */
export async function completeStep2LeadSearch(
  workspaceId: string,
  selectedLeadIds: string[],
  customerGroupId?: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

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
 */
export async function completeStep3EmailGeneration(
  workspaceId: string,
  sequenceId: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

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
 */
export async function completeOnboarding(
  workspaceId: string,
  userId?: string,
): Promise<OnboardingProgressData> {
  const progress = await getOrCreateOnboardingProgress(workspaceId)

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
