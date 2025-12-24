import { AlertCircle, Loader2, Rocket, X } from "lucide-react"
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
  onDismiss: () => void
}

const DISMISS_KEY = "campaign_resume_dismissed"

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

  // Calculate stats
  const stepsCount = steps?.length || 0
  const leadsCount = sequence?.enrollmentCount || 0
  const totalEmails = stepsCount * leadsCount

  const handleStartCampaign = async () => {
    try {
      await activateMutation.mutateAsync(sequenceId)

      toast.success(isKorean ? "캠페인이 시작되었습니다!" : "Campaign launched successfully!")

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

  const handleDontShowAgain = () => {
    localStorage.setItem(DISMISS_KEY, "true")
    onDismiss()
  }

  if (sequenceLoading) {
    return null
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
          <Rocket className="h-6 w-6 text-white" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Header */}
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">
              {isKorean ? "아직 실행되지 않은 캠페인이 있습니다" : "Campaign Ready to Launch"}
            </h3>
            <p className="mt-1 text-gray-600 text-sm">
              {isKorean
                ? "온보딩에서 준비한 캠페인을 시작하시겠습니까?"
                : "Would you like to start the campaign you prepared during onboarding?"}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-blue-100 bg-white p-3">
              <p className="text-gray-600 text-xs">{isKorean ? "발송 대상" : "Recipients"}</p>
              <p className="mt-1 font-semibold text-gray-900">
                {leadsCount} {isKorean ? "명" : "leads"}
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-white p-3">
              <p className="text-gray-600 text-xs">{isKorean ? "이메일 스텝" : "Email steps"}</p>
              <p className="mt-1 font-semibold text-gray-900">
                {stepsCount} {isKorean ? "개" : "steps"}
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-white p-3">
              <p className="text-gray-600 text-xs">
                {isKorean ? "총 예정 이메일" : "Total emails"}
              </p>
              <p className="mt-1 font-bold text-blue-600">{totalEmails}</p>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 rounded-md bg-blue-100/50 px-3 py-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-blue-900 text-xs">
              {isKorean
                ? "바이어가 답장하면 해당 리드의 이메일 시퀀스가 자동으로 중지됩니다."
                : "Email sequence stops automatically when a buyer replies."}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-gradient-to-r from-blue-500 to-indigo-600 font-semibold text-white hover:from-blue-600 hover:to-indigo-700"
              disabled={activateMutation.isPending}
              onClick={handleStartCampaign}
              size="sm"
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isKorean ? "시작 중..." : "Starting..."}
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  {isKorean ? "지금 시작하기" : "Launch Now"}
                </>
              )}
            </Button>

            <Button
              disabled={activateMutation.isPending}
              onClick={onDismiss}
              size="sm"
              variant="outline"
            >
              {isKorean ? "나중에" : "Later"}
            </Button>

            <Button
              className="text-gray-500"
              disabled={activateMutation.isPending}
              onClick={handleDontShowAgain}
              size="sm"
              variant="ghost"
            >
              <X className="mr-1 h-3 w-3" />
              {isKorean ? "다시 보지 않기" : "Don't show again"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
