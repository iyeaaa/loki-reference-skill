import { zodResolver } from "@hookform/resolvers/zod"
import { motion } from "framer-motion"
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import * as z from "zod"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fadeVariants,
  scaleVariants,
  shouldReduceMotion,
  slideUpVariants,
  staggerContainerVariants,
  staggerItemVariants,
} from "@/lib/animations"
import { useCurrentUser, useVerifyToken } from "@/lib/api"
import { useLoginMutation, useSignupMutation } from "@/lib/api/hooks/auth"
import { useAuth } from "@/lib/auth-provider"

// Validation schemas will use i18n keys - messages will be translated in form errors
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const signupSchema = z
  .object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  })

type LoginFormValues = z.infer<typeof loginSchema>
type SignupFormValues = z.infer<typeof signupSchema>

export default function AdminLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuth()
  const reducedMotion = shouldReduceMotion()

  const loginEmailId = useId()
  const loginPasswordId = useId()
  const signupUsernameId = useId()
  const signupEmailId = useId()
  const signupPasswordId = useId()
  const signupConfirmPasswordId = useId()

  const [showPassword, setShowPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [activeTab, setActiveTab] = useState("login")

  // TanStack Query hooks
  const loginMutation = useLoginMutation()
  const signupMutation = useSignupMutation()
  const { data: currentUser } = useCurrentUser()
  useVerifyToken(!!currentUser)

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  // Check if already logged in and redirect to dashboard using useAuth hook
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true })
    }
  }, [authLoading, user, navigate])

  const onLoginSubmit = async (data: LoginFormValues) => {
    await loginMutation.mutateAsync(data)
  }

  const onSignupSubmit = async (data: SignupFormValues) => {
    await signupMutation.mutateAsync({
      username: data.username,
      email: data.email,
      password: data.password,
    })

    // After successful signup, clear form and switch to login tab with prefilled email
    signupForm.reset()
    loginForm.setValue("email", data.email)
    setActiveTab("login")
  }

  const isLoading = loginMutation.isPending || signupMutation.isPending

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center py-8 px-4 sm:py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-white to-blue-50"
      variants={reducedMotion ? undefined : fadeVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className="w-full max-w-lg"
        variants={reducedMotion ? undefined : scaleVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex justify-end mb-4">
          <LanguageSwitcher className="bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200/50 rounded-lg" />
        </div>
        <Card className="w-full shadow-2xl border-0">
          <CardHeader className="text-center pb-0 pt-8">
            <motion.div
              className="flex justify-center mb-6"
              variants={reducedMotion ? undefined : slideUpVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                <img
                  src="/images/rinda-logo.png"
                  alt="Rinda Logo"
                  className="w-full h-full object-contain rounded-3xl"
                />
              </div>
            </motion.div>
            <motion.div
              variants={reducedMotion ? undefined : slideUpVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
            >
              <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] bg-clip-text text-transparent px-2">
                {t("login.title")}
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-gray-600 mt-2 px-2">
                {t("login.description")}
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="pt-6 px-4 sm:px-6 pb-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12 bg-gray-100 p-1.5 gap-1.5">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 font-medium h-full px-4 py-2.5 rounded-md"
                >
                  {t("login.tab.login")}
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 font-medium h-full px-4 py-2.5 rounded-md"
                >
                  {t("login.tab.signup")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 mt-6">
                <motion.form
                  onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                  className="space-y-4"
                  variants={reducedMotion ? undefined : staggerContainerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                      {t("login.field.email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id={loginEmailId}
                        type="email"
                        placeholder={t("login.placeholder.email")}
                        className="pl-10 h-12 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                        {...loginForm.register("email")}
                        disabled={isLoading}
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-red-600">{t("login.error.emailInvalid")}</p>
                    )}
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      {t("login.field.password")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id={loginPasswordId}
                        type={showPassword ? "text" : "password"}
                        placeholder={t("login.placeholder.password")}
                        className="pl-10 pr-10 h-12 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                        {...loginForm.register("password")}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-600">{t("login.error.passwordMin")}</p>
                    )}
                  </motion.div>

                  <motion.div variants={reducedMotion ? undefined : staggerItemVariants}>
                    <Button
                      type="submit"
                      size="xl"
                      className="w-full bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] hover:from-[#5936B1] hover:to-[#2B72E6] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          {t("login.loading.login")}
                        </div>
                      ) : (
                        t("login.button.login")
                      )}
                    </Button>
                  </motion.div>
                </motion.form>

                {/* 구글 로그인 - 임시 비활성화 */}
                {/* <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-500 font-medium">또는</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-gray-200 hover:bg-gray-50 font-medium"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                구글로 로그인
              </Button> */}
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-6">
                <motion.form
                  onSubmit={signupForm.handleSubmit(onSignupSubmit)}
                  className="space-y-4"
                  variants={reducedMotion ? undefined : staggerContainerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label htmlFor="signup-username" className="text-sm font-medium text-gray-700">
                      {t("login.field.username")}
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id={signupUsernameId}
                        type="text"
                        placeholder={t("login.placeholder.username")}
                        className="pl-10 h-12 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                        {...signupForm.register("username")}
                        disabled={isLoading}
                      />
                    </div>
                    {signupForm.formState.errors.username && (
                      <p className="text-sm text-red-600">
                        {signupForm.formState.errors.username.message ===
                        "String must contain at least 3 character(s)"
                          ? t("login.error.usernameMin")
                          : t("login.error.usernameMax")}
                      </p>
                    )}
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label htmlFor="signup-email" className="text-sm font-medium text-gray-700">
                      {t("login.field.email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id={signupEmailId}
                        type="email"
                        placeholder={t("login.placeholder.emailInput")}
                        className="pl-10 h-12 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                        {...signupForm.register("email")}
                        disabled={isLoading}
                      />
                    </div>
                    {signupForm.formState.errors.email && (
                      <p className="text-sm text-red-600">{t("login.error.emailInvalid")}</p>
                    )}
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label htmlFor="signup-password" className="text-sm font-medium text-gray-700">
                      {t("login.field.password")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id={signupPasswordId}
                        type={showSignupPassword ? "text" : "password"}
                        placeholder={t("login.placeholder.password")}
                        className="pl-10 pr-10 h-12 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                        {...signupForm.register("password")}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSignupPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {signupForm.formState.errors.password && (
                      <p className="text-sm text-red-600">{t("login.error.passwordMin")}</p>
                    )}
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label
                      htmlFor="signup-confirm-password"
                      className="text-sm font-medium text-gray-700"
                    >
                      {t("login.field.confirmPassword")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id={signupConfirmPasswordId}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder={t("login.placeholder.confirmPassword")}
                        className="pl-10 pr-10 h-12 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                        {...signupForm.register("confirmPassword")}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {signupForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-600">{t("login.error.passwordMismatch")}</p>
                    )}
                  </motion.div>

                  <motion.div variants={reducedMotion ? undefined : staggerItemVariants}>
                    <Button
                      type="submit"
                      size="xl"
                      className="w-full bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] hover:from-[#5936B1] hover:to-[#2B72E6] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          {t("login.loading.signup")}
                        </div>
                      ) : (
                        t("login.button.signup")
                      )}
                    </Button>
                  </motion.div>
                </motion.form>
              </TabsContent>
            </Tabs>

            {/* Trial Link */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">처음 사용하시나요?</p>
                <Button variant="outline" onClick={() => navigate("/trial")} className="w-full">
                  7일 무료 체험 시작하기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
