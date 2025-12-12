import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import {
  billingCustomersApi,
  billingPlansApi,
  billingProductsApi,
  subscriptionsApi,
} from "../services/billing"
import type {
  BillingCustomersParams,
  BillingPlansParams,
  BillingProductsParams,
  CreateBillingPlanRequest,
  CreateBillingProductRequest,
  CreateSubscriptionRequest,
  SubscriptionsParams,
  UpdateBillingPlanRequest,
  UpdateBillingProductRequest,
  UpdateSubscriptionRequest,
} from "../types/billing"
import { iamKeys } from "./iam"

// ============================================================================
// Query Keys
// ============================================================================

export const billingKeys = {
  all: ["billing"] as const,

  // Products
  products: () => [...billingKeys.all, "products"] as const,
  productsList: (params?: BillingProductsParams) =>
    [...billingKeys.products(), "list", params] as const,
  productDetail: (id: string) => [...billingKeys.products(), "detail", id] as const,

  // Plans
  plans: () => [...billingKeys.all, "plans"] as const,
  plansList: (params?: BillingPlansParams) => [...billingKeys.plans(), "list", params] as const,
  planDetail: (id: string) => [...billingKeys.plans(), "detail", id] as const,

  // Subscriptions
  subscriptions: () => [...billingKeys.all, "subscriptions"] as const,
  subscriptionsList: (params?: SubscriptionsParams) =>
    [...billingKeys.subscriptions(), "list", params] as const,
  subscriptionDetail: (id: string) => [...billingKeys.subscriptions(), "detail", id] as const,
  subscriptionHistory: (id: string) => [...billingKeys.subscriptions(), "history", id] as const,

  // Customers
  customers: () => [...billingKeys.all, "customers"] as const,
  customersList: (params?: BillingCustomersParams) =>
    [...billingKeys.customers(), "list", params] as const,
  customerDetail: (id: string) => [...billingKeys.customers(), "detail", id] as const,
}

// ============================================================================
// Products Queries & Mutations
// ============================================================================

export function useBillingProducts(params?: BillingProductsParams) {
  return useQuery({
    queryKey: billingKeys.productsList(params),
    queryFn: () => billingProductsApi.list(params),
    staleTime: 0, // 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useBillingProduct(productId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.productDetail(productId),
    queryFn: () => billingProductsApi.get(productId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}

export function useCreateBillingProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBillingProductRequest) => billingProductsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.products() })
      // 상품 생성 시 IAM tier boundaries도 갱신 (tier와 연관될 수 있음)
      queryClient.invalidateQueries({ queryKey: iamKeys.tierBoundaries() })
      toast.success("상품이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "상품 생성에 실패했습니다")
    },
  })
}

export function useUpdateBillingProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: UpdateBillingProductRequest }) =>
      billingProductsApi.update(productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.productDetail(variables.productId) })
      queryClient.invalidateQueries({ queryKey: billingKeys.products() })
      queryClient.invalidateQueries({ queryKey: billingKeys.plans() }) // 요금제에 표시되는 상품 정보 갱신
      queryClient.invalidateQueries({ queryKey: iamKeys.tierBoundaries() })
      toast.success("상품 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "상품 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteBillingProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (productId: string) => billingProductsApi.delete(productId),
    onSuccess: () => {
      // 상품 삭제 시 모든 연관 캐시 invalidate
      queryClient.invalidateQueries({ queryKey: billingKeys.products() })
      queryClient.invalidateQueries({ queryKey: billingKeys.plans() }) // 연결된 요금제
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() }) // 연결된 구독
      queryClient.invalidateQueries({ queryKey: iamKeys.tierBoundaries() })
      toast.success("상품이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "상품 삭제에 실패했습니다")
    },
  })
}

// ============================================================================
// Plans Queries & Mutations
// ============================================================================

export function useBillingPlans(params?: BillingPlansParams, enabled = true) {
  return useQuery({
    queryKey: billingKeys.plansList(params),
    queryFn: () => billingPlansApi.list(params),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useBillingPlan(planId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.planDetail(planId),
    queryFn: () => billingPlansApi.get(planId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}

export function useCreateBillingPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBillingPlanRequest) => billingPlansApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.plans() })
      queryClient.invalidateQueries({ queryKey: billingKeys.products() }) // 상품별 요금제 수 갱신
      toast.success("요금제가 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "요금제 생성에 실패했습니다")
    },
  })
}

export function useUpdateBillingPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: UpdateBillingPlanRequest }) =>
      billingPlansApi.update(planId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.planDetail(variables.planId) })
      queryClient.invalidateQueries({ queryKey: billingKeys.plans() })
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() }) // 구독에 표시되는 요금제 정보 갱신
      toast.success("요금제 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "요금제 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteBillingPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId: string) => billingPlansApi.delete(planId),
    onSuccess: () => {
      // 요금제 삭제 시 모든 연관 캐시 invalidate
      queryClient.invalidateQueries({ queryKey: billingKeys.plans() })
      queryClient.invalidateQueries({ queryKey: billingKeys.products() })
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() }) // 연결된 구독
      toast.success("요금제가 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "요금제 삭제에 실패했습니다")
    },
  })
}

// ============================================================================
// Subscriptions Queries & Mutations
// ============================================================================

export function useSubscriptions(params?: SubscriptionsParams) {
  return useQuery({
    queryKey: billingKeys.subscriptionsList(params),
    queryFn: () => subscriptionsApi.list(params),
    staleTime: 0, // 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useSubscription(subscriptionId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.subscriptionDetail(subscriptionId),
    queryFn: () => subscriptionsApi.get(subscriptionId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}

export function useCreateSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => subscriptionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() })
      queryClient.invalidateQueries({ queryKey: billingKeys.customers() }) // 고객별 구독 상태 갱신
      // 구독 생성 시 IAM 권한도 갱신될 수 있음
      queryClient.invalidateQueries({ queryKey: iamKeys.all })
      toast.success("구독이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "구독 생성에 실패했습니다")
    },
  })
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      subscriptionId,
      data,
    }: {
      subscriptionId: string
      data: UpdateSubscriptionRequest
    }) => subscriptionsApi.update(subscriptionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: billingKeys.subscriptionDetail(variables.subscriptionId),
      })
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() })
      queryClient.invalidateQueries({
        queryKey: billingKeys.subscriptionHistory(variables.subscriptionId),
      })
      // 구독 변경 시 IAM 권한도 갱신 (tier 변경 가능)
      queryClient.invalidateQueries({ queryKey: iamKeys.all })
      toast.success("구독 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "구독 업데이트에 실패했습니다")
    },
  })
}

export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ subscriptionId, reason }: { subscriptionId: string; reason?: string }) =>
      subscriptionsApi.cancel(subscriptionId, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: billingKeys.subscriptionDetail(variables.subscriptionId),
      })
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() })
      queryClient.invalidateQueries({
        queryKey: billingKeys.subscriptionHistory(variables.subscriptionId),
      })
      // 구독 취소 시 IAM 권한도 갱신 (권한 제한 가능)
      queryClient.invalidateQueries({ queryKey: iamKeys.all })
      toast.success("구독이 취소되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "구독 취소에 실패했습니다")
    },
  })
}

export function useSubscriptionHistory(subscriptionId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.subscriptionHistory(subscriptionId),
    queryFn: () => subscriptionsApi.getHistory(subscriptionId),
    enabled: enabled && !!subscriptionId,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}

// ============================================================================
// Customers Queries
// ============================================================================

export function useBillingCustomers(params?: BillingCustomersParams) {
  return useQuery({
    queryKey: billingKeys.customersList(params),
    queryFn: () => billingCustomersApi.list(params),
    staleTime: 0, // 즉시 반영
    gcTime: 5 * 60 * 1000,
  })
}

export function useBillingCustomer(customerId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.customerDetail(customerId),
    queryFn: () => billingCustomersApi.get(customerId),
    enabled,
    staleTime: 0, // 즉시 반영
    gcTime: 10 * 60 * 1000,
  })
}
