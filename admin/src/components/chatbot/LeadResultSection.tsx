import { CheckCircle2 } from "lucide-react"
import type { ImportResult } from "@/lib/api/services/lead-import"
import { LeadImportArtifact } from "./LeadImportArtifact"
import type { ProgressLog } from "./ProgressLogger"
import { SectionHeader } from "./SectionHeader"

interface LeadResultSectionProps {
  result: ImportResult
  progressLogs?: ProgressLog[]
  startTime?: number
}

export function LeadResultSection({ result, progressLogs, startTime }: LeadResultSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader
        icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
        title="리드 추가 완료"
      />
      <LeadImportArtifact result={result} progressLogs={progressLogs} startTime={startTime} />
    </div>
  )
}
