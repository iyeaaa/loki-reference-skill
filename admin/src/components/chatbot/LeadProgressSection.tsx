import { Activity } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ImportProgress } from "@/lib/api/services/lead-import"
import { LeadImportProgress } from "./LeadImportProgress"
import { SectionHeader } from "./SectionHeader"

interface LeadProgressSectionProps {
  progress: ImportProgress
}

export function LeadProgressSection({ progress }: LeadProgressSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={<Activity className="h-3.5 w-3.5 text-blue-500" />}
        title={t("chatbot.leadProgress.inProgress")}
      />
      <LeadImportProgress progress={progress} />
    </div>
  )
}
