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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-indigo-600 border-b-2" />
      </div>
    )
  }

  return (
    <motion.div
      animate="visible"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      initial="hidden"
      variants={reducedMotion ? undefined : fadeVariants}
    >
      <motion.div
        animate="visible"
        className="w-full max-w-lg"
        initial="hidden"
        variants={reducedMotion ? undefined : scaleVariants}
      >
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher className="rounded-lg border border-gray-200/50 bg-white/80 shadow-sm backdrop-blur-sm" />
        </div>
        <Card className="w-full border-0 shadow-2xl">
          <CardHeader className="pt-8 pb-0 text-center">
            <motion.div
              animate="visible"
              className="mb-6 flex justify-center"
              initial="hidden"
              variants={reducedMotion ? undefined : slideUpVariants}
            >
              <div className="relative h-24 w-24 sm:h-32 sm:w-32">
                <img
                  alt="Rinda Logo"
                  className="h-full w-full rounded-3xl object-contain"
                  src="/images/rinda-logo.png"
                />
              </div>
            </motion.div>
            <motion.div
              animate="visible"
              initial="hidden"
              transition={{ delay: 0.1 }}
              variants={reducedMotion ? undefined : slideUpVariants}
            >
              <CardTitle className="bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] bg-clip-text px-2 font-bold text-transparent text-xl sm:text-2xl">
                {t("login.title")}
              </CardTitle>
              <CardDescription className="mt-2 px-2 text-gray-600 text-sm sm:text-base">
                {t("login.description")}
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="px-4 pt-6 pb-8 sm:px-6">
            <Tabs className="w-full" onValueChange={setActiveTab} value={activeTab}>
              <TabsList className="grid h-12 w-full grid-cols-2 gap-1.5 bg-gray-100 p-1.5">
                <TabsTrigger
                  className="h-full rounded-md px-4 py-2.5 font-medium data-[state=active]:bg-white data-[state=active]:text-indigo-600"
                  value="login"
                >
                  {t("login.tab.login")}
                </TabsTrigger>
                <TabsTrigger
                  className="h-full rounded-md px-4 py-2.5 font-medium data-[state=active]:bg-white data-[state=active]:text-indigo-600"
                  value="signup"
                >
                  {t("login.tab.signup")}
                </TabsTrigger>
              </TabsList>

              <TabsContent className="mt-6 space-y-4" value="login">
                <motion.form
                  animate="visible"
                  className="space-y-4"
                  initial="hidden"
                  onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                  variants={reducedMotion ? undefined : staggerContainerVariants}
                >
                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label className="font-medium text-gray-700 text-sm" htmlFor="email">
                      {t("login.field.email")}
                    </Label>
                    <div className="relative">
                      <Mail className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                      <Input
                        className="h-12 border-gray-200 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
                        id={loginEmailId}
                        placeholder={t("login.placeholder.email")}
                        type="email"
                        {...loginForm.register("email")}
                        disabled={isLoading}
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-red-600 text-sm">{t("login.error.emailInvalid")}</p>
                    )}
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label className="font-medium text-gray-700 text-sm" htmlFor="password">
                      {t("login.field.password")}
                    </Label>
                    <div className="relative">
                      <Lock className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                      <Input
                        className="h-12 border-gray-200 pr-10 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
                        id={loginPasswordId}
                        placeholder={t("login.placeholder.password")}
                        type={showPassword ? "text" : "password"}
                        {...loginForm.register("password")}
                        disabled={isLoading}
                      />
                      <button
                        className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-red-600 text-sm">{t("login.error.passwordMin")}</p>
                    )}
                  </motion.div>

                  <motion.div variants={reducedMotion ? undefined : staggerItemVariants}>
                    <Button
                      className="w-full bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] font-medium text-white shadow-lg transition-all duration-200 hover:from-[#5936B1] hover:to-[#2B72E6] hover:shadow-xl"
                      disabled={isLoading}
                      size="xl"
                      type="submit"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-white border-b-2" />
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

              <TabsContent className="mt-6 space-y-4" value="signup">
                <motion.form
                  animate="visible"
                  className="space-y-4"
                  initial="hidden"
                  onSubmit={signupForm.handleSubmit(onSignupSubmit)}
                  variants={reducedMotion ? undefined : staggerContainerVariants}
                >
                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label className="font-medium text-gray-700 text-sm" htmlFor="signup-username">
                      {t("login.field.username")}
                    </Label>
                    <div className="relative">
                      <User className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                      <Input
                        className="h-12 border-gray-200 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
                        id={signupUsernameId}
                        placeholder={t("login.placeholder.username")}
                        type="text"
                        {...signupForm.register("username")}
                        disabled={isLoading}
                      />
                    </div>
                    {signupForm.formState.errors.username && (
                      <p className="text-red-600 text-sm">
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
                    <Label className="font-medium text-gray-700 text-sm" htmlFor="signup-email">
                      {t("login.field.email")}
                    </Label>
                    <div className="relative">
                      <Mail className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                      <Input
                        className="h-12 border-gray-200 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
                        id={signupEmailId}
                        placeholder={t("login.placeholder.emailInput")}
                        type="email"
                        {...signupForm.register("email")}
                        disabled={isLoading}
                      />
                    </div>
                    {signupForm.formState.errors.email && (
                      <p className="text-red-600 text-sm">{t("login.error.emailInvalid")}</p>
                    )}
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label className="font-medium text-gray-700 text-sm" htmlFor="signup-password">
                      {t("login.field.password")}
                    </Label>
                    <div className="relative">
                      <Lock className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                      <Input
                        className="h-12 border-gray-200 pr-10 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
                        id={signupPasswordId}
                        placeholder={t("login.placeholder.password")}
                        type={showSignupPassword ? "text" : "password"}
                        {...signupForm.register("password")}
                        disabled={isLoading}
                      />
                      <button
                        className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        type="button"
                      >
                        {showSignupPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {signupForm.formState.errors.password && (
                      <p className="text-red-600 text-sm">{t("login.error.passwordMin")}</p>
                    )}
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={reducedMotion ? undefined : staggerItemVariants}
                  >
                    <Label
                      className="font-medium text-gray-700 text-sm"
                      htmlFor="signup-confirm-password"
                    >
                      {t("login.field.confirmPassword")}
                    </Label>
                    <div className="relative">
                      <Lock className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                      <Input
                        className="h-12 border-gray-200 pr-10 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
                        id={signupConfirmPasswordId}
                        placeholder={t("login.placeholder.confirmPassword")}
                        type={showConfirmPassword ? "text" : "password"}
                        {...signupForm.register("confirmPassword")}
                        disabled={isLoading}
                      />
                      <button
                        className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        type="button"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {signupForm.formState.errors.confirmPassword && (
                      <p className="text-red-600 text-sm">{t("login.error.passwordMismatch")}</p>
                    )}
                  </motion.div>

                  <motion.div variants={reducedMotion ? undefined : staggerItemVariants}>
                    <Button
                      className="w-full bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] font-medium text-white shadow-lg transition-all duration-200 hover:from-[#5936B1] hover:to-[#2B72E6] hover:shadow-xl"
                      disabled={isLoading}
                      size="xl"
                      type="submit"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-white border-b-2" />
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
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
