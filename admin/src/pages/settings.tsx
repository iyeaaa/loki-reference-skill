import { Building2, FileText, FileUp, Settings as SettingsIcon, User, Users } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCurrentUser, useUpdateProfileMutation } from "@/lib/api/hooks/auth"

export default function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const nameId = useId()
  const emailId = useId()
  const employeeIdInput = useId()

  const { data: currentUser, isLoading } = useCurrentUser()
  const updateProfileMutation = useUpdateProfileMutation()

  const systemManagementItems = [
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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
          </div>
          <LanguageSwitcher />
        </div>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="space-y-6">
        {/* 프로필 설정 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>{t("settings.profile.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:border-violet-500"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="rounded-lg bg-violet-100 dark:bg-violet-900/20 p-2">
                      <item.icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
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
