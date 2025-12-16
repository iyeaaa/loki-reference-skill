import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import type * as React from "react"

import { backdropVariants, scaleVariants, shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
  ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Overlay> | null>
}) => {
  const reducedMotion = shouldReduceMotion()

  if (reducedMotion) {
    return (
      <DialogPrimitive.Overlay
        className={cn(
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }

  return (
    <DialogPrimitive.Overlay asChild ref={ref} {...props}>
      <motion.div
        animate="visible"
        className={cn("fixed inset-0 z-50 bg-black/50 backdrop-blur-sm", className)}
        exit="exit"
        initial="hidden"
        variants={backdropVariants}
      />
    </DialogPrimitive.Overlay>
  )
}
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = ({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Content> | null>
}) => {
  const reducedMotion = shouldReduceMotion()

  if (reducedMotion) {
    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border bg-white p-6 shadow-xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in dark:bg-gray-900",
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
          <DialogPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content asChild ref={ref} {...props}>
        <motion.div
          animate="visible"
          className={cn(
            "fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border bg-white p-6 shadow-2xl dark:bg-gray-900",
            className,
          )}
          exit="exit"
          initial="hidden"
          variants={scaleVariants}
        >
          {children}
          <DialogPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
  ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Title> | null>
}) => (
  <DialogPrimitive.Title
    className={cn("font-semibold text-lg leading-none tracking-tight", className)}
    ref={ref}
    {...props}
  />
)
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & {
  ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Description> | null>
}) => (
  <DialogPrimitive.Description
    className={cn("text-muted-foreground text-sm", className)}
    ref={ref}
    {...props}
  />
)
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
