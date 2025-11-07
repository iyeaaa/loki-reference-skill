import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileUp,
  Key,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useId, useRef, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WebExtractionProgress } from "@/components/web-extraction/WebExtractionProgress"
import {
  useCreateApiKey,
  useDeleteApiKey,
  useOpenAIApiKeys,
  useUpdateApiKey,
} from "@/lib/api/hooks/openai-api-keys"
import {
  useCleanupResults,
  useDownloadResults,
  useWebExtraction,
} from "@/lib/api/hooks/web-extraction"
import type { ApiKey } from "@/lib/api/types/openai-api-keys"

export function WebDataExtraction() {
  const keyNameId = useId()
  const apiKeyId = useId()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isApiKeySectionOpen, setIsApiKeySectionOpen] = useState(false)
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const workspaceId = localStorage.getItem("selectedWorkspace") || ""

  const [apiKeyFormData, setApiKeyFormData] = useState({
    name: "",
    apiKey: "",
  })

  // Use TanStack Query hooks for API keys
  const { data: apiKeys = [] } = useOpenAIApiKeys(workspaceId)
  const createApiKeyMutation = useCreateApiKey()
  const deleteApiKeyMutation = useDeleteApiKey()
  const updateApiKeyMutation = useUpdateApiKey()

  // Use TanStack Query hooks for web extraction
  const { progress, jobId, isProcessing, upload, reset } = useWebExtraction()
  const downloadMutation = useDownloadResults()
  const cleanupMutation = useCleanupResults()

  const activeApiKeysCount = apiKeys.filter((k) => k.isActive).length

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      const fileName = file.name.toLowerCase()
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
        setSelectedFile(file)
        setError(null)
      } else {
        setError("Excel (.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다")
      }
    }
  }

  const handleUpload = () => {
    if (!selectedFile || !workspaceId) {
      setError("파일을 선택하고 워크스페이스를 확인해주세요")
      return
    }

    setError(null)
    upload({
      file: selectedFile,
      workspaceId,
    })
  }

  const handleDownload = () => {
    if (jobId) {
      downloadMutation.mutate(jobId)
    }
  }

  const handleCleanup = () => {
    if (jobId) {
      cleanupMutation.mutate(jobId, {
        onSuccess: () => {
          reset()
          setSelectedFile(null)
        },
      })
    }
  }

  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!workspaceId || !apiKeyFormData.name.trim() || !apiKeyFormData.apiKey.trim()) {
      return
    }

    await createApiKeyMutation.mutateAsync({
      workspaceId,
      name: apiKeyFormData.name,
      apiKey: apiKeyFormData.apiKey,
    })

    setIsApiKeyDialogOpen(false)
    setApiKeyFormData({ name: "", apiKey: "" })
  }

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("이 API 키를 삭제하시겠습니까?")) return

    await deleteApiKeyMutation.mutateAsync({ id, workspaceId })
  }

  const handleToggleActive = async (key: ApiKey) => {
    await updateApiKeyMutation.mutateAsync({
      id: key.id,
      data: {
        workspaceId,
        isActive: !key.isActive,
      },
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "사용 안함"
    const date = new Date(dateString)
    return date.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">웹 데이터 추출</h1>
        <p className="text-muted-foreground">
          엑셀 파일의 웹사이트 URL에서 회사 정보 및 연락처를 자동으로 추출합니다
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: API Key Management */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsApiKeySectionOpen(!isApiKeySectionOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/20 p-2">
                <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">1단계: API 키 설정</CardTitle>
                <CardDescription>
                  {activeApiKeysCount > 0 ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {activeApiKeysCount}개 활성 · 동시 처리 {activeApiKeysCount * 20}개
                    </span>
                  ) : (
                    <span className="text-orange-600 dark:text-orange-400">
                      API 키를 추가하여 처리 속도를 높이세요
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            {isApiKeySectionOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>

        {isApiKeySectionOpen && (
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>💡 처리 속도를 높이려면?</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>
                  OpenAI 계정 1개당 동시에 20개씩 처리할 수 있어요. 마치 식당에 계산대가 여러 개
                  있으면 손님을 더 빨리 받을 수 있는 것처럼, OpenAI 계정을 여러 개 만들어서{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    각 계정의 API 키를 따로 등록
                  </span>
                  하면 더 많은 웹사이트를 한꺼번에 처리할 수 있어요!
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  예: 5개 계정 = 100개 동시 처리 (5배 빠름!)
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button onClick={() => setIsApiKeyDialogOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                API 키 추가
              </Button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">등록된 API 키가 없습니다</p>
                <p className="text-sm mt-2">서버의 환경 변수에 설정된 기본 키가 사용됩니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key, index) => (
                  <div
                    key={key.id}
                    className={`border rounded-lg p-4 transition-all ${
                      key.isActive
                        ? "bg-background border-primary/20"
                        : "bg-muted/30 opacity-60 border-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                            {index + 1}
                          </span>
                          <h3 className="font-semibold truncate">{key.name}</h3>
                          {key.isActive ? (
                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                              활성
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                              비활성
                            </span>
                          )}
                        </div>

                        <div className="text-sm font-mono text-muted-foreground mb-2 truncate">
                          {key.apiKey}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">마지막 사용:</span>{" "}
                            {formatDate(key.lastUsedAt)}
                          </div>
                          <div>
                            <span className="font-medium">사용:</span> {key.usageCount}회
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(key)}
                          title={key.isActive ? "비활성화" : "활성화"}
                          disabled={updateApiKeyMutation.isPending}
                        >
                          {key.isActive ? "비활성화" : "활성화"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteApiKey(key.id)}
                          title="삭제"
                          disabled={deleteApiKeyMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Step 2: File Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/20 p-2">
              <FileUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg">2단계: 파일 업로드</CardTitle>
              <CardDescription>
                Excel 또는 CSV 파일을 업로드하세요 (website_url 컬럼 필수)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag & Drop Zone */}
          {/* biome-ignore lint/a11y/useSemanticElements: drag & drop zone requires div for proper styling and DnD functionality */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-all duration-200 ease-in-out
              ${
                isDragOver
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
              }
              ${isProcessing ? "opacity-50 pointer-events-none" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />

            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />

            {selectedFile ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-primary">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                  }}
                  className="mt-2"
                >
                  <X className="mr-2 h-4 w-4" />
                  파일 제거
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-semibold">
                  파일을 드래그하여 놓거나 클릭하여 선택하세요
                </p>
                <p className="text-sm text-muted-foreground">
                  Excel (.xlsx, .xls) 또는 CSV 파일을 지원합니다
                </p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isProcessing}
              size="lg"
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  추출 중...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  추출 시작
                </>
              )}
            </Button>

            {progress?.status === "completed" && jobId && (
              <>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="lg"
                  disabled={downloadMutation.isPending}
                >
                  <Download className="mr-2 h-4 w-4" />
                  결과 다운로드
                </Button>
                <Button
                  onClick={handleCleanup}
                  variant="outline"
                  size="lg"
                  disabled={cleanupMutation.isPending}
                >
                  초기화
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Progress */}
      {progress && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 dark:bg-purple-900/20 p-2">
              <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">3단계: 추출 진행 상황</h2>
              <p className="text-sm text-muted-foreground">실시간으로 진행 상황을 확인하세요</p>
            </div>
          </div>
          <WebExtractionProgress progress={progress} />
        </div>
      )}

      {/* Help Section */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">사용 방법</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex-shrink-0">
                1
              </span>
              <div>
                <p className="font-medium">API 키를 설정하세요 (선택사항)</p>
                <p className="text-muted-foreground text-xs">
                  OpenAI 계정을 여러 개 사용하면 처리 속도가 빨라집니다
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex-shrink-0">
                2
              </span>
              <div>
                <p className="font-medium">Excel 또는 CSV 파일을 준비하세요</p>
                <p className="text-muted-foreground text-xs">
                  <code className="bg-muted px-1 py-0.5 rounded">website_url</code> 컬럼이
                  필수입니다
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex-shrink-0">
                3
              </span>
              <div>
                <p className="font-medium">파일을 업로드하고 추출을 시작하세요</p>
                <p className="text-muted-foreground text-xs">
                  평균 10-30초/건 소요 (웹사이트 응답 속도에 따라 다름)
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <div className="space-y-1">
                <p className="font-medium">추출되는 정보:</p>
                <p className="text-muted-foreground">
                  회사명, 설명, 이메일, 전화번호, 주소, SNS (Facebook, Instagram, Twitter,
                  LinkedIn), 설립년도, 직원 수, 제품/서비스 등
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* API Key Dialog */}
      <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API 키 추가</DialogTitle>
            <DialogDescription>
              OpenAI 플랫폼에서 발급받은 API 키를 추가하세요. 여러 계정의 키를 등록하면 처리 속도가
              빨라집니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddApiKey} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={keyNameId}>키 이름</Label>
              <Input
                id={keyNameId}
                value={apiKeyFormData.name}
                onChange={(e) => setApiKeyFormData({ ...apiKeyFormData, name: e.target.value })}
                placeholder="예: Main Account, Backup Account 1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={apiKeyId}>API 키</Label>
              <Input
                id={apiKeyId}
                type="password"
                value={apiKeyFormData.apiKey}
                onChange={(e) => setApiKeyFormData({ ...apiKeyFormData, apiKey: e.target.value })}
                placeholder="sk-..."
                required
              />
              <p className="text-xs text-muted-foreground">
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  OpenAI 플랫폼
                </a>
                에서 API 키를 발급받을 수 있습니다
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsApiKeyDialogOpen(false)}>
                <X className="mr-2 h-4 w-4" />
                취소
              </Button>
              <Button type="submit" disabled={createApiKeyMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                추가
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WebDataExtraction
