import type { Department } from "./types/user";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9888";

/**
 * Public API client for unauthenticated requests
 */
export class PublicApiClient {
  protected async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          error: `HTTP error! status: ${response.status}` 
        }));
        throw new Error(error.error || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }
}

/**
 * Public Departments API
 */
export class PublicDepartmentsApi extends PublicApiClient {
  /**
   * Get all departments (no authentication required)
   */
  async getDepartments(): Promise<Department[]> {
    const response = await this.request<{ departments: Department[] }>("/api/v1/public/departments");
    return response.departments || [];
  }
}

// Export singleton instance
export const publicDepartmentsApi = new PublicDepartmentsApi();