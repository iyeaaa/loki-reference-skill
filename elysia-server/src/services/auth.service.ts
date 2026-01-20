import { randomBytes } from "node:crypto"
import bcrypt from "bcrypt"
import redisConnection from "../lib/redis/connection"

const _JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production"
const SALT_ROUNDS = 10

// Token expiry durations
const ACCESS_TOKEN_EXPIRY = 1 * 60 * 60 * 1000 // 1 hour in milliseconds
const REFRESH_TOKEN_EXPIRY = 14 * 24 * 60 * 60 * 1000 // 14 days (2 weeks) in milliseconds

export interface TokenPayload {
  userId: string
  email: string
  userRole: "user" | "admin"
  exp?: number // Expiry timestamp
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

// Generate JWT token with expiry
export function generateToken(payload: TokenPayload): string {
  try {
    const now = Date.now()
    const tokenData = {
      ...payload,
      iat: Math.floor(now / 1000),
      exp: Math.floor((now + ACCESS_TOKEN_EXPIRY) / 1000), // 1시간 후 만료
    }
    return Buffer.from(JSON.stringify(tokenData)).toString("base64")
  } catch (error) {
    console.error("Token generation error:", error)
    throw error
  }
}

// Verify token with expiry check
export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    // Decode base64 token
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"))

    // Check expiry
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired")
    }

    // Return payload
    return {
      userId: decoded.userId,
      email: decoded.email,
      userRole: decoded.userRole,
      exp: decoded.exp,
    }
  } catch (error) {
    throw new Error(`토큰 검증 실패: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Redis Keys
const REFRESH_TOKEN_PREFIX = "refresh_token:"
const USER_REFRESH_TOKENS_PREFIX = "user_refresh_tokens:"

// Generate Refresh Token (저장: Redis)
export async function generateRefreshToken(
  userId: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<string> {
  // Generate random refresh token
  const token = randomBytes(64).toString("base64url")

  // Redis에 저장 (30일 TTL)
  const tokenData = {
    userId,
    userAgent: userAgent || "",
    ipAddress: ipAddress || "",
    createdAt: new Date().toISOString(),
  }

  try {
    // Token → userId 매핑 (30일 TTL)
    await redisConnection.setex(
      `${REFRESH_TOKEN_PREFIX}${token}`,
      Math.floor(REFRESH_TOKEN_EXPIRY / 1000), // seconds
      JSON.stringify(tokenData),
    )

    // User → Tokens 리스트 (사용자의 모든 토큰 추적)
    await redisConnection.sadd(`${USER_REFRESH_TOKENS_PREFIX}${userId}`, token)
    await redisConnection.expire(
      `${USER_REFRESH_TOKENS_PREFIX}${userId}`,
      Math.floor(REFRESH_TOKEN_EXPIRY / 1000),
    )
  } catch (error) {
    console.error("Failed to store refresh token in Redis:", error)
    throw error
  }

  return token
}

// Verify Refresh Token and return userId (조회: Redis)
export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const data = await redisConnection.get(`${REFRESH_TOKEN_PREFIX}${token}`)

    if (!data) {
      return null // 토큰 없음 또는 만료됨
    }

    const tokenData = JSON.parse(data)
    return tokenData.userId || null
  } catch (error) {
    console.error("Refresh token verification error:", error)
    return null
  }
}

// Delete Refresh Token (logout)
export async function deleteRefreshToken(token: string): Promise<void> {
  try {
    // 먼저 userId 가져오기
    const data = await redisConnection.get(`${REFRESH_TOKEN_PREFIX}${token}`)
    if (data) {
      const tokenData = JSON.parse(data)
      // User의 토큰 리스트에서 제거
      await redisConnection.srem(`${USER_REFRESH_TOKENS_PREFIX}${tokenData.userId}`, token)
    }
    // Token 삭제
    await redisConnection.del(`${REFRESH_TOKEN_PREFIX}${token}`)
  } catch (error) {
    console.error("Failed to delete refresh token:", error)
  }
}

// Delete all user's refresh tokens
export async function deleteAllUserRefreshTokens(userId: string): Promise<void> {
  try {
    // 사용자의 모든 토큰 가져오기
    const tokens = await redisConnection.smembers(`${USER_REFRESH_TOKENS_PREFIX}${userId}`)

    // 모든 토큰 삭제
    for (const token of tokens) {
      await redisConnection.del(`${REFRESH_TOKEN_PREFIX}${token}`)
    }

    // 토큰 리스트 삭제
    await redisConnection.del(`${USER_REFRESH_TOKENS_PREFIX}${userId}`)
  } catch (error) {
    console.error("Failed to delete user refresh tokens:", error)
  }
}
