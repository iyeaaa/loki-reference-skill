import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import type {
  BillingPlan,
  BillingProduct,
  CreateBillingPlanRequest,
  PlanInterval,
  PlanType,
} from "@/lib/api/types/billing"
import { PLAN_INTERVAL_LABELS, PLAN_TYPE_LABELS } from "@/lib/api/types/billing"

type PlanFormProps = {
  plan?: BillingPlan
  products: BillingProduct[]
  defaultProductId?: string
  onSave: (data: CreateBillingPlanRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function PlanForm({
  plan,
  products,
  defaultProductId,
  onSave,
  onCancel,
  isLoading,
}: PlanFormProps) {
  const formId = useId()
  const [productId, setProductId] = useState(plan?.productId || defaultProductId || "")
  const [name, setName] = useState(plan?.name || "")
  const [description, setDescription] = useState(plan?.description || "")
  const [amount, setAmount] = useState(plan?.amount || 0)
  const [currency, setCurrency] = useState(plan?.currency || "KRW")
  const [planType, setPlanType] = useState<PlanType>(plan?.planType || "recurring")
  const [billingInterval, setBillingInterval] = useState<PlanInterval>(
    plan?.billingInterval || "month",
  )
  const [intervalCount, setIntervalCount] = useState(plan?.intervalCount || 1)
  const [trialDays, setTrialDays] = useState(plan?.trialDays || 0)
  const [isActive, setIsActive] = useState(plan?.isActive ?? true)
  const [isDefault, setIsDefault] = useState(plan?.isDefault ?? false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!productId) {
      alert("상품을 선택해주세요.")
      return
    }

    await onSave({
      productId,
      name,
      description: description || undefined,
      amount,
      currency,
      planType,
      billingInterval: planType === "recurring" ? billingInterval : undefined,
      intervalCount: planType === "recurring" ? intervalCount : undefined,
      trialDays,
      isActive,
      isDefault,
    })
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat("ko-KR").format(value)

  return (
    <form className="space-y-6 py-4" onSubmit={handleSubmit}>
      {/* Product Selection */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-product`}>상품 *</Label>
        <Select disabled={!!plan} onValueChange={setProductId} value={productId}>
          <SelectTrigger>
            <SelectValue placeholder="상품 선택" />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {plan && <p className="text-gray-500 text-xs">요금제 수정 시 상품은 변경할 수 없습니다.</p>}
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>요금제명 *</Label>
        <Input
          id={`${formId}-name`}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: Monthly Pro, Annual Basic"
          required
          value={name}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-description`}>설명</Label>
        <Textarea
          id={`${formId}-description`}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="요금제에 대한 설명을 입력하세요..."
          rows={2}
          value={description}
        />
      </div>

      {/* Plan Type */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-planType`}>결제 유형 *</Label>
        <Select onValueChange={(v) => setPlanType(v as PlanType)} value={planType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Billing Interval (only for recurring) */}
      {planType === "recurring" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-interval`}>결제 주기</Label>
            <Select
              onValueChange={(v) => setBillingInterval(v as PlanInterval)}
              value={billingInterval}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLAN_INTERVAL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-intervalCount`}>주기 횟수</Label>
            <Input
              id={`${formId}-intervalCount`}
              max={12}
              min={1}
              onChange={(e) => setIntervalCount(Number.parseInt(e.target.value, 10) || 1)}
              type="number"
              value={intervalCount}
            />
            <p className="text-gray-500 text-xs">예: 3개월마다 = 주기(월) + 횟수(3)</p>
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-amount`}>금액 *</Label>
          <Input
            id={`${formId}-amount`}
            min={0}
            onChange={(e) => setAmount(Number.parseInt(e.target.value, 10) || 0)}
            type="number"
            value={amount}
          />
          <p className="text-gray-500 text-xs">
            {formatCurrency(amount)} {currency}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-currency`}>통화</Label>
          <Select onValueChange={setCurrency} value={currency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="KRW">KRW (원)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="JPY">JPY (¥)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Trial Days */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-trialDays`}>체험 기간 (일)</Label>
        <Input
          className="w-32"
          id={`${formId}-trialDays`}
          max={90}
          min={0}
          onChange={(e) => setTrialDays(Number.parseInt(e.target.value, 10) || 0)}
          type="number"
          value={trialDays}
        />
        <p className="text-gray-500 text-xs">0이면 체험 기간 없음</p>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={isActive}
            id={`${formId}-isActive`}
            onCheckedChange={(checked) => setIsActive(checked as boolean)}
          />
          <Label className="cursor-pointer" htmlFor={`${formId}-isActive`}>
            활성 상태 (비활성 시 신규 구독 불가)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={isDefault}
            id={`${formId}-isDefault`}
            onCheckedChange={(checked) => setIsDefault(checked as boolean)}
          />
          <Label className="cursor-pointer" htmlFor={`${formId}-isDefault`}>
            기본 요금제 (신규 가입 시 기본 선택)
          </Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button disabled={isLoading} onClick={onCancel} type="button" variant="outline">
          취소
        </Button>
        <Button disabled={isLoading || !name.trim() || !productId} type="submit">
          {isLoading ? "저장 중..." : plan ? "수정" : "생성"}
        </Button>
      </div>
    </form>
  )
}
