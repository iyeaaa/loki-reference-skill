import { Plus, X } from "lucide-react"
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
  BillingProduct,
  CreateBillingProductRequest,
  SubscriptionTier,
} from "@/lib/api/types/billing"
import { SUBSCRIPTION_TIER_LABELS } from "@/lib/api/types/billing"

interface ProductFormProps {
  product?: BillingProduct
  onSave: (data: CreateBillingProductRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function ProductForm({ product, onSave, onCancel, isLoading }: ProductFormProps) {
  const formId = useId()
  const [name, setName] = useState(product?.name || "")
  const [description, setDescription] = useState(product?.description || "")
  const [tier, setTier] = useState<SubscriptionTier>(product?.tier || "basic")
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [displayOrder, setDisplayOrder] = useState(product?.displayOrder || 0)
  const [features, setFeatures] = useState<string[]>(product?.features || [])
  const [newFeature, setNewFeature] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name,
      description: description || undefined,
      tier,
      isActive,
      displayOrder,
      features,
    })
  }

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()])
      setNewFeature("")
    }
  }

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>상품명 *</Label>
        <Input
          id={`${formId}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: Pro Plan"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-description`}>설명</Label>
        <Textarea
          id={`${formId}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="상품에 대한 설명을 입력하세요..."
          rows={3}
        />
      </div>

      {/* Tier */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-tier`}>구독 등급 *</Label>
        <Select value={tier} onValueChange={(value) => setTier(value as SubscriptionTier)}>
          <SelectTrigger>
            <SelectValue placeholder="등급 선택" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SUBSCRIPTION_TIER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Display Order */}
      <div className="space-y-2">
        <Label htmlFor={`${formId}-displayOrder`}>표시 순서</Label>
        <Input
          id={`${formId}-displayOrder`}
          type="number"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
          min={0}
        />
        <p className="text-xs text-gray-500">낮은 숫자가 먼저 표시됩니다.</p>
      </div>

      {/* Features */}
      <div className="space-y-2">
        <Label>기능 목록</Label>
        <div className="flex gap-2">
          <Input
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            placeholder="기능 추가..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addFeature()
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addFeature}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {features.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {features.map((feature, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm"
              >
                {feature}
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Is Active */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`${formId}-isActive`}
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked as boolean)}
        />
        <Label htmlFor={`${formId}-isActive`} className="cursor-pointer">
          활성 상태 (비활성 시 신규 구매 불가)
        </Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          취소
        </Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>
          {isLoading ? "저장 중..." : product ? "수정" : "생성"}
        </Button>
      </div>
    </form>
  )
}
