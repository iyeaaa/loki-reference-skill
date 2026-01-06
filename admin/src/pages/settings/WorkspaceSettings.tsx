import { Building2, Loader2 } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  useEnrichWorkspace,
  useTranslateCompanyName,
  useUpdateWorkspace,
  useWorkspace,
} from "@/lib/api/hooks/workspaces"

type WorkspaceSettingsProps = {
  workspaceId: string
}

export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  const { t } = useTranslation()
  const companyNameId = useId()
  const companyWebsiteId = useId()
  const companyPhoneId = useId()
  const industryId = useId()
  const companySizeId = useId()
  const companyAddressId = useId()
  const companyDescriptionId = useId()

  const { data: workspace, isLoading } = useWorkspace(workspaceId)
  const updateWorkspaceMutation = useUpdateWorkspace()
  const enrichWorkspace = useEnrichWorkspace()
  const translateMutation = useTranslateCompanyName()

  const [formData, setFormData] = useState({
    companyName: "",
    companyNameEn: "",
    companyWebsite: "",
    companyPhone: "",
    industry: "",
    companySize: "",
    companyAddress: "",
    companyDescription: "",
  })

  // Load workspace data
  useEffect(() => {
    if (workspace) {
      setFormData({
        companyName: workspace.companyName || "",
        companyNameEn: workspace.companyNameEn || "",
        companyWebsite: workspace.companyWebsite || "",
        companyPhone: workspace.companyPhone || "",
        industry: workspace.industry || "",
        companySize: workspace.companySize || "",
        companyAddress: workspace.companyAddress || "",
        companyDescription: workspace.companyDescription || "",
      })
    }
  }, [workspace])

  // Auto-translate company name with debounce
  useEffect(() => {
    if (!formData.companyName || formData.companyName.trim() === "") {
      return
    }

    const timer = setTimeout(() => {
      translateMutation.mutate(
        {
          companyName: formData.companyName,
          targetLanguage: "English",
        },
        {
          onSuccess: (translatedName) => {
            console.log("[Translation] Success:", translatedName)
            setFormData((prev) => ({
              ...prev,
              companyNameEn: translatedName,
            }))
          },
          onError: (error) => {
            console.error("[Translation] Failed:", error)
          },
        },
      )
    }, 2000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.companyName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspace) {
      return
    }

    const websiteChanged = formData.companyWebsite !== (workspace.companyWebsite || "")

    await updateWorkspaceMutation.mutateAsync({
      workspaceId: workspace.id,
      data: {
        name: workspace.name,
        description: workspace.description,
        isActive: workspace.isActive,
        companyName: formData.companyName || undefined,
        companyNameEn: formData.companyNameEn || undefined,
        companyWebsite: formData.companyWebsite || undefined,
        companyPhone: formData.companyPhone || undefined,
        industry: formData.industry || undefined,
        companySize: formData.companySize || undefined,
        companyAddress: formData.companyAddress || undefined,
        companyDescription: formData.companyDescription || undefined,
      },
    })

    // Trigger enrichment if website changed
    if (websiteChanged && formData.companyWebsite) {
      const websiteUrl = formData.companyWebsite.startsWith("http")
        ? formData.companyWebsite
        : `https://${formData.companyWebsite}`

      enrichWorkspace.mutate({
        workspaceId: workspace.id,
        websiteUrl,
      })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">{t("common.loading")}</div>
        </CardContent>
      </Card>
    )
  }

  if (!workspace) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          <CardTitle className="text-base">{t("settings.workspace.title")}</CardTitle>
        </div>
        <CardDescription className="text-xs">{t("settings.workspace.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={companyNameId}>{t("settings.workspace.companyName")}</Label>
              <Input
                id={companyNameId}
                name="companyName"
                onChange={handleChange}
                placeholder="Acme Corporation"
                value={formData.companyName}
              />
            </div>

            <div className="space-y-2">
              <Label>
                {t("settings.workspace.companyNameEn", "Company Name (English)")}
                <span className="ml-2 text-gray-500 text-xs">
                  ({t("settings.workspace.optional", "Optional")})
                </span>
              </Label>
              <div className="relative">
                <Input
                  name="companyNameEn"
                  onChange={handleChange}
                  placeholder="e.g., Acme Corporation"
                  value={formData.companyNameEn}
                />
                {translateMutation.isPending && (
                  <Loader2 className="absolute top-3 right-3 h-4 w-4 animate-spin text-blue-500" />
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={companyWebsiteId}>{t("settings.workspace.companyWebsite")}</Label>
              <Input
                id={companyWebsiteId}
                name="companyWebsite"
                onChange={handleChange}
                placeholder="https://example.com"
                type="url"
                value={formData.companyWebsite}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companyPhoneId}>{t("settings.workspace.companyPhone")}</Label>
              <Input
                id={companyPhoneId}
                name="companyPhone"
                onChange={handleChange}
                placeholder="+1-555-0123"
                type="tel"
                value={formData.companyPhone}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={industryId}>{t("settings.workspace.industry")}</Label>
              <Input
                id={industryId}
                name="industry"
                onChange={handleChange}
                placeholder="Technology"
                value={formData.industry}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companySizeId}>{t("settings.workspace.companySize")}</Label>
              <Input
                id={companySizeId}
                name="companySize"
                onChange={handleChange}
                placeholder="50-100 employees"
                value={formData.companySize}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyAddressId}>{t("settings.workspace.companyAddress")}</Label>
            <Input
              id={companyAddressId}
              name="companyAddress"
              onChange={handleChange}
              placeholder="123 Main Street, City, Country"
              value={formData.companyAddress}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyDescriptionId}>
              {t("settings.workspace.companyDescription")}
            </Label>
            <Textarea
              id={companyDescriptionId}
              name="companyDescription"
              onChange={handleChange}
              placeholder="Brief description of your company..."
              rows={4}
              value={formData.companyDescription}
            />
          </div>

          <Button disabled={updateWorkspaceMutation.isPending} type="submit">
            {updateWorkspaceMutation.isPending
              ? t("settings.workspace.saving")
              : t("settings.workspace.saveChanges")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
