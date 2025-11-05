import { CheckCircle2, Circle, Loader2 } from "lucide-react"
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

// Node metadata for display
const NODE_METADATA: Record<
  string,
  {
    displayName: string
    description: string
    order: number
  }
> = {
  analyze: {
    displayName: "질문 분석",
    description: "질문 의도를 파악하고 필요한 데이터 확인 중",
    order: 1,
  },
  generateSQL: {
    displayName: "쿼리 생성",
    description: "데이터베이스 쿼리 작성 중",
    order: 2,
  },
  validateSQL: {
    displayName: "쿼리 검증",
    description: "쿼리 안전성 및 유효성 검증 중",
    order: 3,
  },
  executeQuery: {
    displayName: "쿼리 실행",
    description: "데이터베이스에서 데이터 조회 중",
    order: 4,
  },
  executeSequential: {
    displayName: "순차 쿼리 실행",
    description: "여러 쿼리를 순차적으로 실행 중",
    order: 4,
  },
  analyzeResults: {
    displayName: "결과 분석",
    description: "조회된 데이터를 분석 중",
    order: 5,
  },
  generateInsights: {
    displayName: "인사이트 생성",
    description: "데이터에서 유의미한 패턴 발견 중",
    order: 6,
  },
  suggestVisualizations: {
    displayName: "시각화 제안",
    description: "최적의 차트 및 그래프 추천 중",
    order: 7,
  },
  generateFollowUps: {
    displayName: "후속 질문 생성",
    description: "관련 질문 제안 생성 중",
    order: 8,
  },
  formatResponse: {
    displayName: "응답 준비",
    description: "최종 응답 포맷팅 중",
    order: 9,
  },
  handleError: {
    displayName: "오류 처리",
    description: "오류 메시지 생성 중",
    order: 10,
  },
}

function NodeProgressItem({ node }: { node: NodeProgress }) {
  const metadata = NODE_METADATA[node.nodeName] || {
    displayName: node.nodeName,
    description: node.message || "",
    order: 99,
  }

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
            {metadata.displayName}
          </span>
          {node.status === "in_progress" && node.percent !== undefined && (
            <span className="text-xs text-muted-foreground">({node.percent}%)</span>
          )}
        </div>
        {node.status === "in_progress" && node.message && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{node.message}</p>
        )}
      </div>
    </div>
  )
}

export function NodeProgressTracker({ progress, className }: NodeProgressTrackerProps) {
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
    const orderA = NODE_METADATA[a.nodeName]?.order ?? 99
    const orderB = NODE_METADATA[b.nodeName]?.order ?? 99
    return orderA - orderB
  })

  return (
    <div className={cn("rounded-lg border bg-muted/30 p-3 space-y-1", className)}>
      <div className="text-xs font-medium text-muted-foreground mb-2">Processing Steps</div>
      {sortedNodes.map((node) => (
        <NodeProgressItem key={`${node.nodeName}-${node.timestamp}`} node={node} />
      ))}
    </div>
  )
}
