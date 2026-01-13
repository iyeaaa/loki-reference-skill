/**
 * Public Payment Test Page
 *
 * PG 심사용 공개 결제 테스트 페이지
 * - 로그인 없이 접근 가능
 * - 국내: 토스페이먼츠 (KRW)
 * - 해외: 페이팔 (USD)
 *
 * 경로: /payment-test
 */

import * as PortOne from "@portone/browser-sdk/v2"
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
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
import { env } from "@/lib/env"
import {
  convertKRWtoUSD,
  detectLocale,
  type ExchangeRateInfo,
  fetchExchangeRate,
  formatPrice,
  getDefaultPaymentMethod,
  getExchangeRateSourceLabel,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/locale"

// ============================================================================
// Config
// ============================================================================

const PORTONE_STORE_ID = env.VITE_PORTONE_STORE_ID
const PORTONE_CHANNEL_KEY_TOSS = env.VITE_PORTONE_CHANNEL_KEY_TOSS
const PORTONE_CHANNEL_KEY_PAYPAL = env.VITE_PORTONE_CHANNEL_KEY_PAYPAL

// API Base URL
const API_BASE_URL = env.VITE_API_URL || ""

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
}

// 테스트 카드 정보
const TEST_CARD_INFO = {
  cardNumber: "4242424242424242",
  expiry: "12/30",
  cvc: "123",
  password: "12",
}

// ============================================================================
// API Helper (No Auth Required)
// ============================================================================

// 글로벌 서비스 타임아웃 설정
const API_TIMEOUT = {
  DEFAULT: 15_000, // 15초 - 일반 조회
  PAYMENT: 30_000, // 30초 - 결제 관련 (네트워크 지연 고려)
} as const

async function publicApiFetch<T>(
  endpoint: string,
  options: { timeout?: number } = {},
): Promise<T | null> {
  const timeout = options.timeout ?? API_TIMEOUT.DEFAULT

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeout),
    })
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    return await response.json()
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      console.error("[PublicAPI] Request timeout:", endpoint)
    } else {
      console.error("[PublicAPI] Error:", err)
    }
    return null
  }
}

// ============================================================================
// Hooks
// ============================================================================

function useBillingPlans() {
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await publicApiFetch<{
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
// Helper Functions
// ============================================================================

function formatInterval(plan: BillingPlan): string {
  if (!plan.billingInterval) {
    return "일시불"
  }
  const count = plan.intervalCount || 1
  const intervalMap: Record<string, string> = {
    day: "일",
    week: "주",
    month: "월",
    year: "년",
  }
  return count === 1
    ? intervalMap[plan.billingInterval]
    : `${count}${intervalMap[plan.billingInterval]}`
}

// ============================================================================
// Component
// ============================================================================

export default function PaymentTestPublic() {
  const termsId = useId()
  const privacyId = useId()
  const [searchParams, setSearchParams] = useSearchParams()

  // Fetch billing plans from DB
  const { plans, isLoading: isLoadingPlans, error: plansError } = useBillingPlans()

  // Locale detection
  const [locale] = useState(() => detectLocale())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    getDefaultPaymentMethod(locale),
  )

  // Exchange rate
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateInfo | null>(null)

  // Fetch exchange rate on mount
  useEffect(() => {
    fetchExchangeRate("USD", "KRW").then(setExchangeRate)
  }, [])

  // PayPal ref
  const paypalPaymentIdRef = useRef<string>("")

  // State
  const [selectedPlanId, setSelectedPlanId] = useState<string>("")
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Payment lookup
  const [lookupPaymentId, setLookupPaymentId] = useState("")
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  // Selected plan
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  // USD price (DB 가격 우선, 없으면 환율로 계산)
  const selectedPlanUSD = selectedPlan
    ? (selectedPlan.prices?.find((p) => p.currency === "USD")?.amount ??
      Math.round(convertKRWtoUSD(selectedPlan.amount, exchangeRate?.rate) * 100))
    : 0

  // Price display helper
  const getPriceDisplay = (plan: BillingPlan, currency: "KRW" | "USD") => {
    const priceInfo = plan.prices?.find((p) => p.currency === currency)
    if (priceInfo) {
      return priceInfo.displayAmount
    }
    return currency === "KRW"
      ? formatPrice(plan.amount, "KRW")
      : formatPrice(convertKRWtoUSD(plan.amount, exchangeRate?.rate), "USD")
  }

  // Set default plan
  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id)
    }
  }, [plans, selectedPlanId])

  // Handle mobile redirect
  useEffect(() => {
    const redirectPaymentId = searchParams.get("paymentId")

    if (redirectPaymentId) {
      setSearchParams({})
      setIsProcessing(true)
      setError(null)

      publicApiFetch<{
        success: boolean
        data: {
          id: string
          status: string
          amount: { total: number }
          method?: { type: string }
          paidAt?: string
        }
      }>(`/api/v1/payments/${redirectPaymentId}`, { timeout: API_TIMEOUT.PAYMENT })
        .then((verifyResponse) => {
          if (verifyResponse?.success && verifyResponse?.data?.status === "PAID") {
            setPaymentResult({
              success: true,
              paymentId: redirectPaymentId,
              status: "PAID",
              message: "결제가 완료되었습니다.",
              amount: verifyResponse.data.amount.total,
              method: verifyResponse.data.method?.type,
              paidAt: verifyResponse.data.paidAt,
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

  // Environment check
  const isTossConfigured = Boolean(PORTONE_STORE_ID && PORTONE_CHANNEL_KEY_TOSS)
  const isPaypalConfigured = Boolean(PORTONE_STORE_ID && PORTONE_CHANNEL_KEY_PAYPAL)
  const isEnvConfigured = paymentMethod === "TOSS" ? isTossConfigured : isPaypalConfigured

  // Can pay check
  const canPay = agreedTerms && agreedPrivacy && !isProcessing && selectedPlan && isEnvConfigured

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleTossPayment = async () => {
    if (!(canPay && selectedPlan)) {
      return
    }

    setIsProcessing(true)
    setError(null)
    setPaymentResult(null)

    const paymentId = `pg-test-${crypto.randomUUID()}`

    try {
      const response = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY_TOSS,
        paymentId,
        orderName: `[PG심사] ${selectedPlan.product?.name || selectedPlan.name}`,
        totalAmount: selectedPlan.amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          email: "pg-test@example.com",
          fullName: "PG심사테스트",
          phoneNumber: "01012345678",
        },
        customData: {
          planId: selectedPlan.id,
          isTestPayment: true,
        },
        redirectUrl: `${window.location.origin}/payment-test?paymentId=${paymentId}`,
      })

      if (response?.code) {
        setError(`결제 실패: ${response.message || response.code}`)
        setPaymentResult({
          success: false,
          paymentId,
          message: response.message || "결제가 취소되었습니다.",
        })
      } else if (response?.paymentId) {
        // Verify payment
        const verifyResponse = await publicApiFetch<{
          success: boolean
          data: {
            id: string
            status: string
            amount: { total: number }
            method?: { type: string }
            paidAt?: string
          }
        }>(`/api/v1/payments/${response.paymentId}`, { timeout: API_TIMEOUT.PAYMENT })

        if (verifyResponse?.data?.status === "PAID") {
          setPaymentResult({
            success: true,
            paymentId: response.paymentId,
            status: "PAID",
            message: "결제가 완료되었습니다.",
            amount: verifyResponse.data.amount.total,
            method: verifyResponse.data.method?.type,
            paidAt: verifyResponse.data.paidAt,
          })
        } else {
          setPaymentResult({
            success: false,
            paymentId: response.paymentId,
            status: verifyResponse?.data?.status,
            message: "결제 상태 확인이 필요합니다.",
          })
        }
      }
    } catch (err) {
      console.error("[Payment] Toss error:", err)
      setError("결제 처리 중 오류가 발생했습니다.")
    } finally {
      setIsProcessing(false)
    }
  }

  // PayPal SPB
  useEffect(() => {
    if (
      paymentMethod !== "PAYPAL" ||
      !isPaypalConfigured ||
      !selectedPlan ||
      !agreedTerms ||
      !agreedPrivacy
    ) {
      return
    }

    paypalPaymentIdRef.current = `pg-test-${crypto.randomUUID()}`

    PortOne.loadPaymentUI(
      {
        uiType: "PAYPAL_SPB",
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY_PAYPAL ?? "",
        paymentId: paypalPaymentIdRef.current,
        orderName: `[PG Test] ${selectedPlan.product?.name || selectedPlan.name}`,
        totalAmount: selectedPlanUSD,
        currency: "CURRENCY_USD",
        customer: {
          email: "pg-test@example.com",
          fullName: "PG Test User",
        },
        customData: {
          planId: selectedPlan.id,
          isTestPayment: true,
        },
      },
      {
        onPaymentSuccess: async () => {
          setIsProcessing(true)
          try {
            const verifyResponse = await publicApiFetch<{
              success: boolean
              data: {
                id: string
                status: string
                amount: { total: number }
                method?: { type: string }
                paidAt?: string
              }
            }>(`/api/v1/payments/${paypalPaymentIdRef.current}`, { timeout: API_TIMEOUT.PAYMENT })

            if (verifyResponse?.data?.status === "PAID") {
              setPaymentResult({
                success: true,
                paymentId: paypalPaymentIdRef.current,
                status: "PAID",
                message: "PayPal 결제가 완료되었습니다.",
                amount: verifyResponse.data.amount.total,
                method: "PayPal",
                paidAt: verifyResponse.data.paidAt,
              })
            }
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

    return () => {
      const container = document.querySelector(".portone-ui-container")
      if (container) {
        container.innerHTML = ""
      }
    }
  }, [paymentMethod, selectedPlan, selectedPlanUSD, agreedTerms, agreedPrivacy, isPaypalConfigured])

  const handleLookupPayment = async () => {
    if (!lookupPaymentId.trim()) {
      return
    }

    setIsLookingUp(true)
    setLookupResult(null)

    try {
      const response = await publicApiFetch<Record<string, unknown>>(
        `/api/v1/payments/${lookupPaymentId.trim()}`,
        { timeout: API_TIMEOUT.PAYMENT },
      )
      setLookupResult(response)
    } catch (err) {
      console.error("[Lookup] Error:", err)
      setLookupResult({ error: "조회 실패" })
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleReset = () => {
    setPaymentResult(null)
    setError(null)
    setAgreedTerms(false)
    setAgreedPrivacy(false)
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-bold text-3xl">PG 결제 테스트</h1>
          <p className="text-gray-600">토스페이먼츠 / PayPal 결제 심사용 테스트 페이지</p>
          <Badge className="mt-2" variant="outline">
            테스트 모드
          </Badge>
        </div>

        <Tabs className="space-y-6" defaultValue="payment">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="payment">결제 테스트</TabsTrigger>
            <TabsTrigger value="lookup">결제 조회</TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-6" value="payment">
            {/* Region Info */}
            <Alert>
              <Globe className="h-4 w-4" />
              <AlertTitle>지역 기반 결제 수단</AlertTitle>
              <AlertDescription>
                <div>
                  감지된 언어: <code className="rounded bg-gray-200 px-1">{locale.language}</code>
                  {" → "}
                  {locale.isKorean ? "한국 카드결제 (KRW)" : "PayPal (USD)"} 기본 선택
                </div>
                {exchangeRate && (
                  <div className="mt-1 text-gray-500 text-xs">
                    환율: 1 USD = {exchangeRate.rate.toLocaleString()} KRW
                    <span className="ml-2 rounded bg-blue-100 px-1 text-blue-700">
                      {getExchangeRateSourceLabel(exchangeRate.source)}
                    </span>
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {/* Env Warning */}
            {!isEnvConfigured && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>환경변수 미설정</AlertTitle>
                <AlertDescription>결제를 사용하려면 환경변수를 설정해야 합니다.</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Plan Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">결제 정보</CardTitle>
                  <CardDescription>요금제를 선택하세요</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Plan Select */}
                  <div className="space-y-2">
                    <Label className="font-medium text-sm">요금제</Label>
                  </div>
                  {isLoadingPlans ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : plansError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{plansError}</AlertDescription>
                    </Alert>
                  ) : plans.length === 0 ? (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>활성화된 요금제가 없습니다.</AlertDescription>
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
                                <span className="text-gray-500">
                                  {getPriceDisplay(plan, "KRW")}/{formatInterval(plan)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Selected Plan Info */}
                      {selectedPlan && (
                        <div className="rounded-lg bg-gray-100 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">
                                {selectedPlan.product?.name || selectedPlan.name}
                              </h4>
                              <p className="text-gray-500 text-sm">
                                {selectedPlan.description || "설명 없음"}
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
                              <p className="text-gray-500 text-xs">
                                /{formatInterval(selectedPlan)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment Method */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">결제 수단</h4>
                        <RadioGroup
                          className="grid grid-cols-2 gap-3"
                          onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                          value={paymentMethod}
                        >
                          {/* Toss */}
                          <div>
                            <RadioGroupItem
                              className="peer sr-only"
                              disabled={!isTossConfigured}
                              id="payment-toss"
                              value="TOSS"
                            />
                            <Label
                              className={`flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 peer-data-[state=checked]:border-blue-500 ${
                                isTossConfigured ? "" : "cursor-not-allowed opacity-50"
                              }`}
                              htmlFor="payment-toss"
                            >
                              <CreditCard className="mb-2 h-6 w-6" />
                              <div className="text-center">
                                <p className="font-medium text-sm">
                                  {PAYMENT_METHODS.TOSS.icon} {PAYMENT_METHODS.TOSS.name}
                                </p>
                                <p className="text-gray-500 text-xs">
                                  {selectedPlan && getPriceDisplay(selectedPlan, "KRW")}
                                </p>
                              </div>
                            </Label>
                          </div>

                          {/* PayPal */}
                          <div>
                            <RadioGroupItem
                              className="peer sr-only"
                              disabled={!isPaypalConfigured || locale.isKorean}
                              id="payment-paypal"
                              value="PAYPAL"
                            />
                            <Label
                              className={`flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 peer-data-[state=checked]:border-blue-500 ${
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
                                <p className="text-gray-500 text-xs">
                                  {selectedPlan && getPriceDisplay(selectedPlan, "USD")}
                                </p>
                                {locale.isKorean && (
                                  <p className="mt-1 text-orange-500 text-xs">해외 구매자 전용</p>
                                )}
                              </div>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Terms */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            checked={agreedTerms}
                            id={termsId}
                            onCheckedChange={(checked) => setAgreedTerms(checked === true)}
                          />
                          <Label
                            className="cursor-pointer text-sm leading-relaxed"
                            htmlFor={termsId}
                          >
                            <span className="text-red-500">[필수]</span> 이용약관에 동의합니다
                          </Label>
                        </div>

                        <div className="flex items-start space-x-3">
                          <Checkbox
                            checked={agreedPrivacy}
                            id={privacyId}
                            onCheckedChange={(checked) => setAgreedPrivacy(checked === true)}
                          />
                          <Label
                            className="cursor-pointer text-sm leading-relaxed"
                            htmlFor={privacyId}
                          >
                            <span className="text-red-500">[필수]</span> 개인정보 처리방침에
                            동의합니다
                          </Label>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Payment Button */}
                  {paymentMethod === "TOSS" ? (
                    <Button
                      className="w-full"
                      disabled={!canPay}
                      onClick={handleTossPayment}
                      size="lg"
                    >
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
                            <div className="mb-2 text-center text-gray-500 text-sm">
                              {selectedPlan && getPriceDisplay(selectedPlan, "USD")}
                            </div>
                            <div className="portone-ui-container flex min-h-[50px] items-center justify-center" />
                          </>
                        ) : (
                          <div className="py-4 text-center text-gray-500 text-sm">
                            약관에 동의하면 PayPal 버튼이 표시됩니다
                          </div>
                        )
                      ) : (
                        <div className="py-4 text-center text-gray-500 text-sm">
                          PayPal 환경변수를 설정해주세요
                        </div>
                      )}
                    </div>
                  )}

                  {!(agreedTerms && agreedPrivacy) && selectedPlan ? (
                    <p className="text-center text-gray-500 text-xs">
                      결제를 진행하려면 필수 약관에 동의해주세요
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {/* Result */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">결제 결과</CardTitle>
                  <CardDescription>결제 처리 결과가 표시됩니다</CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <Alert className="mb-4" variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>오류</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {paymentResult && (
                    <div className="space-y-4">
                      <Alert variant={paymentResult.success ? "default" : "destructive"}>
                        {paymentResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertTitle>{paymentResult.success ? "결제 성공" : "결제 실패"}</AlertTitle>
                        <AlertDescription>{paymentResult.message}</AlertDescription>
                      </Alert>

                      <div className="space-y-2 rounded-lg bg-gray-100 p-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">결제 ID</span>
                          <code className="rounded bg-gray-200 px-2 text-xs">
                            {paymentResult.paymentId}
                          </code>
                        </div>
                        {paymentResult.status && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">상태</span>
                            <Badge
                              variant={paymentResult.status === "PAID" ? "default" : "secondary"}
                            >
                              {paymentResult.status}
                            </Badge>
                          </div>
                        )}
                        {paymentResult.amount && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">금액</span>
                            <span>{paymentResult.amount.toLocaleString()}</span>
                          </div>
                        )}
                        {paymentResult.method && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">결제 수단</span>
                            <span>{paymentResult.method}</span>
                          </div>
                        )}
                        {paymentResult.paidAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">결제 시간</span>
                            <span>{new Date(paymentResult.paidAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <Button className="w-full" onClick={handleReset} variant="outline">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        다시 테스트
                      </Button>
                    </div>
                  )}

                  {!(paymentResult || error) && (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                      <CreditCard className="mb-2 h-12 w-12 opacity-20" />
                      <p>결제를 진행하면 결과가 여기에 표시됩니다</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Test Card Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">테스트 카드 정보</CardTitle>
                <CardDescription>토스페이먼츠 테스트 결제용 카드</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm sm:grid-cols-4">
                  <div className="flex justify-between rounded-lg bg-gray-100 p-3">
                    <span className="text-gray-500">카드번호</span>
                    <code className="rounded bg-gray-200 px-2">{TEST_CARD_INFO.cardNumber}</code>
                  </div>
                  <div className="flex justify-between rounded-lg bg-gray-100 p-3">
                    <span className="text-gray-500">유효기간</span>
                    <code className="rounded bg-gray-200 px-2">{TEST_CARD_INFO.expiry}</code>
                  </div>
                  <div className="flex justify-between rounded-lg bg-gray-100 p-3">
                    <span className="text-gray-500">CVC</span>
                    <code className="rounded bg-gray-200 px-2">{TEST_CARD_INFO.cvc}</code>
                  </div>
                  <div className="flex justify-between rounded-lg bg-gray-100 p-3">
                    <span className="text-gray-500">비밀번호</span>
                    <code className="rounded bg-gray-200 px-2">{TEST_CARD_INFO.password}**</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent className="space-y-6" value="lookup">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">결제 내역 조회</CardTitle>
                <CardDescription>결제 ID로 결제 내역을 조회합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    onChange={(e) => setLookupPaymentId(e.target.value)}
                    placeholder="결제 ID를 입력하세요"
                    value={lookupPaymentId}
                  />
                  <Button disabled={isLookingUp} onClick={handleLookupPayment}>
                    {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : "조회"}
                  </Button>
                </div>

                {lookupResult && (
                  <div className="rounded-lg bg-gray-100 p-4">
                    <pre className="overflow-auto text-xs">
                      {JSON.stringify(lookupResult, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Business Information Footer */}
        <footer className="mt-12 border-gray-200 border-t pt-8">
          <div className="space-y-3 text-center text-gray-500 text-sm">
            <div className="font-semibold text-gray-700">그린다에이아이주식회사</div>
            <div className="space-y-1">
              <p>사업자등록번호: 309-88-02709 | 대표: 강호진</p>
              <p>주소: 대전광역시 유성구 대학로 99, 503호 (궁동, 대전팁스타운)</p>
              <p>통신판매업신고번호: 2024-대전유성-0389</p>
              <p>전화: 010-6326-9009 | 개인정보관리자: 강호진</p>
              <p>이메일: admin@grinda.ai</p>
            </div>
            <div className="pt-4 text-gray-400 text-xs">
              &copy; 2026 Rinda AI. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
