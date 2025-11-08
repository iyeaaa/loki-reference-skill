// API Configuration
// In development, use empty string to use Vite proxy
// In production, set VITE_API_URL environment variable
export const API_BASE_URL = import.meta.env.VITE_API_URL || ""

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

// Custom fetch wrapper for API calls
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = getToken()

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
  const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minutes timeout

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
        url: url,
        errorText: errorText,
      })

      let message: string
      try {
        const errorData = JSON.parse(errorText)
        console.error("❌ Parsed error data:", errorData)
        message = errorData.message || errorData.error || `Request failed (${response.status})`
      } catch (parseError) {
        console.error("❌ Failed to parse error response:", parseError)
        message = errorText.trim() || `Request failed (${response.status})`
      }
      throw new Error(message)
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
