import {
  Activity,
  Building2,
  Camera,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  ListTree,
  Mail,
  Menu,
  Package,
  Shield,
  ShieldCheck,
  Upload,
  User,
  UserCog,
  Users,
  X,
} from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingsSidebar } from "@/components/ui/settings-sidebar"
import { useCurrentUser, useUpdateProfileMutation } from "@/lib/api/hooks/auth"
import { useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import {
  IAM_ACTIONS,
  IAM_RESOURCES,
  type IamAction,
  type IamResource,
} from "@/lib/constants/iam-resources"
import { usePermissions } from "@/lib/permission"
import ActivityLogsPage from "./activity-logs"
import CompanyInformation from "./app/CompanyInformation"
import { CustomersPage, PlansPage, ProductsPage, SubscriptionsPage } from "./billing"
import EmailTemplatesPage from "./email-templates/EmailTemplatesPage"
import { AuditLogsPage, PoliciesPage, RolesPage, TierBoundariesPage } from "./iam"
import LeadImportPage from "./lead-import/index"
import { EmailSignatureManagement } from "./settings/EmailSignatureManagement"
import { NylasEmailTest } from "./settings/NylasEmailTest"
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
interface SettingsMenuItem {
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
  const [activeTab, setActiveTab] = useState("profile")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

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
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setPreviewImage(base64)
      setFormData((prev) => ({ ...prev, profilePicture: base64 }))
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
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)
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
        id: "signature",
        label: t("settings.signature.title"),
        icon: <Mail className="h-4 w-4" />,
        permission: { resource: IAM_RESOURCES.SETTINGS_PROFILE, action: IAM_ACTIONS.READ },
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
      {
        id: "email-templates",
        label: t("settings.system.emailTemplates.title"),
        icon: <FileText className="h-4 w-4" />,
        permission: "public", // 모든 사용자가 이메일 템플릿 확인 가능
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
      {
        id: "bulk-lead-import",
        label: t("settings.system.import.title"),
        icon: <Upload className="h-4 w-4" />,
        permission: { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.IMPORT },
      },
      {
        id: "web-extraction",
        label: t("settings.system.webExtraction.title"),
        icon: <Globe className="h-4 w-4" />,
        permission: "admin-only",
      },
      {
        id: "nylas-email-test",
        label: t("settings.nylasTest.title"),
        icon: <Mail className="h-4 w-4" />,
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
    ],
    [t],
  )

  /**
   * 권한에 따라 메뉴 필터링
   */
  const sidebarItems = useMemo(() => {
    // 권한 로딩 중이면 빈 배열 (깜박임 방지)
    if (permissionLoading) return []

    // 권한 체크 함수
    const canAccess = (item: SettingsMenuItem): boolean => {
      // header/separator는 별도 처리 (하위 항목이 있는지로 판단)
      if (item.type === "header" || item.type === "separator") {
        return true // 일단 통과, 나중에 빈 섹션 제거
      }

      // Admin은 모든 메뉴 접근 가능
      if (isSystemAdmin) return true

      // "admin-only" 권한인 경우
      if (item.permission === "admin-only") return false

      // "public" 또는 undefined는 모든 사용자 접근 가능
      if (!item.permission || item.permission === "public") return true

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
        <div className="flex-1 flex items-center justify-center">
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
              <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
                {/* Profile Picture Upload */}
                <div className="space-y-3">
                  <Label>{t("settings.profile.profilePicture")}</Label>
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <Avatar className="h-24 w-24 border-2 border-muted">
                        <AvatarImage src={previewImage || undefined} alt="Profile" />
                        <AvatarFallback className="text-2xl bg-muted">
                          {formData.username?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Camera className="h-6 w-6 text-white" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {t("settings.profile.uploadPhoto")}
                      </Button>
                      {previewImage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveImage}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4 mr-2" />
                          {t("settings.profile.removePhoto")}
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
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
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={emailId}>{t("settings.profile.email")}</Label>
                  <Input
                    id={emailId}
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending
                    ? t("settings.profile.saving")
                    : t("settings.profile.saveChanges")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )
      case "signature":
        return <EmailSignatureManagement />
      case "company-setup":
        return <CompanyInformation />
      case "workspace":
        return <WorkspacesPage />
      case "admin":
        return <UsersPage />
      case "email-templates":
        return <EmailTemplatesPage />
      case "bulk-lead-import":
        return <LeadImportPage />
      case "web-extraction":
        return <WebDataExtraction />
      case "nylas-email-test":
        return <NylasEmailTest />
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
      // Billing Pages
      case "billing-products":
        return <ProductsPage />
      case "billing-plans":
        return <PlansPage />
      case "billing-subscriptions":
        return <SubscriptionsPage />
      case "billing-customers":
        return <CustomersPage />
      default:
        return null
    }
  }

  // 현재 활성 탭의 라벨 가져오기
  const activeItemLabel =
    sidebarItems.find((item) => item.id === activeTab)?.label || t("settings.title")

  return (
    <div className="flex h-full overflow-hidden gap-4">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/50 z-40 sm:hidden cursor-default"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, visible on sm+ */}
      <div
        className={`
          fixed sm:relative inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          sm:transform-none sm:translate-x-0 shrink-0
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <SettingsSidebar
          items={sidebarItems}
          activeItemId={activeTab}
          onItemClick={(id) => {
            setActiveTab(id)
            // Close sidebar on mobile after selection
            setIsSidebarOpen(false)
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto min-w-0">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h1 className="text-lg font-semibold">{activeItemLabel}</h1>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">{renderContent()}</div>
        </div>
      </div>
    </div>
  )
}
