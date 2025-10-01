import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  Panel,
  ReactFlow,
} from "@xyflow/react"
import { ArrowLeft, MessageSquare, Save } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate, useParams } from "react-router-dom"
import "@xyflow/react/dist/style.css"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSequence, useUpdateSequence } from "@/lib/api/hooks/sequences"
import { EmailManagementModal } from "./EmailManagementModal"
import { CommentNode } from "./nodes/CommentNode"
import { EmailDraftNode } from "./nodes/EmailDraftNode"
import { StartNode } from "./nodes/StartNode"
import { TimerNode } from "./nodes/TimerNode"

interface WorkflowData {
  nodes: Node[]
  edges: Edge[]
}

const nodeTypes = {
  start: StartNode,
  emailDraft: EmailDraftNode,
  timer: TimerNode,
  comment: CommentNode,
}

const initialNodes: Node[] = [
  {
    id: "start",
    type: "start",
    position: { x: 250, y: 50 },
    data: {},
  },
]

export default function SequenceDesigner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: sequence, isLoading } = useSequence(id || "")
  const updateSequence = useUpdateSequence()

  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // 이메일 관리 모달 상태
  const [emailManagementOpen, setEmailManagementOpen] = useState(false)
  const [selectedNodeForEmail, setSelectedNodeForEmail] = useState<Node | null>(null)

  // 최신 nodes와 edges를 참조하기 위한 ref
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  }, [nodes, edges])

  // Load workflow data from sequence
  useEffect(() => {
    if (sequence?.workflowData) {
      try {
        const workflowData: WorkflowData = JSON.parse(sequence.workflowData)

        // 노드 로드 시 타입별 기본값 보장
        const nodesWithDefaults = (workflowData.nodes || initialNodes).map((node) => {
          const data = { ...node.data }

          // 타이머 노드: delayDays 기본값 1
          if (node.type === "timer" && data.delayDays === undefined) {
            data.delayDays = 1
          }

          return {
            ...node,
            data,
          }
        })

        setNodes(nodesWithDefaults)
        setEdges(workflowData.edges || [])
        setHasChanges(false) // 로드 후 변경사항 초기화
      } catch (error) {
        console.error("Failed to parse workflow data:", error)
        toast.error("워크플로우 데이터를 불러오는데 실패했습니다")
      }
    } else {
      // Initialize with start node if no workflow data
      setNodes(initialNodes)
      setEdges([])
      setHasChanges(false)
    }
  }, [sequence?.workflowData]) // sequence 전체가 아닌 workflowData만 의존

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
    setHasChanges(true)
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
    setHasChanges(true)
  }, [])

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds))
    setHasChanges(true)
  }, [])

  const addNode = useCallback(
    (parentId: string, nodeType: string) => {
      const parentNode = nodes.find((n) => n.id === parentId)
      if (!parentNode) return

      const newNodeId = `${nodeType}-${Date.now()}`

      // 노드 타입별 기본 데이터 설정
      const defaultData: Record<string, unknown> = {}
      if (nodeType === "timer") {
        defaultData.delayDays = 1 // 타이머 기본값 1일
      } else if (nodeType === "emailDraft") {
        defaultData.generationMode = "manual" // 이메일 기본 모드
      } else if (nodeType === "comment") {
        defaultData.comment = "" // 주석 기본값
      }

      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: {
          x: parentNode.position.x,
          y: parentNode.position.y + 200,
        },
        data: defaultData,
      }

      const newEdge: Edge = {
        id: `${parentId}-${newNodeId}`,
        source: parentId,
        target: newNodeId,
        type: "default",
      }

      setNodes((nds) => [...nds, newNode])
      setEdges((eds) => [...eds, newEdge])
      setHasChanges(true)
    },
    [nodes]
  )

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setHasChanges(true)
  }, [])

  // 화면 중앙에 주석 노드 추가
  const addCommentNode = useCallback(() => {
    const newNodeId = `comment-${Date.now()}`

    // 현재 뷰포트의 중앙 위치 계산
    const centerX = window.innerWidth / 2 - 150 // 노드 너비의 절반
    const centerY = window.innerHeight / 2 - 100 // 노드 높이의 절반

    const newNode: Node = {
      id: newNodeId,
      type: "comment",
      position: { x: centerX, y: centerY },
      data: { comment: "" },
    }

    setNodes((nds) => [...nds, newNode])
    setHasChanges(true)
  }, [])

  const updateNodeData = useCallback((nodeId: string, data: unknown) => {
    console.log(`[Update Node Data] Node ${nodeId}:`, data)
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          const updatedNode = {
            ...n,
            data: {
              ...(typeof n.data === "object" && n.data !== null ? n.data : {}),
              ...(typeof data === "object" && data !== null ? data : {}),
            },
          }
          console.log(`[Update Node Data] Updated node:`, updatedNode)
          return updatedNode
        }
        return n
      })
    )
    setHasChanges(true)
  }, [])

  const handleManageEmails = useCallback((node: Node) => {
    setSelectedNodeForEmail(node)
    setEmailManagementOpen(true)
  }, [])

  // Inject callbacks and additional data into nodes
  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          nodeId: node.id,
          sequenceId: id,
          onAddNode: (type: string) => addNode(node.id, type),
          onDelete: node.type !== "start" ? () => deleteNode(node.id) : undefined,
          onUpdate: (data: unknown) => updateNodeData(node.id, data),
          onManageEmails: node.type === "emailDraft" ? () => handleManageEmails(node) : undefined,
        },
      })),
    [nodes, id, addNode, deleteNode, updateNodeData, handleManageEmails]
  )

  const handleSave = async () => {
    if (!id) return

    // 디버깅: 현재 nodes state 확인
    console.log("[Workflow Save] Current nodes state:", nodes)

    const workflowData: WorkflowData = {
      nodes: nodes.map((node) => {
        console.log(`[Workflow Save] Processing node ${node.id}:`, node.data)

        // 필요한 데이터만 선택적으로 저장
        const cleanData: Record<string, unknown> = {}

        if (node.data.subject !== undefined) cleanData.subject = node.data.subject
        if (node.data.bodyText !== undefined) cleanData.bodyText = node.data.bodyText
        if (node.data.generationMode !== undefined)
          cleanData.generationMode = node.data.generationMode
        if (node.data.aiPrompt !== undefined) cleanData.aiPrompt = node.data.aiPrompt
        if (node.data.useAI !== undefined) cleanData.useAI = node.data.useAI
        if (node.data.comment !== undefined) cleanData.comment = node.data.comment

        // 타이머 노드: delayDays 기본값 보장
        if (node.type === "timer") {
          cleanData.delayDays = node.data.delayDays !== undefined ? node.data.delayDays : 1
        } else if (node.data.delayDays !== undefined) {
          cleanData.delayDays = node.data.delayDays
        }

        console.log(`[Workflow Save] Clean data for ${node.id}:`, cleanData)

        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data: cleanData,
        }
      }),
      edges,
    }

    // 디버깅: 저장되는 데이터 확인
    console.log("[Workflow Save] Final workflow data:", JSON.stringify(workflowData, null, 2))

    try {
      await updateSequence.mutateAsync(
        {
          sequenceId: id,
          data: {
            workflowData: JSON.stringify(workflowData),
          },
        },
        {
          onSuccess: () => {
            setHasChanges(false)
            toast.success("워크플로우가 저장되었습니다")
          },
        }
      )
    } catch (error) {
      console.error("Failed to save workflow:", error)
      toast.error("워크플로우 저장에 실패했습니다")
    }
  }

  // 자동저장 (변경 후 3초 후 자동 저장)
  useEffect(() => {
    if (!hasChanges || !id) return

    const timer = setTimeout(async () => {
      // ref를 사용하여 최신 데이터 참조
      const currentNodes = nodesRef.current
      const currentEdges = edgesRef.current

      console.log("[Workflow Save] Auto-saving...")

      const workflowData: WorkflowData = {
        nodes: currentNodes.map((node) => {
          const cleanData: Record<string, unknown> = {}

          if (node.data.subject !== undefined) cleanData.subject = node.data.subject
          if (node.data.bodyText !== undefined) cleanData.bodyText = node.data.bodyText
          if (node.data.generationMode !== undefined)
            cleanData.generationMode = node.data.generationMode
          if (node.data.aiPrompt !== undefined) cleanData.aiPrompt = node.data.aiPrompt
          if (node.data.useAI !== undefined) cleanData.useAI = node.data.useAI
          if (node.data.comment !== undefined) cleanData.comment = node.data.comment

          if (node.type === "timer") {
            cleanData.delayDays = node.data.delayDays !== undefined ? node.data.delayDays : 1
          } else if (node.data.delayDays !== undefined) {
            cleanData.delayDays = node.data.delayDays
          }

          return {
            id: node.id,
            type: node.type,
            position: node.position,
            data: cleanData,
          }
        }),
        edges: currentEdges,
      }

      try {
        await updateSequence.mutateAsync(
          {
            sequenceId: id,
            data: {
              workflowData: JSON.stringify(workflowData),
            },
          },
          {
            onSuccess: () => {
              setHasChanges(false)
              console.log("[Workflow Save] Auto-save completed")
            },
          }
        )
      } catch (error) {
        console.error("Auto-save failed:", error)
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [hasChanges, id, updateSequence])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  if (!sequence) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">시퀀스를 찾을 수 없습니다</div>
      </div>
    )
  }

  return (
    <div className="h-[90vh] flex flex-col">
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/sequences")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{sequence.name}</h1>
              <p className="text-sm text-gray-500">워크플로우 디자이너</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            저장
            {hasChanges && <span className="ml-2 text-xs">(변경됨)</span>}
          </Button>
        </div>
      </Card>

      {/* React Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />

          {/* Figma 스타일 툴바 - 중앙 하단 */}
          <Panel position="bottom-center">
            <div className="bg-white shadow-lg rounded-lg border border-gray-200 px-4 py-2 mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addCommentNode}
                  className="flex items-center gap-2 hover:bg-yellow-50"
                  title="주석 노드 추가"
                >
                  <MessageSquare className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">주석</span>
                </Button>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Help Panel */}
      <Card className="rounded-none border-x-0 border-b-0 p-3">
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-600 rounded-full" />
            <span>시작 노드</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span>이메일 초안</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full" />
            <span>타이머</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full" />
            <span>주석</span>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs text-blue-600">3초 후 자동 저장...</span>
            </div>
          )}
        </div>
      </Card>

      {/* 이메일 관리 모달 */}
      {selectedNodeForEmail && id && (
        <EmailManagementModal
          open={emailManagementOpen}
          onOpenChange={setEmailManagementOpen}
          sequenceId={id}
          nodeId={selectedNodeForEmail.id}
          generationMode={
            (selectedNodeForEmail.data?.generationMode as "ai" | "manual") || "manual"
          }
          aiPrompt={selectedNodeForEmail.data?.aiPrompt as string | undefined}
          templateSubject={selectedNodeForEmail.data?.subject as string | undefined}
          templateBody={selectedNodeForEmail.data?.bodyText as string | undefined}
        />
      )}
    </div>
  )
}
