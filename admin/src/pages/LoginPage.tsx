import { zodResolver } from "@hookform/resolvers/zod"
import { CreditCard, Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrentUser, useDepartments, useVerifyToken } from "@/lib/api"
import { useLoginMutation, useSignupMutation } from "@/lib/api/hooks/auth"

const loginSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해주세요"),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다"),
})

const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, "사용자명은 최소 3자 이상이어야 합니다")
      .max(50, "사용자명은 최대 50자까지 가능합니다"),
    email: z.string().email("올바른 이메일 주소를 입력해주세요"),
    password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다"),
    confirmPassword: z.string(),
    employeeId: z.string().min(1, "사번을 입력해주세요").max(20, "사번은 최대 20자까지 가능합니다"),
    departmentId: z.string().min(1, "부서를 선택해주세요"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  })

type LoginFormValues = z.infer<typeof loginSchema>
type SignupFormValues = z.infer<typeof signupSchema>

export default function AdminLoginPage() {
  const navigate = useNavigate()

  const loginEmailId = useId()
  const loginPasswordId = useId()
  const signupUsernameId = useId()
  const signupEmailId = useId()
  const signupEmployeeId = useId()
  const signupPasswordId = useId()
  const signupConfirmPasswordId = useId()

  const [departmentSearch, setDepartmentSearch] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [activeTab, setActiveTab] = useState("login")

  // TanStack Query hooks
  const loginMutation = useLoginMutation()
  const signupMutation = useSignupMutation()
  const { data: departmentsData, isLoading: searchLoading } = useDepartments(departmentSearch)
  const { data: currentUser } = useCurrentUser()
  const { data: isTokenValid } = useVerifyToken(!!currentUser)

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
      employeeId: "",
      departmentId: "",
    },
  })

  // Check if already logged in using TanStack Query
  useEffect(() => {
    if (currentUser && isTokenValid) {
      const allowedRoles = ["admin", "internal_reviewer", "external_reviewer"]
      if (currentUser?.userRole && allowedRoles.includes(currentUser.userRole)) {
        navigate("/")
      }
    }
  }, [currentUser, isTokenValid, navigate])

  const onLoginSubmit = async (data: LoginFormValues) => {
    await loginMutation.mutateAsync(data)
  }

  const onSignupSubmit = async (data: SignupFormValues) => {
    await signupMutation.mutateAsync({
      username: data.username,
      email: data.email,
      password: data.password,
      departmentId: data.departmentId,
      employeeId: data.employeeId,
    })

    // After successful signup, clear form and switch to login tab with prefilled email
    signupForm.reset()
    loginForm.setValue("email", data.email)
    setActiveTab("login")
  }

  // Format departments for Combobox
  const filteredDepartments = Array.isArray(departmentsData)
    ? departmentsData.map((dept) => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
      }))
    : []

  const isLoading = loginMutation.isPending || signupMutation.isPending

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-0">
          <div className="flex justify-center mb-6">
            <div className="relative w-32 h-32">
              <img
                src="/images/rinda-logo.png"
                alt="Rinda Logo"
                className="w-full h-full object-contain rounded-3xl"
              />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] bg-clip-text text-transparent">
            Rinda Expert
          </CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            스마트한 이메일 마케팅 솔루션
            <br />
            <span className="text-xs text-indigo-600 font-medium mt-3 block">
              ※ 관리자 승인 후 이용 가능
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12 bg-gray-100">
              <TabsTrigger
                value="login"
                className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 font-medium"
              >
                로그인
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 font-medium"
              >
                회원가입
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-6">
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    이메일
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id={loginEmailId}
                      type="email"
                      placeholder="admin@rinda.ai"
                      className="pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                      {...loginForm.register("email")}
                      disabled={isLoading}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-red-600">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    비밀번호
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id={loginPasswordId}
                      type={showPassword ? "text" : "password"}
                      placeholder="비밀번호를 입력하세요"
                      className="pl-10 pr-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                      {...loginForm.register("password")}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-red-600">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="xl"
                  className="w-full bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] hover:from-[#5936B1] hover:to-[#2B72E6] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      로그인 중...
                    </div>
                  ) : (
                    "관리자 로그인"
                  )}
                </Button>
              </form>

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
              <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username" className="text-sm font-medium text-gray-700">
                    사용자명
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id={signupUsernameId}
                      type="text"
                      placeholder="사용자명을 입력하세요"
                      className="pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                      {...signupForm.register("username")}
                      disabled={isLoading}
                    />
                  </div>
                  {signupForm.formState.errors.username && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium text-gray-700">
                    이메일
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id={signupEmailId}
                      type="email"
                      placeholder="이메일을 입력하세요"
                      className="pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                      {...signupForm.register("email")}
                      disabled={isLoading}
                    />
                  </div>
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-employee-id" className="text-sm font-medium text-gray-700">
                    사번
                  </Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id={signupEmployeeId}
                      type="text"
                      placeholder="사번을 입력하세요"
                      className="pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                      {...signupForm.register("employeeId")}
                      disabled={isLoading}
                    />
                  </div>
                  {signupForm.formState.errors.employeeId && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.employeeId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-department" className="text-sm font-medium text-gray-700">
                    부서
                  </Label>
                  <Combobox
                    options={filteredDepartments.map((dept) => ({
                      value: dept.id,
                      label: dept.name,
                      sublabel: dept.code,
                    }))}
                    value={signupForm.watch("departmentId")}
                    onValueChange={(value) => {
                      signupForm.setValue("departmentId", value)
                      signupForm.clearErrors("departmentId")
                    }}
                    onSearchChange={setDepartmentSearch}
                    placeholder="부서를 선택하세요"
                    searchPlaceholder="부서명 또는 코드로 검색..."
                    emptyText={searchLoading ? "검색 중..." : "일치하는 부서가 없습니다"}
                    disabled={isLoading}
                  />
                  {signupForm.formState.errors.departmentId && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.departmentId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium text-gray-700">
                    비밀번호
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id={signupPasswordId}
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="비밀번호를 입력하세요"
                      className="pl-10 pr-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
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
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="signup-confirm-password"
                    className="text-sm font-medium text-gray-700"
                  >
                    비밀번호 확인
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id={signupConfirmPasswordId}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="비밀번호를 다시 입력하세요"
                      className="pl-10 pr-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
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
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="xl"
                  className="w-full bg-gradient-to-r from-[#6B46C1] to-[#3B82F6] hover:from-[#5936B1] hover:to-[#2B72E6] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      회원가입 중...
                    </div>
                  ) : (
                    "회원가입"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
