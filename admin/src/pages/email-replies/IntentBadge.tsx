import { Calendar, Coffee, HelpCircle, Minus, ThumbsDown, ThumbsUp, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { EmailIntent } from "@/lib/api/types/email"

type IntentBadgeProps = {
  intent: EmailIntent | null | undefined
  size?: "sm" | "md" | "lg"
}

type IntentConfig = {
  label: string
  color: string
  icon: React.ComponentType<{ className?: string }>
}

const intentConfig: Record<EmailIntent, IntentConfig> = {
  meeting_request: {
    label: "Meeting Request",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    icon: Calendar,
  },
  question: {
    label: "Question",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    icon: HelpCircle,
  },
  objection: {
    label: "Objection",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    icon: XCircle,
  },
  out_of_office: {
    label: "Out of Office",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: Coffee,
  },
  not_interested: {
    label: "Not Interested",
    color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    icon: ThumbsDown,
  },
  positive_interest: {
    label: "Positive Interest",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    icon: ThumbsUp,
  },
  neutral: {
    label: "Neutral",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    icon: Minus,
  },
}

export function IntentBadge({ intent, size = "md" }: IntentBadgeProps) {
  if (!intent) {
    return null
  }

  const config = intentConfig[intent]
  if (!config) {
    return null
  }

  const Icon = config.icon

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }

  return (
    <Badge
      className={`${config.color} ${sizeClasses[size]} flex w-fit items-center gap-1.5 rounded-full border font-medium`}
      variant="outline"
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </Badge>
  )
}

// Helper function to get intent label without rendering component
export function getIntentLabel(intent: EmailIntent | null | undefined): string {
  if (!intent) {
    return ""
  }
  return intentConfig[intent]?.label || ""
}

// Helper function to get intent color class
export function getIntentColor(intent: EmailIntent | null | undefined): string {
  if (!intent) {
    return ""
  }
  return intentConfig[intent]?.color || ""
}
