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
    if (!(editingTier && selectedPolicyId)) {
      return
    }
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
            <Badge className="text-xs" variant={tierInfo.badgeVariant}>
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
            className="line-clamp-2 text-gray-600 text-sm dark:text-gray-400"
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
            className="truncate font-medium text-gray-900 text-sm dark:text-gray-100"
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
            <span className="line-clamp-3 text-gray-500 text-xs" title={item.policy.description}>
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
          <Badge className="text-xs" variant="secondary">
            시스템
          </Badge>
        ) : (
          <Badge className="text-xs" variant="outline">
            사용자
          </Badge>
        ),
    },
    {
      key: "updatedAt",
      header: "수정일",
      width: "80px",
      render: (item) => (
        <span className="whitespace-nowrap text-gray-500 text-xs">
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
          className="h-7 px-2 text-xs"
          onClick={() => handleEdit(item)}
          size="sm"
          variant="outline"
        >
          <Edit className="mr-1 h-3 w-3" />
          수정
        </Button>
      ),
    },
  ]

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Header Info */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                Tier Boundary란?
              </CardTitle>
              <CardDescription className="mt-1 text-blue-700 dark:text-blue-300">
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
            <Badge className="text-xs" variant="outline">
              {sortedBoundaries.length}개 등급
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={sortedBoundaries}
            emptyMessage="아직 등급 경계가 없어요. 시드 데이터를 실행해 주세요."
            getItemId={(item) => item.id}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog onOpenChange={() => setEditingTier(null)} open={!!editingTier}>
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2 font-semibold text-lg">
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
          <div className="space-y-4 py-4">
            {editingTier && (
              <div className="rounded-lg bg-gray-50 p-3 text-gray-600 text-sm dark:bg-gray-800 dark:text-gray-400">
                {TIER_INFO[editingTier.tier].description}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`${formId}-policy`}>권한 경계 정책</Label>
              <Select onValueChange={setSelectedPolicyId} value={selectedPolicyId}>
                <SelectTrigger>
                  <SelectValue placeholder="정책 선택" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      <div className="flex items-center gap-2">
                        <span>{policy.name}</span>
                        {policy.isManaged && (
                          <Badge className="text-xs" variant="secondary">
                            시스템
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-gray-500 text-xs">
                이 등급의 사용자가 가질 수 있는 최대 권한을 정의하는 정책을 선택하세요.
              </p>
            </div>

            {/* 선택된 정책 설명 표시 */}
            {selectedPolicyId && (
              <div className="space-y-2">
                <Label>선택된 정책 설명</Label>
                <Textarea
                  className="min-h-[72px] resize-none bg-gray-50 text-gray-500 text-xs dark:bg-gray-800"
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = "auto"
                    target.style.height = `${Math.max(72, target.scrollHeight)}px`
                  }}
                  readOnly
                  rows={3}
                  style={{
                    height: "auto",
                    overflow: "hidden",
                  }}
                  value={
                    policies.find((p) => p.id === selectedPolicyId)?.description || "설명 없음"
                  }
                />
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button
                onClick={() => {
                  setEditingTier(null)
                  setSelectedPolicyId("")
                }}
                variant="outline"
              >
                취소
              </Button>
              <Button
                disabled={!selectedPolicyId || updateTierBoundary.isPending}
                onClick={handleSave}
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
