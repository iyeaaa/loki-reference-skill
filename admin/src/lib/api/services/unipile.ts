import { apiFetch } from "../client"

export type UnipileAuthUrlResponse = {
  url: string
  hostedAuthUrl: string
}

export type UnipileAccountResponse = {
  accountId: string
  email: string
  provider: string
}

/**
 * Get Unipile hosted authentication URL
 * @param workspaceId - The workspace ID to associate with this auth flow
 */
export async function getUnipileAuthUrl(workspaceId?: string): Promise<UnipileAuthUrlResponse> {
  const params = workspaceId ? `?state=${encodeURIComponent(workspaceId)}` : ""
  return apiFetch<UnipileAuthUrlResponse>(`/api/v1/unipile/auth${params}`)
}

/**
 * Process Unipile callback after hosted authentication
 */
export async function processUnipileCallback(
  accountId: string,
  workspaceId?: string,
  state?: string,
): Promise<UnipileAccountResponse> {
  const params = new URLSearchParams({ account_id: accountId })
  if (workspaceId) {
    params.append("workspaceId", workspaceId)
  }
  if (state) {
    params.append("state", state)
  }
  return apiFetch<UnipileAccountResponse>(`/api/v1/unipile/callback?${params.toString()}`)
}

/**
 * Get Unipile account information
 */
export async function getAccountInfo(accountId: string): Promise<UnipileAccountResponse | null> {
  try {
    return await apiFetch<UnipileAccountResponse>(`/api/v1/unipile/account/${accountId}/info`)
  } catch {
    return null
  }
}

/**
 * Delete/disconnect a Unipile account
 */
export async function deleteUnipileAccount(accountId: string): Promise<boolean> {
  try {
    await apiFetch(`/api/v1/unipile/account/${accountId}`, {
      method: "DELETE",
    })
    return true
  } catch {
    return false
  }
}

/**
 * Manually sync account emails (for replied-emails feature)
 */
export async function syncAccountEmails(accountId: string): Promise<{ emailCount: number }> {
  return apiFetch<{ emailCount: number }>(`/api/v1/unipile/account/${accountId}/sync`, {
    method: "POST",
  })
}
