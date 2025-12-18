import { ArrowRight, CheckCircle2, Loader2, Upload, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type ViewState = "initial" | "generating" | "complete"

export function StepLeadCheck() {
  const { i18n } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [viewState, setViewState] = useState<ViewState>("initial")
  const [progress, setProgress] = useState(0)
  const isKorean = i18n.language === "ko"

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  })

  const handleNext = () => {
    setSearchParams({ step: "3" })
  }

  const handleAutoGenerate = () => {
    setViewState("generating")
    setProgress(0)
  }

  // 자동 생성 로딩 애니메이션 - 최적 UX 알고리즘
  // 초반 빠르게 → 중반 적당히 → 후반 천천히 (사용자가 진행감을 느끼면서도 지루하지 않게)
  useEffect(() => {
    if (viewState !== "generating") {
      return
    }

    let timeoutId: ReturnType<typeof setTimeout>

    const animate = () => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 100
        }

        // 구간별 증가량 (초반 빠름, 후반 느림)
        let baseIncrement: number
        let baseDelay: number

        if (prev < 30) {
          // 초반: 빠르게 진행 (사용자에게 즉각적인 피드백)
          baseIncrement = 8 + Math.random() * 6 // 8-14
          baseDelay = 100 + Math.random() * 100 // 100-200ms
        } else if (prev < 60) {
          // 중반: 적당한 속도
          baseIncrement = 5 + Math.random() * 4 // 5-9
          baseDelay = 150 + Math.random() * 150 // 150-300ms
        } else if (prev < 85) {
          // 후반: 느리게 (완료 기대감 유지)
          baseIncrement = 3 + Math.random() * 3 // 3-6
          baseDelay = 200 + Math.random() * 200 // 200-400ms
        } else {
          // 마무리: 아주 느리게 (완료 직전 서스펜스)
          baseIncrement = 2 + Math.random() * 3 // 2-5
          baseDelay = 150 + Math.random() * 150 // 150-300ms
        }

        const newProgress = Math.min(Math.round(prev + baseIncrement), 100)

        // 100% 도달 시 완료 상태로 전환
        if (newProgress >= 100) {
          setViewState("complete")
          return 100
        }

        // 다음 프레임 예약
        timeoutId = setTimeout(animate, baseDelay)
        return newProgress
      })
    }

    // 시작
    timeoutId = setTimeout(animate, 100)
    return () => clearTimeout(timeoutId)
  }, [viewState])

  // 완료 후 사용자가 직접 다음 단계 버튼을 클릭하도록 변경
  // (자동 이동 제거 - 사용자가 결과를 확인할 시간 필요)

  const handleComplete = () => {
    setSearchParams({ step: "3" })
  }

  // 자동 생성 중 화면
  if (viewState === "generating") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {isKorean ? "맞춤 리드를 생성하고 있습니다..." : "Generating custom leads..."}
            </h2>
            <p className="mb-6 text-center text-gray-500 text-sm">
              {isKorean
                ? "AI가 귀사에 최적화된 해외 바이어를 찾고 있습니다"
                : "AI is finding the best overseas buyers for your business"}
            </p>
            <div className="w-full max-w-xs">
              <Progress className="h-2" value={progress} />
              <p className="mt-2 text-center text-gray-500 text-sm">{progress}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 생성 완료 화면
  if (viewState === "complete") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {isKorean ? "맞춤 리드 생성 완료!" : "Custom leads generated!"}
            </h2>
            <div className="mb-6 flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-600 text-lg">300</span>
              <span className="text-gray-600">
                {isKorean ? "개의 리드가 생성되었습니다" : "leads generated"}
              </span>
            </div>
            <p className="mb-8 text-center text-gray-500 text-sm">
              {isKorean
                ? "귀사의 산업군과 타겟 국가에 최적화된 바이어 리스트입니다"
                : "Buyer list optimized for your industry and target country"}
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleComplete}>
              {isKorean ? "다음 단계" : "Next Step"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 초기 화면
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="flex flex-col items-center px-8 py-12">
          {/* Title */}
          <h2 className="mb-8 text-center font-semibold text-2xl text-gray-900">
            {isKorean ? "보유한 리드가 있으신가요?" : "Do you have existing leads?"}
          </h2>

          {/* CSV Upload Area */}
          <div
            {...getRootProps()}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : uploadedFile
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50",
            )}
          >
            <input {...getInputProps()} />
            <Upload
              className={cn("mb-4 h-12 w-12", uploadedFile ? "text-green-500" : "text-gray-400")}
            />
            {uploadedFile ? (
              <>
                <p className="font-medium text-green-700">{uploadedFile.name}</p>
                <p className="mt-1 text-gray-500 text-sm">
                  {isKorean
                    ? "다른 파일을 업로드하려면 클릭하세요"
                    : "Click to upload a different file"}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-gray-700">
                  {isKorean
                    ? "CSV 파일을 드래그하거나 클릭하여 업로드"
                    : "Drag & drop a CSV file or click to upload"}
                </p>
                <p className="mt-1 text-gray-500 text-sm">
                  {isKorean ? "리드 목록이 포함된 CSV 파일" : "CSV file containing your lead list"}
                </p>
              </>
            )}
          </div>

          {/* Next Button - only show when file is uploaded */}
          {uploadedFile && (
            <Button className="mt-6 bg-blue-600 hover:bg-blue-700" onClick={handleNext}>
              {isKorean ? "다음 단계" : "Next Step"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {/* Auto Generate Button */}
          <div className="mt-8 flex w-full flex-col items-center gap-2">
            <span className="text-gray-500 text-sm">{isKorean ? "또는" : "or"}</span>
            <Button
              className="w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              onClick={handleAutoGenerate}
              size="lg"
              variant="outline"
            >
              {isKorean
                ? "아니오, AI가 자동으로 생성해주세요"
                : "No, let AI generate leads automatically"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
