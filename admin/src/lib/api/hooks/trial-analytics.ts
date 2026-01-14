/**
 * Trial Analytics React Query Hooks
 * 체험판 관리 대시보드 훅
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type AddExclusionParams,
  type BulkAddExclusionParams,
  type BulkExtendTrialParams,
  type ExtendTrialParams,
  type OnboardingStep,
  type TrialAnalyticsParams,
  type TrialUsersParams,
  trialAnalyticsApi,
} from "../services/trial-analytics"

// ============================================================================
// Query Keys
// ============================================================================

export const trialAnalyticsKeys = {
  all: ["trial-analytics"] as const,
  analytics: (params?: TrialAnalyticsParams) =>
    [...trialAnalyticsKeys.all, "analytics", params] as const,
  users: (params?: TrialUsersParams) => [...trialAnalyticsKeys.all, "users", params] as const,
  onboardingStep: (step: OnboardingStep) =>
    [...trialAnalyticsKeys.all, "onboarding", step] as const,
  exclusions: () => [...trialAnalyticsKeys.all, "exclusions"] as const,
  workspacesForExclusion: () => [...trialAnalyticsKeys.all, "workspaces-for-exclusion"] as const,
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get trial analytics dashboard data
 */
export function useTrialAnalytics(params?: TrialAnalyticsParams, enabled = true) {
  return useQuery({
    queryKey: trialAnalyticsKeys.analytics(params),
    queryFn: () => trialAnalyticsApi.getAnalytics(params),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  })
}

/**
 * Get trial users list
 */
export function useTrialUsers(params?: TrialUsersParams, enabled = true) {
  return useQuery({
    queryKey: trialAnalyticsKeys.users(params),
    queryFn: () => trialAnalyticsApi.getUsers(params),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // 60초마다 자동 리페치
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  })
}

/**
 * Get workspaces by onboarding step
 * 온보딩 단계별 워크스페이스 상세 조회
 */
export function useOnboardingStepWorkspaces(step: OnboardingStep | null, enabled = true) {
  return useQuery({
    queryKey: trialAnalyticsKeys.onboardingStep(step || "signup"),
    queryFn: () => trialAnalyticsApi.getWorkspacesByStep(step as OnboardingStep),
    enabled: enabled && step !== null,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Extend trial period for a workspace
 */
export function useExtendTrialMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: ExtendTrialParams) => trialAnalyticsApi.extendTrial(params),
    onSuccess: () => {
      // Invalidate all trial analytics queries
      queryClient.invalidateQueries({ queryKey: trialAnalyticsKeys.all })
    },
  })
}

/**
 * Bulk extend trial period
 */
export function useBulkExtendTrialMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: BulkExtendTrialParams) => trialAnalyticsApi.bulkExtendTrial(params),
    onSuccess: () => {
      // Invalidate all trial analytics queries
      queryClient.invalidateQueries({ queryKey: trialAnalyticsKeys.all })
    },
  })
}

// ============================================================================
// Exclusion Management Hooks (통계 제외 관리)
// ============================================================================

/**
 * Get workspaces for exclusion modal
 * 제외 설정 모달용 워크스페이스 목록 조회
 * - 비제외 워크스페이스: 최신 가입일 순 (상단)
 * - 제외된 워크스페이스: 맨 아래 (isExcluded: true)
 */
export function useWorkspacesForExclusion(enabled = true) {
  return useQuery({
    queryKey: trialAnalyticsKeys.workspacesForExclusion(),
    queryFn: () => trialAnalyticsApi.getWorkspacesForExclusion(),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Get all exclusions
 * 제외 목록 조회
 */
export function useExclusions(enabled = true) {
  return useQuery({
    queryKey: trialAnalyticsKeys.exclusions(),
    queryFn: () => trialAnalyticsApi.getExclusions(),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Add exclusion mutation
 * 워크스페이스를 통계에서 제외
 */
export function useAddExclusionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: AddExclusionParams) => trialAnalyticsApi.addExclusion(params),
    onSuccess: () => {
      // Invalidate exclusions and analytics queries
      queryClient.invalidateQueries({ queryKey: trialAnalyticsKeys.all })
    },
  })
}

/**
 * Bulk add exclusions mutation
 * 여러 워크스페이스 일괄 제외
 */
export function useBulkAddExclusionsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: BulkAddExclusionParams) => trialAnalyticsApi.bulkAddExclusions(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trialAnalyticsKeys.all })
    },
  })
}

/**
 * Remove exclusion mutation
 * 워크스페이스를 통계에 다시 포함
 */
export function useRemoveExclusionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workspaceId: string) => trialAnalyticsApi.removeExclusion(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trialAnalyticsKeys.all })
    },
  })
}

/**
 * Clear all exclusions mutation
 * 모든 제외 설정 초기화
 */
export function useClearAllExclusionsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => trialAnalyticsApi.clearAllExclusions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trialAnalyticsKeys.all })
    },
  })
}
