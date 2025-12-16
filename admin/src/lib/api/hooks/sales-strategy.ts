/**
 * Sales Strategy React Query Hooks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { apiFetch } from "../client"

// ====================================
// TYPES
// ====================================

export interface SalesStrategyData {
  companyName?: string
  industry: string
  target: string
  country: string
  experience: string
  websiteUrl?: string
}

// ====================================
// QUERY KEYS
// ====================================

export const salesStrategyKeys = {
  all: ["sales-strategy"] as const,
  detail: (workspaceId: string) => [...salesStrategyKeys.all, "detail", workspaceId] as const,
}

// ====================================
// QUERIES
// ====================================

/**
 * Sales Strategy 조회 훅
 */
export function useSalesStrategy(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: salesStrategyKeys.detail(workspaceId),
    queryFn: async () => {
      const response = await apiFetch<{ data: SalesStrategyData }>(
        `/api/v1/workspace-sales-strategies/${workspaceId}`,
      )
      return response.data
    },
    enabled: enabled && !!workspaceId,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  })
}

// ====================================
// MUTATIONS
// ====================================

/**
 * Sales Strategy 업데이트 mutation
 */
export function useUpdateSalesStrategy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workspaceId, data }: { workspaceId: string; data: SalesStrategyData }) => {
      const response = await apiFetch<{ data: SalesStrategyData }>(
        `/api/v1/workspace-sales-strategies/${workspaceId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      )
      return response.data
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(salesStrategyKeys.detail(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "판매 전략 업데이트에 실패했습니다")
    },
  })
}
