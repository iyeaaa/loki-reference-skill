"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, ArrowRight, Globe, Mail, Eye, MessageSquare, TrendingUp, Shield } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import type { OnboardingData } from "../onboarding-flow"

type Props = {
  data: OnboardingData
}

export function TrialStep({ data }: Props) {
  const router = useRouter()
  const { language, toggleLanguage, t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)

  const handleStartTrial = () => {
    setIsLoading(true)
    setTimeout(() => {
      router.push("/dashboard")
    }, 500)
  }

  const trialFeatures = [
    t(
      "귀사에 딱 맞는 해외 바이어를 무제한으로 찾아드려요",
      "We find unlimited buyers perfectly matched to your business",
    ),
    t("영어 영업 메일을 AI가 자동으로 작성하고 보내드려요", "AI automatically writes and sends English sales emails"),
    t("바이어 10명이 귀사 제품을 확인할 때까지 완전 무료예요", "Completely free until 10 buyers view your products"),
    t("관심있는 바이어가 나타나면 바로 알려드려요", "Get notified instantly when interested buyers appear"),
    t("성과가 없으면 비용도 없어요, 부담 없이 시작하세요", "No results, no cost - start without any pressure"),
  ]

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Language Toggle */}
      <button
        onClick={toggleLanguage}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-background border border-border hover:bg-muted transition-colors"
      >
        <Globe className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-muted-foreground" />
        <span className="text-xs sm:text-sm font-medium text-foreground">{language === "ko" ? "EN" : "한국어"}</span>
      </button>

      {/* Left Side - Trial Card (White) */}
      <div className="w-full lg:w-1/2 bg-background p-5 sm:p-8 lg:p-12 flex flex-col min-h-[60vh] lg:min-h-screen">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-2.5 mb-6 sm:mb-8">
          <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs sm:text-sm">R</span>
          </div>
          <span className="text-lg sm:text-xl font-semibold text-foreground">RINDA</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto lg:mx-0 w-full">
          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            {t("무료 체험 시작하기", "Start Your Free Trial")}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
            {t(
              "해외 바이어 10명이 귀사를 확인할 때까지, 무제한으로 영업해드려요.",
              "We'll reach out to unlimited buyers until 10 view your products.",
            )}
          </p>

          {/* Trial Card */}
          <Card className="p-4 sm:p-6 border-border mb-4 sm:mb-6">
            {/* Price */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-foreground">₩0</span>
                  <span className="text-muted-foreground text-xs sm:text-sm">
                    {t("바이어 10명 열람까지", "until 10 views")}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {t("이후 월 300,000원부터", "Then from ₩300,000/month")}
                </p>
              </div>
              <div className="px-2.5 sm:px-3 py-1 bg-primary/10 text-primary text-xs sm:text-sm font-medium rounded-full">
                {t("무료 체험", "Free Trial")}
              </div>
            </div>

            <div className="h-px bg-border mb-4 sm:mb-5" />

            {/* Features */}
            <div className="mb-4 sm:mb-6">
              <p className="font-medium text-foreground mb-3 sm:mb-4 text-xs sm:text-sm">
                {t("무료 체험에 포함된 모든 것", "Everything included in free trial")}
              </p>
              <ul className="space-y-2 sm:space-y-3">
                {trialFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 sm:gap-3">
                    <Check className="w-4 sm:w-5 h-4 sm:h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleStartTrial}
              disabled={isLoading}
              size="lg"
              className="w-full h-11 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm sm:text-base"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {t("시작하는 중...", "Starting...")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t("무료로 시작하기", "Start for Free")}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            {/* Trust signals */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-[10px] sm:text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Shield className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                <span>{t("자동결제 없음", "No auto-charge")}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                <span>{t("언제든 취소 가능", "Cancel anytime")}</span>
              </div>
            </div>
          </Card>

          {/* Footer link */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t("궁금한 점이 있으신가요? ", "Have questions? ")}
            <a href="#" className="text-primary hover:underline">
              {t("상담 요청하기", "Request consultation")}
            </a>
          </p>
        </div>

        {/* Bottom footer */}
        <div className="flex items-center justify-between pt-4 sm:pt-6 border-t border-border text-[10px] sm:text-xs text-muted-foreground mt-auto">
          <a href="#" className="hover:text-foreground">
            {t("문의하기", "Contact us")}
          </a>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="#" className="hover:text-foreground">
              {t("개인정보처리방침", "Privacy Policy")}
            </a>
            <span>© 2025 RINDA</span>
          </div>
        </div>
      </div>

      {/* Right Side - Blue background with Demo Preview */}
      <div className="w-full lg:w-1/2 bg-primary flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 min-h-[40vh] lg:min-h-screen">
        <div className="max-w-lg w-full">
          <p className="text-center text-primary-foreground/90 text-base sm:text-lg font-medium mb-4 sm:mb-6">
            {t("RINDA가 어떻게 영업하는지 미리 보세요", "See how RINDA sells for you")}
          </p>

          {/* Demo Preview Card - Hidden on mobile */}
          <div className="hidden sm:block bg-background rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
            {/* Mock Dashboard Header */}
            <div className="bg-muted/50 border-b border-border px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-red-400"></div>
                <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-yellow-400"></div>
                <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-muted rounded text-[10px] sm:text-xs text-muted-foreground">
                  app.rinda.io/dashboard
                </div>
              </div>
            </div>

            {/* Mock Dashboard Content */}
            <div className="p-4 sm:p-5 bg-card">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-xs sm:text-sm">R</span>
                  </div>
                  <span className="font-semibold text-foreground text-sm sm:text-base">RINDA</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 rounded-full">
                  <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] sm:text-xs text-green-700 font-medium">
                    {t("영업 진행 중", "Active")}
                  </span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
                <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1">
                    <Mail className="w-3 sm:w-4 h-3 sm:h-4 text-primary" />
                    <span className="text-base sm:text-xl font-bold text-foreground">127</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t("발송 완료", "Sent")}</p>
                </div>
                <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1">
                    <Eye className="w-3 sm:w-4 h-3 sm:h-4 text-primary" />
                    <span className="text-base sm:text-xl font-bold text-foreground">8</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t("바이어 열람", "Views")}</p>
                </div>
                <div className="text-center p-2 sm:p-3 bg-primary/10 rounded-lg sm:rounded-xl border border-primary/20">
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1">
                    <MessageSquare className="w-3 sm:w-4 h-3 sm:h-4 text-primary" />
                    <span className="text-base sm:text-xl font-bold text-primary">3</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t("답장 수신", "Replies")}</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-1.5 sm:space-y-2">
                <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">
                  {t("실시간 바이어 활동", "Real-time Activity")}
                </p>
                {[
                  {
                    company: "Tech Solutions Inc.",
                    country: "USA",
                    flag: "🇺🇸",
                    action: t("이메일 열람", "Opened email"),
                    time: "2m",
                    type: "view",
                  },
                  {
                    company: "Global Trade GmbH",
                    country: "Germany",
                    flag: "🇩🇪",
                    action: t("답장함", "Replied"),
                    time: "1h",
                    type: "reply",
                  },
                ].map((activity, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2 sm:p-3 rounded-lg ${
                      activity.type === "reply" ? "bg-green-50 border border-green-200" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-6 sm:w-8 h-6 sm:h-8 rounded-full bg-muted flex items-center justify-center text-xs sm:text-sm">
                        {activity.flag}
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-foreground">{activity.company}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{activity.country}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-[10px] sm:text-xs font-medium ${activity.type === "reply" ? "text-green-600" : "text-muted-foreground"}`}
                      >
                        {activity.action}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs sm:text-sm text-primary-foreground/70 mt-4 sm:mt-6">
            {t(
              "무료 체험 시작 후 이 대시보드에서 모든 진행 상황을 확인하실 수 있어요",
              "After starting free trial, track all progress in this dashboard",
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
