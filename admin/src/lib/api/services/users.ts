import { apiFetch } from "@/lib/api/client"
import type { User, UserStats, UsersParams } from "../types"

interface CreateUserData {
  username: string
  email: string
  password?: string
  userRole: string
  isActive: boolean
  departmentId: number
  employeeId: string
}

export const usersApi = {
  list: (params?: UsersParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)
    if (params?.role && params.role !== "all") {
      searchParams.append("role", params.role)
    }
    if (params?.status && params.status !== "all") {
      searchParams.append("isActive", params.status === "active" ? "true" : "false")
    }

    const query = searchParams.toString()
    return apiFetch<{
      data: User[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/users/search${query ? `?${query}` : ""}`).then((response) => ({
      users: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  get: (userId: string) => {
    return apiFetch<User>(`/api/v1/users/${userId}`)
  },

  stats: async () => {
    const response = await apiFetch<{
      data: User[]
      total: number
    }>("/api/v1/users?limit=1000")

    const users = response.data
    const stats: UserStats = {
      total: response.total,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
      byRole: {
        admin: users.filter((u) => u.userRole === "admin").length,
        user: users.filter((u) => u.userRole === "user").length,
        internalReviewer: 0,
        externalReviewer: 0,
      },
    }
    return stats
  },

  create: (data: CreateUserData) => {
    return apiFetch<User>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({
        username: data.username,
        email: data.email,
        passwordHash: data.password || "",
        userRole: data.userRole,
        isActive: data.isActive,
        departmentId: data.departmentId,
        employeeId: data.employeeId,
      }),
    })
  },

  update: (userId: string, data: Partial<User>) => {
    return apiFetch<User>(`/api/v1/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        username: data.username,
        email: data.email,
        userRole: data.userRole,
        isActive: data.isActive,
        departmentId: data.departmentId,
        employeeId: data.employeeId,
      }),
    })
  },

  delete: (userId: string) => {
    return apiFetch(`/api/v1/users/${userId}`, {
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
    return apiFetch(`/api/v1/users/${userId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ passwordHash: newPassword }),
    })
  },
}
