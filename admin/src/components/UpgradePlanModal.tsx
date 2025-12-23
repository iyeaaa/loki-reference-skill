import { Check, ExternalLink, Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
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
    id: "starter",
    name: "Starter",
    badge: "Send-Only",
    description: "이메일 자동화 발송 대행",
    monthlyPrice: 290_000,
    yearlyPrice: 2_900_000,
    yearlyMonthlyPrice: 242_000,
    discount: 17,
    features: [
      "월 최대 1,200개 메일 자동 발송",
      "기업당 시퀀스 최대 4회 발송",
      "기업 맞춤형 보고서 제공",
      "전용 대시보드 및 인박스",
      "답장 실시간 알림",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    badge: "Full-Service",
    description: "프리미엄 세일즈 매니징",
    monthlyPrice: 1_990_000,
    yearlyPrice: 19_900_000,
    yearlyMonthlyPrice: 1_660_000,
    discount: 17,
    features: [
      "무제한 이메일 자동 발송",
      "기업당 시퀀스 다회 발송",
      "모든 진행 상황 실시간 확인",
      "전담 매니저 배치",
      "매니저가 답장 확인 및 팔로업",
    ],
    isRecommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "대규모 조직을 위한 맞춤형",
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyMonthlyPrice: 0,
    features: [
      "Growth의 모든 기능",
      "맞춤형 계약 조건",
      "전담 어카운트 매니저",
      "SLA 보장",
      "API 연동 지원",
    ],
    isEnterprise: true,
  },
]

const CONTACT_URL = "https://rinda.ai/contact"

type UpgradePlanModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpgradePlanModal({ open, onOpenChange }: UpgradePlanModalProps) {
  const { t } = useTranslation()
  const [isYearly, setIsYearly] = useState(true)

  const formatPrice = (price: number) => new Intl.NumberFormat("ko-KR").format(price)

  const handleUpgrade = () => {
    window.open(CONTACT_URL, "_blank")
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
          <div className="grid gap-6 md:grid-cols-3">
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
                  onClick={handleUpgrade}
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
