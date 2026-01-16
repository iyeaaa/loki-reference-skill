/**
 * Public Payment Test Page
 *
 * PG 심사용 공개 결제 테스트 페이지
 * - 로그인 없이 접근 가능
 * - TossPayments 정기결제(빌링) SDK 사용
 * - 빌링키 발급 → 자동결제 방식
 *
 * 경로: /payment-test
 */

import { useMutation } from "@tanstack/react-query"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  XCircle,
} from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { publicApiFetch } from "@/lib/api/client"
import { type BillingPlan, usePublicBillingPlans } from "@/lib/api/hooks/public-payment"
import { env } from "@/lib/env"

// ============================================================================
// Config
// ============================================================================

const TOSS_CLIENT_KEY = env.VITE_TOSS_CLIENT_KEY

// ============================================================================
// Types
// ============================================================================

type BillingResult = {
  success: boolean
  billingKey?: string
  customerKey?: string
  message?: string
  cardCompany?: string
  cardNumber?: string
  authenticatedAt?: string
}

type IssueBillingKeyParams = {
  authKey: string
  customerKey: string
}

type IssueBillingKeyResponse = {
  success: boolean
  data?: {
    billingKey: string
    customerKey: string
    cardCompany?: string
    cardNumber?: string
    authenticatedAt?: string
  }
  error?: string
}

// ============================================================================
// API Functions
// ============================================================================

async function issueBillingKeyApi(params: IssueBillingKeyParams): Promise<IssueBillingKeyResponse> {
  return publicApiFetch<IssueBillingKeyResponse>("/api/v1/public/billing/issue-key", {
    method: "POST",
    body: JSON.stringify({
      authKey: params.authKey,
      customerKey: params.customerKey,
    }),
  })
}

async function lookupBillingKeyApi(billingKey: string): Promise<Record<string, unknown>> {
  return publicApiFetch<Record<string, unknown>>(`/api/v1/public/billing/${billingKey}`)
}

async function chargeBillingKeyApi(params: {
  billingKey: string
  amount: number
  orderName: string
}): Promise<Record<string, unknown>> {
  return publicApiFetch<Record<string, unknown>>(
    `/api/v1/public/billing/${params.billingKey}/charge`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: params.amount,
        orderName: params.orderName,
      }),
    },
  )
}

async function deactivateBillingKeyApi(billingKey: string): Promise<Record<string, unknown>> {
  return publicApiFetch<Record<string, unknown>>(
    `/api/v1/public/billing/${billingKey}/deactivate`,
    {
      method: "POST",
    },
  )
}

async function reactivateBillingKeyApi(billingKey: string): Promise<Record<string, unknown>> {
  return publicApiFetch<Record<string, unknown>>(
    `/api/v1/public/billing/${billingKey}/reactivate`,
    {
      method: "POST",
    },
  )
}

// ============================================================================
// Plan Features (tier별 기능 설명)
// ============================================================================

const PLAN_FEATURES: Record<string, string[]> = {
  basic: [
    "월 150개 기업에 맞춤 메일 발송",
    "관심 답장 자동 분류",
    "스팸 방지 관리",
    "월간 결과 리포트",
  ],
  pro: [
    "Basic의 모든 기능 포함",
    "대량 바이어 컨택 (월 1,500개)",
    "전담 매니저 배정",
    "바이어 답장에 1차 대응",
    "미팅 일정 조율 (화상/대면)",
    "경영진 성과 리포트",
  ],
  trial: ["14일 무료 체험", "Basic 플랜의 모든 기능", "신용카드 불필요"],
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
  const [searchParams, setSearchParams] = useSearchParams()

  // IDs for accessibility
  const termsId = useId()
  const privacyId = useId()

  // Fetch billing plans from DB
  const {
    data: plans = [],
    isLoading: isLoadingPlans,
    error: plansQueryError,
  } = usePublicBillingPlans()

  const plansError = plansQueryError ? "요금제를 불러오는데 실패했습니다." : null

  // State
  const [selectedPlanId, setSelectedPlanId] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [billingResult, setBillingResult] = useState<BillingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Terms agreement state
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)

  // Billing key lookup
  const [lookupBillingKey, setLookupBillingKey] = useState("")
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null)

  // Billing key charge (수동 결제)
  const [chargeBillingKey, setChargeBillingKey] = useState("")
  const [chargeAmount, setChargeAmount] = useState("100")
  const [chargeOrderName, setChargeOrderName] = useState("테스트 결제")
  const [chargeResult, setChargeResult] = useState<Record<string, unknown> | null>(null)

  // Billing key management (비활성화/재활성화)
  const [manageBillingKey, setManageBillingKey] = useState("")
  const [manageResult, setManageResult] = useState<Record<string, unknown> | null>(null)

  // Refs to prevent double processing
  const redirectProcessedRef = useRef(false)

  // Selected plan
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  // Price display helper
  const getPriceDisplay = (plan: BillingPlan) => plan.displayAmount

  // Environment check
  const isTossConfigured = Boolean(TOSS_CLIENT_KEY)

  // Can register check - 약관 동의 포함
  const canRegister =
    !isProcessing && selectedPlan && isTossConfigured && agreedTerms && agreedPrivacy

  // Billing key lookup mutation
  const lookupBillingMutation = useMutation({
    mutationFn: lookupBillingKeyApi,
    onSuccess: (data) => setLookupResult(data),
    onError: (err) => {
      console.error("[Lookup] Error:", err)
      setLookupResult({ error: "조회 실패" })
    },
  })

  // Billing key charge mutation (수동 결제)
  const chargeBillingMutation = useMutation({
    mutationFn: chargeBillingKeyApi,
    onSuccess: (data) => setChargeResult(data),
    onError: (err) => {
      console.error("[Charge] Error:", err)
      setChargeResult({ error: "결제 실패" })
    },
  })

  // Billing key deactivate mutation
  const deactivateBillingMutation = useMutation({
    mutationFn: deactivateBillingKeyApi,
    onSuccess: (data) => setManageResult(data),
    onError: (err) => {
      console.error("[Deactivate] Error:", err)
      setManageResult({ error: "비활성화 실패" })
    },
  })

  // Billing key reactivate mutation
  const reactivateBillingMutation = useMutation({
    mutationFn: reactivateBillingKeyApi,
    onSuccess: (data) => setManageResult(data),
    onError: (err) => {
      console.error("[Reactivate] Error:", err)
      setManageResult({ error: "재활성화 실패" })
    },
  })

  // Issue billing key mutation (for redirect handling)
  const issueBillingKeyMutation = useMutation({
    mutationFn: issueBillingKeyApi,
    onSuccess: (response) => {
      if (response?.success && response?.data) {
        setBillingResult({
          success: true,
          billingKey: response.data.billingKey,
          customerKey: response.data.customerKey,
          message: "카드 등록이 완료되었습니다. 정기결제가 설정됩니다.",
          cardCompany: response.data.cardCompany,
          cardNumber: response.data.cardNumber,
          authenticatedAt: response.data.authenticatedAt,
        })
      } else {
        setBillingResult({
          success: false,
          message: response?.error || "빌링키 발급에 실패했습니다.",
        })
      }
    },
    onError: (err) => {
      console.error("[Billing] Issue key error:", err)
      setBillingResult({
        success: false,
        message: "빌링키 발급 중 오류가 발생했습니다.",
      })
    },
    onSettled: () => setIsProcessing(false),
  })

  // Set selected plan when plans are loaded (check tier param first)
  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      const tierParam = searchParams.get("tier")
      const intervalParam = searchParams.get("interval")

      if (tierParam) {
        // tier + interval 조합으로 매칭되는 플랜 찾기
        const matchingPlan = plans.find((p) => {
          const tierMatch =
            p.product?.tier?.toLowerCase() === tierParam.toLowerCase() ||
            p.name.toLowerCase().includes(tierParam.toLowerCase())

          // interval 파라미터가 있으면 billingInterval도 매칭
          if (intervalParam && tierMatch) {
            return p.billingInterval === intervalParam
          }
          return tierMatch
        })

        if (matchingPlan) {
          setSelectedPlanId(matchingPlan.id)
          return
        }
      }
      // 파라미터가 없거나 매칭되는 플랜이 없으면 첫 번째 플랜 선택
      setSelectedPlanId(plans[0].id)
    }
  }, [plans, selectedPlanId, searchParams])

  // Handle redirect from TossPayments (billing auth)
  useEffect(() => {
    if (redirectProcessedRef.current) {
      return
    }

    const authKey = searchParams.get("authKey")
    const customerKey = searchParams.get("customerKey")
    const errorCode = searchParams.get("code")
    const errorMessage = searchParams.get("message")

    // Handle success redirect - issue billing key
    if (authKey && customerKey) {
      redirectProcessedRef.current = true
      setSearchParams({})
      setIsProcessing(true)
      setError(null)

      issueBillingKeyMutation.mutate({
        authKey,
        customerKey,
      })
    }

    // Handle failure redirect
    if (errorCode) {
      redirectProcessedRef.current = true
      setSearchParams({})
      setError(errorMessage || `카드 등록 실패 (${errorCode})`)
      setBillingResult({
        success: false,
        message: errorMessage || "카드 등록이 취소되었거나 실패했습니다.",
      })
    }
  }, [searchParams, setSearchParams, issueBillingKeyMutation.mutate])

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRegisterCard = async () => {
    if (!(canRegister && selectedPlan)) {
      return
    }

    if (!TOSS_CLIENT_KEY) {
      setError("토스페이먼츠 클라이언트 키가 설정되지 않았습니다.")
      return
    }

    setIsProcessing(true)
    setError(null)
    setBillingResult(null)

    // Generate unique customer key (UUID)
    const customerKey = crypto.randomUUID()

    try {
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = tossPayments.payment({ customerKey })

      // Request billing auth (카드 등록창)
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${window.location.origin}/payment-test`,
        failUrl: `${window.location.origin}/payment-test`,
        customerEmail: "pg-test@example.com",
        customerName: "PG심사테스트",
      })
    } catch (err) {
      console.error("[Billing] Error:", err)
      setError("카드 등록 중 오류가 발생했습니다.")
      setBillingResult({
        success: false,
        message: err instanceof Error ? err.message : "카드 등록이 취소되었습니다.",
      })
      setIsProcessing(false)
    }
  }

  const handleLookupBilling = () => {
    if (!lookupBillingKey.trim()) {
      return
    }
    setLookupResult(null)
    lookupBillingMutation.mutate(lookupBillingKey.trim())
  }

  const handleChargeBilling = () => {
    if (!chargeBillingKey.trim()) {
      return
    }
    const amount = Number.parseInt(chargeAmount, 10)
    if (Number.isNaN(amount) || amount < 100) {
      setChargeResult({ error: "금액은 100원 이상이어야 합니다." })
      return
    }
    setChargeResult(null)
    chargeBillingMutation.mutate({
      billingKey: chargeBillingKey.trim(),
      amount,
      orderName: chargeOrderName || "테스트 결제",
    })
  }

  const handleDeactivateBilling = () => {
    if (!manageBillingKey.trim()) {
      return
    }
    setManageResult(null)
    deactivateBillingMutation.mutate(manageBillingKey.trim())
  }

  const handleReactivateBilling = () => {
    if (!manageBillingKey.trim()) {
      return
    }
    setManageResult(null)
    reactivateBillingMutation.mutate(manageBillingKey.trim())
  }

  const handleReset = () => {
    setBillingResult(null)
    setError(null)
  }

  // 빌링키 복사 헬퍼
  const copyBillingKeyToFields = (billingKey: string) => {
    setLookupBillingKey(billingKey)
    setChargeBillingKey(billingKey)
    setManageBillingKey(billingKey)
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5">
            <span className="font-semibold text-blue-700">Rinda AI</span>
            <span className="text-blue-400">|</span>
            <span className="text-blue-600 text-sm">해외 바이어 발굴 · 글로벌 세일즈 자동화</span>
          </div>
          <h1 className="mb-2 font-bold text-2xl">PG 정기결제 테스트</h1>
          <p className="text-gray-500">토스페이먼츠 빌링(자동결제) SDK 심사용 테스트 페이지</p>
          <Badge className="mt-3" variant="outline">
            테스트 모드
          </Badge>
        </div>

        <Tabs className="space-y-6" defaultValue="billing">
          <TabsList className="h-9 rounded-lg bg-muted p-1">
            <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="billing">
              <CreditCard className="h-3.5 w-3.5" />
              카드 등록
            </TabsTrigger>
            <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="lookup">
              <Search className="h-3.5 w-3.5" />
              빌링키 조회
            </TabsTrigger>
            <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="charge">
              <DollarSign className="h-3.5 w-3.5" />
              수동 결제
            </TabsTrigger>
            <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="manage">
              <Settings className="h-3.5 w-3.5" />
              빌링키 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-6" value="billing">
            {/* Info */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>정기결제 안내</AlertTitle>
              <AlertDescription>
                <div>카드를 한 번 등록하면 매월 자동으로 결제됩니다.</div>
                <div className="mt-1 text-gray-500 text-xs">
                  빌링키 발급 → 정기 자동결제 방식 (구매자 인증 1회만 필요)
                </div>
              </AlertDescription>
            </Alert>

            {/* Env Warning */}
            {!isTossConfigured && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>환경변수 미설정</AlertTitle>
                <AlertDescription>
                  결제를 사용하려면{" "}
                  <code className="rounded bg-gray-200 px-1">VITE_TOSS_CLIENT_KEY</code> 환경변수를
                  설정해야 합니다.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Plan Selection & Card Registration */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">정기결제 등록</CardTitle>
                  <CardDescription>요금제를 선택하고 결제 카드를 등록하세요</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Plan Select */}
                  <div className="space-y-2">
                    <Label className="font-medium text-sm">요금제</Label>
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
                                    {getPriceDisplay(plan)}/{formatInterval(plan)}
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
                                <p className="font-bold text-lg">{getPriceDisplay(selectedPlan)}</p>
                                <p className="text-gray-500 text-xs">
                                  /{formatInterval(selectedPlan)}
                                </p>
                              </div>
                            </div>
                            {/* Plan Features */}
                            {selectedPlan.product?.tier &&
                              PLAN_FEATURES[selectedPlan.product.tier.toLowerCase()] && (
                                <div className="mt-4 border-gray-200 border-t pt-4">
                                  <p className="mb-2 font-medium text-gray-700 text-sm">
                                    포함된 기능
                                  </p>
                                  <ul className="space-y-1.5">
                                    {PLAN_FEATURES[selectedPlan.product.tier.toLowerCase()].map(
                                      (feature, index) => (
                                        <li
                                          className="flex items-center gap-2 text-gray-600 text-sm"
                                          key={index}
                                        >
                                          <Check className="h-4 w-4 shrink-0 text-green-500" />
                                          <span>{feature}</span>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* Payment Method Info */}
                  <div className="space-y-3">
                    <Label className="font-medium text-sm">결제 수단</Label>
                    <div className="flex items-center gap-3 rounded-lg border-2 border-blue-500 bg-blue-50/50 p-4">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm">토스페이먼츠 카드 결제</p>
                        <p className="text-gray-500 text-xs">
                          신용카드, 체크카드, 간편결제(토스페이, 네이버페이 등)
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Terms Agreement */}
                  <div className="space-y-3">
                    <Label className="font-medium text-sm">약관 동의</Label>
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
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
                        <Link
                          className="text-gray-500 text-sm hover:text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                          target="_blank"
                          to="/terms"
                        >
                          (보기)
                        </Link>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
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
                        <Link
                          className="text-gray-500 text-sm hover:text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                          target="_blank"
                          to="/privacy"
                        >
                          (보기)
                        </Link>
                      </div>
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

                  {/* Register Button */}
                  <Button
                    className="w-full"
                    disabled={!canRegister}
                    onClick={handleRegisterCard}
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        처리 중...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {selectedPlan
                          ? `카드 등록하고 ${getPriceDisplay(selectedPlan)}/${formatInterval(selectedPlan)} 정기결제 시작`
                          : "요금제를 선택하세요"}
                      </>
                    )}
                  </Button>

                  {!(agreedTerms && agreedPrivacy) && (
                    <p className="text-center text-gray-500 text-xs">
                      카드 등록을 진행하려면 약관에 동의해주세요.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Result */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">등록 결과</CardTitle>
                  <CardDescription>카드 등록 결과가 표시됩니다</CardDescription>
                </CardHeader>
                <CardContent>
                  {billingResult && (
                    <div className="space-y-4">
                      <Alert variant={billingResult.success ? "default" : "destructive"}>
                        {billingResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertTitle>
                          {billingResult.success ? "카드 등록 성공" : "카드 등록 실패"}
                        </AlertTitle>
                        <AlertDescription>{billingResult.message}</AlertDescription>
                      </Alert>

                      {billingResult.success && (
                        <div className="space-y-2 rounded-lg bg-gray-100 p-4 text-sm">
                          {billingResult.billingKey && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">빌링키</span>
                              <code className="rounded bg-gray-200 px-2 text-xs">
                                {billingResult.billingKey}
                              </code>
                            </div>
                          )}
                          {billingResult.customerKey && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">고객 키</span>
                              <code className="rounded bg-gray-200 px-2 text-xs">
                                {billingResult.customerKey}
                              </code>
                            </div>
                          )}
                          {billingResult.cardCompany && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">카드사</span>
                              <span>{billingResult.cardCompany}</span>
                            </div>
                          )}
                          {billingResult.cardNumber && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">카드번호</span>
                              <span>{billingResult.cardNumber}</span>
                            </div>
                          )}
                          {billingResult.authenticatedAt && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">등록 시간</span>
                              <span>
                                {new Date(billingResult.authenticatedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {billingResult.success && billingResult.billingKey && (
                        <Alert className="border-blue-200 bg-blue-50">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800 text-sm">
                            이제 "수동 결제" 탭에서 이 빌링키로 결제를 테스트하거나, "빌링키 관리"
                            탭에서 비활성화할 수 있습니다.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="grid gap-2 sm:grid-cols-2">
                        {billingResult.success && billingResult.billingKey && (
                          <Button
                            className="w-full"
                            onClick={() => {
                              if (billingResult.billingKey) {
                                copyBillingKeyToFields(billingResult.billingKey)
                                // 수동 결제 탭으로 이동
                                const tabTrigger = document.querySelector(
                                  '[value="charge"]',
                                ) as HTMLButtonElement
                                tabTrigger?.click()
                              }
                            }}
                          >
                            <DollarSign className="mr-2 h-4 w-4" />
                            빌링키로 결제하기
                          </Button>
                        )}
                        <Button className="w-full" onClick={handleReset} variant="outline">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          다시 테스트
                        </Button>
                      </div>
                    </div>
                  )}

                  {!billingResult && (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                      <CreditCard className="mb-2 h-12 w-12 opacity-20" />
                      <p>카드를 등록하면 결과가 여기에 표시됩니다</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent className="space-y-6" value="lookup">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">빌링키 조회</CardTitle>
                <CardDescription>
                  빌링키(billingKey)로 등록된 카드 정보를 조회합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    onChange={(e) => setLookupBillingKey(e.target.value)}
                    placeholder="billingKey를 입력하세요"
                    value={lookupBillingKey}
                  />
                  <Button disabled={lookupBillingMutation.isPending} onClick={handleLookupBilling}>
                    {lookupBillingMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "조회"
                    )}
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

          <TabsContent className="space-y-6" value="charge">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>수동 결제 테스트</AlertTitle>
              <AlertDescription>
                <div>등록된 빌링키로 즉시 결제를 요청합니다.</div>
                <div className="mt-1 text-gray-500 text-xs">
                  테스트 환경에서는 당일 23:30에 자동 취소됩니다.
                </div>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">빌링키로 결제</CardTitle>
                <CardDescription>빌링키를 사용하여 카드 인증 없이 바로 결제합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-medium text-sm">빌링키</Label>
                  <Input
                    onChange={(e) => setChargeBillingKey(e.target.value)}
                    placeholder="billingKey를 입력하세요"
                    value={chargeBillingKey}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-medium text-sm">결제 금액 (원)</Label>
                  <Input
                    min={100}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    placeholder="100"
                    type="number"
                    value={chargeAmount}
                  />
                  <p className="text-gray-500 text-xs">최소 100원 이상</p>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium text-sm">주문명</Label>
                  <Input
                    onChange={(e) => setChargeOrderName(e.target.value)}
                    placeholder="테스트 결제"
                    value={chargeOrderName}
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={chargeBillingMutation.isPending || !chargeBillingKey.trim()}
                  onClick={handleChargeBilling}
                >
                  {chargeBillingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      결제 처리 중...
                    </>
                  ) : (
                    <>
                      <DollarSign className="mr-2 h-4 w-4" />
                      결제하기
                    </>
                  )}
                </Button>

                {chargeResult && (
                  <div className="rounded-lg bg-gray-100 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      {chargeResult.success ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-600">결제 성공</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="font-medium text-red-600">결제 실패</span>
                        </>
                      )}
                    </div>
                    <pre className="overflow-auto text-xs">
                      {JSON.stringify(chargeResult, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent className="space-y-6" value="manage">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>빌링키 관리</AlertTitle>
              <AlertDescription>
                <div>빌링키를 비활성화하면 정기결제가 중단됩니다.</div>
                <div className="mt-1 text-gray-500 text-xs">
                  재활성화하면 정기결제가 다시 진행됩니다.
                </div>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">빌링키 비활성화 / 재활성화</CardTitle>
                <CardDescription>빌링키의 활성 상태를 관리합니다 (Soft Delete)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-medium text-sm">빌링키</Label>
                  <Input
                    onChange={(e) => setManageBillingKey(e.target.value)}
                    placeholder="billingKey를 입력하세요"
                    value={manageBillingKey}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    disabled={deactivateBillingMutation.isPending || !manageBillingKey.trim()}
                    onClick={handleDeactivateBilling}
                    variant="destructive"
                  >
                    {deactivateBillingMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        처리 중...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        비활성화
                      </>
                    )}
                  </Button>

                  <Button
                    disabled={reactivateBillingMutation.isPending || !manageBillingKey.trim()}
                    onClick={handleReactivateBilling}
                    variant="default"
                  >
                    {reactivateBillingMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        처리 중...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        재활성화
                      </>
                    )}
                  </Button>
                </div>

                {manageResult && (
                  <div className="rounded-lg bg-gray-100 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      {manageResult.success ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-600">처리 완료</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="font-medium text-red-600">처리 실패</span>
                        </>
                      )}
                    </div>
                    <pre className="overflow-auto text-xs">
                      {JSON.stringify(manageResult, null, 2)}
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
