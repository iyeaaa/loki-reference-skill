import { motion } from "framer-motion"
import { BarChart3, Check, Mail, Search, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { OnboardingData } from "../types"

type ValuePropItem = {
  icon: React.ReactNode
  titleKo: string
  titleEn: string
  descKo: string
  descEn: string
  completed: boolean
}

export function ValuePropsPanel({
  currentStep,
  data,
  isKorean,
}: {
  currentStep: number
  data: OnboardingData
  isKorean: boolean
}) {
  const valueProps: ValuePropItem[] = [
    {
      icon: <Search className="h-4 w-4" />,
      titleKo: "맞춤 바이어 리스트",
      titleEn: "Matched buyer list",
      descKo: "AI가 찾은 해외 바이어",
      descEn: "Buyers found by AI",
      completed: data.industry !== null && currentStep >= 1,
    },
    {
      icon: <Users className="h-4 w-4" />,
      titleKo: "바이어 연락처",
      titleEn: "Buyer contacts",
      descKo: "담당자 이메일 확보",
      descEn: "Contact emails ready",
      completed: currentStep > 2,
    },
    {
      icon: <Mail className="h-4 w-4" />,
      titleKo: "맞춤 이메일",
      titleEn: "Personalized emails",
      descKo: "AI가 작성한 영업 이메일",
      descEn: "Sales emails by AI",
      completed: currentStep > 3,
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      titleKo: "실시간 분석",
      titleEn: "Real-time analytics",
      descKo: "반응률, 관심도 추적",
      descEn: "Response tracking",
      completed: currentStep > 4,
    },
  ]

  return (
    <Card className="border-0 bg-gradient-to-br from-gray-50 to-slate-50 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {isKorean ? "완료하면 바로 받아요" : "You'll get these instantly"}
        </CardTitle>
        <CardDescription className="text-xs">
          {isKorean ? "약 30초 후 AI가 준비해드려요" : "AI prepares in about 30 seconds"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {valueProps.map((item, index) => (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3"
              initial={{ opacity: 0, x: 10 }}
              key={index}
              transition={{ delay: index * 0.1 }}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-all",
                  item.completed
                    ? "bg-gradient-to-br from-green-400 to-emerald-500 text-white"
                    : "bg-gray-200 text-gray-400",
                )}
              >
                {item.completed ? <Check className="h-3.5 w-3.5" /> : item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-medium text-sm",
                    item.completed ? "text-gray-900" : "text-gray-500",
                  )}
                >
                  {isKorean ? item.titleKo : item.titleEn}
                </p>
                <p className="truncate text-gray-400 text-xs">
                  {isKorean ? item.descKo : item.descEn}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
