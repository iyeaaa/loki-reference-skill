import bcrypt from "bcrypt"

const _JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production"
const _JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h"
const SALT_ROUNDS = 10

export interface TokenPayload {
  userId: string
  email: string
  userRole: "user" | "admin"
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(password, hash)
}

// Generate JWT token
export function generateToken(payload: TokenPayload): string {
  try {
    // Simple token generation for development - just base64 encode the payload with timestamp
    const tokenData = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    }
    return Buffer.from(JSON.stringify(tokenData)).toString("base64")
  } catch (error) {
    console.error("Token generation error:", error)
    throw error
  }
}

// Verify token
export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    // Decode base64 token
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"))

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (decoded.exp && decoded.exp < now) {
      throw new Error("토큰이 만료되었습니다.")
    }

    // Return payload
    return {
      userId: decoded.userId,
      email: decoded.email,
      userRole: decoded.userRole,
    }
  } catch (error) {
    throw new Error(`토큰 검증 실패: ${error instanceof Error ? error.message : String(error)}`)
  }
}
