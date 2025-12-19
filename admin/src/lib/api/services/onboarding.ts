/**
 * Onboarding API Service
 *
 * 워크스페이스 기반 온보딩 진행 API
 */

import { apiFetch } from "@/lib/api/client"

// ====================================
// TYPES
// ====================================

export type OnboardingSurveyData = {
  industry?: string
  target?: string
  country?: string
  experience?: string
  lang?: string
}

export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed" | "stalled"

export type OnboardingProgressData = {
  id: string
  workspaceId: string
  status:
    | "not_started"
    | "survey_completed"
    | "company_info"
    | "lead_search"
    | "email_generation"
    | "email_link"
    | "completed"
  currentStep: number
  surveyData: OnboardingSurveyData | null
  selectedLeadIds: string[] | null
  generatedSequenceId: string | null
  customerGroupId: string | null
  companyInfoCompleted: string | null
  leadSearchCompleted: string | null
  emailGenerationCompleted: string | null
  emailLinkCompleted: string | null
  completedAt: string | null
  // BullMQ Job 추적 필드
  jobId: string | null
  jobStatus: JobStatus | null
  createdAt: string
  updatedAt: string
}

export type OnboardingStats = {
  total: number
  completed: number
  inProgress: number
  notStarted: number
  avgStepCompleted: number
}

// ====================================
// API FUNCTIONS
// ====================================

export const onboardingApi = {
  /**
   * 워크스페이스의 온보딩 진행 상태 조회 (없으면 생성)
   */
  getProgress: (workspaceId: string) => {
    // console.log("[OnboardingApi] getProgress called, workspaceId:", workspaceId)
    return apiFetch<{ data: OnboardingProgressData }>(
      `/api/v1/onboarding/workspace/${workspaceId}`,
    ).then((res) => {
      // console.log("[OnboardingApi] getProgress response:")
      // console.log("[OnboardingApi]   - id:", res.data.id)
      // console.log("[OnboardingApi]   - status:", res.data.status)
      // console.log("[OnboardingApi]   - currentStep:", res.data.currentStep)
      // console.log("[OnboardingApi]   - surveyData:", JSON.stringify(res.data.surveyData, null, 2))
      return res.data
    })
  },

  /**
   * 설문 데이터 저장 (온보딩 시작)
   */
  saveSurvey: (workspaceId: string, surveyData: OnboardingSurveyData, userId?: string) => {
    // console.log("[OnboardingApi] saveSurvey called")
    // console.log("[OnboardingApi]   - workspaceId:", workspaceId)
    // console.log("[OnboardingApi]   - surveyData:", JSON.stringify(surveyData, null, 2))
    // console.log("[OnboardingApi]   - userId:", userId)
    return apiFetch<{ data: OnboardingProgressData }>(
      `/api/v1/onboarding/workspace/${workspaceId}/survey`,
      {
        method: "POST",
        body: JSON.stringify({ ...surveyData, userId }),
      },
    ).then((res) => {
      // console.log("[OnboardingApi] saveSurvey response:")
      // console.log("[OnboardingApi]   - id:", res.data.id)
      // console.log("[OnboardingApi]   - status:", res.data.status)
      // console.log(
      //   "[OnboardingApi]   - surveyData saved:",
      //   JSON.stringify(res.data.surveyData, null, 2),
      // )
      return res.data
    })
  },

  /**
   * Step 1 완료: 회사 정보 확인
   */
  completeStep1: (workspaceId: string, userId?: string) =>
    apiFetch<{ data: OnboardingProgressData }>(
      `/api/v1/onboarding/workspace/${workspaceId}/step1/complete`,
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      },
    ).then((res) => res.data),

  /**
   * Step 2 완료: 리드 검색 및 저장
   */
  completeStep2: (
    workspaceId: string,
    selectedLeadIds: string[],
    customerGroupId?: string,
    userId?: string,
  ) =>
    apiFetch<{ data: OnboardingProgressData }>(
      `/api/v1/onboarding/workspace/${workspaceId}/step2/complete`,
      {
        method: "POST",
        body: JSON.stringify({ selectedLeadIds, customerGroupId, userId }),
      },
    ).then((res) => res.data),

  /**
   * Step 3 완료: 이메일 시퀀스 생성
   */
  completeStep3: (workspaceId: string, sequenceId: string, userId?: string) =>
    apiFetch<{ data: OnboardingProgressData }>(
      `/api/v1/onboarding/workspace/${workspaceId}/step3/complete`,
      {
        method: "POST",
        body: JSON.stringify({ sequenceId, userId }),
      },
    ).then((res) => res.data),

  /**
   * Step 4 완료: 이메일 연동
   */
  completeStep4: (workspaceId: string, userId?: string) =>
    apiFetch<{ data: OnboardingProgressData }>(
      `/api/v1/onboarding/workspace/${workspaceId}/step4/complete`,
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      },
    ).then((res) => res.data),

  /**
   * 온보딩 완료 처리
   */
  complete: (workspaceId: string, userId?: string) =>
    apiFetch<{ data: OnboardingProgressData }>(
      `/api/v1/onboarding/workspace/${workspaceId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      },
    ).then((res) => res.data),

  /**
   * 현재 스텝 업데이트 (자유 이동)
   */
  updateStep: (workspaceId: string, step: number) =>
    apiFetch<{ data: OnboardingProgressData }>(`/api/v1/onboarding/workspace/${workspaceId}/step`, {
      method: "PATCH",
      body: JSON.stringify({ step }),
    }).then((res) => res.data),

  /**
   * 미완료 온보딩 목록 (관리자용)
   */
  getIncomplete: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : ""
    return apiFetch<{
      data: Array<{
        id: string
        workspaceId: string
        workspaceName: string
        status: string
        currentStep: number
        surveyData: OnboardingSurveyData | null
        createdAt: string
        updatedAt: string
      }>
    }>(`/api/v1/onboarding/incomplete${params}`).then((res) => res.data)
  },

  /**
   * 온보딩 통계 (관리자용)
   */
  getStats: () =>
    apiFetch<{ data: OnboardingStats }>("/api/v1/onboarding/stats").then((res) => res.data),

  /**
   * 온보딩 리셋 (개발/테스트용)
   */
  reset: (workspaceId: string) =>
    apiFetch<{ data: OnboardingProgressData; message: string }>(
      `/api/v1/onboarding/workspace/${workspaceId}/reset`,
      { method: "POST" },
    ).then((res) => res.data),
}
