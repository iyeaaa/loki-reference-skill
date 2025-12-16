/**
 * BullMQ Queue Type Definitions
 */

// Queue Names
export const QUEUE_NAMES = {
  CAMPAIGN_EMAIL: "campaign-email",
  SCHEDULED_EMAIL: "scheduled-email",
  WORKFLOW_STEP: "workflow-step",
  METRICS_SYNC: "metrics-sync",
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

export interface TestJobResult {
  success: boolean
  processedAt: string
  message: string
  receivedData?: Record<string, unknown>
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
