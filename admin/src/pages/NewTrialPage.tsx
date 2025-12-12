import { motion } from "framer-motion"
import { Mail } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { DashboardPreview } from "@/components/trial/DashboardPreview"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { shouldReduceMotion, staggerContainerVariants, staggerItemVariants } from "@/lib/animations"
import { apiFetch } from "@/lib/api/client"
import { authApi } from "@/lib/api/services/auth"
import { useAuth } from "@/lib/auth-provider"

interface GoogleAuthResponse {
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

interface OnboardingParams {
  industry: string | null
  target: string | null
  country: string | null
  experience: string | null
  lang: string | null
}

const ONBOARDING_STORAGE_KEY = "onboarding_params"

export default function NewTrialPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const { t, i18n } = useTranslation("translation")
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingCallback, setIsProcessingCallback] = useState(false)
  const [processedCode, setProcessedCode] = useState<string | null>(null)
  const [email, setEmail] = useState("")

  // Get onboarding params from sessionStorage (set on mount)
  const getOnboardingParams = useCallback((): OnboardingParams => {
    const stored = sessionStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored) as OnboardingParams
      } catch {
        return {
          industry: null,
          target: null,
          country: null,
          experience: null,
          lang: i18n.language,
        }
      }
    }
    return { industry: null, target: null, country: null, experience: null, lang: i18n.language }
  }, [i18n.language])

  const handleGoogleCallback = useCallback(
    async (code: string) => {
      setIsProcessingCallback(true)
      try {
        const onboardingParams = getOnboardingParams()
        // Filter out null values to avoid validation errors
        const body: Record<string, string> = { code }
        if (onboardingParams.industry) body.industry = onboardingParams.industry
        if (onboardingParams.target) body.target = onboardingParams.target
        if (onboardingParams.country) body.country = onboardingParams.country
        if (onboardingParams.experience) body.experience = onboardingParams.experience
        if (onboardingParams.lang) body.lang = onboardingParams.lang

        const response = await apiFetch<GoogleAuthResponse>("/api/v1/auth/google/callback", {
          method: "POST",
          body: JSON.stringify(body),
        })

        // Create proper AuthUser format
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
        await login(response.token, authUser, true) // OAuth login

        toast.success(`환영합니다, ${response.user.username}님!`)

        if (response.user.trialStatus?.isTrialActive) {
          toast.info(`무료 체험 기간: ${response.user.trialStatus.daysRemaining}일 남음`)
        }

        // If we have onboarding params, show result page first
        if (
          onboardingParams.industry &&
          onboardingParams.target &&
          onboardingParams.country &&
          onboardingParams.experience
        ) {
          const params = new URLSearchParams({
            industry: onboardingParams.industry,
            target: onboardingParams.target,
            country: onboardingParams.country,
            experience: onboardingParams.experience,
          })
          // Clear stored onboarding params after successful login
          sessionStorage.removeItem(ONBOARDING_STORAGE_KEY)
          navigate(`/trial/result?${params.toString()}`)
        } else {
          // No onboarding params, go directly to company page
          sessionStorage.removeItem(ONBOARDING_STORAGE_KEY)
          navigate("/company")
        }
      } catch (error) {
        console.error("Google OAuth callback error:", error)
        toast.error("Google 로그인 처리 중 오류가 발생했습니다.")
        navigate("/trial", { replace: true })
      } finally {
        setIsProcessingCallback(false)
      }
    },
    [login, navigate, getOnboardingParams],
  )

  // Store onboarding params on mount (before OAuth redirect)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally run only on mount to capture initial URL params
  useEffect(() => {
    const industry = searchParams.get("industry")
    const target = searchParams.get("target")
    const country = searchParams.get("country")
    const experience = searchParams.get("experience")

    // Only store if we have onboarding params (coming from /onboarding)
    if (industry || target || country || experience) {
      sessionStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({ industry, target, country, experience, lang: i18n.language }),
      )
    }
  }, [])

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    if (error) {
      toast.error("Google 로그인이 취소되었습니다.")
      navigate("/trial", { replace: true })
      return
    }

    if (code && code !== processedCode && !isProcessingCallback) {
      setProcessedCode(code)
      handleGoogleCallback(code)
    }
  }, [searchParams, processedCode, isProcessingCallback, handleGoogleCallback, navigate])

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      const response = await apiFetch<{ authUrl: string }>("/api/v1/auth/google")
      window.location.href = response.authUrl
    } catch (error) {
      console.error("Google OAuth error:", error)
      toast.error("Google 로그인 URL을 가져오는데 실패했습니다.")
      setIsLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error("이메일을 입력해주세요.")
      return
    }

    setIsLoading(true)
    try {
      const onboardingParams = getOnboardingParams()
      // Filter out null values to avoid validation errors
      const body: Record<string, string> = { email }
      if (onboardingParams.industry) body.industry = onboardingParams.industry
      if (onboardingParams.target) body.target = onboardingParams.target
      if (onboardingParams.country) body.country = onboardingParams.country
      if (onboardingParams.experience) body.experience = onboardingParams.experience
      if (onboardingParams.lang) body.lang = onboardingParams.lang

      const response = await apiFetch<GoogleAuthResponse>("/api/v1/auth/register-email", {
        method: "POST",
        body: JSON.stringify(body),
      })

      // Create proper AuthUser format
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
      await login(response.token, authUser, true) // Email registration login

      toast.success(`환영합니다! 이메일로 가입이 완료되었습니다.`)

      if (response.user.trialStatus?.isTrialActive) {
        toast.info(`무료 체험 기간: ${response.user.trialStatus.daysRemaining}일 남음`)
      }

      // If we have onboarding params, show result page first
      if (
        onboardingParams.industry &&
        onboardingParams.target &&
        onboardingParams.country &&
        onboardingParams.experience
      ) {
        const params = new URLSearchParams({
          industry: onboardingParams.industry,
          target: onboardingParams.target,
          country: onboardingParams.country,
          experience: onboardingParams.experience,
        })
        // Clear stored onboarding params after successful registration
        sessionStorage.removeItem(ONBOARDING_STORAGE_KEY)
        navigate(`/trial/result?${params.toString()}`)
      } else {
        // No onboarding params, go directly to company page
        sessionStorage.removeItem(ONBOARDING_STORAGE_KEY)
        navigate("/company")
      }
    } catch (error) {
      console.error("Email registration error:", error)
      toast.error("이메일 등록 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isProcessingCallback) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600">Google 로그인 처리 중...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-white p-4 sm:p-6 lg:p-8">
        <motion.div
          className="w-full max-w-md"
          variants={shouldReduceMotion() ? {} : staggerContainerVariants}
          initial="initial"
          animate="animate"
        >
          {/* RINDA Logo */}
          <motion.div
            className="flex items-center mb-8 lg:mb-12"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
              <span className="text-white text-base sm:text-lg font-bold">R</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-gray-900">RINDA</span>
          </motion.div>

          {/* Title */}
          <motion.div
            className="mb-6 lg:mb-8"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              {t("trial.new.title")}
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">{t("trial.new.subtitle")}</p>
          </motion.div>

          {/* Google Login Button */}
          <motion.div className="mb-6" variants={shouldReduceMotion() ? {} : staggerItemVariants}>
            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full h-11 sm:h-12 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm text-sm sm:text-base"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  연결 중...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" role="img" aria-label="Google logo">
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
                  {t("trial.new.googleButton")}
                </div>
              )}
            </Button>
          </motion.div>

          {/* Divider */}
          <motion.div
            className="flex items-center mb-6"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-3 text-sm text-gray-500">또는</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </motion.div>

          {/* Email Form */}
          <motion.form
            onSubmit={handleEmailSubmit}
            className="space-y-4"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="email"
                placeholder={t("trial.new.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 sm:h-12 text-sm sm:text-base"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 sm:h-12 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  등록 중...
                </div>
              ) : (
                <>{t("trial.new.emailButton")} →</>
              )}
            </Button>
          </motion.form>

          {/* Disclaimer */}
          <motion.p
            className="text-xs text-gray-500 mt-6 text-center"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            {t("trial.new.disclaimer")}{" "}
            <a href="/privacy-policy" className="text-blue-600 hover:underline">
              {t("trial.new.privacyPolicy")}
            </a>
            {t("trial.new.disclaimerEnd")}
          </motion.p>
        </motion.div>
      </div>

      {/* Right Side - Blue Gradient with Dashboard Preview */}
      <div className="flex-1 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center p-4 sm:p-6 lg:p-8 min-h-[50vh] lg:min-h-screen">
        <motion.div
          className="text-white max-w-2xl w-full"
          variants={shouldReduceMotion() ? {} : staggerContainerVariants}
          initial="initial"
          animate="animate"
        >
          {/* Main Content */}
          <motion.div
            className="mb-8 lg:mb-12"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-center lg:text-left">
              {t("trial.new.rightTitle")}
            </h2>
            <p className="text-blue-100 mb-6 lg:mb-8 text-center lg:text-left">
              {t("trial.new.rightSubtitle")}
            </p>

            {/* Feature List */}
            <div className="space-y-4 sm:space-y-6 mb-8 lg:mb-12">
              <div className="flex items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-400 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Checkmark"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-base sm:text-lg">{t("trial.new.feature1")}</span>
              </div>
              <div className="flex items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-400 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Checkmark"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-base sm:text-lg">{t("trial.new.feature2")}</span>
              </div>
              <div className="flex items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-400 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Checkmark"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-base sm:text-lg">{t("trial.new.feature3")}</span>
              </div>
            </div>
          </motion.div>

          {/* Testimonial Section - Outside dashboard */}
          <motion.div
            className="mb-6 lg:mb-8"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <p className="text-base sm:text-lg italic mb-4 leading-relaxed text-center lg:text-left">
              "{t("trial.new.testimonial")}"
            </p>
            <div className="flex items-center justify-center lg:justify-start">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-400 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                <span className="text-sm sm:text-base font-bold text-white">박</span>
              </div>
              <div>
                <div className="text-base sm:text-lg font-medium text-white">
                  {t("trial.new.testimonialName")}
                </div>
                <div className="text-sm text-blue-200">{t("trial.new.testimonialCompany")}</div>
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
