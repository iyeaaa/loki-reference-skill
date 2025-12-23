import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { shouldReduceMotion, staggerItemVariants } from "@/lib/animations"

export function DashboardPreview() {
  const { t } = useTranslation("translation")

  return (
    <motion.div
      className="w-full rounded-xl bg-white p-5 shadow-lg sm:p-7"
      variants={shouldReduceMotion() ? {} : staggerItemVariants}
    >
      {/* Browser Header */}
      <div className="mb-4 flex items-center">
        <div className="mr-4 flex space-x-2">
          <div className="h-3 w-3 rounded-full bg-red-400" />
          <div className="h-3 w-3 rounded-full bg-yellow-400" />
          <div className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <div className="text-gray-500 text-xs">app.rinda.ai</div>
      </div>

      {/* Dashboard Header */}
      <div className="mb-6 flex items-center">
        <div className="mr-3 flex h-8 w-8 items-center justify-center">
          <img
            alt="Rinda Logo"
            className="h-full w-full object-contain"
            src="/images/rinda-logo.png"
          />
        </div>
        <span className="font-semibold text-gray-900 text-lg">RINDA</span>
      </div>

      {/* Metrics Grid */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <motion.div
          className="rounded-lg bg-gray-100 p-5 text-center"
          variants={shouldReduceMotion() ? {} : staggerItemVariants}
        >
          <div className="mb-2 font-bold text-3xl text-gray-900">847</div>
          <div className="text-gray-600 text-sm">{t("trial.preview.discoveredBuyers")}</div>
        </motion.div>
        <motion.div
          className="rounded-lg bg-gray-100 p-5 text-center"
          variants={shouldReduceMotion() ? {} : staggerItemVariants}
        >
          <div className="mb-2 font-bold text-3xl text-gray-900">156</div>
          <div className="text-gray-600 text-sm">{t("trial.preview.contacted")}</div>
        </motion.div>
        <motion.div
          className="rounded-lg bg-blue-100 p-5 text-center"
          variants={shouldReduceMotion() ? {} : staggerItemVariants}
        >
          <div className="mb-2 font-bold text-3xl text-blue-600">12</div>
          <div className="text-gray-600 text-sm">{t("trial.preview.interested")}</div>
        </motion.div>
      </div>

      {/* Activity Feed */}
      <motion.div
        className="rounded-lg border-green-400 border-l-4 bg-green-50 p-4"
        variants={shouldReduceMotion() ? {} : staggerItemVariants}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="mr-3 flex h-7 w-7 items-center justify-center rounded bg-green-500">
              <span className="font-bold text-sm text-white">VN</span>
            </div>
            <span className="font-medium text-base text-gray-900">
              {t("trial.preview.buyerResponse")}
            </span>
          </div>
          <div className="text-gray-500 text-sm">{t("trial.preview.timeAgo")}</div>
        </div>
      </motion.div>
    </motion.div>
  )
}
