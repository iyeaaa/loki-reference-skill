import { OAuth2Client } from "google-auth-library"
import { config } from "../config"
import logger from "../utils/logger"

const { clientId, clientSecret, redirectUri } = config.google.oauth

if (!clientId || !clientSecret) {
  throw new Error("Google OAuth credentials are not configured")
}

// Initialize Google OAuth2 client
const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)

export interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(): string {
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ]

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    include_granted_scopes: true,
  })

  return authUrl
}

/**
 * Exchange authorization code for access token and get user info
 */
export async function getGoogleUserInfo(code: string): Promise<GoogleUserInfo> {
  try {
    logger.info(
      {
        code: `${code.substring(0, 20)}...`,
        redirectUri: redirectUri,
        clientId: `${clientId?.substring(0, 20)}...`,
      },
      "Attempting to exchange code for tokens",
    )

    // Exchange authorization code for access token
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info from Google using direct API call
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`)
    }

    const data = (await response.json()) as GoogleUserInfo

    if (!data.email || !data.verified_email) {
      throw new Error("Google account email is not verified")
    }

    return {
      id: data.id || "",
      email: data.email,
      verified_email: data.verified_email,
      name: data.name || "",
      given_name: data.given_name || "",
      family_name: data.family_name || "",
      picture: data.picture || "",
      locale: data.locale || "en",
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        code: `${code.substring(0, 20)}...`,
        redirectUri: redirectUri,
      },
      "Failed to get Google user info",
    )
    throw new Error(
      `Failed to authenticate with Google: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Verify Google ID token (for client-side authentication)
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken,
      audience: clientId,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      throw new Error("Invalid Google ID token")
    }

    if (!payload.email || !payload.email_verified) {
      throw new Error("Google account email is not verified")
    }

    return {
      id: payload.sub,
      email: payload.email,
      verified_email: payload.email_verified,
      name: payload.name || "",
      given_name: payload.given_name || "",
      family_name: payload.family_name || "",
      picture: payload.picture || "",
      locale: payload.locale || "en",
    }
  } catch (error) {
    logger.error({ error }, "Failed to verify Google ID token")
    throw new Error("Invalid Google ID token")
  }
}
