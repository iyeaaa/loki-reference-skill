import type { Department, DepartmentsApiResponse } from "./types"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

/**
 * Departments API client for unauthenticated requests
 */
export class DepartmentsApiClient {
  protected async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`

    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: `HTTP error! status: ${response.status}`,
        }))
        throw new Error(error.error || `Request failed with status ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error)
      throw error
    }
  }
}

/**
 * Departments API
 */
export class DepartmentsApi extends DepartmentsApiClient {
  /**
   * Get all departments (no authentication required)
   * @param search - Optional search term to filter departments
   */
  async getDepartments(search?: string): Promise<Department[]> {
    const queryParams = search ? `?search=${encodeURIComponent(search)}` : ""
    const response = await this.request<DepartmentsApiResponse | Department[]>(
      `/api/v1/departments${queryParams}`
    )
    // Handle both wrapped and unwrapped responses
    if (response && typeof response === "object") {
      // If response has data property (wrapped by response transformer)
      if ("data" in response && Array.isArray(response.data)) {
        return response.data
      }
      // If response is directly an array
      if (Array.isArray(response)) {
        return response
      }
    }
    return []
  }
}

// Export singleton instance
export const departmentsApi = new DepartmentsApi()
