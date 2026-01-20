import { API_BASE_URL } from "@/lib/env"

// Re-export API_BASE_URL for backwards compatibility
export { API_BASE_URL }

// ============================================================================
// Public API Client (인증 불필요, 상대 경로 사용)
// ============================================================================

/**
 * Public API fetch - 인증 없이 호출하는 API용
 * - 상대 경로 사용 (CSP 위반 방지)
 * - PG 심사용 페이지 등에서 사용
 */
export async function publicApiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // 항상 상대 경로 사용 (프론트엔드와 동일 도메인 가정)
  const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    const mutableHeaders = headers as Record<string, string>
    delete mutableHeaders["Content-Type"]
  }

  const controller = new AbortController()
  const timeoutMs = 30_000 // 30초
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
      let message: string
      try {
        const errorData = JSON.parse(errorText)
        message = errorData?.message || `Request failed (${response.status})`
      } catch {
        message = errorText.trim() || `Request failed (${response.status})`
      }
      throw new ApiError(message, response.status)
    }

    if (response.status === 204) {
      return null as T
    }

    const result = await response.json()

    // Handle wrapped API responses
    if (result && typeof result === "object" && "success" in result && "data" in result) {
      return result.data as T
    }

    return result as T
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다.")
    }
    throw error
  }
}

// Token Management
const TOKEN_KEY = "authToken"
const REFRESH_TOKEN_KEY = "refreshToken"

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

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setRefreshToken(token: string): void {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
  } catch (error) {
    console.error("Failed to save refresh token:", error)
  }
}

export function removeRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch (error) {
    console.error("Failed to remove refresh token:", error)
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

// Refresh token helper
let isRefreshing = false
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  // 이미 refresh 중이면 같은 Promise 반환 (중복 방지)
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        throw new Error("No refresh token")
      }

      // Refresh API 호출
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        throw new Error("Refresh failed")
      }

      const data = await response.json()

      // 새 토큰 저장
      setToken(data.token)
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken)
      }

      return data.token
    } catch (error) {
      // Refresh 실패 시 로그아웃
      console.error("[Auth] Refresh failed - logging out:", error)
      removeToken()
      removeRefreshToken()
      localStorage.removeItem("user")
      window.location.href = "/auth"
      throw error
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// Custom fetch wrapper for API calls with auto-refresh
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
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
        errorText: errorText || "(empty response)",
      })

      let message: string
      let errorData: { message?: string } | undefined

      // Only try to parse if response body is not empty
      if (errorText?.trim()) {
        try {
          errorData = JSON.parse(errorText)
          console.error("❌ Parsed error data:", errorData)
          message = errorData?.message || `Request failed (${response.status})`
        } catch (parseError) {
          console.error("❌ Failed to parse error response:", parseError)
          message = errorText.trim()
        }
      } else {
        // Empty response body
        message = `Request failed (${response.status}: ${response.statusText})`
      }

      // 401 에러 && 첫 시도 && refresh/verify/login 엔드포인트가 아닌 경우 → 자동 refresh
      if (
        response.status === 401 &&
        !isRetry &&
        !endpoint.includes("/refresh") &&
        !endpoint.includes("/verify") &&
        !endpoint.includes("/login") &&
        getRefreshToken()
      ) {
        console.log("[Auth] 401 error - attempting token refresh")
        try {
          await refreshAccessToken()
          // 새 토큰으로 재시도
          return apiFetch<T>(endpoint, options, true)
        } catch (_refreshError) {
          // Refresh 실패 - 원래 에러 throw
          throw new ApiError(message, response.status, errorData)
        }
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
