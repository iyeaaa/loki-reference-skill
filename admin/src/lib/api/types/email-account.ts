// Email Account Management API Types (aligned with backend database schema)

export type EmailAccountStatus = "active" | "inactive" | "error" | "rate_limited" | "suspended"

export interface UserEmailAccount {
  id: string
  userId: string
  workspaceId: string
  // SendGrid email configuration
  emailAddress: string
  displayName?: string | null
  apiKey: string
  sendgridVerifiedSenderId?: string | null
  // Status and verification
  isVerified: boolean
  isDefault: boolean
  // Rate limiting
  dailyLimit?: number | null
  monthlyLimit?: number | null
  dailySentCount: number
  monthlySentCount: number
  lastResetDaily?: string | null
  lastResetMonthly?: string | null
  status: EmailAccountStatus
  lastError?: string | null
  lastSyncAt?: string | null
  createdAt: string
  updatedAt: string
  // Joined fields from relations
  username?: string
  email?: string
  workspaceName?: string
}

export interface CreateEmailAccountRequest {
  userId: string
  workspaceId: string
  emailAddress: string
  displayName?: string
  apiKey: string
  sendgridVerifiedSenderId?: string
  isVerified?: boolean
  isDefault?: boolean
  dailyLimit?: number
  monthlyLimit?: number
  status?: EmailAccountStatus
}

export interface UpdateEmailAccountRequest {
  emailAddress: string
  displayName?: string | null
  apiKey: string
  sendgridVerifiedSenderId?: string | null
  isVerified: boolean
  isDefault: boolean
  dailyLimit?: number | null
  monthlyLimit?: number | null
  status: EmailAccountStatus
}

export interface EmailAccountsResponse {
  data: UserEmailAccount[]
  total: number
  limit: number
  offset: number
}

export interface EmailAccountsParams {
  page?: number
  limit?: number
  status?: EmailAccountStatus | "all"
  isVerified?: boolean | "all"
  isDefault?: boolean | "all"
  search?: string
  userIds?: string[]
  workspaceIds?: string[]
}

export interface SetAsDefaultRequest {
  userId: string
  workspaceId: string
}

export interface UpdateErrorRequest {
  errorMessage: string
}

export interface BulkUpdateEmailAccountStatusRequest {
  accountIds: string[]
  status: EmailAccountStatus
}
