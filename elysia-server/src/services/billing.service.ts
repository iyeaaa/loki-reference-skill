/**
 * Billing Service
 *
 * 빌링 관련 데이터베이스 작업을 처리하는 서비스
 */

import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm"
import { db } from "../db"
import type {
  BillingCustomer,
  BillingPlan,
  BillingProduct,
  NewBillingCustomer,
  NewBillingPlan,
  NewBillingProduct,
  NewSubscription,
  Subscription,
  SubscriptionHistory,
  SubscriptionStatus,
  SubscriptionTier,
} from "../db/schema/billing"
import {
  billingCustomers,
  billingPlans,
  billingProducts,
  subscriptionHistory,
  subscriptions,
} from "../db/schema/billing"
import type { PlanType } from "../db/schema/enums"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"

// ============================================================================
// Products
// ============================================================================

export interface ProductFilters {
  tier?: SubscriptionTier
  isActive?: boolean
  search?: string
}

export async function listProducts(
  limit: number,
  offset: number,
  filters?: ProductFilters,
): Promise<(BillingProduct & { plansCount: number; subscriptionsCount: number })[]> {
  const conditions: SQL[] = []

  if (filters?.tier) {
    conditions.push(eq(billingProducts.tier, filters.tier))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(billingProducts.isActive, filters.isActive))
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(billingProducts.name, `%${filters.search}%`),
        ilike(billingProducts.description, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const productsData = await db
    .select()
    .from(billingProducts)
    .where(whereClause)
    .orderBy(billingProducts.displayOrder, billingProducts.createdAt)
    .limit(limit)
    .offset(offset)

  // Get plans count for each product
  const productIds = productsData.map((p) => p.id)
  if (productIds.length === 0) return []

  const plansCounts = await db
    .select({
      productId: billingPlans.productId,
      count: count(),
    })
    .from(billingPlans)
    .where(or(...productIds.map((id) => eq(billingPlans.productId, id))))
    .groupBy(billingPlans.productId)

  // Get subscriptions count (through plans)
  const subscriptionsCounts = await db
    .select({
      productId: billingProducts.id,
      count: count(),
    })
    .from(subscriptions)
    .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
    .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(or(...productIds.map((id) => eq(billingProducts.id, id))))
    .groupBy(billingProducts.id)

  const plansCountMap = new Map(plansCounts.map((c) => [c.productId, c.count]))
  const subsCountMap = new Map(subscriptionsCounts.map((c) => [c.productId, c.count]))

  return productsData.map((product) => ({
    ...product,
    plansCount: plansCountMap.get(product.id) || 0,
    subscriptionsCount: subsCountMap.get(product.id) || 0,
  }))
}

export async function countProducts(filters?: ProductFilters): Promise<number> {
  const conditions: SQL[] = []

  if (filters?.tier) {
    conditions.push(eq(billingProducts.tier, filters.tier))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(billingProducts.isActive, filters.isActive))
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(billingProducts.name, `%${filters.search}%`),
        ilike(billingProducts.description, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db.select({ count: count() }).from(billingProducts).where(whereClause)

  return result[0]?.count || 0
}

export async function getProduct(id: string): Promise<BillingProduct | null> {
  const result = await db.select().from(billingProducts).where(eq(billingProducts.id, id)).limit(1)
  return result[0] || null
}

export async function createProduct(
  data: Omit<NewBillingProduct, "id" | "createdAt" | "updatedAt">,
): Promise<BillingProduct> {
  const result = await db.insert(billingProducts).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to create product")
  }
  return result[0]
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<NewBillingProduct, "id" | "createdAt">>,
): Promise<BillingProduct | null> {
  const result = await db
    .update(billingProducts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(billingProducts.id, id))
    .returning()
  return result[0] || null
}

export async function deleteProduct(id: string): Promise<void> {
  await db.delete(billingProducts).where(eq(billingProducts.id, id))
}

// ============================================================================
// Plans
// ============================================================================

export interface PlanFilters {
  productId?: string
  planType?: PlanType
  isActive?: boolean
  search?: string
}

export async function listPlans(
  limit: number,
  offset: number,
  filters?: PlanFilters,
): Promise<(BillingPlan & { product?: BillingProduct; subscriptionsCount: number })[]> {
  const conditions: SQL[] = []

  if (filters?.productId) {
    conditions.push(eq(billingPlans.productId, filters.productId))
  }
  if (filters?.planType) {
    conditions.push(eq(billingPlans.planType, filters.planType))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(billingPlans.isActive, filters.isActive))
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(billingPlans.name, `%${filters.search}%`),
        ilike(billingPlans.description, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      plan: billingPlans,
      product: billingProducts,
    })
    .from(billingPlans)
    .leftJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(whereClause)
    .orderBy(desc(billingPlans.createdAt))
    .limit(limit)
    .offset(offset)

  // Get subscription counts for each plan
  const planIds = result.map((r) => r.plan.id)
  if (planIds.length === 0) return []

  const subscriptionsCounts = await db
    .select({
      planId: subscriptions.planId,
      count: count(),
    })
    .from(subscriptions)
    .where(or(...planIds.map((id) => eq(subscriptions.planId, id))))
    .groupBy(subscriptions.planId)

  const subsCountMap = new Map(subscriptionsCounts.map((c) => [c.planId, c.count]))

  return result.map((row) => ({
    ...row.plan,
    product: row.product || undefined,
    subscriptionsCount: subsCountMap.get(row.plan.id) || 0,
  }))
}

export async function countPlans(filters?: PlanFilters): Promise<number> {
  const conditions: SQL[] = []

  if (filters?.productId) {
    conditions.push(eq(billingPlans.productId, filters.productId))
  }
  if (filters?.planType) {
    conditions.push(eq(billingPlans.planType, filters.planType))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(billingPlans.isActive, filters.isActive))
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(billingPlans.name, `%${filters.search}%`),
        ilike(billingPlans.description, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db.select({ count: count() }).from(billingPlans).where(whereClause)

  return result[0]?.count || 0
}

export async function getPlan(
  id: string,
): Promise<(BillingPlan & { product?: BillingProduct }) | null> {
  const result = await db
    .select({
      plan: billingPlans,
      product: billingProducts,
    })
    .from(billingPlans)
    .leftJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(eq(billingPlans.id, id))
    .limit(1)

  if (!result[0]) return null

  return {
    ...result[0].plan,
    product: result[0].product || undefined,
  }
}

export async function createPlan(
  data: Omit<NewBillingPlan, "id" | "createdAt" | "updatedAt">,
): Promise<BillingPlan> {
  const result = await db.insert(billingPlans).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to create plan")
  }
  return result[0]
}

export async function updatePlan(
  id: string,
  data: Partial<Omit<NewBillingPlan, "id" | "createdAt">>,
): Promise<BillingPlan | null> {
  const result = await db
    .update(billingPlans)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(billingPlans.id, id))
    .returning()
  return result[0] || null
}

export async function deletePlan(id: string): Promise<void> {
  await db.delete(billingPlans).where(eq(billingPlans.id, id))
}

// ============================================================================
// Subscriptions
// ============================================================================

export interface SubscriptionFilters {
  workspaceId?: string
  status?: SubscriptionStatus
  statuses?: SubscriptionStatus[]
  tier?: SubscriptionTier
  isPrimary?: boolean
  search?: string
}

export async function listSubscriptions(
  limit: number,
  offset: number,
  filters?: SubscriptionFilters,
): Promise<
  (Subscription & {
    workspace?: { id: string; name: string }
    plan?: BillingPlan & { product?: BillingProduct }
    customer?: BillingCustomer
  })[]
> {
  const conditions: SQL[] = []

  if (filters?.workspaceId) {
    conditions.push(eq(subscriptions.workspaceId, filters.workspaceId))
  }
  if (filters?.status) {
    conditions.push(eq(subscriptions.status, filters.status))
  }
  if (filters?.statuses && filters.statuses.length > 0) {
    conditions.push(inArray(subscriptions.status, filters.statuses))
  }
  if (filters?.isPrimary !== undefined) {
    conditions.push(eq(subscriptions.isPrimary, filters.isPrimary))
  }
  if (filters?.tier) {
    conditions.push(eq(billingProducts.tier, filters.tier))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      subscription: subscriptions,
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
      },
      plan: billingPlans,
      product: billingProducts,
      customer: billingCustomers,
    })
    .from(subscriptions)
    .leftJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
    .leftJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
    .leftJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .leftJoin(billingCustomers, eq(subscriptions.customerId, billingCustomers.id))
    .where(whereClause)
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit)
    .offset(offset)

  return result.map((row) => ({
    ...row.subscription,
    workspace: row.workspace || undefined,
    plan: row.plan ? { ...row.plan, product: row.product || undefined } : undefined,
    customer: row.customer || undefined,
  }))
}

export async function countSubscriptions(filters?: SubscriptionFilters): Promise<number> {
  const conditions: SQL[] = []

  if (filters?.workspaceId) {
    conditions.push(eq(subscriptions.workspaceId, filters.workspaceId))
  }
  if (filters?.status) {
    conditions.push(eq(subscriptions.status, filters.status))
  }
  if (filters?.statuses && filters.statuses.length > 0) {
    conditions.push(inArray(subscriptions.status, filters.statuses))
  }
  if (filters?.isPrimary !== undefined) {
    conditions.push(eq(subscriptions.isPrimary, filters.isPrimary))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db.select({ count: count() }).from(subscriptions).where(whereClause)

  return result[0]?.count || 0
}

export async function getSubscription(id: string): Promise<Subscription | null> {
  const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1)
  return result[0] || null
}

export async function createSubscription(
  data: Omit<NewSubscription, "id" | "createdAt" | "updatedAt">,
): Promise<Subscription> {
  const result = await db.insert(subscriptions).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to create subscription")
  }
  const created = result[0]

  // Create history record
  await db.insert(subscriptionHistory).values({
    subscriptionId: created.id,
    newPlanId: data.planId,
    newStatus: data.status,
    changeType: "created",
  })

  return created
}

export async function updateSubscription(
  id: string,
  data: Partial<Omit<NewSubscription, "id" | "createdAt">>,
  changedBy?: string,
  changeReason?: string,
): Promise<Subscription | null> {
  const currentSub = await getSubscription(id)
  if (!currentSub) return null

  const result = await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning()

  // Determine change type
  let changeType = "updated"
  if (data.status && data.status !== currentSub.status) {
    if (data.status === "canceled") changeType = "canceled"
    else if (data.status === "active" && currentSub.status === "canceled")
      changeType = "reactivated"
  }
  if (data.planId && data.planId !== currentSub.planId) {
    // Could be upgrade or downgrade - simplified here
    changeType = "plan_changed"
  }

  // Create history record
  await db.insert(subscriptionHistory).values({
    subscriptionId: id,
    previousPlanId: currentSub.planId,
    newPlanId: data.planId || currentSub.planId,
    previousStatus: currentSub.status,
    newStatus: data.status || currentSub.status,
    changeType,
    changeReason,
    changedBy,
  })

  return result[0] || null
}

export async function cancelSubscription(
  id: string,
  reason?: string,
  changedBy?: string,
): Promise<Subscription | null> {
  return updateSubscription(
    id,
    {
      status: "canceled",
      canceledAt: new Date(),
      cancelReason: reason,
    },
    changedBy,
    reason,
  )
}

// ============================================================================
// Customers
// ============================================================================

export interface CustomerFilters {
  search?: string
}

export async function listCustomers(
  limit: number,
  offset: number,
  filters?: CustomerFilters,
): Promise<
  (BillingCustomer & {
    user?: { id: string; username: string; email: string } | null
    subscriptionsCount: number
    activeSubscriptionsCount: number
  })[]
> {
  const conditions: SQL[] = []

  if (filters?.search) {
    conditions.push(
      or(
        ilike(billingCustomers.email, `%${filters.search}%`),
        ilike(billingCustomers.name, `%${filters.search}%`),
        ilike(users.username, `%${filters.search}%`),
        ilike(users.email, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      customer: billingCustomers,
      user: {
        id: users.id,
        username: users.username,
        email: users.email,
      },
    })
    .from(billingCustomers)
    .leftJoin(users, eq(billingCustomers.userId, users.id))
    .where(whereClause)
    .orderBy(desc(billingCustomers.createdAt))
    .limit(limit)
    .offset(offset)

  // Get subscriptions count for each customer
  const customerIds = result.map((r) => r.customer.id)
  if (customerIds.length === 0) return []

  const subscriptionsCounts = await db
    .select({
      customerId: subscriptions.customerId,
      count: count(),
    })
    .from(subscriptions)
    .where(or(...customerIds.map((id) => eq(subscriptions.customerId, id))))
    .groupBy(subscriptions.customerId)

  // Get active subscriptions count
  const activeSubscriptionsCounts = await db
    .select({
      customerId: subscriptions.customerId,
      count: count(),
    })
    .from(subscriptions)
    .where(
      and(
        or(...customerIds.map((id) => eq(subscriptions.customerId, id))),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .groupBy(subscriptions.customerId)

  const subsCountMap = new Map(subscriptionsCounts.map((c) => [c.customerId, c.count]))
  const activeSubsCountMap = new Map(activeSubscriptionsCounts.map((c) => [c.customerId, c.count]))

  return result.map((row) => ({
    ...row.customer,
    user: row.user?.id ? row.user : null,
    subscriptionsCount: subsCountMap.get(row.customer.id) || 0,
    activeSubscriptionsCount: activeSubsCountMap.get(row.customer.id) || 0,
  }))
}

export async function countCustomers(filters?: CustomerFilters): Promise<number> {
  const conditions: SQL[] = []

  if (filters?.search) {
    conditions.push(
      or(
        ilike(billingCustomers.email, `%${filters.search}%`),
        ilike(billingCustomers.name, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db.select({ count: count() }).from(billingCustomers).where(whereClause)

  return result[0]?.count || 0
}

export async function getCustomer(id: string): Promise<BillingCustomer | null> {
  const result = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.id, id))
    .limit(1)
  return result[0] || null
}

export async function getCustomerByUserId(userId: string): Promise<BillingCustomer | null> {
  const result = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1)
  return result[0] || null
}

export async function createCustomer(
  data: Omit<NewBillingCustomer, "id" | "createdAt" | "updatedAt">,
): Promise<BillingCustomer> {
  const result = await db.insert(billingCustomers).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to create customer")
  }
  return result[0]
}

// ============================================================================
// Subscription History
// ============================================================================

export async function getSubscriptionHistory(
  subscriptionId: string,
): Promise<SubscriptionHistory[]> {
  return db
    .select()
    .from(subscriptionHistory)
    .where(eq(subscriptionHistory.subscriptionId, subscriptionId))
    .orderBy(desc(subscriptionHistory.createdAt))
}
