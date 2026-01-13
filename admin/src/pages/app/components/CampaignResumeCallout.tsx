import { Building2, Check, Loader2, Mail, Rocket, Users } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  useActivateStepBasedSequence,
  useSequence,
  useSequenceSteps,
} from "@/lib/api/hooks/sequences"

type CampaignResumeCalloutProps = {
  sequenceId: string
  onComplete: () => void
  onDismiss?: () => void
}

export function CampaignResumeCallout({
  sequenceId,
  onComplete,
  onDismiss,
}: CampaignResumeCalloutProps) {
  const { i18n } = useTranslation()
  const isKorean = i18n.language === "ko"

  // Fetch sequence and steps data
  const { data: sequence, isLoading: sequenceLoading } = useSequence(sequenceId, !!sequenceId)
  const { data: steps } = useSequenceSteps(sequenceId, !!sequenceId)

  // Activate mutation
  const activateMutation = useActivateStepBasedSequence()

  // Parse selectedLeadIds from JSON string (used before enrollment)
  const selectedLeadIds = useMemo(() => {
    if (!sequence?.selectedLeadIds) {
      return []
    }
    try {
      return JSON.parse(sequence.selectedLeadIds) as string[]
    } catch {
      return []
    }
  }, [sequence?.selectedLeadIds])

  // Calculate stats - use selectedLeadIds if not yet enrolled, otherwise use enrollmentsCount
  const stepsCount = steps?.length || 0
  const leadsCount = selectedLeadIds.length || sequence?.enrollmentsCount || 0
  const totalEmails = stepsCount * leadsCount

  const handleStartCampaign = async () => {
    try {
      await activateMutation.mutateAsync(sequenceId)

      toast.success(
        isKorean
          ? "첫 해외 영업이 시작되었습니다! 바이어 반응을 기다려주세요."
          : "Your first outreach campaign has started! Wait for buyer responses.",
      )

      onComplete()
    } catch (error) {
      console.error("Failed to activate campaign:", error)
      toast.error(
        isKorean
          ? "캠페인 시작에 실패했습니다. 다시 시도해주세요."
          : "Failed to launch campaign. Please try again.",
      )
    }
  }

  if (sequenceLoading) {
    return null
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
          <Rocket className="h-7 w-7 text-white" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Header - 고객친화적 카피라이팅 */}
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {isKorean ? "첫 해외 영업, 지금 시작해보세요!" : "Start Your First Global Outreach!"}
            </h3>
            <p className="mt-1.5 text-gray-600 text-sm leading-relaxed">
              {isKorean
                ? "RINDA가 귀사에 맞는 해외 바이어를 찾아 맞춤 영업 메일을 보내드려요. 영어 작성 걱정 없이 AI가 모든 것을 대신해드립니다."
                : "RINDA finds overseas buyers perfect for your business and sends personalized outreach emails. AI handles everything - no need to worry about writing in English."}
            </p>
          </div>

          {/* Stats Grid - 초보 친화적 레이블 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                <p className="text-gray-500 text-xs">
                  {isKorean ? "연락할 바이어" : "Target Buyers"}
                </p>
              </div>
              <p className="mt-1.5 font-bold text-gray-900 text-lg">
                {leadsCount}
                <span className="ml-1 font-normal text-gray-500 text-sm">
                  {isKorean ? "개 기업" : "companies"}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-500" />
                <p className="text-gray-500 text-xs">
                  {isKorean ? "자동 팔로우업" : "Auto Follow-ups"}
                </p>
              </div>
              <p className="mt-1.5 font-bold text-gray-900 text-lg">
                {stepsCount}
                <span className="ml-1 font-normal text-gray-500 text-sm">
                  {isKorean ? "회" : "times"}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <p className="text-gray-500 text-xs">{isKorean ? "예상 도달" : "Expected Reach"}</p>
              </div>
              <p className="mt-1.5 font-bold text-blue-600 text-lg">
                {totalEmails}
                <span className="ml-1 font-normal text-gray-500 text-sm">
                  {isKorean ? "건" : "emails"}
                </span>
              </p>
            </div>
          </div>

          {/* Info - 안심 메시지 2줄 */}
          <div className="space-y-1.5 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
              <p className="text-green-800 text-sm">
                {isKorean
                  ? "바이어가 답장하면 자동으로 발송이 멈춰요. 스팸 걱정은 NO!"
                  : "Sending stops automatically when buyers reply. No spam worries!"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
              <p className="text-green-800 text-sm">
                {isKorean
                  ? "관심 보이는 바이어는 메일함에서 바로 확인할 수 있어요."
                  : "Check interested buyers instantly in your inbox."}
              </p>
            </div>
          </div>

          {/* Actions - 고객친화적 버튼 텍스트 */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 font-semibold text-white shadow-md hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg"
              disabled={activateMutation.isPending}
              onClick={handleStartCampaign}
              size="default"
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isKorean ? "시작 중..." : "Starting..."}
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  {isKorean ? "첫 해외 영업 시작하기" : "Start First Outreach"}
                </>
              )}
            </Button>

            {onDismiss && (
              <Button
                className="text-gray-500 hover:text-gray-700"
                disabled={activateMutation.isPending}
                onClick={onDismiss}
                size="default"
                variant="ghost"
              >
                {isKorean ? "나중에 할게요" : "Maybe Later"}
              </Button>
            )}
          </div>

          {/* Trust Badge - 신뢰도 향상 */}
          <div className="flex items-center gap-2 pt-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <p className="text-gray-500 text-xs">
              {isKorean
                ? "200+ 기업이 RINDA로 해외 영업 중"
                : "200+ companies expanding globally with RINDA"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
