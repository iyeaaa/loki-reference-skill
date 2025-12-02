import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

export interface NodeProgress {
  nodeName: string
  status: "pending" | "in_progress" | "completed" | "error"
  message?: string
  percent?: number
  timestamp: number
}

interface NodeProgressTrackerProps {
  progress: NodeProgress[]
  className?: string
}

// Node metadata keys for translations
const NODE_KEYS: Record<
  string,
  {
    nameKey: string
    descKey: string
    loadingKey: string
    order: number
  }
> = {
  analyze: {
    nameKey: "chatbot.nodeProgress.analyze.name",
    descKey: "chatbot.nodeProgress.analyze.desc",
    loadingKey: "chatbot.nodeProgress.analyze.loading",
    order: 1,
  },
  analyzeQuestion: {
    nameKey: "chatbot.nodeProgress.analyze.name",
    descKey: "chatbot.nodeProgress.analyze.desc",
    loadingKey: "chatbot.nodeProgress.analyze.loading",
    order: 1,
  },
  generateSQL: {
    nameKey: "chatbot.nodeProgress.generateSQL.name",
    descKey: "chatbot.nodeProgress.generateSQL.desc",
    loadingKey: "chatbot.nodeProgress.generateSQL.loading",
    order: 2,
  },
  validateSQL: {
    nameKey: "chatbot.nodeProgress.validateSQL.name",
    descKey: "chatbot.nodeProgress.validateSQL.desc",
    loadingKey: "chatbot.nodeProgress.validateSQL.loading",
    order: 3,
  },
  executeQuery: {
    nameKey: "chatbot.nodeProgress.executeQuery.name",
    descKey: "chatbot.nodeProgress.executeQuery.desc",
    loadingKey: "chatbot.nodeProgress.executeQuery.loading",
    order: 4,
  },
  executeSequential: {
    nameKey: "chatbot.nodeProgress.executeSequential.name",
    descKey: "chatbot.nodeProgress.executeSequential.desc",
    loadingKey: "chatbot.nodeProgress.executeSequential.loading",
    order: 4,
  },
  analyzeResults: {
    nameKey: "chatbot.nodeProgress.analyzeResults.name",
    descKey: "chatbot.nodeProgress.analyzeResults.desc",
    loadingKey: "chatbot.nodeProgress.analyzeResults.loading",
    order: 5,
  },
  generateInsights: {
    nameKey: "chatbot.nodeProgress.generateInsights.name",
    descKey: "chatbot.nodeProgress.generateInsights.desc",
    loadingKey: "chatbot.nodeProgress.generateInsights.loading",
    order: 6,
  },
  suggestVisualizations: {
    nameKey: "chatbot.nodeProgress.suggestVisualizations.name",
    descKey: "chatbot.nodeProgress.suggestVisualizations.desc",
    loadingKey: "chatbot.nodeProgress.suggestVisualizations.loading",
    order: 7,
  },
  generateFollowUps: {
    nameKey: "chatbot.nodeProgress.generateFollowUps.name",
    descKey: "chatbot.nodeProgress.generateFollowUps.desc",
    loadingKey: "chatbot.nodeProgress.generateFollowUps.loading",
    order: 8,
  },
  generateFollowUpQuestions: {
    nameKey: "chatbot.nodeProgress.generateFollowUps.name",
    descKey: "chatbot.nodeProgress.generateFollowUps.desc",
    loadingKey: "chatbot.nodeProgress.generateFollowUps.loading",
    order: 8,
  },
  formatResponse: {
    nameKey: "chatbot.nodeProgress.formatResponse.name",
    descKey: "chatbot.nodeProgress.formatResponse.desc",
    loadingKey: "chatbot.nodeProgress.formatResponse.loading",
    order: 9,
  },
  handleError: {
    nameKey: "chatbot.nodeProgress.handleError.name",
    descKey: "chatbot.nodeProgress.handleError.desc",
    loadingKey: "chatbot.nodeProgress.handleError.loading",
    order: 10,
  },
}

function NodeProgressItem({ node }: { node: NodeProgress }) {
  const { t } = useTranslation()
  const nodeKey = NODE_KEYS[node.nodeName]
  const displayName = nodeKey ? t(nodeKey.nameKey) : node.nodeName
  // Use translated loading message instead of server message
  const loadingMessage = nodeKey ? t(nodeKey.loadingKey) : node.message

  const getIcon = () => {
    switch (node.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case "error":
        return <Circle className="h-4 w-4 text-red-600" />
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/40" />
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-1.5 transition-opacity",
        node.status === "pending" && "opacity-40",
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              node.status === "completed" && "text-green-700",
              node.status === "in_progress" && "text-blue-700",
              node.status === "error" && "text-red-700",
              node.status === "pending" && "text-muted-foreground",
            )}
          >
            {displayName}
          </span>
          {node.status === "in_progress" && node.percent !== undefined && (
            <span className="text-xs text-muted-foreground">({node.percent}%)</span>
          )}
        </div>
        {node.status === "in_progress" && loadingMessage && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{loadingMessage}</p>
        )}
      </div>
    </div>
  )
}

export function NodeProgressTracker({ progress, className }: NodeProgressTrackerProps) {
  const { t } = useTranslation()

  if (progress.length === 0) return null

  // Get unique nodes (only show latest status for each node)
  const uniqueNodes = progress.reduce((acc, node) => {
    const existing = acc.find((n) => n.nodeName === node.nodeName)
    if (!existing || existing.timestamp < node.timestamp) {
      return [...acc.filter((n) => n.nodeName !== node.nodeName), node]
    }
    return acc
  }, [] as NodeProgress[])

  // Sort by order
  const sortedNodes = uniqueNodes.sort((a, b) => {
    const orderA = NODE_KEYS[a.nodeName]?.order ?? 99
    const orderB = NODE_KEYS[b.nodeName]?.order ?? 99
    return orderA - orderB
  })

  return (
    <div className={cn("rounded-lg border bg-muted/30 p-3 space-y-1", className)}>
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {t("chatbot.nodeProgress.title")}
      </div>
      {sortedNodes.map((node) => (
        <NodeProgressItem key={`${node.nodeName}-${node.timestamp}`} node={node} />
      ))}
    </div>
  )
}
