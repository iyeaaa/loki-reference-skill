"use client"

import { useState } from "react"
import { WebsiteInputStep } from "./onboarding/website-input-step"
import { AnalysisStep } from "./onboarding/analysis-step"
import { RecommendationsStep } from "./onboarding/recommendations-step"
import { LoginStep } from "./onboarding/login-step"
import { TrialStep } from "./onboarding/trial-step"
import { LanguageProvider, useLanguage } from "@/lib/language-context"
import { Button } from "./ui/button"
import { Globe } from "lucide-react"

export type OnboardingData = {
  websiteUrl?: string
  companyName?: string
  industry?: string
  description?: string
  currentMarkets?: string
}

export type OnboardingStep = "input" | "login" | "analysis" | "recommendations" | "trial"

function OnboardingFlowContent() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("input")
  const [data, setData] = useState<OnboardingData>({})
  const { language, toggleLanguage } = useLanguage()

  const handleWebsiteSubmit = (submittedData: OnboardingData) => {
    setData(submittedData)
    setCurrentStep("login")
  }

  const handleLoginComplete = () => {
    setCurrentStep("analysis")
  }

  const handleAnalysisComplete = () => {
    setCurrentStep("recommendations")
  }

  const handleRecommendationsReview = () => {
    setCurrentStep("trial")
  }

  return (
    <div className="relative min-h-screen">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        className="fixed top-4 right-4 z-50 gap-2 bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm"
      >
        <Globe className="h-4 w-4" />
        {language === "ko" ? "EN" : "KO"}
      </Button>

      {currentStep === "input" && <WebsiteInputStep onSubmit={handleWebsiteSubmit} />}
      {currentStep === "login" && <LoginStep onComplete={handleLoginComplete} />}
      {currentStep === "analysis" && <AnalysisStep data={data} onComplete={handleAnalysisComplete} />}
      {currentStep === "recommendations" && <RecommendationsStep data={data} onNext={handleRecommendationsReview} />}
      {currentStep === "trial" && <TrialStep data={data} />}
    </div>
  )
}

export function OnboardingFlow() {
  return (
    <LanguageProvider>
      <OnboardingFlowContent />
    </LanguageProvider>
  )
}
