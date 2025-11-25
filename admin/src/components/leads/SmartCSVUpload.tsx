/**
 * 스마트 CSV 업로드 컴포넌트
 *
 * 템플릿 없이도 CSV/XLSX 파일을 업로드하고,
 * 자동으로 컬럼을 매핑해주는 현대적인 업로드 UI
 */

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react"
import { useCallback, useId, useState } from "react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { LeadCSVData } from "@/lib/csv-utils"
import {
  parseCSVWithMappings,
  type SmartParseResult,
  smartAnalyzeCSV,
} from "@/lib/utils/smart-csv-parser"
import { ColumnMappingModal } from "./ColumnMappingModal"
import { TemplateDownloadButton } from "./TemplateDownloadCard"

interface SmartCSVUploadProps {
  onDataReady: (leads: LeadCSVData[]) => void
  onCancel?: () => void
  maxFileSize?: number // MB 단위
}

type UploadStep = "initial" | "analyzing" | "mapping" | "ready"

interface FileInfo {
  name: string
  size: number
  type: "csv" | "xlsx"
}

export function SmartCSVUpload({
  onDataReady,
  onCancel: _onCancel,
  maxFileSize = 10,
}: SmartCSVUploadProps) {
  const [currentStep, setCurrentStep] = useState<UploadStep>("initial")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [csvText, setCsvText] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<SmartParseResult | null>(null)
  const [parsedLeads, setParsedLeads] = useState<LeadCSVData[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const smartCsvUploadInputId = useId()

  // 파일 처리
  const processFile = useCallback(
    async (file: File) => {
      const fileName = file.name.toLowerCase()
      const isCSV = fileName.endsWith(".csv")
      const isXLSX = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

      if (!isCSV && !isXLSX) {
        toast.error("CSV 또는 XLSX 파일만 업로드 가능합니다.")
        return
      }

      if (file.size > maxFileSize * 1024 * 1024) {
        toast.error(`파일 크기는 ${maxFileSize}MB를 초과할 수 없습니다.`)
        return
      }

      setFileInfo({
        name: file.name,
        size: file.size,
        type: isCSV ? "csv" : "xlsx",
      })
      setCurrentStep("analyzing")

      try {
        let text: string

        if (isCSV) {
          text = await file.text()
        } else {
          // XLSX → CSV 변환
          const arrayBuffer = await file.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: "buffer" })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          text = XLSX.utils.sheet_to_csv(worksheet)
        }

        setCsvText(text)

        // 스마트 분석
        const result = smartAnalyzeCSV(text)
        setParseResult(result)

        if (result.errors.length > 0) {
          toast.error(result.errors[0])
          setCurrentStep("initial")
          return
        }

        setCurrentStep("mapping")
        toast.success(`${result.totalRows}개 행이 분석되었습니다.`)
      } catch (error) {
        console.error("파일 처리 오류:", error)
        toast.error(
          error instanceof Error ? error.message : "파일을 처리하는 중 오류가 발생했습니다.",
        )
        setCurrentStep("initial")
      }
    },
    [maxFileSize],
  )

  // 파일 입력 핸들러
  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        processFile(file)
      }
    },
    [processFile],
  )

  // 드래그 앤 드롭 핸들러
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault()
      setIsDragOver(false)

      const file = event.dataTransfer.files[0]
      if (file) {
        processFile(file)
      }
    },
    [processFile],
  )

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  // 매핑 확인 핸들러
  const handleMappingConfirm = useCallback(
    (mappings: Record<string, keyof LeadCSVData | null>) => {
      if (!csvText) return

      const { leads, errors } = parseCSVWithMappings(csvText, mappings)

      if (leads.length === 0) {
        toast.error("유효한 리드 데이터가 없습니다.")
        return
      }

      setParsedLeads(leads)
      setParseErrors(errors)
      setCurrentStep("ready")
      toast.success(`${leads.length}개의 리드가 준비되었습니다.`)
    },
    [csvText],
  )

  // 업로드 완료
  const handleComplete = useCallback(() => {
    onDataReady(parsedLeads)
  }, [parsedLeads, onDataReady])

  // 초기화
  const handleReset = useCallback(() => {
    setCurrentStep("initial")
    setFileInfo(null)
    setCsvText(null)
    setParseResult(null)
    setParsedLeads([])
    setParseErrors([])
  }, [])

  // 단계 표시
  const steps = [
    { id: "initial", label: "파일 선택", icon: Upload },
    { id: "analyzing", label: "분석 중", icon: Sparkles },
    { id: "mapping", label: "컬럼 매핑", icon: FileSpreadsheet },
    { id: "ready", label: "완료", icon: CheckCircle2 },
  ]

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              스마트 CSV 업로드
            </CardTitle>
            <CardDescription>
              템플릿 없이도 파일을 업로드하면 자동으로 컬럼을 매핑합니다.
            </CardDescription>
          </div>
          <TemplateDownloadButton />
        </div>

        {/* 진행 상태 표시 */}
        <div className="flex items-center justify-between pt-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            const isActive = index === currentStepIndex
            const isCompleted = index < currentStepIndex

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <StepIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            )
          })}
        </div>
      </CardHeader>

      <CardContent>
        {/* 초기 상태: 파일 업로드 영역 */}
        {currentStep === "initial" && (
          <label
            htmlFor={smartCsvUploadInputId}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative block border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
          >
            <input
              id={smartCsvUploadInputId}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInput}
              className="sr-only"
            />

            <div className="flex flex-col items-center gap-4">
              <div
                className={`p-4 rounded-full ${
                  isDragOver ? "bg-primary/10" : "bg-muted"
                } transition-colors`}
              >
                <Upload
                  className={`h-8 w-8 ${isDragOver ? "text-primary" : "text-muted-foreground"}`}
                />
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-lg">
                  {isDragOver ? "파일을 여기에 놓으세요" : "CSV 또는 Excel 파일을 업로드하세요"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  파일을 드래그하거나 클릭하여 선택하세요.
                  <br />
                  최대 {maxFileSize}MB까지 업로드 가능합니다.
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">
                  <FileSpreadsheet className="mr-1 h-3 w-3" />
                  .xlsx
                </Badge>
                <Badge variant="outline">
                  <FileText className="mr-1 h-3 w-3" />
                  .csv
                </Badge>
              </div>
            </div>
          </label>
        )}

        {/* 분석 중 */}
        {currentStep === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="font-medium text-lg">파일 분석 중...</h3>
              <p className="text-sm text-muted-foreground">{fileInfo?.name}</p>
            </div>
            <Progress value={60} className="w-full max-w-xs" />
          </div>
        )}

        {/* 준비 완료 */}
        {currentStep === "ready" && (
          <div className="space-y-4">
            <Alert className="bg-emerald-500/10 border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-700 dark:text-emerald-400">준비 완료</AlertTitle>
              <AlertDescription>
                <strong>{parsedLeads.length}</strong>개의 리드가 업로드 준비되었습니다.
              </AlertDescription>
            </Alert>

            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>일부 행 스킵됨</AlertTitle>
                <AlertDescription>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm">
                      {parseErrors.length}개 행이 스킵되었습니다. (클릭하여 상세 보기)
                    </summary>
                    <ul className="mt-2 text-sm max-h-32 overflow-y-auto">
                      {parseErrors.slice(0, 10).map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {parseErrors.length > 10 && (
                        <li className="text-muted-foreground">
                          ... 외 {parseErrors.length - 10}개
                        </li>
                      )}
                    </ul>
                  </details>
                </AlertDescription>
              </Alert>
            )}

            {/* 리드 미리보기 */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 border-b">
                <h4 className="text-sm font-medium">리드 미리보기 (최대 5개)</h4>
              </div>
              <div className="divide-y">
                {parsedLeads.slice(0, 5).map((lead, idx) => (
                  <div key={idx} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{lead.companyName}</p>
                        <p className="text-sm text-muted-foreground">
                          {lead.contactName && <span>{lead.contactName} • </span>}
                          {lead.primaryEmail}
                        </p>
                      </div>
                      {lead.websiteUrl && (
                        <Badge variant="outline" className="text-xs">
                          {
                            new URL(
                              lead.websiteUrl.startsWith("http")
                                ? lead.websiteUrl
                                : `https://${lead.websiteUrl}`,
                            ).hostname
                          }
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleReset}>
                <X className="mr-2 h-4 w-4" />
                다시 선택
              </Button>
              <Button onClick={handleComplete}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {parsedLeads.length}개 리드 업로드
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* 컬럼 매핑 모달 */}
      <ColumnMappingModal
        isOpen={currentStep === "mapping"}
        onClose={handleReset}
        onConfirm={handleMappingConfirm}
        parseResult={parseResult}
      />
    </Card>
  )
}
