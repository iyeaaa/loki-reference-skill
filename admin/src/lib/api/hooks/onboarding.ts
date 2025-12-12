/**
 * Onboarding React Query Hooks
 *
 * 워크스페이스 기반 온보딩 진행 관리 훅
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { type OnboardingSurveyData, onboardingApi } from "../services/onboarding"

// ====================================
// QUERY KEYS
// ====================================

export const onboardingKeys = {
  all: ["onboarding"] as const,
  progress: (workspaceId: string) => [...onboardingKeys.all, "progress", workspaceId] as const,
  incomplete: () => [...onboardingKeys.all, "incomplete"] as const,
  stats: () => [...onboardingKeys.all, "stats"] as const,
}

// ====================================
// QUERIES
// ====================================

/**
 * 온보딩 진행 상태 조회 훅
 * - staleTime: 0 - 항상 최신 데이터
 * - gcTime: 0 - 캐시 사용 안함
 */
export function useOnboardingProgress(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.progress(workspaceId),
    queryFn: () => onboardingApi.getProgress(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime: 0, // 항상 최신 데이터
    gcTime: 0, // 캐시 사용 안함
  })
}

/**
 * 미완료 온보딩 목록 조회 훅 (관리자용)
 */
export function useIncompleteOnboardings(limit?: number, enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.incomplete(),
    queryFn: () => onboardingApi.getIncomplete(limit),
    enabled,
    staleTime: 30 * 1000, // 30초
  })
}

/**
 * 온보딩 통계 조회 훅 (관리자용)
 */
export function useOnboardingStats(enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.stats(),
    queryFn: onboardingApi.getStats,
    enabled,
    staleTime: 60 * 1000, // 1분
  })
}

// ====================================
// MUTATIONS
// ====================================

/**
 * 설문 데이터 저장 mutation
 */
export function useSaveSurvey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      surveyData,
      userId,
    }: {
      workspaceId: string
      surveyData: OnboardingSurveyData
      userId?: string
    }) => onboardingApi.saveSurvey(workspaceId, surveyData, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "설문 저장에 실패했습니다")
    },
  })
}

/**
 * Step 1 완료 mutation
 */
export function useCompleteStep1() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId?: string }) =>
      onboardingApi.completeStep1(workspaceId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "회사 정보 확인 처리에 실패했습니다")
    },
  })
}

/**
 * Step 2 완료 mutation
 */
export function useCompleteStep2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      selectedLeadIds,
      customerGroupId,
      userId,
    }: {
      workspaceId: string
      selectedLeadIds: string[]
      customerGroupId?: string
      userId?: string
    }) => onboardingApi.completeStep2(workspaceId, selectedLeadIds, customerGroupId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "리드 검색 완료 처리에 실패했습니다")
    },
  })
}

/**
 * Step 3 완료 mutation
 */
export function useCompleteStep3() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      sequenceId,
      userId,
    }: {
      workspaceId: string
      sequenceId: string
      userId?: string
    }) => onboardingApi.completeStep3(workspaceId, sequenceId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 시퀀스 생성 처리에 실패했습니다")
    },
  })
}

/**
 * Step 4 완료 mutation
 */
export function useCompleteStep4() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId?: string }) =>
      onboardingApi.completeStep4(workspaceId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 연동 완료 처리에 실패했습니다")
    },
  })
}

/**
 * 온보딩 완료 mutation
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId?: string }) =>
      onboardingApi.complete(workspaceId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
      queryClient.invalidateQueries({ queryKey: onboardingKeys.stats() })
    },
    onError: (error: Error) => {
      toast.error(error.message || "온보딩 완료 처리에 실패했습니다")
    },
  })
}

/**
 * 현재 스텝 업데이트 mutation
 */
export function useUpdateOnboardingStep() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, step }: { workspaceId: string; step: number }) =>
      onboardingApi.updateStep(workspaceId, step),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "스텝 업데이트에 실패했습니다")
    },
  })
}

/**
 * 온보딩 리셋 mutation (개발/테스트용)
 */
export function useResetOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workspaceId: string) => onboardingApi.reset(workspaceId),
    onSuccess: (data, workspaceId) => {
      queryClient.setQueryData(onboardingKeys.progress(workspaceId), data)
      queryClient.invalidateQueries({ queryKey: onboardingKeys.stats() })
      toast.success("온보딩 상태가 리셋되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "온보딩 리셋에 실패했습니다")
    },
  })
}

// ====================================
// HELPER HOOKS
// ====================================

/**
 * 온보딩 완료 여부 확인 훅
 */
export function useIsOnboardingComplete(workspaceId: string, enabled = true) {
  const { data, isLoading } = useOnboardingProgress(workspaceId, enabled)
  return {
    isComplete: data?.completedAt !== null,
    isLoading,
    currentStep: data?.currentStep || 0,
    status: data?.status || "not_started",
  }
}
