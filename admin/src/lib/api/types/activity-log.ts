// Activity Log Management API Types (aligned with backend database schema)

export interface ActivityLog {
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
}

export interface CreateActivityLogRequest {
  workspaceId: string
  userId?: string | null
  entityType: string
  entityId: string
  action: string
  details?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ActivityLogsResponse {
  data: ActivityLog[]
  total: number
  limit: number
  offset: number
}

export interface ActivityLogsParams {
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
