import { apiFetch } from "@/lib/api/client"
import type {
  ActivityLog,
  ActivityLogsParams,
  CreateActivityLogRequest,
} from "../types/activity-log"

export const activityLogsApi = {
  list: (params?: ActivityLogsParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)
    if (params?.entityType) searchParams.append("entityType", params.entityType)
    if (params?.action) searchParams.append("action", params.action)
    if (params?.workspaceIds && params.workspaceIds.length > 0) {
      searchParams.append("workspaceIds", params.workspaceIds.join(","))
    }
    if (params?.userIds && params.userIds.length > 0) {
      searchParams.append("userIds", params.userIds.join(","))
    }
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate.toISOString())
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate.toISOString())
    }

    const query = searchParams.toString()
    return apiFetch<{
      data: ActivityLog[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/activity-logs/search${query ? `?${query}` : ""}`).then((response) => ({
      activityLogs: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  get: (logId: string) => {
    return apiFetch<ActivityLog>(`/api/v1/activity-logs/${logId}`)
  },

  create: (data: CreateActivityLogRequest) => {
    return apiFetch<ActivityLog>("/api/v1/activity-logs", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  getRecent: (limit = 20, workspaceId?: string) => {
    const searchParams = new URLSearchParams({ limit: limit.toString() })
    if (workspaceId) searchParams.append("workspaceId", workspaceId)

    return apiFetch<{ data: ActivityLog[]; limit: number }>(
      `/api/v1/activity-logs/recent?${searchParams.toString()}`
    ).then((response) => response.data)
  },

  getByEntity: (entityType: string, entityId: string, limit = 50, offset = 0) => {
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    return apiFetch<{ data: ActivityLog[]; limit: number; offset: number }>(
      `/api/v1/activity-logs/entity/${entityType}/${entityId}?${searchParams.toString()}`
    ).then((response) => response.data)
  },

  getByUser: (userId: string, limit = 50, offset = 0) => {
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    return apiFetch<{ data: ActivityLog[]; limit: number; offset: number }>(
      `/api/v1/activity-logs/user/${userId}?${searchParams.toString()}`
    ).then((response) => response.data)
  },
}
