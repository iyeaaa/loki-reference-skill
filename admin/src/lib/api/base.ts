export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

export class BaseApiClient {
  protected baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}

    // Get the token from localStorage
    const token = localStorage.getItem("authToken")
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return headers
  }

  // Centralized error handling
  private handleErrorResponse(response: Response, errorText: string): never {
    try {
      const errorData = JSON.parse(errorText)
      if (errorData.error) {
        throw new Error(errorData.error)
      }
    } catch (e) {
      // If it's already an Error with our message, re-throw it
      if (e instanceof Error && e.message !== errorText) {
        throw e
      }
    }
    // Default error message
    throw new Error(`서버 오류가 발생했습니다. (${response.status})`)
  }

  // Handle network and timeout errors
  private handleNetworkError(error: unknown): never {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("요청 시간이 초과되었습니다.")
      } else if (error.message.includes("fetch")) {
        throw new Error("네트워크 연결에 실패했습니다.")
      }
    }
    throw error
  }

  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`

    // Get authentication headers
    const authHeaders = await this.getAuthHeaders()

    // Add timeout and retry logic
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    }

    // FormData인 경우 Content-Type 제거
    if (options.body instanceof FormData) {
      const headers = config.headers as Record<string, string>
      delete headers["Content-Type"]
    }

    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        this.handleErrorResponse(response, errorText)
      }

      const responseData = await response.json()
      return responseData
    } catch (error) {
      clearTimeout(timeoutId)
      console.error("API request failed:", error)
      this.handleNetworkError(error)
    }
  }

  // Method for making requests without authentication (for public endpoints)
  protected async requestPublic<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`

    // Add timeout for public requests too
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    }

    // FormData인 경우 Content-Type 제거
    if (options.body instanceof FormData) {
      const headers = config.headers as Record<string, string>
      delete headers["Content-Type"]
    }

    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Public API error response:", errorText)
        this.handleErrorResponse(response, errorText)
      }

      const data = await response.json()
      return data
    } catch (error) {
      clearTimeout(timeoutId)
      console.error("Public API request failed:", error)
      this.handleNetworkError(error)
    }
  }
}
