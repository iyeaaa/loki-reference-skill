import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { workspacesApi } from "../services/workspaces"
import type { CreateWorkspaceData, UpdateWorkspaceData, WorkspacesParams } from "../types/workspace"

// 1. Query Keys
export const workspaceKeys = {
  all: ["workspaces"] as const,
  lists: () => [...workspaceKeys.all, "list"] as const,
  list: (params?: WorkspacesParams) => [...workspaceKeys.lists(), params] as const,
  detail: (id: string) => [...workspaceKeys.all, "detail", id] as const,
  byOwner: (ownerId: string) => [...workspaceKeys.all, "owner", ownerId] as const,
  byUser: (userId: string) => [...workspaceKeys.all, "user", userId] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, "members", workspaceId] as const,
}

// 2. Queries
export function useWorkspaces(params?: WorkspacesParams) {
  return useQuery({
    queryKey: workspaceKeys.list(params),
    queryFn: () => workspacesApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useSuspenseWorkspaces(params?: WorkspacesParams) {
  return useSuspenseQuery({
    queryKey: workspaceKeys.list(params),
    queryFn: () => workspacesApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useWorkspace(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => workspacesApi.get(workspaceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useWorkspacesByOwner(ownerId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.byOwner(ownerId),
    queryFn: () => workspacesApi.getByOwner(ownerId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useUserWorkspaces(userId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.byUser(userId),
    queryFn: () => workspacesApi.getUserWorkspaces(userId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useWorkspaceMembers(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => workspacesApi.getMembers(workspaceId),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
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

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workspaceId: string) => workspacesApi.delete(workspaceId),
    onSuccess: () => {
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
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
      // Invalidate all workspace queries to update sidebar
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
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
      toast.success("멤버가 제거되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 제거에 실패했습니다")
    },
  })
}
