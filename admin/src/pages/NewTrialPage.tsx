import { useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { trackLogin, trackTrialPageVisit } from "@/lib/analytics"
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
  const queryClient = useQueryClient()

  // Ref to prevent duplicate OAuth processing
  const processedCodeRef = useRef<string | null>(null)

  /**
   * OAuth/Email 로그인 성공 후 처리
   */
  const handleLoginSuccess = useCallback(
    async (response: GoogleAuthResponse) => {
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

      // Update auth context (await로 state 업데이트 완료 대기)
      await login(response.token, authUser, true)

      // React Query 캐시 무효화 (모든 데이터 새로 로드)
      queryClient.invalidateQueries()

      // 📊 Analytics: Trial 로그인 추적
      trackLogin("google")

      toast.success(`환영합니다, ${response.user.username}님!`)

      if (response.user.trialStatus?.isTrialActive) {
        toast.info(`무료 체험 기간: ${response.user.trialStatus.daysRemaining}일 남음`)
      }

      // Clear survey data from localStorage after successful login
      clearSurveyStorage()

      // React Query 캐시 사전 로드 (navigate 전에 필요한 데이터 미리 로드)
      try {
        // 사용자의 워크스페이스 조회 및 캐시 저장
        const workspacesResponse = await apiFetch<Array<{ id: string }>>("/api/v1/workspaces/user")
        const workspaceId = workspacesResponse?.[0]?.id

        // workspaces 쿼리 캐시에 미리 저장
        queryClient.setQueryData(["workspaces", "user"], workspacesResponse)

        if (workspaceId) {
          // 병렬로 데이터 로드 (속도 향상)
          const [onboardingResponse, permissionsResponse] = await Promise.all([
            // 온보딩 진행 상태 확인
            apiFetch<{
              data: { completedAt: string | null }
            }>(`/api/v1/onboarding/workspace/${workspaceId}`),
            // 권한 정보 미리 로드
            apiFetch<{
              isAdmin: boolean
              memberId: string | null
              roles: Array<{ id: string; name: string }>
              permissions: Array<{ resource: string; action: string }>
            }>(`/api/v1/iam/my-permissions?workspaceId=${workspaceId}`).catch(() => null),
          ])

          // onboarding 쿼리 캐시에 미리 저장
          queryClient.setQueryData(
            ["onboarding", "workspace", workspaceId],
            onboardingResponse.data,
          )

          // permissions 쿼리 캐시에 미리 저장
          if (permissionsResponse) {
            queryClient.setQueryData(["iam", "my-permissions", workspaceId], permissionsResponse)
          }

          // 온보딩 완료 여부에 따라 리다이렉트
          if (onboardingResponse.data?.completedAt) {
            console.log("[NewTrialPage] Onboarding completed, redirecting to dashboard")
            // 강제 새로고침으로 모든 데이터 확실히 로드
            window.location.href = "/dashboard"
          } else {
            console.log("[NewTrialPage] Onboarding not completed, redirecting to company")
            window.location.href = "/company"
          }
        } else {
          // 워크스페이스가 없으면 온보딩 페이지로
          window.location.href = "/company"
        }
      } catch (error) {
        // 에러 발생 시 기본 동작: 온보딩 페이지로
        console.error("[NewTrialPage] Failed to check onboarding status:", error)
        window.location.href = "/company"
      }
    },
    [login, queryClient],
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
          requestBody.country = surveyData.country
          // 기본값 적용: 설문에서 수집하지 않는 필드는 기본값 사용
          requestBody.target = surveyData.target || "b2b"
          requestBody.experience = surveyData.experience || "none"
          if (surveyData.lang) {
            requestBody.lang = surveyData.lang
          }
        }

        const response = await apiFetch<GoogleAuthResponse>("/api/v1/auth/google/callback", {
          method: "POST",
          body: JSON.stringify(requestBody),
        })

        await handleLoginSuccess(response)
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

  // 📊 Analytics: Trial 페이지 유입 추적 (rinda.ai → app.rinda.ai/trial)
  useEffect(() => {
    // OAuth callback 처리 중이 아닐 때만 추적 (중복 방지)
    const code = searchParams.get("code")
    if (!code) {
      const referrer = document.referrer
      const source = referrer.includes("rinda.ai") ? "rinda.ai" : undefined
      trackTrialPageVisit(source)
    }
  }, [searchParams])

  /**
   * Google 로그인 시작
   */
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      // 진입점 저장: 로그아웃 시 /trial로 복귀하기 위함
      sessionStorage.setItem("auth_entry_point", "trial")
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
      <div className="flex flex-1 items-center justify-center bg-white p-6 py-12 sm:p-8 lg:p-8">
        <motion.div
          animate="animate"
          className="w-full max-w-md"
          initial="initial"
          variants={shouldReduceMotion() ? {} : staggerContainerVariants}
        >
          {/* RINDA Logo */}
          <motion.div
            className="mb-8 flex items-center justify-center lg:mb-12"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <div className="mr-2 flex h-10 w-10 items-center justify-center">
              <img
                alt="Rinda Logo"
                className="h-full w-full object-contain"
                src="/images/rinda-logo.png"
              />
            </div>
            <span className="font-bold text-gray-900 text-xl sm:text-2xl">RINDA</span>
          </motion.div>

          {/* Title */}
          <motion.div
            className="mb-8 text-center lg:mb-10"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <h1 className="mb-3 font-bold text-2xl text-gray-900 leading-tight sm:text-3xl">
              {t("trial.new.title")}
            </h1>
            <p className="text-base text-gray-600 sm:text-lg">{t("trial.new.subtitle")}</p>
          </motion.div>

          {/* Mobile-only: 3 Feature Icon Cards */}
          <motion.div
            className="mb-10 lg:hidden"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <div className="grid grid-cols-3 gap-3">
              {/* Card 1: Find Buyers */}
              <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 text-center shadow-sm">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500">
                  <svg
                    aria-hidden="true"
                    className="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900 text-xs leading-tight">
                  {t("trial.new.card1")
                    .split("|")
                    .map((line, i) => (
                      <span key={i}>
                        {line}
                        {i === 0 && <br />}
                      </span>
                    ))}
                </p>
              </div>

              {/* Card 2: Auto Email */}
              <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 text-center shadow-sm">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500">
                  <svg
                    aria-hidden="true"
                    className="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900 text-xs leading-tight">
                  {t("trial.new.card2")
                    .split("|")
                    .map((line, i) => (
                      <span key={i}>
                        {line}
                        {i === 0 && <br />}
                      </span>
                    ))}
                </p>
              </div>

              {/* Card 3: Real-time Alert */}
              <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 p-4 text-center shadow-sm">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500">
                  <svg
                    aria-hidden="true"
                    className="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900 text-xs leading-tight">
                  {t("trial.new.card3")
                    .split("|")
                    .map((line, i) => (
                      <span key={i}>
                        {line}
                        {i === 0 && <br />}
                      </span>
                    ))}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Mobile-only: Center Google Button */}
          <motion.div
            className="mb-8 lg:hidden"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
            <Button
              className="h-14 w-full bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 font-bold text-lg shadow-xl transition-all hover:from-blue-700 hover:via-blue-700 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-50"
              disabled={isLoading}
              onClick={handleGoogleLogin}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-white border-b-2" />
                  연결 중...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <svg aria-label="Google logo" className="h-6 w-6" role="img" viewBox="0 0 24 24">
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
                  <span>Google로 시작하기</span>
                </div>
              )}
            </Button>

            {/* Trust badges inline */}
            <div className="mt-3 flex items-center justify-center gap-2 text-gray-600 text-xs">
              <span className="flex items-center gap-1">
                <svg
                  aria-hidden="true"
                  className="h-3 w-3 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clipRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    fillRule="evenodd"
                  />
                </svg>
                14일 무료
              </span>
              <span className="text-gray-300">·</span>
              <span>카드 불필요</span>
              <span className="text-gray-300">·</span>
              <span>언제든 해지</span>
            </div>
          </motion.div>

          {/* Google Login Button */}
          <motion.div
            className="mb-6 hidden lg:block"
            variants={shouldReduceMotion() ? {} : staggerItemVariants}
          >
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
            className="mt-6 px-4 text-center text-gray-500 text-xs leading-relaxed"
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
      <div className="relative hidden flex-1 items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 lg:flex lg:min-h-screen lg:p-8">
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
        </motion.div>
      </div>
    </div>
  )
}
