// Sequence Management API Types (aligned with backend database schema)

export type SequenceStatus =
  | "draft"
  | "ready"
  | "generating"
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

export type GenerationSource = "ai" | "manual" | "template"

export type StepConditionType =
  | "always"
  | "no_response"
  | "negative_response"
  | "positive_response"
  | "custom"

export type Sequence = {
  id: string
  workspaceId: string
  customerGroupId?: string | null
  name: string
  description?: string | null
  memo?: string | null
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

export type SequenceStepAttachment = {
  filename: string
  type: string
  size?: number
  content?: string
}

export type SequenceStep = {
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
  emailSignature?: string | null
  includeSignature?: boolean | null
  generationSource: GenerationSource
  conditionType?: StepConditionType | null
  conditionConfig?: string | null
  previousStepId?: string | null
  attachments?: SequenceStepAttachment[] | null
  createdAt: string
  updatedAt: string
  // Number of times this step has been sent (used to determine if step is editable)
  executionCount?: number
}

export type SequenceEnrollment = {
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

export type SequenceStepExecution = {
  id: string
  enrollmentId: string
  stepId: string
  stepOrder: number
  status: StepExecutionStatus
  scheduledAt: string
  executedAt?: string | null
  errorMessage?: string | null
  emailId?: string | null
  generationSource: GenerationSource
  createdAt: string
}

export type CreateSequenceRequest = {
  workspaceId: string
  name: string
  description?: string
  status?: SequenceStatus
  customerGroupId?: string
  selectedLeadIds?: string[]
  createdBy?: string
}

export type UpdateSequenceRequest = {
  name?: string
  description?: string
  memo?: string
  status?: SequenceStatus
  workflowData?: string
  customerGroupId?: string
  selectedLeadIds?: string[]
}

export type CreateSequenceStepRequest = {
  stepOrder: number
  delayDays: number
  scheduledHour?: number
  scheduledMinute?: number
  timezone?: string
  emailSubject: string
  emailBodyText?: string
  emailBodyHtml?: string
  emailTemplateId?: string
  generationSource?: GenerationSource
  conditionType?: StepConditionType
  conditionConfig?: string
  previousStepId?: string
}

export type CreateEnrollmentRequest = {
  leadId: string
  userEmailAccountId: string
  enrolledBy?: string
  status?: EnrollmentStatus
}

export type SequencesResponse = {
  data: Sequence[]
  total: number
  limit: number
  offset: number
}

export type SequenceEnrollmentsResponse = {
  data: SequenceEnrollment[]
  total: number
  limit: number
  offset: number
}

export type SequencesParams = {
  page?: number
  limit?: number
  status?: SequenceStatus | "all"
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}

export type BulkUpdateSequenceStatusRequest = {
  sequenceIds: string[]
  status: SequenceStatus
}

export type BulkEnrollRequest = {
  sequenceId: string
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}

export type BulkUnenrollRequest = {
  enrollmentIds: string[]
}

export type BulkEnrollWithSchedulingRequest = {
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}

export type BulkEnrollWithSchedulingResponse = {
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
export type NodeStatistics = {
  nodeId: string
  sentCount: number
  repliedCount: number
  waitingCount: number
  completedCount: number
}
