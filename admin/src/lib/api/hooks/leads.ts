import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { leadsApi } from "../services/leads"
import type {
  BulkUpdateBusinessTypeRequest,
  BulkUpdateLeadStatusRequest,
  CreateLeadRequest,
  Lead,
  LeadsParams,
  UpdateLeadRequest,
} from "../types/lead"
import { customerGroupKeys } from "./customer-groups"

// Query Keys
export const leadKeys = {
  all: ["leads"] as const,
  lists: () => [...leadKeys.all, "list"] as const,
  list: (params?: LeadsParams) => [...leadKeys.lists(), params] as const,
  detail: (id: string) => [...leadKeys.all, "detail", id] as const,
}

// Queries
export function useLeads(params?: LeadsParams) {
  return useQuery({
    queryKey: leadKeys.list(params),
    queryFn: () => leadsApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useLead(leadId: string, enabled = true) {
  return useQuery({
    queryKey: leadKeys.detail(leadId),
    queryFn: () => leadsApi.get(leadId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// Mutations
export function useCreateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateLeadRequest) => leadsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.all })
      toast.success("리드가 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "리드 생성에 실패했습니다")
    },
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: UpdateLeadRequest }) =>
      leadsApi.update(leadId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: leadKeys.detail(variables.leadId),
      })
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() })
      toast.success("리드 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "리드 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leadId: string) => leadsApi.delete(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() })
      toast.success("리드가 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "리드 삭제에 실패했습니다")
    },
  })
}

export function useBulkUpdateLeadStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateLeadStatusRequest) => leadsApi.bulkUpdateStatus(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() })
      toast.success(`${response.updatedCount || 0}개의 리드 상태가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "리드 상태 업데이트에 실패했습니다")
    },
  })
}

export function useBulkUpdateLeadBusinessType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateBusinessTypeRequest) => leadsApi.bulkUpdateBusinessType(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() })
      toast.success(`${response.updatedCount || 0}개의 리드 업종이 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "리드 업종 업데이트에 실패했습니다")
    },
  })
}

export function useBulkDeleteLeads() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leadIds: string[]) => leadsApi.bulkDelete(leadIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.lists() })
      toast.success(`${response.deletedCount || 0}개의 리드가 삭제되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "리드 삭제에 실패했습니다")
    },
  })
}

export function useDownloadSelectedLeadsCSV() {
  return useMutation({
    mutationFn: ({ leadIds, leadsData }: { leadIds: string[]; leadsData?: Lead[] }) =>
      leadsApi.downloadSelectedLeadsCSV(leadIds, leadsData),
    onSuccess: (response) => {
      toast.success(`선택된 리드 데이터가 다운로드되었습니다 (${response.filename})`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "선택된 리드 CSV 다운로드에 실패했습니다")
    },
  })
}
