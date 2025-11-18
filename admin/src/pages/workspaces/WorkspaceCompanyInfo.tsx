import { Info, Loader2 } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useUpdateWorkspace, useWorkspace as useWorkspaceData } from "@/lib/api/hooks/workspaces"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/lib/hooks/useWorkspace"

export function WorkspaceCompanyInfo() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const workspaceId = selectedWorkspace?.id
  const { data: workspace, isLoading } = useWorkspaceData(
    workspaceId || "",
    !!workspaceId && workspaceId !== "all",
  )
  const updateWorkspace = useUpdateWorkspace()

  const companyNameId = useId()
  const companyWebsiteId = useId()
  const companyPhoneId = useId()
  const companySizeId = useId()
  const industryId = useId()
  const companyAddressId = useId()
  const companyDescriptionId = useId()
  // const targetAudiencesId = useId()
  // const expansionGoalsId = useId()
  // const competitiveAdvantagesId = useId()

  const [formData, setFormData] = useState({
    companyName: "",
    companyWebsite: "",
    companyPhone: "",
    companySize: "",
    industry: "",
    companyAddress: "",
    companyDescription: "",
    // targetAudiences: [] as string[],
    // expansionGoals: [] as string[],
    // competitiveAdvantages: [] as string[],
  })

  const [hasChanges, setHasChanges] = useState(false)

  // Update form data when workspace data is loaded
  useEffect(() => {
    if (workspace?.id) {
      setFormData({
        companyName: workspace.companyName || "",
        companyWebsite: workspace.companyWebsite || "",
        companyPhone: workspace.companyPhone || "",
        companySize: workspace.companySize || "",
        industry: workspace.industry || "",
        companyAddress: workspace.companyAddress || "",
        companyDescription: workspace.companyDescription || "",
        // targetAudiences: workspace.targetAudiences || [],
        // expansionGoals: workspace.expansionGoals || [],
        // competitiveAdvantages: workspace.competitiveAdvantages || [],
      })
      setHasChanges(false)
    }
  }, [workspace])

  // Don't render if no workspace is selected or "all" is selected
  if (!workspaceId || workspaceId === "all") {
    return null
  }

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!workspace) {
    return null
  }

  const handleChange = (field: keyof typeof formData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  // const handleArrayChange = (field: keyof typeof formData, value: string) => {
  //   // Convert comma-separated string to array
  //   const arrayValue = value
  //     .split(",")
  //     .map((item) => item.trim())
  //     .filter((item) => item.length > 0)
  //   handleChange(field, arrayValue)
  // }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!workspaceId) return

    try {
      await updateWorkspace.mutateAsync({
        workspaceId: workspaceId,
        data: {
          name: workspace.name, // Required field
          isActive: workspace.isActive, // Required field
          ...formData,
        },
      })
      toast.success(t("settings.workspace.updateSuccess"))
      setHasChanges(false)
    } catch (error) {
      toast.error(t("settings.workspace.updateError"))
      console.error("Failed to update workspace:", error)
    }
  }

  const handleReset = () => {
    if (workspace) {
      setFormData({
        companyName: workspace.companyName || "",
        companyWebsite: workspace.companyWebsite || "",
        companyPhone: workspace.companyPhone || "",
        companySize: workspace.companySize || "",
        industry: workspace.industry || "",
        companyAddress: workspace.companyAddress || "",
        companyDescription: workspace.companyDescription || "",
        // targetAudiences: workspace.targetAudiences || [],
        // expansionGoals: workspace.expansionGoals || [],
        // competitiveAdvantages: workspace.competitiveAdvantages || [],
      })
      setHasChanges(false)
    }
  }

  return (
    <TooltipProvider>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("settings.workspace.title")}</CardTitle>
          <CardDescription>
            {t("settings.workspace.descriptionFor", { name: workspace.name })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor={companyNameId}>{t("settings.workspace.companyName")}</Label>
                <Input
                  id={companyNameId}
                  value={formData.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                  placeholder={t("settings.workspace.companyNamePlaceholder")}
                />
              </div>

              {/* Company Website */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor={companyWebsiteId}>{t("settings.workspace.website")}</Label>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-accent text-accent-foreground px-4 py-2.5 text-sm max-w-xs">
                      <p>Changing the website URL will trigger the enrichment agent internally</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id={companyWebsiteId}
                  // type="url"
                  value={formData.companyWebsite}
                  onChange={(e) => handleChange("companyWebsite", e.target.value)}
                  placeholder={t("settings.workspace.companyWebsitePlaceholder")}
                />
              </div>

              {/* Company Phone */}
              <div className="space-y-2">
                <Label htmlFor={companyPhoneId}>{t("settings.workspace.phoneNumber")}</Label>
                <Input
                  id={companyPhoneId}
                  type="tel"
                  value={formData.companyPhone}
                  onChange={(e) => handleChange("companyPhone", e.target.value)}
                  placeholder={t("settings.workspace.companyPhonePlaceholder")}
                />
              </div>

              {/* Company Size */}
              {/* <div className="space-y-2">
              <Label htmlFor="companySize">{t("settings.workspace.companySize")}</Label>
              <Select
                value={formData.companySize}
                onValueChange={(value) => handleChange("companySize", value)}
              >
                <SelectTrigger id="companySize">
                  <SelectValue placeholder={formData.companySize !== "" ? formData.companySize : t("settings.workspaces.form.selectCompanySize")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">{t("settings.workspaces.form.size_1_10")}</SelectItem>
                  <SelectItem value="11-50">{t("settings.workspaces.form.size_11_50")}</SelectItem>
                  <SelectItem value="51-200">{t("settings.workspaces.form.size_51_200")}</SelectItem>
                  <SelectItem value="201-500">{t("settings.workspaces.form.size_201_500")}</SelectItem>
                  <SelectItem value="501-1000">{t("settings.workspaces.form.size_501_1000")}</SelectItem>
                  <SelectItem value="1001+">{t("settings.workspaces.form.size_1001_plus")}</SelectItem>
                </SelectContent>
              </Select>
            </div> */}

              <div className="space-y-2">
                <Label htmlFor={companySizeId}>{t("settings.workspace.companySize")}</Label>
                <Input
                  id={companySizeId}
                  value={formData.companySize}
                  onChange={(e) => handleChange("companySize", e.target.value)}
                  placeholder={t("settings.workspace.companySizePlaceholder")}
                />
              </div>

              {/* Industry */}
              <div className="space-y-2">
                <Label htmlFor={industryId}>{t("settings.workspace.industry")}</Label>
                <Input
                  id={industryId}
                  value={formData.industry}
                  onChange={(e) => handleChange("industry", e.target.value)}
                  placeholder={t("settings.workspace.industryPlaceholder")}
                />
              </div>
            </div>

            {/* Company Address */}
            <div className="space-y-2">
              <Label htmlFor={companyAddressId}>{t("settings.workspace.address")}</Label>
              <Input
                id={companyAddressId}
                value={formData.companyAddress}
                onChange={(e) => handleChange("companyAddress", e.target.value)}
                placeholder={t("settings.workspace.companyAddressPlaceholder")}
              />
            </div>

            {/* Company Description */}
            <div className="space-y-2">
              <Label htmlFor={companyDescriptionId}>
                {t("settings.workspace.companyDescription")}
              </Label>
              <Textarea
                id={companyDescriptionId}
                value={formData.companyDescription}
                onChange={(e) => handleChange("companyDescription", e.target.value)}
                placeholder={t("settings.workspace.companyDescriptionPlaceholder")}
                rows={4}
              />
            </div>

            {/* Target Audiences */}
            {/* <div className="space-y-2">
            <Label htmlFor={targetAudiencesId}>
              {t("settings.workspace.targetAudiences")}
            </Label>
            <Textarea
              id={targetAudiencesId}
              value={formData.targetAudiences.join(", ")}
              onChange={(e) => handleArrayChange("targetAudiences", e.target.value)}
              placeholder={t("settings.workspace.targetAudiencesPlaceholder")}
              rows={3}
            />
          </div> */}

            {/* Expansion Goals */}
            {/* <div className="space-y-2">
            <Label htmlFor={expansionGoalsId}>
              {t("settings.workspace.expansionGoals")}
            </Label>
            <Textarea
              id={expansionGoalsId}
              value={formData.expansionGoals.join(", ")}
              onChange={(e) => handleArrayChange("expansionGoals", e.target.value)}
              placeholder={t("settings.workspace.expansionGoalsPlaceholder")}
              rows={3}
            />
          </div> */}

            {/* Competitive Advantages */}
            {/* <div className="space-y-2">
            <Label htmlFor={competitiveAdvantagesId}>
              {t("settings.workspace.competitiveAdvantages")}
            </Label>
            <Textarea
              id={competitiveAdvantagesId}
              value={formData.competitiveAdvantages.join(", ")}
              onChange={(e) => handleArrayChange("competitiveAdvantages", e.target.value)}
              placeholder={t("settings.workspace.competitiveAdvantagesPlaceholder")}
              rows={3}
            />
          </div> */}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges || updateWorkspace.isPending}
              >
                {t("settings.workspace.cancel")}
              </Button>
              <Button type="submit" disabled={!hasChanges || updateWorkspace.isPending}>
                {updateWorkspace.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("settings.workspace.saving")}
                  </>
                ) : (
                  t("settings.workspace.save")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
