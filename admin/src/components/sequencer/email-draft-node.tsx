"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  BaseNode,
  BaseNodeContent,
  BaseNodeFooter,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@/components/base-node";
import { FileText, SparkleIcon, Trash } from "lucide-react";
import EmailDraftModal from "../email-draft-modal";
import { useAtom } from "jotai";
import { leadsAtom, emailDraftsAtom } from "@/lib/atoms";
import { generateEmailDraftsForLeads } from "@/lib/openai-client";
import { NodeStatusIndicator } from "../node-status-indicator";
import { useSequenceControl } from "@/lib/sequence-control-context";

type DraftData = {
  title?: string;
  subject?: string;
  body?: string;
  isGenerating?: boolean;
  nodeStatus?: "initial" | "loading" | "success" | "error";
};

export const EmailDraftNode = memo(
  ({ data, id }: { data: DraftData; id: string }) => {
    const { addNodes, addEdges, getNode, setNodes, setEdges } = useReactFlow();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [leads] = useAtom(leadsAtom);
    const [, setEmailDrafts] = useAtom(emailDraftsAtom);
    const [isBatchGenerating, setIsBatchGenerating] = useState(false);
    const { registerExecutor } = useSequenceControl();

    const handleDelete = () => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    };

    const handleOpenModal = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsModalOpen(true);
    };

    const handleCloseModal = () => {
      setIsModalOpen(false);
    };

    const generateAllDrafts = useCallback(async () => {
      if (isBatchGenerating) return;
      if (!leads || leads.length === 0) return;
      try {
        setIsBatchGenerating(true);
        const results = await generateEmailDraftsForLeads(leads);
        setEmailDrafts((prev) => {
          const next = { ...prev } as Record<
            string,
            { subject: string; body: string }
          >;
          for (const r of results) {
            next[r.leadId] = { subject: r.subject, body: r.body };
          }
          return next as typeof prev;
        });
      } finally {
        setIsBatchGenerating(false);
      }
    }, [isBatchGenerating, leads, setEmailDrafts]);

    const handleBatchGenerate = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      void generateAllDrafts();
    };

    useEffect(() => {
      const unregister = registerExecutor?.(() => generateAllDrafts());
      return () => {
        unregister && unregister();
      };
    }, [registerExecutor, generateAllDrafts]);

    const handleAddSend = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();

      const me = getNode(id);
      const x = me?.position.x ?? 0;
      const parentHeight = me?.height ?? 160;
      const verticalGap = 60;
      const y = (me?.position.y ?? 0) + parentHeight + verticalGap;
      const nextId = `send-${Date.now()}`;
      addNodes({
        id: nextId,
        type: "sendNode",
        position: { x, y },
        data: { title: "발송" },
      });
      addEdges({ id: `${id}=>${nextId}`, source: id, target: nextId });
    };

    return (
      <NodeStatusIndicator
        status={isBatchGenerating ? "loading" : "initial"}
        variant="border"
      >
        <BaseNode className={`w-96 relative`}>
          <BaseNodeHeader className="border-b relative z-10">
            <div className="flex items-center gap-2">
              <FileText className="size-4" />
              <BaseNodeHeaderTitle>
                {data.title ?? "이메일 초안"}
              </BaseNodeHeaderTitle>
            </div>
            <Button
              variant="outline"
              className="nodrag ml-auto h-7 px-2"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDelete();
              }}
              data-no-drag="true"
              aria-label="노드 삭제"
            >
              <Trash className="size-4" />
            </Button>
          </BaseNodeHeader>
          <BaseNodeContent>
            <section data-no-drag="true" className="w-full">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenModal}
                data-no-drag="true"
              >
                이메일 초안 확인하기
              </Button>
              <Button
                variant="default"
                className="w-full bg-black text-white mt-2"
                data-no-drag="true"
                onClick={handleBatchGenerate}
                disabled={isBatchGenerating || (leads?.length ?? 0) === 0}
              >
                <SparkleIcon className="size-4" />
                {isBatchGenerating ? "생성 중..." : "이메일 초안 일괄 작성"}
              </Button>
            </section>
          </BaseNodeContent>
          <BaseNodeFooter>
            <Button
              className="nodrag w-full"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleAddSend(e);
              }}
              data-no-drag="true"
            >
              + 발송 노드 추가
            </Button>
          </BaseNodeFooter>

          <Handle type="target" position={Position.Top} />
          <Handle type="source" position={Position.Bottom} />
        </BaseNode>

        {/* Email Draft Modal */}
        <EmailDraftModal open={isModalOpen} onClose={handleCloseModal} />
      </NodeStatusIndicator>
    );
  }
);

EmailDraftNode.displayName = "EmailDraftNode";
