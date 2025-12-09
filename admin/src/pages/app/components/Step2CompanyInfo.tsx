import { ArrowRight, FileText, Loader2 } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  useEnrichWorkspace,
  useUpdateWorkspace,
  useUserWorkspaces,
} from "@/lib/api/hooks/workspaces"

interface CompanyFormData {
  websiteUrl: string
  companyName: string
  products: string
  aboutCompany: string
}

export function Step2CompanyInfo() {
  const { t } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [isAutofilling, setIsAutofilling] = useState(false)

  // Generate unique IDs for form fields
  const websiteUrlId = useId()
  const companyNameId = useId()
  const productsId = useId()
  const aboutCompanyId = useId()

  const [formData, setFormData] = useState<CompanyFormData>({
    websiteUrl: "",
    companyName: "",
    products: "",
    aboutCompany: "",
  })

  // Get user's workspace
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""
  const { data: userWorkspaces, isLoading: isLoadingWorkspaces } = useUserWorkspaces(
    userId,
    !!userId,
  )

  // Get the first workspace (trial users have one workspace)
  const workspace = userWorkspaces?.[0]

  // Mutations
  const updateWorkspace = useUpdateWorkspace()
  const enrichWorkspace = useEnrichWorkspace()

  const handleInputChange = (field: keyof CompanyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAutofill = async () => {
    if (!formData.websiteUrl) return

    setIsAutofilling(true)
    // TODO: Implement backend autofill from website
    // For now, just simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsAutofilling(false)
  }

  const handleNextStep = async () => {
    if (!workspace) {
      toast.error("워크스페이스를 찾을 수 없습니다.")
      return
    }

    try {
      // 1. Update workspace data
      await updateWorkspace.mutateAsync({
        workspaceId: workspace.id,
        data: {
          name: workspace.name,
          isActive: workspace.isActive,
          companyWebsite: formData.websiteUrl || undefined,
          companyName: formData.companyName || undefined,
          companyDescription: formData.aboutCompany || undefined,
          // Note: products field will be handled separately later
        },
      })

      // 2. Trigger enrichment if website URL provided (fire-and-forget)
      if (formData.websiteUrl) {
        const websiteUrl = formData.websiteUrl.startsWith("http")
          ? formData.websiteUrl
          : `https://${formData.websiteUrl}`

        enrichWorkspace.mutate({
          workspaceId: workspace.id,
          websiteUrl,
        })
      }

      setSearchParams({ step: "3" })
    } catch (error) {
      console.error("Failed to save company info:", error)
      // Error toast is handled by the mutation hook
    }
  }

  const isFormValid = formData.companyName.trim() && formData.products.trim()
  const isSubmitting = updateWorkspace.isPending

  if (isLoadingWorkspaces) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 pb-6 px-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-6 pb-6 px-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t("app.onboarding.step2.title", "Please tell me your company information")}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {t(
                "app.onboarding.step2.description",
                "RINDA uses it to create customized sales messages.",
              )}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Website URL with Autofill */}
          <div className="space-y-1.5">
            <Label htmlFor={websiteUrlId} className="text-sm">
              {t("app.onboarding.step2.websiteLabel", "Website address")}
            </Label>
            <div className="flex gap-2">
              <Input
                id={websiteUrlId}
                type="url"
                placeholder="https://example.com"
                value={formData.websiteUrl}
                onChange={(e) => handleInputChange("websiteUrl", e.target.value)}
                className="flex-1 h-9"
              />
              <Button
                type="button"
                onClick={handleAutofill}
                disabled={!formData.websiteUrl || isAutofilling}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 h-9 text-sm"
              >
                {isAutofilling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("app.onboarding.step2.autofill", "Autofill")
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              {t(
                "app.onboarding.step2.websiteHint",
                "We analyze your website and automatically fill in the information.",
              )}
            </p>
          </div>

          {/* Company Name */}
          <div className="space-y-1.5">
            <Label htmlFor={companyNameId} className="text-sm">
              {t("app.onboarding.step2.companyNameLabel", "Company name")}
            </Label>
            <Input
              id={companyNameId}
              placeholder={t(
                "app.onboarding.step2.companyNamePlaceholder",
                "Example: Tech Solution Co., Ltd.",
              )}
              value={formData.companyName}
              onChange={(e) => handleInputChange("companyName", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Products/Services */}
          <div className="space-y-1.5">
            <Label htmlFor={productsId} className="text-sm">
              {t("app.onboarding.step2.productsLabel", "Products/Services for Sale")}
            </Label>
            <Input
              id={productsId}
              placeholder={t(
                "app.onboarding.step2.productsPlaceholder",
                "Example: Industrial IoT sensors",
              )}
              value={formData.products}
              onChange={(e) => handleInputChange("products", e.target.value)}
              className="h-9"
            />
          </div>

          {/* About Company */}
          <div className="space-y-1.5">
            <Label htmlFor={aboutCompanyId} className="text-sm">
              {t("app.onboarding.step2.aboutLabel", "About the company")}
            </Label>
            <Textarea
              id={aboutCompanyId}
              placeholder={t(
                "app.onboarding.step2.aboutPlaceholder",
                "Please feel free to write about what you would like to introduce to overseas buyers.",
              )}
              value={formData.aboutCompany}
              onChange={(e) => handleInputChange("aboutCompany", e.target.value)}
              className="min-h-[80px] resize-y text-sm"
            />
          </div>
        </div>

        {/* Next Step Button */}
        <Button
          onClick={handleNextStep}
          disabled={!isFormValid || isSubmitting}
          className="w-full mt-5 bg-blue-400 hover:bg-blue-500 text-white h-10"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("app.onboarding.step2.saving", "Saving...")}
            </>
          ) : (
            <>
              {t("app.onboarding.step2.nextButton", "Next step")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
