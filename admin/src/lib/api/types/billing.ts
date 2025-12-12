// Billing Management API Types (aligned with database schema)

// ============================================================================
// Enums
// ============================================================================

export type SubscriptionTier = "trial" | "basic" | "pro" | "enterprise"
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "unpaid"
  | "paused"
export type PlanType = "one_time" | "recurring"
export type PlanInterval = "day" | "week" | "month" | "year"

// ============================================================================
// Entities
// ============================================================================

export interface BillingCustomer {
  id: string
  userId: string
  externalCustomerId: string
  email: string | null
  name: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  // Relations (enhanced)
  user?: {
    id: string
    username: string
    email: string
  } | null
  subscriptionsCount?: number
  activeSubscriptionsCount?: number
}

export interface BillingProduct {
  id: string
  externalProductId: string | null
  name: string
  description: string | null
  tier: SubscriptionTier
  features: string[]
  isActive: boolean
  displayOrder: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  // Relations (enhanced)
  plans?: BillingPlan[]
  plansCount?: number
  subscriptionsCount?: number
}

export interface BillingPlan {
  id: string
  productId: string
  externalPlanId: string | null
  name: string
  description: string | null
  isActive: boolean
  isDefault: boolean
  currency: string
  amount: number
  planType: PlanType
  billingInterval: PlanInterval | null
  intervalCount: number
  trialDays: number
  featuresOverride: string[] | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  // Relations (enhanced)
  product?: BillingProduct
  subscriptionsCount?: number
}

export interface Subscription {
  id: string
  workspaceId: string
  customerId: string
  planId: string
  externalSubscriptionId: string | null
  status: SubscriptionStatus
  isPrimary: boolean
  quantity: number
  cancelAtPeriodEnd: boolean
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialStart: string | null
  trialEnd: string | null
  canceledAt: string | null
  cancelReason: string | null
  endedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  // Relations
  workspace?: {
    id: string
    name: string
  }
  customer?: BillingCustomer
  plan?: BillingPlan
}

export interface SubscriptionHistory {
  id: string
  subscriptionId: string
  previousPlanId: string | null
  newPlanId: string | null
  previousStatus: SubscriptionStatus | null
  newStatus: SubscriptionStatus | null
  changeType: string
  changeReason: string | null
  changedBy: string | null
  createdAt: string
  // Relations
  changedByUser?: {
    id: string
    username: string
  }
}

// ============================================================================
// API Params
// ============================================================================

export interface BillingProductsParams {
  page?: number
  limit?: number
  tier?: SubscriptionTier | "all"
  isActive?: boolean
  search?: string
}

export interface BillingPlansParams {
  page?: number
  limit?: number
  productId?: string
  planType?: PlanType | "all"
  isActive?: boolean
  search?: string
}

export interface SubscriptionsParams {
  page?: number
  limit?: number
  workspaceId?: string
  status?: SubscriptionStatus | "all"
  statuses?: SubscriptionStatus[]
  tier?: SubscriptionTier | "all"
  isPrimary?: boolean
  search?: string
}

export interface BillingCustomersParams {
  page?: number
  limit?: number
  search?: string
}

// ============================================================================
// API Requests
// ============================================================================

export interface CreateBillingProductRequest {
  name: string
  description?: string
  tier: SubscriptionTier
  features?: string[]
  isActive?: boolean
  displayOrder?: number
  externalProductId?: string
}

export interface UpdateBillingProductRequest {
  name?: string
  description?: string
  tier?: SubscriptionTier
  features?: string[]
  isActive?: boolean
  displayOrder?: number
  externalProductId?: string
}

export interface CreateBillingPlanRequest {
  productId: string
  name: string
  description?: string
  currency?: string
  amount: number
  planType: PlanType
  billingInterval?: PlanInterval
  intervalCount?: number
  trialDays?: number
  isActive?: boolean
  isDefault?: boolean
  featuresOverride?: string[]
  externalPlanId?: string
}

export interface UpdateBillingPlanRequest {
  name?: string
  description?: string
  currency?: string
  amount?: number
  planType?: PlanType
  billingInterval?: PlanInterval
  intervalCount?: number
  trialDays?: number
  isActive?: boolean
  isDefault?: boolean
  featuresOverride?: string[]
  externalPlanId?: string
}

export interface CreateSubscriptionRequest {
  workspaceId: string
  customerId: string
  planId: string
  isPrimary?: boolean
  quantity?: number
  trialDays?: number
}

export interface UpdateSubscriptionRequest {
  planId?: string
  status?: SubscriptionStatus
  cancelAtPeriodEnd?: boolean
  quantity?: number
  cancelReason?: string
}

// ============================================================================
// API Responses
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type BillingProductsResponse = PaginatedResponse<BillingProduct>
export type BillingPlansResponse = PaginatedResponse<BillingPlan>
export type SubscriptionsResponse = PaginatedResponse<Subscription>
export type BillingCustomersResponse = PaginatedResponse<BillingCustomer>

// ============================================================================
// Display Helpers
// ============================================================================

export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  trial: "체험",
  basic: "기본",
  pro: "프로",
  enterprise: "엔터프라이즈",
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "체험 중",
  active: "활성",
  canceled: "취소됨",
  incomplete: "미완료",
  incomplete_expired: "미완료 만료",
  past_due: "연체",
  unpaid: "미결제",
  paused: "일시정지",
}

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  one_time: "일회성",
  recurring: "정기",
}

export const PLAN_INTERVAL_LABELS: Record<PlanInterval, string> = {
  day: "일",
  week: "주",
  month: "월",
  year: "년",
}

export const SUBSCRIPTION_STATUS_VARIANTS: Record<
  SubscriptionStatus,
  "success" | "warning" | "error" | "info" | "default"
> = {
  trialing: "info",
  active: "success",
  canceled: "default",
  incomplete: "warning",
  incomplete_expired: "error",
  past_due: "warning",
  unpaid: "error",
  paused: "default",
}

export const SUBSCRIPTION_TIER_VARIANTS: Record<
  SubscriptionTier,
  "success" | "warning" | "error" | "info" | "default"
> = {
  trial: "default",
  basic: "info",
  pro: "success",
  enterprise: "warning",
}
