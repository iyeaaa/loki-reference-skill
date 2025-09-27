import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
const JWT_EXPIRES_IN = '24h'
const SALT_ROUNDS = 10

export interface TokenPayload {
  userId: string
  email: string
  userRole: 'admin' | 'user'
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
export async function generateToken(payload: TokenPayload): Promise<string> {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// Verify JWT token
export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload
    return decoded
  } catch (error) {
    throw new Error('유효하지 않은 토큰입니다.')
  }
}