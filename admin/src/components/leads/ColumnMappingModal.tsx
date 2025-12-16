/**
 * CSV 컬럼 매핑 모달
 *
 * 업로드된 CSV 파일의 컬럼을 리드 필드에 자동으로 매핑하고
 * 사용자가 수동으로 조정할 수 있게 해주는 모달
 */

import { AlertCircle, ArrowRight, Check, ChevronDown, Info, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { LeadCSVData } from "@/lib/csv-utils"
import {
  type ColumnAnalysis,
  LEAD_FIELD_DEFINITIONS,
  type SmartParseResult,
  validateMappings,
} from "@/lib/utils/smart-csv-parser"

type ColumnMappingModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (mappings: Record<string, keyof LeadCSVData | null>, hasHeaders: boolean) => void
  parseResult: SmartParseResult | null
  onToggleHeaders?: (hasHeaders: boolean) => void // 헤더 토글 시 재분석 요청
}

function ConfidenceBadge({ confidence }: { confidence: ColumnAnalysis["confidence"] }) {
  const config = {
    high: {
      variant: "default" as const,
      label: "정확",
      className: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    },
    medium: {
      variant: "secondary" as const,
      label: "추천",
      className: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
    },
    low: {
      variant: "outline" as const,
      label: "추측",
      className: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30",
    },
    none: {
      variant: "outline" as const,
      label: "미매핑",
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    },
  }

  const { label, className } = config[confidence]

  return (
    <Badge className={`text-xs ${className}`} variant="outline">
      {confidence === "high" && <Sparkles className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  )
}

function DataTypeBadge({ dataType }: { dataType: ColumnAnalysis["dataType"] }) {
  const config = {
    email: { label: "이메일", className: "text-blue-600 dark:text-blue-400" },
    phone: { label: "전화번호", className: "text-purple-600 dark:text-purple-400" },
    url: { label: "URL", className: "text-cyan-600 dark:text-cyan-400" },
    number: { label: "숫자", className: "text-orange-600 dark:text-orange-400" },
    date: { label: "날짜", className: "text-pink-600 dark:text-pink-400" },
    text: { label: "텍스트", className: "text-gray-600 dark:text-gray-400" },
  }

  const { label, className } = config[dataType]

  return <span className={`font-medium text-xs ${className}`}>{label}</span>
}

function FieldSelector({
  currentField,
  usedFields,
  onSelect,
}: {
  currentField: keyof LeadCSVData | null
  usedFields: Set<keyof LeadCSVData>
  onSelect: (field: keyof LeadCSVData | null) => void
}) {
  const requiredFields = LEAD_FIELD_DEFINITIONS.filter((f) => f.required)
  const optionalFields = LEAD_FIELD_DEFINITIONS.filter((f) => !f.required)

  const currentFieldDef = currentField
    ? LEAD_FIELD_DEFINITIONS.find((f) => f.key === currentField)
    : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={`w-full justify-between ${
            currentField
              ? currentFieldDef?.required
                ? "border-emerald-500/50"
                : ""
              : "border-dashed text-muted-foreground"
          }`}
          variant="outline"
        >
          <span className="flex items-center gap-2">
            {currentField ? (
              <>
                {currentFieldDef?.required && (
                  <span className="text-emerald-600 dark:text-emerald-400">●</span>
                )}
                {currentFieldDef?.labelKo || currentField}
              </>
            ) : (
              "매핑 안함"
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuItem className="text-muted-foreground" onClick={() => onSelect(null)}>
          <X className="mr-2 h-4 w-4" />
          매핑 안함
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex items-center gap-2">
          <span className="text-emerald-600 dark:text-emerald-400">●</span>
          필수 필드
        </DropdownMenuLabel>
        {requiredFields.map((field) => {
          const isUsed = usedFields.has(field.key) && field.key !== currentField
          return (
            <DropdownMenuItem
              className={isUsed ? "opacity-50" : ""}
              disabled={isUsed}
              key={field.key}
              onClick={() => onSelect(field.key)}
            >
              <div className="flex w-full items-center justify-between">
                <span>{field.labelKo}</span>
                {field.key === currentField && <Check className="h-4 w-4 text-emerald-600" />}
                {isUsed && field.key !== currentField && (
                  <span className="text-muted-foreground text-xs">사용 중</span>
                )}
              </div>
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>선택 필드</DropdownMenuLabel>
        {optionalFields.map((field) => {
          const isUsed = usedFields.has(field.key) && field.key !== currentField
          return (
            <DropdownMenuItem
              className={isUsed ? "opacity-50" : ""}
              disabled={isUsed}
              key={field.key}
              onClick={() => onSelect(field.key)}
            >
              <div className="flex w-full items-center justify-between">
                <span>{field.labelKo}</span>
                {field.key === currentField && <Check className="h-4 w-4 text-emerald-600" />}
                {isUsed && field.key !== currentField && (
                  <span className="text-muted-foreground text-xs">사용 중</span>
                )}
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ColumnMappingModal({
  isOpen,
  onClose,
  onConfirm,
  parseResult,
  onToggleHeaders,
}: ColumnMappingModalProps) {
  const [mappings, setMappings] = useState<Record<string, keyof LeadCSVData | null>>({})
  const [hasHeaders, setHasHeaders] = useState(true)

  // parseResult가 변경되면 매핑 초기화
  useEffect(() => {
    if (parseResult) {
      setMappings(parseResult.mappings)
      setHasHeaders(parseResult.hasHeaders)
    }
  }, [parseResult])

  // 현재 사용 중인 필드 목록
  const usedFields = useMemo(() => {
    const fields = new Set<keyof LeadCSVData>()
    Object.values(mappings).forEach((field) => {
      if (field) {
        fields.add(field)
      }
    })
    return fields
  }, [mappings])

  // 매핑 유효성 검사
  const validation = useMemo(() => validateMappings(mappings), [mappings])

  // 매핑 변경 핸들러
  const handleMappingChange = useCallback(
    (originalHeader: string, newField: keyof LeadCSVData | null) => {
      setMappings((prev) => ({
        ...prev,
        [originalHeader]: newField,
      }))
    },
    [],
  )

  // 헤더 토글 핸들러
  const handleToggleHeaders = useCallback(
    (newHasHeaders: boolean) => {
      setHasHeaders(newHasHeaders)
      if (onToggleHeaders) {
        onToggleHeaders(newHasHeaders)
      }
    },
    [onToggleHeaders],
  )

  // 확인 버튼 핸들러
  const handleConfirm = useCallback(() => {
    onConfirm(mappings, hasHeaders)
    onClose()
  }, [mappings, hasHeaders, onConfirm, onClose])

  if (!parseResult) {
    return null
  }

  const mappedCount = Object.values(mappings).filter(Boolean).length
  const totalColumns = parseResult.columns.length

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            스마트 컬럼 매핑
          </DialogTitle>
          <DialogDescription>
            업로드된 파일의 컬럼을 리드 필드에 자동으로 매핑했습니다. 필요한 경우 수동으로
            조정하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          {/* 요약 정보 및 헤더 토글 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-4 text-sm">
              <span>
                총 <strong>{parseResult.totalRows}</strong>개 행
              </span>
              <span>
                매핑됨:{" "}
                <strong>
                  {mappedCount}/{totalColumns}
                </strong>{" "}
                컬럼
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 text-sm dark:text-emerald-400">●</span>
                <span className="text-muted-foreground text-sm">= 필수 필드</span>
              </div>
            </div>
          </div>

          {/* 헤더 행 토글 */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">첫 번째 행이 헤더입니까?</span>
              {parseResult.detectedHasHeaders !== hasHeaders && (
                <Badge className="text-xs" variant="outline">
                  변경됨
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs">
                {parseResult.detectedHasHeaders ? "자동 감지: 헤더 있음" : "자동 감지: 헤더 없음"}
              </span>
              <button
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  hasHeaders ? "bg-emerald-500" : "bg-gray-300"
                }`}
                onClick={() => handleToggleHeaders(!hasHeaders)}
                type="button"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    hasHeaders ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm">{hasHeaders ? "예" : "아니오"}</span>
            </div>
          </div>

          {/* 경고/에러 알림 */}
          {!validation.valid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>필수 필드 누락</AlertTitle>
              <AlertDescription>
                다음 필수 필드를 매핑해주세요: {validation.missingRequired.join(", ")}
              </AlertDescription>
            </Alert>
          )}

          {parseResult.warnings.length > 0 && validation.valid && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>참고 사항</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc pl-4 text-sm">
                  {parseResult.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* 매핑 테이블 */}
          <div className="flex-1 overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[200px]">원본 컬럼</TableHead>
                  <TableHead className="w-[100px]">데이터 타입</TableHead>
                  <TableHead className="w-[100px]">신뢰도</TableHead>
                  <TableHead className="w-[60px] text-center">
                    <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
                  </TableHead>
                  <TableHead className="w-[200px]">리드 필드</TableHead>
                  <TableHead>샘플 데이터</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parseResult.columns.map((column) => {
                  const currentField = mappings[column.originalHeader]

                  return (
                    <TableRow key={column.originalHeader}>
                      <TableCell className="font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="text-left">
                              <span className="inline-block max-w-[180px] truncate">
                                {column.originalHeader}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{column.originalHeader}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <DataTypeBadge dataType={column.dataType} />
                      </TableCell>
                      <TableCell>
                        <ConfidenceBadge confidence={column.confidence} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <FieldSelector
                          currentField={currentField}
                          onSelect={(field) => handleMappingChange(column.originalHeader, field)}
                          usedFields={usedFields}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {column.sampleValues.slice(0, 2).map((value, idx) => (
                            <span
                              className="max-w-[200px] truncate text-muted-foreground text-xs"
                              key={idx}
                              title={value}
                            >
                              {value || <span className="italic">빈 값</span>}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* 데이터 미리보기 */}
          {parseResult.previewData.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-muted-foreground text-sm">데이터 미리보기</h4>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      {Object.entries(mappings)
                        .filter(([, field]) => field)
                        .slice(0, 5)
                        .map(([header, field]) => (
                          <TableHead className="min-w-[150px]" key={header}>
                            {LEAD_FIELD_DEFINITIONS.find((f) => f.key === field)?.labelKo || field}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.previewData.slice(0, 3).map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        <TableCell className="text-center text-muted-foreground">
                          {rowIdx + 1}
                        </TableCell>
                        {Object.entries(mappings)
                          .filter(([, field]) => field)
                          .slice(0, 5)
                          .map(([header]) => (
                            <TableCell className="max-w-[200px] truncate" key={header}>
                              {row[header] || "-"}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline">
            취소
          </Button>
          <Button disabled={!validation.valid} onClick={handleConfirm}>
            <Check className="mr-2 h-4 w-4" />
            매핑 확인 ({mappedCount}개 필드)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
