// Email Management API Types (aligned with backend database schema)

export type EmailDirection = "outbound" | "inbound"

export type EmailStatus =
  | "draft"
  | "scheduled"
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "failed"
  | "spam"
  | "unsubscribed"

export type EmailBounceType = "soft" | "hard" | "block"

// EmailThreadStatus removed - not needed without email_threads table

export type EmailReplySentiment =
  | "positive"
  | "neutral"
  | "negative"
  | "interested"
  | "not_interested"

export type EmailEventType =
  | "processed"
  | "delivered"
  | "open"
  | "click"
  | "bounce"
  | "dropped"
  | "deferred"
  | "spam_report"
  | "unsubscribe"

export interface Email {
  id: string
  workspaceId: string
  userEmailAccountId: string
  leadId?: string | null
  sequenceId?: string | null
  stepId?: string | null
  direction: EmailDirection
  fromEmail: string
  toEmail: string
  ccEmails?: string[] | null
  bccEmails?: string[] | null
  subject?: string | null
  bodyText?: string | null
  bodyHtml?: string | null
  status: EmailStatus
  // Timing
  scheduledAt?: string | null
  sentAt?: string | null
  deliveredAt?: string | null
  openedAt?: string | null
  clickedAt?: string | null
  repliedAt?: string | null
  // Bounce information
  bounceType?: EmailBounceType | null
  bounceReason?: string | null
  errorMessage?: string | null
  // Provider IDs
  sendgridMessageId?: string | null
  messageId?: string | null
  inReplyTo?: string | null
  // Thread relationship (optimized: varchar for messageId-based threading)
  threadId?: string | null
  // Engagement metrics
  openCount: number
  clickCount: number
  // Denormalized fields for performance (避免 JOIN)
  leadName?: string | null
  leadEmail?: string | null
  sequenceName?: string | null
  // Unsubscribe/spam
  unsubscribedAt?: string | null
  spamReportedAt?: string | null
  // Retry logic
  retryCount: number
  lastRetryAt?: string | null
  createdAt: string
  updatedAt: string
}

// EmailThread interface removed - using threadId field in Email instead

export interface EmailReply {
  id: string
  workspaceId: string
  originalEmailId: string
  replyEmailId: string
  sentiment?: EmailReplySentiment | null
  intent?: string | null
  aiSummary?: string | null
  isRead: boolean
  assignedTo?: string | null
  createdAt: string
}

export interface EmailEvent {
  id: string
  emailId: string
  eventType: EmailEventType
  timestamp: string
  sendgridEventId?: string | null
  userAgent?: string | null
  ipAddress?: string | null
  url?: string | null // For click events
  bounceType?: string | null
  bounceReason?: string | null
  smtpResponse?: string | null
  rawEventData?: Record<string, unknown> | null
  processed: boolean
  createdAt: string
}

export interface SendEmailRequest {
  toEmail: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  ccEmails?: string[]
  bccEmails?: string[]
  fromName?: string // Custom sender name (optional, defaults to config's fromName)
  leadId?: string
  sequenceId?: string
  stepId?: string
  replyTo?: string
  inReplyTo?: string
  references?: string[]
  scheduledAt?: string // ISO 8601 datetime for scheduled sending
  includeSignature?: boolean // 서명 포함 여부 (기본값: true)
  // Required fields for user_email_accounts integration
  workspaceId: string
  userId: string
}

export interface CreateEmailRequest {
  workspaceId: string
  userEmailAccountId: string
  leadId?: string
  sequenceId?: string
  stepId?: string
  direction: EmailDirection
  fromEmail: string
  toEmail: string
  ccEmails?: string[]
  bccEmails?: string[]
  subject?: string
  bodyText?: string
  bodyHtml?: string
  status?: EmailStatus
  scheduledAt?: string
}

export interface UpdateEmailStatusRequest {
  status: EmailStatus
}

export interface EmailsResponse {
  data: Email[]
  total: number
  limit: number
  offset: number
}

export interface EmailsParams {
  page?: number
  limit?: number
  status?: EmailStatus | "all"
  direction?: EmailDirection | "all"
  workspaceId?: string
  leadId?: string
  sequenceId?: string
  search?: string
}

export interface BulkUpdateEmailStatusRequest {
  emailIds: string[]
  status: EmailStatus
}

export interface RepliedEmail {
  id: string
  threadId?: string | null
  workspaceId: string
  fromEmail: string
  toEmail: string
  subject?: string | null
  bodyText?: string | null
  bodyHtml?: string | null
  status: EmailStatus
  repliedAt?: string | null
  deliveredAt?: string | null
  openedAt?: string | null
  inReplyTo?: string | null
  leadId?: string | null
  sequenceId?: string | null
  createdAt: string
  updatedAt: string
  // Denormalized fields
  leadName?: string | null
  leadEmail?: string | null
  sequenceName?: string | null
  companyName?: string | null
  // Lead detailed fields
  foundCompanyName?: string | null
  contactName?: string | null
  websiteUrl?: string | null
  finalUrl?: string | null
  businessType?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  employeeCount?: string | null
  leadStatus?: string | null
  leadScore?: number | null
  leadSource?: string | null
  // Thread info (스레드 기반 조회 시 추가됨)
  messageCount?: number
  // Sequence enrollment fields
  enrollmentId?: string | null
  enrollmentStatus?:
    | "active"
    | "paused"
    | "completed"
    | "stopped"
    | "bounced"
    | "unsubscribed"
    | null
  enrollmentCurrentStepOrder?: number | null
  enrollmentEnrolledAt?: string | null
  enrollmentFirstEmailSentAt?: string | null
  enrollmentLastEmailSentAt?: string | null
  enrollmentCompletedAt?: string | null
  enrollmentStoppedAt?: string | null
  enrollmentNextStepScheduledAt?: string | null
}

// Thread email for conversation history (스레드 대화 이력)
export interface ThreadEmail {
  id: string
  direction: EmailDirection
  fromEmail: string
  toEmail: string
  subject?: string | null
  bodyText?: string | null
  bodyHtml?: string | null
  status: EmailStatus
  sentAt?: string | null
  repliedAt?: string | null
  deliveredAt?: string | null
  openedAt?: string | null
  createdAt: string
  updatedAt: string
  threadId?: string | null
  inReplyTo?: string | null
  messageId?: string | null
  leadName?: string | null
  leadEmail?: string | null
  sequenceName?: string | null
  leadId?: string | null
  sequenceId?: string | null
  workspaceId: string
}

export interface ThreadGroupedEmail {
  threadId: string
  latestEmailId: string
  emailCount: number
  latestActivity: string
  subject: string | null
  fromEmail: string
  leadName: string | null
  sequenceName: string | null
}
