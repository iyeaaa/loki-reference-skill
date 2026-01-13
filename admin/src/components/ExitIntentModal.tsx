import { AlertTriangle, Check, Gift, Sparkles, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import type { ExitIntentMessage, OnboardingStep } from "@/lib/exit-intent-messages"
import { getExitIntentMessage } from "@/lib/exit-intent-messages"

type ExitIntentModalProps = {
  open: boolean
  onClose: () => void
  onStay: () => void
  step: OnboardingStep
  isKorean?: boolean
}

/**
 * 이탈 방지 모달 - 심리적 설득력 강화 버전
 *
 * UX 개선 포인트:
 * 1. 긴급성 배지: 희소성/시간 제한 느낌
 * 2. 혜택 체크리스트: 구체적 가치 제시
 * 3. 사회적 증거: 다른 기업들도 사용 중
 * 4. 손실 회피 메시지: 놓치면 아쉬운 점 강조
 *
 * - 데스크톱: Dialog (중앙 모달)
 * - 모바일: Drawer (바텀시트, 최대 75vh)
 */
export function ExitIntentModal({
  open,
  onClose,
  onStay,
  step,
  isKorean = true,
}: ExitIntentModalProps) {
  const isMobile = useIsMobile()
  const messages: ExitIntentMessage = getExitIntentMessage(step)

  const handleStay = () => {
    onStay()
    onClose()
  }

  // 🆕 혜택 체크리스트 렌더링
  const renderBenefits = () => {
    if (!messages.benefits || messages.benefits.length === 0) {
      return null
    }

    return (
      <div className="space-y-2.5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        {messages.benefits.map((benefit, i) => (
          <div className="flex items-center gap-3" key={i}>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500">
              <Check className="h-3 w-3 text-white" />
            </div>
            <span className="font-medium text-gray-700 text-sm">
              {isKorean ? benefit.ko : benefit.en}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // 🆕 사회적 증거 + 손실 회피 렌더링
  const renderSocialAndLoss = () => {
    return (
      <div className="space-y-3">
        {/* 사회적 증거 */}
        {messages.socialProof && (
          <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
            <Users className="h-4 w-4" />
            <span className="font-medium">
              {isKorean ? messages.socialProof.ko : messages.socialProof.en}
            </span>
          </div>
        )}

        {/* 손실 회피 메시지 */}
        {messages.lossMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span className="text-blue-800 text-xs">
              {isKorean ? messages.lossMessage.ko : messages.lossMessage.en}
            </span>
          </div>
        )}
      </div>
    )
  }

  // 모바일: Drawer (바텀시트)
  if (isMobile) {
    return (
      <Drawer onOpenChange={(o) => !o && onClose()} open={open}>
        <DrawerContent className="max-h-[75vh]">
          <DrawerHeader className="text-center">
            {/* 🆕 긴급성 배지 */}
            {messages.urgencyBadge && (
              <div className="mb-3 flex justify-center">
                <Badge className="bg-blue-600 px-3 py-1 text-white shadow-sm">
                  {isKorean ? messages.urgencyBadge.ko : messages.urgencyBadge.en}
                </Badge>
              </div>
            )}

            {/* 아이콘 */}
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 shadow-md">
              <Gift className="h-7 w-7 text-blue-600" />
            </div>

            {/* 제목 */}
            <DrawerTitle className="text-lg">
              {isKorean ? messages.title.ko : messages.title.en}
            </DrawerTitle>

            {/* 설명 */}
            <DrawerDescription className="mt-2 whitespace-pre-line text-sm">
              {isKorean ? messages.description.ko : messages.description.en}
            </DrawerDescription>
          </DrawerHeader>

          {/* 🆕 혜택 체크리스트 */}
          <div className="space-y-4 px-4">
            {renderBenefits()}
            {renderSocialAndLoss()}
          </div>

          <DrawerFooter className="pb-6">
            {/* 🆕 CTA 버튼 강화 */}
            <Button
              className="h-12 w-full bg-blue-600 font-semibold shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
              onClick={handleStay}
            >
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" />
                {isKorean ? messages.stayButton.ko : messages.stayButton.en}
              </span>
            </Button>
            <Button className="h-10 w-full text-gray-400 text-xs" onClick={onClose} variant="ghost">
              {isKorean ? messages.leaveButton.ko : messages.leaveButton.en}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  // 데스크톱: Dialog (중앙 모달)
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          {/* 🆕 긴급성 배지 */}
          {messages.urgencyBadge && (
            <div className="mb-3 flex justify-center">
              <Badge className="bg-blue-600 px-4 py-1.5 font-medium text-white shadow-sm">
                {isKorean ? messages.urgencyBadge.ko : messages.urgencyBadge.en}
              </Badge>
            </div>
          )}

          {/* 아이콘 - 더 눈에 띄게 */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 shadow-md ring-4 ring-blue-50">
            <Gift className="h-8 w-8 text-blue-600" />
          </div>

          {/* 제목 */}
          <DialogTitle className="text-xl">
            {isKorean ? messages.title.ko : messages.title.en}
          </DialogTitle>

          {/* 설명 */}
          <DialogDescription className="mt-2 whitespace-pre-line text-base text-gray-600">
            {isKorean ? messages.description.ko : messages.description.en}
          </DialogDescription>
        </DialogHeader>

        {/* 🆕 혜택 체크리스트 */}
        <div className="mt-4 space-y-4">
          {renderBenefits()}
          {renderSocialAndLoss()}
        </div>

        <DialogFooter className="mt-5 flex-col gap-2 sm:flex-col">
          {/* 🆕 CTA 버튼 강화 */}
          <Button
            className="h-12 w-full bg-blue-600 font-semibold text-base shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
            onClick={handleStay}
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5" />
              {isKorean ? messages.stayButton.ko : messages.stayButton.en}
            </span>
          </Button>

          {/* 떠나기 버튼 - 의도적으로 덜 눈에 띄게 */}
          <Button
            className="w-full text-gray-400 text-xs hover:text-gray-500"
            onClick={onClose}
            variant="ghost"
          >
            {isKorean ? messages.leaveButton.ko : messages.leaveButton.en}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
