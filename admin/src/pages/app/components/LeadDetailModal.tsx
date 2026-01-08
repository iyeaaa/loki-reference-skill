import { ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { CompanyAvatar } from "@/components/CompanyAvatar"
import { CountryFlag } from "@/components/CountryFlag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

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
}

type LeadDetailModalProps = {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  selectedLeadIds: string[]
  toggleLead: (id: string) => void
  isKorean: boolean
}

export function LeadDetailModal({
  lead,
  isOpen,
  onClose,
  selectedLeadIds,
  toggleLead,
  isKorean,
}: LeadDetailModalProps) {
  const getSizeLabel = (employeeCount?: string) => {
    if (!employeeCount) {
      return null
    }
    const count = employeeCount.toLowerCase()
    if (count.includes("1000") || count === "enterprise") {
      return isKorean ? "대기업" : "Enterprise"
    }
    if (count.includes("250") || count === "large") {
      return isKorean ? "대기업" : "Large"
    }
    if (count.includes("50") || count === "medium") {
      return isKorean ? "중기업" : "Medium"
    }
    if (count.includes("10") || count === "small") {
      return isKorean ? "소기업" : "Small"
    }
    return employeeCount
  }

  if (!lead) {
    return null
  }

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <CompanyAvatar companyName={lead.companyName} size="md" websiteUrl={lead.websiteUrl} />
            <span>{lead.companyName}</span>
            {getSizeLabel(lead.employeeCount) && (
              <Badge variant="secondary">{getSizeLabel(lead.employeeCount)}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Description */}
          {lead.description && (
            <div>
              <Label className="text-gray-500 text-xs">{isKorean ? "설명" : "Description"}</Label>
              <p className="mt-1 text-gray-700 text-sm leading-relaxed">{lead.description}</p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-500 text-xs">{isKorean ? "이메일" : "Email"}</Label>
              <p className="mt-1 text-gray-900 text-sm">
                {lead.email || (
                  <span className="text-gray-400 italic">
                    {isKorean ? "없음" : "Not available"}
                  </span>
                )}
              </p>
            </div>
            <div>
              <Label className="text-gray-500 text-xs">{isKorean ? "국가" : "Country"}</Label>
              <p className="mt-1 text-gray-900 text-sm">
                {lead.country ? (
                  <span className="flex items-center gap-1.5">
                    <CountryFlag countryName={lead.country} size="md" />
                    <span>{lead.country}</span>
                  </span>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <Label className="text-gray-500 text-xs">{isKorean ? "업종" : "Industry"}</Label>
              <p className="mt-1 text-gray-900 text-sm">
                {lead.businessType || lead.industry || "-"}
              </p>
            </div>
            <div>
              <Label className="text-gray-500 text-xs">{isKorean ? "직원 수" : "Employees"}</Label>
              <p className="mt-1 text-gray-900 text-sm">{lead.employeeCount || "-"}</p>
            </div>
            {lead.contactName && (
              <div>
                <Label className="text-gray-500 text-xs">{isKorean ? "담당자" : "Contact"}</Label>
                <p className="mt-1 text-gray-900 text-sm">{lead.contactName}</p>
              </div>
            )}
          </div>

          {/* Website */}
          {lead.websiteUrl && (
            <div>
              <Label className="text-gray-500 text-xs">{isKorean ? "웹사이트" : "Website"}</Label>
              <a
                className="mt-1 flex items-center gap-1 text-blue-600 text-sm hover:underline"
                href={lead.websiteUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {lead.websiteUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            {isKorean ? "닫기" : "Close"}
          </Button>
          {lead.email && (
            <Button
              onClick={() => {
                const isSelected = selectedLeadIds.includes(lead.id)
                toggleLead(lead.id)
                toast.success(
                  isSelected
                    ? isKorean
                      ? "선택 해제됨"
                      : "Deselected"
                    : isKorean
                      ? "선택됨"
                      : "Selected",
                )
              }}
              variant={selectedLeadIds.includes(lead.id) ? "secondary" : "default"}
            >
              {selectedLeadIds.includes(lead.id)
                ? isKorean
                  ? "선택 해제"
                  : "Deselect"
                : isKorean
                  ? "선택"
                  : "Select"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
