export interface EmailReply {
  id: string
  workspaceId: string
  originalEmailId: string
  replyEmailId: string
  sentiment: "positive" | "neutral" | "negative" | "interested" | "not_interested" | null
  intent: string | null
  aiSummary: string | null
  isRead: boolean
  assignedTo: string | null
  createdAt: string
}

export interface EmailReplyWithDetails extends EmailReply {
  originalEmail: {
    id: string
    subject: string | null
    fromEmail: string
    toEmail: string
    sentAt: string | null
  } | null
  replyEmail: {
    id: string
    subject: string | null
    fromEmail: string
    toEmail: string
    bodyText: string | null
    bodyHtml: string | null
    sentAt: string | null
  } | null
  emailAccount: {
    id: string
    emailAddress: string
  } | null
}

export interface EmailReplyListResponse {
  data: EmailReplyWithDetails[]
  total: number
  limit: number
  offset: number
}

export interface EmailReplyFilters {
  workspaceId?: string
  isRead?: boolean
  sentiment?: string
  search?: string
  emailAccountId?: string
}
