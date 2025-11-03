import { CheckCircle, Edit, Loader2, Mail, RefreshCw, XCircle } from "lucide-react"
import { useId, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSequence } from "@/lib/api/hooks/sequences"
import {
  useGenerateAllEmails,
  useGeneratedEmails,
  useGenerationProgress,
  useRegenerateEmail,
  useUpdateGeneratedEmail,
} from "@/lib/api/hooks/workflow-emails"
import type { WorkflowGeneratedEmail } from "@/lib/api/types/workflow-email"

type EmailData = WorkflowGeneratedEmail

interface EmailManagementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sequenceId: string
  nodeId: string
  generationMode: "ai" | "manual"
  aiPrompt?: string
  templateSubject?: string
  templateBody?: string
  templateBodyHtml?: string
}

export function EmailManagementModal({
  open,
  onOpenChange,
  sequenceId,
  nodeId,
  generationMode,
  aiPrompt,
  templateSubject,
  templateBody,
  templateBodyHtml,
}: EmailManagementModalProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null)

  // API Hooks
  const { data: sequence } = useSequence(sequenceId)
  const { data: emails = [], isLoading } = useGeneratedEmails(sequenceId, nodeId, open)
  const { data: progress } = useGenerationProgress(sequenceId, nodeId, open)
  const generateAllMutation = useGenerateAllEmails()
  const regenerateMutation = useRegenerateEmail()

  const isGenerating = progress?.status === "generating" || generateAllMutation.isPending
  const generationProgress = progress?.percentage || 0

  const handleGenerateAll = async (incremental = false) => {
    try {
      await generateAllMutation.mutateAsync({
        sequenceId,
        nodeId,
        data: {
          mode: generationMode,
          aiPrompt: generationMode === "ai" ? aiPrompt : undefined,
          aiModel: generationMode === "ai" ? "gpt-3.5-turbo" : undefined,
          templateSubject: generationMode === "manual" ? templateSubject : undefined,
          templateBody: generationMode === "manual" ? templateBody : undefined,
          templateBodyHtml: generationMode === "manual" ? templateBodyHtml : undefined,
          incremental,
        },
      })
    } catch (error) {
      console.error("Failed to generate emails:", error)
    }
  }

  const handleRegenerate = async (email: EmailData) => {
    try {
      await regenerateMutation.mutateAsync({
        sequenceId,
        nodeId,
        emailId: email.id,
      })
    } catch (error) {
      console.error("Failed to regenerate email:", error)
    }
  }

  const handleEdit = (email: EmailData) => {
    setSelectedEmail(email)
  }

  const totalEmails = emails.length
  const generatedEmails = emails.filter(
    (e) => e.status === "generated" || e.status === "edited",
  ).length
  const failedEmails = emails.filter((e) => e.status === "failed").length

  const getStatusBadge = (status: EmailData["status"]) => {
    switch (status) {
      case "generated":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            생성됨
          </Badge>
        )
      case "generating":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            생성 중
          </Badge>
        )
      case "edited":
        return (
          <Badge variant="outline" className="gap-1">
            <Edit className="h-3 w-3" />
            수정됨
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            실패
          </Badge>
        )
      default:
        return <Badge variant="secondary">대기</Badge>
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              이메일 생성 관리
              {generationMode === "ai" ? (
                <Badge variant="secondary">🤖 AI 자동 생성</Badge>
              ) : (
                <Badge variant="secondary">✍️ 수동 작성</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 설정 정보 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700">대상 고객그룹</div>
                  <div className="text-sm text-gray-900 font-medium">
                    {sequence?.customerGroupName || "고객그룹 미지정"}
                  </div>
                  {!sequence?.customerGroupName && (
                    <div className="text-xs text-red-600 mt-1">
                      ⚠️ 시퀀스에 고객그룹을 먼저 지정해주세요
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">작성 방식</div>
                  <div className="text-sm text-gray-600">
                    {generationMode === "ai" ? "AI 자동 생성" : "수동 작성/템플릿"}
                  </div>
                </div>
                {generationMode === "ai" && aiPrompt && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-gray-700">AI 프롬프트</div>
                    <div className="text-sm text-gray-600 truncate">{aiPrompt}</div>
                  </div>
                )}
                {generationMode === "manual" && templateSubject && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-gray-700">제목 템플릿</div>
                    <div className="text-sm text-gray-600 truncate">{templateSubject}</div>
                  </div>
                )}
              </div>
            </div>

            {/* 통계 */}
            {totalEmails > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-sm text-blue-700">총 이메일</div>
                  <div className="text-2xl font-bold text-blue-900">{totalEmails}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-sm text-green-700">생성 완료</div>
                  <div className="text-2xl font-bold text-green-900">{generatedEmails}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-sm text-red-700">실패</div>
                  <div className="text-2xl font-bold text-red-900">{failedEmails}</div>
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleGenerateAll(true)}
                disabled={isGenerating || !sequence?.customerGroupId}
                variant="default"
                className="flex-1"
                title={
                  !sequence?.customerGroupId
                    ? "시퀀스에 고객그룹을 먼저 설정해주세요"
                    : "이미 생성된 이메일은 유지하고 새로운 연락처에만 생성합니다"
                }
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    {!sequence?.customerGroupId
                      ? "⚠️ 고객그룹 미지정"
                      : totalEmails > 0
                        ? "새로운 연락처만 생성"
                        : "모든 연락처에 대해 생성"}
                  </>
                )}
              </Button>

              {totalEmails > 0 && (
                <Button
                  onClick={() => handleGenerateAll(false)}
                  disabled={isGenerating || !sequence?.customerGroupId}
                  variant="outline"
                  className="flex-1"
                  title="기존 이메일을 모두 삭제하고 전체 재생성합니다"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      재생성 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      전체 재생성
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* 진행 상황 */}
            {isGenerating && progress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    생성 진행 중... ({progress.generated + progress.failed}/{progress.total})
                  </span>
                  <span>{generationProgress}%</span>
                </div>
                <Progress value={generationProgress} />
                {progress.failed > 0 && (
                  <div className="text-xs text-red-600">{progress.failed}개 실패</div>
                )}
              </div>
            )}

            {/* 이메일 목록 */}
            {totalEmails > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>회사명</TableHead>
                        <TableHead>담당자</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>제목 미리보기</TableHead>
                        <TableHead className="text-right">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emails.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell className="font-medium">{email.companyName}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{email.contactName || "-"}</div>
                              <div className="text-gray-500 text-xs">{email.contactEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(email.status)}</TableCell>
                          <TableCell>
                            <div className="max-w-[300px] truncate text-sm">{email.subject}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(email)}>
                                <Edit className="h-3 w-3 mr-1" />
                                보기/수정
                              </Button>
                              {generationMode === "ai" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRegenerate(email)}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 빈 상태 */}
            {totalEmails === 0 && !isGenerating && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">생성된 이메일이 없습니다</p>
                <p className="text-sm mt-1">
                  위의 버튼을 클릭하여 모든 연락처에 대한 이메일을 생성하세요
                </p>
              </div>
            )}

            {/* 로딩 상태 */}
            {isLoading && (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="h-12 w-12 mx-auto mb-4 text-gray-300 animate-spin" />
                <p className="text-lg font-medium">로딩 중...</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 개별 이메일 편집 다이얼로그 */}
      {selectedEmail && (
        <EmailEditDialog
          sequenceId={sequenceId}
          nodeId={nodeId}
          email={selectedEmail}
          open={!!selectedEmail}
          onOpenChange={(open) => !open && setSelectedEmail(null)}
          onClose={() => setSelectedEmail(null)}
          generationMode={generationMode}
        />
      )}
    </>
  )
}

// 개별 이메일 편집 다이얼로그
interface EmailEditDialogProps {
  sequenceId: string
  nodeId: string
  email: EmailData
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  generationMode: "ai" | "manual"
}

function EmailEditDialog({
  sequenceId,
  nodeId,
  email,
  open,
  onOpenChange,
  onClose,
  generationMode,
}: EmailEditDialogProps) {
  const [subject, setSubject] = useState(email.subject)
  const [bodyText, setBodyText] = useState(email.bodyText || "")
  const [bodyHtml, setBodyHtml] = useState(email.bodyHtml || "")
  const subjectId = useId()
  const bodyId = useId()
  const bodyHtmlId = useId()

  const updateEmailMutation = useUpdateGeneratedEmail()
  const regenerateMutation = useRegenerateEmail()

  const handleSave = async () => {
    try {
      await updateEmailMutation.mutateAsync({
        sequenceId,
        nodeId,
        emailId: email.id,
        data: {
          subject,
          bodyText,
          bodyHtml,
        },
      })
      onClose()
    } catch (error) {
      console.error("Failed to save email:", error)
    }
  }

  const handleRegenerate = async () => {
    try {
      await regenerateMutation.mutateAsync({
        sequenceId,
        nodeId,
        emailId: email.id,
      })
      onClose()
    } catch (error) {
      console.error("Failed to regenerate:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>이메일 편집</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 고객 정보 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-700">회사명</div>
                <div className="text-sm text-gray-900">{email.companyName}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">담당자</div>
                <div className="text-sm text-gray-900">
                  {email.contactName || "-"} ({email.contactEmail})
                </div>
              </div>
              {email.industry && (
                <div>
                  <div className="text-sm font-medium text-gray-700">업종</div>
                  <div className="text-sm text-gray-900">{email.industry}</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-gray-700">생성 방식</div>
                <div className="text-sm text-gray-900">
                  {generationMode === "ai" ? "🤖 AI 생성" : "✍️ 수동 작성"}
                </div>
              </div>
            </div>
          </div>

          {/* 이메일 내용 편집 */}
          <div className="space-y-4">
            <div>
              <label htmlFor={subjectId} className="text-sm font-medium">
                제목
              </label>
              <input
                id={subjectId}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label htmlFor={bodyId} className="text-sm font-medium">
                본문 (텍스트)
              </label>
              <textarea
                id={bodyId}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={8}
                className="w-full mt-1 px-3 py-2 border rounded-md font-mono text-sm"
              />
            </div>
            <div>
              <label htmlFor={bodyHtmlId} className="text-sm font-medium">
                본문 (HTML)
              </label>
              <textarea
                id={bodyHtmlId}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={8}
                className="w-full mt-1 px-3 py-2 border rounded-md font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 HTML을 입력하면 텍스트 본문 대신 HTML 본문이 사용됩니다
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            {generationMode === "ai" && (
              <Button
                variant="secondary"
                onClick={handleRegenerate}
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    재생성 중...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    AI 재생성
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleSave} disabled={updateEmailMutation.isPending}>
              {updateEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                "저장"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
