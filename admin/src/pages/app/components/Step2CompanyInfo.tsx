import { ArrowRight, Check, FileText, Loader2 } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateWorkspace, useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { streamEnrichAndStrategize } from "@/lib/api/services/workspaces"
import { cn } from "@/lib/utils"

interface CompanyFormData {
  websiteUrl: string
  companyName: string
  products: string
  aboutCompany: string
}

// Progress step configuration
const PROGRESS_STEPS = [
  { id: "starting", label: "Starting analysis" },
  { id: "researching", label: "Researching company" },
  { id: "extracting_company", label: "Extracting company info" },
  { id: "extracting_market", label: "Analyzing markets" },
  { id: "merging", label: "Processing data" },
  { id: "saving", label: "Saving results" },
  { id: "strategizing", label: "Generating strategies" },
] as const

type ProgressStepId = (typeof PROGRESS_STEPS)[number]["id"]

// localStorage keys for tracking enrichment state per workspace
const getEnrichmentStatusKey = (workspaceId: string) => `enrichment_status_${workspaceId}`
const getEnrichmentStepKey = (workspaceId: string) => `enrichment_step_${workspaceId}`

type EnrichmentStatus = "completed" | "ongoing"

export function Step2CompanyInfo() {
  const { t } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [isAutofilling, setIsAutofilling] = useState(false)

  // Progress state
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStep, setCurrentStep] = useState<ProgressStepId | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<ProgressStepId>>(new Set())
  const [hasEnrichmentStatus, setHasEnrichmentStatus] = useState(false)
  const abortRef = useRef<(() => void) | null>(null)

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current()
      }
    }
  }, [])

  // Initialize form with workspace data
  useEffect(() => {
    if (!workspace) return

    setFormData((prev) => ({
      ...prev,
      websiteUrl: workspace.companyWebsite || prev.websiteUrl,
      companyName: workspace.companyName || prev.companyName,
      aboutCompany: workspace.companyDescription || prev.aboutCompany,
    }))
  }, [workspace])

  const handleInputChange = (field: keyof CompanyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAutofill = async () => {
    if (!formData.websiteUrl) return

    setIsAutofilling(true)
    await handleNextStep()
    setIsAutofilling(false)
  }

  const handleProgressStep = useCallback(
    (step: string, _message: string) => {
      const stepId = step as ProgressStepId

      // Save current step to localStorage
      if (workspace) {
        localStorage.setItem(getEnrichmentStepKey(workspace.id), stepId)
      }

      // Mark previous step as completed
      setCurrentStep((prev) => {
        if (prev && prev !== stepId) {
          setCompletedSteps((set) => new Set([...set, prev]))
        }
        return stepId
      })
    },
    [workspace],
  )

  // Check if enrichment was already completed or ongoing for this workspace
  useEffect(() => {
    if (!workspace) return

    const statusKey = getEnrichmentStatusKey(workspace.id)
    const stepKey = getEnrichmentStepKey(workspace.id)
    const status = localStorage.getItem(statusKey) as EnrichmentStatus | null
    const savedStep = localStorage.getItem(stepKey) as ProgressStepId | null

    // Track if there's any enrichment status for showing "View Progress" button
    setHasEnrichmentStatus(
      status === "completed" ||
        status === "ongoing" ||
        status === "researching" ||
        savedStep === "researching",
    )

    if (status === "completed") {
      // Show all steps as completed
      setIsStreaming(true)
      setCompletedSteps(new Set(PROGRESS_STEPS.map((s) => s.id)))
      setCurrentStep(null)
    } else if (status === "ongoing") {
      // Restore progress state from localStorage
      setIsStreaming(true)
      if (savedStep) {
        // Mark all steps before the saved step as completed
        const stepIndex = PROGRESS_STEPS.findIndex((s) => s.id === savedStep)
        if (stepIndex > 0) {
          const completedIds = PROGRESS_STEPS.slice(0, stepIndex).map((s) => s.id)
          setCompletedSteps(new Set(completedIds))
        }
        setCurrentStep(savedStep)
      }
    }
  }, [workspace])

  const handleNextStep = async () => {
    if (!workspace) {
      toast.error("워크스페이스를 찾을 수 없습니다.")
      return
    }

    try {
      // 1. Update workspace data first
      await updateWorkspace.mutateAsync({
        workspaceId: workspace.id,
        data: {
          name: workspace.name,
          isActive: workspace.isActive,
          companyWebsite: formData.websiteUrl || undefined,
          companyName: formData.companyName || undefined,
          companyDescription: formData.aboutCompany || undefined,
        },
      })

      // 2. If website URL provided, start streaming enrichment
      if (formData.websiteUrl) {
        const websiteUrl = formData.websiteUrl.startsWith("http")
          ? formData.websiteUrl
          : `https://${formData.websiteUrl}`

        const statusKey = getEnrichmentStatusKey(workspace.id)
        const stepKey = getEnrichmentStepKey(workspace.id)

        // Clear previous enrichment state and mark as ongoing
        localStorage.removeItem(stepKey)
        localStorage.setItem(statusKey, "ongoing")

        setIsStreaming(true)
        setCurrentStep(null)
        setCompletedSteps(new Set())

        abortRef.current = streamEnrichAndStrategize(workspace.id, websiteUrl, {
          onProgress: (event) => {
            handleProgressStep(event.step, event.message)
          },
          onDone: (event) => {
            // Mark enrichment as completed
            localStorage.setItem(statusKey, "completed")

            // Mark all steps as completed
            setCompletedSteps(new Set(PROGRESS_STEPS.map((s) => s.id)))
            setCurrentStep(null)

            // Small delay to show completion state
            setTimeout(() => {
              setIsStreaming(false)
              // Store strategies in sessionStorage for Step 3
              if (event.strategies) {
                sessionStorage.setItem("onboarding_strategies", JSON.stringify(event.strategies))
              }
              setSearchParams({ step: "3" })
            }, 500)
          },
          onError: (event) => {
            // Clear enrichment status so user can retry
            localStorage.removeItem(statusKey)
            setIsStreaming(false)
            toast.error(event.message || "회사 분석 중 오류가 발생했습니다.")
          },
        })
      }
    } catch (error) {
      console.error("Failed to save company info:", error)
      // Error toast is handled by the mutation hook
    }
  }

  const isFormValid = formData.companyName.trim() && formData.products.trim()
  const isSubmitting = updateWorkspace.isPending || isStreaming

  if (isLoadingWorkspaces) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 pb-6 px-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  // Check if all steps are completed
  const isAllCompleted = completedSteps.size === PROGRESS_STEPS.length

  // Show progress view when streaming
  if (isStreaming) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Header */}
          <div className="flex items-start gap-3 mb-6">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                isAllCompleted ? "bg-green-50" : "bg-blue-50",
              )}
            >
              {isAllCompleted ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isAllCompleted
                  ? t("app.onboarding.step2.analysisComplete", "Analysis complete!")
                  : t("app.onboarding.step2.analyzing", "Analyzing your company...")}
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                {isAllCompleted
                  ? t(
                      "app.onboarding.step2.analysisCompleteDescription",
                      "Your company analysis is ready. Proceed to the next step.",
                    )
                  : t(
                      "app.onboarding.step2.analyzingDescription",
                      "We're researching your company and generating sales strategies.",
                    )}
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3">
            {PROGRESS_STEPS.map((step, index) => {
              const isCompleted = completedSteps.has(step.id)
              const isCurrent = currentStep === step.id
              const isPending = !isCompleted && !isCurrent

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-colors",
                    isCompleted && "bg-green-50",
                    isCurrent && "bg-blue-50",
                    isPending && "bg-gray-50 opacity-50",
                  )}
                >
                  {/* Step indicator */}
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                      isCompleted && "bg-green-500",
                      isCurrent && "bg-blue-500",
                      isPending && "bg-gray-300",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3 h-3 text-white animate-spin" />
                    ) : (
                      <span className="text-xs text-white font-medium">{index + 1}</span>
                    )}
                  </div>

                  {/* Step label */}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isCompleted && "text-green-700",
                      isCurrent && "text-blue-700",
                      isPending && "text-gray-500",
                    )}
                  >
                    {t(`app.onboarding.step2.progress.${step.id}`, step.label)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            {/* Back to Form Button */}
            <Button variant="outline" onClick={() => setIsStreaming(false)} className="flex-1 h-11">
              {t("app.onboarding.step2.backToForm", "Edit Info")}
            </Button>

            {/* Next Step Button - shown when completed or ongoing (for manual navigation) */}
            <Button
              onClick={() => setSearchParams({ step: "3" })}
              disabled={!isAllCompleted}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white h-11"
            >
              {t("app.onboarding.step2.nextButton", "Next step")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
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

        {/* Action Buttons */}
        <div className="flex gap-3 mt-5">
          {/* View Progress Button - only show if enrichment is ongoing/completed */}
          {hasEnrichmentStatus && (
            <Button variant="outline" onClick={() => setIsStreaming(true)} className="flex-1 h-10">
              {t("app.onboarding.step2.viewProgress", "View Progress")}
            </Button>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleNextStep}
            disabled={!isFormValid || isSubmitting}
            className={cn(
              "bg-blue-500 hover:bg-blue-600 text-white h-10",
              hasEnrichmentStatus ? "flex-1" : "w-full",
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("app.onboarding.step2.saving", "Saving...")}
              </>
            ) : (
              t("app.onboarding.step2.submitButton", "Submit")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
