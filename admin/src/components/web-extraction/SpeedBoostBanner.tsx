import { motion } from "framer-motion"
import { Key, Plus, TrendingUp, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

type SpeedBoostBannerProps = {
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
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-6 w-full"
      initial={{ opacity: 0, y: 10 }}
      style={{ maxWidth: "670px" }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            className="flex-shrink-0"
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <Zap className="h-5 w-5 text-primary" fill="currentColor" />
            </div>
          </motion.div>
          <div className="min-w-0 flex-1">
            {activeApiKeysCount > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-foreground text-sm">
                    API KEY{" "}
                    <motion.span
                      animate={{ scale: 1 }}
                      className="inline-block font-bold text-primary"
                      initial={{ scale: 0 }}
                      key={`api-key-count-${activeApiKeysCount}`}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      {activeApiKeysCount}개
                    </motion.span>
                    로{" "}
                    <motion.span
                      animate={{ scale: 1 }}
                      className="inline-block font-bold text-primary"
                      initial={{ scale: 0 }}
                      key={`api-key-speed-${activeApiKeysCount}`}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      {activeApiKeysCount}배
                    </motion.span>{" "}
                    빠르게 처리 중
                  </p>
                </div>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  1개당 20개 동시 처리 · 추가할수록 더 빨라져요 (현재{" "}
                  <span className="font-medium text-primary">{activeApiKeysCount * 20}개</span> 동시
                  처리 중)
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-foreground text-sm">
                    API 키를 먼저 설정해주세요
                  </p>
                </div>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  API KEY 추가하면 <span className="font-medium text-primary">N배</span> 빨라져요 ·{" "}
                  <span className="font-medium">계정별로 구분된 KEY가 필요해요</span>
                </p>
              </>
            )}
          </div>
          <Button
            className="flex-shrink-0"
            disabled={isProcessing}
            onClick={onAddApiKey}
            size="sm"
            variant={activeApiKeysCount === 0 ? "default" : "outline"}
          >
            <Plus className="mr-1 h-3 w-3" />
            API KEY 추가
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
