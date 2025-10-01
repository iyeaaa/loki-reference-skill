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
  ReactFlow,
} from "@xyflow/react"
import { ArrowLeft, Save } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate, useParams } from "react-router-dom"
import "@xyflow/react/dist/style.css"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSequence, useUpdateSequence } from "@/lib/api/hooks/sequences"
import { EmailManagementModal } from "./EmailManagementModal"
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

  // Load workflow data from sequence
  useEffect(() => {
    if (sequence?.workflowData) {
      try {
        const workflowData: WorkflowData = JSON.parse(sequence.workflowData)
        setNodes(workflowData.nodes || initialNodes)
        setEdges(workflowData.edges || [])
      } catch (error) {
        console.error("Failed to parse workflow data:", error)
        toast.error("워크플로우 데이터를 불러오는데 실패했습니다")
      }
    } else {
      // Initialize with start node if no workflow data
      setNodes(initialNodes)
      setEdges([])
    }
  }, [sequence])

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
      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: {
          x: parentNode.position.x,
          y: parentNode.position.y + 200,
        },
        data: {},
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

  const updateNodeData = useCallback((nodeId: string, data: unknown) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...(typeof n.data === "object" && n.data !== null ? n.data : {}),
              ...(typeof data === "object" && data !== null ? data : {}),
            },
          }
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

  const handleSave = useCallback(async () => {
    if (!id) return

    const workflowData: WorkflowData = {
      nodes: nodes.map((node) => ({
        ...node,
        // 모든 data 필드 보존
        data: {
          ...node.data,
          // 필요한 필드만 명시적으로 저장 (callbacks 등 제거)
          subject: node.data.subject,
          bodyText: node.data.bodyText,
          delayDays: node.data.delayDays,
          generationMode: node.data.generationMode,
          aiPrompt: node.data.aiPrompt,
          useAI: node.data.useAI,
          // callbacks 제거
          onAddNode: undefined,
          onDelete: undefined,
          onUpdate: undefined,
          onManageEmails: undefined,
          nodeId: undefined,
          sequenceId: undefined,
        },
      })),
      edges,
    }

    try {
      await updateSequence.mutateAsync({
        sequenceId: id,
        data: {
          workflowData: JSON.stringify(workflowData),
        },
      })
      setHasChanges(false)
      toast.success("워크플로우가 저장되었습니다")
    } catch (error) {
      console.error("Failed to save workflow:", error)
      toast.error("워크플로우 저장에 실패했습니다")
    }
  }, [id, nodes, edges, updateSequence])

  // 자동저장 (변경 후 3초 후 자동 저장)
  useEffect(() => {
    if (!hasChanges || !id) return

    const timer = setTimeout(() => {
      handleSave()
    }, 3000) // 3초 debounce

    return () => clearTimeout(timer)
  }, [hasChanges, id, handleSave])

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
    <div className="h-screen flex flex-col">
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
