import { Edit, Info, Shield } from "lucide-react"
import { useId, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type Column, DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useIamPolicies, useIamTierBoundaries, useUpdateTierBoundary } from "@/lib/api/hooks/iam"
import type { IamTierBoundary, SubscriptionTier } from "@/lib/api/types/iam"
import { formatRelativeTime } from "@/lib/date-utils"

const TIER_INFO: Record<
  SubscriptionTier,
  {
    label: string
    description: string
    color: string
    badgeVariant: "default" | "secondary" | "outline" | "destructive"
  }
> = {
  trial: {
    label: "Trial",
    description: "체험판 - 제한된 기능 (20 리드, 성과지표 제한)",
    color: "text-gray-600",
    badgeVariant: "secondary",
  },
  basic: {
    label: "Basic",
    description: "기본 요금제 - 핵심 기능 사용 가능",
    color: "text-blue-600",
    badgeVariant: "outline",
  },
  pro: {
    label: "Pro",
    description: "프로 요금제 - 대부분의 기능 사용 가능",
    color: "text-purple-600",
    badgeVariant: "default",
  },
  enterprise: {
    label: "Enterprise",
    description: "엔터프라이즈 - 모든 기능 + Linda GPT",
    color: "text-amber-600",
    badgeVariant: "default",
  },
}

const TIER_ORDER: SubscriptionTier[] = ["trial", "basic", "pro", "enterprise"]

export default function TierBoundariesPage() {
  const formId = useId()
  const [editingTier, setEditingTier] = useState<IamTierBoundary | null>(null)
  const [selectedPolicyId, setSelectedPolicyId] = useState("")

  const { data: tierBoundaries, isLoading } = useIamTierBoundaries()
  const { data: policiesData } = useIamPolicies({ limit: 100, isActive: true })
  const updateTierBoundary = useUpdateTierBoundary()

  const policies = policiesData?.data || []

  // Sort tier boundaries by tier order
  const sortedBoundaries = tierBoundaries
    ? [...tierBoundaries].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
    : []

  const handleEdit = (boundary: IamTierBoundary) => {
    setEditingTier(boundary)
    setSelectedPolicyId(boundary.policyId)
  }

  const handleSave = async () => {
    if (!editingTier || !selectedPolicyId) return
    await updateTierBoundary.mutateAsync({
      tier: editingTier.tier,
      policyId: selectedPolicyId,
    })
    setEditingTier(null)
    setSelectedPolicyId("")
  }

  // Table columns
  const columns: Column<IamTierBoundary>[] = [
    {
      key: "tier",
      header: "등급",
      width: "100px",
      render: (item) => {
        const tierInfo = TIER_INFO[item.tier]
        return (
          <div className="flex items-center gap-2">
            <Shield className={`h-4 w-4 ${tierInfo.color}`} />
            <Badge variant={tierInfo.badgeVariant} className="text-xs">
              {tierInfo.label}
            </Badge>
          </div>
        )
      },
    },
    {
      key: "description",
      header: "설명",
      minWidth: "200px",
      render: (item) => {
        const tierInfo = TIER_INFO[item.tier]
        return (
          <span
            className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
            title={tierInfo.description}
          >
            {tierInfo.description}
          </span>
        )
      },
    },
    {
      key: "policyName",
      header: "정책명",
      minWidth: "140px",
      render: (item) => (
        <div className="max-w-[140px]">
          <div
            className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate"
            title={item.policy?.name}
          >
            {item.policy?.name || "정책 없음"}
          </div>
        </div>
      ),
    },
    {
      key: "policyDesc",
      header: "정책 설명",
      minWidth: "250px",
      render: (item) => (
        <div>
          {item.policy?.description ? (
            <span className="text-xs text-gray-500 line-clamp-3" title={item.policy.description}>
              {item.policy.description}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: "isManaged",
      header: "타입",
      width: "70px",
      render: (item) =>
        item.policy?.isManaged ? (
          <Badge variant="secondary" className="text-xs">
            시스템
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            사용자
          </Badge>
        ),
    },
    {
      key: "updatedAt",
      header: "수정일",
      width: "80px",
      render: (item) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatRelativeTime(item.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "액션",
      width: "70px",
      sticky: "right",
      render: (item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEdit(item)}
          className="text-xs h-7 px-2"
        >
          <Edit className="h-3 w-3 mr-1" />
          수정
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Header Info */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                Tier Boundary란?
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300 mt-1">
                구독 등급별 최대 권한 경계입니다. 사용자가 어떤 역할을 가지더라도 해당 등급의
                Boundary를 초과하는 권한은 부여되지 않습니다. AWS IAM의 Permission Boundary와 동일한
                개념입니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tier Boundaries Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">등급 권한 경계 관리</CardTitle>
            <Badge variant="outline" className="text-xs">
              {sortedBoundaries.length}개 등급
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={sortedBoundaries}
            columns={columns}
            isLoading={isLoading}
            getItemId={(item) => item.id}
            emptyMessage="아직 등급 경계가 없어요. 시드 데이터를 실행해 주세요."
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTier} onOpenChange={() => setEditingTier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Shield
                className={`h-5 w-5 ${editingTier ? TIER_INFO[editingTier.tier].color : ""}`}
              />
              Tier Boundary 수정
              {editingTier && (
                <Badge variant={TIER_INFO[editingTier.tier].badgeVariant}>
                  {TIER_INFO[editingTier.tier].label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {editingTier && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                {TIER_INFO[editingTier.tier].description}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`${formId}-policy`}>권한 경계 정책</Label>
              <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                <SelectTrigger>
                  <SelectValue placeholder="정책 선택" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      <div className="flex items-center gap-2">
                        <span>{policy.name}</span>
                        {policy.isManaged && (
                          <Badge variant="secondary" className="text-xs">
                            시스템
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                이 등급의 사용자가 가질 수 있는 최대 권한을 정의하는 정책을 선택하세요.
              </p>
            </div>

            {/* 선택된 정책 설명 표시 */}
            {selectedPolicyId && (
              <div className="space-y-2">
                <Label>선택된 정책 설명</Label>
                <Textarea
                  value={
                    policies.find((p) => p.id === selectedPolicyId)?.description || "설명 없음"
                  }
                  readOnly
                  className="text-xs text-gray-500 resize-none min-h-[72px] bg-gray-50 dark:bg-gray-800"
                  rows={3}
                  style={{
                    height: "auto",
                    overflow: "hidden",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = "auto"
                    target.style.height = `${Math.max(72, target.scrollHeight)}px`
                  }}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTier(null)
                  setSelectedPolicyId("")
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleSave}
                disabled={!selectedPolicyId || updateTierBoundary.isPending}
              >
                {updateTierBoundary.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
