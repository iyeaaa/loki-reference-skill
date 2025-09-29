"use client";

import { memo, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  BaseNode,
  BaseNodeContent,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@/components/base-node";
import { GitBranch, Trash } from "lucide-react";
import { NODE_TYPE_COLORS } from "@/components/sequencer/colors";

type BranchData = { title?: string; branches?: string[] };

export const BranchNode = memo(({ data, id }: { data: BranchData; id: string }) => {
  const { addNodes, addEdges, getNode, setNodes, setEdges } = useReactFlow();
  const [branches, setBranches] = useState<string[]>(data.branches ?? []);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newBranch, setNewBranch] = useState("");

  const createChild = (label: string, offsetX: number) => {
    const me = getNode(id);
    const baseX = me?.position.x ?? 0;
    const x = baseX + offsetX;
    const parentHeight = me?.height ?? 160;
    const verticalGap = 60;
    const y = (me?.position.y ?? 0) + parentHeight + verticalGap;
    const nodeId = `action-${label}-${Date.now()}`;
    addNodes({ id: nodeId, type: "emailDraft", position: { x, y }, data: { title: `${label} 후속 조치` } });
    addEdges({ id: `${id}=>${nodeId}`, source: id, target: nodeId, label });
  };

  const handleDelete = () => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  };

  const borderClass = NODE_TYPE_COLORS.branchNode.borderClass;
  return (
    <BaseNode className={`w-96 ${borderClass}`}>
      <BaseNodeHeader className="border-b">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4" />
          <BaseNodeHeaderTitle>{data.title ?? "응답 분기"}</BaseNodeHeaderTitle>
        </div>
        <Button variant="outline" className="nodrag ml-auto h-7 px-2" onClick={handleDelete} aria-label="노드 삭제">
          <Trash className="size-4" />
        </Button>
      </BaseNodeHeader>
      <BaseNodeContent>
        <div className="text-sm text-muted-foreground">수신자 응답 유형에 따라 분기합니다.</div>
        <div className="flex flex-wrap items-center gap-2">
          {branches.map((label, i) => {
            const side = i % 2 === 0 ? -1 : 1;
            const step = Math.floor(i / 2);
            const offset = side * (180 + step * 60);
            return (
              <Button key={label} className="nodrag" variant="outline" onClick={() => createChild(label, offset)} title={label}>
                {label}
              </Button>
            );
          })}
          <Button type="button" className="nodrag h-8 w-8 p-0" variant="outline" aria-label="분기 추가" title="분기 추가" onClick={() => setIsAddOpen(true)}>
            +
          </Button>
        </div>
      </BaseNodeContent>

      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="새 분기 추가"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>취소</Button>
            <Button
              type="button"
              onClick={() => {
                const label = newBranch.trim();
                if (!label) return;
                if (branches.includes(label)) {
                  setIsAddOpen(false);
                  setNewBranch("");
                  return;
                }
                setBranches((prev) => {
                  const next = [...prev, label];
                  setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...(n.data as BranchData), branches: next } } : n)));
                  return next;
                });
                setIsAddOpen(false);
                setNewBranch("");
              }}
            >
              추가
            </Button>
          </div>
        }
      >
        <label className="text-sm" htmlFor={`branch-input-${id}`}>분기 라벨</label>
        <input
          id={`branch-input-${id}`}
          className="mt-2 w-full rounded border px-2 py-1 text-sm"
          value={newBranch}
          onChange={(e) => setNewBranch(e.target.value)}
          placeholder="예: 견적 요청, 후속 일정 제안"
        />
      </Modal>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </BaseNode>
  );
});

BranchNode.displayName = "BranchNode";


