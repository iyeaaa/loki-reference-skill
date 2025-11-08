import { motion } from "framer-motion"
import { AlertCircle, Download, FileUp, Key, RotateCcw, Save, X } from "lucide-react"
import type React from "react"
import { useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiKeyManagementModal } from "@/components/web-extraction/ApiKeyManagementModal"
import { DataTable } from "@/components/web-extraction/DataTable"
import { EmptyState } from "@/components/web-extraction/EmptyState"
import { FileUploadModal } from "@/components/web-extraction/FileUploadModal"
import { ProgressPanel } from "@/components/web-extraction/ProgressPanel"
import { useWebExtractionData } from "@/hooks/useWebExtractionData"
import {
  useCreateApiKey,
  useDeleteApiKey,
  useOpenAIApiKeys,
  useUpdateApiKey,
} from "@/lib/api/hooks/openai-api-keys"
import { useCleanupResults, useWebExtraction } from "@/lib/api/hooks/web-extraction"
import type { ApiKey } from "@/lib/api/types/openai-api-keys"
import type { ExtractionResult } from "@/lib/api/types/web-extraction"
import { formatFileSize, validateAndCountUrls } from "@/utils/web-extraction.utils"

export function WebDataExtraction() {
  const keyNameId = useId()
  const apiKeyId = useId()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [urlCount, setUrlCount] = useState<number | null>(null)
  const [isValidatingFile, setIsValidatingFile] = useState(false)
  const [isApiKeyManagementModalOpen, setIsApiKeyManagementModalOpen] = useState(false)
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false)
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPanelVisible, setIsPanelVisible] = useState(false)
  const [panelWidth, setPanelWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const [isClearDataDialogOpen, setIsClearDataDialogOpen] = useState(false)
  const [isDownloadConfirmDialogOpen, setIsDownloadConfirmDialogOpen] = useState(false)
  const [isClosePanelDialogOpen, setIsClosePanelDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const isInitialMountRef = useRef(true)

  const workspaceId = localStorage.getItem("selectedWorkspace") || ""

  const [apiKeyFormData, setApiKeyFormData] = useState({
    name: "",
    apiKey: "",
  })

  // API hooks
  const { data: apiKeys = [], isLoading: isLoadingApiKeys } = useOpenAIApiKeys(workspaceId)
  const createApiKeyMutation = useCreateApiKey()
  const deleteApiKeyMutation = useDeleteApiKey()
  const updateApiKeyMutation = useUpdateApiKey()

  const { progress, jobId, isProcessing, upload, reset } = useWebExtraction()
  const cleanupMutation = useCleanupResults()

  // Use custom hook for data management
  const {
    data,
    displayProgress,
    totalTimeSaved,
    clearSavedProgress,
    clearAllData,
    setCompletedProgress,
  } = useWebExtractionData(progress, jobId)

  const activeApiKeysCount = apiKeys.filter((k) => k.isActive).length

  // Auto-show panel when processing starts
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }

    if (displayProgress && !isPanelVisible) {
      if (displayProgress.status === "processing") {
        setIsPanelVisible(true)
      }
    }
  }, [displayProgress, isPanelVisible])

  // Auto-open API key dialog if no API keys are set
  useEffect(() => {
    const hasShownApiKeyPrompt = sessionStorage.getItem("webExtractionApiKeyPromptShown")
    if (
      !isLoadingApiKeys &&
      workspaceId &&
      apiKeys.length === 0 &&
      !isApiKeyDialogOpen &&
      !hasShownApiKeyPrompt
    ) {
      setIsApiKeyDialogOpen(true)
      sessionStorage.setItem("webExtractionApiKeyPromptShown", "true")
    }
  }, [isLoadingApiKeys, workspaceId, apiKeys.length, isApiKeyDialogOpen])

  // Auto-open close panel dialog when extraction is completed
  useEffect(() => {
    if (
      progress?.status === "completed" &&
      jobId &&
      Array.isArray(data) &&
      data.length > 0 &&
      !isClosePanelDialogOpen &&
      !isDownloadConfirmDialogOpen
    ) {
      const shownKey = `webExtractionCompletedShown_${jobId}`
      const hasShown = sessionStorage.getItem(shownKey)

      if (!hasShown) {
        if (progress) {
          setCompletedProgress(progress)
        }
        setIsClosePanelDialogOpen(true)
        sessionStorage.setItem(shownKey, "true")
      }
    }
  }, [
    progress?.status,
    jobId,
    data,
    isClosePanelDialogOpen,
    isDownloadConfirmDialogOpen,
    progress,
    setCompletedProgress,
  ])

  // Download template Excel file
  const handleDownloadTemplate = () => {
    try {
      const templateData = [["website_url"], ["https://example.com"]]
      const worksheet = XLSX.utils.aoa_to_sheet(templateData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
      const fileName = `web-extraction-template-${new Date().toISOString().split("T")[0]}.xlsx`
      XLSX.writeFile(workbook, fileName)
      toast.success("템플릿 파일을 다운로드했어요")
    } catch (error) {
      console.error("Template download error:", error)
      toast.error("템플릿 다운로드 중 오류가 발생했어요")
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setError(null)
      setUrlCount(null)

      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        setError(`파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxSize)}까지 업로드 가능합니다.`)
        setSelectedFile(null)
        return
      }

      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".csv")) {
        setError("Excel (.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다")
        setSelectedFile(null)
        return
      }

      setSelectedFile(file)
      setIsValidatingFile(true)
      const { count, error: validationError } = await validateAndCountUrls(file)
      setIsValidatingFile(false)

      if (validationError) {
        setError(validationError)
        setSelectedFile(null)
        setUrlCount(null)
      } else {
        setUrlCount(count)
        if (count === 0) {
          setError("유효한 URL이 없습니다. website_url 컬럼에 데이터가 있는지 확인해주세요.")
        }
      }
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      setError(null)
      setUrlCount(null)

      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        setError(`파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxSize)}까지 업로드 가능합니다.`)
        setSelectedFile(null)
        return
      }

      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".csv")) {
        setError("Excel (.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다")
        setSelectedFile(null)
        return
      }

      setSelectedFile(file)
      setIsValidatingFile(true)
      const { count, error: validationError } = await validateAndCountUrls(file)
      setIsValidatingFile(false)

      if (validationError) {
        setError(validationError)
        setSelectedFile(null)
        setUrlCount(null)
      } else {
        setUrlCount(count)
        if (count === 0) {
          setError("유효한 URL이 없습니다. website_url 컬럼에 데이터가 있는지 확인해주세요.")
        }
      }
    }
  }

  const handleUpload = () => {
    if (!selectedFile || !workspaceId) {
      setError("파일을 선택하고 워크스페이스를 확인해주세요")
      return
    }

    if (urlCount === null || urlCount === 0) {
      setError("유효한 URL이 없습니다. 파일을 다시 확인해주세요.")
      return
    }

    // API 키 체크 - 활성화된 키가 없으면 모달 강제 오픈
    if (activeApiKeysCount === 0) {
      setError("API 키를 먼저 등록해주세요")
      setIsApiKeyManagementModalOpen(true)
      toast.error("웹 데이터 추출을 위해 OpenAI API 키가 필요합니다")
      return
    }

    setError(null)
    clearSavedProgress()
    upload({
      file: selectedFile,
      workspaceId,
    })
  }

  const handleDownload = (splitEmails: boolean = false) => {
    if (!Array.isArray(data) || data.length === 0) {
      setError("다운로드할 데이터가 없습니다")
      return
    }

    try {
      let excelData: unknown[]

      const createRowData = (item: ExtractionResult, emailValue: string = "") => ({
        "Website URL": item.website_url || "",
        "Found Company": item.found_company_name || "",
        Email: emailValue,
        Description: item.description || "",
        Address: item.address || "",
        Country: item.country || "",
        City: item.city || "",
        State: item.state || "",
        Founded: item.founded_year || "",
        Phone: item.phone_number || "",
        Facebook: item.facebook_url || "",
        Instagram: item.instagram_url || "",
        Twitter: item.twitter_url || "",
        LinkedIn: item.linkedin_url || "",
        Employees: item.employee_count || "",
        Products: item.products || "",
        Sectors: item.business_sectors || "",
        Categories: item.product_categories || "",
        Industries: item.industry_types || "",
        "Crawl Time": item.crawl_time_seconds ? `${item.crawl_time_seconds}s` : "",
        "GPT Time": item.gpt_time_seconds ? `${item.gpt_time_seconds}s` : "",
        "Collected At": item.collected_at || "",
        Error: item.error_message || "",
      })

      if (splitEmails) {
        excelData = []
        data.forEach((item) => {
          const emails = item.email
            ? item.email
                .split(/[,;]/)
                .map((e) => e.trim())
                .filter((e) => e.length > 0)
            : [""]

          if (emails.length === 0) {
            excelData.push(createRowData(item, ""))
          } else {
            emails.forEach((email) => {
              excelData.push(createRowData(item, email))
            })
          }
        })
      } else {
        excelData = data.map((item) => createRowData(item, item.email || ""))
      }

      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results")

      const timestamp = new Date().toISOString().split("T")[0]
      const filename = `web_extraction_results_${timestamp}.xlsx`

      XLSX.writeFile(workbook, filename)

      toast.success(
        `${excelData.length}개 항목이 엑셀 파일로 다운로드되었습니다${splitEmails ? " (이메일 분리됨)" : ""}`,
      )
    } catch (error) {
      console.error("Failed to download Excel:", error)
      setError("엑셀 파일 다운로드 중 오류가 발생했습니다")
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

  const handleClearLocalStorage = () => {
    try {
      clearAllData()
      toast.success("로컬스토리지 데이터가 초기화되었습니다")
      setIsClearDataDialogOpen(false)
    } catch (error) {
      console.error("Failed to clear local storage:", error)
      toast.error("데이터 초기화 중 오류가 발생했습니다")
    }
  }

  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!workspaceId || !apiKeyFormData.name.trim() || !apiKeyFormData.apiKey.trim()) {
      return
    }

    // 최소한의 유효성 검사
    const apiKey = apiKeyFormData.apiKey.trim()
    if (!apiKey.startsWith("sk-")) {
      toast.error("OpenAI API 키는 'sk-'로 시작해야 합니다")
      return
    }

    if (apiKey.length < 20) {
      toast.error("API 키가 너무 짧습니다")
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

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = window.innerWidth - e.clientX
      const minWidth = 200
      const maxWidth = 800

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing])

  const hasData = Array.isArray(data) && data.length > 0

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Main Content */}
        {hasData ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Results Header */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <motion.img
                  src="/images/web-extraction-logo.webp"
                  alt="웹데추"
                  className="h-10 w-10 object-contain rounded-lg border border-border cursor-pointer"
                  whileHover={{ scale: 1.1, rotate: 6 }}
                  whileTap={{ scale: 1.8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  style={{ boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}
                  onClick={() => {
                    toast.success("웹데추! 🎉")
                  }}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">웹데추</h2>
                    <span className="text-xs text-muted-foreground">v1.0.0.20251108</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {progress?.status === "processing"
                      ? "지금 추출 중이에요"
                      : "웹사이트에서 추출한 데이터를 확인해보세요"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsApiKeyManagementModalOpen(true)}
                  disabled={isProcessing}
                >
                  <Key className="mr-2 h-4 w-4" />
                  API 키 관리
                  {apiKeys.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {apiKeys.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    if (activeApiKeysCount === 0) {
                      setIsApiKeyManagementModalOpen(true)
                      toast.error("파일을 업로드하려면 API 키를 먼저 등록해주세요.")
                    } else {
                      setIsFileUploadModalOpen(true)
                    }
                  }}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  파일 업로드
                </Button>
                <Button
                  onClick={() => setIsDownloadConfirmDialogOpen(true)}
                  variant="outline"
                  disabled={!Array.isArray(data) || data.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  웹데추 결과 다운로드 ({data.length}개)
                </Button>
                {progress?.status === "completed" && jobId && (
                  <Button
                    onClick={handleCleanup}
                    variant="outline"
                    disabled={cleanupMutation.isPending}
                  >
                    초기화
                  </Button>
                )}
                <Button
                  onClick={() => setIsClearDataDialogOpen(true)}
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  웹데추 데이터 초기화
                </Button>
              </div>
            </div>

            {/* Results Table */}
            <DataTable data={data} />
          </div>
        ) : (
          <EmptyState
            selectedFile={selectedFile}
            urlCount={urlCount}
            isValidatingFile={isValidatingFile}
            isProcessing={isProcessing}
            isDragOver={isDragOver}
            activeApiKeysCount={activeApiKeysCount}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onRemoveFile={() => {
              setSelectedFile(null)
              setUrlCount(null)
              setError(null)
            }}
            onUpload={handleUpload}
            onDownloadTemplate={handleDownloadTemplate}
            onAddApiKey={() => setIsApiKeyManagementModalOpen(true)}
          />
        )}

        {/* Right: Progress Panel */}
        <ProgressPanel
          progress={displayProgress}
          isPanelVisible={isPanelVisible}
          panelWidth={panelWidth}
          isResizing={isResizing}
          activeApiKeysCount={activeApiKeysCount}
          totalTimeSaved={totalTimeSaved}
          onTogglePanel={setIsPanelVisible}
          onStartResize={() => setIsResizing(true)}
          resizeRef={resizeRef}
        />
      </div>

      {/* Modals */}
      <ApiKeyManagementModal
        isOpen={isApiKeyManagementModalOpen}
        onOpenChange={setIsApiKeyManagementModalOpen}
        apiKeys={apiKeys}
        activeApiKeysCount={activeApiKeysCount}
        isProcessing={isProcessing}
        onToggleActive={handleToggleActive}
        onDeleteApiKey={handleDeleteApiKey}
        onAddApiKey={() => setIsApiKeyDialogOpen(true)}
        isUpdating={updateApiKeyMutation.isPending}
        isDeleting={deleteApiKeyMutation.isPending}
      />

      <FileUploadModal
        isOpen={isFileUploadModalOpen}
        onOpenChange={setIsFileUploadModalOpen}
        selectedFile={selectedFile}
        urlCount={urlCount}
        isValidatingFile={isValidatingFile}
        isProcessing={isProcessing}
        isDragOver={isDragOver}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onRemoveFile={() => {
          setSelectedFile(null)
          setUrlCount(null)
          setError(null)
        }}
        onUpload={handleUpload}
        onDownloadTemplate={handleDownloadTemplate}
      />

      {/* API Key Add Dialog */}
      <Dialog
        open={isApiKeyDialogOpen}
        onOpenChange={(open) => {
          if (!isProcessing) {
            setIsApiKeyDialogOpen(open)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API 키 추가</DialogTitle>
            <DialogDescription>
              OpenAI 플랫폼에서 발급받은 API 키를 추가하세요.{" "}
              <span className="font-medium">
                OPENAI 정책상 계정별로 구분된 API KEY가 필요합니다.
              </span>
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
                type="text"
                value={apiKeyFormData.apiKey}
                onChange={(e) => setApiKeyFormData({ ...apiKeyFormData, apiKey: e.target.value })}
                placeholder="sk-..."
                required
                className="font-mono text-xs"
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

      {/* Clear Data Confirmation Dialog */}
      <AlertDialog open={isClearDataDialogOpen} onOpenChange={setIsClearDataDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>웹데추 데이터 초기화 확인</AlertDialogTitle>
            <AlertDialogDescription>
              로컬스토리지에 저장된 웹데추 결과 데이터를 모두 삭제하시겠습니까?
              <br />
              <span className="font-medium text-destructive">이 작업은 되돌릴 수 없습니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearLocalStorage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              초기화
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Panel Confirmation Dialog */}
      <AlertDialog open={isClosePanelDialogOpen} onOpenChange={setIsClosePanelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>추출이 끝났어요</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">결과 패널을 닫을까요?</span>
              <span className="block text-xs text-muted-foreground">
                닫아도 언제든지 다시 열 수 있어요
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsClosePanelDialogOpen(false)
                if (progress?.status === "completed" && Array.isArray(data) && data.length > 0) {
                  setIsDownloadConfirmDialogOpen(true)
                }
              }}
            >
              유지할게요
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsPanelVisible(false)
                setIsClosePanelDialogOpen(false)
                setTimeout(() => {
                  if (progress?.status === "completed" && Array.isArray(data) && data.length > 0) {
                    setIsDownloadConfirmDialogOpen(true)
                  }
                }, 100)
              }}
            >
              닫을게요
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Download Confirmation Dialog */}
      <AlertDialog open={isDownloadConfirmDialogOpen} onOpenChange={setIsDownloadConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>다운로드 옵션 선택</AlertDialogTitle>
            <AlertDialogDescription>
              총 <span className="font-semibold">{data.length}개</span>의 결과가 있습니다.
              <br />
              다운로드 방식을 선택해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={() => {
                handleDownload(false)
                setIsDownloadConfirmDialogOpen(false)
              }}
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span className="font-semibold">기존 형태로 다운로드</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  이메일이 여러 개 있어도 하나의 행으로 유지됩니다
                </span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={() => {
                handleDownload(true)
                setIsDownloadConfirmDialogOpen(false)
              }}
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span className="font-semibold">이메일 분리하여 다운로드</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  이메일이 여러 개인 경우 각 이메일마다 별도의 행으로 생성됩니다
                  <br />
                  예: cs@example.com,sales@example.com → 2개 행 생성
                </span>
              </div>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>나중에</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default WebDataExtraction
