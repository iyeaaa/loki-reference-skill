import { Check, ExternalLink, Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type Plan = {
  id: string
  name: string
  badge?: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  yearlyMonthlyPrice: number
  discount?: number
  features: string[]
  isRecommended?: boolean
  isEnterprise?: boolean
}

const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    badge: "Send-Only",
    description: "월 150개 기업에 맞춤 메일 발송",
    monthlyPrice: 300_000,
    yearlyPrice: 3_000_000,
    yearlyMonthlyPrice: 250_000,
    discount: 17,
    features: [
      "월 150개 기업에 맞춤 메일 발송",
      "관심 답장 자동 분류",
      "스팸 방지 관리",
      "월간 결과 리포트",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Full-Service",
    description: "전담 매니저와 함께 대량 바이어 컨택",
    monthlyPrice: 2_000_000,
    yearlyPrice: 20_000_000,
    yearlyMonthlyPrice: 1_666_667,
    discount: 17,
    features: [
      "Basic의 모든 기능 포함",
      "대량 바이어 컨택 (월 1,500개)",
      "전담 매니저 배정",
      "바이어 답장에 1차 대응",
      "미팅 일정 조율 (화상/대면)",
      "경영진 성과 리포트",
    ],
    isRecommended: true,
  },
]

const CONTACT_URL = "https://rinda.ai/contact"

type UpgradePlanModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpgradePlanModal({ open, onOpenChange }: UpgradePlanModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isYearly, setIsYearly] = useState(true)

  const formatPrice = (price: number) => new Intl.NumberFormat("ko-KR").format(price)

  const handleUpgrade = (plan: Plan) => {
    // Enterprise는 문의 페이지로
    if (plan.isEnterprise) {
      window.open(CONTACT_URL, "_blank")
      return
    }
    // 다른 플랜은 공개 결제 테스트 페이지로 이동 (tier, interval 파라미터 전달)
    const interval = isYearly ? "year" : "month"
    onOpenChange(false)
    navigate(`/payment-test?tier=${plan.id}&interval=${interval}`)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-0">
        <DialogHeader className="space-y-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
          <DialogTitle className="text-center font-bold text-2xl">
            {t("upgrade.modal.title")}
          </DialogTitle>
          <p className="text-center text-blue-100">{t("upgrade.modal.subtitle")}</p>
        </DialogHeader>

        <div className="p-6">
          {/* Billing Toggle */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span className="font-medium text-sm">{t("upgrade.modal.yearly")}</span>
              {isYearly && (
                <Badge className="bg-green-100 text-green-700" variant="secondary">
                  17% {t("upgrade.modal.discount")}
                </Badge>
              )}
            </div>
            <span className="text-muted-foreground">|</span>
            <a
              className="flex items-center gap-1 text-blue-600 text-sm hover:underline"
              href={CONTACT_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("upgrade.modal.learnMore")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Plans Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                className={cn(
                  "relative rounded-xl border p-6 transition-all hover:shadow-lg",
                  plan.isRecommended && "border-blue-500 ring-2 ring-blue-500/20",
                )}
                key={plan.id}
              >
                {plan.isRecommended && (
                  <div className="-top-3 -translate-x-1/2 absolute left-1/2">
                    <Badge className="bg-blue-600 text-white">
                      <Sparkles className="mr-1 h-3 w-3" />
                      {t("upgrade.modal.recommended")}
                    </Badge>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    {plan.badge && (
                      <Badge className="bg-slate-100 text-slate-600" variant="secondary">
                        {plan.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  {plan.isEnterprise ? (
                    <div className="font-bold text-2xl">{t("upgrade.modal.contactSales")}</div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-3xl">
                          ₩{formatPrice(isYearly ? plan.yearlyMonthlyPrice : plan.monthlyPrice)}
                        </span>
                        <span className="text-muted-foreground">/{t("upgrade.modal.month")}</span>
                      </div>
                      {isYearly && (
                        <p className="mt-1 text-muted-foreground text-sm">
                          {t("upgrade.modal.billedYearly", {
                            price: formatPrice(plan.yearlyPrice),
                          })}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="mb-6 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li className="flex items-start gap-2 text-sm" key={index}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn("w-full", plan.isRecommended && "bg-blue-600 hover:bg-blue-700")}
                  onClick={() => handleUpgrade(plan)}
                  variant={plan.isRecommended ? "default" : "outline"}
                >
                  {plan.isEnterprise ? t("upgrade.modal.contactUs") : t("upgrade.modal.upgrade")}
                </Button>
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <p className="mt-6 text-center text-muted-foreground text-sm">
            {t("upgrade.modal.footerNote")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
