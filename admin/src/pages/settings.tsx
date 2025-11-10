import { Building2, FileText, Mail, Menu, Upload, User, Users, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingsSidebar } from "@/components/ui/settings-sidebar"
import { useCurrentUser, useUpdateProfileMutation } from "@/lib/api/hooks/auth"
import EmailTemplatesPage from "./email-templates/EmailTemplatesPage"
import LeadImportPage from "./lead-import/index"
import { EmailSignatureManagement } from "./settings/EmailSignatureManagement"
import UsersPage from "./users/UsersPage"
import WorkspacesPage from "./workspaces/WorkspacesPage"

export default function SettingsPage() {
  const { t } = useTranslation()
  const nameId = useId()
  const emailId = useId()
  const employeeIdInput = useId()

  const { data: currentUser, isLoading } = useCurrentUser()
  const updateProfileMutation = useUpdateProfileMutation()
  const [activeTab, setActiveTab] = useState("profile")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

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
    },
    {
      id: "admin",
      label: t("settings.system.users.title"),
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "email-templates",
      label: t("settings.system.emailTemplates.title"),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: "bulk-lead-import",
      label: t("settings.system.import.title"),
      icon: <Upload className="h-4 w-4" />,
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
      case "workspace":
        return <WorkspacesPage />
      case "admin":
        return <UsersPage />
      case "email-templates":
        return <EmailTemplatesPage />
      case "bulk-lead-import":
        return <LeadImportPage />
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
            setActiveTab(id)
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
      </div>
    </div>
  )
}
