import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { translateCompanyName, workspacesApi } from "../services/workspaces"
import type {
  CreateWorkspaceData,
  CreateWorkspaceProductData,
  UpdateWorkspaceData,
  UpdateWorkspaceProductData,
  WorkspacesParams,
} from "../types/workspace"
import { billingKeys } from "./billing"
import { iamKeys } from "./iam"

// 1. Query Keys
export const workspaceKeys = {
  all: ["workspaces"] as const,
  lists: () => [...workspaceKeys.all, "list"] as const,
  list: (params?: WorkspacesParams) => [...workspaceKeys.lists(), params] as const,
  detail: (id: string) => [...workspaceKeys.all, "detail", id] as const,
  withProducts: (id: string) => [...workspaceKeys.all, "with-products", id] as const,
  byOwner: (ownerId: string) => [...workspaceKeys.all, "owner", ownerId] as const,
  byUser: () => [...workspaceKeys.all, "user"] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, "members", workspaceId] as const,
  products: (workspaceId: string) => [...workspaceKeys.all, "products", workspaceId] as const,
  product: (workspaceId: string, productId: string) =>
    [...workspaceKeys.all, "products", workspaceId, productId] as const,
  subscription: (workspaceId: string) =>
    [...workspaceKeys.all, "subscription", workspaceId] as const,
}

// 2. Queries
export function useWorkspaces(params?: WorkspacesParams) {
  return useQuery({
    queryKey: workspaceKeys.list(params),
    queryFn: () => workspacesApi.list(params),
    staleTime: 0, // 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useSuspenseWorkspaces(params?: WorkspacesParams) {
  return useSuspenseQuery({
    queryKey: workspaceKeys.list(params),
    queryFn: () => workspacesApi.list(params),
    staleTime: 0, // 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useWorkspace(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => workspacesApi.get(workspaceId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}

export function useWorkspacesByOwner(ownerId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.byOwner(ownerId),
    queryFn: () => workspacesApi.getByOwner(ownerId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}

export function useUserWorkspaces(enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.byUser(),
    queryFn: () => workspacesApi.getUserWorkspaces(),
    enabled,
    staleTime: 30 * 1000, // 30초 캐시 - 중복 호출 방지
    gcTime: 10 * 60 * 1000,
  })
}

export function useSuspenseUserWorkspaces() {
  return useSuspenseQuery({
    queryKey: workspaceKeys.byUser(),
    queryFn: () => workspacesApi.getUserWorkspaces(),
    staleTime: 30 * 1000, // 30초 캐시 - 중복 호출 방지
    gcTime: 10 * 60 * 1000,
  })
}

export function useWorkspaceMembers(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => workspacesApi.getMembers(workspaceId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useWorkspaceSubscription(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.subscription(workspaceId),
    queryFn: () => workspacesApi.getSubscription(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000, // 30초 캐시
    gcTime: 10 * 60 * 1000,
    retry: 1, // 구독이 없을 수 있으므로 재시도 최소화
  })
}

// 3. Mutations
export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateWorkspaceData) => workspacesApi.create(data),
    onSuccess: () => {
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      // 워크스페이스 생성 시 구독도 생성되므로 billing 캐시도 갱신
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() })
      queryClient.invalidateQueries({ queryKey: billingKeys.customers() })
      // IAM 역할도 생성되므로 IAM 캐시도 갱신
      queryClient.invalidateQueries({ queryKey: iamKeys.roles() })
      toast.success("워크스페이스가 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "워크스페이스 생성에 실패했습니다")
    },
  })
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, data }: { workspaceId: string; data: UpdateWorkspaceData }) =>
      workspacesApi.update(workspaceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.workspaceId),
      })
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      toast.success("워크스페이스 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "워크스페이스 업데이트에 실패했습니다")
    },
  })
}

// Partial update workspace (PATCH) - for updating specific fields only
export function usePatchWorkspace(options?: { showToast?: boolean }) {
  const queryClient = useQueryClient()
  const showToast = options?.showToast ?? false

  return useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string
      data: Partial<{
        name: string
        description: string
        ownerId: string
        isActive: boolean
        companyName: string
        companyWebsite: string | null
        companyPhone: string
        industry: string
        companySize: string
        companyAddress: string
        companyDescription: string
      }>
    }) => workspacesApi.patch(workspaceId, data),
    onSuccess: (_, variables) => {
      // Invalidate workspace detail query
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.workspaceId),
      })
      // Invalidate user workspaces query (for Step 3 to get updated data)
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      if (showToast) {
        toast.success("워크스페이스 정보가 업데이트되었습니다")
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "워크스페이스 업데이트에 실패했습니다")
    },
  })
}

export function useEnrichWorkspace() {
  return useMutation({
    mutationFn: ({ workspaceId, websiteUrl }: { workspaceId: string; websiteUrl: string }) =>
      workspacesApi.enrichWorkspace(workspaceId, websiteUrl),
    onSuccess: () => {
      toast.success("회사 정보 분석이 시작되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "회사 정보 분석 시작에 실패했습니다")
    },
    mutationKey: ["enrich"],
  })
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workspaceId: string) => workspacesApi.delete(workspaceId),
    onSuccess: () => {
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      // 워크스페이스 삭제 시 연관된 구독, IAM 역할도 삭제되므로 캐시 갱신
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() })
      queryClient.invalidateQueries({ queryKey: iamKeys.all })
      toast.success("워크스페이스가 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "워크스페이스 삭제에 실패했습니다")
    },
  })
}

export function useBulkUpdateWorkspaceStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { workspaceIds: string[]; isActive: boolean }) =>
      workspacesApi.bulkUpdateStatus(data.workspaceIds, data.isActive),
    onSuccess: (response) => {
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      toast.success(`${response.updatedCount || 0}개의 워크스페이스 상태가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "워크스페이스 상태 업데이트에 실패했습니다")
    },
  })
}

export function useTransferOwnership() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, newOwnerId }: { workspaceId: string; newOwnerId: string }) =>
      workspacesApi.transferOwnership(workspaceId, newOwnerId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.workspaceId),
      })
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      })
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      // 소유권 이전 시 IAM 역할도 변경되므로 캐시 갱신
      queryClient.invalidateQueries({ queryKey: iamKeys.all })
      toast.success("워크스페이스 소유권이 이전되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "소유권 이전에 실패했습니다")
    },
  })
}

// Workspace member mutations
export function useAddWorkspaceMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string
      data: {
        userId: string
        role?: "owner" | "admin" | "member" | "viewer"
        invitedBy?: string
      }
    }) => workspacesApi.addMember(workspaceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      })
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.all,
      })
      // 멤버 추가 시 IAM 역할도 할당되므로 캐시 갱신
      queryClient.invalidateQueries({ queryKey: iamKeys.all })
      toast.success("멤버가 추가되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 추가에 실패했습니다")
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      memberId,
      role,
    }: {
      workspaceId: string
      memberId: string
      role: string
    }) => workspacesApi.updateMemberRole(workspaceId, memberId, role),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      })
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.all,
      })
      // 역할 변경 시 IAM 역할도 동기화되므로 캐시 갱신
      queryClient.invalidateQueries({ queryKey: iamKeys.all })
      toast.success("멤버 역할이 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 역할 업데이트에 실패했습니다")
    },
  })
}

export function useUpdateMemberStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      memberId,
      status,
    }: {
      workspaceId: string
      memberId: string
      status: string
    }) => workspacesApi.updateMemberStatus(workspaceId, memberId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      })
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.all,
      })
      toast.success("멤버 상태가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 상태 업데이트에 실패했습니다")
    },
  })
}

export function useRemoveWorkspaceMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, memberId }: { workspaceId: string; memberId: string }) =>
      workspacesApi.removeMember(workspaceId, memberId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      })
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.all,
      })
      // 멤버 제거 시 IAM 역할도 해제되므로 캐시 갱신
      queryClient.invalidateQueries({ queryKey: iamKeys.all })
      toast.success("멤버가 제거되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 제거에 실패했습니다")
    },
  })
}

// ====================================
// WORKSPACE PRODUCTS HOOKS
// ====================================

// Query hooks
export function useWorkspaceWithProducts(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.withProducts(workspaceId),
    queryFn: () => workspacesApi.getWithProducts(workspaceId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}

export function useWorkspaceProducts(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.products(workspaceId),
    queryFn: () => workspacesApi.listProducts(workspaceId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useWorkspaceProduct(workspaceId: string, productId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.product(workspaceId, productId),
    queryFn: () => workspacesApi.getProduct(workspaceId, productId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}

// Mutation hooks
export function useCreateWorkspaceProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string
      data: CreateWorkspaceProductData
    }) => workspacesApi.createProduct(workspaceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.products(variables.workspaceId),
      })
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.withProducts(variables.workspaceId),
      })
      toast.success("제품이 추가되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "제품 추가에 실패했습니다")
    },
  })
}

export function useUpdateWorkspaceProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      productId,
      data,
    }: {
      workspaceId: string
      productId: string
      data: UpdateWorkspaceProductData
    }) => workspacesApi.updateProduct(workspaceId, productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.product(variables.workspaceId, variables.productId),
      })
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.products(variables.workspaceId),
      })
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.withProducts(variables.workspaceId),
      })
      toast.success("제품 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "제품 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteWorkspaceProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, productId }: { workspaceId: string; productId: string }) =>
      workspacesApi.deleteProduct(workspaceId, productId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.products(variables.workspaceId),
      })
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.withProducts(variables.workspaceId),
      })
      toast.success("제품이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "제품 삭제에 실패했습니다")
    },
  })
}

// Translate company name hook
export function useTranslateCompanyName() {
  return useMutation({
    mutationFn: ({
      companyName,
      targetLanguage = "English",
    }: {
      companyName: string
      targetLanguage?: string
    }) => translateCompanyName(companyName, targetLanguage),
  })
}
