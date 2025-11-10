import { CheckCircle2 } from "lucide-react"
import type { ImportResult } from "@/lib/api/services/lead-import"
import { LeadImportArtifact } from "./LeadImportArtifact"
import type { ProgressLog } from "./ProgressLogger"
import { SectionHeader } from "./SectionHeader"

interface LeadResultSectionProps {
  result: ImportResult
  progressLogs?: ProgressLog[]
  startTime?: number
  onGenerateSequence?: (groupId: string, groupName: string, membersAdded: number) => void
}

export function LeadResultSection({
  result,
  progressLogs,
  startTime,
  onGenerateSequence,
}: LeadResultSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader
        icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
        title="Lead Import Complete"
      />
      <LeadImportArtifact
        result={result}
        progressLogs={progressLogs}
        startTime={startTime}
        customerGroupId={result.groupAssignment?.groupId}
        customerGroupName={result.groupAssignment?.groupName}
        membersAdded={result.groupAssignment?.membersAdded}
        onGenerateSequence={onGenerateSequence}
      />
    </div>
  )
}
