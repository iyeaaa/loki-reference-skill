import { motion } from "framer-motion"
import { Check, Circle } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { OnboardingData } from "../types"

interface ValuePropItem {
  titleKey: string
  descKey: string
  completed: boolean
}

export function ValuePropsPanel({
  currentStep,
  data,
}: {
  currentStep: number
  data: OnboardingData
}) {
  const { t } = useTranslation()

  const valueProps: ValuePropItem[] = [
    {
      titleKey: "valueProps.buyerList",
      descKey: "valueProps.buyerListDesc",
      completed: data.industry !== null && currentStep >= 1,
    },
    {
      titleKey: "valueProps.strategy",
      descKey: "valueProps.strategyDesc",
      completed: currentStep > 2,
    },
    {
      titleKey: "valueProps.email",
      descKey: "valueProps.emailDesc",
      completed: currentStep > 3,
    },
    {
      titleKey: "valueProps.analytics",
      descKey: "valueProps.analyticsDesc",
      completed: currentStep > 4,
    },
  ]

  return (
    <div className="bg-gray-50 rounded-2xl p-6 h-fit">
      <h3 className="font-semibold text-gray-900 mb-1">{t("onboarding.valueProps.title")}</h3>
      <p className="text-sm text-gray-500 mb-4">{t("onboarding.valueProps.subtitle")}</p>

      <div className="space-y-3">
        {valueProps.map((item, index) => (
          <motion.div
            key={item.titleKey}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-3"
          >
            <div className="mt-0.5">
              {item.completed ? (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              ) : (
                <Circle className="w-5 h-5 text-gray-300" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {t(`onboarding.${item.titleKey}`)}
              </p>
              <p className="text-xs text-gray-500">{t(`onboarding.${item.descKey}`)}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
