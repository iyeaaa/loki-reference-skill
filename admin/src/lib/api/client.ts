import toast from "react-hot-toast"

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

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

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let message: string
      try {
        const errorData = JSON.parse(errorText)
        message = errorData.message || errorData.error || `Request failed (${response.status})`
      } catch {
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
    // Don't show toast here - let the hooks handle error messaging
    throw error
  }
}
