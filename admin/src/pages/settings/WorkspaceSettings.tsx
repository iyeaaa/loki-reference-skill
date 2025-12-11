import { Building2 } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useEnrichWorkspace, useUpdateWorkspace, useWorkspace } from "@/lib/api/hooks/workspaces"

interface WorkspaceSettingsProps {
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

  const [formData, setFormData] = useState({
    companyName: "",
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
        companyWebsite: workspace.companyWebsite || "",
        companyPhone: workspace.companyPhone || "",
        industry: workspace.industry || "",
        companySize: workspace.companySize || "",
        companyAddress: workspace.companyAddress || "",
        companyDescription: workspace.companyDescription || "",
      })
    }
  }, [workspace])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspace) return

    const websiteChanged = formData.companyWebsite !== (workspace.companyWebsite || "")

    await updateWorkspaceMutation.mutateAsync({
      workspaceId: workspace.id,
      data: {
        name: workspace.name,
        description: workspace.description,
        isActive: workspace.isActive,
        companyName: formData.companyName || undefined,
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
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <CardTitle>{t("settings.workspace.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.workspace.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={companyNameId}>{t("settings.workspace.companyName")}</Label>
              <Input
                id={companyNameId}
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Acme Corporation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companyWebsiteId}>{t("settings.workspace.companyWebsite")}</Label>
              <Input
                id={companyWebsiteId}
                name="companyWebsite"
                type="url"
                value={formData.companyWebsite}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companyPhoneId}>{t("settings.workspace.companyPhone")}</Label>
              <Input
                id={companyPhoneId}
                name="companyPhone"
                type="tel"
                value={formData.companyPhone}
                onChange={handleChange}
                placeholder="+1-555-0123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={industryId}>{t("settings.workspace.industry")}</Label>
              <Input
                id={industryId}
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                placeholder="Technology"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={companySizeId}>{t("settings.workspace.companySize")}</Label>
              <Input
                id={companySizeId}
                name="companySize"
                value={formData.companySize}
                onChange={handleChange}
                placeholder="50-100 employees"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyAddressId}>{t("settings.workspace.companyAddress")}</Label>
            <Input
              id={companyAddressId}
              name="companyAddress"
              value={formData.companyAddress}
              onChange={handleChange}
              placeholder="123 Main Street, City, Country"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyDescriptionId}>
              {t("settings.workspace.companyDescription")}
            </Label>
            <Textarea
              id={companyDescriptionId}
              name="companyDescription"
              value={formData.companyDescription}
              onChange={handleChange}
              placeholder="Brief description of your company..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={updateWorkspaceMutation.isPending}>
            {updateWorkspaceMutation.isPending
              ? t("settings.workspace.saving")
              : t("settings.workspace.saveChanges")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
