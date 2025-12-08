import { verifyToken } from "../services/auth.service"
import logger from "./logger"

/**
 * Extract userId from Authorization header token
 * @param authorization - Authorization header value (e.g., "Bearer <token>")
 * @returns userId if token is valid, null otherwise
 */
export async function getUserIdFromToken(authorization?: string): Promise<string | null> {
  if (!authorization) {
    logger.debug("No authorization header provided")
    return null
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    logger.debug("No token found in authorization header")
    return null
  }

  try {
    const payload = await verifyToken(token)
    logger.debug({ userId: payload.userId }, "Successfully extracted userId from token")
    return payload.userId
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.warn(
      {
        err: error,
        errorMessage,
        tokenLength: token.length,
        tokenPrefix: `${token.substring(0, 20)}...`,
      },
      "Failed to verify token",
    )
    return null
  }
}
