/**
 * Authentication Helper for Integration Tests
 *
 * Provides functions for user signup and signin against the running server
 */

export interface AuthCredentials {
  username: string
  email: string
  password: string
  employeeId: string
  departmentId: string
}

export interface AuthToken {
  token: string
}

/**
 * Sign up a new user
 */
export async function signUp(baseUrl: string, credentials: AuthCredentials): Promise<any> {
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: credentials.username,
      email: credentials.email,
      password: credentials.password,
      departmentId: credentials.departmentId,
      employeeId: credentials.employeeId,
    }),
  })

  const data = (await response.json()) as any
  if (response.status !== 201 || !data.success) {
    console.error("Signup failed:", data)
    throw new Error(`Signup failed: ${JSON.stringify(data)}`)
  }

  return data
}

/**
 * Sign in and get authentication token
 */
export async function signIn(baseUrl: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
    }),
  })

  const data = (await response.json()) as any
  if (!data.success || !data.data?.token) {
    console.error("Login failed:", data)
    throw new Error(`Login failed: ${JSON.stringify(data)}`)
  }

  return data.data.token as string
}

/**
 * Generate unique test credentials with timestamp
 */
export function generateTestCredentials(departmentId: string): AuthCredentials {
  const timestamp = Date.now()
  return {
    username: `test_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: "TestPassword123!",
    employeeId: `EMP${timestamp}`,
    departmentId,
  }
}
