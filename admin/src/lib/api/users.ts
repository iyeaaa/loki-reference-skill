import { BaseApiClient } from "./base"
import type {
  BulkUpdateLanguagesRequest,
  BulkUpdateResponse,
  BulkUpdateRoleRequest,
  BulkUpdateStatusRequest,
  ChangePasswordRequest,
  CreateUserRequest,
  DepartmentsApiResponse,
  LanguagesApiResponse,
  UpdateUserRequest,
  User,
  UserStats,
  UsersApiParams,
  UsersApiResponse,
} from "./types/user"

export class UsersApi extends BaseApiClient {
  /**
   * Get users list with filtering and pagination
   */
  async getUsers(params?: UsersApiParams): Promise<UsersApiResponse> {
    const searchParams = new URLSearchParams()

    if (params?.page) searchParams.append("page", params.page.toString())
    if (params?.limit) searchParams.append("limit", params.limit.toString())

    // Support multiple roles filter
    if (params?.roles && params.roles.length > 0) {
      searchParams.append("roles", params.roles.join(","))
    } else if (params?.role && params.role !== "all") {
      searchParams.append("role", params.role)
    }

    // Support multiple status filter
    if (params?.statuses && params.statuses.length > 0) {
      searchParams.append("is_active", params.statuses.join(","))
    } else if (params?.status && params.status !== "all") {
      searchParams.append("is_active", params.status === "active" ? "true" : "false")
    }

    // Support multiple departments filter
    if (params?.departments && params.departments.length > 0) {
      searchParams.append("department_ids", params.departments.join(","))
    }

    if (params?.search) searchParams.append("search", params.search)

    const query = searchParams.toString()
    const url = `/api/v1/admin/users${query ? `?${query}` : ""}`

    console.log("Fetching users from:", url)

    const response = await this.request<UsersApiResponse>(url)

    console.log("Raw API response:", response)

    return response
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<User> {
    return this.request<User>(`/api/v1/admin/users/${id}`)
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    return this.request<User>("/api/v1/admin/users", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  /**
   * Update an existing user
   */
  async updateUser(id: string, userData: UpdateUserRequest): Promise<User> {
    // Filter out undefined values but keep explicit falsy values like false and 0
    const filteredData: Partial<UpdateUserRequest> = {}
    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined) {
        // Keep boolean false values, numbers (including 0), filter out empty strings
        if (
          typeof value === "boolean" ||
          typeof value === "number" ||
          (typeof value === "string" && value !== "") ||
          value === null ||
          Array.isArray(value)
        ) {
          ;(filteredData as Record<string, unknown>)[key] = value
        }
      }
    })

    return this.request<User>(`/api/v1/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(filteredData),
    })
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<void> {
    return this.request<void>(`/api/v1/admin/users/${id}`, {
      method: "DELETE",
    })
  }

  /**
   * Change user password
   */
  async changePassword(id: string, passwordData: ChangePasswordRequest): Promise<User> {
    return this.request<User>(`/api/v1/admin/users/${id}/password`, {
      method: "POST",
      body: JSON.stringify(passwordData),
    })
  }

  /**
   * Get all departments
   */
  async getDepartments(): Promise<DepartmentsApiResponse> {
    return this.request<DepartmentsApiResponse>("/api/v1/admin/departments")
  }

  /**
   * Get all languages
   */
  async getLanguages(): Promise<LanguagesApiResponse> {
    return this.request<LanguagesApiResponse>("/api/v1/admin/languages")
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    return this.request<UserStats>("/api/v1/admin/users/stats")
  }

  /**
   * Bulk update user status (active/inactive)
   */
  async bulkUpdateStatus(request: BulkUpdateStatusRequest): Promise<BulkUpdateResponse> {
    return this.request<BulkUpdateResponse>("/api/v1/admin/users/bulk/status", {
      method: "PUT",
      body: JSON.stringify(request),
    })
  }

  /**
   * Bulk update user role
   */
  async bulkUpdateRole(request: BulkUpdateRoleRequest): Promise<BulkUpdateResponse> {
    return this.request<BulkUpdateResponse>("/api/v1/admin/users/bulk/role", {
      method: "PUT",
      body: JSON.stringify(request),
    })
  }

  /**
   * Bulk update user languages
   */
  async bulkUpdateLanguages(request: BulkUpdateLanguagesRequest): Promise<BulkUpdateResponse> {
    return this.request<BulkUpdateResponse>("/api/v1/admin/users/bulk/languages", {
      method: "PUT",
      body: JSON.stringify(request),
    })
  }
}

// Export singleton instance
export const usersApi = new UsersApi()
