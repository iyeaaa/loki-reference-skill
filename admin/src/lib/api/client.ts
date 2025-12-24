import { API_BASE_URL } from "@/lib/env"

// Re-export API_BASE_URL for backwards compatibility
export { API_BASE_URL }

// Token Management
const TOKEN_KEY = "authToken"

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch (error) {
    console.error("Failed to save token:", error)
  }
}

export function removeToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch (error) {
    console.error("Failed to remove token:", error)
  }
}

// Custom API error class with status code
export class ApiError extends Error {
  status: number
  data?: { message?: string }

  constructor(message: string, status: number, data?: { message?: string }) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

// Custom fetch wrapper for API calls
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = getToken()

  // Debug: Log token presence for PATCH requests to email-signatures
  if (options.method === "PATCH" && endpoint.includes("email-signatures")) {
    console.debug("[apiFetch] PATCH request to email-signatures:", {
      endpoint,
      hasToken: !!token,
      tokenLength: token?.length,
    })
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    const mutableHeaders = headers as Record<string, string>
    delete mutableHeaders["Content-Type"]
  }

  // Create AbortController for timeout
  const controller = new AbortController()
  // Longer timeout for test endpoints (10 minutes) due to processing time
  const isTestEndpoint = endpoint.includes("/test/")
  const timeoutMs = isTestEndpoint ? 600_000 : 300_000 // 10 min for tests, 5 min for others
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        url,
        errorText,
      })

      let message: string
      let errorData: { message?: string } | undefined
      try {
        errorData = JSON.parse(errorText)
        console.error("❌ Parsed error data:", errorData)
        message = errorData?.message || `Request failed (${response.status})`
      } catch (parseError) {
        console.error("❌ Failed to parse error response:", parseError)
        message = errorText.trim() || `Request failed (${response.status})`
      }
      // Throw ApiError with status code for proper error handling
      throw new ApiError(message, response.status, errorData)
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T
    }

    const result = await response.json()

    // Handle wrapped API responses from Elysia backend
    if (result && typeof result === "object" && "success" in result && "data" in result) {
      return result.data as T
    }

    return result as T
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "요청 시간이 초과되었습니다. 리드 개수가 많아서 시간이 오래 걸릴 수 있습니다.",
      )
    }
    throw error
  }
}
