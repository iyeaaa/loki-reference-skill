"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Brain, Globe, TrendingUp, Users, CheckCircle2, Sparkles, Loader2 } from "lucide-react"
import type { OnboardingData } from "../onboarding-flow"

type Props = {
  data: OnboardingData
  onComplete: () => void
}

type AnalysisPhase = {
  id: string
  label: string
  icon: React.ElementType
  duration: number
}

const phases: AnalysisPhase[] = [
  {
    id: "scraping",
    label: "회사 정보 분석 중",
    icon: Globe,
    duration: 1200,
  },
  {
    id: "market",
    label: "글로벌 시장 데이터 수집",
    icon: TrendingUp,
    duration: 1300,
  },
  {
    id: "audience",
    label: "타겟 고객 매칭",
    icon: Users,
    duration: 1200,
  },
  {
    id: "strategy",
    label: "맞춤 전략 생성 완료",
    icon: Sparkles,
    duration: 1300,
  },
]

export function AnalysisStep({ data, onComplete }: Props) {
  const [currentPhase, setCurrentPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const [completedPhases, setCompletedPhases] = useState<string[]>([])

  useEffect(() => {
    if (currentPhase >= phases.length) {
      setTimeout(onComplete, 300)
      return
    }

    const phase = phases[currentPhase]
    const progressIncrement = 100 / (phase.duration / 30)

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + progressIncrement
        return next >= 100 ? 100 : next
      })
    }, 30)

    const phaseTimer = setTimeout(() => {
      setCompletedPhases((prev) => [...prev, phase.id])
      setProgress(0)
      setCurrentPhase((prev) => prev + 1)
    }, phase.duration)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(phaseTimer)
    }
  }, [currentPhase, onComplete])

  const overallProgress = ((currentPhase + progress / 100) / phases.length) * 100

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-secondary via-background to-primary/5">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 relative shadow-lg">
            <Brain className="w-10 h-10 text-primary" />
            <Loader2
              className="absolute inset-0 w-20 h-20 text-primary/50 animate-spin"
              style={{ animationDuration: "3s" }}
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">RINDA가 귀사만의 전략을 만들고 있어요</h2>
            <p className="text-sm text-muted-foreground">곧 완성됩니다, 조금만 기다려주세요</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-foreground">분석 진행 중</span>
            <span className="font-bold text-primary">{Math.round(overallProgress)}%</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        <Card className="p-5 bg-card border-2 border-border shadow-lg">
          <div className="space-y-3">
            {phases.map((phase, index) => {
              const Icon = phase.icon
              const isActive = index === currentPhase
              const isCompleted = completedPhases.includes(phase.id)

              return (
                <div
                  key={phase.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-primary/10 border-2 border-primary/50 shadow-sm"
                      : isCompleted
                        ? "bg-green-50 border-2 border-green-300"
                        : "bg-muted border border-border opacity-60"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-semibold ${isActive ? "text-primary" : isCompleted ? "text-green-800" : "text-muted-foreground"}`}
                      >
                        {phase.label}
                      </span>
                      {isCompleted && (
                        <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">
                          완료
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <div className="mt-1.5">
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground bg-primary/10 inline-block px-4 py-2 rounded-full border border-primary/20">
            <Sparkles className="w-4 h-4 inline mr-1.5 text-primary" />
            글로벌 시장 데이터를 실시간으로 분석하고 있어요
          </p>
        </div>
      </div>
    </div>
  )
}
