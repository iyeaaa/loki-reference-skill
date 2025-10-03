/**
 * 워크플로우 검증 서비스
 */

interface WorkflowNode {
  id: string
  type: "start" | "emailDraft" | "timer" | "comment"
  position: { x: number; y: number }
  data: {
    subject?: string
    bodyText?: string
    delayDays?: number
    generationMode?: "ai" | "manual"
    aiPrompt?: string
    comment?: string
    [key: string]: unknown
  }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  type?: string
}

interface WorkflowData {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

interface ValidationError {
  field: string
  message: string
  nodeId?: string
}

export function validateWorkflow(workflowData: WorkflowData): {
  valid: boolean
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []

  // 1. 시작 노드 확인
  const startNode = workflowData.nodes.find((n) => n.type === "start")
  if (!startNode) {
    errors.push({
      field: "start",
      message: "워크플로우에 시작 노드가 필요합니다",
    })
  }

  // 2. 각 노드 타입별 검증
  workflowData.nodes.forEach((node) => {
    // 주석 노드는 검증 스킵
    if (node.type === "comment") {
      return
    }

    if (node.type === "emailDraft") {
      const mode = node.data.generationMode

      if (!mode) {
        errors.push({
          field: "generationMode",
          message: "이메일 생성 모드를 선택해주세요",
          nodeId: node.id,
        })
      } else if (mode === "ai") {
        if (!node.data.aiPrompt || node.data.aiPrompt.trim() === "") {
          errors.push({
            field: "aiPrompt",
            message: "AI 프롬프트를 입력해주세요",
            nodeId: node.id,
          })
        }
      } else if (mode === "manual") {
        if (!node.data.subject || node.data.subject.trim() === "") {
          errors.push({
            field: "subject",
            message: "이메일 제목을 입력해주세요",
            nodeId: node.id,
          })
        }
        if (!node.data.bodyText || node.data.bodyText.trim() === "") {
          errors.push({
            field: "bodyText",
            message: "이메일 본문을 입력해주세요",
            nodeId: node.id,
          })
        }
      }
    } else if (node.type === "timer") {
      if (!node.data.delayDays || node.data.delayDays < 1) {
        errors.push({
          field: "delayDays",
          message: "타이머 대기 시간을 1일 이상으로 설정해주세요",
          nodeId: node.id,
        })
      }
    }
  })

  // 3. 연결 검증
  const connectedNodes = new Set<string>()
  workflowData.edges.forEach((edge) => {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  })

  workflowData.nodes.forEach((node) => {
    // 시작 노드와 주석 노드는 제외
    if (node.type !== "start" && node.type !== "comment" && !connectedNodes.has(node.id)) {
      errors.push({
        field: "connection",
        message: "연결되지 않은 노드가 있습니다",
        nodeId: node.id,
      })
    }
  })

  // 4. 순환 참조 검증 (간단한 구현)
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) return true
    if (visited.has(nodeId)) return false

    visited.add(nodeId)
    recursionStack.add(nodeId)

    const outgoingEdges = workflowData.edges.filter((e) => e.source === nodeId)
    for (const edge of outgoingEdges) {
      if (hasCycle(edge.target)) return true
    }

    recursionStack.delete(nodeId)
    return false
  }

  if (startNode && hasCycle(startNode.id)) {
    errors.push({
      field: "cycle",
      message: "워크플로우에 순환 참조가 있습니다",
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// 워크플로우 데이터 파싱 및 검증
export function parseAndValidateWorkflow(workflowDataJson: string): {
  valid: boolean
  workflowData?: WorkflowData
  errors: ValidationError[]
} {
  try {
    const workflowData = JSON.parse(workflowDataJson) as WorkflowData

    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      return {
        valid: false,
        errors: [{ field: "nodes", message: "워크플로우 노드 데이터가 유효하지 않습니다" }],
      }
    }

    if (!workflowData.edges || !Array.isArray(workflowData.edges)) {
      return {
        valid: false,
        errors: [{ field: "edges", message: "워크플로우 연결 데이터가 유효하지 않습니다" }],
      }
    }

    const validation = validateWorkflow(workflowData)

    return {
      ...validation,
      workflowData,
    }
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          field: "json",
          message: `JSON 파싱 실패: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    }
  }
}
