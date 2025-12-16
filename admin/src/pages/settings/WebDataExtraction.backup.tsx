import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileUp,
  Gauge,
  Key,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  X,
  Zap,
} from "lucide-react"
import React, { useCallback, useEffect, useId, useRef, useState } from "react"
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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { WebExtractionProgress } from "@/components/web-extraction/WebExtractionProgress"
import {
  useCreateApiKey,
  useDeleteApiKey,
  useOpenAIApiKeys,
  useUpdateApiKey,
} from "@/lib/api/hooks/openai-api-keys"
import { useCleanupResults, useWebExtraction } from "@/lib/api/hooks/web-extraction"
import type { ApiKey } from "@/lib/api/types/openai-api-keys"
import type { ExtractionProgress, ExtractionResult } from "@/lib/api/types/web-extraction"
import { cn } from "@/lib/utils"

// Tooltip wrapper component for table cells
const TooltipCell = ({
  content,
  children,
  maxWidth = "max-w-md",
}: {
  content: string | null | undefined
  children: React.ReactNode
  maxWidth?: string
}) => {
  const displayContent = content || "-"
  if (displayContent === "-") {
    return <>{children}</>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full">{children}</div>
        </TooltipTrigger>
        <TooltipContent
          className={`${maxWidth} border-2 border-border bg-background p-3 text-foreground shadow-lg outline outline-1 outline-border`}
          side="top"
        >
          <div className="whitespace-pre-wrap break-all text-sm">{displayContent}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

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
  const [isPanelVisible, setIsPanelVisible] = useState(false) // 초기에는 패널 숨김
  const [panelWidth, setPanelWidth] = useState(320) // 기본 너비 320px (w-80)
  const [isResizing, setIsResizing] = useState(false)
  const [isClearDataDialogOpen, setIsClearDataDialogOpen] = useState(false)
  const [isDownloadConfirmDialogOpen, setIsDownloadConfirmDialogOpen] = useState(false)
  const [isClosePanelDialogOpen, setIsClosePanelDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const isInitialMountRef = useRef(true) // 초기 마운트 여부 추적

  const workspaceId = localStorage.getItem("selectedWorkspace") || ""

  const [apiKeyFormData, setApiKeyFormData] = useState({
    name: "",
    apiKey: "",
  })
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  // 총 절약 시간 상태 (로컬스토리지에서 로드)
  const [totalTimeSaved] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("webExtractionTotalTimeSaved")
      return saved ? Number.parseFloat(saved) : 0
    } catch {
      return 0
    }
  })
  // 초기 상태를 로컬스토리지에서 동기적으로 로드
  const [data, setData] = useState<ExtractionResult[]>(() => {
    try {
      const storedData = localStorage.getItem("exaWebSetTestData")
      if (storedData) {
        const parsedData = JSON.parse(storedData) as unknown
        // 배열인지 확인
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          return parsedData as ExtractionResult[]
        }
      }
    } catch (error) {
      console.error("Failed to load initial data from storage:", error)
    }
    return []
  })

  // Use TanStack Query hooks for API keys
  const { data: apiKeys = [], isLoading: isLoadingApiKeys } = useOpenAIApiKeys(workspaceId)
  const createApiKeyMutation = useCreateApiKey()
  const deleteApiKeyMutation = useDeleteApiKey()
  const updateApiKeyMutation = useUpdateApiKey()

  // Use TanStack Query hooks for web extraction
  const { progress, jobId, isProcessing, upload, reset } = useWebExtraction()
  const cleanupMutation = useCleanupResults()

  // 완료된 progress를 별도로 관리 (새 작업 시작 시에도 유지)
  const [completedProgress, setCompletedProgress] = useState<ExtractionProgress | null>(() => {
    try {
      const saved = localStorage.getItem("webExtractionProgress")
      if (saved) {
        const parsed = JSON.parse(saved) as ExtractionProgress
        // 완료된 상태만 복원
        if (parsed?.status === "completed") {
          return parsed
        }
      }
    } catch (error) {
      console.error("Failed to load saved progress:", error)
    }
    return null
  })

  // 완료된 progress를 로컬스토리지에 저장하고 상태 업데이트
  React.useEffect(() => {
    if (progress?.status === "completed") {
      try {
        const progressToSave = JSON.parse(JSON.stringify(progress)) // 깊은 복사
        localStorage.setItem("webExtractionProgress", JSON.stringify(progressToSave))
        setCompletedProgress(progressToSave)
        console.log("[WebExtraction] Completed progress saved:", progressToSave)
      } catch (error) {
        console.error("Failed to save progress:", error)
      }
    }
  }, [progress?.status, progress])

  // progress가 null로 변경될 때 completedProgress가 없으면 로컬스토리지에서 로드
  React.useEffect(() => {
    if (!(completedProgress || progress || isProcessing)) {
      try {
        const saved = localStorage.getItem("webExtractionProgress")
        if (saved) {
          const parsed = JSON.parse(saved) as ExtractionProgress
          if (parsed?.status === "completed") {
            setCompletedProgress(parsed)
            console.log("[WebExtraction] Loaded completed progress from storage")
          }
        }
      } catch (error) {
        console.error("Failed to load completed progress:", error)
      }
    }
  }, [progress, completedProgress, isProcessing])

  // 표시할 progress 결정 (useMemo로 최적화)
  // 우선순위: 현재 progress > completedProgress > localStorage
  const displayProgress = React.useMemo(() => {
    // 1. progress가 있으면 무조건 사용 (어떤 상태든)
    if (progress) {
      return progress
    }

    // 2. progress가 없을 때만 completedProgress 사용
    if (completedProgress) {
      return completedProgress
    }

    // 3. 둘 다 없으면 localStorage에서 로드
    try {
      const saved = localStorage.getItem("webExtractionProgress")
      if (saved) {
        const parsed = JSON.parse(saved) as ExtractionProgress
        if (parsed?.status === "completed") {
          return parsed
        }
      }
    } catch (error) {
      console.error("Failed to read completed progress from storage:", error)
    }

    return null
  }, [progress, completedProgress])

  // progress가 시작되거나 완료된 progress가 있으면 패널 자동 표시
  useEffect(() => {
    // 초기 마운트 후에는 flag를 false로 설정
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      // 초기 마운트 시에는 패널을 자동으로 열지 않음
      return
    }

    if (displayProgress && !isPanelVisible) {
      // processing 상태일 때만 패널을 자동으로 열기
      if (displayProgress.status === "processing") {
        setIsPanelVisible(true)
      }
    }
  }, [displayProgress, isPanelVisible])

  // Auto-open API key dialog if no API keys are set (only once per session)
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

  // Auto-open close panel dialog when extraction is completed (only once per job)
  useEffect(() => {
    if (
      progress?.status === "completed" &&
      jobId &&
      Array.isArray(data) &&
      data.length > 0 &&
      !isClosePanelDialogOpen &&
      !isDownloadConfirmDialogOpen
    ) {
      // 이 작업에 대해 이미 모달을 표시했는지 확인
      const shownKey = `webExtractionCompletedShown_${jobId}`
      const hasShown = sessionStorage.getItem(shownKey)

      if (!hasShown) {
        // 모달 열기 전에 completedProgress를 명시적으로 보존
        if (progress) {
          setCompletedProgress(progress)
        }
        setIsClosePanelDialogOpen(true)
        sessionStorage.setItem(shownKey, "true")
      }
    }
  }, [progress?.status, jobId, data, isClosePanelDialogOpen, isDownloadConfirmDialogOpen, progress])

  // 실시간 결과를 localStorage에 저장하고 상태 업데이트
  const updateResultsInStorage = useCallback((latestResult: unknown) => {
    try {
      const storedData = localStorage.getItem("exaWebSetTestData")
      let results: ExtractionResult[] = []

      if (storedData) {
        const parsed = JSON.parse(storedData)
        // 배열인지 확인
        results = Array.isArray(parsed) ? parsed : []
      }

      // 최신 결과 추가 또는 업데이트
      const result = latestResult as ExtractionResult
      if (result && typeof result === "object" && "website_url" in result) {
        const existingIndex = results.findIndex((r) => r.website_url === result.website_url)

        if (existingIndex >= 0) {
          // 기존 결과 업데이트
          results[existingIndex] = result
        } else {
          // 새 결과 추가
          results.push(result)
        }

        localStorage.setItem("exaWebSetTestData", JSON.stringify(results))
        // 상태 업데이트
        setData([...results])
        // 같은 페이지에서의 업데이트도 감지하기 위해 커스텀 이벤트 발생
        window.dispatchEvent(new Event("exaWebSetDataUpdated"))
      }
    } catch (error) {
      console.error("Failed to update results in storage:", error)
    }
  }, [])

  // 완료 시 전체 결과를 localStorage에 저장하고 상태 업데이트
  const saveResultsToStorage = useCallback(async (completedJobId: string) => {
    try {
      const { webExtractionApi } = await import("@/lib/api/services/web-extraction")
      const results = (await webExtractionApi.getResults(completedJobId)) as unknown

      // 배열인지 확인
      const validResults = Array.isArray(results) ? results : []

      // 데이터가 있으면 저장하고 업데이트
      if (validResults.length > 0) {
        localStorage.setItem("exaWebSetTestData", JSON.stringify(validResults))
        // 상태 업데이트
        setData(validResults as ExtractionResult[])
        // storage 이벤트 발생시켜서 다른 탭/페이지에서도 업데이트되도록
        window.dispatchEvent(new Event("storage"))
        // 같은 페이지에서의 업데이트도 감지하기 위해 커스텀 이벤트 발생
        window.dispatchEvent(new Event("exaWebSetDataUpdated"))
      } else {
        // API에서 결과가 없으면 기존 로컬스토리지 데이터 유지
        const storedData = localStorage.getItem("exaWebSetTestData")
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData) as unknown
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              setData(parsedData as ExtractionResult[])
            }
          } catch (parseError) {
            console.error("Failed to parse stored data:", parseError)
          }
        }
      }
    } catch (error) {
      console.error("Failed to save results to storage:", error)
      // 실패해도 기존 데이터 유지
      const storedData = localStorage.getItem("exaWebSetTestData")
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData) as unknown
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            setData(parsedData as ExtractionResult[])
          }
        } catch (parseError) {
          console.error("Failed to parse stored data:", parseError)
        }
      }
    }
  }, [])

  // 초기 데이터 로드
  React.useEffect(() => {
    const loadDataFromStorage = () => {
      try {
        const storedData = localStorage.getItem("exaWebSetTestData")
        if (storedData) {
          const parsedData = JSON.parse(storedData) as unknown
          // 배열인지 확인
          if (Array.isArray(parsedData)) {
            setData(parsedData as ExtractionResult[])
          } else {
            // 배열이 아니면 빈 배열로 초기화
            setData([])
            localStorage.removeItem("exaWebSetTestData")
          }
        }
      } catch (error) {
        console.error("Failed to load data from storage:", error)
        setData([])
      }
    }

    loadDataFromStorage()

    // storage 이벤트 리스너 (다른 탭/페이지에서 업데이트 시)
    const handleStorageChange = () => {
      loadDataFromStorage()
    }

    // 같은 페이지에서의 업데이트도 감지하기 위해 커스텀 이벤트 리스너 추가
    const handleCustomStorage = () => {
      loadDataFromStorage()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("exaWebSetDataUpdated", handleCustomStorage)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("exaWebSetDataUpdated", handleCustomStorage)
    }
  }, [])

  // 실시간 결과 업데이트 감지
  React.useEffect(() => {
    if (progress?.latestResult) {
      updateResultsInStorage(progress.latestResult)
    }
  }, [progress?.latestResult, updateResultsInStorage])

  // 완료 이벤트 감지
  React.useEffect(() => {
    if (progress?.status === "completed" && jobId) {
      saveResultsToStorage(jobId).catch((error) => {
        console.error("Error saving results:", error)
        // 실패해도 기존 데이터는 유지됨
      })
    }
  }, [progress?.status, jobId, saveResultsToStorage])

  // 완료 후에도 데이터가 없으면 로컬스토리지에서 다시 로드
  React.useEffect(() => {
    if (progress?.status === "completed" && (!data || data.length === 0)) {
      const storedData = localStorage.getItem("exaWebSetTestData")
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData) as unknown
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            setData(parsedData as ExtractionResult[])
          }
        } catch (error) {
          console.error("Failed to load data after completion:", error)
        }
      }
    }
  }, [progress?.status, data])

  const activeApiKeysCount = apiKeys.filter((k) => k.isActive).length

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {
      return "0 Bytes"
    }
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  // Download template Excel file
  const handleDownloadTemplate = () => {
    try {
      // Create template data with header and sample row
      const templateData = [["website_url"], ["https://example.com"]]

      // Create workbook and worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(templateData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")

      // Generate file name with current date
      const fileName = `web-extraction-template-${new Date().toISOString().split("T")[0]}.xlsx`

      // Write and download
      XLSX.writeFile(workbook, fileName)
      toast.success("템플릿 파일을 다운로드했어요")
    } catch (error) {
      console.error("Template download error:", error)
      toast.error("템플릿 다운로드 중 오류가 발생했어요")
    }
  }

  // Validate and count URLs in file
  const validateAndCountUrls = async (
    file: File,
  ): Promise<{ count: number; error: string | null }> => {
    try {
      setIsValidatingFile(true)
      const fileExtension = file.name.toLowerCase().split(".").pop()

      if (fileExtension === "csv") {
        const text = await file.text()
        const lines = text.split("\n").filter((line) => line.trim())
        if (lines.length === 0) {
          return { count: 0, error: "파일이 비어있습니다" }
        }

        // Find header row
        const headerLine = lines[0]
        const headers = headerLine.split(",").map((h) => h.trim().toLowerCase())
        const urlColumnIndex = headers.indexOf("website_url")

        if (urlColumnIndex === -1) {
          return { count: 0, error: "website_url 컬럼을 찾을 수 없습니다" }
        }

        // Count non-empty URLs
        const urlCount = lines.slice(1).filter((line) => {
          const values = line.split(",")
          const url = values[urlColumnIndex]?.trim()
          return url && url.length > 0
        }).length

        return { count: urlCount, error: null }
      }
      if (fileExtension === "xlsx" || fileExtension === "xls") {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: "array" })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        if (!worksheet) {
          return { count: 0, error: "시트를 읽을 수 없습니다" }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

        if (jsonData.length === 0) {
          return { count: 0, error: "파일이 비어있습니다" }
        }

        // Find header row
        const headerRow = jsonData[0] as string[]
        const urlColumnIndex = headerRow.findIndex(
          (h) => String(h).trim().toLowerCase() === "website_url",
        )

        if (urlColumnIndex === -1) {
          return { count: 0, error: "website_url 컬럼을 찾을 수 없습니다" }
        }

        // Count non-empty URLs
        const urlCount = jsonData.slice(1).filter((row) => {
          const url = String(row[urlColumnIndex] || "").trim()
          return url && url.length > 0
        }).length

        return { count: urlCount, error: null }
      }

      return { count: 0, error: "지원하지 않는 파일 형식입니다" }
    } catch (err) {
      console.error("File validation error:", err)
      return { count: 0, error: "파일을 읽는 중 오류가 발생했습니다" }
    } finally {
      setIsValidatingFile(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setError(null)
      setUrlCount(null)

      // File size validation (max 50MB)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        setError(`파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxSize)}까지 업로드 가능합니다.`)
        setSelectedFile(null)
        return
      }

      // File type validation
      const fileName = file.name.toLowerCase()
      if (!(fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv"))) {
        setError("Excel (.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다")
        setSelectedFile(null)
        return
      }

      setSelectedFile(file)

      // Validate and count URLs
      const { count, error: validationError } = await validateAndCountUrls(file)
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

      // File size validation (max 50MB)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        setError(`파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxSize)}까지 업로드 가능합니다.`)
        setSelectedFile(null)
        return
      }

      // File type validation
      const fileName = file.name.toLowerCase()
      if (!(fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv"))) {
        setError("Excel (.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다")
        setSelectedFile(null)
        return
      }

      setSelectedFile(file)

      // Validate and count URLs
      const { count, error: validationError } = await validateAndCountUrls(file)
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
    if (!(selectedFile && workspaceId)) {
      setError("파일을 선택하고 워크스페이스를 확인해주세요")
      return
    }

    if (urlCount === null || urlCount === 0) {
      setError("유효한 URL이 없습니다. 파일을 다시 확인해주세요.")
      return
    }

    setError(null)
    // 새로운 작업 시작 시 저장된 progress 초기화
    try {
      localStorage.removeItem("webExtractionProgress")
      setCompletedProgress(null)
    } catch (error) {
      console.error("Failed to clear saved progress:", error)
    }
    upload({
      file: selectedFile,
      workspaceId,
    })
  }

  const handleDownload = (splitEmails = false) => {
    if (!Array.isArray(data) || data.length === 0) {
      setError("다운로드할 데이터가 없습니다")
      return
    }

    try {
      let excelData: unknown[]

      // 테이블 UI 열 순서에 맞춘 데이터 구조
      const createRowData = (item: ExtractionResult, emailValue = "") => ({
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
        // 이메일 분리 옵션: 이메일이 여러개인 경우 각 이메일마다 행 생성
        excelData = []
        data.forEach((item) => {
          const emails = item.email
            ? item.email
                .split(/[,;]/)
                .map((e) => e.trim())
                .filter((e) => e.length > 0)
            : [""]

          if (emails.length === 0) {
            // 이메일이 없는 경우 1개 행 생성
            excelData.push(createRowData(item, ""))
          } else {
            // 각 이메일마다 행 생성
            emails.forEach((email) => {
              excelData.push(createRowData(item, email))
            })
          }
        })
      } else {
        // 기존 형태 그대로 다운로드 (테이블 순서에 맞춤)
        excelData = data.map((item) => createRowData(item, item.email || ""))
      }

      // 워크북 생성
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results")

      // 파일명 생성
      const timestamp = new Date().toISOString().split("T")[0]
      const filename = `web_extraction_results_${timestamp}.xlsx`

      // 엑셀 파일 다운로드
      XLSX.writeFile(workbook, filename)

      toast.success(
        `${excelData.length}개 항목이 엑셀 파일로 다운로드되었습니다${
          splitEmails ? " (이메일 분리됨)" : ""
        }`,
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
      localStorage.removeItem("exaWebSetTestData")
      // progress는 유지 (완료된 결과 패널은 계속 표시)
      setData([])
      window.dispatchEvent(new Event("storage"))
      window.dispatchEvent(new Event("exaWebSetDataUpdated"))
      toast.success("로컬스토리지 데이터가 초기화되었습니다")
      setIsClearDataDialogOpen(false)
    } catch (error) {
      console.error("Failed to clear local storage:", error)
      toast.error("데이터 초기화 중 오류가 발생했습니다")
    }
  }

  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!(workspaceId && apiKeyFormData.name.trim() && apiKeyFormData.apiKey.trim())) {
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
    if (!confirm("이 API 키를 삭제하시겠습니까?")) {
      return
    }

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
    if (!dateString) {
      return "사용 안함"
    }
    const date = new Date(dateString)
    return date.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatCollectedAt = (dateString: string | null | undefined) => {
    if (!dateString) {
      return "-"
    }
    try {
      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) {
        return dateString
      }

      return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    } catch {
      return dateString
    }
  }

  const maskApiKey = (key: string) => {
    if (key.length <= 8) {
      return "•".repeat(key.length)
    }
    return `${key.slice(0, 7)}${"•".repeat(Math.max(0, key.length - 11))}${key.slice(-4)}`
  }

  const toggleRevealKey = (keyId: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(keyId)) {
        next.delete(keyId)
      } else {
        next.add(keyId)
      }
      return next
    })
  }

  // Normalize URL to ensure it has a protocol
  const normalizeUrl = (url: string | null | undefined): string | null => {
    if (!url || url.trim() === "") {
      return null
    }

    const trimmedUrl = url.trim()

    // If it already has a protocol, return as is
    if (/^https?:\/\//i.test(trimmedUrl)) {
      return trimmedUrl
    }

    // If it starts with //, add https:
    if (trimmedUrl.startsWith("//")) {
      return `https:${trimmedUrl}`
    }

    // Otherwise, add https://
    return `https://${trimmedUrl}`
  }

  // Handle website link click safely
  const handleWebsiteClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string | null | undefined,
  ) => {
    e.preventDefault()
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl) {
      toast.error("유효하지 않은 URL입니다.")
      return
    }

    try {
      // Validate URL format
      new URL(normalizedUrl)
      window.open(normalizedUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error("유효하지 않은 URL 형식입니다.")
      console.error("Invalid URL:", normalizedUrl, error)
    }
  }

  // 패널 너비 조절 핸들러
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) {
        return
      }

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
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Main Content */}
        {hasData ? (
          // Data exists - Show current UI
          <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
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
                <img
                  alt="웹데추"
                  className="h-10 w-10 rounded-lg border border-border object-contain"
                  src="/images/web-extraction-logo.webp"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-xl">웹데추</h2>
                    <span className="text-muted-foreground text-xs">v1.0.0.20251108</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {progress?.status === "processing"
                      ? "지금 추출 중이에요"
                      : "웹사이트에서 추출한 데이터를 확인해보세요"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={isProcessing}
                  onClick={() => setIsApiKeyManagementModalOpen(true)}
                  variant="outline"
                >
                  <Key className="mr-2 h-4 w-4" />
                  API 키 관리
                  {apiKeys.length > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {apiKeys.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    if (apiKeys.length === 0) {
                      setIsApiKeyDialogOpen(true)
                      toast.error("파일을 업로드하려면 API 키를 먼저 설정해주세요.")
                    } else {
                      setIsFileUploadModalOpen(true)
                    }
                  }}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  파일 업로드
                </Button>
                <Button
                  disabled={!Array.isArray(data) || data.length === 0}
                  onClick={() => setIsDownloadConfirmDialogOpen(true)}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  웹데추 결과 다운로드 ({data.length}개)
                </Button>
                {progress?.status === "completed" && jobId && (
                  <Button
                    disabled={cleanupMutation.isPending}
                    onClick={handleCleanup}
                    variant="outline"
                  >
                    초기화
                  </Button>
                )}
                <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => setIsClearDataDialogOpen(true)}
                  variant="outline"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  웹데추 데이터 초기화
                </Button>
              </div>
            </div>

            {/* Results Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 z-10 min-w-[200px] border-r bg-background p-1">
                          Website URL
                        </TableHead>
                        <TableHead className="min-w-[150px] border-r p-1">Found Company</TableHead>
                        <TableHead className="min-w-[200px] max-w-[200px] border-r p-1">
                          Email
                        </TableHead>
                        <TableHead className="min-w-[250px] border-r p-1">Description</TableHead>
                        <TableHead className="min-w-[200px] border-r p-1">Address</TableHead>
                        <TableHead className="min-w-[100px] border-r p-1">Country</TableHead>
                        <TableHead className="min-w-[120px] border-r p-1">City</TableHead>
                        <TableHead className="min-w-[80px] border-r p-1">State</TableHead>
                        <TableHead className="min-w-[100px] border-r p-1">Founded</TableHead>
                        <TableHead className="min-w-[130px] border-r p-1">Phone</TableHead>
                        <TableHead className="min-w-[150px] border-r p-1">Facebook</TableHead>
                        <TableHead className="min-w-[150px] border-r p-1">Instagram</TableHead>
                        <TableHead className="min-w-[150px] border-r p-1">Twitter</TableHead>
                        <TableHead className="min-w-[150px] border-r p-1">LinkedIn</TableHead>
                        <TableHead className="min-w-[100px] border-r p-1">Employees</TableHead>
                        <TableHead className="min-w-[200px] border-r p-1">Products</TableHead>
                        <TableHead className="min-w-[180px] border-r p-1">Sectors</TableHead>
                        <TableHead className="min-w-[180px] border-r p-1">Categories</TableHead>
                        <TableHead className="min-w-[150px] border-r p-1">Industries</TableHead>
                        <TableHead className="min-w-[100px] border-r p-1">Crawl Time</TableHead>
                        <TableHead className="min-w-[100px] border-r p-1">GPT Time</TableHead>
                        <TableHead className="min-w-[150px] border-r p-1">Collected At</TableHead>
                        <TableHead className="min-w-[200px] border-r p-1">Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((item, index) => (
                        <TableRow key={`${item.website_url}-${index}`}>
                          <TableCell className="sticky left-0 z-10 border-r bg-background p-1">
                            <TooltipCell content={item.website_url}>
                              {item.website_url ? (
                                <a
                                  className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                                  href={normalizeUrl(item.website_url) || "#"}
                                  onClick={(e) => handleWebsiteClick(e, item.website_url)}
                                >
                                  <span className="line-clamp-3 max-w-[180px] break-all">
                                    {item.website_url}
                                  </span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.found_company_name}>
                              <div className="line-clamp-3 break-words">
                                {item.found_company_name || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.email}>
                              <div className="line-clamp-3 max-w-[200px] break-all">
                                {item.email || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.description}>
                              <div className="line-clamp-3 max-w-[230px] break-words">
                                {item.description || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.address}>
                              <div className="line-clamp-3 break-words">{item.address || "-"}</div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.country}>
                              <div className="line-clamp-3 break-words">{item.country || "-"}</div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.city}>
                              <div className="line-clamp-3 break-words">{item.city || "-"}</div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.state}>
                              <div className="line-clamp-3 break-words">{item.state || "-"}</div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.founded_year}>
                              <div className="line-clamp-3 break-words">
                                {item.founded_year || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.phone_number}>
                              <div className="line-clamp-3 break-words">
                                {item.phone_number || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            {item.facebook_url ? (
                              <TooltipCell content={item.facebook_url}>
                                <a
                                  className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                                  href={normalizeUrl(item.facebook_url) || "#"}
                                  onClick={(e) => handleWebsiteClick(e, item.facebook_url)}
                                >
                                  <span className="line-clamp-3 max-w-[140px] break-all">
                                    {item.facebook_url}
                                  </span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </TooltipCell>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="border-r p-1">
                            {item.instagram_url ? (
                              <TooltipCell content={item.instagram_url}>
                                <a
                                  className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                                  href={normalizeUrl(item.instagram_url) || "#"}
                                  onClick={(e) => handleWebsiteClick(e, item.instagram_url)}
                                >
                                  <span className="line-clamp-3 max-w-[140px] break-all">
                                    {item.instagram_url}
                                  </span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </TooltipCell>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="border-r p-1">
                            {item.twitter_url ? (
                              <TooltipCell content={item.twitter_url}>
                                <a
                                  className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                                  href={normalizeUrl(item.twitter_url) || "#"}
                                  onClick={(e) => handleWebsiteClick(e, item.twitter_url)}
                                >
                                  <span className="line-clamp-3 max-w-[140px] break-all">
                                    {item.twitter_url}
                                  </span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </TooltipCell>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="border-r p-1">
                            {item.linkedin_url ? (
                              <TooltipCell content={item.linkedin_url}>
                                <a
                                  className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                                  href={normalizeUrl(item.linkedin_url) || "#"}
                                  onClick={(e) => handleWebsiteClick(e, item.linkedin_url)}
                                >
                                  <span className="line-clamp-3 max-w-[140px] break-all">
                                    {item.linkedin_url}
                                  </span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </TooltipCell>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.employee_count?.toString()}>
                              <div className="line-clamp-3 break-words">
                                {item.employee_count || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.products}>
                              <div className="line-clamp-3 max-w-[180px] break-words">
                                {item.products || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.business_sectors}>
                              <div className="line-clamp-3 max-w-[160px] break-words">
                                {item.business_sectors || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.product_categories}>
                              <div className="line-clamp-3 max-w-[160px] break-words">
                                {item.product_categories || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.industry_types}>
                              <div className="line-clamp-3 max-w-[130px] break-words">
                                {item.industry_types || "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1 text-right">
                            <TooltipCell
                              content={
                                item.crawl_time_seconds ? `${item.crawl_time_seconds}s` : null
                              }
                            >
                              <div className="line-clamp-3 break-words">
                                {item.crawl_time_seconds ? `${item.crawl_time_seconds}s` : "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1 text-right">
                            <TooltipCell
                              content={item.gpt_time_seconds ? `${item.gpt_time_seconds}s` : null}
                            >
                              <div className="line-clamp-3 break-words">
                                {item.gpt_time_seconds ? `${item.gpt_time_seconds}s` : "-"}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1 text-muted-foreground text-xs">
                            <TooltipCell content={formatCollectedAt(item.collected_at)}>
                              <div className="line-clamp-3 break-words">
                                {formatCollectedAt(item.collected_at)}
                              </div>
                            </TooltipCell>
                          </TableCell>
                          <TableCell className="border-r p-1">
                            <TooltipCell content={item.error_message}>
                              {item.error_message ? (
                                <span className="line-clamp-3 block break-words text-red-600 text-xs">
                                  {item.error_message}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TooltipCell>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          // No data - Empty state similar to chat interface
          <div className="flex flex-1 flex-col items-center px-4 pt-[20vh] pb-8">
            <div className="mx-auto w-full space-y-8" style={{ maxWidth: "670px" }}>
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Logo - Centered at top */}
              <div className="flex flex-col items-center justify-center gap-3">
                <img
                  alt="웹데추"
                  className="h-[100px] w-[100px] rounded-lg object-contain"
                  src="/images/web-extraction-logo.webp"
                />
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-2xl">웹데추</h2>
                  <span className="text-muted-foreground text-xs">v1.0.0.20251108</span>
                </div>
              </div>

              {/* File Upload Section - Centered */}
              <div className="relative w-full">
                <motion.div
                  animate={{
                    scale: isDragOver ? 1.02 : 1,
                  }}
                  className={cn(
                    "relative rounded-2xl border-2 border-dashed shadow-sm transition-colors duration-200",
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : selectedFile
                        ? "border-primary/50 bg-primary/3"
                        : "border-muted-foreground/25 bg-background",
                    !(isProcessing || selectedFile) && "hover:border-primary/50 hover:bg-accent/50",
                    isProcessing && "pointer-events-none opacity-50",
                    !isProcessing && "cursor-pointer",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  transition={{
                    duration: 0.2,
                    ease: "easeInOut",
                  }}
                  whileHover={isProcessing || selectedFile ? {} : { scale: 1.01 }}
                  whileTap={isProcessing ? {} : { scale: 0.98 }}
                >
                  <input
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    disabled={isProcessing}
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    type="file"
                  />

                  <div className="p-8 text-center">
                    <AnimatePresence mode="wait">
                      {selectedFile ? (
                        <motion.div
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="space-y-3"
                          exit={{ opacity: 0, scale: 0.8 }}
                          initial={{ opacity: 0, scale: 0.8, y: 20 }}
                          key="file-selected"
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          <motion.div
                            animate={{ scale: 1 }}
                            className="mb-2 flex justify-center"
                            initial={{ scale: 0 }}
                            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                          >
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                              <FileUp className="h-8 w-8 text-primary" />
                            </div>
                          </motion.div>
                          <motion.p
                            animate={{ opacity: 1 }}
                            className="font-semibold text-lg text-primary"
                            initial={{ opacity: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            {selectedFile.name}
                          </motion.p>
                          <motion.div
                            animate={{ opacity: 1 }}
                            className="space-y-1"
                            initial={{ opacity: 0 }}
                            transition={{ delay: 0.3 }}
                          >
                            <p className="text-muted-foreground text-sm">
                              <span className="font-medium">
                                {formatFileSize(selectedFile.size)}
                              </span>
                            </p>
                            {isValidatingFile ? (
                              <motion.p
                                animate={{ opacity: 1 }}
                                className="text-muted-foreground text-sm"
                                initial={{ opacity: 0 }}
                              >
                                검증 중...
                              </motion.p>
                            ) : urlCount !== null ? (
                              <motion.p
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-muted-foreground text-sm"
                                initial={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: 0.4, type: "spring" }}
                              >
                                URL{" "}
                                <span className="font-medium text-primary">
                                  {urlCount.toLocaleString()}개
                                </span>
                              </motion.p>
                            ) : null}
                          </motion.div>
                          <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 flex items-center justify-center gap-2"
                            initial={{ opacity: 0, y: 10 }}
                            transition={{ delay: 0.5 }}
                          >
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedFile(null)
                                setUrlCount(null)
                                setError(null)
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              <X className="mr-2 h-4 w-4" />
                              제거
                            </Button>
                            <Button
                              disabled={
                                !selectedFile ||
                                isProcessing ||
                                isValidatingFile ||
                                urlCount === null ||
                                urlCount === 0
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                if (selectedFile && urlCount !== null && urlCount > 0) {
                                  handleUpload()
                                }
                              }}
                              size="sm"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              업로드 시작
                            </Button>
                          </motion.div>
                        </motion.div>
                      ) : (
                        <motion.div
                          animate={{ opacity: 1 }}
                          className="space-y-2"
                          exit={{ opacity: 0 }}
                          initial={{ opacity: 0 }}
                          key="file-empty"
                          transition={{ duration: 0.2 }}
                        >
                          <motion.div
                            animate={{
                              y: [0, -8, 0],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Number.POSITIVE_INFINITY,
                              ease: "easeInOut",
                            }}
                          >
                            <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                          </motion.div>
                          <p className="font-semibold text-lg">
                            website_url이 포함된 엑셀 파일을 올려주세요
                          </p>
                          <p className="text-muted-foreground text-sm">
                            드래그하거나 클릭하면 돼요
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
                {/* Template Download Button - Outside upload area */}
                <div className="mt-4 flex justify-center">
                  <Button
                    className="text-xs"
                    onClick={handleDownloadTemplate}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    템플릿 다운로드
                  </Button>
                </div>
              </div>

              {/* Speed Boost Banner - Simple */}
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto mt-6 w-full"
                initial={{ opacity: 0, y: 10 }}
                style={{ maxWidth: "670px" }}
                transition={{ duration: 0.4 }}
              >
                <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                      }}
                      className="flex-shrink-0"
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                        <Zap className="h-5 w-5 text-primary" fill="currentColor" />
                      </div>
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      {activeApiKeysCount > 0 ? (
                        <>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <p className="font-semibold text-foreground text-sm">
                              API KEY{" "}
                              <motion.span
                                animate={{ scale: 1 }}
                                className="inline-block font-bold text-primary"
                                initial={{ scale: 0 }}
                                key={`api-key-count-${activeApiKeysCount}`}
                                transition={{ type: "spring", stiffness: 200 }}
                              >
                                {activeApiKeysCount}개
                              </motion.span>
                              로{" "}
                              <motion.span
                                animate={{ scale: 1 }}
                                className="inline-block font-bold text-primary"
                                initial={{ scale: 0 }}
                                key={`api-key-speed-${activeApiKeysCount}`}
                                transition={{ type: "spring", stiffness: 200 }}
                              >
                                {activeApiKeysCount}배
                              </motion.span>{" "}
                              빠르게 처리 중
                            </p>
                          </div>
                          <p className="mt-0.5 text-muted-foreground text-xs">
                            1개당 20개 동시 처리 · 추가할수록 더 빨라져요 (현재{" "}
                            <span className="font-medium text-primary">
                              {activeApiKeysCount * 20}개
                            </span>{" "}
                            동시 처리 중)
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-primary" />
                            <p className="font-semibold text-foreground text-sm">
                              API 키를 먼저 설정해주세요
                            </p>
                          </div>
                          <p className="mt-0.5 text-muted-foreground text-xs">
                            API KEY 추가하면 <span className="font-medium text-primary">N배</span>{" "}
                            빨라져요 ·{" "}
                            <span className="font-medium">계정별로 구분된 KEY가 필요해요</span>
                          </p>
                        </>
                      )}
                    </div>
                    <Button
                      className="flex-shrink-0"
                      disabled={isProcessing}
                      onClick={() => {
                        setIsApiKeyManagementModalOpen(true)
                      }}
                      size="sm"
                      variant={activeApiKeysCount === 0 ? "default" : "outline"}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      API KEY 추가
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Right: Progress Panel */}
        {displayProgress &&
          (isPanelVisible ? (
            <>
              {/* Resizer Handle */}
              {/* biome-ignore lint/a11y/useSemanticElements: resizer handle requires div for proper styling and drag functionality */}
              <div
                aria-label="패널 너비 조절"
                aria-orientation="vertical"
                aria-valuenow={panelWidth}
                className={cn(
                  "w-1 flex-shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/50",
                  isResizing && "bg-primary",
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsResizing(true)
                }}
                ref={resizeRef}
                role="separator"
                tabIndex={0}
              />
              <div
                className="flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-border border-l bg-muted/20"
                style={{ width: `${panelWidth}px` }}
              >
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="flex items-center justify-end border-border border-b p-2">
                    <button
                      aria-label="패널 숨기기"
                      className="rounded-md p-1.5 transition-colors hover:bg-muted"
                      onClick={() => setIsPanelVisible(false)}
                      type="button"
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                    <WebExtractionProgress
                      apiKeyCount={activeApiKeysCount}
                      concurrency={activeApiKeysCount * 20}
                      progress={displayProgress}
                      totalTimeSaved={totalTimeSaved}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <button
              aria-label="패널 보이기"
              className="flex w-8 items-center justify-center border-border border-l bg-muted/20 transition-colors hover:bg-muted/40"
              onClick={() => setIsPanelVisible(true)}
              type="button"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
      </div>

      {/* API Key Management Modal */}
      <TooltipProvider>
        <Dialog
          onOpenChange={(open) => {
            if (!isProcessing) {
              setIsApiKeyManagementModalOpen(open)
            }
          }}
          open={isApiKeyManagementModalOpen}
        >
          <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col">
            <DialogHeader>
              <DialogTitle>API 키 관리</DialogTitle>
              <DialogDescription>
                OpenAI API 키를 관리하여 처리 속도를 최적화하세요
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {/* Speed Boost Banner */}
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 shadow-lg"
                initial={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.3),transparent_50%)]" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-start gap-4">
                    <motion.div
                      animate={{
                        rotate: [0, 10, -10, 0],
                        scale: [1, 1.1, 1],
                      }}
                      className="flex-shrink-0"
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        repeatDelay: 3,
                        ease: "easeInOut",
                      }}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg">
                        <Zap className="h-8 w-8 text-white" fill="currentColor" />
                      </div>
                    </motion.div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-foreground text-lg">
                          API KEY 추가할수록{" "}
                          <motion.span
                            animate={{ scale: 1, rotate: 0 }}
                            className="inline-block text-primary"
                            initial={{ scale: 0, rotate: -180 }}
                            key={activeApiKeysCount}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 10,
                            }}
                          >
                            {activeApiKeysCount || 1}배
                          </motion.span>{" "}
                          빨라져요!
                        </h3>
                      </div>

                      <div className="space-y-2">
                        <p className="text-foreground/90 text-sm">
                          <span className="font-semibold text-primary">
                            계정별로 구분된 API KEY가 필요해요.
                          </span>{" "}
                          API KEY 1개당 <span className="font-semibold text-primary">20개씩</span>{" "}
                          동시 처리 가능해요. 추가할수록 처리 속도가{" "}
                          <span className="font-bold text-primary">배수로 증가</span>해요!
                        </p>

                        <div className="flex flex-wrap items-center gap-4 pt-2">
                          <motion.div
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2"
                            initial={{ opacity: 0, x: -20 }}
                            transition={{ delay: 0.2 }}
                          >
                            <Gauge className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-sm">
                              현재:{" "}
                              <span className="text-primary">{activeApiKeysCount * 20}개</span> 동시
                              처리
                            </span>
                          </motion.div>

                          {activeApiKeysCount > 0 && (
                            <motion.div
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2"
                              initial={{ opacity: 0, scale: 0.8 }}
                              transition={{ delay: 0.3, type: "spring" }}
                            >
                              <Sparkles className="h-4 w-4 text-green-600" />
                              <span className="font-semibold text-green-700 text-sm dark:text-green-400">
                                {activeApiKeysCount}배 속도 향상!
                              </span>
                            </motion.div>
                          )}
                        </div>

                        <motion.div
                          animate={{ opacity: 1 }}
                          className="mt-3 rounded-lg bg-muted/50 p-3"
                          initial={{ opacity: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <p className="mb-1 font-medium text-muted-foreground text-xs">💡 예시:</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded bg-background px-2 py-1">
                              1개 = 20개 동시 처리
                            </span>
                            <span className="rounded bg-background px-2 py-1">
                              2개 = 40개 (2배 빠름)
                            </span>
                            <span className="rounded bg-background px-2 py-1">
                              5개 = 100개 (5배 빠름)
                            </span>
                            <span className="rounded bg-background px-2 py-1">
                              10개 = 200개 (10배 빠름)
                            </span>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shine effect */}
                <motion.div
                  animate={{ x: "200%" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: "-100%" }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: 2,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">API 키 목록</CardTitle>
                      <CardDescription className="mt-1">
                        활성 키{" "}
                        <span className="font-semibold text-primary">{activeApiKeysCount}개</span> ·
                        동시 처리{" "}
                        <span className="font-semibold text-primary">
                          {activeApiKeysCount * 20}개
                        </span>{" "}
                        가능
                      </CardDescription>
                    </div>
                    <Button
                      disabled={isProcessing}
                      onClick={() => setIsApiKeyDialogOpen(true)}
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      추가
                    </Button>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  {apiKeys.length === 0 ? (
                    <div className="py-12 text-center">
                      <Key className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="mb-1 font-medium text-base">등록된 API 키가 없습니다</p>
                      <p className="mb-4 text-muted-foreground text-sm">
                        서버의 환경 변수에 설정된 기본 키가 사용됩니다
                      </p>
                      <Button
                        disabled={isProcessing}
                        onClick={() => setIsApiKeyDialogOpen(true)}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />첫 API 키 추가하기
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>이름</TableHead>
                            <TableHead>API 키</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead>사용 정보</TableHead>
                            <TableHead className="w-32 text-right">작업</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {apiKeys.map((key, index) => {
                            const isRevealed = revealedKeys.has(key.id)
                            return (
                              <TableRow className={key.isActive ? "" : "opacity-60"} key={key.id}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  <div className="font-medium">{key.name}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <code className="font-mono text-muted-foreground text-xs">
                                      {isRevealed ? key.apiKey : maskApiKey(key.apiKey)}
                                    </code>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          className="h-6 w-6"
                                          onClick={() => toggleRevealKey(key.id)}
                                          size="icon"
                                          variant="ghost"
                                        >
                                          {isRevealed ? (
                                            <EyeOff className="h-3.5 w-3.5" />
                                          ) : (
                                            <Eye className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {isRevealed ? "숨기기" : "보기"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={key.isActive}
                                      disabled={updateApiKeyMutation.isPending}
                                      onCheckedChange={() => handleToggleActive(key)}
                                    />
                                    <Badge
                                      className="text-xs"
                                      variant={key.isActive ? "default" : "secondary"}
                                    >
                                      {key.isActive ? "활성" : "비활성"}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-0.5 text-muted-foreground text-xs">
                                    <div>
                                      <span className="font-medium">마지막 사용:</span>{" "}
                                      {formatDate(key.lastUsedAt)}
                                    </div>
                                    <div>
                                      <span className="font-medium">사용 횟수:</span>{" "}
                                      {key.usageCount}회
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          className="h-8 w-8"
                                          disabled={deleteApiKeyMutation.isPending}
                                          onClick={() => handleDeleteApiKey(key.id)}
                                          size="icon"
                                          variant="ghost"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>삭제</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </TooltipProvider>

      {/* File Upload Modal */}
      <Dialog onOpenChange={setIsFileUploadModalOpen} open={isFileUploadModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>파일 업로드</DialogTitle>
            <DialogDescription>website_url이 포함된 엑셀 파일을 올려주세요</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag & Drop Zone */}
            <motion.div
              animate={{
                scale: isDragOver ? 1.02 : 1,
                borderColor: isDragOver
                  ? "hsl(var(--primary))"
                  : selectedFile
                    ? "hsl(var(--primary) / 0.5)"
                    : "hsl(var(--muted-foreground) / 0.25)",
                backgroundColor: isDragOver
                  ? "hsl(var(--primary) / 0.05)"
                  : selectedFile
                    ? "hsl(var(--primary) / 0.03)"
                    : "hsl(var(--background))",
              }}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center ${isProcessing ? "pointer-events-none opacity-50" : ""}
              `}
              onClick={() => fileInputRef.current?.click()}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              role="button"
              tabIndex={0}
              transition={{
                duration: 0.2,
                ease: "easeInOut",
              }}
              whileHover={
                isProcessing || selectedFile
                  ? {}
                  : {
                      borderColor: "hsl(var(--primary) / 0.5)",
                      backgroundColor: "hsl(var(--accent) / 0.5)",
                    }
              }
              whileTap={isProcessing ? {} : { scale: 0.98 }}
            >
              <input
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={isProcessing}
                onChange={handleFileChange}
                ref={fileInputRef}
                type="file"
              />

              <AnimatePresence mode="wait">
                {selectedFile ? (
                  <motion.div
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="space-y-2"
                    exit={{ opacity: 0, scale: 0.8 }}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    key="file-selected-modal"
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <motion.div
                      animate={{ scale: 1 }}
                      className="mb-2 flex justify-center"
                      initial={{ scale: 0 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                        <FileUp className="h-8 w-8 text-primary" />
                      </div>
                    </motion.div>
                    <motion.p
                      animate={{ opacity: 1 }}
                      className="font-semibold text-lg text-primary"
                      initial={{ opacity: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      {selectedFile.name}
                    </motion.p>
                    <motion.div
                      animate={{ opacity: 1 }}
                      className="space-y-1"
                      initial={{ opacity: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">{formatFileSize(selectedFile.size)}</span>
                      </p>
                      {isValidatingFile ? (
                        <motion.p
                          animate={{ opacity: 1 }}
                          className="text-muted-foreground text-sm"
                          initial={{ opacity: 0 }}
                        >
                          검증 중...
                        </motion.p>
                      ) : urlCount !== null ? (
                        <motion.p
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-muted-foreground text-sm"
                          initial={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: 0.4, type: "spring" }}
                        >
                          URL{" "}
                          <span className="font-medium text-primary">
                            {urlCount.toLocaleString()}개
                          </span>
                        </motion.p>
                      ) : null}
                    </motion.div>
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      initial={{ opacity: 0, y: 10 }}
                      transition={{ delay: 0.5 }}
                    >
                      <Button
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFile(null)
                          setUrlCount(null)
                          setError(null)
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="mr-2 h-4 w-4" />
                        제거
                      </Button>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="space-y-2"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    key="file-empty-modal"
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div
                      animate={{
                        y: [0, -8, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    >
                      <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    </motion.div>
                    <p className="font-semibold text-lg">
                      website_url이 포함된 엑셀 파일을 올려주세요
                    </p>
                    <p className="text-muted-foreground text-sm">드래그하거나 클릭하면 돼요</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Template Download Button - Outside upload area */}
            <div className="mt-4 flex justify-center">
              <Button
                className="text-xs"
                onClick={handleDownloadTemplate}
                size="sm"
                type="button"
                variant="outline"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                템플릿 다운로드
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                disabled={isProcessing}
                onClick={() => setIsFileUploadModalOpen(false)}
                variant="outline"
              >
                취소
              </Button>
              <Button
                disabled={
                  !selectedFile ||
                  isProcessing ||
                  isValidatingFile ||
                  urlCount === null ||
                  urlCount === 0
                }
                onClick={() => {
                  if (selectedFile) {
                    handleUpload()
                    setIsFileUploadModalOpen(false)
                  }
                }}
              >
                <Save className="mr-2 h-4 w-4" />
                업로드 시작
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* API Key Add Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!isProcessing) {
            setIsApiKeyDialogOpen(open)
          }
        }}
        open={isApiKeyDialogOpen}
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

          <form className="space-y-4" onSubmit={handleAddApiKey}>
            <div className="space-y-2">
              <Label htmlFor={keyNameId}>키 이름</Label>
              <Input
                id={keyNameId}
                onChange={(e) => setApiKeyFormData({ ...apiKeyFormData, name: e.target.value })}
                placeholder="예: Main Account, Backup Account 1"
                required
                value={apiKeyFormData.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={apiKeyId}>API 키</Label>
              <Input
                id={apiKeyId}
                onChange={(e) => setApiKeyFormData({ ...apiKeyFormData, apiKey: e.target.value })}
                placeholder="sk-..."
                required
                type="password"
                value={apiKeyFormData.apiKey}
              />
              <p className="text-muted-foreground text-xs">
                <a
                  className="underline"
                  href="https://platform.openai.com/api-keys"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  OpenAI 플랫폼
                </a>
                에서 API 키를 발급받을 수 있습니다
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => setIsApiKeyDialogOpen(false)} type="button" variant="outline">
                <X className="mr-2 h-4 w-4" />
                취소
              </Button>
              <Button disabled={createApiKeyMutation.isPending} type="submit">
                <Save className="mr-2 h-4 w-4" />
                추가
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clear Local Storage Confirmation Dialog */}
      <AlertDialog onOpenChange={setIsClearDataDialogOpen} open={isClearDataDialogOpen}>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClearLocalStorage}
            >
              초기화
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Panel Confirmation Dialog */}
      <AlertDialog onOpenChange={setIsClosePanelDialogOpen} open={isClosePanelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>추출이 끝났어요</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">결과 패널을 닫을까요?</span>
              <span className="block text-muted-foreground text-xs">
                닫아도 언제든지 다시 열 수 있어요
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsClosePanelDialogOpen(false)
                // 패널 닫기 모달이 취소되면 다운로드 모달 표시
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
                // 패널을 닫은 후 다운로드 모달 표시
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
      <AlertDialog onOpenChange={setIsDownloadConfirmDialogOpen} open={isDownloadConfirmDialogOpen}>
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
              className="h-auto w-full justify-start px-4 py-3"
              onClick={() => {
                handleDownload(false)
                setIsDownloadConfirmDialogOpen(false)
              }}
              variant="outline"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span className="font-semibold">기존 형태로 다운로드</span>
                </div>
                <span className="text-muted-foreground text-xs">
                  이메일이 여러 개 있어도 하나의 행으로 유지됩니다
                </span>
              </div>
            </Button>
            <Button
              className="h-auto w-full justify-start px-4 py-3"
              onClick={() => {
                handleDownload(true)
                setIsDownloadConfirmDialogOpen(false)
              }}
              variant="outline"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span className="font-semibold">이메일 분리하여 다운로드</span>
                </div>
                <span className="text-muted-foreground text-xs">
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
