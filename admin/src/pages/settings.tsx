import {
  Building2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Mail,
  Menu,
  Upload,
  User,
  Users,
  X,
} from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingsSidebar } from "@/components/ui/settings-sidebar"
import { useCurrentUser, useUpdateProfileMutation } from "@/lib/api/hooks/auth"
import { EmailSignatureManagement } from "./settings/EmailSignatureManagement"
import { WorkspaceSettings } from "./settings/WorkspaceSettings"

export default function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const nameId = useId()
  const emailId = useId()
  const employeeIdInput = useId()

  const { data: currentUser, isLoading } = useCurrentUser()
  const updateProfileMutation = useUpdateProfileMutation()
  const [activeTab, setActiveTab] = useState("profile")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Get selected workspace from localStorage
  const selectedWorkspace = localStorage.getItem("selectedWorkspace") || "all"
  const showWorkspaceSettings = selectedWorkspace && selectedWorkspace !== "all"

  const systemManagementItems = [
    {
      title: "웹 데이터 추출",
      description: "웹사이트에서 회사 정보 및 연락처를 자동으로 추출합니다",
      url: "/settings/web-extraction",
      iconImage: "/images/web-extraction-logo.webp",
    },
    {
      title: t("settings.system.workspaces.title"),
      description: t("settings.system.workspaces.desc"),
      url: "/workspaces",
      icon: Building2,
    },
    {
      title: t("settings.system.users.title"),
      description: t("settings.system.users.desc"),
      url: "/users",
      icon: Users,
    },
    {
      title: t("settings.system.emailTemplates.title"),
      description: t("settings.system.emailTemplates.desc"),
      url: "/email-templates",
      icon: FileText,
    },
    {
      title: t("settings.system.import.title"),
      description: t("settings.system.import.desc"),
      url: "/lead-import",
      icon: FileUp,
    },
    {
      title: t("settings.system.bulkEmailCSV.title"),
      description: t("settings.system.bulkEmailCSV.desc"),
      url: "/bulk-email-csv",
      icon: FileSpreadsheet,
    },
  ]

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    employeeId: "",
  })

  // Load current user data
  useEffect(() => {
    if (currentUser) {
      setFormData({
        username: currentUser.username || "",
        email: currentUser.email || "",
        employeeId: currentUser.employeeId || "",
      })
    }
  }, [currentUser])

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

  const sidebarItems = [
    {
      id: "profile",
      label: t("settings.profile.title"),
      icon: <User className="h-4 w-4" />,
    },
    {
      id: "signature",
      label: t("settings.signature.title"),
      icon: <Mail className="h-4 w-4" />,
    },
    {
      id: "workspace",
      label: t("settings.system.workspaces.title"),
      icon: <Building2 className="h-4 w-4" />,
      onClick: () => navigate("/workspaces"),
    },
    {
      id: "admin",
      label: t("settings.system.users.title"),
      icon: <Users className="h-4 w-4" />,
      onClick: () => navigate("/users"),
    },
    {
      id: "email-templates",
      label: t("settings.system.emailTemplates.title"),
      icon: <FileText className="h-4 w-4" />,
      onClick: () => navigate("/email-templates"),
    },
    {
      id: "bulk-lead-import",
      label: t("settings.system.import.title"),
      icon: <Upload className="h-4 w-4" />,
      onClick: () => navigate("/lead-import"),
    },
  ]

  if (isLoading) {
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
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <CardTitle>{t("settings.profile.title")}</CardTitle>
              </div>
              <CardDescription>{t("settings.profile.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
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
                <div className="space-y-2">
                  <Label htmlFor={employeeIdInput}>{t("settings.profile.employeeId")}</Label>
                  <Input
                    id={employeeIdInput}
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={handleChange}
                    placeholder="EMP001"
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
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden cursor-default"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, visible on lg+ */}
      <div
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          lg:transform-none
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <SettingsSidebar
          title={t("settings.title")}
          subtitle={t("settings.subtitle")}
          items={sidebarItems}
          activeItemId={activeTab}
          onItemClick={(id) => {
            // Only set active tab for profile and signature
            // Other items will navigate via their onClick handlers
            if (id === "profile" || id === "signature") {
              setActiveTab(id)
            }
            // Close sidebar on mobile after selection
            setIsSidebarOpen(false)
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="h-full flex flex-col">
          <div className="p-6 pb-0 flex items-center justify-between lg:justify-end">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <LanguageSwitcher />
          </div>

          <div className="flex-1 p-6">{renderContent()}</div>
        </div>
        {/* 워크스페이스 설정 (특정 워크스페이스 선택 시에만 표시) */}
        {showWorkspaceSettings && <WorkspaceSettings workspaceId={selectedWorkspace} />}

        {/* 이메일 서명 관리 */}
        <EmailSignatureManagement />

        {/* 시스템 관리 */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.system.title")}</CardTitle>
            <CardDescription>{t("settings.system.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {systemManagementItems.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => navigate(item.url)}
                  className="flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:border-[#2563EB]"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="rounded-lg bg-violet-100 dark:bg-violet-900/20 p-2">
                      {"iconImage" in item ? (
                        <img
                          src={item.iconImage}
                          alt={item.title}
                          className="h-5 w-5 object-contain"
                        />
                      ) : (
                        <item.icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
