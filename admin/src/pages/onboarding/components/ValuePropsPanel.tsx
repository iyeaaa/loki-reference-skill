import { motion } from "framer-motion"
import { Check, Circle } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { OnboardingData } from "../types"

type ValuePropItem = {
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
    <div className="h-fit rounded-2xl bg-gray-50 p-6">
      <h3 className="mb-1 font-semibold text-gray-900">{t("onboarding.valueProps.title")}</h3>
      <p className="mb-4 text-gray-500 text-sm">{t("onboarding.valueProps.subtitle")}</p>

      <div className="space-y-3">
        {valueProps.map((item, index) => (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-3"
            initial={{ opacity: 0, x: 10 }}
            key={item.titleKey}
            transition={{ delay: index * 0.1 }}
          >
            <div className="mt-0.5">
              {item.completed ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                  <Check className="h-3 w-3 text-white" />
                </div>
              ) : (
                <Circle className="h-5 w-5 text-gray-300" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {t(`onboarding.${item.titleKey}`)}
              </p>
              <p className="text-gray-500 text-xs">{t(`onboarding.${item.descKey}`)}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
