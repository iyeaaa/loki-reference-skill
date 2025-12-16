import { apiFetch } from "@/lib/api/client"
import type { User, UserStats, UsersParams } from "../types"

type CreateUserData = {
  username: string
  email: string
  password?: string
  userRole: string
  isActive: boolean
  departmentId: number
  employeeId: string
}

export const usersApi = {
  // Get all active users without pagination
  getAll: () => apiFetch<User[]>("/api/v1/users/all"),

  list: (params?: UsersParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) {
      searchParams.append("search", params.search)
    }
    if (params?.role && params.role !== "all") {
      searchParams.append("role", params.role)
    }
    if (params?.status && params.status !== "all") {
      searchParams.append("isActive", params.status === "active" ? "true" : "false")
    }
    if (params?.departmentIds && params.departmentIds.length > 0) {
      searchParams.append("departmentIds", params.departmentIds.join(","))
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

  get: (userId: string) => apiFetch<User>(`/api/v1/users/${userId}`),

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

  create: (data: CreateUserData) =>
    apiFetch<User>("/api/v1/users", {
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
    }),

  update: (userId: string, data: Partial<User>) =>
    apiFetch<User>(`/api/v1/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        username: data.username,
        email: data.email,
        userRole: data.userRole,
        isActive: data.isActive,
        departmentId: data.departmentId,
        employeeId: data.employeeId,
      }),
    }),

  delete: (userId: string) =>
    apiFetch(`/api/v1/users/${userId}`, {
      method: "DELETE",
    }),

  bulkUpdateStatus: (userIds: string[], isActive: boolean) =>
    apiFetch<{ updatedCount: number }>("/api/v1/admin/users/bulk/status", {
      method: "PUT",
      body: JSON.stringify({
        userIds,
        isActive,
      }),
    }),

  bulkUpdateRole: (userIds: string[], role: string) =>
    apiFetch<{ updatedCount: number }>("/api/v1/admin/users/bulk/role", {
      method: "PUT",
      body: JSON.stringify({
        userIds,
        userRole: role,
      }),
    }),

  bulkUpdateDepartment: (userIds: string[], departmentId: string) =>
    apiFetch<{ updatedCount: number }>("/api/v1/admin/users/bulk/department", {
      method: "PUT",
      body: JSON.stringify({
        userIds,
        departmentId,
      }),
    }),

  changePassword: (userId: string, newPassword: string) =>
    apiFetch(`/api/v1/users/${userId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ passwordHash: newPassword }),
    }),

  // ====================================
  // ONBOARDING API
  // ====================================

  /** 온보딩 상태 조회 */
  getOnboardingStatus: (userId: string) =>
    apiFetch<{
      userId: string
      survey: OnboardingSurvey | null
      currentStep: number
      isCompleted: boolean
      completedAt: string | null
    }>(`/api/v1/users/${userId}/onboarding`),

  /** 온보딩 진행 단계 업데이트 */
  updateOnboardingStep: (userId: string, step: number) =>
    apiFetch<{ success: boolean; currentStep: number }>(`/api/v1/users/${userId}/onboarding/step`, {
      method: "PATCH",
      body: JSON.stringify({ step }),
    }),

  /** 온보딩 완료 처리 */
  completeOnboarding: (userId: string) =>
    apiFetch<{ success: boolean; completedAt: string }>(
      `/api/v1/users/${userId}/onboarding/complete`,
      {
        method: "POST",
      },
    ),

  /** 온보딩 설문 업데이트 */
  updateOnboardingSurvey: (userId: string, survey: OnboardingSurvey) =>
    apiFetch<{ success: boolean; survey: OnboardingSurvey }>(
      `/api/v1/users/${userId}/onboarding/survey`,
      {
        method: "PATCH",
        body: JSON.stringify(survey),
      },
    ),
}

// ====================================
// TYPES
// ====================================

export type OnboardingSurvey = {
  industry?: string
  target?: string
  country?: string
  experience?: string
  lang?: string
  completedAt?: string
}
