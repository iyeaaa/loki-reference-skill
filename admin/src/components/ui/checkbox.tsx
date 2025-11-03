import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import * as React from "react"

import { shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  const reducedMotion = shouldReduceMotion()

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 shadow transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-purple-01 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-rd-purple-01 data-[state=checked]:border-rd-purple-01 data-[state=checked]:text-white dark:border-gray-600",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
        asChild={!reducedMotion}
      >
        {reducedMotion ? (
          <Check className="h-4 w-4" />
        ) : (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 25,
            }}
          >
            <Check className="h-4 w-4" />
          </motion.div>
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
