"use client"

import type {
  Edge,
  FitViewOptions,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from "@xyflow/react"
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useAtom } from "jotai"
import { useCallback, useMemo } from "react"
import { BranchNode } from "@/components/sequencer/branch-node"

import { BuyerImportNode } from "@/components/sequencer/buyer-import-node"
import { NODE_TYPE_COLORS } from "@/components/sequencer/colors"
import { EmailDraftNode } from "@/components/sequencer/email-draft-node"
import { SendNode } from "@/components/sequencer/send-node"
import { SequencerToolbar } from "@/components/sequencer/sequencer-toolbar"
import { currentFlowStateAtom } from "@/lib/workspace"

const fitViewOptions: FitViewOptions = {
  padding: "100px",
}

export default function ReactFlowApp() {
  const nodeTypes = useMemo(
    () => ({
      buyerImport: BuyerImportNode,
      emailDraft: EmailDraftNode,
      sendNode: SendNode,
      branchNode: BranchNode,
    }),
    []
  )

  const [flow, setFlow] = useAtom(currentFlowStateAtom)
  const nodes = flow.nodes as Node[]
  const edges = flow.edges as Edge[]

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setFlow((prev) => ({ ...prev, nodes: applyNodeChanges(changes, prev.nodes as Node[]) }))
    },
    [setFlow]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setFlow((prev) => ({ ...prev, edges: applyEdgeChanges(changes, prev.edges as Edge[]) }))
    },
    [setFlow]
  )

  const onConnect: OnConnect = useCallback(
    (params) =>
      setFlow((prev) => ({ ...prev, edges: addEdge({ ...params }, prev.edges as Edge[]) })),
    [setFlow]
  )

  // autosave는 atomWithStorage로 즉시 반영되므로 별도 effect 불필요

  const miniMapNodeColor = useCallback((node: Node) => {
    const type = node.type as keyof typeof NODE_TYPE_COLORS
    return NODE_TYPE_COLORS[type]?.miniMap ?? "#9ca3af"
  }, [])

  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            type: "bezier",
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
              color: "#94a3b8",
            },
            style: { stroke: "#94a3b8" },
          }}
          fitView
          fitViewOptions={fitViewOptions}
        >
          <Background />
          <MiniMap nodeColor={miniMapNodeColor} />
          <SequencerToolbar />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
