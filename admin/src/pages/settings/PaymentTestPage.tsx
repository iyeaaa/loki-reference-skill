/**
 * Payment Test Page
 *
 * PG 심사 통과를 위한 결제 테스트 페이지
 * - 국내: 토스페이먼츠 (KRW)
 * - 해외: 페이팔 (USD)
 *
 * 2025년 토스페이먼츠/페이팔 심사 요건 충족:
 * - 결제창 정상 호출
 * - 이용약관/개인정보 동의 체크박스
 * - 상품 정보 명시 (실제 DB 요금제 연동)
 * - 결제 완료 후 서버 검증 (/complete API 호출)
 * - 결제 내역 조회
 * - 모바일 리다이렉트 처리
 * - 지역 기반 자동 결제수단 선택
 */

import * as PortOne from "@portone/browser-sdk/v2"
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
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
import {
  convertKRWtoUSD,
  detectLocale,
  formatPrice,
  getDefaultPaymentMethod,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/locale"

// ============================================================================
// Config - Environment Variables (Required)
// ============================================================================

// PortOne keys from environment variables (set in .env file)
const PORTONE_STORE_ID = env.VITE_PORTONE_STORE_ID
const PORTONE_CHANNEL_KEY_TOSS = env.VITE_PORTONE_CHANNEL_KEY_TOSS
const PORTONE_CHANNEL_KEY_PAYPAL = env.VITE_PORTONE_CHANNEL_KEY_PAYPAL

// ============================================================================
// Types
// ============================================================================

type PlanPriceInfo = {
  currency: string
  amount: number // minor unit (원, 센트)
  displayAmount: string // "₩9,900", "$9.99"
  isCalculated: boolean // true = 환율 계산, false = DB 저장값
}

type BillingPlan = {
  id: string
  productId: string
  name: string
  description: string | null
  amount: number
  currency: string
  billingInterval: "day" | "week" | "month" | "year" | null
  intervalCount: number | null
  isActive: boolean
  product?: {
    id: string
    name: string
    tier: string
    description: string | null
  }
  // 다중 통화 가격 (서버에서 조회)
  prices?: PlanPriceInfo[]
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

// 테스트 카드 정보
const TEST_CARD_INFO = {
  cardNumber: "4242424242424242",
  expiry: "12/30",
  cvc: "123",
  password: "12",
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch billing plans with multi-currency prices
 */
function useBillingPlans() {
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlans() {
      try {
        // Fetch plans with multi-currency prices from pricing API
        const response = await apiFetch<{
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
          }>
        }>("/api/v1/billing/pricing/plans?currencies=KRW,USD&activeOnly=true")

        if (response?.plans) {
          // Map to BillingPlan format with prices
          const plansWithPrices: BillingPlan[] = response.plans.map((plan) => {
            const krwPrice = plan.prices.find((p) => p.currency === "KRW")
            return {
              ...plan,
              amount: krwPrice?.amount || 0,
              currency: "KRW",
              prices: plan.prices,
            }
          })
          setPlans(plansWithPrices)
        }
      } catch (err) {
        console.error("[PaymentTest] Failed to fetch plans:", err)
        setError("요금제를 불러오는데 실패했습니다.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPlans()
  }, [])

  return { plans, isLoading, error }
}

// ============================================================================
// Component
// ============================================================================

export function PaymentTestPage() {
  const termsId = useId()
  const privacyId = useId()
  const [searchParams, setSearchParams] = useSearchParams()

  // User & Workspace
  const { data: currentUser } = useCurrentUser()
  const { data: workspaces } = useUserWorkspaces(!!currentUser?.id)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("")
  const currentWorkspace = workspaces?.find((w) => w.id === selectedWorkspaceId)

  // Fetch billing plans from DB
  const { plans, isLoading: isLoadingPlans, error: plansError } = useBillingPlans()

  // Locale detection - 자동으로 지역 기반 결제 수단 선택
  const [locale] = useState(() => detectLocale())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    getDefaultPaymentMethod(locale),
  )

  // PayPal 결제 ID ref
  const paypalPaymentIdRef = useRef<string>("")

  // State
  const [selectedPlanId, setSelectedPlanId] = useState<string>("")
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Payment lookup state
  const [lookupPaymentId, setLookupPaymentId] = useState("")
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  // Selected plan
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  // USD 가격 (서버에서 조회, 없으면 클라이언트 계산)
  const selectedPlanUSD = selectedPlan
    ? (selectedPlan.prices?.find((p) => p.currency === "USD")?.amount ??
      Math.round(convertKRWtoUSD(selectedPlan.amount) * 100))
    : 0

  // 가격 표시용 헬퍼
  const getPriceDisplay = (plan: BillingPlan, currency: "KRW" | "USD") => {
    const priceInfo = plan.prices?.find((p) => p.currency === currency)
    if (priceInfo) {
      return priceInfo.displayAmount
    }
    // Fallback
    return currency === "KRW"
      ? formatPrice(plan.amount, "KRW")
      : formatPrice(convertKRWtoUSD(plan.amount), "USD")
  }

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

  // Handle mobile redirect (payment completion from redirect)
  useEffect(() => {
    const redirectPaymentId = searchParams.get("paymentId")
    const tab = searchParams.get("tab")

    if (redirectPaymentId && tab === "payment-test") {
      // Clear URL params
      setSearchParams({})

      // Process the redirected payment inline
      setIsProcessing(true)
      setError(null)

      apiFetch<{
        success: boolean
        data: {
          id: string
          status: string
          amount: { total: number }
          method?: { type: string }
          paidAt?: string
        }
      }>(`/api/v1/payments/${redirectPaymentId}`)
        .then((verifyResponse) => {
          if (verifyResponse?.success && verifyResponse?.data?.status === "PAID") {
            setPaymentResult({
              success: true,
              paymentId: redirectPaymentId,
              status: "PAID",
              message: "결제가 완료되었습니다. 구독 처리는 별도로 확인해주세요.",
            })
          } else {
            setPaymentResult({
              success: false,
              paymentId: redirectPaymentId,
              message: "결제가 완료되지 않았습니다.",
              status: verifyResponse?.data?.status,
            })
          }
        })
        .catch((err) => {
          console.error("[Payment] Mobile redirect error:", err)
          setError("결제 확인 중 오류가 발생했습니다.")
        })
        .finally(() => {
          setIsProcessing(false)
        })
    }
  }, [searchParams, setSearchParams])

  // 환경변수 설정 여부 (토스는 필수, 페이팔은 선택)
  const isTossConfigured = Boolean(PORTONE_STORE_ID && PORTONE_CHANNEL_KEY_TOSS)
  const isPaypalConfigured = Boolean(PORTONE_STORE_ID && PORTONE_CHANNEL_KEY_PAYPAL)
  const isEnvConfigured = paymentMethod === "TOSS" ? isTossConfigured : isPaypalConfigured

  // 결제 가능 여부
  const canPay =
    agreedTerms &&
    agreedPrivacy &&
    !isProcessing &&
    selectedPlan &&
    currentWorkspace &&
    isEnvConfigured

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Complete payment on server (call /complete API)
   */
  const completePaymentOnServer = useCallback(
    async (paymentId: string, currency: "KRW" | "USD" = "KRW") => {
      if (!(selectedPlan && currentWorkspace?.id && currentUser?.id)) {
        throw new Error("Missing required data for payment completion")
      }

      try {
        // USD는 이미 센트 단위 (서버에서 조회), KRW는 원 단위
        // selectedPlanUSD는 prices 배열에서 가져온 센트 단위 값
        const amountToSend =
          currency === "USD"
            ? selectedPlanUSD // 이미 센트 단위
            : selectedPlan.amount // 원 단위

        const completeResponse = await apiFetch<{
          success: boolean
          data: {
            subscriptionId: string
            paymentId: string
            status: string
            plan: { id: string; name: string; amount: number }
            product: { id: string; name: string; tier: string } | null
            currentPeriodEnd: string
          }
        }>("/api/v1/payments/complete", {
          method: "POST",
          body: JSON.stringify({
            paymentId,
            planId: selectedPlan.id,
            workspaceId: currentWorkspace.id,
            customerId: currentUser.id,
            currency, // KRW or USD
            amount: amountToSend,
          }),
        })

        if (completeResponse?.success && completeResponse?.data) {
          setPaymentResult({
            success: true,
            paymentId,
            status: "PAID",
            subscriptionId: completeResponse.data.subscriptionId,
            plan: completeResponse.data.plan,
            product: completeResponse.data.product,
            amount: completeResponse.data.plan.amount,
          })
        } else {
          setPaymentResult({
            success: true,
            paymentId,
            message: "결제는 완료되었으나 구독 처리 중입니다.",
          })
        }
      } catch (err) {
        console.error("[Payment] Complete API error:", err)
        setPaymentResult({
          success: false,
          paymentId,
          status: "PAID",
          message: "결제는 완료되었으나 구독 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",
        })
        setError("구독 처리 중 오류가 발생했습니다. 결제는 완료되었습니다.")
      }
    },
    [selectedPlan, selectedPlanUSD, currentWorkspace?.id, currentUser?.id],
  )

  /**
   * 결제 요청 - 토스페이먼츠 (KRW)
   */
  const handleTossPayment = async () => {
    if (!(canPay && selectedPlan)) {
      return
    }

    setIsProcessing(true)
    setError(null)
    setPaymentResult(null)

    const paymentId = `payment-${crypto.randomUUID()}`

    try {
      const response = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY_TOSS,
        paymentId,
        orderName: selectedPlan.product?.name || selectedPlan.name,
        totalAmount: selectedPlan.amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          email: currentUser?.email || "test@example.com",
          fullName: currentUser?.username || "테스트 사용자",
          phoneNumber: "01012345678",
        },
        redirectUrl: `${window.location.origin}/settings?tab=payment-test&paymentId=${paymentId}`,
        customData: {
          planId: selectedPlan.id,
          productId: selectedPlan.productId,
          workspaceId: currentWorkspace?.id,
          currency: "KRW",
        },
      })

      if (!response || response.code) {
        const errorMessage = response?.message || "결제가 취소되었습니다."
        setError(errorMessage)
        setPaymentResult({ success: false, paymentId, message: errorMessage })
        return
      }

      await completePaymentOnServer(paymentId, "KRW")
    } catch (err) {
      console.error("[Payment] Toss error:", err)
      setError(err instanceof Error ? err.message : "결제 처리 중 오류가 발생했습니다.")
      setPaymentResult({ success: false, paymentId, message: String(err) })
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * 페이팔 SPB 버튼 렌더링
   */
  useEffect(() => {
    // 페이팔이 선택되지 않았거나, 설정이 안 되었거나, 플랜이 없으면 스킵
    if (
      paymentMethod !== "PAYPAL" ||
      !isPaypalConfigured ||
      !selectedPlan ||
      !agreedTerms ||
      !agreedPrivacy
    ) {
      return
    }

    // 새 paymentId 생성
    paypalPaymentIdRef.current = `payment-${crypto.randomUUID()}`

    // PayPal SPB 버튼 렌더링
    // Note: PortOne SDK는 'portone-ui-container' 클래스를 가진 div에 자동으로 버튼 렌더링
    // USD 금액은 minor unit (센트) 단위로 전송해야 함 (예: $10.00 = 1000)
    // selectedPlanUSD는 이미 센트 단위 (서버에서 조회)

    PortOne.loadPaymentUI(
      {
        uiType: "PAYPAL_SPB",
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY_PAYPAL ?? "",
        paymentId: paypalPaymentIdRef.current,
        orderName: selectedPlan.product?.name || selectedPlan.name,
        totalAmount: selectedPlanUSD, // 이미 센트 단위
        currency: "CURRENCY_USD",
        customer: {
          email: currentUser?.email || "test@example.com",
          fullName: currentUser?.username || "Test User",
        },
        customData: {
          planId: selectedPlan.id,
          productId: selectedPlan.productId,
          workspaceId: currentWorkspace?.id,
          currency: "USD",
        },
      },
      {
        onPaymentSuccess: async () => {
          setIsProcessing(true)
          try {
            // 서버에는 원래 USD 금액 전송 (센트 아님)
            await completePaymentOnServer(paypalPaymentIdRef.current, "USD")
          } finally {
            setIsProcessing(false)
          }
        },
        onPaymentFail: (error) => {
          console.error("[Payment] PayPal error:", error)
          const errorMessage =
            typeof error === "object" && error !== null && "message" in error
              ? String(error.message)
              : "PayPal payment failed"
          setError(errorMessage)
          setPaymentResult({
            success: false,
            paymentId: paypalPaymentIdRef.current,
            message: errorMessage,
          })
        },
      },
    )
  }, [
    paymentMethod,
    isPaypalConfigured,
    selectedPlan,
    selectedPlanUSD,
    agreedTerms,
    agreedPrivacy,
    currentUser,
    currentWorkspace?.id,
    completePaymentOnServer,
  ])

  /**
   * 결제 요청 핸들러 (결제 수단에 따라 분기)
   */
  const handlePayment = () => {
    if (paymentMethod === "TOSS") {
      handleTossPayment()
    }
    // PayPal은 SPB 버튼으로 직접 결제
  }

  /**
   * 결제 내역 조회
   */
  const handleLookupPayment = async () => {
    if (!lookupPaymentId.trim()) {
      return
    }

    setIsLookingUp(true)
    setLookupResult(null)

    try {
      const response = await apiFetch<Record<string, unknown>>(
        `/api/v1/payments/${lookupPaymentId.trim()}`,
      )
      setLookupResult(response)
    } catch (err) {
      setLookupResult({ error: err instanceof Error ? err.message : "조회 실패" })
    } finally {
      setIsLookingUp(false)
    }
  }

  /**
   * 상태 초기화
   */
  const handleReset = () => {
    setPaymentResult(null)
    setError(null)
    setAgreedTerms(false)
    setAgreedPrivacy(false)
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
          포트원 V2 + 토스페이먼츠 결제 연동 테스트 (PG 심사용)
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
              결제창 정상 호출 (PortOne SDK v2)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              이용약관/개인정보 동의 체크박스
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              실제 상품(요금제) 정보 연동
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              결제 완료 후 서버 검증 + 구독 생성
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
            <AlertTitle>지역 기반 결제 수단 자동 선택</AlertTitle>
            <AlertDescription>
              감지된 언어: <code className="rounded bg-muted px-1">{locale.language}</code>
              {" → "}
              {locale.isKorean ? "한국 카드결제 (KRW)" : "PayPal (USD)"} 기본 선택
              <span className="ml-2 text-muted-foreground text-xs">(아래에서 변경 가능)</span>
            </AlertDescription>
          </Alert>

          {/* 환경변수 미설정 경고 */}
          {!isEnvConfigured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>환경변수 미설정</AlertTitle>
              <AlertDescription>
                {paymentMethod === "TOSS" ? "토스페이먼츠" : "페이팔"} 결제를 사용하려면{" "}
                <code className="rounded bg-muted px-1">.env</code> 파일에 환경변수를 설정해야
                합니다.
                <ul className="mt-2 list-inside list-disc text-sm">
                  <li>
                    <code>VITE_PORTONE_STORE_ID</code>
                    {PORTONE_STORE_ID ? " ✓" : " (미설정)"}
                  </li>
                  {paymentMethod === "TOSS" ? (
                    <li>
                      <code>VITE_PORTONE_CHANNEL_KEY_TOSS</code>
                      {PORTONE_CHANNEL_KEY_TOSS ? " ✓" : " (미설정)"}
                    </li>
                  ) : (
                    <li>
                      <code>VITE_PORTONE_CHANNEL_KEY_PAYPAL</code>
                      {PORTONE_CHANNEL_KEY_PAYPAL ? " ✓" : " (미설정)"}
                    </li>
                  )}
                </ul>
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
                                {getPriceDisplay(plan, "KRW")}/{formatInterval(plan)}
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
                            <p className="font-bold text-lg">
                              {paymentMethod === "TOSS"
                                ? getPriceDisplay(selectedPlan, "KRW")
                                : getPriceDisplay(selectedPlan, "USD")}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              /{formatInterval(selectedPlan)}
                            </p>
                            {/* 다른 통화 가격 참고 표시 */}
                            <p className="mt-1 text-muted-foreground text-xs">
                              {paymentMethod === "TOSS"
                                ? `≈ ${getPriceDisplay(selectedPlan, "USD")}`
                                : `≈ ${getPriceDisplay(selectedPlan, "KRW")}`}
                            </p>
                            {/* 환율 계산 여부 표시 */}
                            {selectedPlan.prices?.find(
                              (p) => p.currency === (paymentMethod === "TOSS" ? "USD" : "KRW"),
                            )?.isCalculated && (
                              <p className="text-muted-foreground text-xs">(환율 적용)</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 결제 수단 선택 */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">결제 수단</h4>
                      <RadioGroup
                        className="grid grid-cols-2 gap-3"
                        onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                        value={paymentMethod}
                      >
                        {/* 토스페이먼츠 (한국) */}
                        <div>
                          <RadioGroupItem
                            className="peer sr-only"
                            disabled={!isTossConfigured}
                            id="payment-toss"
                            value="TOSS"
                          />
                          <Label
                            className={`flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${
                              isTossConfigured ? "" : "cursor-not-allowed opacity-50"
                            }`}
                            htmlFor="payment-toss"
                          >
                            <CreditCard className="mb-2 h-6 w-6" />
                            <div className="text-center">
                              <p className="font-medium text-sm">
                                {PAYMENT_METHODS.TOSS.icon} {PAYMENT_METHODS.TOSS.name}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {selectedPlan && getPriceDisplay(selectedPlan, "KRW")}
                              </p>
                              {/* 해외 사용자에게 토스 선택 시 안내 */}
                              {!locale.isKorean && (
                                <p className="mt-1 text-orange-500 text-xs">한국 카드만 지원</p>
                              )}
                            </div>
                          </Label>
                        </div>

                        {/* 페이팔 (해외) */}
                        <div>
                          <RadioGroupItem
                            className="peer sr-only"
                            disabled={!isPaypalConfigured || locale.isKorean}
                            id="payment-paypal"
                            value="PAYPAL"
                          />
                          <Label
                            className={`flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${
                              !isPaypalConfigured || locale.isKorean
                                ? "cursor-not-allowed opacity-50"
                                : ""
                            }`}
                            htmlFor="payment-paypal"
                          >
                            <Globe className="mb-2 h-6 w-6" />
                            <div className="text-center">
                              <p className="font-medium text-sm">
                                {PAYMENT_METHODS.PAYPAL.icon} {PAYMENT_METHODS.PAYPAL.name}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {selectedPlan && getPriceDisplay(selectedPlan, "USD")}
                              </p>
                              {/* 한국 사용자에게 PayPal 불가 안내 */}
                              {locale.isKorean && (
                                <p className="mt-1 text-orange-500 text-xs">해외 구매자 전용</p>
                              )}
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                      {!isPaypalConfigured && (
                        <p className="text-muted-foreground text-xs">
                          PayPal 결제를 사용하려면 환경변수를 설정하세요.
                        </p>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                {/* 약관 동의 */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">약관 동의</h4>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={agreedTerms}
                      id={termsId}
                      onCheckedChange={(checked) => setAgreedTerms(checked === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label className="cursor-pointer text-sm" htmlFor={termsId}>
                        <span className="text-destructive">[필수]</span> 이용약관 동의
                      </Label>
                      <a
                        className="flex items-center gap-1 text-muted-foreground text-xs hover:underline"
                        href="/terms"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        이용약관 보기 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={agreedPrivacy}
                      id={privacyId}
                      onCheckedChange={(checked) => setAgreedPrivacy(checked === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label className="cursor-pointer text-sm" htmlFor={privacyId}>
                        <span className="text-destructive">[필수]</span> 개인정보 수집/이용 동의
                      </Label>
                      <a
                        className="flex items-center gap-1 text-muted-foreground text-xs hover:underline"
                        href="/privacy"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        개인정보처리방침 보기 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 결제 버튼 영역 */}
                {paymentMethod === "TOSS" ? (
                  /* 토스페이먼츠: 일반 버튼 */
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
                          ? `${getPriceDisplay(selectedPlan, "KRW")} 결제하기`
                          : "요금제를 선택하세요"}
                      </>
                    )}
                  </Button>
                ) : (
                  /* PayPal: SPB 버튼 컨테이너 */
                  <div className="space-y-3">
                    {isProcessing && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>결제 처리 중...</span>
                      </div>
                    )}
                    {isPaypalConfigured ? (
                      agreedTerms && agreedPrivacy ? (
                        <>
                          <div className="mb-2 text-center text-muted-foreground text-sm">
                            {selectedPlan && getPriceDisplay(selectedPlan, "USD")}
                          </div>
                          {/* PortOne SDK는 'portone-ui-container' 클래스를 가진 div를 찾아 PayPal 버튼 렌더링 */}
                          <div className="portone-ui-container flex min-h-[50px] items-center justify-center" />
                        </>
                      ) : (
                        <div className="py-4 text-center text-muted-foreground text-sm">
                          약관에 동의하면 PayPal 버튼이 표시됩니다
                        </div>
                      )
                    ) : (
                      <div className="py-4 text-center text-muted-foreground text-sm">
                        PayPal 환경변수를 설정해주세요
                      </div>
                    )}
                  </div>
                )}

                {!(agreedTerms && agreedPrivacy) && selectedPlan ? (
                  <p className="text-center text-muted-foreground text-xs">
                    결제를 진행하려면 필수 약관에 동의해주세요
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {/* 결제 결과 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">결제 결과</CardTitle>
                <CardDescription>결제 처리 결과가 여기에 표시됩니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>결제 실패</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

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
                              variant={paymentResult.status === "PAID" ? "default" : "secondary"}
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

                {!(paymentResult || error) && (
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
              <CardDescription>결제 ID로 결제 내역을 조회합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  onChange={(e) => setLookupPaymentId(e.target.value)}
                  placeholder="payment-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={lookupPaymentId}
                />
                <Button
                  disabled={isLookingUp || !lookupPaymentId.trim()}
                  onClick={handleLookupPayment}
                >
                  {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : "조회"}
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
                <CardDescription>토스페이먼츠 테스트 결제용 카드</CardDescription>
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
                <CardDescription>포트원 V2 설정 정보</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Store ID</span>
                    {PORTONE_STORE_ID ? (
                      <code className="max-w-[200px] truncate rounded bg-muted px-2 py-0.5 text-xs">
                        {PORTONE_STORE_ID.substring(0, 20)}...
                      </code>
                    ) : (
                      <Badge variant="destructive">미설정</Badge>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Channel Key</span>
                    {PORTONE_CHANNEL_KEY_TOSS ? (
                      <code className="max-w-[200px] truncate rounded bg-muted px-2 py-0.5 text-xs">
                        {PORTONE_CHANNEL_KEY_TOSS.substring(0, 20)}...
                      </code>
                    ) : (
                      <Badge variant="destructive">미설정</Badge>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SDK 버전</span>
                    <Badge variant="outline">v2</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">결제 모드</span>
                    <Badge variant="secondary">테스트</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">환경변수 상태</span>
                    <Badge variant={isEnvConfigured ? "default" : "destructive"}>
                      {isEnvConfigured ? "설정 완료" : "미설정"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PG 심사 안내 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">PG 심사 통과 요건</CardTitle>
                <CardDescription>토스페이먼츠 심사 시 확인되는 항목들</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">필수 구현 사항</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>- 결제창 정상 호출</li>
                      <li>- 결제 완료 후 서버 검증</li>
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
