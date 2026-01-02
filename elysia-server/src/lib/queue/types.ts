/**
 * BullMQ Queue Type Definitions
 */

// Queue Names
export const QUEUE_NAMES = {
  CAMPAIGN_EMAIL: "campaign-email",
  SCHEDULED_EMAIL: "scheduled-email",
  SEQUENCE_EMAIL: "sequence-email", // BullMQ-based sequence email sending (replaces 60s interval worker)
  WORKFLOW_STEP: "workflow-step",
  METRICS_SYNC: "metrics-sync",
  ONBOARDING_GENERATION: "onboarding-generation",
  UNIPILE_INBOX_POLL: "unipile-inbox-poll", // Unipile inbox polling for replied emails
  TRIAL_EXPIRATION: "trial-expiration", // Trial expiration check
  TEST_QUEUE: "test-queue", // For testing purposes
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

// Job Types

/**
 * Campaign Email Job - sends scheduled campaign emails
 */
export interface CampaignEmailJob {
  enrollmentId: string
  stepId: string
  nylasAccountId: string
  leadId: string
  leadEmail: string
  scheduledAt: string // ISO date string
  attempt: number
}

/**
 * Sequence Email Job - BullMQ-based sequence email sending
 * Replaces the 60-second interval polling worker with event-driven processing
 *
 * Features:
 * - Immediate processing (no 60s wait)
 * - Built-in retry with exponential backoff
 * - Rate limiting for Hunter API (10 req/sec)
 * - Automatic stall detection and recovery
 * - Full lifecycle logging to PostgreSQL
 */
export interface SequenceEmailJob {
  /** Unique execution ID from sequence_step_executions table */
  executionId: string
  /** Enrollment ID for tracking */
  enrollmentId: string
  /** Step ID in the sequence */
  stepId: string
  /** Step order (1, 2, 3...) */
  stepOrder: number
  /** Lead ID to send email to */
  leadId: string
  /** Lead company name for logging */
  leadCompanyName: string | null
  /** User email account ID for sending */
  emailAccountId: string
  /** Email subject from step template */
  emailSubject: string
  /** Email body text */
  emailBodyText: string | null
  /** Email body HTML */
  emailBodyHtml: string | null
  /** Sequence name for logging */
  sequenceName: string
  /** Sequence ID */
  sequenceId: string
  /** Workspace ID */
  workspaceId: string
  /** User ID who created the sequence */
  userId: string | null
  /** Optional attachments */
  attachments?: Array<{ filename: string; type: string; content: string }> | null
}

/**
 * Sequence Email Job Result
 */
export interface SequenceEmailResult {
  success: boolean
  /** SendGrid/Nylas message ID */
  messageId?: string
  /** UUID from emails table */
  emailRecordId?: string
  /** Error message if failed */
  error?: string
  /** Processing duration in ms */
  durationMs?: number
}

/**
 * Scheduled Email Job - sends one-off scheduled emails
 */
export interface ScheduledEmailJob {
  emailId: string
  workspaceId: string
  userEmailAccountId: string
  scheduledAt: string
}

/**
 * Workflow Step Job - executes workflow automation steps
 */
export interface WorkflowStepJob {
  workflowId: string
  stepId: string
  executionId: string
  input: Record<string, unknown>
}

/**
 * Metrics Sync Job - syncs Redis state to PostgreSQL
 */
export interface MetricsSyncJob {
  nylasAccountId: string
  campaignId: string
  syncType: "full" | "incremental"
}

/**
 * Onboarding Auto-Generate Job - generates onboarding data (leads, emails, etc.)
 */
export interface OnboardingAutoGenerateJob {
  workspaceId: string
  userId: string
  surveyData: {
    industry?: string
    target?: string
    country?: string
    experience?: string
    lang?: string
  }
  // BullMQ native checkpoint state (persisted in Redis via job.updateData())
  checkpoint?: {
    phase: "init" | "discovery" | "group" | "templates" | "sequence" | "previews" | "complete"
    leadsWithEmailsCount: number
    lastIterationCompleted: boolean
    customerGroupId?: string
    sequenceId?: string
    errors: Array<{
      phase: string
      message: string
      timestamp: string
    }>
  }
}

/**
 * Test Job - for testing BullMQ functionality
 */
export interface TestJob {
  message: string
  delay?: number
  shouldFail?: boolean
  data?: Record<string, unknown>
}

// Job Result Types

export interface CampaignEmailResult {
  status: "sent" | "skipped" | "failed"
  messageId?: string
  reason?: string
}

export interface OnboardingAutoGenerateResult {
  success: boolean
  phase: "init" | "discovery" | "group" | "templates" | "sequence" | "previews" | "complete"
  leadsGenerated?: number
  customerGroupId?: string
  sequenceId?: string
  errors?: Array<{
    phase: string
    message: string
  }>
}

export interface TestJobResult {
  success: boolean
  processedAt: string
  message: string
  receivedData?: Record<string, unknown>
}

/**
 * Unipile Inbox Poll Job - polls Unipile accounts for new inbound emails
 */
export interface UnipileInboxPollJob {
  /** Trigger type: 'scheduled' for automatic polling, 'manual' for on-demand */
  trigger: "scheduled" | "manual"
  /** Optional: specific account ID to poll (if not provided, polls all active Unipile accounts) */
  accountId?: string
}

export interface UnipileInboxPollResult {
  success: boolean
  accountsPolled: number
  newEmailsFound: number
  repliesDetected: number
  errors: Array<{
    accountId: string
    error: string
  }>
}

/**
 * Trial Expiration Job - checks and expires trial subscriptions
 */
export interface TrialExpirationJob {
  /** Trigger type: 'scheduled' for automatic check, 'manual' for on-demand */
  trigger: "scheduled" | "manual"
  /** Optional: specific date to check against (for testing) */
  checkDate?: string
}

export interface TrialExpirationResult {
  success: boolean
  expiredCount: number
  pausedSequencesCount: number
  errors: string[]
}

// Job Options
export interface JobScheduleOptions {
  delay?: number // Delay in milliseconds
  priority?: number // Lower is higher priority
  attempts?: number // Number of retry attempts
  backoff?: {
    type: "fixed" | "exponential"
    delay: number
  }
  removeOnComplete?: boolean | { age: number; count: number }
  removeOnFail?: boolean | { age: number }
}
