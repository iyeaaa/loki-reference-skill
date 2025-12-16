import { motion } from "framer-motion"
import { shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

type MotionSafeProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onAnimationStart" | "onDrag" | "onDragEnd" | "onDragStart" | "onDragCapture"
>

function Skeleton({
  className,
  onAnimationStart,
  onDrag,
  onDragStart,
  onDragEnd,
  onDragCapture,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const reducedMotion = shouldReduceMotion()

  if (reducedMotion) {
    return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />
  }

  const motionProps = props as MotionSafeProps
  return (
    <motion.div
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      className={cn("rounded-md bg-primary/10", className)}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
      {...motionProps}
    />
  )
}

export { Skeleton }
