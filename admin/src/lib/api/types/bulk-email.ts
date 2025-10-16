export interface BulkEmailData {
  fromEmail: string
  toEmail: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  fromName?: string
}

export interface BulkEmailSendRequest {
  workspaceId: string
  userId: string
  emails: BulkEmailData[]
}

export interface BulkEmailResult {
  toEmail: string
  subject: string
  success: boolean
  error?: string
  emailId?: string
}

export interface BulkEmailSendResponse {
  total: number
  successCount: number
  failCount: number
  results: BulkEmailResult[]
}
