import * as DialogPrimitive from "@radix-ui/react-dialog"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Bot } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { OnboardingStepper } from "./components/OnboardingStepper"
import { StepCompanyInfo } from "./components/StepCompanyInfo"
import { StepConfirmation } from "./components/StepConfirmation"
import { StepEmailGeneration } from "./components/StepEmailGeneration"
import { StepEmailLink } from "./components/StepEmailLink"
import { StepLeadSearch } from "./components/StepLeadSearch"

const WELCOME_POPUP_KEY = "rinda_welcome_popup_seen"

interface WelcomeStep {
  title: string
  description: string
}

function WelcomePopup({ open, onComplete }: { open: boolean; onComplete: () => void }) {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(0)

  const steps: WelcomeStep[] = [
    {
      title: t("app.welcome.step1.title", "Welcome to RINDA!"),
      description: t(
        "app.welcome.step1.description",
        "AI automatically finds overseas buyers and sells to them. Leave the complexities of overseas sales to RINDA.",
      ),
    },
    {
      title: t("app.welcome.step2.title", "Smart Lead Discovery"),
      description: t(
        "app.welcome.step2.description",
        "Our AI analyzes millions of potential buyers to find the perfect match for your business.",
      ),
    },
    {
      title: t("app.welcome.step3.title", "Let's start with 3 steps"),
      description: t(
        "app.welcome.step3.description",
        "1. Enter your company information → 2. Select a sales strategy → 3. Link your email. Everything can be done in just 5 minutes.",
      ),
    },
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const isLastStep = currentStep === steps.length - 1

  return (
    <Dialog open={open}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl shadow-2xl overflow-hidden outline-none">
          {/* Blue Header */}
          <div className="bg-blue-500 px-8 py-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">RINDA Agent</span>
          </div>

          {/* White Content */}
          <div className="bg-white p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-3">{steps[currentStep].title}</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {steps[currentStep].description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Footer with dots and button */}
            <div className="flex items-center justify-between mt-8">
              {/* Pagination Dots */}
              <div className="flex gap-2">
                {steps.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      index === currentStep ? "bg-blue-500" : "bg-gray-300",
                    )}
                  />
                ))}
              </div>

              {/* Next/Finish Button */}
              <Button
                onClick={handleNext}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6"
              >
                {isLastStep ? t("app.welcome.finish", "Finish") : t("app.welcome.next", "Next")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

export default function CompanyInformation() {
  const [searchParams, _setSearchParams] = useSearchParams()
  const [showWelcome, setShowWelcome] = useState(false)

  // Get current step from URL, default to 1
  const currentStep = Number.parseInt(searchParams.get("step") || "1", 10)

  useEffect(() => {
    // Check if user has seen the welcome popup
    const hasSeenWelcome = localStorage.getItem(WELCOME_POPUP_KEY)
    if (!hasSeenWelcome) {
      setShowWelcome(true)
    }
  }, [])

  const handleWelcomeComplete = () => {
    localStorage.setItem(WELCOME_POPUP_KEY, "true")
    setShowWelcome(false)
  }

  // Calculate completed steps (all steps before current step)
  const completedSteps = Array.from({ length: currentStep - 1 }, (_, i) => i + 1)

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepCompanyInfo />
      case 2:
        return <StepLeadSearch />
      case 3:
        return <StepEmailGeneration />
      case 4:
        return <StepEmailLink />
      case 5:
        return <StepConfirmation />
      default:
        return <StepCompanyInfo />
    }
  }

  return (
    <div className="py-8 px-4">
      <WelcomePopup open={showWelcome} onComplete={handleWelcomeComplete} />

      {/* Stepper */}
      <OnboardingStepper currentStep={currentStep} completedSteps={completedSteps} />

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
