/**
 * LeadCard Component
 *
 * Displays a single lead with its status and inline email preview.
 * Shows real-time status updates during discovery/enrichment/email generation.
 */

import { Building2, CheckCircle2, ChevronDown, Loader2, Mail } from "lucide-react"
import { useState } from "react"
import type { LeadProgressItem } from "@/lib/api/hooks/onboarding"
import { cn } from "@/lib/utils"

// Support both SSE progress emails and DB emails
type EmailDisplay = {
  id?: string
  emailId?: string
  subject: string
  body?: string
  leadName?: string
  companyName?: string
  leadId: string
  step: number
  status?: "generating" | "done"
}

type LeadCardProps = {
  lead: LeadProgressItem
  emails: EmailDisplay[]
  isKorean: boolean
}

// Country code to flag emoji mapping
const countryFlags: Record<string, string> = {
  us: "🇺🇸",
  usa: "🇺🇸",
  jp: "🇯🇵",
  japan: "🇯🇵",
  kr: "🇰🇷",
  korea: "🇰🇷",
  cn: "🇨🇳",
  china: "🇨🇳",
  de: "🇩🇪",
  germany: "🇩🇪",
  gb: "🇬🇧",
  uk: "🇬🇧",
  fr: "🇫🇷",
  france: "🇫🇷",
  sg: "🇸🇬",
  singapore: "🇸🇬",
  ae: "🇦🇪",
  uae: "🇦🇪",
  vn: "🇻🇳",
  vietnam: "🇻🇳",
  th: "🇹🇭",
  thailand: "🇹🇭",
  id: "🇮🇩",
  indonesia: "🇮🇩",
  my: "🇲🇾",
  malaysia: "🇲🇾",
  au: "🇦🇺",
  australia: "🇦🇺",
}

function getCountryFlag(country?: string): string {
  if (!country) {
    return "🌐"
  }
  const normalized = country.toLowerCase().replace(/\s+/g, "")
  return countryFlags[normalized] || "🌐"
}

function getStatusIcon(status: LeadProgressItem["status"]) {
  switch (status) {
    case "discovering":
    case "enriching":
    case "generating":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "error":
      return <span className="h-4 w-4 text-red-500">✕</span>
    default:
      return <span className="h-4 w-4 text-gray-400">○</span>
  }
}

// 토스 스타일 상태 표현
function getStatusText(status: LeadProgressItem["status"], isKorean: boolean): string {
  switch (status) {
    case "discovering":
      return isKorean ? "찾는 중" : "Finding"
    case "enriching":
      return isKorean ? "연락처 확인 중" : "Getting contact"
    case "generating":
      return isKorean ? "이메일 쓰는 중" : "Writing email"
    case "done":
      return isKorean ? "준비 완료" : "Ready"
    case "error":
      return isKorean ? "문제 발생" : "Error"
    default:
      return isKorean ? "대기 중" : "Waiting"
  }
}

export function LeadCard({ lead, emails, isKorean }: LeadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasEmails = emails.length > 0
  const isComplete = lead.status === "done"

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        isComplete ? "border-green-200 bg-green-50/50" : "border-gray-200 bg-white",
        hasEmails && "cursor-pointer hover:shadow-sm",
      )}
    >
      {/* Lead Header */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: conditionally interactive based on hasEmails */}
      <div
        className="flex items-center justify-between p-3"
        onClick={hasEmails ? () => setIsExpanded(!isExpanded) : undefined}
        onKeyDown={
          hasEmails
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setIsExpanded(!isExpanded)
                }
              }
            : undefined
        }
        role={hasEmails ? "button" : undefined}
        tabIndex={hasEmails ? 0 : undefined}
      >
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
            {getStatusIcon(lead.status)}
          </div>

          {/* Company Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
              <span className="truncate font-medium text-gray-900 text-sm">{lead.companyName}</span>
              {lead.country && (
                <span className="flex-shrink-0 text-sm">{getCountryFlag(lead.country)}</span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-gray-500 text-xs">
              {lead.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {lead.email}
                </span>
              )}
              <span
                className={cn(
                  "rounded px-1.5 py-0.5",
                  lead.status === "done"
                    ? "bg-green-100 text-green-700"
                    : lead.status === "error"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700",
                )}
              >
                {getStatusText(lead.status, isKorean)}
              </span>
            </div>
          </div>
        </div>

        {/* Email Count & Expand Toggle */}
        {hasEmails && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 text-xs">
              <Mail className="h-3.5 w-3.5" />
              {emails.length}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </div>
        )}
      </div>

      {/* Expanded Email Preview */}
      {isExpanded && hasEmails && (
        <div className="border-gray-200 border-t bg-white p-3">
          <div className="space-y-3">
            {emails.map((email, index) => (
              <div
                className="rounded-md border border-gray-100 bg-gray-50 p-3"
                key={email.id || email.emailId || `${email.leadId}-${index}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-blue-600 text-xs">
                    <Mail className="h-3 w-3" />
                    {isKorean ? `Step ${index + 1}` : `Step ${index + 1}`}
                    {index === 0
                      ? isKorean
                        ? " (첫 인사)"
                        : " (Introduction)"
                      : isKorean
                        ? " (팔로업)"
                        : " (Follow-up)"}
                  </span>
                  {email.status === "generating" && (
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  )}
                </div>
                <p className="mb-2 font-medium text-gray-900 text-sm">
                  {isKorean ? "제목: " : "Subject: "}
                  {email.subject}
                </p>
                {email.body && (
                  <p className="line-clamp-3 whitespace-pre-line text-gray-600 text-xs">
                    {email.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
