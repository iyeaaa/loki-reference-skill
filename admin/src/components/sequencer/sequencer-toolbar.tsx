"use client"

import { type Edge, type Node, Panel, Position, useReactFlow } from "@xyflow/react"
import { SortDesc, Upload } from "lucide-react"
import { NODE_TYPE_COLORS } from "@/components/sequencer/colors"
import { Button } from "@/components/ui/button"

export function SequencerToolbar() {
  const { addNodes, screenToFlowPosition, getNodes, getEdges, setNodes, setEdges, fitView } =
    useReactFlow()

  const addBuyerImportAtCenter = () => {
    const { innerWidth, innerHeight } = window
    const center = screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 })
    const id = `buyer-import-${Date.now()}`
    addNodes({
      id,
      type: "buyerImport",
      position: { x: center.x - 200, y: center.y - 60 },
      data: { title: "바이어 리스트 Import" },
    })
  }

  const borderClass = NODE_TYPE_COLORS.buyerImport.borderClass

  const elkOptions: Record<string, string> = {
    "elk.algorithm": "layered",
    "elk.layered.spacing.nodeNodeBetweenLayers": "100",
    "elk.spacing.nodeNode": "80",
  }

  const runElkLayout = async (direction: "DOWN" | "RIGHT") => {
    try {
      const { default: ELK } = await import("elkjs/lib/elk.bundled.js")
      const elk = new ELK()
      const nodes = getNodes() as Node[]
      const edges = getEdges() as Edge[]

      const isHorizontal = direction === "RIGHT"
      const graph: {
        id: string
        layoutOptions: Record<string, string>
        children: { id: string; width: number; height: number }[]
        edges: { id: string; sources: string[]; targets: string[] }[]
      } = {
        id: "root",
        layoutOptions: { ...elkOptions, "elk.direction": direction },
        children: nodes.map((n) => {
          const width = n.width ?? 384
          const height = n.height ?? 160
          return { id: n.id, width, height }
        }),
        edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      }

      const layouted = await elk.layout(graph)
      const posById: Record<string, { x: number; y: number }> = {}
      for (const c of layouted.children ?? []) {
        posById[c.id] = { x: c.x ?? 0, y: c.y ?? 0 }
      }

      setNodes((ns) =>
        ns.map((n) => {
          const p = posById[n.id]
          return p
            ? {
                ...n,
                position: { x: p.x, y: p.y },
                targetPosition: isHorizontal ? Position.Left : Position.Top,
                sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
              }
            : n
        })
      )
      setEdges((es) => es)
      fitView()
    } catch (e) {
      console.error("ELK layout error", e)
    }
  }

  return (
    <Panel
      position="bottom-left"
      style={{ left: "50%", transform: "translateX(-50%)", bottom: 16 }}
    >
      <div className="rounded-md border bg-card/80 backdrop-blur px-3 py-2 shadow-md">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={`nodrag h-9 gap-2 ${borderClass}`}
            onClick={addBuyerImportAtCenter}
            aria-label="바이어 임포트 노드 추가"
            title="바이어 리스트 Import"
          >
            <Upload className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="nodrag h-9"
            onClick={() => runElkLayout("DOWN")}
            aria-label="세로 정렬"
            title="세로 정렬"
          >
            <SortDesc className="size-4" />
          </Button>
        </div>
      </div>
    </Panel>
  )
}
