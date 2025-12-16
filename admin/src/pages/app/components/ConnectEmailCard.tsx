import { CheckCircle2, Loader2, Mail } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getNylasAuthUrl } from "@/lib/api/services/nylas"

interface ConnectEmailCardProps {
  userEmail: string
}

export function ConnectEmailCard({ userEmail }: ConnectEmailCardProps) {
  const { t, i18n } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isKorean = i18n.language === "ko"

  const handleConnect = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get OAuth URL from backend
      const response = await getNylasAuthUrl()

      // Redirect to Google OAuth
      window.location.href = response.url
    } catch (err) {
      console.error("Failed to get auth URL:", err)
      setError(
        t("app.onboarding.step1.error", "인증 URL을 가져오는데 실패했습니다. 다시 시도해주세요."),
      )
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-12 pb-10 px-8">
        <div className="flex flex-col items-center text-center">
          {/* Email Icon */}
          <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-8">
            <Mail className="w-10 h-10 text-blue-500" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {t("app.onboarding.step4.connectTitle", "이메일 연동")}
          </h2>

          {/* Description */}
          <p className="text-gray-500 mb-4 max-w-sm">
            {t(
              "app.onboarding.step4.connectDescription",
              "이메일을 발송하기 위해 계정을 연동해주세요",
            )}
          </p>

          {/* Current user email info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 w-full max-w-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900">{userEmail}</p>
                <p className="text-sm text-gray-500">
                  {isKorean ? "현재 로그인된 계정" : "Currently logged in account"}
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation message */}
          <p className="text-lg font-medium text-gray-900 mb-6">
            {t("app.onboarding.step4.confirmConnect", "연동하시겠습니까?")}
          </p>

          {/* Error Message */}
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {/* Action Button */}
          <div className="w-full max-w-sm">
            <Button
              size="lg"
              onClick={handleConnect}
              disabled={isLoading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" />
              )}
              {isLoading
                ? t("app.onboarding.step1.loading", "연동 중...")
                : t("app.onboarding.step4.connectButton", "연동하기")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
