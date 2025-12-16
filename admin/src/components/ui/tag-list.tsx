import * as React from "react"
import { cn } from "@/lib/utils"

export interface TagListProps extends React.HTMLAttributes<HTMLUListElement> {
  /**
   * The tags to display
   */
  children: React.ReactNode
  /**
   * Layout direction
   * @default "horizontal"
   */
  direction?: "horizontal" | "vertical"
  /**
   * Whether tags should wrap to multiple lines
   * @default true
   */
  wrap?: boolean
  /**
   * Gap size between tags
   * @default "sm"
   */
  gap?: "none" | "xs" | "sm" | "md" | "lg"
  /**
   * Alignment of tags
   * @default "start"
   */
  align?: "start" | "center" | "end"
}

const gapClasses = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-3",
}

const alignClasses = {
  start: "justify-start items-start",
  center: "justify-center items-center",
  end: "justify-end items-end",
}

/**
 * TagList Component
 *
 * A flexible container for displaying multiple Tag components with
 * customizable layout, spacing, and wrapping behavior.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <TagList>
 *   <Tag variant="positive">Positive</Tag>
 *   <Tag variant="high">High</Tag>
 *   <Tag variant="meeting-request">Meeting Request</Tag>
 * </TagList>
 *
 * // Vertical layout
 * <TagList direction="vertical">
 *   <Tag variant="positive">Positive</Tag>
 *   <Tag variant="high">High</Tag>
 * </TagList>
 *
 * // No wrapping (scrollable)
 * <TagList wrap={false}>
 *   <Tag variant="positive">Positive</Tag>
 *   <Tag variant="negative">Negative</Tag>
 *   <Tag variant="other">Other</Tag>
 * </TagList>
 *
 * // Large gap
 * <TagList gap="lg">
 *   <Tag variant="positive">Positive</Tag>
 *   <Tag variant="high">High</Tag>
 * </TagList>
 * ```
 */
export const TagList = ({
  className,
  children,
  direction = "horizontal",
  wrap = true,
  gap = "sm",
  align = "start",
  ref,
  ...props
}: TagListProps & { ref?: React.RefObject<HTMLUListElement | null> }) => (
  <ul
    className={cn(
      "flex list-none",
      direction === "horizontal" ? "flex-row" : "flex-col",
      wrap ? "flex-wrap" : "flex-nowrap overflow-x-auto",
      gapClasses[gap],
      alignClasses[align],
      className,
    )}
    ref={ref}
    {...props}
  >
    {React.Children.map(children, (child, index) => (
      <li key={index}>{child}</li>
    ))}
  </ul>
)

TagList.displayName = "TagList"
