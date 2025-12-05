import { OAuth2Client } from "google-auth-library"
import { google } from "googleapis"
import logger from "../utils/logger"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5173/trial"

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth credentials are not configured")
}

// Initialize Google OAuth2 client
const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI)

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
        redirectUri: REDIRECT_URI,
        clientId: `${GOOGLE_CLIENT_ID?.substring(0, 20)}...`,
      },
      "Attempting to exchange code for tokens",
    )

    // Exchange authorization code for access token
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info from Google
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    })

    const { data } = await oauth2.userinfo.get()

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
        redirectUri: REDIRECT_URI,
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
      audience: GOOGLE_CLIENT_ID,
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
