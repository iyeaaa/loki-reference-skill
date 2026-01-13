import { Calendar, Check, Mail, Sparkles, ThumbsUp, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

const INBOX_ONBOARDING_KEY = "inbox_onboarding_shown"

type InboxOnboardingGuideProps = {
  onDismiss?: () => void
}

export function InboxOnboardingGuide({ onDismiss }: InboxOnboardingGuideProps) {
  const { i18n } = useTranslation()
  const isKorean = i18n.language === "ko"
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if onboarding has been shown before
    const hasShown = localStorage.getItem(INBOX_ONBOARDING_KEY)
    if (!hasShown) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(INBOX_ONBOARDING_KEY, "true")
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          onClick={handleDismiss}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Mail className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center font-bold text-gray-900 text-xl">
          {isKorean
            ? "바이어 답장, 여기서 한눈에 확인하세요"
            : "Check All Buyer Replies Here at a Glance"}
        </h2>

        {/* Description */}
        <p className="mb-6 text-center text-gray-600 text-sm leading-relaxed">
          {isKorean
            ? "RINDA가 보낸 영업 메일에 바이어가 답장하면 이곳에서 바로 확인하고 대응할 수 있어요."
            : "When buyers reply to your outreach emails sent by RINDA, you can check and respond right here."}
        </p>

        {/* Feature list */}
        <div className="mb-6 space-y-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
          <p className="mb-3 font-medium text-gray-700 text-sm">
            {isKorean ? "AI가 자동으로 분류해드려요:" : "AI automatically categorizes for you:"}
          </p>

          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500">
              <ThumbsUp className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="font-medium text-gray-800 text-sm">
                {isKorean ? "긍정적 반응" : "Positive Responses"}
              </p>
              <p className="text-gray-500 text-xs">
                {isKorean ? "관심 있는 바이어를 놓치지 마세요" : "Don't miss interested buyers"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500">
              <Calendar className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="font-medium text-gray-800 text-sm">
                {isKorean ? "미팅 요청" : "Meeting Requests"}
              </p>
              <p className="text-gray-500 text-xs">
                {isKorean ? "즉시 대응이 필요한 바이어예요" : "Buyers who need immediate attention"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-400">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="font-medium text-gray-800 text-sm">
                {isKorean ? "자동 응답" : "Auto Replies"}
              </p>
              <p className="text-gray-500 text-xs">
                {isKorean
                  ? "부재중 메시지는 따로 모아둬요"
                  : "Out-of-office messages are organized separately"}
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 font-semibold text-white hover:from-blue-600 hover:to-indigo-700"
          onClick={handleDismiss}
          size="lg"
        >
          <Check className="mr-2 h-4 w-4" />
          {isKorean ? "알겠어요" : "Got it"}
        </Button>

        {/* Tip */}
        <p className="mt-4 text-center text-gray-400 text-xs">
          {isKorean
            ? "캠페인 시작 후 보통 3~5일 내에 첫 답장이 도착해요"
            : "First replies usually arrive within 3-5 days after starting your campaign"}
        </p>
      </div>
    </div>
  )
}
