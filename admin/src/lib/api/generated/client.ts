import createClient from "openapi-fetch"
import type { paths } from "./schema"

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

// Create the typed fetch client
export const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Add auth token interceptor
client.use({
  onRequest({ request }) {
    const token = localStorage.getItem("token")
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`)
    }
    return request
  },
  onResponse({ response }) {
    // Handle 401 unauthorized
    if (response.status === 401) {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return response
  },
})
