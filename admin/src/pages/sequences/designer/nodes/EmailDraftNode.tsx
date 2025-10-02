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

interface EmailDraftNodeData {
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

interface EmailDraftNodeProps {
  data: EmailDraftNodeData
}

export const EmailDraftNode: FC<EmailDraftNodeProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const getInitialMode = (): "ai" | "manual" => {
    if (data.generationMode === "ai") return "ai"
    return "manual"
  }

  const [generationMode, setGenerationMode] = useState<"ai" | "manual">(getInitialMode())
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
      <div className="bg-white rounded-lg shadow-lg border-2 border-blue-500 w-[280px]">
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 rounded-full p-2">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-gray-800 font-semibold">이메일 초안</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => data.onDelete?.()}
              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
              <p className="text-xs text-blue-700">📧 등록된 모든 연락처에게 개별 발송</p>
            </div>

            {/* 생성 모드 표시 */}
            {data.generationMode && (
              <div className="flex items-center gap-2 mb-2">
                {data.generationMode === "ai" ? (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    🤖 AI 생성
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    ✍️ 수동 작성
                  </span>
                )}
                {data.generatedCount !== undefined && data.totalCount !== undefined && (
                  <span className="text-xs text-gray-600">
                    {data.generatedCount}/{data.totalCount} 작성됨
                  </span>
                )}
              </div>
            )}

            {data.subject ? (
              <div className="text-sm">
                <div className="text-gray-500 text-xs mb-1">
                  {data.generationMode === "ai" ? "AI 프롬프트" : "제목 템플릿"}
                </div>
                <div
                  className="font-medium overflow-hidden text-ellipsis"
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
              <div className="text-sm text-gray-400 italic">설정되지 않음</div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(true)}
                className="flex-1"
              >
                설정
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => data.onManageEmails?.()}
                className="flex-1"
              >
                이메일 관리
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
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
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>이메일 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-800 font-medium mb-1">📧 일괄 발송 이메일</p>
              <p className="text-xs text-blue-600">
                시퀀스에 등록된 모든 연락처에게 개별적으로 발송됩니다. 각 연락처마다 하나의 이메일이
                생성됩니다.
              </p>
            </div>

            {/* 생성 모드 선택 */}
            <div>
              <Label>이메일 작성 방식</Label>
              <RadioGroup
                value={generationMode}
                onValueChange={(value) => setGenerationMode(value as "ai" | "manual")}
                className="mt-2"
              >
                <div className="flex items-start space-x-2 border rounded p-3 hover:bg-gray-50">
                  <RadioGroupItem value="ai" id={modeAiId} />
                  <div className="flex-1">
                    <Label htmlFor={modeAiId} className="font-semibold cursor-pointer">
                      🤖 AI 자동 생성
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">
                      프롬프트를 입력하면 AI가 각 고객사에 맞춤형 이메일을 자동 생성합니다. 생성 후
                      개별 수정 가능합니다.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 border rounded p-3 hover:bg-gray-50">
                  <RadioGroupItem value="manual" id={modeManualId} />
                  <div className="flex-1">
                    <Label htmlFor={modeManualId} className="font-semibold cursor-pointer">
                      ✍️ 수동 작성 또는 템플릿
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">
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
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="예: {{회사명}}에게 우리 서비스를 소개하는 친근하고 전문적인 이메일을 작성해주세요. {{업종}} 업계의 특성을 고려해주세요."
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 사용 가능한 변수:{" "}
                  {`{{회사명}}, {{담당자명}}, {{업종}}, {{이메일}}, {{웹사이트}}, {{국가}}, {{도시}} 등`}
                </p>
              </div>
            )}

            {/* 수동 모드 입력 */}
            {generationMode === "manual" && (
              <>
                <div>
                  <Label>템플릿에서 불러오기</Label>
                  <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
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
                  <p className="text-xs text-gray-500 mt-1">
                    💡 기존 템플릿을 선택하면 내용이 자동으로 입력됩니다
                  </p>
                </div>
                <div>
                  <Label htmlFor={subjectId}>제목 템플릿</Label>
                  <Input
                    id={subjectId}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="예: 안녕하세요, {{회사명}}님"
                  />
                </div>
                <div>
                  <Label htmlFor={bodyId}>본문 템플릿 (텍스트)</Label>
                  <Textarea
                    id={bodyId}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="이메일 본문을 입력하세요&#10;&#10;변수 예시: {{회사명}}, {{담당자명}}, {{업종}}, {{이메일}}, {{웹사이트}}, {{국가}}, {{도시}} 등"
                    rows={6}
                  />
                </div>
                <div>
                  <Label htmlFor={bodyHtmlId}>본문 템플릿 (HTML)</Label>
                  <Textarea
                    id={bodyHtmlId}
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    placeholder="<p>HTML 형식의 이메일 본문을 입력하세요</p>&#10;&#10;변수 예시: {{회사명}}, {{담당자명}}, {{업종}}, {{이메일}}, {{웹사이트}}, {{국가}}, {{도시}} 등"
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 HTML을 입력하면 텍스트 본문 대신 HTML 본문이 사용됩니다
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
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
