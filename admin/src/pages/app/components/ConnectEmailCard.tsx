import { CheckCircle2, Loader2, Mail } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getNylasAuthUrl } from "@/lib/api/services/nylas"

type ConnectEmailCardProps = {
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
    <Card className="mx-auto max-w-2xl">
      <CardContent className="px-8 pt-12 pb-10">
        <div className="flex flex-col items-center text-center">
          {/* Email Icon */}
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50">
            <Mail className="h-10 w-10 text-blue-500" />
          </div>

          {/* Title */}
          <h2 className="mb-3 font-bold text-2xl text-gray-900">
            {t("app.onboarding.step4.connectTitle", "이메일 연동")}
          </h2>

          {/* Description */}
          <p className="mb-4 max-w-sm text-gray-500">
            {t(
              "app.onboarding.step4.connectDescription",
              "이메일을 발송하기 위해 계정을 연동해주세요",
            )}
          </p>

          {/* Current user email info */}
          <div className="mb-6 w-full max-w-sm rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900">{userEmail}</p>
                <p className="text-gray-500 text-sm">
                  {isKorean ? "현재 로그인된 계정" : "Currently logged in account"}
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation message */}
          <p className="mb-6 font-medium text-gray-900 text-lg">
            {t("app.onboarding.step4.confirmConnect", "연동하시겠습니까?")}
          </p>

          {/* Error Message */}
          {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}

          {/* Action Button */}
          <div className="w-full max-w-sm">
            <Button
              className="h-12 w-full bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
              onClick={handleConnect}
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-5 w-5" />
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
