import { ArrowLeft, Check, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type ExecuteSectionProps = {
  selectedCount: number
  stepsCount: number
  totalEmails: number
  emailAccount: { emailAddress: string } | null | undefined
  isExecuting: boolean
  onExecute: () => void
  onBack: () => void
  onSkip: () => void
  isKorean: boolean
}

export function ExecuteSection({
  selectedCount,
  stepsCount,
  totalEmails,
  emailAccount,
  isExecuting,
  onExecute,
  onBack,
  onSkip,
  isKorean,
}: ExecuteSectionProps) {
  return (
    <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
      <CardContent className="p-4">
        {/* Summary stats */}
        <div className="mb-2.5 flex items-center justify-center gap-1.5 text-gray-600 text-xl">
          <span className="font-semibold text-gray-900">{selectedCount}</span>
          <span>{isKorean ? "명" : "buyers"}</span>
          <span className="text-gray-400">×</span>
          <span className="font-semibold text-gray-900">{stepsCount}</span>
          <span>{isKorean ? "단계" : "steps"}</span>
          <span className="text-gray-400">=</span>
          <span className="font-bold text-blue-600">{totalEmails}</span>
          <span>{isKorean ? "통" : "emails"}</span>
        </div>

        {/* Checklist */}
        <div className="mb-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-gray-600 text-xs">
            <Check className="h-3 w-3 text-green-500" />
            <span>
              {isKorean ? `${selectedCount}명의 바이어 선택됨` : `${selectedCount} buyers selected`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 text-xs">
            <Check className="h-3 w-3 text-green-500" />
            <span>
              {isKorean
                ? `${stepsCount}단계 영업 메일 준비됨`
                : `${stepsCount}-step sales emails ready`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 text-xs">
            {emailAccount ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="truncate">
                  {isKorean ? "발송: " : "From: "}
                  {emailAccount.emailAddress}
                </span>
              </>
            ) : (
              <>
                <X className="h-3 w-3 text-red-500" />
                <span>{isKorean ? "이메일 계정 필요" : "Email account required"}</span>
              </>
            )}
          </div>
        </div>

        {/* Auto-stop info */}
        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-2 text-gray-600 text-xs leading-tight">
          <p className="mb-0.5">
            {isKorean ? "• 바이어가 답장하면 자동으로 중지" : "• Auto-stops when buyer replies"}
          </p>
          <p>
            {isKorean ? "• 10회 이상 오픈 시 세일즈팀 상담" : "• Sales consultation at 10+ opens"}
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <Button
            className="h-14 w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 font-semibold text-white shadow-blue-500/30 shadow-lg transition-all hover:from-blue-600 hover:to-indigo-700 hover:shadow-blue-500/40"
            disabled={isExecuting || !emailAccount || selectedCount === 0}
            onClick={onExecute}
          >
            <Send className="mr-2 h-4 w-4" />
            {isKorean
              ? `${selectedCount}개 바이어에게 영업 시작하기`
              : `Start contacting ${selectedCount} buyers`}
          </Button>

          <div className="flex gap-2">
            <Button
              className="h-14 flex-1 rounded-lg text-sm"
              onClick={onBack}
              size="sm"
              variant="outline"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              {isKorean ? "이전" : "Back"}
            </Button>
            <button
              className="flex-1 py-2 text-center text-gray-400 text-sm transition-colors hover:text-gray-600"
              onClick={onSkip}
              type="button"
            >
              {isKorean ? "나중에" : "Later"}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
