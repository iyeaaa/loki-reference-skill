import { motion } from "framer-motion"
import { Chrome, Clock, Check, Users, Building, Globe } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  fadeVariants,
  scaleVariants,
  shouldReduceMotion,
  slideUpVariants,
  staggerContainerVariants,
  staggerItemVariants,
} from "@/lib/animations"
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

export default function TrialPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const { t } = useTranslation("translation")
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingCallback, setIsProcessingCallback] = useState(false)
  const [processedCode, setProcessedCode] = useState<string | null>(null)

  const handleGoogleCallback = useCallback(
    async (code: string) => {
      setIsProcessingCallback(true)
      try {
        const response = await apiFetch<GoogleAuthResponse>("/api/v1/auth/google/callback", {
          method: "POST",
          body: JSON.stringify({ code }),
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

        navigate("/dashboard")
      } catch (error) {
        console.error("Google OAuth callback error:", error)
        toast.error("Google 로그인 처리 중 오류가 발생했습니다.")
        navigate("/trial", { replace: true })
      } finally {
        setIsProcessingCallback(false)
      }
    },
    [login, navigate],
  )

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          className="w-full max-w-4xl"
          variants={shouldReduceMotion() ? {} : staggerContainerVariants}
          initial="initial"
          animate="animate"
        >
          {/* Header */}
          <motion.div
            className="text-center mb-12"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <motion.h1
              className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
              variants={shouldReduceMotion() ? {} : slideUpVariants}
            >
              {t("trial.title.main")}
              <br />
              <span className="text-blue-600">{t("trial.title.subtitle")}</span>
            </motion.h1>
            <motion.p
              className="text-lg text-gray-600 mb-8"
              variants={shouldReduceMotion() ? {} : fadeVariants}
            >
              {t("trial.description")}
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Left Column - Login Card */}
            <motion.div variants={shouldReduceMotion() ? {} : staggerItemVariants}>
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">G</span>
                    </div>
                    <CardTitle className="text-lg">{t("trial.card.title")}</CardTitle>
                  </div>
                  <CardDescription className="text-gray-600">
                    {t("trial.card.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <motion.div
                    variants={shouldReduceMotion() ? {} : scaleVariants}
                    whileHover={shouldReduceMotion() ? {} : { scale: 1.02 }}
                    whileTap={shouldReduceMotion() ? {} : { scale: 0.98 }}
                  >
                    <Button
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full h-12 text-base bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                          {t("trial.card.loading")}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Chrome className="h-5 w-5 text-blue-600" />
                          {t("trial.card.button")}
                        </div>
                      )}
                    </Button>
                  </motion.div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>{t("trial.features.cancelAnytime")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>{t("trial.features.noPaymentInfo")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>{t("trial.features.unlimitedAI")}</span>
                    </div>
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-xs text-gray-500">
                      {t("trial.card.disclaimer")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column - Statistics and Process Steps */}
            <motion.div
              className="space-y-8"
              variants={shouldReduceMotion() ? {} : staggerItemVariants}
            >
              {/* Statistics Section */}
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">3.2백</div>
                  <div className="text-sm text-gray-600">{t("trial.stats.activeUsers")}</div>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Building className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">500+</div>
                  <div className="text-sm text-gray-600">{t("trial.stats.registeredCompanies")}</div>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Globe className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">50+</div>
                  <div className="text-sm text-gray-600">{t("trial.stats.supportedLanguages")}</div>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">48시간</div>
                  <div className="text-sm text-gray-600">{t("trial.stats.averageResponseTime")}</div>
                </div>
              </div>

              {/* Process Steps */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">{t("trial.process.title")}</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">1</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t("trial.process.step1.title")}</h4>
                      <p className="text-sm text-gray-600">
                        {t("trial.process.step1.description")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">2</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t("trial.process.step2.title")}</h4>
                      <p className="text-sm text-gray-600">
                        {t("trial.process.step2.description")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">3</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t("trial.process.step3.title")}</h4>
                      <p className="text-sm text-gray-600">
                        {t("trial.process.step3.description")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Section - moved to right column */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="text-2xl font-bold text-blue-600">WO</div>
                      <div className="text-base text-gray-600">{t("trial.pricing.title")}</div>
                    </div>
                    <p className="text-gray-600 mb-4 text-sm">
                      {t("trial.pricing.price")}
                    </p>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                      {t("trial.pricing.button")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            className="text-center mt-12"
            variants={shouldReduceMotion() ? {} : fadeVariants}
          >
            <div className="flex justify-center items-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-600" />
                <span>{t("trial.footer.feature1")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-600" />
                <span>{t("trial.footer.feature2")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-600" />
                <span>{t("trial.footer.feature3")}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
