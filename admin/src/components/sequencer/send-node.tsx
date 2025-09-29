"use client"

import { Handle, Position, useReactFlow } from "@xyflow/react"
import { useAtom } from "jotai"
import { BarChart, Loader2, Send, Trash } from "lucide-react"
import { memo, useEffect, useState } from "react"
import {
  BaseNode,
  BaseNodeContent,
  BaseNodeFooter,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@/components/base-node"
import { EmailMetricsDisplay } from "@/components/email-metrics"
import { NodeStatusIndicator } from "@/components/node-status-indicator"
import { NODE_TYPE_COLORS } from "@/components/sequencer/colors"
import { Button } from "@/components/ui/button"
import { leadsAtom } from "@/lib/atoms"
import { sendBulkEmails } from "@/lib/email-api"
import type { EmailRecipient } from "@/lib/email-service"

type SendData = {
  title?: string
  recipients?: EmailRecipient[]
  subject?: string
  body?: string
  sending?: boolean
  sent?: boolean
  error?: string | null
  showMetrics?: boolean
}

export const SendNode = memo(({ data, id }: { data: SendData; id: string }) => {
  const { setNodes, setEdges } = useReactFlow()
  const [sending, setSending] = useState(data.sending || false)
  const [sent, setSent] = useState(data.sent || false)
  const [error, setError] = useState<string | null>(data.error || null)
  const [recipients, setRecipients] = useState<EmailRecipient[]>(data.recipients || [])
  const [leads] = useAtom(leadsAtom)
  const [showMetrics, setShowMetrics] = useState(data.showMetrics || false)

  useEffect(() => {
    const fetchDataFromPreviousNodes = () => {
      const recipients: EmailRecipient[] = leads.map((lead) => ({
        email: lead.email,
        name: lead.company,
      }))

      setRecipients(recipients)
    }

    fetchDataFromPreviousNodes()
  }, [leads])

  useEffect(() => {
    if (data.sending !== undefined) {
      setSending(data.sending)
    }
    if (data.sent !== undefined) {
      setSent(data.sent)
    }
    if (data.error !== undefined) {
      setError(data.error)
    }
    if (data.recipients !== undefined) {
      setRecipients(data.recipients)
    }
    if (data.showMetrics !== undefined) {
      setShowMetrics(data.showMetrics)
    }
  }, [data])

  const handleBulkSend = async () => {
    if (recipients.length === 0) {
      setError("수신자 목록이 비어 있습니다.")
      return
    }

    try {
      setSending(true)
      setError(null)

      const response = await sendBulkEmails({
        recipients,
        subject: data.subject,
        text: data.body,
        delayMs: 1000,
      })

      if (response.ok) {
        console.log("이메일 발송 시작:", response.message)
        setSent(true)
        setError(null)
        setShowMetrics(true)
      } else {
        console.error("이메일 발송 실패:", response.error)
        setError(`발송 실패: ${response.error || "알 수 없는 오류"}`)
      }
    } catch (error) {
      console.error("이메일 발송 중 오류 발생:", error)
      setError(`발송 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setSending(false)
    }
  }

  const handleDelete = () => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
  }

  const borderClass = NODE_TYPE_COLORS.sendNode.borderClass

  return (
    <NodeStatusIndicator status={sending ? "loading" : "initial"} variant="border">
      <BaseNode className={`w-96 ${borderClass}`}>
        <BaseNodeHeader className="border-b">
          <div className="flex items-center gap-2">
            <Send className="size-4" />
            <BaseNodeHeaderTitle>{data.title ?? "발송"}</BaseNodeHeaderTitle>
          </div>
          <Button
            variant="outline"
            className="nodrag ml-auto h-7 px-2"
            onClick={handleDelete}
            aria-label="노드 삭제"
          >
            <Trash className="size-4" />
          </Button>
        </BaseNodeHeader>
        <BaseNodeContent>
          <div className="space-y-2 text-sm">
            <div>
              수신자:{" "}
              {recipients.length > 0 ? (
                <span className="font-medium">{recipients.length}명</span>
              ) : (
                <span className="text-red-500">없음</span>
              )}
            </div>

            {data.subject && (
              <div className="line-clamp-1">
                제목: <span className="font-medium">{data.subject}</span>
              </div>
            )}

            {error && <div className="text-red-500">{error}</div>}
          </div>

          {!sent ? (
            <Button
              className="nodrag mt-2"
              disabled={sending || recipients.length === 0}
              onClick={handleBulkSend}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  발송 중...
                </>
              ) : (
                "이메일 발송"
              )}
            </Button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <div className="text-sm font-medium text-green-600 flex items-center gap-1">
                <span>발송 완료</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto nodrag"
                onClick={() => setShowMetrics(!showMetrics)}
              >
                <BarChart className="h-4 w-4 mr-1" />
                지표 {showMetrics ? "숨기기" : "보기"}
              </Button>
            </div>
          )}

          {sent && <EmailMetricsDisplay recipients={recipients} visible={showMetrics} />}
        </BaseNodeContent>
        <BaseNodeFooter>
          <Button className="nodrag w-full" disabled={!sent}>
            + 분기 노드 추가 (데모)
          </Button>
        </BaseNodeFooter>

        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
      </BaseNode>
    </NodeStatusIndicator>
  )
})

SendNode.displayName = "SendNode"
