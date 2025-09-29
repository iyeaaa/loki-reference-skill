import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { emailTemplatesApi } from "../services/email-templates"
import type {
  BulkUpdateCategoryRequest,
  BulkUpdateSharedRequest,
  CreateEmailTemplateRequest,
  EmailTemplatesParams,
  UpdateEmailTemplateRequest,
} from "../types/email-template"

// Query Keys
export const emailTemplateKeys = {
  all: ["emailTemplates"] as const,
  lists: () => [...emailTemplateKeys.all, "list"] as const,
  list: (params?: EmailTemplatesParams) => [...emailTemplateKeys.lists(), params] as const,
  detail: (id: string) => [...emailTemplateKeys.all, "detail", id] as const,
  workspace: (workspaceId: string) => [...emailTemplateKeys.all, "workspace", workspaceId] as const,
  categories: (workspaceId: string) =>
    [...emailTemplateKeys.all, "categories", workspaceId] as const,
  shared: (workspaceId: string) => [...emailTemplateKeys.all, "shared", workspaceId] as const,
}

// Queries
export function useEmailTemplates(params?: EmailTemplatesParams) {
  return useQuery({
    queryKey: emailTemplateKeys.list(params),
    queryFn: () => emailTemplatesApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useEmailTemplate(templateId: string, enabled = true) {
  return useQuery({
    queryKey: emailTemplateKeys.detail(templateId),
    queryFn: () => emailTemplatesApi.get(templateId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useEmailTemplatesByWorkspace(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: emailTemplateKeys.workspace(workspaceId),
    queryFn: () => emailTemplatesApi.getByWorkspace(workspaceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useEmailTemplateCategories(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: emailTemplateKeys.categories(workspaceId),
    queryFn: () => emailTemplatesApi.getCategories(workspaceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useSharedEmailTemplates(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: emailTemplateKeys.shared(workspaceId),
    queryFn: () => emailTemplatesApi.getShared(workspaceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// Mutations
export function useCreateEmailTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEmailTemplateRequest) => emailTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailTemplateKeys.lists() })
      toast.success("이메일 템플릿이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 템플릿 생성에 실패했습니다")
    },
  })
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: UpdateEmailTemplateRequest }) =>
      emailTemplatesApi.update(templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailTemplateKeys.detail(variables.templateId) })
      queryClient.invalidateQueries({ queryKey: emailTemplateKeys.lists() })
      toast.success("이메일 템플릿이 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 템플릿 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => emailTemplatesApi.delete(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailTemplateKeys.lists() })
      toast.success("이메일 템플릿이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 템플릿 삭제에 실패했습니다")
    },
  })
}

export function useBulkUpdateEmailTemplateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateCategoryRequest) => emailTemplatesApi.bulkUpdateCategory(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: emailTemplateKeys.lists() })
      toast.success(`${response.updatedCount || 0}개의 템플릿 카테고리가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "템플릿 카테고리 업데이트에 실패했습니다")
    },
  })
}

export function useBulkUpdateEmailTemplateShared() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateSharedRequest) => emailTemplatesApi.bulkUpdateShared(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: emailTemplateKeys.lists() })
      toast.success(`${response.updatedCount || 0}개의 템플릿 공유 상태가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "템플릿 공유 상태 업데이트에 실패했습니다")
    },
  })
}

export function useBulkDeleteEmailTemplates() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateIds: string[]) => emailTemplatesApi.bulkDelete(templateIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: emailTemplateKeys.lists() })
      toast.success(`${response.deletedCount || 0}개의 템플릿이 삭제되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "템플릿 삭제에 실패했습니다")
    },
  })
}
