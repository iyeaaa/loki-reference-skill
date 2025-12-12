import { apiFetch } from "@/lib/api/client"
import type {
  BillingCustomer,
  BillingCustomersParams,
  BillingCustomersResponse,
  BillingPlan,
  BillingPlansParams,
  BillingPlansResponse,
  BillingProduct,
  BillingProductsParams,
  BillingProductsResponse,
  CreateBillingPlanRequest,
  CreateBillingProductRequest,
  CreateSubscriptionRequest,
  Subscription,
  SubscriptionHistory,
  SubscriptionsParams,
  SubscriptionsResponse,
  UpdateBillingPlanRequest,
  UpdateBillingProductRequest,
  UpdateSubscriptionRequest,
} from "../types/billing"

// ============================================================================
// Products API
// ============================================================================

export const billingProductsApi = {
  list: async (params?: BillingProductsParams): Promise<BillingProductsResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)
    if (params?.tier && params.tier !== "all") searchParams.append("tier", params.tier)
    if (params?.isActive !== undefined) searchParams.append("isActive", String(params.isActive))

    const query = searchParams.toString()
    const response = await apiFetch<{
      data: BillingProduct[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/billing/products${query ? `?${query}` : ""}`)

    return {
      data: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }
  },

  get: (productId: string) => {
    return apiFetch<BillingProduct>(`/api/v1/billing/products/${productId}`)
  },

  create: (data: CreateBillingProductRequest) => {
    return apiFetch<BillingProduct>("/api/v1/billing/products", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (productId: string, data: UpdateBillingProductRequest) => {
    return apiFetch<BillingProduct>(`/api/v1/billing/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (productId: string) => {
    return apiFetch(`/api/v1/billing/products/${productId}`, {
      method: "DELETE",
    })
  },
}

// ============================================================================
// Plans API
// ============================================================================

export const billingPlansApi = {
  list: async (params?: BillingPlansParams): Promise<BillingPlansResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)
    if (params?.productId) searchParams.append("productId", params.productId)
    if (params?.planType && params.planType !== "all")
      searchParams.append("planType", params.planType)
    if (params?.isActive !== undefined) searchParams.append("isActive", String(params.isActive))

    const query = searchParams.toString()
    const response = await apiFetch<{
      data: BillingPlan[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/billing/plans${query ? `?${query}` : ""}`)

    return {
      data: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }
  },

  get: (planId: string) => {
    return apiFetch<BillingPlan>(`/api/v1/billing/plans/${planId}`)
  },

  create: (data: CreateBillingPlanRequest) => {
    return apiFetch<BillingPlan>("/api/v1/billing/plans", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (planId: string, data: UpdateBillingPlanRequest) => {
    return apiFetch<BillingPlan>(`/api/v1/billing/plans/${planId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (planId: string) => {
    return apiFetch(`/api/v1/billing/plans/${planId}`, {
      method: "DELETE",
    })
  },
}

// ============================================================================
// Subscriptions API
// ============================================================================

export const subscriptionsApi = {
  list: async (params?: SubscriptionsParams): Promise<SubscriptionsResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)
    if (params?.status && params.status !== "all") searchParams.append("status", params.status)
    if (params?.statuses && params.statuses.length > 0) {
      searchParams.append("statuses", params.statuses.join(","))
    }
    if (params?.tier && params.tier !== "all") searchParams.append("tier", params.tier)
    if (params?.isPrimary !== undefined) searchParams.append("isPrimary", String(params.isPrimary))

    const query = searchParams.toString()
    const response = await apiFetch<{
      data: Subscription[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/billing/subscriptions${query ? `?${query}` : ""}`)

    return {
      data: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }
  },

  get: (subscriptionId: string) => {
    return apiFetch<Subscription>(`/api/v1/billing/subscriptions/${subscriptionId}`)
  },

  create: (data: CreateSubscriptionRequest) => {
    return apiFetch<Subscription>("/api/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (subscriptionId: string, data: UpdateSubscriptionRequest) => {
    return apiFetch<Subscription>(`/api/v1/billing/subscriptions/${subscriptionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  cancel: (subscriptionId: string, reason?: string) => {
    return apiFetch<Subscription>(`/api/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
  },

  getHistory: (subscriptionId: string) => {
    return apiFetch<SubscriptionHistory[]>(
      `/api/v1/billing/subscriptions/${subscriptionId}/history`,
    )
  },
}

// ============================================================================
// Customers API
// ============================================================================

export const billingCustomersApi = {
  list: async (params?: BillingCustomersParams): Promise<BillingCustomersResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)

    const query = searchParams.toString()
    const response = await apiFetch<{
      data: BillingCustomer[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/billing/customers${query ? `?${query}` : ""}`)

    return {
      data: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }
  },

  get: (customerId: string) => {
    return apiFetch<BillingCustomer>(`/api/v1/billing/customers/${customerId}`)
  },
}
