// Sequence Management API Types (aligned with backend database schema)

export type SequenceStatus =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "archived"
  | "completed"
  | "no_response"

export type EnrollmentStatus =
  | "active"
  | "paused"
  | "completed"
  | "stopped"
  | "bounced"
  | "unsubscribed"

export type StepExecutionStatus =
  | "pending"
  | "scheduled"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped"

export type StepConditionType =
  | "always"
  | "no_response"
  | "negative_response"
  | "positive_response"
  | "custom"

export interface Sequence {
  id: string
  workspaceId: string
  customerGroupId?: string | null
  name: string
  description?: string | null
  status: SequenceStatus
  workflowData?: string | null
  selectedLeadIds?: string | null // JSON string array of lead IDs
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  // Extended fields from backend joins
  workspaceName?: string
  customerGroupName?: string
  createdByUsername?: string
  createdByEmail?: string
  stepsCount?: number
  currentMaxStep?: number
  enrollmentsCount?: number
  completedEnrollmentsCount?: number
  // Email statistics (detailed)
  sentCount?: number
  deliveredCount?: number
  openedCount?: number
  repliedCount?: number
  // Email metrics (aggregated)
  totalSent?: number
  totalOpened?: number
  totalReplied?: number
  openRate?: number
  replyRate?: number
}

export interface SequenceStep {
  id: string
  sequenceId: string
  stepOrder: number
  delayDays: number
  scheduledHour?: number | null
  scheduledMinute?: number | null
  timezone?: string | null
  emailSubject: string
  emailBodyText?: string | null
  emailBodyHtml?: string | null
  emailTemplateId?: string | null
  conditionType?: StepConditionType | null
  conditionConfig?: string | null
  previousStepId?: string | null
  createdAt: string
  updatedAt: string
}

export interface SequenceEnrollment {
  id: string
  sequenceId: string
  leadId: string
  userEmailAccountId: string
  currentStepOrder: number
  status: EnrollmentStatus
  enrolledBy?: string | null
  enrolledAt: string
  firstEmailSentAt?: string | null
  lastEmailSentAt?: string | null
  completedAt?: string | null
  stoppedAt?: string | null
  nextStepScheduledAt?: string | null
  // Extended fields from backend joins
  leadCompanyName?: string | null
  leadEmail?: string | null
  emailAccountAddress?: string | null
}

export interface SequenceStepExecution {
  id: string
  enrollmentId: string
  stepId: string
  stepOrder: number
  status: StepExecutionStatus
  scheduledAt: string
  executedAt?: string | null
  errorMessage?: string | null
  emailId?: string | null
  createdAt: string
}

export interface CreateSequenceRequest {
  workspaceId: string
  name: string
  description?: string
  status?: SequenceStatus
  customerGroupId?: string
  selectedLeadIds?: string[]
  createdBy?: string
}

export interface UpdateSequenceRequest {
  name?: string
  description?: string
  status?: SequenceStatus
  workflowData?: string
  customerGroupId?: string
  selectedLeadIds?: string[]
}

export interface CreateSequenceStepRequest {
  stepOrder: number
  delayDays: number
  scheduledHour?: number
  scheduledMinute?: number
  timezone?: string
  emailSubject: string
  emailBodyText?: string
  emailBodyHtml?: string
  emailTemplateId?: string
  conditionType?: StepConditionType
  conditionConfig?: string
  previousStepId?: string
}

export interface CreateEnrollmentRequest {
  leadId: string
  userEmailAccountId: string
  enrolledBy?: string
  status?: EnrollmentStatus
}

export interface SequencesResponse {
  data: Sequence[]
  total: number
  limit: number
  offset: number
}

export interface SequenceEnrollmentsResponse {
  data: SequenceEnrollment[]
  total: number
  limit: number
  offset: number
}

export interface SequencesParams {
  page?: number
  limit?: number
  status?: SequenceStatus | "all"
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}

export interface BulkUpdateSequenceStatusRequest {
  sequenceIds: string[]
  status: SequenceStatus
}

export interface BulkEnrollRequest {
  sequenceId: string
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}

export interface BulkUnenrollRequest {
  enrollmentIds: string[]
}

export interface BulkEnrollWithSchedulingRequest {
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}

export interface BulkEnrollWithSchedulingResponse {
  enrolledCount: number
  totalSteps: number
  scheduledExecutions: number
}

// Extended enrollment with lead and email info
export interface EnrollmentWithDetails extends SequenceEnrollment {
  leadCompanyName?: string | null
  leadEmail?: string | null
  emailAccountAddress?: string | null
}

// Type aliases for form inputs
export type SequenceStepCreateInput = CreateSequenceStepRequest
export type SequenceStepUpdateInput = CreateSequenceStepRequest

// Workflow Node Statistics
export interface NodeStatistics {
  nodeId: string
  sentCount: number
  repliedCount: number
  waitingCount: number
  completedCount: number
}
