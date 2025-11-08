import { motion } from "framer-motion"
import { Key, Plus, TrendingUp, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SpeedBoostBannerProps {
  activeApiKeysCount: number
  isProcessing: boolean
  onAddApiKey: () => void
}

/**
 * Speed boost banner component showing API key benefits
 */
export function SpeedBoostBanner({
  activeApiKeysCount,
  isProcessing,
  onAddApiKey,
}: SpeedBoostBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full mt-6"
      style={{ maxWidth: "670px" }}
    >
      <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="flex-shrink-0"
          >
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" fill="currentColor" />
            </div>
          </motion.div>
          <div className="flex-1 min-w-0">
            {activeApiKeysCount > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    API KEY{" "}
                    <motion.span
                      key={`api-key-count-${activeApiKeysCount}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="inline-block text-primary font-bold"
                    >
                      {activeApiKeysCount}개
                    </motion.span>
                    로{" "}
                    <motion.span
                      key={`api-key-speed-${activeApiKeysCount}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="inline-block text-primary font-bold"
                    >
                      {activeApiKeysCount}배
                    </motion.span>{" "}
                    빠르게 처리 중
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  1개당 20개 동시 처리 · 추가할수록 더 빨라져요 (현재{" "}
                  <span className="font-medium text-primary">{activeApiKeysCount * 20}개</span> 동시
                  처리 중)
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    API 키를 먼저 설정해주세요
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  API KEY 추가하면 <span className="font-medium text-primary">N배</span> 빨라져요 ·{" "}
                  <span className="font-medium">계정별로 구분된 KEY가 필요해요</span>
                </p>
              </>
            )}
          </div>
          <Button
            variant={activeApiKeysCount === 0 ? "default" : "outline"}
            size="sm"
            onClick={onAddApiKey}
            disabled={isProcessing}
            className="flex-shrink-0"
          >
            <Plus className="mr-1 h-3 w-3" />
            API KEY 추가
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
