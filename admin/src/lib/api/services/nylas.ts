import { apiFetch } from "../client"

export type NylasAuthUrlResponse = {
  url: string
}

export type NylasGrantResponse = {
  grantId: string
  email: string
  provider: string
}

/**
 * Get Nylas OAuth authorization URL for Google
 */
export async function getNylasAuthUrl(state?: string): Promise<NylasAuthUrlResponse> {
  const params = state ? `?state=${encodeURIComponent(state)}` : ""
  return apiFetch<NylasAuthUrlResponse>(`/api/v1/nylas/auth${params}`)
}

/**
 * Exchange authorization code for Nylas grant
 */
export async function exchangeCodeForGrant(
  code: string,
  workspaceId?: string,
  state?: string,
): Promise<NylasGrantResponse> {
  const params = new URLSearchParams({ code })
  if (workspaceId) {
    params.append("workspaceId", workspaceId)
  }
  if (state) {
    params.append("state", state)
  }
  return apiFetch<NylasGrantResponse>(`/api/v1/nylas/callback?${params.toString()}`)
}

/**
 * Get grant information by grant ID
 */
export async function getGrantInfo(grantId: string): Promise<NylasGrantResponse | null> {
  try {
    return await apiFetch<NylasGrantResponse>(`/api/v1/nylas/grant/${grantId}`)
  } catch {
    return null
  }
}

/**
 * Delete/disconnect a grant
 */
export async function deleteGrant(grantId: string): Promise<boolean> {
  try {
    await apiFetch(`/api/v1/nylas/grant/${grantId}`, {
      method: "DELETE",
    })
    return true
  } catch {
    return false
  }
}
