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
import { Upload, Trash, Play, Database } from "lucide-react";
import { NODE_TYPE_COLORS } from "@/components/sequencer/colors";
import { useAtom } from "jotai";
import { leadsAtom } from "../../lib/atoms";
import type { Lead } from "../../lib/atoms";
import { generateEmailDraft } from "../../lib/openai-client";
import { addressBookApi } from "@/lib/api/services/address-book";
import { AddressBookModal } from "./address-book-modal";
import { LeadDataModal } from "./lead-data-modal";

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
    const [leads, setLeads] = useAtom(leadsAtom);

    // 모달 상태
    const [addressBookModalOpen, setAddressBookModalOpen] = useState(false);
    const [leadDataModalOpen, setLeadDataModalOpen] = useState(false);

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
        const defaultPrompt =
          "바이어에게 보내는 제품 소개 이메일을 작성해주세요.";
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
      if (leads.length === 0) {
        alert(
          "바이어 리드 데이터가 없습니다. 리드 데이터를 추가한 후 다시 시도해주세요."
        );
        return;
      }

      try {
        const connectedNodes = findConnectedNodes(id);

        const firstNode = connectedNodes[0]?.node;
        if (!firstNode || firstNode.type !== "emailDraft") {
          alert("시퀀스의 첫 번째 노드는 이메일 초안 노드여야 합니다.");
          return;
        }

        const emailDraft = await executeEmailDraftNode(firstNode);
        if (!emailDraft) {
          alert("이메일 초안 생성에 실패했습니다.");
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const nextNodes = findConnectedNodes(firstNode.id);
        const sendNode = nextNodes[0]?.node;
        if (!sendNode || sendNode.type !== "sendNode") {
          alert("이메일 초안 노드 다음에는 발송 노드가 필요합니다.");
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
          }`
        );
      }
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

    const handleSelectGroup = async (groupId: string) => {
      try {
        const res = await addressBookApi.listContacts(groupId, { limit: 1000 });
        const imported = res.contacts.map((c) => ({
          id: c.id,
          company: c.company,
          email: c.email,
          industryType: c.industryType || undefined,
          productCategory: c.productCategory || undefined,
          country: c.country || undefined,
          description: c.description || undefined,
          website: c.websiteUrl || undefined,
        }));
        setLeads(imported);
        setAddressBookModalOpen(false);
      } catch (error) {
        console.error("주소록 연락처 로드 오류:", error);
        alert("주소록에서 연락처를 불러오는데 실패했습니다.");
      }
    };

    const borderClass = NODE_TYPE_COLORS.buyerImport.borderClass;
    const hasLeads = leads.length > 0;

    return (
      <>
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
                disabled={leads.length === 0}
              >
                시퀀스 자동 실행
                <Play className="size-4 ml-1 text-green-600" />
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
            <div className="text-sm">
              {hasLeads ? (
                <div className="font-medium mb-2">
                  바이어 리드 데이터 {leads.length}개가 준비되었습니다.
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-blue-500"
                    onClick={() => setLeadDataModalOpen(true)}
                  >
                    보기
                  </Button>
                </div>
              ) : (
                <div className="text-muted-foreground mb-2">
                  바이어 리드 데이터가 필요합니다.
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="nodrag flex-1"
                onClick={() => setAddressBookModalOpen(true)}
              >
                <Database className="size-4 mr-1" />
                주소록에서 가져오기
              </Button>
            </div>
          </BaseNodeContent>
          <BaseNodeFooter>
            <Button
              disabled={!hasLeads}
              className="nodrag w-full"
              onClick={handleAddDraft}
              data-no-drag="true"
            >
              + 이메일 초안 노드 추가
            </Button>
          </BaseNodeFooter>

          <Handle type="source" position={Position.Bottom} />
        </BaseNode>

        {/* 주소록 모달 */}
        <AddressBookModal
          open={addressBookModalOpen}
          onClose={() => setAddressBookModalOpen(false)}
          onSelectGroup={handleSelectGroup}
        />

        {/* 리드 데이터 모달 */}
        <LeadDataModal
          open={leadDataModalOpen}
          onClose={() => setLeadDataModalOpen(false)}
          leads={leads}
        />
      </>
    );
  }
);
