import { motion } from "framer-motion"
import { Chrome, Clock, Shield, Zap } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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
            className="text-center mb-8"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <motion.h1
              className="text-4xl font-bold text-gray-900 mb-4"
              variants={shouldReduceMotion() ? {} : slideUpVariants}
            >
              무료 체험 시작하기
            </motion.h1>
            <motion.p
              className="text-xl text-gray-600 mb-6"
              variants={shouldReduceMotion() ? {} : fadeVariants}
            >
              Google 계정으로 간편하게 시작하세요
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Features */}
            <motion.div
              className="space-y-6"
              variants={shouldReduceMotion() ? {} : staggerItemVariants}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    7일 무료 체험
                  </CardTitle>
                  <CardDescription>모든 기능을 7일간 무료로 사용해보세요</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    안전한 Google 로그인
                  </CardTitle>
                  <CardDescription>Google OAuth 2.0을 통한 보안 인증</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    즉시 시작
                  </CardTitle>
                  <CardDescription>복잡한 가입 절차 없이 바로 시작하세요</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>

            {/* Login Card */}
            <motion.div variants={shouldReduceMotion() ? {} : staggerItemVariants}>
              <Card className="h-full flex flex-col justify-center">
                <CardHeader className="text-center">
                  <CardTitle>Google 계정으로 시작하기</CardTitle>
                  <CardDescription>Google 계정을 사용하여 안전하게 로그인하세요</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <motion.div
                    variants={shouldReduceMotion() ? {} : scaleVariants}
                    whileHover={shouldReduceMotion() ? {} : { scale: 1.02 }}
                    whileTap={shouldReduceMotion() ? {} : { scale: 0.98 }}
                  >
                    <Button
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full h-12 text-lg bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                          연결 중...
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Chrome className="h-5 w-5 text-blue-600" />
                          Google로 계속하기
                        </div>
                      )}
                    </Button>
                  </motion.div>

                  <div className="text-center">
                    <p className="text-sm text-gray-500">
                      이미 계정이 있으신가요?{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        로그인하기
                      </button>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            className="text-center mt-8 text-sm text-gray-500"
            variants={shouldReduceMotion() ? {} : fadeVariants}
          >
            <p>
              계속 진행하면{" "}
              <a href="/terms" className="text-blue-600 hover:text-blue-800">
                서비스 약관
              </a>{" "}
              및{" "}
              <a href="/privacy" className="text-blue-600 hover:text-blue-800">
                개인정보 처리방침
              </a>
              에 동의하는 것으로 간주됩니다.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
