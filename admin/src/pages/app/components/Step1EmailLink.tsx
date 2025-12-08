import { Loader2, Mail } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getNylasAuthUrl } from "@/lib/api/services/nylas"

export function Step1EmailLink() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleClick = async () => {
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
            {t("app.onboarding.step1.title", "이메일 계정을 연동해주세요")}
          </h2>

          {/* Description */}
          <p className="text-gray-500 mb-8 max-w-sm">
            {t(
              "app.onboarding.step1.description",
              "RINDA가 바이어에게 이메일을 보내고 답장을 관리할 수 있어요",
            )}
          </p>

          {/* Error Message */}
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {/* Google Button */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleGoogleClick}
            disabled={isLoading}
            className="w-full max-w-xs h-12 text-base font-medium border-gray-300 hover:bg-gray-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            ) : (
              <GoogleIcon className="w-5 h-5 mr-3" />
            )}
            {isLoading
              ? t("app.onboarding.step1.loading", "연동 중...")
              : t("app.onboarding.step1.googleButton", "Google 계정으로 연동하기")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Google Icon SVG Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label="Google logo">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
