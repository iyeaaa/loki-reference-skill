import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit3,
  Globe2,
  Loader2,
  Mail,
  Search,
  Send,
  X,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api/client"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useCompleteOnboarding, useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useSequenceSteps, useUpdateSequenceStep } from "@/lib/api/hooks/sequences"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

type Lead = {
  id: string
  companyName: string
  email?: string
  country?: string
  industry?: string
  contactName?: string
}

type EmailStep = {
  id: string
  stepOrder: number
  delayDays: number
  scheduledHour?: number
  scheduledMinute?: number
  emailSubject: string
  emailBodyText?: string
  emailBodyHtml?: string
}

export function StepConfirmation() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const isKorean = i18n.language === "ko"

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionComplete, setExecutionComplete] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [executionStatus, setExecutionStatus] = useState("")

  // UI states
  const [leadsOpen, setLeadsOpen] = useState(true)
  const [emailsOpen, setEmailsOpen] = useState(true)
  const [leadSearchQuery, setLeadSearchQuery] = useState("")
  const [editingStep, setEditingStep] = useState<EmailStep | null>(null)
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const LEADS_PER_PAGE = 6 // 황금비율 카드: 3열 × 2행

  // User & workspace
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const workspace = userWorkspaces?.[0]

  // API hooks
  const { data: emailAccount } = useEmailAccountByWorkspaceAndUser(
    workspace?.id || "",
    !!workspace?.id,
  )
  const { data: onboardingProgress } = useOnboardingProgress(workspace?.id || "", !!workspace?.id)
  const completeOnboardingMutation = useCompleteOnboarding()

  // Sequence steps
  const sequenceId = onboardingProgress?.generatedSequenceId || ""
  const { data: stepsData } = useSequenceSteps(sequenceId, !!sequenceId)
  const updateStepMutation = useUpdateSequenceStep(sequenceId)

  const steps: EmailStep[] = useMemo(() => {
    if (!stepsData) {
      return []
    }
    return (stepsData as EmailStep[]).sort((a, b) => a.stepOrder - b.stepOrder)
  }, [stepsData])

  // Lead IDs from onboarding
  const allLeadIds = useMemo(() => onboardingProgress?.selectedLeadIds || [], [onboardingProgress])

  // Selected leads (initially all selected)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [leads, setLeads] = useState<Lead[]>([])

  // Fetch leads
  useEffect(() => {
    if (allLeadIds.length === 0) {
      return
    }

    const fetchLeads = async () => {
      try {
        const response = await apiFetch<{ data: Lead[] }>(
          `/api/v1/leads?ids=${allLeadIds.join(",")}`,
        )
        if (response.data) {
          setLeads(response.data)
          // Initially select all leads
          if (selectedLeadIds.length === 0) {
            setSelectedLeadIds(response.data.map((l) => l.id))
          }
        }
      } catch (error) {
        console.error("Failed to fetch leads:", error)
        toast.error(
          isKorean
            ? "바이어 정보를 불러올 수 없어요. 다시 시도해주세요."
            : "Failed to load buyer information. Please try again.",
        )
        setLeads([])
      }
    }

    fetchLeads()
  }, [allLeadIds, selectedLeadIds.length, isKorean])

  // Filtered leads by search
  const filteredLeads = useMemo(() => {
    if (!leadSearchQuery.trim()) {
      return leads
    }
    const query = leadSearchQuery.toLowerCase()
    return leads.filter(
      (lead) =>
        lead.companyName?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.country?.toLowerCase().includes(query),
    )
  }, [leads, leadSearchQuery])

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE)
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * LEADS_PER_PAGE
    return filteredLeads.slice(startIndex, startIndex + LEADS_PER_PAGE)
  }, [filteredLeads, currentPage])

  // Reset to page 1 when search changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger on search change
  useEffect(() => {
    setCurrentPage(1)
  }, [leadSearchQuery])

  // Toggle lead selection
  const toggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    )
  }

  // Select/Deselect all
  const toggleAllLeads = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([])
    } else {
      setSelectedLeadIds(leads.map((l) => l.id))
    }
  }

  // Leads without email
  const leadsWithoutEmail = useMemo(() => leads.filter((l) => !l.email), [leads])

  // Open edit modal
  const openEditModal = (step: EmailStep) => {
    setEditingStep(step)
    setEditSubject(step.emailSubject || "")
    setEditBody(step.emailBodyText || "")
  }

  // Save edited step
  const handleSaveStep = async () => {
    if (!(editingStep && sequenceId)) {
      return
    }

    try {
      await updateStepMutation.mutateAsync({
        sequenceId,
        stepId: editingStep.id,
        data: {
          stepOrder: editingStep.stepOrder,
          delayDays: editingStep.delayDays,
          scheduledHour: editingStep.scheduledHour ?? 9,
          scheduledMinute: editingStep.scheduledMinute ?? 0,
          emailSubject: editSubject,
          emailBodyText: editBody,
        },
      })
      toast.success(isKorean ? "이메일이 수정되었습니다" : "Email updated")
      setEditingStep(null)
    } catch {
      toast.error(isKorean ? "수정에 실패했습니다" : "Failed to update")
    }
  }

  // Complete onboarding
  const completeOnboardingAndClearData = async () => {
    if (workspace?.id) {
      try {
        await completeOnboardingMutation.mutateAsync({ workspaceId: workspace.id, userId })
      } catch (error) {
        console.error("Failed to complete onboarding:", error)
      }
    }
  }

  // Execute campaign
  const handleExecute = async () => {
    if (!sequenceId) {
      toast.error(isKorean ? "캠페인 정보가 없어요" : "Missing campaign information")
      return
    }

    if (!emailAccount?.id) {
      toast.error(isKorean ? "이메일 계정을 먼저 연동해주세요" : "Please connect your email first")
      return
    }

    const validLeads = leads.filter((l) => selectedLeadIds.includes(l.id) && l.email)

    if (validLeads.length === 0) {
      toast.error(isKorean ? "발송할 리드가 없어요" : "No leads to send to")
      return
    }

    setIsExecuting(true)
    setExecutionProgress(0)

    try {
      setExecutionStatus(isKorean ? "리드 등록 중" : "Enrolling leads")
      setExecutionProgress(20)

      const leadIds = validLeads.map((lead) => lead.id)
      const enrollResult = await apiFetch<{
        enrolledCount: number
        totalSteps: number
        scheduledExecutions: number
      }>(`/api/v1/admin/sequences/${sequenceId}/enrollments/bulk-with-scheduling`, {
        method: "POST",
        body: JSON.stringify({
          leadIds,
          userEmailAccountId: emailAccount.id,
          enrolledBy: userId,
        }),
      })

      setExecutionProgress(60)
      setExecutionStatus(isKorean ? "캠페인 활성화 중" : "Activating campaign")

      await apiFetch(`/api/v1/sequences/${sequenceId}/activate-step-based`, {
        method: "POST",
      })

      setExecutionProgress(100)
      setExecutionComplete(true)

      toast.success(
        isKorean
          ? `${enrollResult.enrolledCount}명에게 이메일이 예약됐어요`
          : `Emails scheduled for ${enrollResult.enrolledCount} leads`,
      )

      await completeOnboardingAndClearData()

      setTimeout(() => {
        navigate("/dashboard")
      }, 3000)
    } catch (error) {
      console.error("Failed to execute campaign:", error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : isKorean
            ? "캠페인 시작에 실패했어요"
            : "Failed to launch campaign"
      toast.error(errorMessage)
      setExecutionError(errorMessage)
      setIsExecuting(false)
      setExecutionProgress(0)
      setExecutionStatus("")
    }
  }

  const handleBack = () => {
    setSearchParams({ step: "3", from: "step4" })
  }

  const handleSkipToDashboard = async () => {
    await completeOnboardingAndClearData()
    navigate("/dashboard")
  }

  // Get delay text
  const getDelayText = (delayDays: number, stepOrder: number) => {
    if (stepOrder === 1) {
      return isKorean ? "2분 뒤" : "In 2 min"
    }
    if (delayDays === 1) {
      return isKorean ? "1일 후" : "Day 1"
    }
    return isKorean ? `${delayDays}일 후` : `Day ${delayDays}`
  }

  // Counts
  const selectedCount = selectedLeadIds.filter((id) =>
    leads.find((l) => l.id === id && l.email),
  ).length
  const totalEmails = selectedCount * steps.length

  // Loading state
  if (!sequenceId) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
                <Zap className="h-7 w-7 text-amber-600" />
              </div>
              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "앗, 먼저 해야 할 게 있어요" : "One more thing first"}
              </h2>
              <p className="mb-8 text-gray-500 leading-relaxed">
                {isKorean
                  ? "바이어와 이메일을 먼저 준비해야\n캠페인을 시작할 수 있어요"
                  : "Let's prepare buyers and emails\nbefore starting the campaign"}
              </p>
              <Button
                className="h-12 w-full max-w-xs rounded-xl bg-blue-500 font-medium hover:bg-blue-600"
                onClick={() => setSearchParams({ step: "1" })}
              >
                {isKorean ? "처음부터 시작하기" : "Start from beginning"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Executing state
  if (isExecuting) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-16">
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500">
                  <Send className="h-7 w-7 text-white" />
                </div>
                <div className="-inset-2 absolute animate-pulse rounded-2xl bg-blue-500/20" />
              </div>
              <div className="space-y-2">
                <h2 className="font-bold text-[22px] text-gray-900 tracking-tight">
                  {isKorean ? "캠페인 준비 중" : "Setting up campaign"}
                </h2>
                <p className="text-gray-500">
                  {executionStatus || (isKorean ? "잠시만요" : "Just a moment")}
                </p>
              </div>
              <div className="w-full max-w-xs space-y-3">
                <Progress className="h-2 rounded-full" value={executionProgress} />
                <p className="text-gray-400 text-sm">{executionProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Complete state
  if (executionComplete) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "시작됐어요!" : "You're live!"}
              </h2>
              <p className="mb-8 text-gray-500 leading-relaxed">
                {isKorean
                  ? "이메일 발송이 예약됐어요.\n대시보드에서 바이어 반응을 확인하세요."
                  : "Emails have been scheduled.\nTrack buyer responses on your dashboard."}
              </p>
              <div className="mb-8 flex w-full max-w-xs justify-center gap-12">
                <div className="text-center">
                  <p className="font-bold text-3xl text-blue-600">{selectedCount}</p>
                  <p className="mt-1 text-gray-400 text-sm">{isKorean ? "바이어" : "Buyers"}</p>
                </div>
                <div className="w-px bg-gray-100" />
                <div className="text-center">
                  <p className="font-bold text-3xl text-green-600">{totalEmails}</p>
                  <p className="mt-1 text-gray-400 text-sm">{isKorean ? "이메일" : "Emails"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isKorean ? "대시보드로 이동할게요" : "Taking you to dashboard"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (executionError) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
                <Zap className="h-7 w-7 text-red-600" />
              </div>
              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "잠깐 문제가 생겼어요" : "Something went wrong"}
              </h2>
              <p className="mb-8 max-w-sm text-gray-500 leading-relaxed">
                {isKorean ? "다시 시도해 주세요" : "Please try again"}
              </p>
              <div className="flex w-full gap-3">
                <Button
                  className="h-12 flex-1 rounded-xl border-gray-200"
                  onClick={() => setExecutionError(null)}
                  variant="outline"
                >
                  {isKorean ? "다시 시도" : "Try again"}
                </Button>
                <Button
                  className="h-12 flex-1 rounded-xl bg-gray-900 hover:bg-gray-800"
                  onClick={handleSkipToDashboard}
                >
                  {isKorean ? "대시보드로" : "Dashboard"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main confirmation view - Single scroll with collapsible sections
  return (
    <div className="mx-auto max-w-4xl px-4 pb-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="mb-1 font-medium text-blue-600 text-sm">
          {isKorean ? "마지막 단계예요" : "Final step"}
        </p>
        <h2 className="font-bold text-2xl text-gray-900 tracking-tight">
          {isKorean ? "캠페인을 확인하고 시작하세요" : "Review and launch your campaign"}
        </h2>
      </div>

      <div className="space-y-4">
        {/* ========== LEADS SECTION ========== */}
        <Collapsible onOpenChange={setLeadsOpen} open={leadsOpen}>
          <Card className="overflow-hidden border-0 bg-white shadow-gray-200/50 shadow-lg">
            <CollapsibleTrigger asChild>
              <button
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
                type="button"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {isKorean ? "발송 대상" : "Recipients"}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {isKorean
                      ? `${selectedCount}명 선택됨 / 전체 ${leads.length}명`
                      : `${selectedCount} selected / ${leads.length} total`}
                  </p>
                </div>
                <div>
                  {leadsOpen ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t px-6 py-4">
                {/* Search & Actions */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                    <Input
                      className="pl-9"
                      onChange={(e) => setLeadSearchQuery(e.target.value)}
                      placeholder={isKorean ? "회사명, 이메일 검색..." : "Search company, email..."}
                      value={leadSearchQuery}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={toggleAllLeads} size="sm" variant="outline">
                      {selectedLeadIds.length === leads.length
                        ? isKorean
                          ? "전체 해제"
                          : "Deselect all"
                        : isKorean
                          ? "전체 선택"
                          : "Select all"}
                    </Button>
                  </div>
                </div>

                {/* Leads without email warning */}
                {leadsWithoutEmail.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-amber-800 text-sm">
                      {isKorean
                        ? `${leadsWithoutEmail.length}명은 이메일이 없어 발송에서 제외됩니다`
                        : `${leadsWithoutEmail.length} leads without email will be excluded`}
                    </p>
                  </div>
                )}

                {/* Leads Grid - Golden Ratio Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedLeads.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id)
                    const hasEmail = !!lead.email

                    return (
                      <button
                        className={`group relative rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-blue-100 shadow-lg"
                            : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-gray-100 hover:shadow-lg"
                        } ${hasEmail ? "cursor-pointer" : "opacity-50"}`}
                        disabled={!hasEmail}
                        key={lead.id}
                        onClick={() => hasEmail && toggleLead(lead.id)}
                        style={{ aspectRatio: "1.618 / 1" }}
                        type="button"
                      >
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="-top-2 -right-2 absolute flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-md">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}

                        {/* Company Name */}
                        <h4 className="mb-4 truncate font-semibold text-gray-900 leading-tight">
                          {lead.companyName}
                        </h4>

                        {/* Divider */}
                        <div
                          className={`mb-3 h-px ${isSelected ? "bg-blue-200" : "bg-gray-100"}`}
                        />

                        {/* Info rows */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <Mail
                              className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-blue-500" : "text-gray-400"}`}
                            />
                            <span
                              className={`truncate text-sm ${hasEmail ? "text-gray-600" : "text-gray-400 italic"}`}
                            >
                              {lead.email || (isKorean ? "이메일 없음" : "No email")}
                            </span>
                          </div>
                          {lead.country && (
                            <div className="flex items-center gap-2.5">
                              <Globe2
                                className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-blue-500" : "text-gray-400"}`}
                              />
                              <span className="truncate text-gray-600 text-sm">{lead.country}</span>
                            </div>
                          )}
                        </div>

                        {/* Hidden checkbox for accessibility */}
                        <Checkbox
                          checked={isSelected}
                          className="sr-only"
                          disabled={!hasEmail}
                          onCheckedChange={() => hasEmail && toggleLead(lead.id)}
                        />
                      </button>
                    )
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className="text-gray-500 text-sm">
                      {isKorean
                        ? `${filteredLeads.length}개 바이어 중 ${(currentPage - 1) * LEADS_PER_PAGE + 1}-${Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} 표시`
                        : `Showing ${(currentPage - 1) * LEADS_PER_PAGE + 1}-${Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} of ${filteredLeads.length} buyers`}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        size="sm"
                        variant="outline"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {isKorean ? "이전" : "Prev"}
                      </Button>
                      <span className="px-2 text-gray-600 text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        size="sm"
                        variant="outline"
                      >
                        {isKorean ? "다음" : "Next"}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ========== EMAILS SECTION ========== */}
        <Collapsible onOpenChange={setEmailsOpen} open={emailsOpen}>
          <Card className="overflow-hidden border-0 bg-white shadow-gray-200/50 shadow-lg">
            <CollapsibleTrigger asChild>
              <button
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
                type="button"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {isKorean ? "이메일 시퀀스" : "Email Sequence"}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {isKorean
                      ? `${steps.length}개 스텝으로 순차 발송`
                      : `${steps.length} steps, sent sequentially`}
                  </p>
                </div>
                <div>
                  {emailsOpen ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t px-6 py-4">
                {/* Email Steps - Horizontal cards on desktop */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {steps.map((step) => (
                    <div
                      className="group relative rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 transition-all hover:border-blue-200 hover:shadow-md"
                      key={step.id}
                    >
                      {/* Step header */}
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 font-semibold text-white text-xs">
                            {step.stepOrder}
                          </div>
                          <span className="font-medium text-gray-700 text-sm">
                            {isKorean ? `스텝 ${step.stepOrder}` : `Step ${step.stepOrder}`}
                          </span>
                        </div>
                        <Badge className="text-xs" variant="secondary">
                          <Clock className="mr-1 h-3 w-3" />
                          {getDelayText(step.delayDays, step.stepOrder)}
                        </Badge>
                      </div>

                      {/* Subject */}
                      <p className="mb-2 line-clamp-1 font-medium text-gray-900 text-sm">
                        {step.emailSubject || (isKorean ? "(제목 없음)" : "(No subject)")}
                      </p>

                      {/* Body preview */}
                      <p className="mb-3 line-clamp-3 text-gray-500 text-xs leading-relaxed">
                        {step.emailBodyText || (isKorean ? "(본문 없음)" : "(No content)")}
                      </p>

                      {/* Edit button */}
                      <Button
                        className="absolute right-2 bottom-2 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => openEditModal(step)}
                        size="sm"
                        variant="ghost"
                      >
                        <Edit3 className="mr-1 h-3 w-3" />
                        {isKorean ? "수정" : "Edit"}
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Schedule info */}
                <div className="mt-4 flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {isKorean
                      ? "오늘 시작 → 매일 자동 발송"
                      : "Starts today → Sends automatically each day"}
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ========== EXECUTE SECTION ========== */}
        <Card className="overflow-hidden border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-6 py-6">
            {/* Summary stats - simple inline */}
            <div className="mb-4 flex items-center justify-center gap-2 text-gray-600 text-sm">
              <span className="font-medium text-gray-900">{selectedCount}</span>
              <span>{isKorean ? "명" : "buyers"}</span>
              <span className="text-gray-400">×</span>
              <span className="font-medium text-gray-900">{steps.length}</span>
              <span>{isKorean ? "스텝" : "steps"}</span>
              <span className="text-gray-400">=</span>
              <span className="font-semibold text-gray-900">{totalEmails}</span>
              <span>{isKorean ? "통 이메일" : "emails"}</span>
            </div>

            {/* Checklist */}
            <div className="mb-5 space-y-1.5">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>
                  {isKorean
                    ? `${selectedCount}명의 리드가 선택됨`
                    : `${selectedCount} leads selected`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>
                  {isKorean
                    ? `${steps.length}개의 이메일 스텝 준비됨`
                    : `${steps.length} email steps ready`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                {emailAccount ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="truncate">
                      {isKorean ? "발송 계정: " : "From: "}
                      {emailAccount.emailAddress}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-red-500" />
                    <span>{isKorean ? "이메일 계정 필요" : "Email account required"}</span>
                  </>
                )}
              </div>
            </div>

            {/* Auto-stop info */}
            <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-gray-600 text-sm">
              <p className="mb-1.5">
                {isKorean
                  ? "• 바이어가 답장하면 해당 리드의 이메일 시퀀스가 자동으로 중지됩니다."
                  : "• Sequence auto-stops when a buyer replies."}
              </p>
              <p>
                {isKorean
                  ? "• 특정 시퀀스의 이메일 오픈 수가 10회 이상이면 시퀀스가 중지되고, 린다 세일즈 전문팀과 상담이 진행됩니다."
                  : "• Sequence stops at 10+ opens and Linda sales team will reach out for consultation."}
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button
                className="h-14 w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 font-semibold text-white shadow-blue-500/30 shadow-lg transition-all hover:from-blue-600 hover:to-indigo-700 hover:shadow-blue-500/40"
                disabled={isExecuting || !emailAccount || selectedCount === 0}
                onClick={handleExecute}
              >
                <Send className="mr-2 h-5 w-5" />
                {isKorean ? "지금 캠페인 시작하기" : "Launch Campaign Now"}
              </Button>

              <div className="flex gap-3">
                <Button className="h-11 flex-1 rounded-xl" onClick={handleBack} variant="outline">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  {isKorean ? "이전" : "Back"}
                </Button>
                <button
                  className="flex-1 py-2 text-center text-gray-400 text-sm transition-colors hover:text-gray-600"
                  onClick={handleSkipToDashboard}
                  type="button"
                >
                  {isKorean ? "나중에 할게요" : "Maybe later"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== EMAIL EDIT MODAL ========== */}
      <Dialog onOpenChange={() => setEditingStep(null)} open={!!editingStep}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isKorean
                ? `스텝 ${editingStep?.stepOrder} 이메일 수정`
                : `Edit Step ${editingStep?.stepOrder} Email`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isKorean ? "제목" : "Subject"}</Label>
              <Input
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder={isKorean ? "이메일 제목..." : "Email subject..."}
                value={editSubject}
              />
            </div>

            <div className="space-y-2">
              <Label>{isKorean ? "본문" : "Body"}</Label>
              <Textarea
                className="min-h-[200px]"
                onChange={(e) => setEditBody(e.target.value)}
                placeholder={isKorean ? "이메일 본문..." : "Email body..."}
                value={editBody}
              />
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-2 font-medium text-gray-700 text-xs">
                {isKorean ? "사용 가능한 변수" : "Available variables"}
              </p>
              <div className="flex flex-wrap gap-2">
                {["{{company_name}}", "{{contact_name}}", "{{country}}"].map((v) => (
                  <Badge className="cursor-pointer text-xs" key={v} variant="secondary">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setEditingStep(null)} variant="outline">
              {isKorean ? "취소" : "Cancel"}
            </Button>
            <Button disabled={updateStepMutation.isPending} onClick={handleSaveStep}>
              {updateStepMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isKorean ? "저장" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
