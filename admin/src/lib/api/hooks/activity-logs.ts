import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { activityLogsApi } from "../services/activity-logs"
import type { ActivityLogsParams, CreateActivityLogRequest } from "../types/activity-log"

// Query Keys
export const activityLogKeys = {
  all: ["activityLogs"] as const,
  lists: () => [...activityLogKeys.all, "list"] as const,
  list: (params?: ActivityLogsParams) => [...activityLogKeys.lists(), params] as const,
  detail: (id: string) => [...activityLogKeys.all, "detail", id] as const,
  recent: (limit?: number, workspaceId?: string) =>
    [...activityLogKeys.all, "recent", limit, workspaceId] as const,
  entity: (entityType: string, entityId: string) =>
    [...activityLogKeys.all, "entity", entityType, entityId] as const,
  user: (userId: string) => [...activityLogKeys.all, "user", userId] as const,
}

// Queries
export function useActivityLogs(params?: ActivityLogsParams) {
  return useQuery({
    queryKey: activityLogKeys.list(params),
    queryFn: () => activityLogsApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useActivityLog(logId: string, enabled = true) {
  return useQuery({
    queryKey: activityLogKeys.detail(logId),
    queryFn: () => activityLogsApi.get(logId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useRecentActivityLogs(limit = 20, workspaceId?: string, enabled = true) {
  return useQuery({
    queryKey: activityLogKeys.recent(limit, workspaceId),
    queryFn: () => activityLogsApi.getRecent(limit, workspaceId),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useActivityLogsByEntity(
  entityType: string,
  entityId: string,
  limit = 50,
  offset = 0,
  enabled = true
) {
  return useQuery({
    queryKey: activityLogKeys.entity(entityType, entityId),
    queryFn: () => activityLogsApi.getByEntity(entityType, entityId, limit, offset),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useActivityLogsByUser(userId: string, limit = 50, offset = 0, enabled = true) {
  return useQuery({
    queryKey: activityLogKeys.user(userId),
    queryFn: () => activityLogsApi.getByUser(userId, limit, offset),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Mutations
export function useCreateActivityLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateActivityLogRequest) => activityLogsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityLogKeys.lists() })
      queryClient.invalidateQueries({ queryKey: activityLogKeys.recent() })
    },
    onError: (error: Error) => {
      toast.error(error.message || "활동 로그 생성에 실패했습니다")
    },
  })
}
