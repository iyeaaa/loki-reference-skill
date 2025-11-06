import { Activity } from "lucide-react"
import type { ImportProgress } from "@/lib/api/services/lead-import"
import { LeadImportProgress } from "./LeadImportProgress"
import { SectionHeader } from "./SectionHeader"

interface LeadProgressSectionProps {
  progress: ImportProgress
}

export function LeadProgressSection({ progress }: LeadProgressSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader
        icon={<Activity className="h-3.5 w-3.5 text-blue-500" />}
        title="리드 추가 진행 상황"
      />
      <LeadImportProgress progress={progress} />
    </div>
  )
}
