import { motion } from "framer-motion"
import { shouldReduceMotion, staggerItemVariants } from "@/lib/animations"

export function DashboardPreview() {
  return (
    <motion.div
      className="bg-white rounded-xl p-5 sm:p-7 shadow-lg w-full"
      variants={shouldReduceMotion() ? {} : staggerItemVariants}
    >
      {/* Browser Header */}
      <div className="flex items-center mb-4">
        <div className="flex space-x-2 mr-4">
          <div className="w-3 h-3 bg-red-400 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
        </div>
        <div className="text-xs text-gray-500">app.rinda.io</div>
      </div>

      {/* Dashboard Header */}
      <div className="flex items-center mb-6">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center mr-3">
          <span className="text-white text-sm font-bold">R</span>
        </div>
        <span className="text-gray-900 font-semibold text-lg">RINDA</span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <motion.div
          className="text-center bg-gray-100 rounded-lg p-5"
          variants={shouldReduceMotion() ? {} : staggerItemVariants}
        >
          <div className="text-3xl font-bold text-gray-900 mb-2">847</div>
          <div className="text-sm text-gray-600">발굴 바이어</div>
        </motion.div>
        <motion.div
          className="text-center bg-gray-100 rounded-lg p-5"
          variants={shouldReduceMotion() ? {} : staggerItemVariants}
        >
          <div className="text-3xl font-bold text-gray-900 mb-2">156</div>
          <div className="text-sm text-gray-600">연락 완료</div>
        </motion.div>
        <motion.div
          className="text-center bg-blue-100 rounded-lg p-5"
          variants={shouldReduceMotion() ? {} : staggerItemVariants}
        >
          <div className="text-3xl font-bold text-blue-600 mb-2">12</div>
          <div className="text-sm text-gray-600">관심 표현</div>
        </motion.div>
      </div>

      {/* Activity Feed */}
      <motion.div
        className="bg-green-50 rounded-lg p-4 border-l-4 border-green-400"
        variants={shouldReduceMotion() ? {} : staggerItemVariants}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-7 h-7 bg-green-500 rounded flex items-center justify-center mr-3">
              <span className="text-white text-sm font-bold">VN</span>
            </div>
            <span className="text-gray-900 font-medium text-base">베트남 바이어 답변</span>
          </div>
          <div className="text-sm text-gray-500">2m</div>
        </div>
      </motion.div>
    </motion.div>
  )
}
