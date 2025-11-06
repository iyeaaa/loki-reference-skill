import { motion } from "framer-motion"
import * as React from "react"

import { shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onBlur, ...props }, ref) => {
    const reducedMotion = shouldReduceMotion()

    if (reducedMotion) {
      return (
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
          ref={ref}
          onFocus={onFocus}
          onBlur={onBlur}
          {...props}
        />
      )
    }

    return (
      <motion.input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onFocus={onFocus}
        onBlur={onBlur}
        // biome-ignore lint/suspicious/noExplicitAny: any type is used to pass props to the input
        {...(props as any)}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
