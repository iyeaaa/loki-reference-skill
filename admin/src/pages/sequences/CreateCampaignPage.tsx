import { ArrowLeft, Check } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CreateCampaignStep1 } from "./CreateCampaignStep1"
import { CreateCampaignStep2 } from "./CreateCampaignStep2"
import { CreateCampaignStep3 } from "./CreateCampaignStep3"

export default function CreateCampaignPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [campaignData, setCampaignData] = useState({
    workspaceId: "",
    customerGroupId: "",
    selectedLeadIds: [] as string[],
    name: "",
    description: "",
    steps: [] as Array<{
      stepOrder: number
      delayDays: number
      scheduledHour: number
      scheduledMinute: number
      emailSubject: string
      emailBodyText: string
      isDraft?: boolean
    }>,
    memo: "",
  })

  const steps = [
    { number: 1, title: "고객 선택", description: "고객그룹 및 수신자 선택" },
    { number: 2, title: "시나리오 생성", description: "이메일 스텝 작성" },
    { number: 3, title: "검토", description: "최종 검토 및 저장" },
  ]

  const handleBack = () => {
    navigate("/sequences")
  }

  const handleNextStep = () => {
    if (currentStep === 1) {
      // Validate Step 1
      if (!campaignData.workspaceId || !campaignData.customerGroupId) {
        alert("워크스페이스와 고객그룹을 선택해주세요")
        return
      }
    }

    if (currentStep === 2) {
      // Validate Step 2
      if (campaignData.steps.length === 0) {
        alert("최소 1개 이상의 이메일 스텝을 추가해주세요")
        return
      }
      const hasDraftSteps = campaignData.steps.some((step) => step.isDraft)
      if (hasDraftSteps) {
        alert("작성 중인 스텝이 있습니다. 모든 스텝을 저장해주세요")
        return
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
            <div>
              <h1 className="text-2xl font-bold">새 캠페인 생성</h1>
              <p className="text-sm text-muted-foreground">3단계로 이메일 캠페인을 생성하세요</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors",
                    currentStep === step.number
                      ? "border-primary bg-primary text-primary-foreground"
                      : currentStep > step.number
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background text-muted-foreground",
                  )}
                >
                  {currentStep > step.number ? <Check className="h-5 w-5" /> : step.number}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      currentStep === step.number ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-4 h-0.5 w-24 transition-colors",
                    currentStep > step.number ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 1: 고객 선택</h2>
            <p className="text-muted-foreground">고객그룹과 수신자를 선택하세요</p>
            <CreateCampaignStep1
              data={{
                workspaceId: campaignData.workspaceId,
                customerGroupId: campaignData.customerGroupId,
                selectedLeadIds: campaignData.selectedLeadIds,
              }}
              onChange={(data) => setCampaignData((prev) => ({ ...prev, ...data }))}
            />
          </div>
        )}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 2: 시나리오 생성</h2>
            <p className="text-muted-foreground">이메일 스텝을 생성하세요 (최대 4개)</p>
            <CreateCampaignStep2
              data={{
                workspaceId: campaignData.workspaceId,
                customerGroupId: campaignData.customerGroupId,
                steps: campaignData.steps,
              }}
              onChange={(data) => setCampaignData((prev) => ({ ...prev, ...data }))}
            />
          </div>
        )}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 3: 검토</h2>
            <p className="text-muted-foreground">캠페인 설정을 확인하고 저장하세요</p>
            <CreateCampaignStep3
              data={campaignData}
              onChange={(data) => setCampaignData((prev) => ({ ...prev, ...data }))}
            />
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      {currentStep < 3 && (
        <div className="border-t bg-background px-6 py-4">
          <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrevStep} disabled={currentStep === 1}>
              이전
            </Button>
            <Button onClick={handleNextStep}>다음</Button>
          </div>
        </div>
      )}
    </div>
  )
}
