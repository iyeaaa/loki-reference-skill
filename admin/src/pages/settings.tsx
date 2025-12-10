import {
  Building2,
  Camera,
  FileText,
  Globe,
  Mail,
  Menu,
  Upload,
  User,
  Users,
  X,
} from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingsSidebar } from "@/components/ui/settings-sidebar"
import { useCurrentUser, useUpdateProfileMutation } from "@/lib/api/hooks/auth"
import EmailTemplatesPage from "./email-templates/EmailTemplatesPage"
import LeadImportPage from "./lead-import/index"
import { EmailSignatureManagement } from "./settings/EmailSignatureManagement"
import { WebDataExtraction } from "./settings/WebDataExtraction"
import UsersPage from "./users/UsersPage"
import WorkspacesPage from "./workspaces/WorkspacesPage"

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
    {
      id: "web-extraction",
      label: t("settings.system.webExtraction.title"),
      icon: <Globe className="h-4 w-4" />,
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
