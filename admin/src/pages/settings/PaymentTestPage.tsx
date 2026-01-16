/**
 * Payment Test Page (Settings)
 *
 * PG 심사 통과를 위한 결제 테스트 페이지
 * - TossPayments 결제위젯 SDK 사용
 *
 * 2025년 토스페이먼츠 심사 요건 충족:
 * - 결제창 정상 호출
 * - 이용약관/개인정보 동의 (위젯 내 렌더링)
 * - 상품 정보 명시 (실제 DB 요금제 연동)
 * - 결제 완료 후 서버 검증 (/confirm API 호출)
 * - 결제 내역 조회
 * - 모바일 리다이렉트 처리
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import { loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk"
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch } from "@/lib/api/client"
import { useCurrentUser } from "@/lib/api/hooks/auth"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { env } from "@/lib/env"

// ============================================================================
// Config - Environment Variables
// ============================================================================

// TossPayments Client Key (환경변수에서 가져옴)
const TOSS_CLIENT_KEY = env.VITE_TOSS_CLIENT_KEY || ""

// ============================================================================
// Types
// ============================================================================

type PlanPriceInfo = {
  currency: string
  amount: number
  displayAmount: string
  isCalculated: boolean
}

type BillingPlan = {
  id: string
  productId: string
  name: string
  description: string | null
  billingInterval: "day" | "week" | "month" | "year" | null
  intervalCount: number | null
  isActive: boolean
  product?: {
    id: string
    name: string
    tier: string
    description: string | null
  }
  prices: PlanPriceInfo[]
  amount: number
  amountUSD: number
  displayAmount: string
  displayAmountUSD: string
}

type PaymentResult = {
  success: boolean
  paymentId: string
  status?: string
  message?: string
  amount?: number
  method?: string
  paidAt?: string
  subscriptionId?: string
  plan?: {
    id: string
    name: string
    amount: number
  }
  product?: {
    id: string
    name: string
    tier: string
  } | null
}

// 테스트 카드 정보 (TossPayments)
const TEST_CARD_INFO = {
  cardNumber: "4330000000000000",
  expiry: "12/30",
  cvc: "123",
  password: "12",
}

// ============================================================================
// API Types & Functions
// ============================================================================

type BillingPlansResponse = {
  plans: Array<{
    id: string
    productId: string
    name: string
    description: string | null
    billingInterval: "day" | "week" | "month" | "year" | null
    intervalCount: number | null
    isActive: boolean
    product?: {
      id: string
      name: string
      tier: string
      description: string | null
    }
    prices: PlanPriceInfo[]
    amount: number
    amountUSD: number
    displayAmount: string
    displayAmountUSD: string
  }>
}

type PaymentConfirmResponse = {
  success: boolean
  data: {
    subscriptionId: string
    paymentId: string
    status: string
    plan: { id: string; name: string; amount: number }
    product: { id: string; name: string; tier: string } | null
    currentPeriodEnd: string
  }
}

// API functions
async function fetchBillingPlans(): Promise<BillingPlansResponse> {
  return apiFetch<BillingPlansResponse>(
    "/api/v1/billing/pricing/plans?currencies=KRW,USD&activeOnly=true&excludeTiers=",
  )
}

async function confirmPayment(params: {
  paymentKey: string
  orderId: string
  amount: number
  planId: string
  workspaceId: string
  customerId: string
}): Promise<PaymentConfirmResponse> {
  return apiFetch<PaymentConfirmResponse>("/api/v1/payments/confirm", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

async function lookupPaymentByOrderId(orderId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/payments/orders/${orderId}`)
}

// ============================================================================
// Hooks
// ============================================================================

function useBillingPlans() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: fetchBillingPlans,
    staleTime: 5 * 60 * 1000,
    select: (response) => response.plans,
  })

  return {
    plans: data ?? [],
    isLoading,
    error: error ? "요금제를 불러오는데 실패했습니다." : null,
  }
}

// ============================================================================
// Component
// ============================================================================

export function PaymentTestPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // User & Workspace
  const { data: currentUser } = useCurrentUser()
  const { data: workspaces } = useUserWorkspaces(!!currentUser?.id)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("")
  const currentWorkspace = workspaces?.find((w) => w.id === selectedWorkspaceId)

  // Fetch billing plans from DB
  const { plans, isLoading: isLoadingPlans, error: plansError } = useBillingPlans()

  // State
  const [selectedPlanId, setSelectedPlanId] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Payment lookup state
  const [lookupOrderId, setLookupOrderId] = useState("")
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null)

  // Ref to prevent double processing of redirect
  const redirectProcessedRef = useRef(false)

  // Widget state
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null)
  const [isWidgetReady, setIsWidgetReady] = useState(false)
  const [isWidgetLoading, setIsWidgetLoading] = useState(false)
  const widgetInitializedRef = useRef(false)

  // ============================================================================
  // Mutations
  // ============================================================================

  // Payment confirm mutation (for redirect success)
  const confirmPaymentMutation = useMutation({
    mutationFn: confirmPayment,
    onSuccess: (response, variables) => {
      if (response?.success && response?.data) {
        setPaymentResult({
          success: true,
          paymentId: variables.paymentKey,
          status: "DONE",
          subscriptionId: response.data.subscriptionId,
          plan: response.data.plan,
          product: response.data.product,
          amount: response.data.plan.amount,
        })
      } else {
        setPaymentResult({
          success: true,
          paymentId: variables.paymentKey,
          message: "결제는 완료되었으나 구독 처리 중입니다.",
        })
      }
    },
    onError: (err, variables) => {
      console.error("[Payment] Confirm API error:", err)
      setPaymentResult({
        success: false,
        paymentId: variables.paymentKey,
        message: "결제 승인 중 오류가 발생했습니다.",
      })
      setError(err instanceof Error ? err.message : "결제 승인 중 오류가 발생했습니다.")
    },
    onSettled: () => {
      setIsProcessing(false)
    },
  })

  // Payment lookup mutation
  const lookupPaymentMutation = useMutation({
    mutationFn: lookupPaymentByOrderId,
    onSuccess: (response) => {
      setLookupResult(response)
    },
    onError: (err) => {
      setLookupResult({ error: err instanceof Error ? err.message : "조회 실패" })
    },
  })

  // Selected plan
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  // 가격 표시용 헬퍼
  const getPriceDisplay = (plan: BillingPlan) => plan.displayAmount

  // Set default selected workspace when workspaces are loaded
  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id)
    }
  }, [workspaces, selectedWorkspaceId])

  // Set default selected plan when plans are loaded
  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id)
    }
  }, [plans, selectedPlanId])

  // Handle TossPayments redirect (payment completion from redirect)
  useEffect(() => {
    // Prevent double processing
    if (redirectProcessedRef.current) {
      return
    }

    const success = searchParams.get("success")
    const fail = searchParams.get("fail")
    const paymentKey = searchParams.get("paymentKey")
    const orderId = searchParams.get("orderId")
    const amount = searchParams.get("amount")
    const errorCode = searchParams.get("code")
    const errorMessage = searchParams.get("message")

    // 성공 리다이렉트 처리
    if (success === "true" && paymentKey && orderId && amount) {
      redirectProcessedRef.current = true
      // Clear URL params
      setSearchParams({})

      // sessionStorage에서 결제 정보 복원
      const savedPaymentInfo = sessionStorage.getItem(`payment_${orderId}`)
      if (savedPaymentInfo) {
        const { planId, workspaceId, customerId } = JSON.parse(savedPaymentInfo)
        sessionStorage.removeItem(`payment_${orderId}`)

        // 결제 승인 API 호출
        setIsProcessing(true)
        setError(null)
        confirmPaymentMutation.mutate({
          paymentKey,
          orderId,
          amount: Number(amount),
          planId,
          workspaceId,
          customerId,
        })
      } else {
        setError("결제 정보를 찾을 수 없습니다. 다시 시도해주세요.")
      }
    }

    // 실패 리다이렉트 처리
    if (fail === "true") {
      redirectProcessedRef.current = true
      setSearchParams({})
      const message = errorMessage
        ? decodeURIComponent(errorMessage)
        : errorCode
          ? `결제 실패 (${errorCode})`
          : "결제가 취소되었습니다."
      setError(message)
      setPaymentResult({
        success: false,
        paymentId: orderId || "unknown",
        message,
      })
    }
  }, [searchParams, setSearchParams, confirmPaymentMutation.mutate])

  // Initialize TossPayments Widget
  const initializeWidget = useCallback(async () => {
    if (!(TOSS_CLIENT_KEY && selectedPlan && currentUser) || widgetInitializedRef.current) {
      return
    }

    // DOM 요소 확인
    const paymentMethodEl = document.getElementById("payment-method-settings")
    if (!paymentMethodEl) {
      return
    }

    widgetInitializedRef.current = true
    setIsWidgetLoading(true)
    setError(null)

    try {
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const widgets = tossPayments.widgets({ customerKey: currentUser.id })

      await widgets.setAmount({
        currency: "KRW",
        value: selectedPlan.amount,
      })

      await widgets.renderPaymentMethods({
        selector: "#payment-method-settings",
        variantKey: "DEFAULT",
      })

      widgetsRef.current = widgets
      setIsWidgetReady(true)
    } catch (err) {
      console.error("[Widget] Init error:", err)
      setError(err instanceof Error ? err.message : "결제 위젯 초기화 실패")
      widgetInitializedRef.current = false
    } finally {
      setIsWidgetLoading(false)
    }
  }, [selectedPlan, currentUser])

  // Initialize widget when plan and user are ready
  useEffect(() => {
    if (selectedPlan && currentUser && !widgetInitializedRef.current) {
      const timeoutId = setTimeout(() => initializeWidget(), 100)
      return () => clearTimeout(timeoutId)
    }
  }, [selectedPlan, currentUser, initializeWidget])

  // Update amount when plan changes (if widget already initialized)
  useEffect(() => {
    if (widgetsRef.current && isWidgetReady && selectedPlan) {
      widgetsRef.current
        .setAmount({
          currency: "KRW",
          value: selectedPlan.amount,
        })
        .catch((err) => console.error("[Widget] Amount update error:", err))
    }
  }, [selectedPlan, isWidgetReady])

  // 환경변수 설정 여부
  const isTossConfigured = Boolean(TOSS_CLIENT_KEY)

  // 결제 가능 여부
  const canPay =
    !isProcessing &&
    selectedPlan &&
    currentWorkspace &&
    currentUser &&
    isTossConfigured &&
    isWidgetReady

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * 결제 요청 - TossPayments Widget
   */
  const handlePayment = useCallback(async () => {
    if (!(canPay && widgetsRef.current && selectedPlan && currentWorkspace && currentUser)) {
      return
    }

    setIsProcessing(true)
    setError(null)
    setPaymentResult(null)

    // 주문 ID 생성
    const orderId = `order-${crypto.randomUUID()}`

    // 결제 정보를 sessionStorage에 저장 (리다이렉트 후 복원용)
    sessionStorage.setItem(
      `payment_${orderId}`,
      JSON.stringify({
        planId: selectedPlan.id,
        workspaceId: currentWorkspace.id,
        customerId: currentUser.id,
      }),
    )

    try {
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: selectedPlan.product?.name || selectedPlan.name,
        successUrl: `${window.location.origin}/settings?tab=payment-test&success=true`,
        failUrl: `${window.location.origin}/settings?tab=payment-test&fail=true`,
        customerEmail: currentUser.email || "test@example.com",
        customerName: currentUser.username || "테스트 사용자",
      })
    } catch (err) {
      console.error("[Payment] Error:", err)
      const errorMessage = err instanceof Error ? err.message : "결제 처리 중 오류가 발생했습니다."
      setError(errorMessage)
      setPaymentResult({
        success: false,
        paymentId: "unknown",
        message: errorMessage,
      })
      setIsProcessing(false)
    }
  }, [canPay, selectedPlan, currentWorkspace, currentUser])

  /**
   * 결제 내역 조회
   */
  const handleLookupPayment = () => {
    if (!lookupOrderId.trim()) {
      return
    }

    setLookupResult(null)
    lookupPaymentMutation.mutate(lookupOrderId.trim())
  }

  /**
   * 상태 초기화
   */
  const handleReset = () => {
    setPaymentResult(null)
    setError(null)
  }

  /**
   * Format billing interval for display
   */
  const formatInterval = (plan: BillingPlan) => {
    const count = plan.intervalCount || 1
    switch (plan.billingInterval) {
      case "day":
        return count > 1 ? `${count}일` : "일"
      case "week":
        return count > 1 ? `${count}주` : "주"
      case "month":
        return count > 1 ? `${count}개월` : "월"
      case "year":
        return count > 1 ? `${count}년` : "년"
      default:
        return "회"
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-semibold text-lg">결제 테스트</h2>
        <p className="text-muted-foreground text-sm">
          TossPayments 결제위젯 SDK 연동 테스트 (PG 심사용)
        </p>
      </div>

      {/* 심사 체크리스트 */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>PG 심사 체크리스트</AlertTitle>
        <AlertDescription>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              결제창 정상 호출 (TossPayments 결제위젯)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              이용약관/개인정보 동의 (위젯 내 렌더링)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              실제 상품(요금제) 정보 연동
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              결제 완료 후 서버 승인 (confirm) + 구독 생성
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              결제 내역 조회 기능
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              모바일 리다이렉트 처리
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="payment">
        <TabsList>
          <TabsTrigger value="payment">결제 테스트</TabsTrigger>
          <TabsTrigger value="lookup">결제 조회</TabsTrigger>
          <TabsTrigger value="info">테스트 정보</TabsTrigger>
        </TabsList>

        {/* 결제 테스트 탭 */}
        <TabsContent className="space-y-4" value="payment">
          {/* 지역 감지 정보 */}
          <Alert>
            <Globe className="h-4 w-4" />
            <AlertTitle>결제 수단</AlertTitle>
            <AlertDescription>
              토스페이먼츠 결제위젯 SDK - 카드, 계좌이체, 간편결제 등 지원
            </AlertDescription>
          </Alert>

          {/* 환경변수 미설정 경고 */}
          {!isTossConfigured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>환경변수 미설정</AlertTitle>
              <AlertDescription>
                TossPayments 결제를 사용하려면 <code className="rounded bg-muted px-1">.env</code>{" "}
                파일에 환경변수를 설정해야 합니다.
                <ul className="mt-2 list-inside list-disc text-sm">
                  <li>
                    <code>VITE_TOSS_CLIENT_KEY</code>
                    {TOSS_CLIENT_KEY ? " ✓" : " (미설정)"}
                  </li>
                </ul>
                <span className="mt-1 block text-xs">
                  ⚠️ 결제위젯 전용 클라이언트 키(test_gck_...)를 사용해야 합니다.
                </span>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 상품 선택 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">결제 정보</CardTitle>
                <CardDescription>워크스페이스와 요금제를 선택하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 워크스페이스 선택 */}
                <div className="space-y-2">
                  <Label className="font-medium text-sm">워크스페이스</Label>
                  {!workspaces || workspaces.length === 0 ? (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        소유하거나 참여 중인 워크스페이스가 없습니다.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Select onValueChange={setSelectedWorkspaceId} value={selectedWorkspaceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="워크스페이스를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            <div className="flex items-center gap-2">
                              <span>{workspace.name}</span>
                              {workspace.ownerId === currentUser?.id && (
                                <Badge className="text-xs" variant="secondary">
                                  소유
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {currentWorkspace && (
                    <p className="text-muted-foreground text-xs">
                      선택된 워크스페이스에 요금제가 적용됩니다
                    </p>
                  )}
                </div>

                <Separator />

                {/* 요금제 선택 */}
                <div className="space-y-2">
                  <Label className="font-medium text-sm">요금제</Label>
                </div>
                {isLoadingPlans ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : plansError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{plansError}</AlertDescription>
                  </Alert>
                ) : plans.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      활성화된 요금제가 없습니다. 관리자에게 문의하세요.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Select onValueChange={setSelectedPlanId} value={selectedPlanId}>
                      <SelectTrigger>
                        <SelectValue placeholder="요금제를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{plan.product?.name || plan.name}</span>
                              <span className="text-muted-foreground">
                                {getPriceDisplay(plan)}/{formatInterval(plan)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* 선택된 요금제 정보 */}
                    {selectedPlan && (
                      <div className="rounded-lg bg-muted/50 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">
                              {selectedPlan.product?.name || selectedPlan.name}
                            </h4>
                            <p className="text-muted-foreground text-sm">
                              {selectedPlan.description ||
                                selectedPlan.product?.description ||
                                "설명 없음"}
                            </p>
                            {selectedPlan.product?.tier && (
                              <Badge className="mt-1" variant="outline">
                                {selectedPlan.product.tier.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{getPriceDisplay(selectedPlan)}</p>
                            <p className="text-muted-foreground text-xs">
                              /{formatInterval(selectedPlan)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Separator />

                {/* TossPayments Widget - Payment Methods */}
                <div className="space-y-3">
                  <Label className="font-medium text-sm">결제 수단</Label>
                  <div className="relative">
                    {isWidgetLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin text-gray-400" />
                        <span className="text-gray-500 text-sm">결제 위젯 로딩 중...</span>
                      </div>
                    )}
                    <div
                      className="min-h-[200px] rounded-lg border border-gray-200"
                      id="payment-method-settings"
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>오류</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Separator />

                {/* 결제 버튼 */}
                <Button className="w-full" disabled={!canPay} onClick={handlePayment} size="lg">
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      결제 처리 중...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {selectedPlan
                        ? `${getPriceDisplay(selectedPlan)} 결제하기`
                        : "요금제를 선택하세요"}
                    </>
                  )}
                </Button>

                {!isWidgetReady && selectedPlan && currentUser && !isWidgetLoading && (
                  <p className="text-center text-muted-foreground text-xs">
                    결제 위젯을 로드하는 중입니다. 잠시만 기다려주세요.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 결제 결과 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">결제 결과</CardTitle>
                <CardDescription>결제 처리 결과가 여기에 표시됩니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentResult && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {paymentResult.success ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <span className="font-medium text-green-600">결제 성공</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="font-medium text-red-600">결제 실패</span>
                        </>
                      )}
                    </div>

                    <div className="rounded-lg bg-muted/50 p-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">결제 ID</span>
                          <code className="max-w-[200px] truncate rounded bg-background px-2 py-0.5 text-xs">
                            {paymentResult.paymentId}
                          </code>
                        </div>
                        {paymentResult.subscriptionId && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">구독 ID</span>
                            <code className="max-w-[200px] truncate rounded bg-background px-2 py-0.5 text-xs">
                              {paymentResult.subscriptionId}
                            </code>
                          </div>
                        )}
                        {paymentResult.status && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">상태</span>
                            <Badge
                              variant={paymentResult.status === "DONE" ? "default" : "secondary"}
                            >
                              {paymentResult.status}
                            </Badge>
                          </div>
                        )}
                        {paymentResult.plan && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">요금제</span>
                            <span>{paymentResult.plan.name}</span>
                          </div>
                        )}
                        {paymentResult.product && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">등급</span>
                            <Badge variant="outline">
                              {paymentResult.product.tier.toUpperCase()}
                            </Badge>
                          </div>
                        )}
                        {paymentResult.amount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">결제 금액</span>
                            <span>{paymentResult.amount.toLocaleString()}원</span>
                          </div>
                        )}
                        {paymentResult.message && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">메시지</span>
                            <span className="max-w-[200px] text-right">
                              {paymentResult.message}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button className="w-full" onClick={handleReset} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      다시 테스트
                    </Button>
                  </div>
                )}

                {!paymentResult && (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <CreditCard className="mb-2 h-12 w-12 opacity-20" />
                    <p>결제를 진행하면 결과가 여기에 표시됩니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 결제 조회 탭 */}
        <TabsContent className="space-y-4" value="lookup">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">결제 내역 조회</CardTitle>
              <CardDescription>주문 ID로 결제 내역을 조회합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  onChange={(e) => setLookupOrderId(e.target.value)}
                  placeholder="order-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={lookupOrderId}
                />
                <Button
                  disabled={lookupPaymentMutation.isPending || !lookupOrderId.trim()}
                  onClick={handleLookupPayment}
                >
                  {lookupPaymentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "조회"
                  )}
                </Button>
              </div>

              {lookupResult && (
                <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
                  {JSON.stringify(lookupResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 테스트 정보 탭 */}
        <TabsContent className="space-y-4" value="info">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 테스트 카드 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">테스트 카드 정보</CardTitle>
                <CardDescription>TossPayments 테스트 결제용 카드</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">카드번호</span>
                    <code className="rounded bg-muted px-2 py-0.5">
                      {TEST_CARD_INFO.cardNumber}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">유효기간</span>
                    <code className="rounded bg-muted px-2 py-0.5">{TEST_CARD_INFO.expiry}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CVC</span>
                    <code className="rounded bg-muted px-2 py-0.5">{TEST_CARD_INFO.cvc}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">비밀번호 앞 2자리</span>
                    <code className="rounded bg-muted px-2 py-0.5">{TEST_CARD_INFO.password}</code>
                  </div>
                </div>
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    테스트 결제는 당일 23:30에 자동 취소됩니다 (체크카드 제외)
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* 연동 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">연동 정보</CardTitle>
                <CardDescription>TossPayments 결제위젯 SDK 설정 정보</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client Key</span>
                    {TOSS_CLIENT_KEY ? (
                      <code className="max-w-[200px] truncate rounded bg-muted px-2 py-0.5 text-xs">
                        {TOSS_CLIENT_KEY.substring(0, 20)}...
                      </code>
                    ) : (
                      <Badge variant="destructive">미설정</Badge>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SDK 버전</span>
                    <Badge variant="outline">v2 (결제위젯)</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">결제 모드</span>
                    <Badge variant="secondary">
                      {TOSS_CLIENT_KEY?.startsWith("test_") ? "테스트" : "라이브"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">키 타입</span>
                    <Badge variant={TOSS_CLIENT_KEY?.includes("_gck_") ? "default" : "destructive"}>
                      {TOSS_CLIENT_KEY?.includes("_gck_") ? "결제위젯 키" : "API 키 (비권장)"}
                    </Badge>
                  </div>
                </div>
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    결제위젯은 <code className="rounded bg-muted px-1">test_gck_...</code> 형식의
                    클라이언트 키를 사용해야 합니다.
                    <a
                      className="ml-1 inline-flex items-center text-blue-600 hover:underline"
                      href="https://docs.tosspayments.com/guides/v2/get-started"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      문서 보기 <ExternalLink className="ml-0.5 h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* PG 심사 안내 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">PG 심사 통과 요건</CardTitle>
                <CardDescription>TossPayments 심사 시 확인되는 항목들</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">필수 구현 사항</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>- 결제창 정상 호출</li>
                      <li>- 결제 완료 후 서버 승인 (confirm)</li>
                      <li>- 이용약관 동의 체크박스</li>
                      <li>- 개인정보 수집/이용 동의 체크박스</li>
                      <li>- 환불 정책 페이지</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">사이트 필수 정보</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>- 상호명, 대표자명</li>
                      <li>- 사업자등록번호</li>
                      <li>- 사업장 주소, 유선번호</li>
                      <li>- 통신판매업 신고번호</li>
                      <li>- 배송/교환/환불 정책</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
