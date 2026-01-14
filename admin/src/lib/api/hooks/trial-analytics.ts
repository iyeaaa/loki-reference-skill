/**
 * Trial Analytics React Query Hooks
 * 체험판 관리 대시보드 훅
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
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
