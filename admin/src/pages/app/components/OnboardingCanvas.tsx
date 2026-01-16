/**
 * OnboardingCanvas - 온보딩 채팅 페이지의 오른쪽 캔버스 컴포넌트
 *
 * StepConfirmation의 EmailsSection과 LeadsSection을 재사용
 *
 * 탭 구조:
 * - 바이어: LeadsSection 사용
 * - 이메일: EmailsSection 사용
 *
 * 자동 탭 전환:
 * - discovery phase 완료 → 바이어 탭
 * - templates/previews phase 완료 → 이메일 탭
 */

import { motion } from "framer-motion"
import { Mail, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CompanyAvatar } from "@/components/CompanyAvatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUpdateSequenceStep } from "@/lib/api/hooks/sequences"
import { cn } from "@/lib/utils"
import type { LeadProgressItem, OnboardingPhase } from "@/store/onboarding-progress"
import { EmailEditModal } from "./EmailEditModal"
import { LeadDetailModal } from "./LeadDetailModal"
import { SimpleEmailsSection } from "./SimpleEmailsSection"
import { SimpleLeadsSection } from "./SimpleLeadsSection"

// EmailsSection에서 사용하는 타입
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

// LeadsSection에서 사용하는 타입
type Lead = {
  id: string
  companyName: string
  email?: string
  country?: string
  industry?: string
  contactName?: string
  description?: string
  employeeCount?: string
  businessType?: string
  websiteUrl?: string
  score?: number // LLM 평가 점수 (0-100)
}

type OnboardingCanvasProps = {
  leads: LeadProgressItem[]
  phase: OnboardingPhase | null
  isComplete: boolean
  parallelProgress?: {
    discovery: { percent: number; done: boolean }
    templates: { percent: number; done: boolean }
  }
  // EmailsSection용 props
  steps?: EmailStep[]
  // LeadsSection용 props (Lead 전체 데이터)
  fullLeads?: Lead[]
  // 시퀀스 ID (이메일 편집용)
  sequenceId?: string
}

export function OnboardingCanvas({
  leads,
  phase,
  isComplete,
  parallelProgress,
  steps = [],
  fullLeads = [],
  sequenceId = "",
}: OnboardingCanvasProps) {
  const { i18n } = useTranslation()
  const isKorean = i18n.language === "ko"

  const [activeTab, setActiveTab] = useState<"leads" | "emails">("leads")
  const [userManuallyChanged, setUserManuallyChanged] = useState(false)
  const prevPhaseRef = useRef<OnboardingPhase | null>(null)

  // 모달 상태
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [editingStep, setEditingStep] = useState<EmailStep | null>(null)

  // 선택된 리드 ID (모두 선택됨)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  // 이메일 스텝 업데이트 mutation
  const updateStepMutation = useUpdateSequenceStep(sequenceId)

  // fullLeads가 변경되면 모두 선택
  useEffect(() => {
    if (fullLeads.length > 0) {
      setSelectedLeadIds(fullLeads.filter((l) => l.email).map((l) => l.id))
    }
  }, [fullLeads])

  // 리드 정보가 처음 도착하면 바이어 탭으로 강제 전환
  const prevLeadsLengthRef = useRef(0)
  useEffect(() => {
    const currentLength = leads.length || fullLeads.length
    if (prevLeadsLengthRef.current === 0 && currentLength > 0) {
      setActiveTab("leads")
      setUserManuallyChanged(false)
    }
    prevLeadsLengthRef.current = currentLength
  }, [leads.length, fullLeads.length])

  // 자동 탭 전환 로직
  useEffect(() => {
    if (userManuallyChanged) {
      return
    }

    if (phase && phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase

      // 바이어 발견 완료 시 바이어 탭 유지
      if (parallelProgress?.discovery.done && !parallelProgress?.templates.done) {
        setActiveTab("leads")
      }
    }
  }, [phase, parallelProgress, userManuallyChanged])

  // 이메일이 준비되면 이메일 탭으로 자동 전환 (바이어 발견 완료 후)
  const hasAutoSwitchedToEmailsRef = useRef(false)
  useEffect(() => {
    // 사용자가 수동으로 탭을 변경했거나, 이미 자동 전환했으면 건너뜀
    if (userManuallyChanged || hasAutoSwitchedToEmailsRef.current) {
      return
    }

    // 바이어 발견 완료 + 이메일 스텝이 있으면 이메일 탭으로 전환
    const isDiscoveryDone = parallelProgress?.discovery.done || isComplete || leads.length >= 30
    if (isDiscoveryDone && steps.length > 0) {
      hasAutoSwitchedToEmailsRef.current = true
      setActiveTab("emails")
    }
  }, [parallelProgress, isComplete, leads.length, steps.length, userManuallyChanged])

  const handleTabChange = (value: string) => {
    setActiveTab(value as "leads" | "emails")
    setUserManuallyChanged(true)
  }

  // 바이어/이메일 카운트
  const completedLeadsCount = leads.filter((l) => l.status === "done").length
  const totalLeadsCount = leads.length
  const totalStepsCount = steps.length

  // LeadsSection 핸들러
  const handleLeadClick = useCallback((lead: Lead) => {
    setSelectedLead(lead)
  }, [])

  const handleEditStep = useCallback((step: EmailStep) => {
    setEditingStep(step)
  }, [])

  // 이메일 스텝 저장
  const handleSaveStep = useCallback(
    async (subject: string, body: string) => {
      if (!(sequenceId && editingStep)) {
        toast.error(isKorean ? "시퀀스 정보가 없습니다" : "Missing sequence information")
        return
      }

      try {
        await updateStepMutation.mutateAsync({
          stepId: editingStep.id,
          data: {
            emailSubject: subject,
            emailBodyText: body,
            emailBodyHtml: body,
            delayDays: editingStep.delayDays,
          },
        })
        toast.success(isKorean ? "이메일이 저장되었습니다" : "Email saved")
        setEditingStep(null)
      } catch (error) {
        console.error("Failed to save step:", error)
        toast.error(isKorean ? "저장에 실패했습니다" : "Failed to save")
      }
    },
    [sequenceId, editingStep, updateStepMutation, isKorean],
  )

  // 데이터가 없을 때 로딩 상태 표시
  const showLeadsLoading = leads.length === 0 && !isComplete
  // 바이어가 완료되기 전까지는 이메일 표시하지 않음 (사용자 경험 개선)
  const isDiscoveryComplete = parallelProgress?.discovery.done || isComplete || leads.length >= 30
  const showEmailsLoading = !isDiscoveryComplete || (steps.length === 0 && !isComplete)

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 탭 영역 */}
      <Tabs
        className="flex flex-1 flex-col overflow-hidden"
        onValueChange={handleTabChange}
        value={activeTab}
      >
        <div className="shrink-0 border-b bg-muted/30 px-4 py-2">
          <TabsList className="w-full justify-start bg-transparent">
            <TabsTrigger
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              value="leads"
            >
              <Users className="h-4 w-4" />
              <span>{isKorean ? "바이어" : "Buyers"}</span>
              {totalLeadsCount > 0 && (
                <Badge
                  className={cn(
                    "ml-1 min-w-6 justify-center px-1.5 text-xs",
                    completedLeadsCount === totalLeadsCount
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                  )}
                  variant="secondary"
                >
                  {totalLeadsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              value="emails"
            >
              <Mail className="h-4 w-4" />
              <span>{isKorean ? "이메일" : "Emails"}</span>
              {/* 바이어 발견 완료 후에만 이메일 카운트 표시 */}
              {isDiscoveryComplete && totalStepsCount > 0 && (
                <Badge
                  className="ml-1 min-w-6 justify-center bg-green-100 px-1.5 text-green-700 text-xs dark:bg-green-900/30 dark:text-green-400"
                  variant="secondary"
                >
                  {totalStepsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <TabsContent className="m-0 h-full" value="leads">
            {showLeadsLoading ? (
              <LeadsSkeletonTable isKorean={isKorean} />
            ) : fullLeads.length > 0 ? (
              <SimpleLeadsSection
                isKorean={isKorean}
                isLoading={!isComplete}
                leads={fullLeads}
                onLeadClick={handleLeadClick}
              />
            ) : (
              <LeadsProgressView
                isKorean={isKorean}
                isLoading={!isComplete}
                leads={leads}
                onLeadClick={handleLeadClick}
              />
            )}
          </TabsContent>
          <TabsContent className="m-0 h-full" value="emails">
            {showEmailsLoading ? (
              <EmailsSkeletonCards isKorean={isKorean} waitingForBuyers={!isDiscoveryComplete} />
            ) : steps.length > 0 ? (
              <SimpleEmailsSection
                isKorean={isKorean}
                isLoading={!isComplete}
                onEditStep={handleEditStep}
                steps={steps}
              />
            ) : (
              <EmailsSkeletonCards isKorean={isKorean} />
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* 리드 상세 모달 */}
      {selectedLead && (
        <LeadDetailModal
          isKorean={isKorean}
          isOpen={!!selectedLead}
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          selectedLeadIds={selectedLeadIds}
          toggleLead={(id: string) =>
            setSelectedLeadIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
        />
      )}

      {/* 이메일 편집 모달 */}
      <EmailEditModal
        isKorean={isKorean}
        isOpen={!!editingStep}
        isSaving={updateStepMutation.isPending}
        onClose={() => setEditingStep(null)}
        onSave={handleSaveStep}
        step={editingStep}
      />
    </div>
  )
}

// 리드 스켈레톤 테이블 컴포넌트
function LeadsSkeletonTable({ isKorean }: { isKorean: boolean }) {
  return (
    <div className="flex h-full flex-col">
      {/* 테이블 헤더 */}
      <div className="shrink-0 border-b bg-muted/30">
        <div className="grid grid-cols-[48px_minmax(100px,1fr)_minmax(100px,1.5fr)_50px_60px_minmax(140px,1.5fr)] gap-2 px-4 py-2.5 font-medium text-muted-foreground text-xs">
          <div className="text-center">#</div>
          <div>{isKorean ? "회사명" : "Company"}</div>
          <div>{isKorean ? "설명" : "Description"}</div>
          <div>{isKorean ? "국가" : "Country"}</div>
          <div className="text-center">{isKorean ? "적합도" : "Fit"}</div>
          <div>{isKorean ? "이메일" : "Email"}</div>
        </div>
      </div>
      {/* 스켈레톤 행들 */}
      <div className="flex-1 divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            animate={{ opacity: 1 }}
            className="grid grid-cols-[48px_minmax(100px,1fr)_minmax(100px,1.5fr)_50px_60px_minmax(140px,1.5fr)] gap-2 px-4 py-3"
            initial={{ opacity: 0 }}
            key={`skeleton-row-${i}`}
            transition={{ delay: i * 0.05 }}
          >
            <Skeleton className="mx-auto h-4 w-6" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mx-auto h-4 w-5" />
            <Skeleton className="mx-auto h-4 w-10" />
            <Skeleton className="h-4 w-28" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// 이메일 스켈레톤 카드 컴포넌트
function EmailsSkeletonCards({
  isKorean,
  waitingForBuyers = false,
}: {
  isKorean: boolean
  waitingForBuyers?: boolean
}) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 text-muted-foreground text-sm">
        {waitingForBuyers
          ? isKorean
            ? "바이어를 먼저 찾고 있어요..."
            : "Finding buyers first..."
          : isKorean
            ? "이메일을 준비하고 있어요..."
            : "Preparing emails..."}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-4"
            initial={{ opacity: 0, y: 10 }}
            key={`skeleton-email-${i}`}
            transition={{ delay: i * 0.1 }}
          >
            <div className="mb-3 flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-1 h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="mb-1 h-3 w-full" />
            <Skeleton className="mb-1 h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/**
 * 점수에 따른 배지 색상 결정
 */
function getScoreBadgeStyle(score: number): string {
  if (score >= 80) {
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  }
  if (score >= 60) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  }
  if (score >= 40) {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
}

// 리드 진행 상태 뷰 (fullLeads가 없을 때 fallback) - SimpleLeadsSection과 동일한 디자인
function LeadsProgressView({
  leads,
  isKorean,
  onLeadClick,
  isLoading = false,
}: {
  leads: LeadProgressItem[]
  isKorean: boolean
  onLeadClick: (lead: Lead) => void
  isLoading?: boolean
}) {
  if (leads.length === 0) {
    return <LeadsSkeletonTable isKorean={isKorean} />
  }

  // LeadProgressItem을 Lead 형식으로 변환
  const convertToLead = (item: LeadProgressItem): Lead => ({
    id: item.leadId,
    companyName: item.companyName,
    email: item.email,
    country: item.country,
    description: item.description,
    score: item.score,
  })

  return (
    <div className="flex h-full flex-col">
      {/* 테이블 헤더 */}
      <div className="shrink-0 border-b bg-muted/30">
        <div className="grid grid-cols-[48px_minmax(100px,1fr)_minmax(100px,1.5fr)_50px_60px_minmax(140px,1.5fr)] gap-2 px-4 py-2.5 font-medium text-muted-foreground text-xs">
          <div className="text-center">#</div>
          <div>{isKorean ? "회사명" : "Company"}</div>
          <div>{isKorean ? "설명" : "Description"}</div>
          <div>{isKorean ? "국가" : "Country"}</div>
          <div className="text-center">{isKorean ? "적합도" : "Fit"}</div>
          <div>{isKorean ? "이메일" : "Email"}</div>
        </div>
      </div>

      {/* 테이블 바디 - SimpleLeadsSection과 동일한 스타일 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="divide-y divide-border">
          {leads.map((lead, index) => (
            <button
              className="grid w-full cursor-pointer grid-cols-[48px_minmax(100px,1fr)_minmax(100px,1.5fr)_50px_60px_minmax(140px,1.5fr)] gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
              key={lead.leadId}
              onClick={() => onLeadClick(convertToLead(lead))}
              type="button"
            >
              <div className="flex items-center justify-center text-muted-foreground text-xs tabular-nums">
                {index + 1}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <CompanyAvatar companyName={lead.companyName} size="sm" />
                <span className="truncate font-medium text-foreground">{lead.companyName}</span>
              </div>
              <div className="flex min-w-0 items-center">
                <span className="line-clamp-2 text-muted-foreground text-xs">
                  {lead.description || "-"}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-muted-foreground text-xs">{lead.country || "-"}</span>
              </div>
              <div className="flex items-center justify-center">
                {lead.score !== null && lead.score !== undefined ? (
                  <Badge
                    className={cn(
                      "min-w-[42px] justify-center px-1.5 font-medium text-xs tabular-nums",
                      getScoreBadgeStyle(lead.score),
                    )}
                    variant="secondary"
                  >
                    {lead.score}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </div>
              <div className="flex min-w-0 items-center">
                <span className="truncate text-muted-foreground text-xs">
                  {lead.email || (isKorean ? "없음" : "N/A")}
                </span>
              </div>
            </button>
          ))}
          {/* 로딩 중일 때 하단 스켈레톤 행 표시 */}
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                animate={{ opacity: 1 }}
                className="grid grid-cols-[48px_minmax(100px,1fr)_minmax(100px,1.5fr)_50px_60px_minmax(140px,1.5fr)] gap-2 px-4 py-3"
                initial={{ opacity: 0 }}
                key={`progress-skeleton-${i}`}
                transition={{ delay: i * 0.1 }}
              >
                <Skeleton className="mx-auto h-4 w-6" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mx-auto h-4 w-5" />
                <Skeleton className="mx-auto h-4 w-10" />
                <Skeleton className="h-4 w-24" />
              </motion.div>
            ))}
        </div>
      </ScrollArea>
    </div>
  )
}
