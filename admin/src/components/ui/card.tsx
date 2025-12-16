import { motion } from "framer-motion"
import type * as React from "react"

import { cardHoverVariants, shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  animated?: boolean
}

type MotionSafeProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onAnimationStart" | "onDrag" | "onDragEnd" | "onDragStart" | "onDragCapture"
>

const Card = ({
  className,
  hoverable = false,
  animated = false,
  ref,
  onAnimationStart,
  onDrag,
  onDragStart,
  onDragEnd,
  onDragCapture,
  ...props
}: CardProps & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  const reducedMotion = shouldReduceMotion()

  // 애니메이션이 비활성화된 경우 또는 reduced motion
  if (!(animated || hoverable) || reducedMotion) {
    return (
      <div
        className={cn(
          "rounded-xl border bg-card text-card-foreground shadow transition-shadow duration-300",
          hoverable && "cursor-pointer hover:shadow-lg",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }

  // 애니메이션이 활성화된 경우
  const motionProps = props as MotionSafeProps
  return (
    <motion.div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow",
        hoverable && "cursor-pointer",
        className,
      )}
      initial={hoverable ? "rest" : undefined}
      ref={ref}
      variants={hoverable ? cardHoverVariants : undefined}
      whileHover={hoverable ? "hover" : undefined}
      whileTap={hoverable ? "tap" : undefined}
      {...motionProps}
    />
  )
}
Card.displayName = "Card"

const CardHeader = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} ref={ref} {...props} />
)
CardHeader.displayName = "CardHeader"

const CardTitle = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div
    className={cn("font-semibold leading-none tracking-tight", className)}
    ref={ref}
    {...props}
  />
)
CardTitle.displayName = "CardTitle"

const CardDescription = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div className={cn("text-muted-foreground text-sm", className)} ref={ref} {...props} />
)
CardDescription.displayName = "CardDescription"

const CardContent = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div className={cn("p-6 pt-0", className)} ref={ref} {...props} />
)
CardContent.displayName = "CardContent"

const CardFooter = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div className={cn("flex items-center p-6 pt-0", className)} ref={ref} {...props} />
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
