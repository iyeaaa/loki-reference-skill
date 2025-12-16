import { Handle, Position } from "@xyflow/react"
import { Mail, Plus, Trash2 } from "lucide-react"
import { type FC, useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useEmailTemplates } from "@/lib/api/hooks/email-templates"

type EmailDraftNodeData = {
  subject?: string
  bodyText?: string
  bodyHtml?: string
  workspaceId?: string
  // AI 생성 관련
  useAI?: boolean
  aiPrompt?: string
  generationMode?: "ai" | "manual" | "template"
  generatedCount?: number
  totalCount?: number
  onAddNode?: (type: string) => void
  onDelete?: () => void
  onUpdate?: (data: Partial<EmailDraftNodeData>) => void
  onManageEmails?: () => void
}

type EmailDraftNodeProps = {
  data: EmailDraftNodeData
}

export const EmailDraftNode: FC<EmailDraftNodeProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const getInitialMode = (): "ai" | "manual" | "template" => {
    if (data.generationMode === "ai") {
      return "ai"
    }
    return "manual"
  }

  const [generationMode, setGenerationMode] = useState<"ai" | "manual" | "template">(
    getInitialMode(),
  )
  const [subject, setSubject] = useState(data.subject || "")
  const [bodyText, setBodyText] = useState(data.bodyText || "")
  const [bodyHtml, setBodyHtml] = useState(data.bodyHtml || "")
  const [aiPrompt, setAiPrompt] = useState(data.aiPrompt || "")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")

  // 현재 워크스페이스의 템플릿 조회
  const currentWorkspace = localStorage.getItem("selectedWorkspace") || "all"
  const { data: templatesData } = useEmailTemplates({
    limit: 100,
    workspaceIds: currentWorkspace !== "all" ? [currentWorkspace] : undefined,
  })

  // data가 변경되면 로컬 state 업데이트
  useEffect(() => {
    const mode = data.generationMode === "ai" ? "ai" : "manual"
    setGenerationMode(mode)
    setSubject(data.subject || "")
    setBodyText(data.bodyText || "")
    setBodyHtml(data.bodyHtml || "")
    setAiPrompt(data.aiPrompt || "")
  }, [data.subject, data.bodyText, data.bodyHtml, data.aiPrompt, data.generationMode])

  const modeAiId = useId()
  const modeManualId = useId()
  const aiPromptId = useId()
  const subjectId = useId()
  const bodyId = useId()
  const bodyHtmlId = useId()

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templatesData?.emailTemplates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setBodyText(template.bodyText || "")
      setBodyHtml(template.bodyHtml || "")
    }
  }

  const handleAddNode = (type: string) => {
    data.onAddNode?.(type)
    setIsOpen(false)
  }

  const handleSave = () => {
    if (generationMode === "ai") {
      data.onUpdate?.({
        subject: aiPrompt, // AI 모드에서는 subject에도 프롬프트 저장
        bodyText: "",
        generationMode: "ai",
        aiPrompt,
        useAI: true,
      })
    } else {
      data.onUpdate?.({
        subject,
        bodyText,
        bodyHtml,
        generationMode: "manual",
        aiPrompt: "", // manual 모드에서는 aiPrompt 초기화
        useAI: false,
      })
    }
    setIsEditOpen(false)
  }

  return (
    <>
      <div className="w-[280px] rounded-lg border-2 border-blue-500 bg-white shadow-lg">
        <Handle
          className="h-3 w-3 border-2 border-white bg-blue-500"
          position={Position.Top}
          type="target"
        />

        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-blue-100 p-2">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <span className="font-semibold text-gray-800">이메일 초안</span>
            </div>
            <Button
              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
              onClick={() => data.onDelete?.()}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="mb-2 rounded border border-blue-200 bg-blue-50 p-2">
              <p className="text-blue-700 text-xs">📧 등록된 모든 연락처에게 개별 발송</p>
            </div>

            {/* 생성 모드 표시 */}
            {data.generationMode && (
              <div className="mb-2 flex items-center gap-2">
                {data.generationMode === "ai" ? (
                  <span className="rounded bg-purple-100 px-2 py-1 text-purple-700 text-xs">
                    🤖 AI 생성
                  </span>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-1 text-gray-700 text-xs">
                    ✍️ 수동 작성
                  </span>
                )}
                {data.generatedCount !== undefined && data.totalCount !== undefined && (
                  <span className="text-gray-600 text-xs">
                    {data.generatedCount}/{data.totalCount} 작성됨
                  </span>
                )}
              </div>
            )}

            {data.subject ? (
              <div className="text-sm">
                <div className="mb-1 text-gray-500 text-xs">
                  {data.generationMode === "ai" ? "AI 프롬프트" : "제목 템플릿"}
                </div>
                <div
                  className="overflow-hidden text-ellipsis font-medium"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    lineHeight: "1.4em",
                    maxHeight: "2.8em",
                  }}
                  title={data.generationMode === "ai" ? data.aiPrompt : data.subject}
                >
                  {data.generationMode === "ai" ? data.aiPrompt : data.subject}
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm italic">설정되지 않음</div>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => setIsEditOpen(true)}
                size="sm"
                variant="outline"
              >
                설정
              </Button>
              <Button
                className="flex-1"
                onClick={() => data.onManageEmails?.()}
                size="sm"
                variant="default"
              >
                이메일 관리
              </Button>
            </div>
          </div>
        </div>

        <div className="border-gray-200 border-t bg-gray-50 p-3">
          <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
            <DropdownMenuTrigger asChild>
              <Button className="w-full" size="sm" variant="ghost">
                <Plus className="mr-2 h-4 w-4" />
                노드 추가
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleAddNode("timer")}>
                타이머 추가
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Handle
          className="h-3 w-3 border-2 border-white bg-blue-500"
          position={Position.Bottom}
          type="source"
        />
      </div>

      <Dialog onOpenChange={setIsEditOpen} open={isEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>이메일 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="rounded border border-blue-200 bg-blue-50 p-3">
              <p className="mb-1 font-medium text-blue-800 text-sm">📧 일괄 발송 이메일</p>
              <p className="text-blue-600 text-xs">
                시퀀스에 등록된 모든 연락처에게 개별적으로 발송됩니다. 각 연락처마다 하나의 이메일이
                생성됩니다.
              </p>
            </div>

            {/* 생성 모드 선택 */}
            <div>
              <Label>이메일 작성 방식</Label>
              <RadioGroup
                className="mt-2"
                onValueChange={(value) => setGenerationMode(value as "ai" | "manual")}
                value={generationMode}
              >
                <div className="flex items-start space-x-2 rounded border p-3 hover:bg-gray-50">
                  <RadioGroupItem id={modeAiId} value="ai" />
                  <div className="flex-1">
                    <Label className="cursor-pointer font-semibold" htmlFor={modeAiId}>
                      🤖 AI 자동 생성
                    </Label>
                    <p className="mt-1 text-gray-600 text-xs">
                      프롬프트를 입력하면 AI가 각 고객사에 맞춤형 이메일을 자동 생성합니다. 생성 후
                      개별 수정 가능합니다.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 rounded border p-3 hover:bg-gray-50">
                  <RadioGroupItem id={modeManualId} value="manual" />
                  <div className="flex-1">
                    <Label className="cursor-pointer font-semibold" htmlFor={modeManualId}>
                      ✍️ 수동 작성 또는 템플릿
                    </Label>
                    <p className="mt-1 text-gray-600 text-xs">
                      템플릿을 작성하거나 각 고객사에 대해 직접 이메일을 작성합니다. 변수를 사용하여
                      자동 치환됩니다.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* AI 모드 입력 */}
            {generationMode === "ai" && (
              <div>
                <Label htmlFor={aiPromptId}>AI 프롬프트</Label>
                <Textarea
                  id={aiPromptId}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="예: {{회사명}}에게 우리 서비스를 소개하는 친근하고 전문적인 이메일을 작성해주세요. {{업종}} 업계의 특성을 고려해주세요."
                  rows={4}
                  value={aiPrompt}
                />
                <p className="mt-1 text-gray-500 text-xs">
                  💡 사용 가능한 변수:{" "}
                  {
                    "{{회사명}}, {{담당자명}}, {{업종}}, {{이메일}}, {{웹사이트}}, {{국가}}, {{도시}} 등"
                  }
                </p>
              </div>
            )}

            {/* 수동 모드 입력 */}
            {generationMode === "manual" && (
              <>
                <div>
                  <Label>템플릿에서 불러오기</Label>
                  <Select onValueChange={handleTemplateSelect} value={selectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="템플릿 선택 (선택사항)" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesData?.emailTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-gray-500 text-xs">
                    💡 기존 템플릿을 선택하면 내용이 자동으로 입력됩니다
                  </p>
                </div>
                <div>
                  <Label htmlFor={subjectId}>제목 템플릿</Label>
                  <Input
                    id={subjectId}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="예: 안녕하세요, {{회사명}}님"
                    value={subject}
                  />
                </div>
                <div>
                  <Label htmlFor={bodyId}>본문 템플릿 (텍스트)</Label>
                  <Textarea
                    id={bodyId}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="이메일 본문을 입력하세요&#10;&#10;변수 예시: {{회사명}}, {{담당자명}}, {{업종}}, {{이메일}}, {{웹사이트}}, {{국가}}, {{도시}} 등"
                    rows={6}
                    value={bodyText}
                  />
                </div>
                <div>
                  <Label htmlFor={bodyHtmlId}>본문 템플릿 (HTML)</Label>
                  <Textarea
                    className="font-mono text-sm"
                    id={bodyHtmlId}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    placeholder="<p>HTML 형식의 이메일 본문을 입력하세요</p>&#10;&#10;변수 예시: {{회사명}}, {{담당자명}}, {{업종}}, {{이메일}}, {{웹사이트}}, {{국가}}, {{도시}} 등"
                    rows={6}
                    value={bodyHtml}
                  />
                  <p className="mt-1 text-gray-500 text-xs">
                    💡 HTML을 입력하면 텍스트 본문 대신 HTML 본문이 사용됩니다
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button onClick={() => setIsEditOpen(false)} variant="outline">
                취소
              </Button>
              <Button onClick={handleSave}>저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
