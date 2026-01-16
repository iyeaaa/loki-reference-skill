import { FileText, Loader2, Rocket, Sparkles, Upload, X } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  useAnalyzeCompanyFile,
  useCompanyDescriptionAIEnhance,
  useTestOnboarding,
} from "@/lib/api/hooks/onboarding"
import { useTranslateCompanyName } from "@/lib/api/hooks/workspaces"

const INDUSTRY_OPTIONS = {
  beauty: "뷰티/화장품",
  fashion: "패션/의류",
  food: "식품/음료",
  it_saas: "IT/SaaS",
  manufacturing: "제조업",
  retail: "소매업",
  healthcare: "헬스케어",
  education: "교육",
  other: "기타",
}

const TARGET_OPTIONS = {
  b2b: "기업 대상 (B2B)",
  b2c: "소비자 대상 (B2C)",
  both: "둘 다 (B2B + B2C)",
}

const COUNTRY_OPTIONS = {
  jp: "일본 (Japan)",
  us: "미국 (United States)",
  sea: "동남아시아 (Southeast Asia)",
  eu: "유럽 (Europe)",
  cn: "중국 (China)",
  ae: "UAE (United Arab Emirates)",
  kr: "한국 (South Korea)",
  other: "기타 (Other)",
}

export function OnboardingTest() {
  const companyNameId = useId()
  const companyDescId = useId()
  const industryId = useId()
  const targetId = useId()
  const countryId = useId()

  const testOnboarding = useTestOnboarding()
  const translateMutation = useTranslateCompanyName()
  const analyzeFileMutation = useAnalyzeCompanyFile()

  const [companyName, setCompanyName] = useState("주식회사 거목")
  const [companyNameEn, setCompanyNameEn] = useState("")
  const [companyDescription, setCompanyDescription] = useState(
    "가공 기계 및 관련 공장 기계 해외 수출",
  )
  const [industry, setIndustry] = useState("beauty")
  const [target, setTarget] = useState("b2b")
  const [country, setCountry] = useState("jp")

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isFilledByAI, setIsFilledByAI] = useState(false)

  // File upload handlers
  const handleFileSelect = useCallback(
    (file: File) => {
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
      ]
      const allowedExtensions = [".pdf", ".docx", ".pptx", ".txt"]
      const fileName = file.name.toLowerCase()

      const hasValidExtension = allowedExtensions.some((ext) => fileName.endsWith(ext))
      const hasValidMimeType = allowedTypes.includes(file.type)

      if (!(hasValidExtension || hasValidMimeType)) {
        toast.error("지원하지 않는 파일 형식입니다. PDF, DOCX, PPTX, TXT 파일만 가능합니다.")
        return
      }

      if (file.size > 20 * 1024 * 1024) {
        toast.error("파일 크기는 20MB를 초과할 수 없습니다.")
        return
      }

      setUploadedFileName(file.name)

      analyzeFileMutation.mutate(
        { file, lang: "ko" },
        {
          onSuccess: (result) => {
            setIsFilledByAI(true)
            if (result.companyName) {
              setCompanyName(result.companyName)
            }
            if (result.companyNameEn) {
              setCompanyNameEn(result.companyNameEn)
            }
            if (result.companyDescription) {
              setCompanyDescription(result.companyDescription)
            }
            if (result.industry) {
              setIndustry(result.industry)
            }
            toast.success("회사 소개서 분석이 완료되었습니다!")
          },
          onError: () => {
            setUploadedFileName(null)
          },
        },
      )
    },
    [analyzeFileMutation],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect],
  )

  const clearUploadedFile = useCallback(() => {
    setUploadedFileName(null)
    setIsFilledByAI(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // AI description enhancement hook
  const {
    suggestions,
    isLoading: isAnalyzing,
    isRateLimited,
    hasAnalyzed,
  } = useCompanyDescriptionAIEnhance({
    description: companyDescription,
    industry,
    target,
    enabled: true,
  })

  // Auto-translate company name with debounce
  useEffect(() => {
    if (!companyName || companyName.trim() === "") {
      return
    }

    const timer = setTimeout(() => {
      translateMutation.mutate(
        {
          companyName,
          targetLanguage: "English",
        },
        {
          onSuccess: (translatedName) => {
            console.log("[Translation] Success:", translatedName)
            setCompanyNameEn(translatedName)
          },
          onError: (error) => {
            console.error("[Translation] Failed:", error)
          },
        },
      )
    }, 2000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, translateMutation.mutate])

  const canSubmit = companyName.trim().length > 0 && !testOnboarding.isPending

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    await testOnboarding.mutateAsync({
      workspaceName: companyName.trim(),
      workspaceNameEn: companyNameEn.trim() || undefined,
      workspaceDescription: companyDescription.trim() || undefined,
      industry,
      target,
      country,
    })
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadJSON = () => {
    if (!(testOnboarding.data?.leadDiscovery && testOnboarding.data?.emailGeneration)) {
      return
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
    downloadFile(
      JSON.stringify(testOnboarding.data, null, 2),
      `onboarding-test-${timestamp}.json`,
      "application/json",
    )
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) {
      return `${minutes}분 ${remainingSeconds}초`
    }
    return `${seconds}초`
  }

  const handleDownloadMarkdown = () => {
    if (!(testOnboarding.data?.leadDiscovery && testOnboarding.data?.emailGeneration)) {
      return
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)

    let mdContent = "# 온보딩 전체 테스트 결과\n\n"
    mdContent += `**생성 시간**: ${new Date().toLocaleString("ko-KR")}\n\n`

    mdContent += "## 입력 정보\n\n"
    mdContent += `- **회사명**: ${companyName}\n`
    if (companyDescription) {
      mdContent += `- **회사 설명**: ${companyDescription}\n`
    }
    mdContent += `- **산업**: ${INDUSTRY_OPTIONS[industry as keyof typeof INDUSTRY_OPTIONS]}\n`
    mdContent += `- **타겟**: ${TARGET_OPTIONS[target as keyof typeof TARGET_OPTIONS]}\n`
    mdContent += `- **국가**: ${COUNTRY_OPTIONS[country as keyof typeof COUNTRY_OPTIONS]}\n\n`

    // 성능 정보
    if (testOnboarding.data.totalDuration) {
      mdContent += "## ⏱️ 성능 정보\n\n"
      mdContent += `- **전체 소요 시간**: ${formatDuration(testOnboarding.data.totalDuration)}\n`
      if (
        testOnboarding.data.leadDiscovery.duration &&
        testOnboarding.data.emailGeneration.duration
      ) {
        mdContent += "- **🚀 병렬 실행**: 바이어 검색 + 이메일 생성\n"
        mdContent += `  - 바이어 검색: ${formatDuration(testOnboarding.data.leadDiscovery.duration)}\n`
        mdContent += `  - 이메일 생성: ${formatDuration(testOnboarding.data.emailGeneration.duration)}\n`
        if (
          testOnboarding.data.leadDiscovery.duration > testOnboarding.data.emailGeneration.duration
        ) {
          const savedTime = testOnboarding.data.emailGeneration.duration
          mdContent += `  - 💡 절약된 시간: ${formatDuration(savedTime)} (동시 실행)\n`
        }
      }
      mdContent += "\n"
    }

    mdContent += "## 1. 바이어 검색 결과\n\n"
    mdContent += "### 통계\n\n"
    mdContent += `- 총 발견: ${testOnboarding.data.leadDiscovery.stats.totalFound}개\n`
    mdContent += `- 정보 보강: ${testOnboarding.data.leadDiscovery.stats.totalEnriched}개\n`
    mdContent += `- 이메일 확보: ${testOnboarding.data.leadDiscovery.stats.totalWithEmail}개\n`
    mdContent += `- 최종 선정: ${testOnboarding.data.leadDiscovery.leads.length}개\n\n`

    mdContent += "### 발견된 바이어\n\n"
    for (let i = 0; i < testOnboarding.data.leadDiscovery.leads.length; i++) {
      const lead = testOnboarding.data.leadDiscovery.leads[i]
      mdContent += `#### ${i + 1}. ${lead.company}\n\n`
      mdContent += `- **Website**: ${lead.website}\n`
      mdContent += `- **Email**: ${lead.email || "N/A"}\n`
      mdContent += `- **Industry**: ${lead.industry}\n`
      mdContent += `- **Country**: ${lead.country}\n`
      if (lead.description) {
        mdContent += `- **Description**: ${lead.description}\n`
      }
      mdContent += "\n"
    }

    mdContent += "## 2. 이메일 생성 결과\n\n"
    for (const template of testOnboarding.data.emailGeneration.templates) {
      mdContent += `### Step ${template.step}: ${template.type} (+${template.delayDays}일)\n\n`
      mdContent += `**제목**: ${template.subject}\n\n`
      mdContent += `**본문**:\n\`\`\`\n${template.bodyText}\n\`\`\`\n\n`
    }

    downloadFile(mdContent, `onboarding-test-${timestamp}.md`, "text/markdown")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          <CardTitle>온보딩 전체 테스트</CardTitle>
        </div>
        <CardDescription>
          바이어 검색 + AI 이메일 생성을 한번에 테스트합니다. 실제 온보딩 프로세스와 동일하게
          동작합니다. (🚀 병렬 처리로 소요 시간: 약 2~3분)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="max-w-2xl space-y-4" onSubmit={handleTest}>
          {/* 회사 소개서 파일 업로드 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <Label className="font-semibold text-gray-900">회사 소개서로 자동 입력</Label>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700 text-xs">
                AI
              </span>
            </div>

            <input
              accept=".pdf,.docx,.pptx,.txt"
              className="hidden"
              onChange={handleFileInputChange}
              ref={fileInputRef}
              type="file"
            />

            {uploadedFileName ? (
              <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-3">
                <div className="flex items-center gap-2">
                  {analyzeFileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-purple-600" />
                  )}
                  <span className="text-purple-800 text-sm">{uploadedFileName}</span>
                  {analyzeFileMutation.isPending && (
                    <span className="text-purple-600 text-xs">AI가 분석 중...</span>
                  )}
                  {isFilledByAI && !analyzeFileMutation.isPending && (
                    <span className="text-green-600 text-xs">✓ 분석 완료</span>
                  )}
                </div>
                <button
                  className="rounded p-1 text-gray-400 hover:bg-purple-100 hover:text-gray-600"
                  onClick={clearUploadedFile}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              // biome-ignore lint/a11y/useSemanticElements: Drag and drop zone requires div element
              <div
                className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  isDragging
                    ? "border-purple-400 bg-purple-50"
                    : "border-gray-300 hover:border-purple-300 hover:bg-purple-50/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    fileInputRef.current?.click()
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Upload className="mx-auto h-6 w-6 text-gray-400" />
                <p className="mt-2 text-gray-600 text-sm">
                  회사 소개서를 드래그하거나 클릭하여 업로드
                </p>
                <p className="mt-1 text-gray-400 text-xs">PDF, DOCX, PPTX, TXT (최대 20MB)</p>
              </div>
            )}

            {isFilledByAI && (
              <p className="flex items-center gap-1.5 text-purple-600 text-xs">
                <Sparkles className="h-3 w-3" />
                AI가 소개서에서 정보를 추출했어요. 내용을 확인하고 수정해주세요.
              </p>
            )}
          </div>

          {/* 또는 구분선 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-gray-300 border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">또는 직접 입력</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={companyNameId}>회사명 (companyName) *</Label>
              <Input
                id={companyNameId}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="주식회사 거목"
                required
                value={companyName}
              />
            </div>

            <div className="space-y-2">
              <Label>회사명 영문 (companyNameEn, optional)</Label>
              <div className="relative">
                <Input
                  onChange={(e) => setCompanyNameEn(e.target.value)}
                  placeholder="예: Geomok Inc."
                  value={companyNameEn}
                />
                {translateMutation.isPending && (
                  <Loader2 className="absolute top-3 right-3 h-4 w-4 animate-spin text-blue-500" />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={companyDescId}>회사 설명 (companyDescription, optional)</Label>
            <Textarea
              id={companyDescId}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="가공 기계 및 관련 공장 기계 해외 수출"
              rows={3}
              value={companyDescription}
            />

            {/* AI Suggestions */}
            {isAnalyzing && companyDescription.trim().length >= 10 ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="h-3 w-3 animate-spin rounded-full border-gray-400 border-b-2" />
                <span>AI가 분석 중...</span>
              </div>
            ) : null}

            {isRateLimited ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-orange-700 text-sm">
                  ⏱️ 잠시 후 다시 시도해주세요 (분당 10회 제한)
                </p>
              </div>
            ) : null}

            {!(isAnalyzing || isRateLimited) && suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <div
                    className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"
                    key={`${suggestion.type}-${index}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-amber-600">💡</span>
                      <p className="text-amber-800 text-sm">{suggestion.messageKo}</p>
                    </div>
                    <button
                      className="shrink-0 rounded bg-amber-600 px-2 py-1 text-white text-xs hover:bg-amber-700"
                      onClick={() => {
                        const currentDescription = companyDescription.trim()
                        const newDescription = currentDescription
                          ? `${currentDescription}\n${suggestion.suggestionKo}`
                          : suggestion.suggestionKo
                        setCompanyDescription(newDescription)
                      }}
                      type="button"
                    >
                      추가
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {hasAnalyzed &&
            !isAnalyzing &&
            !isRateLimited &&
            suggestions.length === 0 &&
            companyDescription.trim().length >= 10 ? (
              <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                <span className="text-green-600">✨</span>
                <p className="text-green-800 text-sm">
                  충분한 정보가 담겨있어요! 반드시 실제 정보로 수정해주세요 ✏️
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={industryId}>산업군 (industry) *</Label>
            <Select onValueChange={setIndustry} value={industry}>
              <SelectTrigger id={industryId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INDUSTRY_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={targetId}>타겟 고객 (target) *</Label>
            <Select onValueChange={setTarget} value={target}>
              <SelectTrigger id={targetId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TARGET_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={countryId}>희망 진출 국가 (country) *</Label>
            <Select onValueChange={setCountry} value={country}>
              <SelectTrigger id={countryId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COUNTRY_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {testOnboarding.isPending
              ? "🚀 테스트 실행 중... (2~3분 소요)"
              : "🚀 테스트 실행 (약 2~3분)"}
          </Button>

          {testOnboarding.isPending && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">전체 진행률</span>
                  <span className="font-semibold text-blue-600">{testOnboarding.progress}%</span>
                </div>
                <Progress value={testOnboarding.progress} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">바이어 검색</span>
                    <span className="font-medium">{testOnboarding.discoveryProgress ?? 0}%</span>
                  </div>
                  <Progress value={testOnboarding.discoveryProgress ?? 0} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">이메일 생성</span>
                    <span className="font-medium">{testOnboarding.templatesProgress ?? 0}%</span>
                  </div>
                  <Progress value={testOnboarding.templatesProgress ?? 0} />
                </div>
              </div>
            </div>
          )}

          {testOnboarding.isSuccess &&
            testOnboarding.data &&
            testOnboarding.data.leadDiscovery &&
            testOnboarding.data.emailGeneration && (
              <div className="mt-6 space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold text-lg">테스트 결과</h3>

                {testOnboarding.data.totalDuration && (
                  <div className="space-y-2">
                    <h4 className="font-medium">⏱️ 성능 정보</h4>
                    <div className="space-y-1 text-muted-foreground text-sm">
                      <p>
                        • 전체 소요 시간:{" "}
                        <strong className="text-blue-600">
                          {formatDuration(testOnboarding.data.totalDuration)}
                        </strong>
                      </p>
                      {testOnboarding.data.leadDiscovery.duration &&
                        testOnboarding.data.emailGeneration.duration && (
                          <>
                            <p className="text-green-600">
                              &nbsp;&nbsp;🚀 병렬 실행: 바이어 검색 + 이메일 생성
                            </p>
                            <p>
                              &nbsp;&nbsp;&nbsp;&nbsp;- 바이어 검색:{" "}
                              {formatDuration(testOnboarding.data.leadDiscovery.duration)}
                            </p>
                            <p>
                              &nbsp;&nbsp;&nbsp;&nbsp;- 이메일 생성:{" "}
                              {formatDuration(testOnboarding.data.emailGeneration.duration)}
                            </p>
                            {testOnboarding.data.leadDiscovery.duration >
                              testOnboarding.data.emailGeneration.duration && (
                              <p className="text-amber-600 text-xs">
                                &nbsp;&nbsp;&nbsp;&nbsp;💡 절약된 시간:{" "}
                                {formatDuration(testOnboarding.data.emailGeneration.duration)} (동시
                                실행)
                              </p>
                            )}
                          </>
                        )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium">📊 바이어 검색 결과</h4>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    <p>• 총 발견: {testOnboarding.data.leadDiscovery.stats.totalFound}개</p>
                    <p>• 이메일 확보: {testOnboarding.data.leadDiscovery.stats.totalWithEmail}개</p>
                    <p>• 최종 선정: {testOnboarding.data.leadDiscovery.leads.length}개</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">📧 이메일 생성 결과</h4>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    <p>• 생성된 이메일: {testOnboarding.data.emailGeneration.templates.length}개</p>
                    {testOnboarding.data.emailGeneration.templates.map((t) => (
                      <p key={t.step}>
                        &nbsp;&nbsp;Step {t.step} ({t.type}): {t.subject}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">👥 샘플 바이어 (처음 5개)</h4>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    {testOnboarding.data.leadDiscovery.leads.slice(0, 5).map((lead, i) => (
                      <p key={i}>
                        {i + 1}. {lead.company} - {lead.email}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="gap-2"
                    onClick={handleDownloadJSON}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4" />
                    JSON 다운로드
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={handleDownloadMarkdown}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4" />
                    Markdown 다운로드
                  </Button>
                </div>
              </div>
            )}

          {testOnboarding.isError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm">
              테스트 실패: {testOnboarding.error?.message || "알 수 없는 오류"}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
