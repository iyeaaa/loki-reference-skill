// Activity Log Management API Types (aligned with backend database schema)

export type ActivityLog = {
  id: string
  workspaceId: string
  userId?: string | null
  entityType: string // e.g., 'lead', 'email', 'sequence'
  entityId: string
  action: string // e.g., 'created', 'updated', 'deleted', 'sent'
  details?: Record<string, unknown> | null // JSON field for additional context
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
  // Joined fields from backend
  userName?: string | null
  userEmail?: string | null
  workspaceName?: string | null
}

// Entity types for filtering
export const ENTITY_TYPES = [
  { value: "lead", label: "리드" },
  { value: "email", label: "이메일" },
  { value: "sequence", label: "시퀀스" },
  { value: "template", label: "템플릿" },
  { value: "workspace", label: "워크스페이스" },
  { value: "user", label: "사용자" },
  { value: "customer_group", label: "고객 그룹" },
] as const

// Action types for filtering
export const ACTION_TYPES = [
  { value: "created", label: "생성" },
  { value: "updated", label: "수정" },
  { value: "deleted", label: "삭제" },
  { value: "sent", label: "발송" },
  { value: "viewed", label: "조회" },
  { value: "enrolled", label: "등록" },
  { value: "unenrolled", label: "등록 해제" },
  { value: "activated", label: "활성화" },
  { value: "deactivated", label: "비활성화" },
] as const

export type CreateActivityLogRequest = {
  workspaceId: string
  userId?: string | null
  entityType: string
  entityId: string
  action: string
  details?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export type ActivityLogsResponse = {
  data: ActivityLog[]
  total: number
  limit: number
  offset: number
}

export type ActivityLogsParams = {
  page?: number
  limit?: number
  entityType?: string
  action?: string
  search?: string
  workspaceIds?: string[]
  userIds?: string[]
  startDate?: Date
  endDate?: Date
}
