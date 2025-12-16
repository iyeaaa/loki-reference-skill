import { motion } from "framer-motion"
import type * as React from "react"

import { shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

type MotionSafeProps = Omit<
  React.ComponentProps<"input">,
  "onAnimationStart" | "onDrag" | "onDragEnd" | "onDragStart" | "onDragCapture"
>

const Input = ({
  className,
  type,
  onFocus,
  onBlur,
  ref,
  onAnimationStart,
  onDrag,
  onDragStart,
  onDragEnd,
  onDragCapture,
  ...props
}: React.ComponentProps<"input"> & { ref?: React.Ref<HTMLInputElement> }) => {
  const reducedMotion = shouldReduceMotion()

  if (reducedMotion) {
    return (
      <input
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        onAnimationStart={onAnimationStart}
        onBlur={onBlur}
        onDrag={onDrag}
        onDragCapture={onDragCapture}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onFocus={onFocus}
        ref={ref}
        type={type}
        {...props}
      />
    )
  }

  const motionProps = props as MotionSafeProps
  return (
    <motion.input
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      onBlur={onBlur}
      onFocus={onFocus}
      ref={ref}
      type={type}
      {...motionProps}
    />
  )
}
Input.displayName = "Input"

export { Input }
