"use client";

import { memo, useState, useEffect } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  BaseNode,
  BaseNodeContent,
  BaseNodeFooter,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@/components/base-node";
import { Modal } from "@/components/ui/modal";
import { FileText, Trash, Sparkles, Check } from "lucide-react";
import { NODE_TYPE_COLORS } from "@/components/sequencer/colors";
import { generateEmailDraft } from "../../lib/openai-client";
import { NodeStatusIndicator } from "@/components/node-status-indicator";

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
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState<string>(data.subject ?? "");
    const [body, setBody] = useState<string>(data.body ?? "");
    const [saved, setSaved] = useState<boolean>(Boolean(data.subject));
    const [isGenerating, setIsGenerating] = useState(
      data.isGenerating ?? false,
    );
    const [generatedDraft, setGeneratedDraft] = useState<{
      subject: string;
      body: string;
    } | null>(null);
    const [prompt, setPrompt] = useState("");
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [nodeStatus, setNodeStatus] = useState<
      "initial" | "loading" | "success" | "error"
    >(data.nodeStatus ?? "initial");

    useEffect(() => {
      if (data.subject !== undefined) {
        setSubject(data.subject);
      }
      if (data.body !== undefined) {
        setBody(data.body);
      }
      if (data.isGenerating !== undefined) {
        setIsGenerating(data.isGenerating);
      }
      if (data.nodeStatus !== undefined) {
        setNodeStatus(data.nodeStatus);
      }
      if (data.subject !== undefined) {
        setSaved(Boolean(data.subject));
      }
    }, [data]);

    const handleSave = () => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                subject,
                body,
              },
            };
          }
          return node;
        }),
      );

      setSaved(true);
      setOpen(false);
    };

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
        data: { title: "발송", body, subject },
      });
      addEdges({ id: `${id}=>${nextId}`, source: id, target: nextId });
    };

    const handleDelete = () => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    };

    const handleGenerateAIDraft = async () => {
      if (!prompt.trim()) {
        alert("AI 초안 생성을 위한 프롬프트를 입력해주세요.");
        return;
      }

      setAiModalOpen(false);
      setIsGenerating(true);
      setNodeStatus("loading");

      try {
        const draft = await generateEmailDraft(prompt);
        setGeneratedDraft(draft);
        setNodeStatus("success");
      } catch (error) {
        console.error("AI 초안 생성 오류:", error);
        setNodeStatus("error");
      } finally {
        setIsGenerating(false);
      }
    };

    const handleApplyGeneratedDraft = (
      e: React.MouseEvent<HTMLButtonElement>,
    ) => {
      e.stopPropagation();
      e.preventDefault();

      if (generatedDraft) {
        setSubject(generatedDraft.subject);
        setBody(generatedDraft.body);

        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  subject: generatedDraft.subject,
                  body: generatedDraft.body,
                },
              };
            }
            return node;
          }),
        );

        setSaved(true);
        setGeneratedDraft(null);
        setNodeStatus("initial");
      }
    };

    const borderClass =
      nodeStatus === "initial" ? NODE_TYPE_COLORS.emailDraft.borderClass : "";

    const renderNodeContent = () => {
      if (isGenerating) {
        return (
          <div className="text-sm text-center py-4">
            <p className="mb-2">AI가 이메일 초안을 생성 중입니다...</p>
            <div className="animate-pulse">잠시만 기다려주세요</div>
          </div>
        );
      }

      if (generatedDraft) {
        return (
          <div className="text-sm space-y-4">
            <div>
              <div className="font-medium">AI 생성 제목:</div>
              <div className="mt-1 p-2 bg-muted/30 rounded">
                {generatedDraft.subject}
              </div>
            </div>
            <div>
              <div className="font-medium">AI 생성 본문:</div>
              <div className="mt-1 p-2 bg-muted/30 rounded max-h-40 overflow-y-auto whitespace-pre-wrap text-xs">
                {generatedDraft.body}
              </div>
            </div>
            <Button
              className="w-full nodrag"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleApplyGeneratedDraft(e);
              }}
              data-no-drag="true"
            >
              <Check className="mr-2 h-4 w-4" />
              AI 초안 적용하기
            </Button>
          </div>
        );
      }

      return (
        <>
          {saved ? (
            <div className="text-sm">
              <div className="font-medium">제목: {subject || "(제목 없음)"}</div>
              <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                {body || "(내용 없음)"}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">초안을 생성하세요.</div>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="nodrag flex-1"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen(true);
              }}
              data-no-drag="true"
            >
              초안 작성/수정
            </Button>
            <Button
              variant="outline"
              className="nodrag"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setAiModalOpen(true);
              }}
              data-no-drag="true"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </>
      );
    };

    return (
      <NodeStatusIndicator status={nodeStatus} variant="border">
        <BaseNode className={`w-96 ${borderClass} relative`}>
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
              {renderNodeContent()}
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

          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="이메일 초안 작성"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleSave}>저장</Button>
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              <label className="text-sm" htmlFor={`subject-${id}`}>
                제목
              </label>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                id={`subject-${id}`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="예: 제품 소개 및 제안"
              />
              <label className="mt-2 text-sm" htmlFor={`body-${id}`}>
                본문
              </label>
              <textarea
                className="h-40 w-full rounded border px-2 py-1 text-sm"
                id={`body-${id}`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`안녕하세요,\n...`}
              />
            </div>
          </Modal>

          <Modal
            open={aiModalOpen}
            onClose={() => setAiModalOpen(false)}
            title="AI로 초안 생성하기"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAiModalOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleGenerateAIDraft}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI 초안 생성
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              <label className="text-sm" htmlFor={`ai-prompt-${id}`}>
                어떤 이메일을 작성하고 싶으신가요?
              </label>
              <textarea
                className="h-40 w-full rounded border px-2 py-1 text-sm"
                id={`ai-prompt-${id}`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="예: 신규 고객에게 보내는 제품 소개 이메일을 작성해주세요. 제품은 화장품이고 주요 특징은 천연 성분으로 만들어졌다는 점입니다."
              />
            </div>
          </Modal>
        </BaseNode>
      </NodeStatusIndicator>
    );
  },
);

EmailDraftNode.displayName = "EmailDraftNode";


