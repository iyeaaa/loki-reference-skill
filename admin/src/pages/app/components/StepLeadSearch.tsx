import { ArrowRight, CheckCircle2, Eye, Loader2, RefreshCw, Search, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { apiFetch } from "@/lib/api/client"
import type { LeadDiscoveryEventData } from "@/lib/api/hooks/lead-discovery"
import { useLeadDiscoveryMutation } from "@/lib/api/hooks/lead-discovery"
import { useCompleteStep2, useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

type Lead = {
  id: string
  companyName: string
  email?: string
  country?: string
  industry?: string
}

type BulkCreateLeadsResponse = {
  leads: Array<{ id: string; companyName: string }>
  duplicateEmails: string[]
  stats: { created: number; skipped: number }
}

export function StepLeadSearch() {
  const { t, i18n } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savingComplete, setSavingComplete] = useState(false)
  const [searchComplete, setSearchComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [showAllLeads, setShowAllLeads] = useState(false)

  // Refs to prevent double execution
  const hasStartedSearch = useRef(false)
  const hasStartedSaving = useRef(false)

  // Get user's workspace
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)
  const workspace = userWorkspaces?.[0]
  const isKorean = i18n.language === "ko"

  // Onboarding hooks
  const { data: onboardingProgress } = useOnboardingProgress(workspace?.id || "", !!workspace?.id)
  const completeStep2Mutation = useCompleteStep2()

  // Get company info from DB onboarding progress
  const companyInfo = useMemo(() => {
    if (onboardingProgress?.surveyData) {
      return onboardingProgress.surveyData
    }
    return {}
  }, [onboardingProgress])

  // Lead discovery mutation
  const leadDiscoveryMutation = useLeadDiscoveryMutation({
    onStatusChange: (data: LeadDiscoveryEventData) => {
      setProgress(data.progress || 0)
      setStatusMessage(data.message || "")

      if (data.results && data.results.length > 0) {
        // Map BigQuery results to leads
        const mappedLeads = data.results.slice(0, 20).map((result) => ({
          id: crypto.randomUUID(),
          companyName: result.companyName || "Unknown Company",
          email: result.email,
          country: result.country,
          industry: result.mainIndustry,
        }))
        setLeads(mappedLeads)
        setSearchComplete(true) // Set complete when results arrive
      }
    },
    onError: (error: string) => {
      console.error("Lead discovery error:", error)
      toast.error(isKorean ? "리드 검색에 실패했습니다" : "Lead search failed")
      setIsSearching(false)
      hasStartedSearch.current = false
    },
  })

  // Build search query from company info
  const buildSearchQuery = useCallback(() => {
    const parts: string[] = []

    if (companyInfo.industry) {
      const industryMap: Record<string, string> = {
        manufacturing: "manufacturing parts suppliers",
        it_saas: "IT software technology companies",
        beauty: "beauty cosmetics distributors",
        food: "food health supplements importers",
        fashion: "fashion apparel retailers",
        electronics: "electronics distributors",
        healthcare: "healthcare medical companies",
        guitar: "general business",
      }
      parts.push(industryMap[companyInfo.industry] || companyInfo.industry)
    }

    if (companyInfo.country) {
      const countryMap: Record<string, string> = {
        jp: "Japan",
        us: "United States",
        cn: "China",
        sea: "Southeast Asia",
        eu: "Europe",
        ae: "Middle East",
      }
      parts.push(countryMap[companyInfo.country] || companyInfo.country)
    }

    if (companyInfo.target) {
      parts.push(companyInfo.target === "b2b" ? "B2B buyers" : "B2C retailers")
    }

    return parts.join(" ") || "international business buyers"
  }, [companyInfo])

  // Save leads to database with customer group (memoized to avoid useEffect dependency issues)
  const saveLeadsToDatabase = useCallback(
    async (leadsToSave: Lead[]) => {
      if (!workspace?.id || leadsToSave.length === 0) {
        return []
      }

      setIsSaving(true)
      try {
        // Step 1: Create a customer group for demo leads
        const groupName = isKorean
          ? `데모 리드 그룹 (${new Date().toLocaleDateString("ko-KR")})`
          : `Demo Leads Group (${new Date().toLocaleDateString("en-US")})`

        const groupResponse = await apiFetch<{ id: string }>("/api/v1/customer-groups", {
          method: "POST",
          body: JSON.stringify({
            workspaceId: workspace.id,
            name: groupName,
            description: isKorean
              ? "온보딩 과정에서 발견한 데모 리드"
              : "Demo leads discovered during onboarding",
            createdBy: userId,
          }),
        })

        const customerGroupId = groupResponse.id
        console.log("Created customer group:", customerGroupId)

        // Step 2: Create leads with customerGroupId so they get added to the group
        const response = await apiFetch<BulkCreateLeadsResponse>("/api/v1/leads/bulk", {
          method: "POST",
          body: JSON.stringify({
            workspaceId: workspace.id,
            createdBy: userId,
            customerGroupId, // This links leads to the group
            leads: leadsToSave.map((lead) => ({
              companyName: lead.companyName,
              primaryEmail: lead.email || undefined, // Must be primaryEmail for leadContacts
              country: lead.country || undefined,
              businessType: lead.industry || undefined,
              leadStatus: "new",
              leadSource: "lead_discovery",
            })),
          }),
        })

        const createdIds = response.leads.map((l) => l.id)
        setSavingComplete(true)

        // DB에 Step 2 완료 기록 (customerGroupId 포함)
        if (workspace?.id) {
          try {
            await completeStep2Mutation.mutateAsync({
              workspaceId: workspace.id,
              selectedLeadIds: createdIds,
              customerGroupId,
              userId,
            })
          } catch (error) {
            console.error("Failed to complete step 2:", error)
          }
        }

        return createdIds
      } catch (error) {
        console.error("Failed to save leads:", error)
        toast.error(isKorean ? "리드 저장에 실패했습니다" : "Failed to save leads")
        // Even on failure, allow proceeding with local IDs
        setSavingComplete(true)
        return []
      } finally {
        setIsSaving(false)
      }
    },
    [workspace?.id, userId, isKorean, completeStep2Mutation],
  )

  const startSearch = useCallback(async () => {
    if (!workspace?.id || hasStartedSearch.current) {
      return
    }

    hasStartedSearch.current = true
    setIsSearching(true)
    setProgress(0)
    setLeads([])
    setSearchComplete(false)

    try {
      const query = buildSearchQuery()
      console.log("Starting lead search with query:", query)

      await leadDiscoveryMutation.mutateAsync({
        query,
        workspaceId: workspace.id,
        locale: i18n.language,
      })

      // Note: searchComplete is set in onStatusChange callback when results arrive
      // Don't set it here to avoid timing issues
    } catch (error) {
      console.error("Lead search failed:", error)
      hasStartedSearch.current = false
      setSearchComplete(true) // Set complete on error to show retry button
    } finally {
      setIsSearching(false)
    }
  }, [workspace?.id, buildSearchQuery, i18n.language, leadDiscoveryMutation])

  // Start search on mount
  useEffect(() => {
    if (workspace?.id && !hasStartedSearch.current) {
      startSearch()
    }
  }, [workspace?.id, startSearch])

  // Save leads when search completes
  useEffect(() => {
    if (searchComplete && leads.length > 0 && !hasStartedSaving.current) {
      hasStartedSaving.current = true
      saveLeadsToDatabase(leads)
    }
  }, [searchComplete, leads, saveLeadsToDatabase])

  const handleNext = () => {
    // DB에 이미 저장되어 있으므로 sessionStorage 사용 안함
    setSearchParams({ step: "3" })
  }

  const handleRetry = () => {
    hasStartedSearch.current = false
    startSearch()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Search className="h-6 w-6 text-blue-500" />
            {t("app.onboarding.step2.searchTitle", "리드 검색 중")}
          </CardTitle>
          <p className="mt-1 text-gray-600 text-sm">
            {t(
              "app.onboarding.step2.searchDescription",
              "설문 정보를 기반으로 잠재 고객을 검색하고 있습니다",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isSearching || isSaving ? (
            // Searching/Saving state
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
                <p className="font-medium text-gray-900 text-lg">
                  {isSaving
                    ? isKorean
                      ? "리드 저장 중..."
                      : "Saving leads..."
                    : t("app.onboarding.step2.searching", "검색 중...")}
                </p>
                <p className="mt-1 text-gray-500 text-sm">{statusMessage}</p>
              </div>
              <Progress className="h-2" value={isSaving ? 100 : progress} />
              <p className="text-center text-gray-500 text-sm">
                {isSaving ? "100%" : `${progress}%`}
              </p>
            </div>
          ) : searchComplete && leads.length > 0 ? (
            // Results found
            <div className="space-y-6">
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    {leads.length}
                    {t("app.onboarding.step2.leadsFound", "명의 잠재 고객을 찾았습니다")}
                  </p>
                </div>
              </div>

              {/* Lead preview list */}
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {leads.slice(0, 5).map((lead, index) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                    key={lead.id}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-600 text-sm">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{lead.companyName}</p>
                      <p className="truncate text-gray-500 text-sm">
                        {lead.country} • {lead.industry}
                      </p>
                    </div>
                  </div>
                ))}
                {leads.length > 5 && (
                  <Button
                    className="w-full text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => setShowAllLeads(true)}
                    variant="ghost"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {isKorean
                      ? `전체 ${leads.length}개 리드 보기`
                      : `View all ${leads.length} leads`}
                  </Button>
                )}
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-4">
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!savingComplete || isSaving}
                  onClick={handleNext}
                >
                  {t("app.onboarding.step1.nextButton", "다음 단계")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : searchComplete && leads.length === 0 ? (
            // No results
            <div className="space-y-4 py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600">
                {t("app.onboarding.step2.noLeadsFound", "리드를 찾을 수 없습니다")}
              </p>
              <Button onClick={handleRetry} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("app.onboarding.step2.retrySearch", "다시 검색")}
              </Button>
            </div>
          ) : (
            // Initial state (should auto-start)
            <div className="py-8 text-center">
              <Button disabled={!workspace?.id} onClick={handleRetry}>
                <Search className="mr-2 h-4 w-4" />
                {t("app.onboarding.step2.searching", "검색 중...")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View All Leads Dialog */}
      <Dialog onOpenChange={setShowAllLeads} open={showAllLeads}>
        <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {isKorean ? `전체 리드 목록 (${leads.length}개)` : `All Leads (${leads.length})`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-2 overflow-y-auto pr-2">
            {leads.map((lead, index) => (
              <div
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                key={lead.id}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-600 text-sm">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{lead.companyName}</p>
                  <p className="truncate text-gray-500 text-sm">{lead.email || "-"}</p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  {lead.country && (
                    <Badge className="text-xs" variant="outline">
                      {lead.country}
                    </Badge>
                  )}
                  {lead.industry && (
                    <Badge className="text-xs" variant="secondary">
                      {lead.industry}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
