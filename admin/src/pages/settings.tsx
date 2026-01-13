import {
  Activity,
  Building2,
  Camera,
  ClipboardList,
  CreditCard,
  FlaskConical,
  Globe,
  Key,
  ListTree,
  LogOut,
  Mail,
  Menu,
  Package,
  Rocket,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Upload,
  User,
  UserCog,
  Users,
  X,
} from "lucide-react"
import { parseAsString, useQueryState } from "nuqs"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { DangerZone } from "@/components/settings/DangerZone"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingsSidebar } from "@/components/ui/settings-sidebar"
import {
  useAccountDeletionCheck,
  useCurrentUser,
  useDeleteAccountMutation,
  useLogoutMutation,
  useUpdateProfileMutation,
} from "@/lib/api/hooks/auth"
import { useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useUploadProfileImage } from "@/lib/api/hooks/upload"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import {
  IAM_ACTIONS,
  IAM_RESOURCES,
  type IamAction,
  type IamResource,
} from "@/lib/constants/iam-resources"
import { DEFAULT_PROFILE_IMAGE } from "@/lib/constants/images"
import { usePermissions } from "@/lib/permission"
import ActivityLogsPage from "./activity-logs"
import CompanyInformation from "./app/CompanyInformation"
import { CustomersPage, PlansPage, ProductsPage, SubscriptionsPage } from "./billing"
import { AuditLogsPage, PoliciesPage, RolesPage, TierBoundariesPage } from "./iam"
import LeadImportPage from "./lead-import/index"
import { BullMQTestPage } from "./settings/BullMQTestPage"
import { EmailDraftTest } from "./settings/EmailDraftTest"
import { EmailSignatureManagement } from "./settings/EmailSignatureManagement"
import { JobLogsPage } from "./settings/job-logs"
import { LanguageSettings } from "./settings/LanguageSettings"
import { LicenseKeySettings } from "./settings/LicenseKeySettings"
import { NylasEmailTest } from "./settings/NylasEmailTest"
import { OnboardingEmailTest } from "./settings/OnboardingEmailTest"
import { OnboardingTest } from "./settings/OnboardingTest"
import { PaymentTestPage } from "./settings/PaymentTestPage"
import { UnipileEmailTest } from "./settings/UnipileEmailTest"
import { WebDataExtraction } from "./settings/WebDataExtraction"
import UsersPage from "./users/UsersPage"
import WorkspacesPage from "./workspaces/WorkspacesPage"

/**
 * 설정 메뉴 아이템 타입
 *
 * 권한 설정 (AWS IAM 스타일):
 * - permission: { resource, action } - 해당 권한 보유자만 표시
 * - permission: "public" - 모든 로그인 사용자에게 표시
 * - permission: "admin-only" - 시스템 Admin만 표시
 * - permission: undefined - 모든 로그인 사용자에게 표시 (기본값)
 */
type SettingsMenuItem = {
  id: string
  label: string
  icon: React.ReactNode
  type?: "separator" | "header"
  permission?: { resource: IamResource; action: IamAction } | "public" | "admin-only"
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const nameId = useId()
  const emailId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: currentUser, isLoading } = useCurrentUser()
  const updateProfileMutation = useUpdateProfileMutation()
  const uploadProfileImageMutation = useUploadProfileImage()
  const { data: deletionCheck } = useAccountDeletionCheck()
  const deleteAccountMutation = useDeleteAccountMutation()
  const logoutMutation = useLogoutMutation()
  const [activeTab, setActiveTab] = useQueryState("tab", parseAsString.withDefault("profile"))
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSettingsSidebarCollapsed, setIsSettingsSidebarCollapsed] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    profilePicture: null as string | null,
  })

  // Load current user data
  useEffect(() => {
    if (currentUser) {
      setFormData({
        username: currentUser.username || "",
        email: currentUser.email || "",
        profilePicture: currentUser.profilePicture || null,
      })
      setPreviewImage(currentUser.profilePicture || null)
    }
  }, [currentUser])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return
    }

    // FileReader로 data URL 생성 (CSP blob: 제한 우회)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string
      setPreviewImage(dataUrl)
      setIsUploadingImage(true)

      try {
        // S3에 업로드
        const imageUrl = await uploadProfileImageMutation.mutateAsync(file)
        setFormData((prev) => ({ ...prev, profilePicture: imageUrl }))
        setPreviewImage(imageUrl)
      } catch (error) {
        // 업로드 실패 시 이전 이미지로 복원
        setPreviewImage(currentUser?.profilePicture || null)
        console.error("Failed to upload image:", error)
      } finally {
        setIsUploadingImage(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setPreviewImage(null)
    setFormData((prev) => ({ ...prev, profilePicture: null }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  // usePermissions 훅을 사용하여 서버에서 최신 Admin 여부 및 권한 확인
  const { isAdmin: isSystemAdmin, isLoading: permissionLoading, hasPermission } = usePermissions()

  // 온보딩 상태 확인
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const userWorkspaceId = userWorkspaces?.[0]?.id || ""
  const { data: onboardingProgress } = useOnboardingProgress(userWorkspaceId, !!userWorkspaceId)
  const isOnboardingComplete = !!onboardingProgress?.completedAt

  /**
   * 설정 메뉴 아이템 정의
   *
   * AWS IAM 스타일 권한 매핑:
   * - "public" 또는 undefined: 모든 로그인 사용자
   * - "admin-only": 시스템 Admin만 (users.role = 'admin' | 'super_admin')
   * - { resource, action }: 해당 IAM 권한 보유자
   */
  const allMenuItems: SettingsMenuItem[] = useMemo(
    () => [
      // ───────────────────────────────────────────────────────────────────────
      // 개인 설정 - 모든 로그인 사용자
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "header-personal",
        label: "개인 설정",
        icon: null,
        type: "header",
      },
      {
        id: "profile",
        label: t("settings.profile.title"),
        icon: <User className="h-4 w-4" />,
        permission: { resource: IAM_RESOURCES.SETTINGS_PROFILE, action: IAM_ACTIONS.READ },
      },
      {
        id: "account",
        label: t("settings.account.title", "계정 관리"),
        icon: <Settings className="h-4 w-4" />,
        permission: "public",
      },
      {
        id: "signature",
        label: t("settings.signature.title"),
        icon: <Mail className="h-4 w-4" />,
        permission: { resource: IAM_RESOURCES.SETTINGS_PROFILE, action: IAM_ACTIONS.READ },
      },
      {
        id: "language",
        label: t("settings.language.title"),
        icon: <Globe className="h-4 w-4" />,
        permission: "public",
      },
      // ───────────────────────────────────────────────────────────────────────
      // 워크스페이스 - 모든 로그인 사용자 접근 가능
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "header-workspace",
        label: "워크스페이스",
        icon: null,
        type: "header",
      },
      // 온보딩 미완료 시 "회사 설정" 메뉴 (조건부 추가는 아래에서 처리)
      {
        id: "workspace",
        label: t("settings.system.workspaces.title"),
        icon: <Building2 className="h-4 w-4" />,
        permission: "public", // 모든 사용자가 자신의 워크스페이스 정보 확인 가능
      },
      // ───────────────────────────────────────────────────────────────────────
      // 시스템 관리 - Admin 전용
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "header-system",
        label: "시스템 관리",
        icon: null,
        type: "header",
        permission: "admin-only",
      },
      {
        id: "admin",
        label: t("settings.system.users.title"),
        icon: <Users className="h-4 w-4" />,
        permission: "admin-only",
      },
      // ───────────────────────────────────────────────────────────────────────
      // 결제 - Admin 전용 (billing:* 권한)
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "header-billing",
        label: "결제",
        icon: null,
        type: "header",
        permission: "admin-only",
      },
      {
        id: "billing-products",
        label: "상품",
        icon: <Package className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "billing-plans",
        label: "요금제",
        icon: <ListTree className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "billing-subscriptions",
        label: "구독",
        icon: <CreditCard className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "billing-customers",
        label: "고객",
        icon: <Users className="h-4 w-4" />,
        permission: "admin-only",
      },
      // ───────────────────────────────────────────────────────────────────────
      // 권한 및 보안 - Admin 전용 (iam:* 권한)
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "header-iam",
        label: "권한 및 보안",
        icon: null,
        type: "header",
        permission: "admin-only",
      },
      {
        id: "iam-policies",
        label: "정책",
        icon: <Shield className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "iam-roles",
        label: "역할",
        icon: <UserCog className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "iam-tier-boundaries",
        label: "등급 경계",
        icon: <ShieldCheck className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "iam-audit-logs",
        label: "감사 로그",
        icon: <ClipboardList className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "activity-logs",
        label: "활동 로그",
        icon: <Activity className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "license-key",
        label: "라이센스 키",
        icon: <Key className="h-4 w-4" />,
        permission: "admin-only",
      },
      // ───────────────────────────────────────────────────────────────────────
      // 기록 - Admin 전용 (마케팅 팀 모니터링용)
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "header-records",
        label: "기록",
        icon: null,
        type: "header",
        permission: "admin-only",
      },
      {
        id: "campaign-activity-logs",
        label: "캠페인 작업 기록",
        icon: <ScrollText className="h-4 w-4" />,
        permission: "admin-only",
      },
      // ───────────────────────────────────────────────────────────────────────
      // 테스트 - Admin 전용 (개발/테스트용 기능)
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "header-test",
        label: "테스트",
        icon: null,
        type: "header",
        permission: "admin-only",
      },
      {
        id: "bulk-lead-import",
        label: t("settings.system.import.title"),
        icon: <Upload className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "nylas-email-test",
        label: t("settings.nylasTest.title"),
        icon: <Mail className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "unipile-email-test",
        label: t("settings.unipileTest.title"),
        icon: <Mail className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "web-extraction",
        label: t("settings.system.webExtraction.title"),
        icon: <Globe className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "bullmq-test",
        label: "BullMQ 테스트",
        icon: <FlaskConical className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "job-logs",
        label: "BullMQ 로그",
        icon: <ScrollText className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "email-draft-test",
        label: t("settings.emailDraftTest.title"),
        icon: <Mail className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "onboarding-test",
        label: "온보딩 전체 테스트",
        icon: <Rocket className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "onboarding-email-test",
        label: "온보딩 이메일 테스트",
        icon: <Mail className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "payment-test",
        label: "결제 테스트 (PG심사)",
        icon: <CreditCard className="h-4 w-4" />,
        permission: "admin-only",
      },
    ],
    [t],
  )

  /**
   * 권한에 따라 메뉴 필터링
   */
  const sidebarItems = useMemo(() => {
    // 권한 로딩 중이면 빈 배열 (깜박임 방지)
    if (permissionLoading) {
      return []
    }

    // 권한 체크 함수
    const canAccess = (item: SettingsMenuItem): boolean => {
      // header/separator는 별도 처리 (하위 항목이 있는지로 판단)
      if (item.type === "header" || item.type === "separator") {
        return true // 일단 통과, 나중에 빈 섹션 제거
      }

      // 서명 관리는 모든 사용자에게 표시 (워크스페이스별 관리)
      // Trial 제한 제거됨

      // Admin은 모든 메뉴 접근 가능
      if (isSystemAdmin) {
        return true
      }

      // "admin-only" 권한인 경우
      if (item.permission === "admin-only") {
        return false
      }

      // "public" 또는 undefined는 모든 사용자 접근 가능
      if (!item.permission || item.permission === "public") {
        return true
      }

      // IAM 권한 체크
      return hasPermission(item.permission.resource, item.permission.action)
    }

    // 필터링
    let filteredItems = allMenuItems.filter(canAccess)

    // 온보딩 미완료 시 "회사 설정" 메뉴 추가
    if (!isOnboardingComplete) {
      const workspaceHeaderIndex = filteredItems.findIndex((item) => item.id === "header-workspace")
      if (workspaceHeaderIndex !== -1) {
        filteredItems = [
          ...filteredItems.slice(0, workspaceHeaderIndex + 1),
          {
            id: "company-setup",
            label: t("settings.companySetup.title", "회사 설정"),
            icon: <Building2 className="h-4 w-4" />,
            permission: "public" as const,
          },
          ...filteredItems.slice(workspaceHeaderIndex + 1),
        ]
      }
    }

    // 빈 섹션 헤더 제거 (해당 헤더 다음에 아이템이 없는 경우)
    const cleanedItems: SettingsMenuItem[] = []
    for (let i = 0; i < filteredItems.length; i++) {
      const item = filteredItems[i]
      if (item.type === "header") {
        // 다음 항목이 존재하고 헤더가 아닌 경우에만 추가
        const nextItem = filteredItems[i + 1]
        if (nextItem && nextItem.type !== "header") {
          cleanedItems.push(item)
        }
      } else {
        cleanedItems.push(item)
      }
    }

    return cleanedItems
  }, [allMenuItems, isSystemAdmin, hasPermission, permissionLoading, isOnboardingComplete, t])

  if (isLoading || permissionLoading) {
    return (
      <div className="flex h-screen">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">{t("common.loading")}</div>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <Card className="h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <CardTitle className="text-base">{t("settings.profile.title")}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t("settings.profile.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="max-w-2xl space-y-6" onSubmit={handleSubmit}>
                {/* Profile Picture Upload */}
                <div className="space-y-3">
                  <Label>{t("settings.profile.profilePicture")}</Label>
                  <div className="flex items-center gap-6">
                    <div className="group relative">
                      <Avatar className="h-24 w-24 border-2 border-muted">
                        <AvatarImage alt="Profile" src={previewImage || DEFAULT_PROFILE_IMAGE} />
                        <AvatarFallback className="bg-muted text-2xl">
                          {formData.username?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        <Camera className="h-6 w-6 text-white" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        ref={fileInputRef}
                        type="file"
                      />
                      <Button
                        disabled={isUploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {isUploadingImage ? "업로드 중..." : t("settings.profile.uploadPhoto")}
                      </Button>
                      {previewImage && !isUploadingImage && (
                        <Button
                          className="text-destructive hover:text-destructive"
                          onClick={handleRemoveImage}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <X className="mr-2 h-4 w-4" />
                          {t("settings.profile.removePhoto")}
                        </Button>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {t("settings.profile.photoHint")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={nameId}>{t("settings.profile.name")}</Label>
                  <Input
                    id={nameId}
                    name="username"
                    onChange={handleChange}
                    placeholder="홍길동"
                    required
                    value={formData.username}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={emailId}>{t("settings.profile.email")}</Label>
                  <Input
                    id={emailId}
                    name="email"
                    onChange={handleChange}
                    placeholder="email@example.com"
                    required
                    type="email"
                    value={formData.email}
                  />
                </div>
                <Button disabled={updateProfileMutation.isPending} type="submit">
                  {updateProfileMutation.isPending
                    ? t("settings.profile.saving")
                    : t("settings.profile.saveChanges")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )
      case "account":
        return (
          <Card className="h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-1.5">
                <Settings className="h-4 w-4" />
                <CardTitle className="text-base">
                  {t("settings.account.title", "계정 관리")}
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t("settings.account.description", "계정 설정 및 로그아웃")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logout Section */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm">{t("settings.account.logout", "로그아웃")}</h3>
                <Button
                  className="w-full justify-start gap-2 sm:w-auto"
                  disabled={logoutMutation.isPending}
                  onClick={() => logoutMutation.mutate()}
                  variant="outline"
                >
                  <LogOut className="h-4 w-4" />
                  {logoutMutation.isPending
                    ? t("settings.account.loggingOut", "로그아웃 중...")
                    : t("settings.account.logoutButton", "로그아웃")}
                </Button>
              </div>

              {/* Legal Links */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm">{t("settings.account.legal", "법적 고지")}</h3>
                <div className="flex flex-wrap gap-4">
                  <a
                    className="text-muted-foreground text-sm transition-colors hover:text-foreground hover:underline"
                    href="/privacy"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("settings.account.privacyPolicy", "개인정보처리방침")}
                  </a>
                  <a
                    className="text-muted-foreground text-sm transition-colors hover:text-foreground hover:underline"
                    href="/terms"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("settings.account.termsOfService", "이용약관")}
                  </a>
                </div>
              </div>

              {/* Danger Zone - Account Deletion */}
              <DangerZone
                canDelete={deletionCheck?.canDelete ?? false}
                isDeleting={deleteAccountMutation.isPending}
                onDeleteAccount={() => deleteAccountMutation.mutate()}
                userEmail={currentUser?.email}
                userName={currentUser?.username}
                workspacesRequiringTransfer={deletionCheck?.workspacesRequiringTransfer ?? []}
                workspacesToBeDeleted={deletionCheck?.workspacesToBeDeleted ?? []}
              />
            </CardContent>
          </Card>
        )
      case "signature":
        return <EmailSignatureManagement />
      case "language":
        return <LanguageSettings />
      case "company-setup":
        return <CompanyInformation />
      case "workspace":
        return <WorkspacesPage />
      case "admin":
        return <UsersPage />
      case "bulk-lead-import":
        return <LeadImportPage />
      case "web-extraction":
        return <WebDataExtraction />
      case "nylas-email-test":
        return <NylasEmailTest />
      case "unipile-email-test":
        return <UnipileEmailTest />
      // IAM Pages
      case "iam-policies":
        return <PoliciesPage />
      case "iam-roles":
        return <RolesPage />
      case "iam-tier-boundaries":
        return <TierBoundariesPage />
      case "iam-audit-logs":
        return <AuditLogsPage />
      case "activity-logs":
        return <ActivityLogsPage />
      case "license-key":
        return <LicenseKeySettings />
      // Records Pages
      case "campaign-activity-logs":
        return <JobLogsPage />
      // Billing Pages
      case "billing-products":
        return <ProductsPage />
      case "billing-plans":
        return <PlansPage />
      case "billing-subscriptions":
        return <SubscriptionsPage />
      case "billing-customers":
        return <CustomersPage />
      // Test Pages
      case "bullmq-test":
        return <BullMQTestPage />
      case "job-logs":
        return <JobLogsPage />
      case "email-draft-test":
        return <EmailDraftTest />
      case "onboarding-test":
        return <OnboardingTest />
      case "onboarding-email-test":
        return <OnboardingEmailTest />
      case "payment-test":
        return <PaymentTestPage />
      default:
        return null
    }
  }

  // 현재 활성 탭의 라벨 가져오기
  const activeItemLabel =
    sidebarItems.find((item) => item.id === activeTab)?.label || t("settings.title")

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <button
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 cursor-default bg-black/50 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      )}

      {/* Sidebar - Hidden on mobile, visible on sm+ */}
      <div
        className={`fixed inset-y-0 left-0 z-50 h-full shrink-0 transform transition-transform duration-300 ease-in-out sm:relative sm:translate-x-0 sm:transform-none ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <SettingsSidebar
          activeItemId={activeTab}
          collapsed={isSettingsSidebarCollapsed}
          items={sidebarItems}
          onCollapsedChange={setIsSettingsSidebarCollapsed}
          onItemClick={(id) => {
            setActiveTab(id)
            // Close sidebar on mobile after selection
            setIsSidebarOpen(false)
          }}
        />
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Mobile Menu Button */}
              <Button
                className="sm:hidden"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                size="icon"
                variant="ghost"
              >
                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h1 className="font-semibold text-lg">{activeItemLabel}</h1>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">{renderContent()}</div>
        </div>
      </div>
    </div>
  )
}
