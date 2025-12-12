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

interface Lead {
  id: string
  companyName: string
  email?: string
  country?: string
  industry?: string
}

interface BulkCreateLeadsResponse {
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
      if (!workspace?.id || leadsToSave.length === 0) return []

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
    if (!workspace?.id || hasStartedSearch.current) return

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
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <Search className="w-6 h-6 text-blue-500" />
            {t("app.onboarding.step2.searchTitle", "리드 검색 중")}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            {t(
              "app.onboarding.step2.searchDescription",
              "설문 정보를 기반으로 잠재 고객을 검색하고 있습니다",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isSearching || isSaving ? (
            // Searching/Saving state
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
                <p className="text-lg font-medium text-gray-900">
                  {isSaving
                    ? isKorean
                      ? "리드 저장 중..."
                      : "Saving leads..."
                    : t("app.onboarding.step2.searching", "검색 중...")}
                </p>
                <p className="text-sm text-gray-500 mt-1">{statusMessage}</p>
              </div>
              <Progress value={isSaving ? 100 : progress} className="h-2" />
              <p className="text-center text-sm text-gray-500">
                {isSaving ? "100%" : `${progress}%`}
              </p>
            </div>
          ) : searchComplete && leads.length > 0 ? (
            // Results found
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">
                    {leads.length}
                    {t("app.onboarding.step2.leadsFound", "명의 잠재 고객을 찾았습니다")}
                  </p>
                </div>
              </div>

              {/* Lead preview list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leads.slice(0, 5).map((lead, index) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{lead.companyName}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {lead.country} • {lead.industry}
                      </p>
                    </div>
                  </div>
                ))}
                {leads.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setShowAllLeads(true)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {isKorean
                      ? `전체 ${leads.length}개 리드 보기`
                      : `View all ${leads.length} leads`}
                  </Button>
                )}
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!savingComplete || isSaving}
                >
                  {t("app.onboarding.step1.nextButton", "다음 단계")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ) : searchComplete && leads.length === 0 ? (
            // No results
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600">
                {t("app.onboarding.step2.noLeadsFound", "리드를 찾을 수 없습니다")}
              </p>
              <Button variant="outline" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("app.onboarding.step2.retrySearch", "다시 검색")}
              </Button>
            </div>
          ) : (
            // Initial state (should auto-start)
            <div className="py-8 text-center">
              <Button onClick={handleRetry} disabled={!workspace?.id}>
                <Search className="w-4 h-4 mr-2" />
                {t("app.onboarding.step2.searching", "검색 중...")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View All Leads Dialog */}
      <Dialog open={showAllLeads} onOpenChange={setShowAllLeads}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {isKorean ? `전체 리드 목록 (${leads.length}개)` : `All Leads (${leads.length})`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {leads.map((lead, index) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{lead.companyName}</p>
                  <p className="text-sm text-gray-500 truncate">{lead.email || "-"}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {lead.country && (
                    <Badge variant="outline" className="text-xs">
                      {lead.country}
                    </Badge>
                  )}
                  {lead.industry && (
                    <Badge variant="secondary" className="text-xs">
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
