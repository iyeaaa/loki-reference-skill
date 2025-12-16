export type BulkEmailData = {
  fromEmail: string
  toEmail: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  fromName?: string
}

export type BulkEmailSendRequest = {
  workspaceId: string
  userId: string
  emails: BulkEmailData[]
}

export type BulkEmailResult = {
  toEmail: string
  subject: string
  success: boolean
  error?: string
  emailId?: string
}

export type BulkEmailSendResponse = {
  total: number
  successCount: number
  failCount: number
  results: BulkEmailResult[]
}
