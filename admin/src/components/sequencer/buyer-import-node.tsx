"use client";

import { memo, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  BaseNode,
  BaseNodeContent,
  BaseNodeFooter,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@/components/base-node";
import { Modal } from "@/components/ui/modal";
import {
  Upload,
  Trash,
  Plus,
  FileSpreadsheet,
  X,
  Play,
  Loader2,
} from "lucide-react";
import { NODE_TYPE_COLORS } from "@/components/sequencer/colors";
import { useAtom } from "jotai";
import { leadsAtom } from "../../lib/atoms";
import type { Lead } from "../../lib/atoms";
import { generateEmailDraft } from "../../lib/openai-client";

type BuyerImportData = {
  title?: string;
  leads?: Lead[];
};

export const BuyerImportNode = memo(
  ({ data, id }: { data: BuyerImportData; id: string }) => {
    const {
      addNodes,
      addEdges,
      getNode,
      setNodes,
      setEdges,
      getNodes,
      getEdges,
    } = useReactFlow();
    const [open, setOpen] = useState(false);
    const [leads, setLeads] = useAtom(leadsAtom);
    const [newCompany, setNewCompany] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isExecutingSequence, setIsExecutingSequence] = useState(false);

    const findConnectedNodes = (
      sourceId: string
    ): { node: Node; edge: Edge }[] => {
      const edges = getEdges().filter((edge) => edge.source === sourceId);
      return edges.flatMap((edge) => {
        const node = getNodes().find((n) => n.id === edge.target);
        return node ? [{ node, edge }] : [];
      });
    };

    const executeEmailDraftNode = async (node: Node) => {
      if (node.type !== "emailDraft") return null;

      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                nodeStatus: "loading",
                isGenerating: true,
              },
            };
          }
          return n;
        })
      );

      try {
        const defaultPrompt = "바이어에게 보내는 제품 소개 이메일을 작성해주세요.";
        const draft = await generateEmailDraft(defaultPrompt);

        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  subject: draft.subject,
                  body: draft.body,
                  nodeStatus: "success",
                  isGenerating: false,
                  saved: true,
                },
              };
            }
            return n;
          })
        );

        return draft;
      } catch (error) {
        console.error("이메일 초안 생성 오류:", error);

        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  nodeStatus: "error",
                  isGenerating: false,
                },
              };
            }
            return n;
          })
        );

        return null;
      }
    };

    const executeSendNode = async (
      node: Node,
      emailData: { subject: string; body: string }
    ) => {
      if (node.type !== "sendNode") return false;

      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                sending: true,
                subject: emailData.subject,
                body: emailData.body,
              },
            };
          }
          return n;
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        const recipients = leads.map((lead: Lead) => ({
          email: lead.email,
          name: lead.company,
        }));

        const response = await fetch("/api/email", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipients: recipients,
            subject: emailData.subject,
            text: emailData.body,
            delayMs: 1000,
          }),
        });

        const result = await response.json();

        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  sending: false,
                  sent: response.ok,
                  error: response.ok
                    ? null
                    : `발송 실패: ${result.error || "알 수 없는 오류"}`,
                  showMetrics: response.ok,
                  recipients: recipients,
                },
              };
            }
            return n;
          })
        );

        return response.ok;
      } catch (error) {
        console.error("이메일 발송 오류:", error);

        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  sending: false,
                  error: `발송 오류: ${
                    error instanceof Error ? error.message : "알 수 없는 오류"
                  }`,
                },
              };
            }
            return n;
          })
        );

        return false;
      }
    };

    const executeSequence = async () => {
      if (isExecutingSequence) return;
      if (leads.length === 0) {
        alert(
          "바이어 리드 데이터가 없습니다. 리드 데이터를 추가한 후 다시 시도해주세요.",
        );
        return;
      }

      setIsExecutingSequence(true);

      try {
        const connectedNodes = findConnectedNodes(id);

        const firstNode = connectedNodes[0]?.node;
        if (!firstNode || firstNode.type !== "emailDraft") {
          alert("시퀀스의 첫 번째 노드는 이메일 초안 노드여야 합니다.");
          setIsExecutingSequence(false);
          return;
        }

        const emailDraft = await executeEmailDraftNode(firstNode);
        if (!emailDraft) {
          alert("이메일 초안 생성에 실패했습니다.");
          setIsExecutingSequence(false);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const nextNodes = findConnectedNodes(firstNode.id);
        const sendNode = nextNodes[0]?.node;
        if (!sendNode || sendNode.type !== "sendNode") {
          alert("이메일 초안 노드 다음에는 발송 노드가 필요합니다.");
          setIsExecutingSequence(false);
          return;
        }

        await executeSendNode(sendNode, emailDraft);

        setTimeout(() => {
          alert("시퀀스 실행이 완료되었습니다!");
        }, 500);
      } catch (error) {
        console.error("시퀀스 실행 중 오류 발생:", error);
        alert(
          `시퀀스 실행 중 오류가 발생했습니다: ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }`,
        );
      } finally {
        setIsExecutingSequence(false);
      }
    };

    const handleConfirm = () => {
      setOpen(false);
    };

    const handleAddDraft = () => {
      const me = getNode(id);
      const x = me?.position.x ?? 0;
      const parentHeight = me?.height ?? 160;
      const verticalGap = 60;
      const y = (me?.position.y ?? 0) + parentHeight + verticalGap;
      const draftId = `email-draft-${Date.now()}`;
      addNodes({
        id: draftId,
        type: "emailDraft",
        position: { x, y },
        data: { title: "이메일 초안" },
      });
      addEdges({ id: `${id}=>${draftId}`, source: id, target: draftId });
    };

    const handleDelete = () => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    };

    const handleAddLead = () => {
      if (newCompany.trim() && newEmail.trim()) {
        const newLead: Lead = {
          id: `lead-${Date.now()}`,
          company: newCompany.trim(),
          email: newEmail.trim(),
        };
        setLeads([...leads, newLead]);
        setNewCompany("");
        setNewEmail("");
      }
    };

    const handleRemoveLead = (leadId: string) => {
      setLeads(leads.filter((lead) => lead.id !== leadId));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setCsvFile(file);
        const sampleLeads: Lead[] = [
          { id: `lead-${Date.now()}-1`, company: "ABC 주식회사", email: "contact@abc.com" },
          { id: `lead-${Date.now()}-2`, company: "XYZ 기업", email: "info@xyz.com" },
          { id: `lead-${Date.now()}-3`, company: "테크 솔루션", email: "sales@techsolution.com" },
        ];
        setLeads([...leads, ...sampleLeads]);
      }
    };

    const borderClass = NODE_TYPE_COLORS.buyerImport.borderClass;
    const hasLeads = leads.length > 0;

    return (
      <BaseNode className={`w-96 ${borderClass}`}>
        <BaseNodeHeader className="border-b">
          <div className="flex items-center gap-2">
            <Upload className="size-4" />
            <BaseNodeHeaderTitle>
              {data.title ?? "바이어 리스트 불러오기"}
            </BaseNodeHeaderTitle>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-6 px-2 nodrag"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                executeSequence();
              }}
              title="시퀀스 자동 실행"
              disabled={isExecutingSequence || leads.length === 0}
            >
              {isExecutingSequence ? (
                <>
                  실행 중...
                  <Loader2 className="size-4 ml-1 text-green-600 animate-spin" />
                </>
              ) : (
                <>
                  시퀀스 자동 실행
                  <Play className="size-4 text-green-600" />
                </>
              )}
            </Button>
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
          {hasLeads ? (
            <div className="text-sm">
              <div className="font-medium mb-1">리드 데이터 ({leads.length}개)</div>
              <div className="max-h-20 overflow-y-auto text-xs border rounded p-1 mb-2">
                {leads.slice(0, 3).map((lead: Lead) => (
                  <div key={lead.id} className="flex justify-between items-center py-1">
                    <span>{lead.company}</span>
                    <span className="text-muted-foreground">{lead.email}</span>
                  </div>
                ))}
                {leads.length > 3 && (
                  <div className="text-center text-muted-foreground py-1">외 {leads.length - 3}개...</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mb-2">바이어 리드 데이터를 추가하세요.</div>
          )}
          <Button
            variant="outline"
            className="nodrag w-full"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setOpen(true);
            }}
            data-no-drag="true"
          >
            리드 데이터 관리
          </Button>
        </BaseNodeContent>
        <BaseNodeFooter>
          <Button disabled={!hasLeads} className="nodrag w-full" onClick={handleAddDraft} data-no-drag="true">
            + 이메일 초안 노드 추가
          </Button>
        </BaseNodeFooter>

        <Handle type="source" position={Position.Bottom} />

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="바이어 리드 데이터 관리"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button onClick={handleConfirm}>확인</Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium">CSV 파일 업로드</div>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <div className="border rounded-md px-3 py-2 text-center cursor-pointer hover:bg-muted/50">
                      <FileSpreadsheet className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-sm">CSV 파일 선택</span>
                    </div>
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                  {csvFile && <div className="text-sm">{csvFile.name}</div>}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">리드 직접 추가</div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs mb-1 block" htmlFor={`company-${id}`}>회사명</label>
                    <input
                      type="text"
                      className="w-full rounded border px-2 py-1 text-sm"
                      id={`company-${id}`}
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                      placeholder="예: ABC 주식회사"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs mb-1 block" htmlFor={`email-${id}`}>이메일</label>
                    <input
                      type="email"
                      className="w-full rounded border px-2 py-1 text-sm"
                      id={`email-${id}`}
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="예: contact@abc.com"
                    />
                  </div>
                  <div className="flex items=end">
                    <Button size="sm" onClick={handleAddLead}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {leads.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">추가된 리드 ({leads.length}개)</div>
                <div className="max-h-40 overflow-y-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-1 text-left">회사명</th>
                        <th className="px-2 py-1 text-left">이메일</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead: Lead) => (
                        <tr key={lead.id} className="border-t">
                          <td className="px-2 py-1">{lead.company}</td>
                          <td className="px-2 py-1 text-muted-foreground">{lead.email}</td>
                          <td className="px-2 py-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveLead(lead.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      </BaseNode>
    );
  }
);


