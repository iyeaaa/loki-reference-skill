import { cva, type VariantProps } from "class-variance-authority"
import { type HTMLMotionProps, motion } from "framer-motion"
import { X } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { shouldReduceMotion } from "@/lib/animations"
import { cn } from "@/lib/utils"

const tagVariants = cva(
  "inline-flex items-center gap-1 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md",
  {
    variants: {
      variant: {
        // Sentiment Tags
        positive: [
          "bg-[#dcfce7] text-[#166534] border border-[#86efac]",
          "dark:bg-[#166534]/20 dark:text-[#86efac] dark:border-[#166534]",
        ],
        negative: [
          "bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]",
          "dark:bg-[#991b1b]/20 dark:text-[#fca5a5] dark:border-[#991b1b]",
        ],
        other: [
          "bg-[#f3f4f6] text-[#374151] border border-[#d1d5db]",
          "dark:bg-[#374151]/20 dark:text-[#d1d5db] dark:border-[#4b5563]",
        ],
        unclassified: [
          "bg-[#f3f4f6] text-[#6b7280] border border-[#e5e7eb]",
          "dark:bg-[#374151]/20 dark:text-[#9ca3af] dark:border-[#4b5563]",
        ],
        // Priority Tags
        high: [
          "bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]",
          "dark:bg-[#991b1b]/20 dark:text-[#fca5a5] dark:border-[#991b1b]",
        ],
        medium: [
          "bg-[#fef3c7] text-[#92400e] border border-[#fde047]",
          "dark:bg-[#92400e]/20 dark:text-[#fde047] dark:border-[#92400e]",
        ],
        low: [
          "bg-[#dbeafe] text-[#1e40af] border border-[#93c5fd]",
          "dark:bg-[#1e40af]/20 dark:text-[#93c5fd] dark:border-[#1e40af]",
        ],
        // Category Tags
        "meeting-request": [
          "bg-[#e0e7ff] text-[#3730a3] border border-[#a5b4fc]",
          "dark:bg-[#3730a3]/20 dark:text-[#a5b4fc] dark:border-[#3730a3]",
        ],
        question: [
          "bg-[#fce7f3] text-[#831843] border border-[#f9a8d4]",
          "dark:bg-[#831843]/20 dark:text-[#f9a8d4] dark:border-[#831843]",
        ],
        auto: [
          "bg-[#f3f4f6] text-[#374151] border border-[#d1d5db]",
          "dark:bg-[#374151]/20 dark:text-[#d1d5db] dark:border-[#4b5563]",
        ],
        "other-category": [
          "bg-[#f3f4f6] text-[#374151] border border-[#d1d5db]",
          "dark:bg-[#374151]/20 dark:text-[#d1d5db] dark:border-[#4b5563]",
        ],
      },
      size: {
        small: "px-2 py-0.5 text-xs",
        medium: "px-2.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "other",
      size: "medium",
    },
  },
)

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof tagVariants> {
  /**
   * The content to display inside the tag
   */
  children: React.ReactNode
  /**
   * Optional tooltip text to show on hover
   */
  tooltip?: string
  /**
   * Whether the tag can be removed (shows X button)
   */
  removable?: boolean
  /**
   * Callback when the remove button is clicked
   */
  onRemove?: (e: React.MouseEvent | React.KeyboardEvent) => void
  /**
   * Custom aria-label for accessibility
   */
  "aria-label"?: string
  /**
   * Whether to animate the tag (respects reduced motion)
   */
  animated?: boolean
}

/**
 * Tag Component
 *
 * A versatile tag component for displaying message metadata like sentiment,
 * priority, and categories. Supports multiple variants, sizes, dark mode,
 * tooltips, and removable functionality.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Tag variant="positive">Positive</Tag>
 * <Tag variant="high">High Priority</Tag>
 *
 * // With tooltip
 * <Tag variant="positive" tooltip="Positive sentiment detected">
 *   Positive
 * </Tag>
 *
 * // Removable tag
 * <Tag variant="meeting-request" removable onRemove={() => console.log('removed')}>
 *   Meeting Request
 * </Tag>
 *
 * // Small size
 * <Tag variant="low" size="small">Low</Tag>
 * ```
 */
export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  (
    {
      className,
      variant,
      size,
      children,
      tooltip,
      removable = false,
      onRemove,
      "aria-label": ariaLabel,
      animated = true,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation()
    const reducedMotion = shouldReduceMotion()
    const shouldAnimate = animated && !reducedMotion

    const handleRemove = (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
      onRemove?.(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (removable && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault()
        handleRemove(e)
      }
    }

    const tagContent = (
      <>
        <span className="truncate">{children}</span>
        {removable && (
          <button
            type="button"
            onClick={handleRemove}
            onKeyDown={handleKeyDown}
            className="inline-flex items-center justify-center rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:opacity-70 transition-opacity"
            aria-label={t("common.tag.remove", { defaultValue: "Remove tag" })}
            tabIndex={0}
          >
            <X className={cn("shrink-0", size === "small" ? "h-3 w-3" : "h-3.5 w-3.5")} />
          </button>
        )}
      </>
    )

    const commonProps = {
      ref,
      className: cn(tagVariants({ variant, size }), className),
      role: "status",
      "aria-label": ariaLabel || `${variant} tag`,
      title: tooltip,
      ...props,
    }

    if (!shouldAnimate) {
      return <span {...commonProps}>{tagContent}</span>
    }

    return (
      <motion.span
        {...(commonProps as HTMLMotionProps<"span">)}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        whileHover={{ scale: 1.02 }}
      >
        {tagContent}
      </motion.span>
    )
  },
)

Tag.displayName = "Tag"
