import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import {
  type ApplyResultsResponse,
  contactEnrichmentApi,
  type EnrichmentBatchResult,
  type SingleEnrichmentResult,
} from "../services/contact-enrichment"
import { leadKeys } from "./leads"

// Query Keys
export const contactEnrichmentKeys = {
  all: ["contact-enrichment"] as const,
  emailStatus: (leadIds: string[]) =>
    [...contactEnrichmentKeys.all, "email-status", leadIds] as const,
  leadsWithoutEmail: (leadIds: string[]) =>
    [...contactEnrichmentKeys.all, "without-email", leadIds] as const,
}

// Queries
export function useCheckEmailStatus(leadIds: string[], enabled = true) {
  return useQuery({
    queryKey: contactEnrichmentKeys.emailStatus(leadIds),
    queryFn: () => contactEnrichmentApi.checkEmailStatus(leadIds),
    enabled: enabled && leadIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useLeadsWithoutEmail(leadIds: string[], enabled = true) {
  return useQuery({
    queryKey: contactEnrichmentKeys.leadsWithoutEmail(leadIds),
    queryFn: () => contactEnrichmentApi.getLeadsWithoutEmail(leadIds),
    enabled: enabled && leadIds.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Mutations
export function useEnrichLeads() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leadIds: string[]) => contactEnrichmentApi.enrichLeads(leadIds),
    onSuccess: (data: EnrichmentBatchResult) => {
      // Invalidate leads list to refresh with new emails
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })

      if (data.success > 0) {
        toast.success(`${data.success}개 리드에서 이메일을 찾았어요!`, {
          duration: 5000,
        })
      } else if (data.total > 0) {
        toast.error("이메일을 찾지 못했습니다", {
          duration: 5000,
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "정보 보강에 실패했습니다")
    },
  })
}

export function useApplyEnrichmentResults() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (results: SingleEnrichmentResult[]) => contactEnrichmentApi.applyResults(results),
    onSuccess: (data: ApplyResultsResponse) => {
      // Invalidate leads list to refresh with new data
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })

      if (data.applied > 0) {
        toast.success(`${data.applied}개 리드에 정보가 적용되었습니다`)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "결과 적용에 실패했습니다")
    },
  })
}
