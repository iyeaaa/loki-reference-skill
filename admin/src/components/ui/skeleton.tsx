import { motion } from "framer-motion"
import { shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const reducedMotion = shouldReduceMotion()

  if (reducedMotion) {
    return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />
  }

  return (
    <motion.div
      className={cn("rounded-md bg-primary/10", className)}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
      {...(props as any)}
    />
  )
}

export { Skeleton }
