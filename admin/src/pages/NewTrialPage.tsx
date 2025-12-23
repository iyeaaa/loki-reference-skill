import { motion } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { DashboardPreview } from "@/components/trial/DashboardPreview"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { shouldReduceMotion, staggerContainerVariants, staggerItemVariants } from "@/lib/animations"
import { apiFetch } from "@/lib/api/client"
import { authApi } from "@/lib/api/services/auth"
import { useAuth } from "@/lib/auth-provider"
import { clearSurveyStorage, getSurveyFromStorage, isValidSurveyData } from "@/store/survey"

type GoogleAuthResponse = {
  token: string
  user: {
    id: string
    username: string
    email: string
    userRole: string
    isActive: boolean
    authProvider: string
    profilePicture?: string
    trialStatus?: {
      isTrialActive: boolean
      daysRemaining: number
      trialEndDate: string
    }
  }
}

export default function NewTrialPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const { t } = useTranslation("translation")
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingCallback, setIsProcessingCallback] = useState(false)

  // Ref to prevent duplicate OAuth processing
  const processedCodeRef = useRef<string | null>(null)

  /**
   * OAuth/Email 로그인 성공 후 처리
   */
  const handleLoginSuccess = useCallback(
    (response: GoogleAuthResponse) => {
      const authUser = {
        id: response.user.id,
        email: response.user.email,
        username: response.user.username,
        userRole: response.user.userRole,
        isActive: response.user.isActive,
        trialStatus: response.user.trialStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Store auth data
      authApi.storeAuthData(response.token, authUser)

      // Update auth context
      login(response.token, authUser, true)

      toast.success(`환영합니다, ${response.user.username}님!`)

      if (response.user.trialStatus?.isTrialActive) {
        toast.info(`무료 체험 기간: ${response.user.trialStatus.daysRemaining}일 남음`)
      }

      // Clear survey data from localStorage after successful login
      clearSurveyStorage()

      // Navigate directly to /company (skip TrialResultPage)
      navigate("/company")
    },
    [login, navigate],
  )

  /**
   * Google OAuth Callback 처리
   * - Hydration-safe하게 localStorage 직접 접근
   */
  const handleGoogleCallback = useCallback(
    async (code: string) => {
      setIsProcessingCallback(true)

      try {
        // Hydration-safe: 직접 localStorage에서 읽기
        const surveyData = getSurveyFromStorage()

        const requestBody: Record<string, string> = { code }

        if (isValidSurveyData(surveyData)) {
          requestBody.industry = surveyData.industry
          requestBody.target = surveyData.target
          requestBody.country = surveyData.country
          requestBody.experience = surveyData.experience
          if (surveyData.lang) {
            requestBody.lang = surveyData.lang
          }
        }

        const response = await apiFetch<GoogleAuthResponse>("/api/v1/auth/google/callback", {
          method: "POST",
          body: JSON.stringify(requestBody),
        })

        handleLoginSuccess(response)
      } catch (error) {
        console.error("[NewTrialPage] Google OAuth callback error:", error)
        toast.error("Google 로그인 처리 중 오류가 발생했습니다.")
        navigate("/trial", { replace: true })
      } finally {
        setIsProcessingCallback(false)
      }
    },
    [handleLoginSuccess, navigate],
  )

  // Handle OAuth callback - runs once on mount if code is present
  useEffect(() => {
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    if (error) {
      toast.error("Google 로그인이 취소되었습니다.")
      navigate("/trial", { replace: true })
      return
    }

    // Process OAuth callback (only once per code)
    if (code && code !== processedCodeRef.current && !isProcessingCallback) {
      processedCodeRef.current = code
      handleGoogleCallback(code)
    }
  }, [searchParams, isProcessingCallback, handleGoogleCallback, navigate])

  /**
   * Google 로그인 시작
   */
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      const response = await apiFetch<{ authUrl: string }>("/api/v1/auth/google")
      window.location.href = response.authUrl
    } catch (error) {
      console.error("[NewTrialPage] Google OAuth error:", error)
      toast.error("Google 로그인 URL을 가져오는데 실패했습니다.")
      setIsLoading(false)
    }
  }

  // Show loading state during OAuth processing
  if (isProcessingCallback) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
              <p className="text-gray-600 text-sm">Google 로그인 처리 중...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher variant="secondary" />
      </div>

      {/* Left Side - Login Form */}
      <div className="flex flex-1 items-center justify-center bg-white p-4 sm:p-6 lg:p-8">
        <motion.div
          animate="animate"
          className="w-full max-w-md"
          initial="initial"
          variants={shouldReduceMotion() ? {} : staggerContainerVariants}
        >
          {/* RINDA Logo */}
          <motion.div
            className="mb-8 flex items-center lg:mb-12"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <div className="mr-3 flex h-8 w-8 items-center justify-center sm:h-10 sm:w-10">
              <img
                alt="Rinda Logo"
                className="h-full w-full object-contain"
                src="/images/rinda-logo.png"
              />
            </div>
            <span className="font-bold text-gray-900 text-lg sm:text-xl">RINDA</span>
          </motion.div>

          {/* Title */}
          <motion.div
            className="mb-6 lg:mb-8"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <h1 className="mb-2 font-bold text-gray-900 text-xl sm:text-2xl">
              {t("trial.new.title")}
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">{t("trial.new.subtitle")}</p>
          </motion.div>

          {/* Google Login Button */}
          <motion.div className="mb-6" variants={shouldReduceMotion() ? {} : staggerItemVariants}>
            <Button
              className="h-11 w-full border border-gray-300 bg-white text-gray-900 text-sm shadow-sm hover:bg-gray-50 sm:h-12 sm:text-base"
              disabled={isLoading}
              onClick={handleGoogleLogin}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-gray-600 border-b-2" />
                  연결 중...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <svg aria-label="Google logo" className="h-5 w-5" role="img" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t("trial.new.googleButton")}
                </div>
              )}
            </Button>
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            className="mt-6 text-center text-gray-500 text-xs"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            {t("trial.new.disclaimer")}{" "}
            <a className="text-blue-600 hover:underline" href="https://rinda.ai/privacy-policy">
              {t("trial.new.privacyPolicy")}
            </a>
            {t("trial.new.disclaimerEnd")}
          </motion.p>
        </motion.div>
      </div>

      {/* Right Side - Blue Gradient with Dashboard Preview */}
      <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 p-4 sm:p-6 lg:min-h-screen lg:p-8">
        <motion.div
          animate="animate"
          className="w-full max-w-2xl text-white"
          initial="initial"
          variants={shouldReduceMotion() ? {} : staggerContainerVariants}
        >
          {/* Main Content */}
          <motion.div
            className="mb-8 lg:mb-12"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <h2 className="mb-4 text-center font-bold text-2xl sm:text-3xl lg:text-left">
              {t("trial.new.rightTitle")}
            </h2>
            <p className="mb-6 text-center text-blue-100 lg:mb-8 lg:text-left">
              {t("trial.new.rightSubtitle")}
            </p>

            {/* Feature List */}
            <div className="mb-8 space-y-4 sm:space-y-6 lg:mb-12">
              <div className="flex items-center">
                <div className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-400 sm:mr-4 sm:h-8 sm:w-8">
                  <svg
                    aria-label="Checkmark"
                    className="h-4 w-4 text-white sm:h-5 sm:w-5"
                    fill="currentColor"
                    role="img"
                    viewBox="0 0 20 20"
                  >
                    <path
                      clipRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      fillRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-base sm:text-lg">{t("trial.new.feature1")}</span>
              </div>
              <div className="flex items-center">
                <div className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-400 sm:mr-4 sm:h-8 sm:w-8">
                  <svg
                    aria-label="Checkmark"
                    className="h-4 w-4 text-white sm:h-5 sm:w-5"
                    fill="currentColor"
                    role="img"
                    viewBox="0 0 20 20"
                  >
                    <path
                      clipRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      fillRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-base sm:text-lg">{t("trial.new.feature2")}</span>
              </div>
              <div className="flex items-center">
                <div className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-400 sm:mr-4 sm:h-8 sm:w-8">
                  <svg
                    aria-label="Checkmark"
                    className="h-4 w-4 text-white sm:h-5 sm:w-5"
                    fill="currentColor"
                    role="img"
                    viewBox="0 0 20 20"
                  >
                    <path
                      clipRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      fillRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-base sm:text-lg">{t("trial.new.feature3")}</span>
              </div>
            </div>
          </motion.div>

          {/* Testimonial Section */}
          <motion.div
            className="mb-6 lg:mb-8"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <p className="mb-4 whitespace-pre-line text-center text-base italic leading-relaxed sm:text-lg lg:text-left">
              "{t("trial.new.testimonial")}"
            </p>
            <div className="flex items-center justify-center lg:justify-start">
              <img
                alt="박상민 대표"
                className="mr-3 h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2 ring-white/30 sm:h-12 sm:w-12"
                src="/images/50ceo.png"
              />
              <div>
                <div className="font-medium text-base text-white sm:text-lg">
                  {t("trial.new.testimonialName")}
                </div>
                <div className="text-blue-200 text-sm">{t("trial.new.testimonialCompany")}</div>
              </div>
            </div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div variants={shouldReduceMotion() ? {} : staggerItemVariants}>
            <DashboardPreview />
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
