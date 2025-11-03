import { motion } from "framer-motion"
import * as React from "react"

import { cardHoverVariants, shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  animated?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, animated = false, ...props }, ref) => {
    const reducedMotion = shouldReduceMotion()

    // 애니메이션이 비활성화된 경우 또는 reduced motion
    if ((!animated && !hoverable) || reducedMotion) {
      return (
        <div
          ref={ref}
          className={cn(
            "rounded-xl border bg-card text-card-foreground shadow transition-shadow duration-300",
            hoverable && "hover:shadow-lg cursor-pointer",
            className,
          )}
          {...props}
        />
      )
    }

    // 애니메이션이 활성화된 경우
    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-xl border bg-card text-card-foreground shadow",
          hoverable && "cursor-pointer",
          className,
        )}
        variants={hoverable ? cardHoverVariants : undefined}
        initial={hoverable ? "rest" : undefined}
        whileHover={hoverable ? "hover" : undefined}
        whileTap={hoverable ? "tap" : undefined}
        {...(props as any)}
      />
    )
  },
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
