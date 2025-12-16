/**
 * 템플릿 다운로드 카드
 *
 * 사용자에게 심플 템플릿과 상세 템플릿 중 선택할 수 있게 해주는 UI
 * 각 템플릿의 특징과 포함된 필드를 보여줍니다.
 */

import { Check, Download, FileSpreadsheet, FileText, Sparkles } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  generateDetailedCSVTemplate,
  generateDetailedXLSXTemplate,
  generateSimpleCSVTemplate,
  generateSimpleXLSXTemplate,
} from "@/lib/csv-utils"

type TemplateOption = {
  id: "simple" | "detailed"
  name: string
  description: string
  fields: string[]
  recommended?: boolean
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: "simple",
    name: "심플 템플릿",
    description: "필수 정보만 포함된 간단한 템플릿",
    fields: ["회사명", "담당자명", "이메일", "전화번호", "웹사이트"],
    recommended: true,
  },
  {
    id: "detailed",
    name: "상세 템플릿",
    description: "모든 리드 정보를 포함한 상세 템플릿",
    fields: [
      "회사명",
      "담당자명",
      "이메일",
      "전화번호",
      "웹사이트",
      "업종",
      "국가",
      "도시",
      "주소",
      "직원수",
      "설립년도",
      "메모",
    ],
  },
]

function downloadFile(blob: Blob, filename: string) {
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

type TemplateCardProps = {
  template: TemplateOption
  onDownload: (templateId: "simple" | "detailed", format: "csv" | "xlsx") => void
}

function TemplateCard({ template, onDownload }: TemplateCardProps) {
  return (
    <Card
      className={`relative ${template.recommended ? "border-primary ring-1 ring-primary/20" : ""}`}
    >
      {template.recommended && (
        <Badge className="-top-2 absolute left-4 bg-primary">
          <Sparkles className="mr-1 h-3 w-3" />
          추천
        </Badge>
      )}
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          {template.name}
        </CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 포함된 필드 목록 */}
        <div>
          <h4 className="mb-2 font-medium text-sm">포함된 필드:</h4>
          <div className="flex flex-wrap gap-1.5">
            {template.fields.map((field, idx) => (
              <Badge
                className={
                  idx < 5 ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : ""
                }
                key={field}
                variant={idx < 5 ? "default" : "secondary"}
              >
                {idx < 3 && <Check className="mr-1 h-3 w-3" />}
                {field}
              </Badge>
            ))}
          </div>
        </div>

        {/* 다운로드 버튼 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full">
              <Download className="mr-2 h-4 w-4" />
              템플릿 다운로드
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <DropdownMenuItem onClick={() => onDownload(template.id, "xlsx")}>
              <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
              Excel 파일 (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(template.id, "csv")}>
              <FileText className="mr-2 h-4 w-4 text-blue-600" />
              CSV 파일 (.csv)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  )
}

export function TemplateDownloadCard() {
  const handleDownload = (templateId: "simple" | "detailed", format: "csv" | "xlsx") => {
    if (format === "csv") {
      const content =
        templateId === "simple" ? generateSimpleCSVTemplate() : generateDetailedCSVTemplate()
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
      downloadFile(blob, `leads_template_${templateId}.csv`)
    } else {
      const blob =
        templateId === "simple" ? generateSimpleXLSXTemplate() : generateDetailedXLSXTemplate()
      downloadFile(blob, `leads_template_${templateId}.xlsx`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">템플릿 다운로드</CardTitle>
        <CardDescription>
          리드 데이터를 업로드하기 위한 템플릿을 다운로드하세요. 템플릿 없이도 업로드가 가능하며,
          시스템이 자동으로 컬럼을 매핑합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {TEMPLATE_OPTIONS.map((template) => (
            <TemplateCard key={template.id} onDownload={handleDownload} template={template} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 컴팩트 버전의 템플릿 다운로드 버튼
 * 공간이 제한된 경우 사용
 */
export function TemplateDownloadButton() {
  const [selectedTemplate, setSelectedTemplate] = useState<"simple" | "detailed">("simple")

  const handleDownload = (format: "csv" | "xlsx") => {
    if (format === "csv") {
      const content =
        selectedTemplate === "simple" ? generateSimpleCSVTemplate() : generateDetailedCSVTemplate()
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
      downloadFile(blob, `leads_template_${selectedTemplate}.csv`)
    } else {
      const blob =
        selectedTemplate === "simple"
          ? generateSimpleXLSXTemplate()
          : generateDetailedXLSXTemplate()
      downloadFile(blob, `leads_template_${selectedTemplate}.xlsx`)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          템플릿 다운로드
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <div className="px-2 py-1.5">
          <p className="mb-2 text-muted-foreground text-xs">템플릿 선택</p>
          <div className="space-y-1">
            {TEMPLATE_OPTIONS.map((template) => (
              <button
                className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
                  selectedTemplate === template.id ? "bg-muted" : ""
                }`}
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <span>{template.name}</span>
                  {selectedTemplate === template.id && <Check className="h-4 w-4 text-primary" />}
                </div>
                <span className="text-muted-foreground text-xs">
                  {template.fields.length}개 필드
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="border-t px-2 py-1.5">
          <p className="mb-2 text-muted-foreground text-xs">다운로드 형식</p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => handleDownload("xlsx")}
              size="sm"
              variant="outline"
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleDownload("csv")}
              size="sm"
              variant="outline"
            >
              <FileText className="mr-1 h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
