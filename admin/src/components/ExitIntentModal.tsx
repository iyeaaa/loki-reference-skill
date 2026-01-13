import { Sparkles } from "lucide-react"
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
 * 이탈 방지 모달
 * - 데스크톱: Dialog (중앙 모달)
 * - 모바일: Drawer (바텀시트, 최대 60vh)
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

  // 모바일: Drawer (바텀시트)
  if (isMobile) {
    return (
      <Drawer onOpenChange={(o) => !o && onClose()} open={open}>
        <DrawerContent className="max-h-[60vh]">
          <DrawerHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <DrawerTitle className="text-lg">
              {isKorean ? messages.title.ko : messages.title.en}
            </DrawerTitle>
            <DrawerDescription className="mt-2 whitespace-pre-line text-sm">
              {isKorean ? messages.description.ko : messages.description.en}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerFooter className="pb-6">
            <Button className="h-12 w-full bg-blue-600 hover:bg-blue-700" onClick={handleStay}>
              {isKorean ? messages.stayButton.ko : messages.stayButton.en}
            </Button>
            <Button className="h-12 w-full text-gray-500" onClick={onClose} variant="ghost">
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <Sparkles className="h-7 w-7 text-blue-600" />
          </div>
          <DialogTitle className="text-xl">
            {isKorean ? messages.title.ko : messages.title.en}
          </DialogTitle>
          <DialogDescription className="mt-2 whitespace-pre-line">
            {isKorean ? messages.description.ko : messages.description.en}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-col">
          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleStay}>
            {isKorean ? messages.stayButton.ko : messages.stayButton.en}
          </Button>
          <Button className="w-full text-gray-500" onClick={onClose} variant="ghost">
            {isKorean ? messages.leaveButton.ko : messages.leaveButton.en}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
