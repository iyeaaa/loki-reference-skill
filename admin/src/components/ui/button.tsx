import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import type * as React from "react"

import { buttonVariants as animationVariants, shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-md px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

type MotionSafeProps = Omit<
  React.ComponentProps<"button">,
  "onAnimationStart" | "onDrag" | "onDragEnd" | "onDragStart" | "onDragCapture"
>

function Button({
  className,
  variant,
  size,
  asChild = false,
  disabled,
  onAnimationStart,
  onDrag,
  onDragStart,
  onDragEnd,
  onDragCapture,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const reducedMotion = shouldReduceMotion()
  const Comp = asChild ? Slot : "button"

  // asChild이거나 reduced motion인 경우 애니메이션 없이
  if (asChild || reducedMotion || disabled) {
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        data-slot="button"
        disabled={disabled}
        onAnimationStart={onAnimationStart}
        onDrag={onDrag}
        onDragCapture={onDragCapture}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        {...props}
      />
    )
  }

  // 일반 버튼에 애니메이션 적용
  const MotionComp = motion.button
  const motionProps = props as MotionSafeProps

  return (
    <MotionComp
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      disabled={disabled}
      initial="rest"
      variants={animationVariants}
      whileHover="hover"
      whileTap="tap"
      {...motionProps}
    />
  )
}

export { Button, buttonVariants }
