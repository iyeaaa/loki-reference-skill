import { apiFetch } from "@/lib/api/client"
import type { User, UserStats, UsersParams, UsersResponse } from "../types"
export const usersApi = {
  list: (params?: UsersParams) => {
    const searchParams = new URLSearchParams()

    if (params?.page) searchParams.append("page", params.page.toString())
    if (params?.limit) searchParams.append("limit", params.limit.toString())
    if (params?.search) searchParams.append("search", params.search)

    if (params?.roles?.length) {
      searchParams.append("roles", params.roles.join(","))
    } else if (params?.role && params.role !== "all") {
      searchParams.append("role", params.role)
    }

    if (params?.statuses?.length) {
      searchParams.append("isActive", params.statuses.join(","))
    } else if (params?.status && params.status !== "all") {
      searchParams.append("isActive", params.status === "active" ? "true" : "false")
    }

    if (params?.departments?.length) {
      searchParams.append("departmentIds", params.departments.join(","))
    }

    const query = searchParams.toString()
    return apiFetch<UsersResponse>(`/api/v1/admin/users${query ? `?${query}` : ""}`)
  },

  get: (userId: string) => {
    return apiFetch<User>(`/api/v1/admin/users/${userId}`)
  },

  stats: () => {
    return apiFetch<UserStats>("/api/v1/admin/users/stats")
  },

  create: (data: Partial<User>) => {
    return apiFetch<User>("/api/v1/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (userId: string, data: Partial<User>) => {
    return apiFetch<User>(`/api/v1/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (userId: string) => {
    return apiFetch(`/api/v1/admin/users/${userId}`, {
      method: "DELETE",
    })
  },

  bulkUpdateStatus: (userIds: string[], isActive: boolean) => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/users/bulk/status", {
      method: "PUT",
      body: JSON.stringify({
        userIds,
        isActive,
      }),
    })
  },

  bulkUpdateRole: (userIds: string[], role: string) => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/users/bulk/role", {
      method: "PUT",
      body: JSON.stringify({
        userIds,
        userRole: role,
      }),
    })
  },

  bulkUpdateDepartment: (userIds: string[], departmentId: string) => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/users/bulk/department", {
      method: "PUT",
      body: JSON.stringify({
        userIds,
        departmentId,
      }),
    })
  },

  changePassword: (userId: string, newPassword: string) => {
    return apiFetch(`/api/v1/admin/users/${userId}/password`, {
      method: "POST",
      body: JSON.stringify({ password: newPassword }),
    })
  },
}
