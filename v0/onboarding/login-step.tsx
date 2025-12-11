"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Mail, Globe, ArrowRight, CheckCircle2 } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

type Props = {
  onComplete: () => void
}

export function LoginStep({ onComplete }: Props) {
  const { language, toggleLanguage, t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")

  const handleGoogleSignIn = () => {
    setIsLoading(true)
    setTimeout(() => {
      onComplete()
    }, 500)
  }

  const handleEmailSignIn = () => {
    if (email) {
      setIsLoading(true)
      setTimeout(() => {
        onComplete()
      }, 500)
    }
  }

  const benefits = [
    t("귀사에 관심있는 해외 바이어를 찾아드려요", "We find international buyers interested in your products"),
    t("영어 걱정 없이 AI가 영업 메일을 보내드려요", "AI sends sales emails without English worries"),
    t("바이어가 반응하면 바로 알려드려요", "Get notified when buyers respond"),
  ]

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Language Toggle */}
      <button
        onClick={toggleLanguage}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors"
      >
        <Globe className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-muted-foreground" />
        <span className="text-xs sm:text-sm text-foreground">{language === "ko" ? "EN" : "한국어"}</span>
      </button>

      {/* Left Column - Login Form (White Background) */}
      <div className="w-full lg:w-1/2 bg-background flex flex-col justify-center px-5 sm:px-8 lg:px-20 py-8 sm:py-12 min-h-[60vh] lg:min-h-screen">
        <div className="max-w-sm mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5 mb-8 sm:mb-12">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs sm:text-sm">R</span>
            </div>
            <span className="text-lg sm:text-xl font-semibold text-foreground">RINDA</span>
          </div>

          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              {t("해외 영업, 이제 시작해볼까요?", "Ready to start global sales?")}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t("로그인하고 맞춤 분석 결과를 확인하세요", "Sign in to see your personalized analysis")}
            </p>
          </div>

          {/* Google Login Button */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            variant="outline"
            size="lg"
            className="w-full h-11 sm:h-12 mb-3 font-medium justify-center gap-2 sm:gap-3 border-border hover:bg-muted/50 bg-background text-sm sm:text-base"
          >
            {isLoading ? (
              <span className="flex items-center gap-2 sm:gap-3">
                <span className="w-4 sm:w-5 h-4 sm:h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                {t("연결 중...", "Connecting...")}
              </span>
            ) : (
              <>
                <svg className="w-4 sm:w-5 h-4 sm:h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t("Google로 계속하기", "Continue with Google")}
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative my-4 sm:my-5">
            <Separator className="bg-border" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 sm:px-4 text-xs sm:text-sm text-muted-foreground">
              {t("또는", "OR")}
            </span>
          </div>

          {/* Email Input */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder={t("업무용 이메일 주소", "Work email address")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 sm:h-12 pl-10 sm:pl-12 border-border bg-background text-sm sm:text-base"
              />
            </div>
            <Button
              onClick={handleEmailSignIn}
              size="lg"
              className="w-full h-11 sm:h-12 font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-sm sm:text-base"
            >
              {t("이메일로 계속하기", "Continue with email")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Terms */}
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-5 sm:mt-6 leading-relaxed">
            {t("계속 진행하시면 RINDA의 ", "By continuing you accept RINDA's ")}
            <a href="#" className="underline hover:text-foreground">
              {t("이용약관", "Terms of Service")}
            </a>
            {t(" 및 ", " and ")}
            <a href="#" className="underline hover:text-foreground">
              {t("개인정보처리방침", "Privacy Policy")}
            </a>
            {t("에 동의하게 됩니다.", ".")}
          </p>
        </div>
      </div>

      {/* Right Column - Benefits (Hidden on mobile, shown on lg) */}
      <div className="w-full lg:w-1/2 bg-primary flex flex-col p-6 sm:p-8 lg:p-12 text-primary-foreground min-h-[40vh] lg:min-h-screen">
        {/* Top - Benefits Section */}
        <div className="mb-auto">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">
            {t("로그인하시면 바로 확인하실 수 있어요", "See your results right after login")}
          </h2>
          <p className="text-sm sm:text-base text-primary-foreground/80 mb-4 sm:mb-8">
            {t("맞춤 시장 분석과 진출 전략을 준비했어요", "We've prepared your market analysis and strategy")}
          </p>

          <div className="space-y-2.5 sm:space-y-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 mt-0.5 flex-shrink-0" />
                <span className="text-sm sm:text-base text-primary-foreground/90">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Middle - Customer Quote (Hidden on mobile) */}
        <div className="hidden lg:block bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
          <p className="text-primary-foreground/90 leading-relaxed mb-4">
            {t(
              '"수출이 막막했는데, RINDA 덕분에 첫 해외 계약을 성사시켰어요. 영어 메일을 알아서 보내주니 정말 편했습니다."',
              '"Export seemed impossible, but RINDA helped me close my first overseas deal. Having AI handle English emails was so convenient."',
            )}
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <span className="font-semibold text-sm">박</span>
            </div>
            <div>
              <p className="font-medium text-sm">{t("박성민 대표", "Sungmin Park, CEO")}</p>
              <p className="text-xs text-primary-foreground/70">{t("우리식품", "Woori Foods Co.")}</p>
            </div>
          </div>
        </div>

        {/* Bottom - Dashboard Preview (Hidden on mobile) */}
        <div className="hidden lg:block bg-background rounded-xl overflow-hidden shadow-2xl">
          {/* Preview Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-3 py-1 bg-muted rounded text-xs text-muted-foreground">app.rinda.io</div>
            </div>
          </div>

          {/* Preview Content */}
          <div className="p-4 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">R</span>
              </div>
              <span className="font-medium text-foreground text-sm">RINDA</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="text-lg font-bold text-foreground">847</p>
                <p className="text-xs text-muted-foreground">{t("발굴 바이어", "Found")}</p>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="text-lg font-bold text-foreground">156</p>
                <p className="text-xs text-muted-foreground">{t("연락 완료", "Contacted")}</p>
              </div>
              <div className="p-2 rounded bg-primary/10 text-center">
                <p className="text-lg font-bold text-primary">12</p>
                <p className="text-xs text-muted-foreground">{t("관심 표현", "Interested")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 text-xs font-medium">VN</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-foreground font-medium">
                    {t("베트남 바이어 열람", "Vietnam buyer viewed")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">2m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
